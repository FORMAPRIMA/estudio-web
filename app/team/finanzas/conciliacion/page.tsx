import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ReconciliationPage from '@/components/team/finanzas/ReconciliationPage'

export const metadata = { title: 'Conciliación · Finanzas' }
export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: { year?: string; month?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const admin = createAdminClient()
  const now   = new Date()
  const year  = searchParams.year  ? parseInt(searchParams.year,  10) : now.getFullYear()
  const month = searchParams.month ? parseInt(searchParams.month, 10) : now.getMonth() + 1

  const fromDate   = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay    = new Date(year, month, 0).getDate()
  const toDate     = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  // Fetch statements whose date range overlaps the browsed month
  const { data: statements } = await admin
    .from('bank_statements')
    .select('*')
    .lte('date_from', toDate)
    .gte('date_to',   fromDate)
    .order('created_at', { ascending: false })

  const latestStatement = (statements ?? [])[0] ?? null
  const activeStatementId = latestStatement?.id ?? null

  // Fetch transactions for the latest statement (joined with scan data)
  let transactions: unknown[] = []
  if (activeStatementId) {
    const { data: txData } = await admin
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
      .eq('statement_id', activeStatementId)
      .order('fecha', { ascending: true })
    transactions = txData ?? []
  }

  // Fetch unlinked scans for the statement's full date range (not just the browsed month)
  // Use date_from/date_to from the statement if available; fall back to browsed month
  const scanRangeFrom = latestStatement?.date_from ?? fromDate
  const scanRangeTo   = latestStatement?.date_to   ?? toDate

  // Add ±14 days buffer for card settlement lag
  const scanFrom = new Date(scanRangeFrom)
  const scanTo   = new Date(scanRangeTo)
  scanFrom.setDate(scanFrom.getDate() - 14)
  scanTo.setDate(scanTo.getDate() + 14)
  const scanFromStr = scanFrom.toISOString().split('T')[0]
  const scanToStr   = scanTo.toISOString().split('T')[0]

  const { data: linkedScanRows } = await admin
    .from('bank_transactions')
    .select('expense_scan_id')
    .not('expense_scan_id', 'is', null)

  const linkedScanIds = (linkedScanRows ?? [])
    .map(r => r.expense_scan_id as string)
    .filter(Boolean)

  const { data: allScans } = await admin
    .from('expense_scans')
    .select('*, autor:profiles!user_id(nombre)')
    .gte('fecha_ticket', scanFromStr)
    .lte('fecha_ticket', scanToStr)
    .order('fecha_ticket', { ascending: true })

  const unlinkedScans = (allScans ?? []).filter(
    s => !linkedScanIds.includes(s.id)
  )

  // Fetch active proyectos
  const { data: proyectos } = await admin
    .from('proyectos')
    .select('id, nombre, codigo')
    .eq('status', 'activo')
    .order('nombre')

  return (
    <ReconciliationPage
      initialStatements={(statements ?? []) as any}
      initialTransactions={transactions as any}
      initialScans={unlinkedScans as any}
      proyectos={(proyectos ?? []) as any}
      initialYear={year}
      initialMonth={month}
      activeStatementId={activeStatementId}
    />
  )
}
