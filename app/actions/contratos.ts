'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { SERVICIOS_CONFIG, calcPropuesta } from '@/lib/propuestas/config'
import type { ServicioId } from '@/lib/propuestas/config'
import { getPlantillaServicios } from '@/app/actions/plantillaPropuestas'

const PATH = '/team/captacion/contratos'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
  return user
}

export interface Honorario {
  seccion:             string
  descripcion:         string
  importe:             number
  fecha_pago_acordada: string | null
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createContrato(
  leadId?: string | null
): Promise<{ id: string } | { error: string }> {
  try {
    const user = await requirePartner()
    const admin = createAdminClient()

    // Auto-generate contract number: C-YYYY-NNN
    const year = new Date().getFullYear()
    const { data: lastRow } = await admin
      .from('contratos')
      .select('numero')
      .ilike('numero', `C-${year}-%`)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastN = lastRow?.numero
      ? parseInt(lastRow.numero.split('-')[2] ?? '0', 10)
      : 0
    const numero = `C-${year}-${String(lastN + 1).padStart(3, '0')}`

    // Pre-fill studio config
    const { data: cfg } = await admin.from('estudio_config').select('*').eq('id', 1).single()

    // Pre-fill lead data if provided
    let leadData: Record<string, string | null> = {}
    if (leadId) {
      const { data: lead } = await admin
        .from('leads')
        .select('nombre, apellidos, empresa, nif_cif, email, telefono, direccion, ciudad, codigo_postal, pais')
        .eq('id', leadId)
        .single()
      if (lead) {
        const fullName = [lead.nombre, lead.apellidos].filter(Boolean).join(' ')
        leadData = {
          cliente_nombre:    lead.empresa ? fullName : lead.nombre,
          cliente_apellidos: lead.apellidos ?? null,
          cliente_empresa:   lead.empresa   ?? null,
          cliente_nif:       lead.nif_cif   ?? null,
          cliente_email:     lead.email     ?? null,
          cliente_telefono:  lead.telefono  ?? null,
          cliente_direccion: lead.direccion ?? null,
          cliente_ciudad:    lead.ciudad    ?? null,
          cliente_cp:        lead.codigo_postal ?? null,
          cliente_pais:      lead.pais      ?? null,
        }
      }
    }

    const { data, error } = await admin
      .from('contratos')
      .insert({
        numero,
        lead_id:          leadId ?? null,
        emisor_nombre:    cfg?.nombre      ?? null,
        emisor_nif:       cfg?.nif         ?? null,
        emisor_direccion: cfg?.direccion   ?? null,
        emisor_ciudad:    cfg?.ciudad      ?? null,
        emisor_cp:        cfg?.codigo_postal ?? null,
        emisor_email:     cfg?.email       ?? null,
        emisor_telefono:  cfg?.telefono    ?? null,
        honorarios:       [],
        status:           'borrador',
        created_by:       user.id,
        ...leadData,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateContrato(
  id: string,
  data: Partial<{
    // Studio
    emisor_nombre:    string | null
    emisor_nif:       string | null
    emisor_direccion: string | null
    emisor_ciudad:    string | null
    emisor_cp:        string | null
    emisor_email:     string | null
    emisor_telefono:  string | null
    // Client
    cliente_nombre:    string | null
    cliente_apellidos: string | null
    cliente_empresa:   string | null
    cliente_nif:       string | null
    cliente_email:     string | null
    cliente_telefono:  string | null
    cliente_direccion: string | null
    cliente_ciudad:    string | null
    cliente_cp:        string | null
    cliente_pais:      string | null
    // Project
    proyecto_nombre:     string | null
    proyecto_direccion:  string | null
    proyecto_tipo:       string | null
    proyecto_superficie: number | null
    proyecto_codigo:     string | null
    // Contract
    honorarios:  Honorario[]
    status:      string
    fecha_envio: string | null
    fecha_firma: string | null
    notas:       string | null
    contenido:   Record<string, unknown>
  }>
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('contratos').update(data).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    revalidatePath(`${PATH}/${id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function createContratoFromPropuesta(
  propuestaId: string,
  tipoCliente: 'fisica' | 'juridica' = 'fisica'
): Promise<{ id: string } | { error: string }> {
  try {
    const user  = await requirePartner()
    const admin = createAdminClient()

    // Fetch propuesta
    const { data: propuesta, error: pErr } = await admin
      .from('propuestas').select('*').eq('id', propuestaId).single()
    if (pErr || !propuesta) return { error: 'Propuesta no encontrada.' }

    // Fetch lead
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
    }

    // Fetch servicios plantilla + ratios
    const [serviciosPlantilla, { data: ratiosFases }, { data: cfg }] = await Promise.all([
      getPlantillaServicios(),
      admin.from('catalogo_fases').select('id, label, seccion, ratio').eq('seccion', 'Interiorismo').order('orden'),
      admin.from('estudio_config').select('*').eq('id', 1).single(),
    ])

    const ratios = (ratiosFases ?? []).map(r => ({
      label: r.label, servicio: 'interiorismo' as ServicioId, ratio: r.ratio ?? 0,
    }))

    // Compute breakdown
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

    // Build honorarios lines (one per payment hito per service)
    const honorarios: Honorario[] = []
    for (const sid of (propuesta.servicios ?? [])) {
      const entry  = serviciosPlantilla.find(s => s.id === sid)
      const importe = breakdown[sid] ?? 0
      const pagos  = entry?.pago ?? []
      if (pagos.length > 0) {
        for (const p of pagos) {
          honorarios.push({ seccion: entry?.label ?? sid, descripcion: p.label, importe: importe * p.pct / 100, fecha_pago_acordada: null })
        }
      } else {
        honorarios.push({ seccion: entry?.label ?? sid, descripcion: entry?.label ?? sid, importe, fecha_pago_acordada: null })
      }
    }

    // Build service content for PDF (stored in contenido.servicios)
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
      }
    })

    // Auto-generate contract number
    const year = new Date().getFullYear()
    const { data: lastRow } = await admin
      .from('contratos').select('numero').ilike('numero', `C-${year}-%`)
      .order('numero', { ascending: false }).limit(1).maybeSingle()
    const lastN  = lastRow?.numero ? parseInt(lastRow.numero.split('-')[2] ?? '0', 10) : 0
    const numero = `C-${year}-${String(lastN + 1).padStart(3, '0')}`

    const { data, error } = await admin.from('contratos').insert({
      numero,
      propuesta_id:       propuestaId,
      status:             'borrador',
      proyecto_nombre:    propuesta.titulo     ?? null,
      proyecto_direccion: propuesta.direccion  ?? null,
      honorarios,
      proyecto_superficie: propuesta.m2_diseno ?? null,
      contenido:          { servicios: serviciosContenido, tipo_cliente: tipoCliente },
      emisor_nombre:      cfg?.nombre        ?? 'GEINEX GROUP SLU',
      emisor_nif:         cfg?.nif           ?? 'B44873552',
      emisor_direccion:   cfg?.direccion     ?? 'Calle Príncipe de Vergara 56, Piso 6 Pta 2',
      emisor_ciudad:      cfg?.ciudad        ?? 'Madrid',
      emisor_cp:          cfg?.codigo_postal ?? '28006',
      emisor_email:       cfg?.email         ?? 'contacto@formaprima.es',
      emisor_telefono:    cfg?.telefono      ?? null,
      created_by:         user.id,
      ...leadFields,
    }).select('id').single()

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteContrato(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('contratos').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Firmar contrato → genera proyecto, cliente y facturación ─────────────────

export async function firmarContrato(
  contratoId: string
): Promise<{ proyectoId: string; clienteId: string } | { error: string }> {
  try {
    const user = await requirePartner()
    const admin = createAdminClient()

    // 1. Load the full contract
    const { data: c, error: cErr } = await admin
      .from('contratos')
      .select('*')
      .eq('id', contratoId)
      .single()

    if (cErr || !c) return { error: 'Contrato no encontrado.' }
    if (c.status === 'firmado') return { error: 'El contrato ya está firmado.' }

    const honorarios: Honorario[] = c.honorarios ?? []

    // 2. Create client in clientes
    const clienteNombre = c.cliente_empresa
      ? [c.cliente_nombre, c.cliente_apellidos].filter(Boolean).join(' ') || c.cliente_empresa
      : c.cliente_nombre ?? 'Cliente'

    const { data: nuevoCliente, error: cliErr } = await admin
      .from('clientes')
      .insert({
        nombre:                c.cliente_nombre    ?? clienteNombre,
        apellidos:             c.cliente_apellidos ?? null,
        empresa:               c.cliente_empresa   ?? null,
        nif_cif:               c.cliente_nif       ?? null,
        email:                 c.cliente_email     ?? null,
        telefono:              c.cliente_telefono  ?? null,
        direccion:             c.cliente_direccion ?? null,
        ciudad:                c.cliente_ciudad    ?? null,
        codigo_postal:         c.cliente_cp        ?? null,
        pais:                  c.cliente_pais      ?? null,
        direccion_facturacion: c.cliente_direccion ?? null,
      })
      .select('id')
      .single()

    if (cliErr || !nuevoCliente) return { error: `Error creando cliente: ${cliErr?.message}` }
    const clienteId = nuevoCliente.id

    // 3. Mark lead as "ganado" if linked
    if (c.lead_id) {
      await admin.from('leads').update({ estado_lead: 'ganado' }).eq('id', c.lead_id)
    }

    // 4. Create project
    const slug = `${(c.proyecto_nombre ?? 'proyecto').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`
    const { data: nuevoProyecto, error: pErr } = await admin
      .from('proyectos')
      .insert({
        nombre:             c.proyecto_nombre    ?? 'Nuevo proyecto',
        codigo:             ((c.proyecto_codigo ?? '').toUpperCase() || null)?.slice(0, 5) ?? null,
        direccion:          c.proyecto_direccion ?? null,
        ubicacion:          c.proyecto_direccion ?? '-',
        cliente_id:         clienteId,
        status:             'activo',
        año:                new Date().getFullYear(),
        tipologia:          c.proyecto_tipo ?? '-',
        superficie_diseno:  c.proyecto_superficie ?? null,
        slug,
        estado:             'activo',
        created_by:         user.id,
      })
      .select('id')
      .single()

    if (pErr || !nuevoProyecto) return { error: `Error creando proyecto: ${pErr?.message}` }
    const proyectoId = nuevoProyecto.id

    // 5. Link client to project in junction table
    await admin.from('proyecto_clientes').insert({
      proyecto_id: proyectoId,
      cliente_id:  clienteId,
      rol:         'titular',
    })

    // 6. Create billing lines (facturas) from honorarios
    // Normalize service labels to the canonical section names used by the billing page
    const SECCION_NORM: Record<string, string> = {
      'Anteproyecto':               'Anteproyecto',
      'Proyecto de Ejecución':      'Proyecto de ejecución',
      'Proyecto de ejecución':      'Proyecto de ejecución',
      'Dirección Estética de Obra': 'Obra',
      'Obra':                       'Obra',
      'Proyecto de Interiorismo':   'Interiorismo',
      'Gestión de Interiorismo':    'Interiorismo',
      'Interiorismo':               'Interiorismo',
      'Post Venta':                 'Post venta',
      'Post venta':                 'Post venta',
    }

    if (honorarios.length > 0) {
      const { error: facturasErr } = await admin.from('facturas').insert(
        honorarios.map(h => ({
          proyecto_id:         proyectoId,
          seccion:             SECCION_NORM[h.seccion] ?? h.seccion,
          concepto:            h.descripcion || h.seccion,
          monto:               h.importe,
          fecha_pago_acordada: h.fecha_pago_acordada ?? null,
          status:              'acordada_contrato',
          clientes_ids:        [clienteId],
        }))
      )
      if (facturasErr) console.error('Error creando facturas:', facturasErr.message)
    }

    // 7. Create project phases based on contracted services
    const serviciosContratados: string[] = ((c.contenido?.servicios ?? []) as { id: string }[]).map(s => s.id)
    const { data: todasFases } = await admin
      .from('catalogo_fases')
      .select('id, label, seccion, orden')
      .order('orden')

    if (todasFases && todasFases.length > 0) {
      const faseIdsToAdd = new Set<string>()

      for (const fase of todasFases) {
        const label   = (fase.label   ?? '').toLowerCase()
        const seccion = (fase.seccion ?? '').toLowerCase()

        // Post venta → siempre incluida
        if (seccion.includes('post') || label.includes('post venta')) {
          faseIdsToAdd.add(fase.id)
          continue
        }

        // Anteproyecto → fases de Anteproyecto excepto visitas de venta y visual lab
        if (serviciosContratados.includes('anteproyecto') && seccion.includes('anteproyecto')) {
          if (!label.includes('visitas de venta') && !label.includes('visual lab')) {
            faseIdsToAdd.add(fase.id)
          }
          continue
        }

        // Ejecutivo → fases de Ejecutivo + Documentación económica
        if (serviciosContratados.includes('proyecto_ejecucion') &&
            (seccion.includes('ejecutivo') || seccion.includes('ejecuci') ||
             (label.includes('documentaci') && label.includes('econ')))) {
          faseIdsToAdd.add(fase.id)
          continue
        }

        // Obra → fases de Obra + Control de entrega
        if (serviciosContratados.includes('direccion_obra') &&
            (seccion.includes('obra') || (label.includes('control') && label.includes('entrega')))) {
          faseIdsToAdd.add(fase.id)
          continue
        }

        // Proyecto de Interiorismo → solo "Proyecto de interiorismo" y "Diseño 3D / Renders"
        if (serviciosContratados.includes('interiorismo')) {
          if (label.includes('proyecto de interiorismo') ||
              label.includes('diseño 3d') ||
              label.includes('render')) {
            faseIdsToAdd.add(fase.id)
            continue
          }
        }

        // Gestión de Interiorismo → fase de gestión
        if (serviciosContratados.includes('gestion_interiorismo')) {
          if (label.includes('gesti') && label.includes('interiorismo')) {
            faseIdsToAdd.add(fase.id)
            continue
          }
        }
      }

      if (faseIdsToAdd.size > 0) {
        await admin.from('proyecto_fases').insert(
          Array.from(faseIdsToAdd).map(faseId => ({
            proyecto_id:  proyectoId,
            fase_id:      faseId,
            responsables: [],
            fase_status:  'en_espera',
          }))
        )
      }
    }

    // 8. Mark contract as firmado and link to project/client
    await admin.from('contratos').update({
      status:      'firmado',
      fecha_firma: new Date().toISOString().split('T')[0],
      proyecto_id: proyectoId,
      cliente_id:  clienteId,
    }).eq('id', contratoId)

    revalidatePath(PATH)
    revalidatePath(`${PATH}/${contratoId}`)
    revalidatePath('/team/proyectos')
    revalidatePath('/team/clientes/base-datos')
    revalidatePath('/team/finanzas/facturacion/control')

    return { proyectoId, clienteId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
