'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { buscarEmitidaVigente, mensajeYaEmitida } from '@/lib/facturas/emitidaVigente'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { calcTotalsMoneda, formatNumeroCompleto, MENCION_NO_SUJETA, type Moneda } from '@/lib/facturasUtils'
import { tipoCambioBCE } from '@/lib/facturas/tipoCambioBCE'
import { SECCIONES_PRIVADAS, SECCION_CONSTRUCTORA } from '@/lib/finanzas/costs'

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

const hoy = () => new Date().toISOString().split('T')[0]

/** Contravalor en euros de un importe en moneda extranjera, al cambio BCE de hoy. */
async function aEurosHoy(importe: number, moneda: Moneda): Promise<number> {
  if (moneda === 'EUR') return importe
  const { tipo } = await tipoCambioBCE(hoy(), moneda)
  return Math.round((importe / tipo) * 100) / 100
}

export async function createFactura(data: {
  proyecto_id: string
  seccion: string
  concepto?: string
  /** En la moneda de la fila. Con USD, `monto` (euros) se estima al cambio BCE de hoy. */
  monto?: number
  moneda?: Moneda
  fecha_pago_acordada?: string | null
  clientes_ids?: string[]
  proveedor_id?: string | null
}): Promise<{ id: string; monto: number } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    // Destinatario único y excluyente: con proveedor, cero clientes. `clientes_ids`
    // es lo que filtra el portal del cliente, así que dejarlo poblado en una
    // factura a proveedor la haría visible a quien nunca debe verla.
    const proveedorId = data.proveedor_id ?? null
    const moneda      = data.moneda ?? 'EUR'
    const importe     = data.monto ?? 0
    const montoEur    = await aEurosHoy(importe, moneda)
    const { data: row, error } = await admin
      .from('facturas')
      .insert({
        proyecto_id:         data.proyecto_id,
        seccion:             data.seccion,
        concepto:            data.concepto ?? 'Nueva factura',
        monto:               montoEur,
        moneda,
        monto_moneda:        moneda === 'EUR' ? null : importe,
        fecha_pago_acordada: data.fecha_pago_acordada ?? null,
        status:              'acordada_contrato',
        clientes_ids:        proveedorId ? [] : (data.clientes_ids ?? []),
        proveedor_id:        proveedorId,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidateBoth(data.proyecto_id)
    return { id: row.id, monto: montoEur }
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
    seccion:             string
    numero_factura:      string | null
    monto:               number
    /** Importe en dólares de una fila USD: recalcula `monto` al cambio BCE de hoy */
    monto_moneda:        number
    fecha_emision:       string | null
    fecha_pago_acordada: string | null
    fecha_cobro:         string | null
    status:              string
    notas:               string | null
    clientes_ids:        string[]
    proveedor_id:        string | null
    margen_estimado_pct: number | null
  }>
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    // Destinatario excluyente (ver createFactura): asignar proveedor vacía los
    // clientes, y asignar clientes quita el proveedor. Se refuerza aquí y no solo
    // en la UI porque de este par depende quién puede ver y recibir la factura.
    const patch = { ...data }
    if (patch.monto_moneda != null) {
      const { data: actual } = await admin.from('facturas').select('moneda').eq('id', id).single()
      const moneda = (actual?.moneda ?? 'EUR') as Moneda
      if (moneda === 'EUR') delete patch.monto_moneda
      else patch.monto = await aEurosHoy(patch.monto_moneda, moneda)
    }
    if (patch.proveedor_id) patch.clientes_ids = []
    else if (patch.clientes_ids && patch.clientes_ids.length > 0) patch.proveedor_id = null

    const { error } = await admin.from('facturas').update(patch).eq('id', id)
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

// ── Mobiliario: liquidación del depósito ───────────────────────────────────────
// Congela/reabre el margen real (suplidos − compras) del proyecto. Mientras es
// false, la previsión de caja usa el margen estimado; al liquidar, el real.

export async function updateMobiliarioLiquidado(
  proyectoId: string,
  liquidado: boolean
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('proyectos')
      .update({ mobiliario_liquidado: liquidado })
      .eq('id', proyectoId)
    if (error) return { error: error.message }
    revalidateBoth(proyectoId)
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

    const yaEmitida = await buscarEmitidaVigente(admin, facturaId)
    if (yaEmitida) return { error: mensajeYaEmitida(yaEmitida.numero_completo) }

    // 1. Load the contract factura with project info
    const { data: f, error: fErr } = await admin
      .from('facturas')
      .select(`
        id, concepto, monto, moneda, monto_moneda, seccion, proyecto_id, clientes_ids, proveedor_id,
        proyectos(
          id, nombre, codigo, direccion, constructor_id,
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
      constructor_id: string | null
      proyectoCliente: ClienteData | null
    } | null

    // ── Resolver destinatario (CRÍTICO) ───────────────────────────────────────
    // El destinatario lo manda la propia factura, no solo su sección:
    //  - Cualquier factura con `proveedor_id` → se factura a ese proveedor. Cubre
    //    los rappels y descuentos de proveedores de mobiliario, que viven en
    //    "Compra de mobiliario" (sección pública, donde los suplidos sí van al cliente).
    //  - "Margen prorrateado de obra" sin proveedor fijado → constructora del proyecto.
    // Las facturas a proveedor nunca pueden acabar vinculadas a un cliente.
    const seccion: string = f.seccion
    const esSeccionPrivada = SECCIONES_PRIVADAS.includes(seccion)
    let proveedorId: string | null = (f as unknown as { proveedor_id?: string | null }).proveedor_id ?? null
    if (seccion === SECCION_CONSTRUCTORA && !proveedorId) {
      proveedorId = proyecto?.constructor_id ?? null
    }
    if (esSeccionPrivada && !proveedorId) {
      return {
        error: 'Esta factura es "Margen prorrateado de obra" y debe facturarse a la constructora. Asigna una constructora al proyecto, o un proveedor a la factura, antes de emitirla.',
      }
    }

    // ── Billing recipient: proveedor (constructora / mobiliario) OR clients ───
    let cliente: ClienteData | null = null
    let clienteLabel = 'Cliente por definir'
    // Datos fiscales del receptor cuando es un proveedor. Se mantienen aparte de
    // `cliente` porque `facturas_emitidas.cliente_id` tiene FK a clientes(id):
    // meter ahí un id de proveedor rompe el insert (23503) y contamina el array
    // `facturas.clientes_ids` que usa el portal para decidir qué ve cada cliente.
    let receptorProveedor: {
      id: string; nombre: string; nif: string | null; direccion: string | null
    } | null = null

    if (proveedorId) {
      const { data: prov } = await admin
        .from('proveedores')
        .select('id, nombre, razon_social, nif_cif, direccion_fiscal, direccion')
        .eq('id', proveedorId)
        .maybeSingle()
      if (!prov) {
        return { error: 'El proveedor asignado a esta factura ya no existe. Revísalo antes de emitirla.' }
      }
      const nombreFiscal = (prov as unknown as { razon_social?: string | null }).razon_social ?? prov.nombre
      const direccionFiscal = (prov as unknown as { direccion_fiscal?: string | null }).direccion_fiscal ?? prov.direccion ?? null
      receptorProveedor = {
        id:        prov.id,
        nombre:    nombreFiscal,
        nif:       prov.nif_cif ?? null,
        direccion: direccionFiscal,
      }
      clienteLabel = nombreFiscal
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

    // La dirección del proyecto es el domicilio del cliente: en una factura a
    // proveedor se referencia el proyecto por su código, no por dónde vive nadie.
    const referenciaProyecto = receptorProveedor
      ? (proyecto?.codigo ?? null)
      : (proyecto?.direccion?.replace(/\s*[\r\n]+\s*/g, ', ').trim() || null)
    const descripcionItem = referenciaProyecto
      ? `${f.concepto} — ${referenciaProyecto}`
      : f.concepto

    // Fila en dólares: el borrador sale en USD, sin IVA (cliente de EE. UU.) y con
    // el cambio BCE de hoy; si luego se cambia la fecha, el guardado lo recalcula.
    const moneda   = ((f as unknown as { moneda?: Moneda }).moneda ?? 'EUR') as Moneda
    const importe  = moneda === 'EUR'
      ? f.monto
      : Number((f as unknown as { monto_moneda?: number | null }).monto_moneda ?? 0)
    const items = [{
      descripcion:     descripcionItem,
      cantidad:        1,
      precio_unitario: importe,
      subtotal:        importe,
    }]
    const today    = hoy()
    const tipo_iva = moneda === 'EUR' ? 21 : 0
    const cambio   = moneda === 'EUR' ? null : await tipoCambioBCE(today, moneda)
    const totals   = calcTotalsMoneda(items, tipo_iva, null, moneda, cambio?.tipo ?? null)

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
        receptor_tipo:     receptorProveedor ? 'proveedor' : 'cliente',
        proveedor_id:      receptorProveedor?.id ?? null,
        // cliente_id SOLO cuando el receptor es un cliente real (FK a clientes.id)
        cliente_id:        receptorProveedor ? null : (cliente?.id ?? null),
        cliente_nombre:    clienteLabel,
        cliente_nif:       receptorProveedor ? receptorProveedor.nif       : (cliente?.nif_cif ?? null),
        cliente_direccion: receptorProveedor ? receptorProveedor.direccion : (cliente?.direccion_facturacion ?? null),
        proyecto_id:       proyecto?.id      ?? null,
        proyecto_nombre:   proyecto
          ? `${proyecto.codigo ? proyecto.codigo + ' · ' : ''}${proyecto.nombre}`
          : null,
        seccion:           f.seccion,
        items,
        moneda,
        tipo_cambio:           cambio?.tipo  ?? null,
        tipo_cambio_fecha:     cambio?.fecha ?? null,
        base_imponible_moneda: cambio ? totals.enMoneda.base_imponible : null,
        total_moneda:          cambio ? totals.enMoneda.total : null,
        mencion_legal:     cambio ? MENCION_NO_SUJETA : null,
        tipo_iva,
        base_imponible:    totals.eur.base_imponible,
        cuota_iva:         totals.eur.cuota_iva,
        tipo_irpf:         null,
        cuota_irpf:        null,
        total:             totals.eur.total,
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
    // En USD, el contravalor del cobro pasa a ser el de la factura (cambio real).
    await admin
      .from('facturas')
      .update({
        factura_emitida_id: emitida.id,
        ...(cambio ? { monto: totals.eur.base_imponible } : {}),
      })
      .eq('id', facturaId)

    revalidateBoth(f.proyecto_id)
    revalidatePath('/team/finanzas/facturacion/emitidas')

    return { id: emitida.id, numero_completo }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
