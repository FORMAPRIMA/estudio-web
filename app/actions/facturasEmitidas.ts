'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { calcTotals, formatNumeroCompleto } from '@/lib/facturasUtils'
import { SECCION_ORDER } from '@/lib/finanzas/costs'
export { calcTotals, formatNumeroCompleto }

const PATH = '/team/finanzas/facturacion/emitidas'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
  return user.id
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface FacturaItem {
  descripcion:    string
  cantidad:       number
  precio_unitario: number
  subtotal:       number
}

export interface CreateFacturaInput {
  serie:            string
  fecha_emision:    string
  fecha_operacion?: string | null
  emisor_nombre:    string
  emisor_nif:       string
  emisor_direccion: string
  emisor_ciudad?:   string | null
  emisor_cp?:       string | null
  emisor_email?:    string | null
  emisor_telefono?: string | null
  cliente_id?:        string | null
  cliente_nombre:     string
  cliente_contacto?:  string | null
  cliente_nif?:       string | null
  cliente_direccion?: string | null
  proyecto_id?:     string | null
  proyecto_nombre?: string | null
  seccion?:         string | null
  items:            FacturaItem[]
  tipo_iva:         number
  tipo_irpf?:       number | null
  notas?:           string | null
  mencion_legal?:   string | null
  iban?:            string | null
  forma_pago?:      string | null
  condiciones_pago?: string | null
  es_rectificativa?: boolean
  factura_original_id?: string | null
  motivo_rectificacion?: string | null
  factura_origen_id?: string | null
}

// ── Estudio config ────────────────────────────────────────────────────────────

export type EstudioConfig = {
  nombre: string; nif: string | null; direccion: string | null
  ciudad: string | null; codigo_postal: string | null; pais: string | null
  email: string | null; email_cc: string | null; telefono: string | null
  iban: string | null; banco_nombre: string | null; banco_swift: string | null
  factura_numero_inicio: number | null
}

export async function getEstudioConfig(): Promise<EstudioConfig | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('estudio_config').select('*').eq('id', 1).single()
  return data as EstudioConfig | null
}

export async function updateEstudioConfig(data: Partial<EstudioConfig>): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('estudio_config').update(data).eq('id', 1)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── CRUD facturas emitidas ────────────────────────────────────────────────────

