'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const PATH = '/team/finanzas/conciliacion'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Solo partners pueden acceder.')
  return user
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BankStatement {
  id: string
  year: number
  month: number
  filename: string | null
  row_count: number | null
  uploaded_by: string | null
  created_at: string
}

export interface BankTransaction {
  id: string
  statement_id: string
  fila: number | null
  fecha: string | null
  concepto: string | null
  importe: number | null
  moneda: string
  expense_scan_id: string | null
  match_confidence: string | null
  tipo_fiscal: string
  notas: string | null
  linked_scan?: {
    foto_url: string
    tipo: string
    monto: number | null
    fecha_ticket: string | null
    proveedor: string | null
  } | null
}

// ── getBankStatements ─────────────────────────────────────────────────────────

export async function getBankStatements(
  year: number,
  month: number
): Promise<BankStatement[] | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('bank_statements')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return (data ?? []) as BankStatement[]
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── getBankTransactions ───────────────────────────────────────────────────────

export async function getBankTransactions(
  statementId: string
): Promise<BankTransaction[] | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('bank_transactions')
      .select(`
        *,
        linked_scan:expense_scans!expense_scan_id(
          foto_url,
          tipo,
          monto,
          fecha_ticket,
          proveedor
        )
      `)
      .eq('statement_id', statementId)
      .order('fecha', { ascending: true })

    if (error) return { error: error.message }
    return (data ?? []) as unknown as BankTransaction[]
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── linkTransaction ───────────────────────────────────────────────────────────

export async function linkTransaction(
  transactionId: string,
  scanId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('bank_transactions')
      .update({ expense_scan_id: scanId, match_confidence: 'manual' })
      .eq('id', transactionId)

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── unlinkTransaction ─────────────────────────────────────────────────────────

export async function unlinkTransaction(
  transactionId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('bank_transactions')
      .update({ expense_scan_id: null, match_confidence: null })
      .eq('id', transactionId)

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── updateTipoFiscal ──────────────────────────────────────────────────────────

export async function updateTipoFiscal(
  transactionId: string,
  tipoFiscal: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin
      .from('bank_transactions')
      .update({ tipo_fiscal: tipoFiscal })
      .eq('id', transactionId)

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── deleteStatement ───────────────────────────────────────────────────────────

export async function deleteStatement(
  statementId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    // Cascades to bank_transactions via FK
    const { error } = await admin
      .from('bank_statements')
      .delete()
      .eq('id', statementId)

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
