'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const PATH = '/team/finanzas/scanner'

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

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Solo partners pueden acceder.')
  return user
}

// ── uploadExpensePhoto ────────────────────────────────────────────────────────

export async function uploadExpensePhoto(
  formData: FormData
): Promise<{ url: string; path: string } | { error: string }> {
  try {
    const user = await requirePartner()
    const file = formData.get('photo') as File
    if (!file || file.size === 0) return { error: 'No se recibió ninguna foto.' }
    if (file.size > 10 * 1024 * 1024) return { error: 'La foto no puede superar 10 MB.' }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const ts  = Date.now()
    const storagePath = `${user.id}/${ts}.${ext}`
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
}): Promise<{ id: string } | { error: string }> {
  try {
    const user = await requirePartner()
    const admin = createAdminClient()

    const { data: row, error } = await admin
      .from('expense_scans')
      .insert({
        user_id:      user.id,
        foto_url:      data.foto_url,
        fecha_ticket:  data.fecha_ticket,
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
    revalidatePath(PATH)
    return { id: row.id }
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
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('expense_scans').update(data).eq('id', id)
    if (error) return { error: error.message }
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
    await requirePartner()
    const admin = createAdminClient()
    // Get the photo path to delete from storage
    const { data: row } = await admin
      .from('expense_scans').select('foto_url').eq('id', id).single()

    const { error } = await admin.from('expense_scans').delete().eq('id', id)
    if (error) return { error: error.message }

    // Best-effort delete from storage
    if (row?.foto_url) {
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

// ── getExpenseScans ───────────────────────────────────────────────────────────

export async function getExpenseScans(
  year: number,
  month: number
): Promise<ExpenseScan[] | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    const { data, error } = await admin
      .from('expense_scans')
      .select('*, autor:profiles!user_id(nombre)')
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to   + 'T23:59:59')
      .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return (data ?? []) as unknown as ExpenseScan[]
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