export async function createFacturaEmitida(
  input: CreateFacturaInput
): Promise<{ id: string; numero_completo: string } | { error: string }> {
  try {
    const userId = await requirePartner()
    const admin  = createAdminClient()
    const año    = new Date(input.fecha_emision).getFullYear()

    // Next correlative number for this serie + año
    const [{ data: maxRow }, { data: cfg }] = await Promise.all([
      admin
        .from('facturas_emitidas')
        .select('numero')
        .eq('serie', input.serie)
        .eq('año', año)
        .order('numero', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from('estudio_config').select('factura_numero_inicio').eq('id', 1).single(),
    ])

    const offset          = (cfg as { factura_numero_inicio: number | null } | null)?.factura_numero_inicio ?? 0
    const numero          = Math.max(maxRow?.numero ?? 0, offset) + 1
    const numero_completo = formatNumeroCompleto(input.serie, año, numero)
    const totals          = calcTotals(input.items, input.tipo_iva, input.tipo_irpf)

    const { data: row, error } = await admin
      .from('facturas_emitidas')
      .insert({
        serie:             input.serie,
        numero,
        año,
        numero_completo,
        fecha_emision:     input.fecha_emision,
        fecha_operacion:   input.fecha_operacion ?? null,
        emisor_nombre:     input.emisor_nombre,
        emisor_nif:        input.emisor_nif,
        emisor_direccion:  input.emisor_direccion,
        emisor_ciudad:     input.emisor_ciudad ?? null,
        emisor_cp:         input.emisor_cp ?? null,
        emisor_email:      input.emisor_email ?? null,
        emisor_telefono:   input.emisor_telefono ?? null,
        cliente_id:        input.cliente_id ?? null,
        cliente_nombre:    input.cliente_nombre,
        cliente_contacto:  input.cliente_contacto ?? null,
        cliente_nif:       input.cliente_nif ?? null,
        cliente_direccion: input.cliente_direccion ?? null,
        proyecto_id:       input.proyecto_id ?? null,
        proyecto_nombre:   input.proyecto_nombre ?? null,
        seccion:           input.seccion ?? null,
        items:             input.items,
        tipo_iva:          input.tipo_iva,
        tipo_irpf:         input.tipo_irpf ?? null,
        base_imponible:    totals.base_imponible,
        cuota_iva:         totals.cuota_iva,
        cuota_irpf:        input.tipo_irpf ? totals.cuota_irpf : null,
        total:             totals.total,
        notas:             input.notas ?? null,
        mencion_legal:     input.mencion_legal ?? null,
        iban:              input.iban ?? null,
        forma_pago:        input.forma_pago ?? 'Transferencia bancaria',
        condiciones_pago:  input.condiciones_pago ?? null,
        es_rectificativa:  input.es_rectificativa ?? false,
        factura_original_id:  input.factura_original_id ?? null,
        motivo_rectificacion: input.motivo_rectificacion ?? null,
        factura_origen_id:    input.factura_origen_id ?? null,
        estado:            'borrador',
        created_by:        userId,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }

    // If created from a contract factura, link it back
    if (input.factura_origen_id && row) {
      await admin
        .from('facturas')
        .update({ factura_emitida_id: row.id })
        .eq('id', input.factura_origen_id)
    }

    revalidatePath(PATH)
    return { id: row.id, numero_completo }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Maps facturas_emitidas.estado → facturas.status
const ESTADO_TO_STATUS: Record<string, string> = {
  enviada: 'enviada',
  pagada:  'pagada',
  anulada: 'impagada',
}

export async function updateFacturaEmitidaEstado(
  id: string,
  estado: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('facturas_emitidas').update({ estado }).eq('id', id)
    if (error) return { error: error.message }

    // Cascade to the linked contract factura if one exists
    const newStatus = ESTADO_TO_STATUS[estado]
    if (newStatus) {
      const { data: emitida } = await admin
        .from('facturas_emitidas')
        .select('factura_origen_id')
        .eq('id', id)
        .single()
      if (emitida?.factura_origen_id) {
        await admin
          .from('facturas')
          .update({ status: newStatus })
          .eq('id', emitida.factura_origen_id)
      }
    }

    revalidatePath(PATH)
    revalidatePath('/team/finanzas/facturacion/control')
    revalidatePath('/team/finanzas/operativas/proyectos')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export interface ClienteDelProyecto {
  id: string
  nombre: string
  apellidos: string | null
  email: string | null
  email_cc: string | null
}

export interface PartnerCC {
  nombre: string
  email: string
}

export async function getPartnerCCEmails(): Promise<PartnerCC[]> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('nombre, apellidos, email')
      .eq('rol', 'fp_partner')
    return (data ?? [])
      .filter((p: { email: string | null }) => !!p.email)
      .map((p: { nombre: string | null; apellidos: string | null; email: string }) => ({
        nombre: [p.nombre, p.apellidos].filter(Boolean).join(' ').trim() || p.email,
        email:  p.email,
      }))
  } catch {
    return []
  }
}

export async function getClientesDelProyecto(
  proyectoId: string
): Promise<ClienteDelProyecto[]> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('proyecto_clientes')
      .select('clientes(id, nombre, apellidos, email, email_cc)')
      .eq('proyecto_id', proyectoId)

    type Row = { clientes: ClienteDelProyecto | ClienteDelProyecto[] | null }
    return (data ?? []).flatMap((row: Row) => {
      const c = row.clientes
      if (!c) return []
      if (Array.isArray(c)) return c
      return [c]
    })
  } catch {
    return []
  }
}

export async function updateFacturaEmitida(
  id: string,
  input: Omit<CreateFacturaInput, 'serie' | 'factura_origen_id'>
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin  = createAdminClient()
    const totals = calcTotals(input.items, input.tipo_iva, input.tipo_irpf)

    const { error } = await admin.from('facturas_emitidas').update({
      fecha_emision:        input.fecha_emision,
      fecha_operacion:      input.fecha_operacion      ?? null,
      emisor_nombre:        input.emisor_nombre,
      emisor_nif:           input.emisor_nif,
      emisor_direccion:     input.emisor_direccion,
      emisor_ciudad:        input.emisor_ciudad        ?? null,
      emisor_cp:            input.emisor_cp            ?? null,
      emisor_email:         input.emisor_email         ?? null,
      emisor_telefono:      input.emisor_telefono      ?? null,
      cliente_id:           input.cliente_id           ?? null,
      cliente_nombre:       input.cliente_nombre,
      cliente_contacto:     input.cliente_contacto     ?? null,
      cliente_nif:          input.cliente_nif          ?? null,
      cliente_direccion:    input.cliente_direccion    ?? null,
      proyecto_id:          input.proyecto_id          ?? null,
      proyecto_nombre:      input.proyecto_nombre      ?? null,
      items:                input.items,
      tipo_iva:             input.tipo_iva,
      tipo_irpf:            input.tipo_irpf            ?? null,
      base_imponible:       totals.base_imponible,
      cuota_iva:            totals.cuota_iva,
      cuota_irpf:           input.tipo_irpf ? totals.cuota_irpf : null,
      total:                totals.total,
      notas:                input.notas                ?? null,
      mencion_legal:        input.mencion_legal        ?? null,
      iban:                 input.iban                 ?? null,
      forma_pago:           input.forma_pago           ?? null,
      condiciones_pago:     input.condiciones_pago     ?? null,
      es_rectificativa:     input.es_rectificativa     ?? false,
      factura_original_id:  input.factura_original_id  ?? null,
      motivo_rectificacion: input.motivo_rectificacion ?? null,
    }).eq('id', id)

    if (error) return { error: error.message }

    revalidatePath(PATH)
    revalidatePath('/team/finanzas/facturacion/control')
    revalidatePath('/team/finanzas/operativas/proyectos')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Asignación de proyecto + sección (impacta contabilidad) ───────────────────

function revalidateProyecto(proyectoId?: string | null) {
  if (!proyectoId) return
  revalidatePath(`/team/finanzas/facturacion/control/${proyectoId}`)
  revalidatePath(`/team/finanzas/operativas/proyectos/${proyectoId}`)
}

// Maps facturas_emitidas.estado → facturas.status (para la fila de contabilidad)
const ESTADO_TO_FACTURA_STATUS: Record<string, string> = {
  borrador: 'acordada_contrato',
  enviada:  'enviada',
  pagada:   'pagada',
  anulada:  'impagada',
}

/** Secciones reales de un proyecto (de proyecto_fases → catalogo_fases.seccion). */
export async function getSeccionesProyecto(proyectoId: string): Promise<string[]> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('proyecto_fases')
      .select('catalogo_fases(seccion)')
      .eq('proyecto_id', proyectoId)

    type Row = { catalogo_fases: { seccion: string | null } | { seccion: string | null }[] | null }
    const found = new Set<string>()
    for (const row of (data ?? []) as Row[]) {
      const cf = row.catalogo_fases
      if (!cf) continue
      const arr = Array.isArray(cf) ? cf : [cf]
      for (const c of arr) if (c?.seccion) found.add(c.seccion)
    }

    const ordered: string[] = SECCION_ORDER.filter(s => found.has(s))
    for (const s of Array.from(found)) if (!ordered.includes(s)) ordered.push(s)
    // Si el proyecto no tiene fases todavía, ofrecer la lista canónica
    return ordered.length > 0 ? ordered : [...SECCION_ORDER]
  } catch {
    return [...SECCION_ORDER]
  }
}

