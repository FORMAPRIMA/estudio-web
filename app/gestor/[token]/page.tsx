import { createAdminClient } from '@/lib/supabase/admin'
import { validateGestorToken } from '@/lib/gestor/auth'
import GestorPortal, { type GastoRow, type FacturaRow, type StatementRow, type TransactionRow } from '@/components/gestor/GestorPortal'

export const metadata = { title: 'Portal de gestoría · Forma Prima' }
export const dynamic = 'force-dynamic'

type Vista = 'gastos' | 'facturas' | 'conciliacion'

export default async function Page({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams: { vista?: string; year?: string; month?: string; extracto?: string }
}) {
  const admin = createAdminClient()
  const tokenRow = await validateGestorToken(admin, params.token)

  if (!tokenRow) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F7F4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <p style={{ fontSize: 32, margin: '0 0 16px' }}>🔒</p>
          <h1 style={{ fontSize: 18, fontWeight: 400, color: '#1A1A1A', margin: '0 0 8px' }}>Enlace no válido</h1>
          <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.6 }}>
            Este enlace de acceso ha sido revocado o no existe.
            Contacta con Forma Prima para solicitar uno nuevo.
          </p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const vista: Vista = (['gastos', 'facturas', 'conciliacion'].includes(searchParams.vista ?? '')
    ? searchParams.vista
    : 'gastos') as Vista
  const year  = searchParams.year  ? parseInt(searchParams.year,  10) : now.getFullYear()
  const month = searchParams.month ? parseInt(searchParams.month, 10) : now.getMonth() + 1

  let gastos: GastoRow[] = []
  let facturas: FacturaRow[] = []
  let statements: StatementRow[] = []
  let transactions: TransactionRow[] = []
  let selectedStatementId: string | null = null

  if (vista === 'gastos') {
    const from    = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to      = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    const { data } = await admin
      .from('expense_scans')
      .select('id, foto_url, fecha_ticket, monto, moneda, tipo, proveedor, nif_proveedor, descripcion, created_at, proyecto:proyectos!proyecto_id(nombre)')
      .or(`and(fecha_ticket.gte.${from},fecha_ticket.lte.${to}),and(fecha_ticket.is.null,created_at.gte.${from}T00:00:00,created_at.lte.${to}T23:59:59)`)
      .order('fecha_ticket', { ascending: true, nullsFirst: false })
      .order('created_at',   { ascending: true })
    gastos = (data ?? []) as unknown as GastoRow[]
  }

  if (vista === 'facturas') {
    const { data } = await admin
      .from('facturas_emitidas')
      .select('id, numero_completo, fecha_emision, cliente_nombre, base_imponible, cuota_iva, cuota_irpf, total, estado')
      .neq('estado', 'borrador')
      .gte('fecha_emision', `${year}-01-01`)
      .lte('fecha_emision', `${year}-12-31`)
      .order('fecha_emision', { ascending: false })
    facturas = (data ?? []) as FacturaRow[]
  }

  if (vista === 'conciliacion') {
    const { data: stmts } = await admin
      .from('bank_statements')
      .select('id, year, month, month_to, date_from, date_to, filename, row_count, created_at')
      .order('date_from', { ascending: false })
      .limit(24)
    statements = (stmts ?? []) as StatementRow[]

    selectedStatementId = searchParams.extracto ?? statements[0]?.id ?? null
    if (selectedStatementId) {
      const { data: txs } = await admin
        .from('bank_transactions')
        .select(`
          id, fecha, hora, concepto, comercio, importe, moneda, match_confidence,
          linked_scan:expense_scans!expense_scan_id(foto_url, proveedor, monto, fecha_ticket)
        `)
        .eq('statement_id', selectedStatementId)
        .order('fecha', { ascending: true })
      transactions = (txs ?? []) as unknown as TransactionRow[]
    }
  }

  return (
    <GestorPortal
      token={params.token}
      label={tokenRow.label}
      vista={vista}
      year={year}
      month={month}
      gastos={gastos}
      facturas={facturas}
      statements={statements}
      transactions={transactions}
      selectedStatementId={selectedStatementId}
    />
  )
}
