'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { matchScanToBank } from '@/lib/finanzas/reconciliation'
import { FP_ROLES, type FpRole } from '@/lib/types'

const PATH = '/team/gastos'
const CONCILIACION_PATH = '/team/finanzas/conciliacion'

export type ExpenseType =
  | 'taxi_transporte'
  | 'restaurante_comida'
  | 'alojamiento'
  | 'material_oficina'
  | 'software_suscripcion'
  | 'gasto_proyecto'
  | 'factura_proveedor'
  | 'otro'

export interface ExpenseScan {
  id: string
  user_id: string
  foto_url: string
  fecha_ticket: string | null
  hora_ticket: string | null
  ultimos_4: string | null
  nif_proveedor: string | null
  monto: number | null
  moneda: string
  tipo: ExpenseType
  proveedor: string | null
  descripcion: string | null
  proyecto_id: string | null
  notas: string | null
  created_at: string
  autor: { nombre: string } | null
}

// Cualquier rol FP puede subir y gestionar SUS gastos; solo fp_partner ve todo.
async function requireFP(): Promise<{ userId: string; rol: FpRole; isPartner: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) throw new Error('Sin permisos.')
  const rol = profile.rol as FpRole
  return { userId: user.id, rol, isPartner: rol === 'fp_partner' }
}

async function requirePartner() {
  const ctx = await requireFP()
  if (!ctx.isPartner) throw new Error('Solo partners pueden acceder.')
  return ctx
}

// Valida fecha YYYY-MM-DD real (la IA a veces devuelve formatos raros que la BD rechaza)
function validateFecha(fecha: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  if (!fecha) return { ok: true, value: null }
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return { ok: false, error: `Fecha del documento inválida: "${fecha}". Usa formato AAAA-MM-DD.` }
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return { ok: false, error: `Fecha del documento inválida: "${fecha}".` }
  return { ok: true, value: fecha }
}

// ── uploadExpensePhoto ────────────────────────────────────────────────────────

