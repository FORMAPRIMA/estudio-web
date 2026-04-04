'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { calcTotals, formatNumeroCompleto } from '@/lib/facturasUtils'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
}

function revalidateBoth(proyectoId?: string) {
  revalidatePath('/team/finanzas/facturacion/control')
  revalidatePath('/team/finanzas/operativas/proyectos')
  revalidatePath('/team/finanzas/facturacion/emitidas')
  if (proyectoId) {
    revalidatePath(`/team/finanzas/facturacion/control/${proyectoId}`)
    revalidatePath(`/team/finanzas/operativas/proyectos/${proyectoId}`)
  }
}

// ── Facturas ──────────────────────────────────────────────────────────────────

export async function addFactura(data: {
  proyecto_id: string
  seccion: string
  concepto?: string
  monto?: number
  fecha_pago_acordada?: string | null
  clientes_ids?: string[]
  proveedor_id?: string | null
}): Promise<{ id: string } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('facturas')
      .insert({
        proyecto_id:         data.proyecto_id,
        seccion:             data.seccion,
        concepto:            data.concepto ?? 'Nueva factura',
        monto:               data.monto ?? 0,
        fecha_pago_acordada: data.fecha_pago_acordada ?? null,
        status:              'acordada_contrato',
        clientes_ids:        data.clientes_ids ?? [],
        proveedor_id:        data.proveedor_id ?? null,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidateBoth(data.proyecto_id)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Maps facturas.status → facturas_emitidas.estado
const STATUS_TO_ESTADO: Record<string, string> = {
  enviada:  'enviada',
  pagada:   'pagada',
  impagada: 'anulada',
}

export async function updateFactura(
  id: string,
  proyectoId: string,
  data: Partial<{
    concepto:            string
    numero_factura:      string | null
    monto:               number
    fecha_emision:       string | null
    fecha_pago_acordada: string | null
    fecha_cobro:         string | null
    status:              string
    notas:               string | null
    clientes_ids:        string[]
    proveedor_id:        string | null
  }>
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('facturas').update(data).eq('id', id)
    if (error) return { error: error.message }

    // Cascade status change to linked facturas_emitidas if one exists
    if (data.status) {
      const newEstado = STATUS_TO_ESTADO[data.status]
      if (newEstado) {
        const { data: f } = await admin
          .from('facturas')
          .select('factura_emitida_id')
          .eq('id', id)
          .single()
        if (f?.factura_emitida_id) {
          await admin
            .from('facturas_emitidas')
            .update({ estado: newEstado })
            .eq('id', f.factura_emitida_id)
        }
      }
    }

    revalidateBoth(proyectoId)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteFactura(
  id: string,
  proyectoId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    // Clear any FK back-reference in facturas_emitidas before deleting
    // (facturas_emitidas.factura_origen_id → facturas.id would block the delete)
    await admin
      .from('facturas_emitidas')
      .update({ factura_origen_id: null })
      .eq('factura_origen_id', id)

    const { error } = await admin.from('facturas').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidateBoth(proyectoId)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Clientes — billing info ───────────────────────────────────────────────────

export async function updateClienteBilling(
  id: string,
  data: Partial<{
    nombre:               string
    apellidos:            string | null
    empresa:              string | null
    email:                string | null
    email_cc:             string | null
    telefono:             string | null
    telefono_alt:         string | null
    nif_cif:              string | null
    direccion_facturacion: string | null
    ciudad:               string | null
    codigo_postal:        string | null
    pais:                 string | null
  }>
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('clientes').update(data).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/team/finanzas/facturacion/control')
    revalidatePath('/team/clientes/base-datos')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Aplazar fecha cobro ───────────────────────────────────────────────────────

export async function aplazarFactura(
  id: string,
  proyectoId: string,
  nuevaFecha: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('facturas')
      .update({ fecha_pago_acordada: nuevaFecha, status: 'acordada_contrato' })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidateBoth(proyectoId)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Emitir factura desde contrato ─────────────────────────────────────────────
// Collects all data sources, creates a facturas_emitidas record as 'borrador'

export async function emitirFacturaDesdeContrato(
  facturaId: string
): Promise<{ id: string; numero_completo: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Sin sesión activa.')
    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')

    const admin = createAdminClient()

    // 1. Load the contract factura with project info
    const { data: f, error: fErr } = await admin
      .from('facturas')
      .select(`
        id, concepto, monto, seccion, proyecto_id, clientes_ids, proveedor_id,
        proyectos(
          id, nombre, codigo, direccion,
          proyectoCliente:clientes!cliente_id(
            id, nombre, apellidos, empresa,
            nif_cif, direccion_facturacion, ciudad, codigo_postal
          )
        )
      `)
      .eq('id', facturaId)
      .single()

    if (fErr || !f) return { error: 'Factura no encontrada.' }

    // 2. Load studio config (emisor)
    const { data: cfg } = await admin
      .from('estudio_config')
      .select('*')
      .eq('id', 1)
      .single()

    if (!cfg || !cfg.nombre) return { error: 'Configura primero los datos del estudio en Facturas Emitidas.' }

    type ClienteData = {
      id: string; nombre: string; apellidos: string | null; empresa: string | null
      nif_cif: string | null; direccion_facturacion: string | null
      ciudad: string | null; codigo_postal: string | null
    }

    const proyecto = f.proyectos as unknown as {
      id: string; nombre: string; codigo: string | null; direccion: string | null
      proyectoCliente: ClienteData | null
    } | null

    const proveedorId: string | null = (f as unknown as { proveedor_id?: string | null }).proveedor_id ?? null

    // ── Billing recipient: proveedor (constructor) OR clients ─────────────────
    let cliente: ClienteData | null = null
    let clienteLabel = 'Cliente por definir'

    if (proveedorId) {
      // Bill the constructor — use proveedor fiscal data
      const { data: prov } = await admin
        .from('proveedores')
        .select('id, nombre, razon_social, nif_cif, direccion_fiscal, direccion')
        .eq('id', proveedorId)
        .single()
      if (prov) {
        const nombreFiscal = (prov as unknown as { razon_social?: string | null }).razon_social ?? prov.nombre
        const direccionFiscal = (prov as unknown as { direccion_fiscal?: string | null }).direccion_fiscal ?? prov.direccion ?? null
        cliente = {
          id:                    prov.id,
          nombre:                nombreFiscal,
          apellidos:             null,
          empresa:               nombreFiscal,
          nif_cif:               prov.nif_cif ?? null,
          direccion_facturacion: direccionFiscal,
          ciudad:                null,
          codigo_postal:         null,
        }
        clienteLabel = nombreFiscal
      }
    } else {
      // Load clients assigned to this factura (clientes_ids array)
      const clientesIds: string[] = (f as unknown as { clientes_ids?: string[] }).clientes_ids ?? []
      let clientesPagadores: ClienteData[] = []
      if (clientesIds.length > 0) {
        const { data: cRows } = await admin
          .from('clientes')
          .select('id, nombre, apellidos, empresa, nif_cif, direccion_facturacion, ciudad, codigo_postal')
          .in('id', clientesIds)
        clientesPagadores = (cRows ?? []) as ClienteData[]
        clientesPagadores.sort((a, b) => clientesIds.indexOf(a.id) - clientesIds.indexOf(b.id))
      }

      const buildNombre = (c: ClienteData) => {
        const full = [c.nombre, c.apellidos].filter(Boolean).join(' ')
        return c.empresa ? `${full} — ${c.empresa}` : full
      }

      // Primary billing client: first in clientes_ids, or fall back to project's main client
      cliente = clientesPagadores[0] ?? proyecto?.proyectoCliente ?? null
      clienteLabel = clientesPagadores.length > 1
        ? clientesPagadores.map(c => [c.nombre, c.apellidos].filter(Boolean).join(' ')).join(' y ')
        : cliente ? buildNombre(cliente) : 'Cliente por definir'
    }

    // 3. Next invoice number
    const serie  = 'F'
    const año    = new Date().getFullYear()
    const [{ data: maxRow }, { data: cfgNum }] = await Promise.all([
      admin
        .from('facturas_emitidas')
        .select('numero')
        .eq('serie', serie)
        .eq('año', año)
        .order('numero', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from('estudio_config').select('factura_numero_inicio').eq('id', 1).single(),
    ])

    const offset          = (cfgNum as { factura_numero_inicio: number | null } | null)?.factura_numero_inicio ?? 0
    const numero          = Math.max(maxRow?.numero ?? 0, offset) + 1
    const numero_completo = formatNumeroCompleto(serie, año, numero)

    const descripcionItem = proyecto?.direccion
      ? `${f.concepto} — ${proyecto.direccion}`
      : f.concepto

    const items = [{
      descripcion:     descripcionItem,
      cantidad:        1,
      precio_unitario: f.monto,
      subtotal:        f.monto,
    }]
    const tipo_iva = 21
    const totals   = calcTotals(items, tipo_iva)
    const today    = new Date().toISOString().split('T')[0]

    // 4. Insert facturas_emitidas as borrador
    const { data: emitida, error: insErr } = await admin
      .from('facturas_emitidas')
      .insert({
        serie,
        numero,
        año,
        numero_completo,
        fecha_emision:     today,
        fecha_operacion:   null,
        emisor_nombre:     cfg.nombre,
        emisor_nif:        cfg.nif           ?? '',
        emisor_direccion:  cfg.direccion     ?? '',
        emisor_ciudad:     cfg.ciudad        ?? null,
        emisor_cp:         cfg.codigo_postal ?? null,
        emisor_email:      cfg.email         ?? null,
        emisor_telefono:   cfg.telefono      ?? null,
        cliente_id:        cliente?.id       ?? null,
        cliente_nombre:    clienteLabel,
        cliente_nif:       cliente?.nif_cif  ?? null,
        cliente_direccion: cliente?.direccion_facturacion ?? null,
        proyecto_id:       proyecto?.id      ?? null,
        proyecto_nombre:   proyecto
          ? `${proyecto.codigo ? proyecto.codigo + ' · ' : ''}${proyecto.nombre}`
          : null,
        items,
        tipo_iva,
        base_imponible:    totals.base_imponible,
        cuota_iva:         totals.cuota_iva,
        tipo_irpf:         null,
        cuota_irpf:        null,
        total:             totals.total,
        iban:              cfg.iban          ?? null,
        forma_pago:        'Transferencia bancaria',
        estado:            'borrador',
        factura_origen_id: facturaId,
        created_by:        user.id,
      })
      .select('id')
      .single()

    if (insErr || !emitida) return { error: insErr?.message ?? 'Error al crear la factura.' }

    // 5. Link back to the contract factura
    await admin
      .from('facturas')
      .update({ factura_emitida_id: emitida.id })
      .eq('id', facturaId)

    revalidateBoth(f.proyecto_id)
    revalidatePath('/team/finanzas/facturacion/emitidas')

    return { id: emitida.id, numero_completo }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
