// Construcción de un contrato (borrador) a partir de una propuesta.
//
// Extraído de app/actions/contratos.ts para poder reusarlo desde dos sitios:
//   1) createContratoFromPropuesta (con auth de partner, desde el equipo)
//   2) submitFormalizacion (sin auth — lo dispara el cliente al completar sus
//      datos fiscales, y entonces el contrato se genera automáticamente)
//
// No aplica guard de permisos ni revalida rutas: eso es responsabilidad de quien
// lo llama. No avanza la etapa del Espacio (también lo hace el llamador).

import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICIOS_CONFIG, calcPropuesta } from '@/lib/propuestas/config'
import type { ServicioId } from '@/lib/propuestas/config'
import { getPlantillaServicios } from '@/app/actions/plantillaPropuestas'

type Admin = ReturnType<typeof createAdminClient>

export interface Honorario {
  seccion:             string
  descripcion:         string
  importe:             number
  fecha_pago_acordada: string | null
}

export async function buildContratoFromPropuesta(
  admin: Admin,
  propuestaId: string,
  tipoCliente: 'fisica' | 'juridica',
  createdBy: string | null,
): Promise<{ id: string; leadId: string | null } | { error: string }> {
  // Fetch propuesta
  const { data: propuesta, error: pErr } = await admin
    .from('propuestas').select('*').eq('id', propuestaId).single()
  if (pErr || !propuesta) return { error: 'Propuesta no encontrada.' }

  // Fetch contacto (lead o cliente) para precargar datos del firmante
  let leadFields: Record<string, string | null> = {}
  if (propuesta.lead_id) {
    const { data: lead } = await admin
      .from('leads')
      .select('nombre, apellidos, empresa, nif_cif, documento_identidad, email, telefono, direccion, ciudad, codigo_postal, pais')
      .eq('id', propuesta.lead_id).single()
    if (lead) {
      leadFields = {
        lead_id:           propuesta.lead_id,
        cliente_nombre:    lead.nombre,
        cliente_apellidos: lead.apellidos      ?? null,
        cliente_empresa:   lead.empresa        ?? null,
        cliente_nif:       lead.nif_cif ?? lead.documento_identidad ?? null,
        cliente_email:     lead.email          ?? null,
        cliente_telefono:  lead.telefono       ?? null,
        cliente_direccion: lead.direccion      ?? null,
        cliente_ciudad:    lead.ciudad         ?? null,
        cliente_cp:        lead.codigo_postal  ?? null,
        cliente_pais:      lead.pais           ?? 'España',
      }
    }
  } else if ((propuesta as { cliente_id?: string }).cliente_id) {
    const clienteId = (propuesta as { cliente_id: string }).cliente_id
    const { data: cliente } = await admin
      .from('clientes')
      .select('nombre, apellidos, empresa, nif_cif, documento_identidad, email, telefono, direccion, ciudad, codigo_postal, pais')
      .eq('id', clienteId).single()
    if (cliente) {
      leadFields = {
        cliente_id:        clienteId,
        cliente_nombre:    cliente.nombre,
        cliente_apellidos: cliente.apellidos      ?? null,
        cliente_empresa:   cliente.empresa        ?? null,
        cliente_nif:       cliente.nif_cif ?? (cliente as { documento_identidad?: string }).documento_identidad ?? null,
        cliente_email:     cliente.email          ?? null,
        cliente_telefono:  cliente.telefono       ?? null,
        cliente_direccion: cliente.direccion      ?? null,
        cliente_ciudad:    cliente.ciudad         ?? null,
        cliente_cp:        (cliente as { codigo_postal?: string }).codigo_postal ?? null,
        cliente_pais:      cliente.pais           ?? 'España',
      }
    }
  }

  // Servicios plantilla + ratios + config del estudio
  const [serviciosPlantilla, { data: ratiosFases }, { data: cfg }] = await Promise.all([
    getPlantillaServicios(),
    admin.from('catalogo_fases').select('id, label, seccion, ratio').eq('seccion', 'Interiorismo').order('orden'),
    admin.from('estudio_config').select('*').eq('id', 1).single(),
  ])

  const ratios = (ratiosFases ?? []).map(r => ({
    label: r.label, servicio: 'interiorismo' as ServicioId, ratio: r.ratio ?? 0,
  }))

  // Breakdown económico (con overrides de la propuesta)
  const baseServs = (propuesta.servicios ?? []).filter((s: string) => s in SERVICIOS_CONFIG) as ServicioId[]
  const { breakdown: auto } = calcPropuesta({
    m2: propuesta.m2_diseno ?? 0, costoM2: propuesta.costo_m2_objetivo ?? 0,
    porcentajePem: propuesta.porcentaje_pem ?? 10, servicios: baseServs,
    pctJunior: propuesta.pct_junior ?? 0, pctSenior: propuesta.pct_senior ?? 70,
    pctPartner: propuesta.pct_partner ?? 30, ratios,
  })
  const breakdown: Record<string, number> = { ...auto }
  for (const [k, v] of Object.entries(propuesta.honorarios_override ?? {})) {
    breakdown[k] = v as number
  }

  // Líneas de honorarios (una por hito de pago por servicio)
  const honorarios: Honorario[] = []
  for (const sid of (propuesta.servicios ?? [])) {
    const entry   = serviciosPlantilla.find(s => s.id === sid)
    const importe = breakdown[sid] ?? 0
    const pagos   = entry?.pago ?? []
    if (pagos.length > 0) {
      for (const p of pagos) {
        honorarios.push({ seccion: entry?.label ?? sid, descripcion: p.label, importe: importe * p.pct / 100, fecha_pago_acordada: null })
      }
    } else {
      honorarios.push({ seccion: entry?.label ?? sid, descripcion: entry?.label ?? sid, importe, fecha_pago_acordada: null })
    }
  }

  // Contenido de servicios para el PDF
  const serviciosContenido = (propuesta.servicios ?? []).map((sid: string) => {
    const entry = serviciosPlantilla.find(s => s.id === sid)
    return {
      id:          sid,
      label:       entry?.label        ?? sid,
      texto:       entry?.texto        ?? '',
      entregables: entry?.entregables  ?? [],
      importe:     breakdown[sid]      ?? 0,
      semanas:     propuesta.semanas?.[sid] ?? entry?.semanas_default ?? '',
      pago:        entry?.pago         ?? [],
      notas:       entry?.notas        ?? '',
    }
  })

  // Numeración automática C-YYYY-NNN
  const year = new Date().getFullYear()
  const { data: lastRow } = await admin
    .from('contratos').select('numero').ilike('numero', `C-${year}-%`)
    .order('numero', { ascending: false }).limit(1).maybeSingle()
  const lastN  = lastRow?.numero ? parseInt(lastRow.numero.split('-')[2] ?? '0', 10) : 0
  const numero = `C-${year}-${String(lastN + 1).padStart(3, '0')}`

  const { data, error } = await admin.from('contratos').insert({
    numero,
    propuesta_id:        propuestaId,
    status:              'borrador',
    proyecto_nombre:     propuesta.titulo     ?? null,
    proyecto_direccion:  propuesta.direccion  ?? null,
    honorarios,
    proyecto_superficie: propuesta.m2_diseno ?? null,
    contenido:           { servicios: serviciosContenido, tipo_cliente: tipoCliente },
    emisor_nombre:       cfg?.nombre        ?? 'GEINEX GROUP SLU',
    emisor_nif:          cfg?.nif           ?? 'B44873552',
    emisor_direccion:    cfg?.direccion     ?? 'Calle Príncipe de Vergara 56, Piso 6 Pta 2',
    emisor_ciudad:       cfg?.ciudad        ?? 'Madrid',
    emisor_cp:           cfg?.codigo_postal ?? '28006',
    emisor_email:        cfg?.email         ?? 'contacto@formaprima.es',
    emisor_telefono:     cfg?.telefono      ?? null,
    created_by:          createdBy,
    ...leadFields,
  }).select('id').single()

  if (error) return { error: error.message }
  return { id: data.id as string, leadId: (propuesta.lead_id as string | null) ?? null }
}