export async function uploadExpensePhoto(
  formData: FormData
): Promise<{ url: string; path: string } | { error: string }> {
  try {
    const { userId } = await requireFP()
    const file = formData.get('photo') as File
    if (!file || file.size === 0) return { error: 'No se recibió ninguna foto.' }
    if (file.size > 10 * 1024 * 1024) return { error: 'La foto no puede superar 10 MB.' }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const ts  = Date.now()
    const storagePath = `${userId}/${ts}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from('expense-scans')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (error) return { error: error.message }

    const { data: { publicUrl } } = admin.storage
      .from('expense-scans')
      .getPublicUrl(data.path)

    return { url: publicUrl, path: data.path }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── saveExpenseScan ───────────────────────────────────────────────────────────

export async function saveExpenseScan(data: {
  foto_url: string
  fecha_ticket: string | null
  hora_ticket: string | null
  ultimos_4: string | null
  nif_proveedor: string | null
  monto: number | null
  moneda: string
  tipo: ExpenseType
  proveedor: string | null
  descripcion: string | null
  proyecto_id: string | null
  notas: string | null
}): Promise<{ id: string; conciliado: boolean } | { error: string }> {
  try {
    const { userId } = await requireFP()

    const fechaCheck = validateFecha(data.fecha_ticket)
    if (!fechaCheck.ok) return { error: fechaCheck.error }

    const admin = createAdminClient()

    const { data: row, error } = await admin
      .from('expense_scans')
      .insert({
        user_id:      userId,
        foto_url:      data.foto_url,
        fecha_ticket:  fechaCheck.value,
        hora_ticket:   data.hora_ticket,
        ultimos_4:     data.ultimos_4,
        nif_proveedor: data.nif_proveedor,
        monto:         data.monto,
        moneda:       data.moneda,
        tipo:         data.tipo,
        proveedor:    data.proveedor?.trim() || null,
        descripcion:  data.descripcion?.trim() || null,
        proyecto_id:  data.proyecto_id,
        notas:        data.notas?.trim() || null,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }

    // Conciliación automática contra movimientos bancarios sin justificante
    let conciliado = false
    try {
      const match = await matchScanToBank(admin, {
        id:            row.id,
        monto:         data.monto,
        moneda:        data.moneda,
        fecha_ticket:  fechaCheck.value,
        hora_ticket:   data.hora_ticket,
        proveedor:     data.proveedor,
        ultimos_4:     data.ultimos_4,
        nif_proveedor: data.nif_proveedor,
      })
      conciliado = match != null
      if (conciliado) revalidatePath(CONCILIACION_PATH)
    } catch { /* el matching nunca debe bloquear el guardado */ }

    revalidatePath(PATH)
    return { id: row.id, conciliado }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── updateExpenseScan ─────────────────────────────────────────────────────────

export async function updateExpenseScan(
  id: string,
  data: Partial<{
    fecha_ticket: string | null
    hora_ticket: string | null
    ultimos_4: string | null
    nif_proveedor: string | null
    monto: number | null
    moneda: string
    tipo: ExpenseType
    proveedor: string | null
    descripcion: string | null
    proyecto_id: string | null
    notas: string | null
  }>
): Promise<{ success: true } | { error: string }> {
  try {
    const { userId, isPartner } = await requireFP()

    if ('fecha_ticket' in data) {
      const fechaCheck = validateFecha(data.fecha_ticket)
      if (!fechaCheck.ok) return { error: fechaCheck.error }
      data.fecha_ticket = fechaCheck.value
    }

    const admin = createAdminClient()

    const { data: row } = await admin
      .from('expense_scans')
      .select('id, user_id, monto, moneda, fecha_ticket, hora_ticket, proveedor, ultimos_4, nif_proveedor')
      .eq('id', id)
      .single()
    if (!row) return { error: 'Gasto no encontrado.' }
    if (!isPartner && row.user_id !== userId) return { error: 'Solo puedes editar tus propios gastos.' }

    const { error } = await admin.from('expense_scans').update(data).eq('id', id)
    if (error) return { error: error.message }

    // Si tras la corrección el scan sigue sin vincular, reintentar conciliación
    try {
      const merged = { ...row, ...data }
      const match = await matchScanToBank(admin, {
        id,
        monto:         merged.monto ?? null,
        moneda:        merged.moneda ?? 'EUR',
        fecha_ticket:  merged.fecha_ticket ?? null,
        hora_ticket:   merged.hora_ticket ?? null,
        proveedor:     merged.proveedor ?? null,
        ultimos_4:     merged.ultimos_4 ?? null,
        nif_proveedor: merged.nif_proveedor ?? null,
      })
      if (match) revalidatePath(CONCILIACION_PATH)
    } catch { /* no bloquear */ }

    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── deleteExpenseScan ─────────────────────────────────────────────────────────

export async function deleteExpenseScan(
  id: string
): Promise<{ success: true } | { error: string }> {
  try {
    const { userId, isPartner } = await requireFP()
    const admin = createAdminClient()
    // Get the photo path to delete from storage
    const { data: row } = await admin
      .from('expense_scans').select('foto_url, user_id').eq('id', id).single()

    if (!row) return { error: 'Gasto no encontrado.' }
    if (!isPartner && row.user_id !== userId) return { error: 'Solo puedes eliminar tus propios gastos.' }

    const { error } = await admin.from('expense_scans').delete().eq('id', id)
    if (error) return { error: error.message }

    // Best-effort delete from storage
    if (row.foto_url) {
      const url = new URL(row.foto_url)
      const storagePath = url.pathname.split('/expense-scans/')[1]
      if (storagePath) {
        await admin.storage.from('expense-scans').remove([storagePath])
      }
    }

    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── getAllExpenseScans ────────────────────────────────────────────────────────

export async function getAllExpenseScans(
  limit = 500
): Promise<ExpenseScan[] | { error: string }> {
  try {
    const { userId, isPartner } = await requireFP()
    const admin = createAdminClient()
    let query = admin
      .from('expense_scans')
      .select('*, autor:profiles!user_id(nombre)')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (!isPartner) query = query.eq('user_id', userId)
    const { data, error } = await query
    if (error) return { error: error.message }
    return (data ?? []) as unknown as ExpenseScan[]
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── getExpenseScans ───────────────────────────────────────────────────────────

export async function getExpenseScans(
  year: number,
  month: number
): Promise<ExpenseScan[] | { error: string }> {
  try {
    const { userId, isPartner } = await requireFP()
    const admin = createAdminClient()

    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    let query = admin
      .from('expense_scans')
      .select('*, autor:profiles!user_id(nombre)')
      .or(`and(fecha_ticket.gte.${from},fecha_ticket.lte.${to}),and(fecha_ticket.is.null,created_at.gte.${from}T00:00:00,created_at.lte.${to}T23:59:59)`)
      .order('fecha_ticket', { ascending: false, nullsFirst: false })
      .order('created_at',   { ascending: false })
    if (!isPartner) query = query.eq('user_id', userId)

    const { data, error } = await query
    if (error) return { error: error.message }
    return (data ?? []) as unknown as ExpenseScan[]
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── findOrphanScanFiles ───────────────────────────────────────────────────────
// Archivos subidos al bucket cuyo registro en BD nunca llegó a guardarse
// (el guardado falló en silencio). Permite recuperarlos y re-analizarlos.

export interface OrphanScanFile {
  path: string
  url: string
  name: string
  created_at: string | null
  size: number | null
}

export async function findOrphanScanFiles(): Promise<OrphanScanFile[] | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    // Carpetas raíz del bucket = user ids
    const { data: folders, error: rootErr } = await admin.storage
      .from('expense-scans')
      .list('', { limit: 1000 })
    if (rootErr) return { error: rootErr.message }

    const allFiles: { path: string; created_at: string | null; size: number | null }[] = []
    for (const entry of folders ?? []) {
      if (entry.id) {
        // archivo suelto en la raíz
        allFiles.push({ path: entry.name, created_at: entry.created_at ?? null, size: (entry.metadata as any)?.size ?? null })
        continue
      }
      const { data: files } = await admin.storage
        .from('expense-scans')
        .list(entry.name, { limit: 1000 })
      for (const f of files ?? []) {
        if (!f.id) continue
        allFiles.push({
          path: `${entry.name}/${f.name}`,
          created_at: f.created_at ?? null,
          size: (f.metadata as any)?.size ?? null,
        })
      }
    }

    // URLs registradas en BD
    const { data: rows, error: dbErr } = await admin
      .from('expense_scans')
      .select('foto_url')
    if (dbErr) return { error: dbErr.message }

    const registered = new Set<string>()
    for (const r of rows ?? []) {
      if (!r.foto_url) continue
      const p = r.foto_url.split('/expense-scans/')[1]
      if (p) registered.add(decodeURIComponent(p.split('?')[0]))
    }

    const orphans: OrphanScanFile[] = []
    for (const f of allFiles) {
      if (registered.has(f.path)) continue
      const { data: { publicUrl } } = admin.storage
        .from('expense-scans')
        .getPublicUrl(f.path)
      orphans.push({
        path: f.path,
        url: publicUrl,
        name: f.path.split('/').pop() ?? f.path,
        created_at: f.created_at,
        size: f.size,
      })
    }

    orphans.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    return orphans
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── deleteOrphanScanFile ──────────────────────────────────────────────────────

export async function deleteOrphanScanFile(
  path: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.storage.from('expense-scans').remove([path])
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