/**
 * Asigna (o reasigna) proyecto + sección a una factura emitida y lo refleja en
 * contabilidad creando/sincronizando una fila en `facturas`.
 * - Pasar `proyectoId = null` deshace la asignación (borra la fila auto-creada).
 * - Nunca borra ni mueve filas de `facturas` que vengan de un contrato.
 */
export async function asignarProyectoSeccion(
  emitidaId: string,
  proyectoId: string | null,
  seccion: string | null,
): Promise<{ success: true; proyecto_nombre: string | null; seccion: string | null } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    const { data: emitida, error: emErr } = await admin
      .from('facturas_emitidas')
      .select('id, base_imponible, estado, factura_origen_id, cliente_id, numero_completo')
      .eq('id', emitidaId)
      .single()
    if (emErr || !emitida) return { error: emErr?.message ?? 'Factura no encontrada.' }

    // ── Deshacer asignación ──────────────────────────────────────────────────
    if (!proyectoId) {
      if (emitida.factura_origen_id) {
        const { data: origen } = await admin
          .from('facturas')
          .select('id, creada_desde_emitida, proyecto_id')
          .eq('id', emitida.factura_origen_id)
          .maybeSingle()
        if (origen?.creada_desde_emitida) {
          await admin.from('facturas').delete().eq('id', origen.id)
          revalidateProyecto(origen.proyecto_id)
        }
        // Filas de contrato: se dejan intactas, solo se desvincula la emitida.
      }
      const { error: upErr } = await admin
        .from('facturas_emitidas')
        .update({ proyecto_id: null, proyecto_nombre: null, seccion: null, factura_origen_id: null })
        .eq('id', emitidaId)
      if (upErr) return { error: upErr.message }
      revalidatePath(PATH)
      revalidatePath('/team/finanzas/facturacion/control')
      revalidatePath('/team/finanzas/operativas/proyectos')
      return { success: true, proyecto_nombre: null, seccion: null }
    }

    // ── Asignar / reasignar ──────────────────────────────────────────────────
    const { data: proy } = await admin
      .from('proyectos')
      .select('id, nombre, codigo')
      .eq('id', proyectoId)
      .single()
    const proyectoNombre = proy
      ? `${proy.codigo ? proy.codigo + ' · ' : ''}${proy.nombre}`
      : null

    const status   = ESTADO_TO_FACTURA_STATUS[emitida.estado] ?? 'acordada_contrato'
    const monto    = emitida.base_imponible ?? 0
    const concepto = `Factura ${emitida.numero_completo}${seccion ? ' · ' + seccion : ''}`

    let facturaId = emitida.factura_origen_id as string | null

    if (facturaId) {
      const { data: origen } = await admin
        .from('facturas')
        .select('id, creada_desde_emitida, proyecto_id')
        .eq('id', facturaId)
        .maybeSingle()
      if (origen?.creada_desde_emitida) {
        // Fila auto-creada: se puede mover proyecto/sección/monto/status
        await admin
          .from('facturas')
          .update({ proyecto_id: proyectoId, seccion: seccion ?? '', monto, status, concepto })
          .eq('id', origen.id)
        if (origen.proyecto_id && origen.proyecto_id !== proyectoId) revalidateProyecto(origen.proyecto_id)
      } else if (origen) {
        // Fila de contrato: solo ajustamos la etiqueta de sección, nunca el importe/estado
        if (seccion) await admin.from('facturas').update({ seccion }).eq('id', origen.id)
      } else {
        facturaId = null // el vínculo apuntaba a una fila inexistente: recrear
      }
    }

    if (!facturaId) {
      const { data: nueva, error: insErr } = await admin
        .from('facturas')
        .insert({
          proyecto_id:          proyectoId,
          seccion:              seccion ?? '',
          concepto,
          monto,
          status,
          clientes_ids:         emitida.cliente_id ? [emitida.cliente_id] : [],
          creada_desde_emitida: true,
          factura_emitida_id:   emitidaId,
        })
        .select('id')
        .single()
      if (insErr) return { error: insErr.message }
      facturaId = nueva.id
    }

    const { error: upErr } = await admin
      .from('facturas_emitidas')
      .update({
        proyecto_id:       proyectoId,
        proyecto_nombre:   proyectoNombre,
        seccion:           seccion ?? null,
        factura_origen_id: facturaId,
      })
      .eq('id', emitidaId)
    if (upErr) return { error: upErr.message }

    revalidatePath(PATH)
    revalidatePath('/team/finanzas/facturacion/control')
    revalidatePath('/team/finanzas/operativas/proyectos')
    revalidateProyecto(proyectoId)
    return { success: true, proyecto_nombre: proyectoNombre, seccion: seccion ?? null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteFacturaEmitida(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    // If this emitida spawned its own accounting row (creada_desde_emitida),
    // remove that row too. Contract-origin facturas are NEVER deleted here.
    const { data: emitida } = await admin
      .from('facturas_emitidas')
      .select('factura_origen_id')
      .eq('id', id)
      .single()
    if (emitida?.factura_origen_id) {
      const { data: origen } = await admin
        .from('facturas')
        .select('id, creada_desde_emitida')
        .eq('id', emitida.factura_origen_id)
        .maybeSingle()
      if (origen?.creada_desde_emitida) {
        await admin.from('facturas').delete().eq('id', origen.id)
      }
    }

    // Clear any remaining back-reference in contract facturas (avoids FK constraint)
    await admin
      .from('facturas')
      .update({ factura_emitida_id: null })
      .eq('factura_emitida_id', id)

    const { error } = await admin.from('facturas_emitidas').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    revalidatePath('/team/finanzas/facturacion/control')
    revalidatePath('/team/finanzas/operativas/proyectos')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
