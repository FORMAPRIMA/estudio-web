import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'
// ── Auth helper ───────────────────────────────────────────────────────────────

async function getPartnerUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') return null
  return user
}

// ── POST /api/bank-statement ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getPartnerUser()
  if (!user) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 })
  }

  const file  = formData.get('file') as File | null
  const year  = parseInt(formData.get('year')  as string ?? '', 10)
  const month = parseInt(formData.get('month') as string ?? '', 10)

  if (!file || file.size === 0) return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })
  if (isNaN(year) || isNaN(month)) return NextResponse.json({ error: 'Año/mes inválido.' }, { status: 400 })

  // ── Parse Excel ─────────────────────────────────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer())
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo Excel.' }, { status: 422 })
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return NextResponse.json({ error: 'El archivo no contiene hojas.' }, { status: 422 })

  const sheet = workbook.Sheets[sheetName]
  // Use header:'A' so each row is keyed by column letter (A, B, C, D...)
  // This avoids ambiguity with unnamed headers or numeric header values
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 'A', defval: null })
  const dataRows = rawRows.filter(r => Object.values(r).some(v => v != null))

  if (dataRows.length < 2) return NextResponse.json({ error: 'El archivo no contiene datos suficientes.' }, { status: 422 })

  // ── Column mapping (fixed format: A=fecha, C=descripción, D=importe) ─────────
  const colFecha    = 'A'
  const colConcepto = 'C'
  const colImporte  = 'D'

  // Skip first row if it looks like a header (fecha column contains non-date text)
  const firstFechaVal = dataRows[0]?.[colFecha]
  const firstIsHeader = typeof firstFechaVal === 'string'
    && isNaN(Date.parse(firstFechaVal))
    && !/^\d+$/.test(String(firstFechaVal))
  const rowsToProcess = firstIsHeader ? dataRows.slice(1) : dataRows

  // ── Parse rows ───────────────────────────────────────────────────────────────

  interface ParsedRow {
    fila: number
    fecha: string
    concepto: string
    importe: number
  }

  const parsedRows: ParsedRow[] = []

  for (let i = 0; i < rowsToProcess.length; i++) {
    const row = rowsToProcess[i]
    const rawFecha    = row[colFecha]
    const rawConcepto = row[colConcepto]
    const rawImporte  = row[colImporte]

    if (rawFecha == null || rawConcepto == null || rawImporte == null) continue

    // Parse fecha
    let fechaStr: string | null = null
    if (rawFecha instanceof Date) {
      fechaStr = rawFecha.toISOString().split('T')[0]
    } else if (typeof rawFecha === 'number') {
      // Excel serial date
      const d = new Date(Math.round((rawFecha - 25569) * 86400 * 1000))
      fechaStr = d.toISOString().split('T')[0]
    } else if (typeof rawFecha === 'string') {
      const d = new Date(rawFecha)
      if (!isNaN(d.getTime())) fechaStr = d.toISOString().split('T')[0]
      else {
        // try DD/MM/YYYY
        const parts = rawFecha.split('/')
        if (parts.length === 3) {
          const d2 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
          if (!isNaN(d2.getTime())) fechaStr = d2.toISOString().split('T')[0]
        }
      }
    }

    // Parse importe
    let importe: number | null = null
    if (typeof rawImporte === 'number') {
      importe = rawImporte
    } else if (typeof rawImporte === 'string') {
      const cleaned = rawImporte.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '')
      const n = parseFloat(cleaned)
      if (!isNaN(n)) importe = n
    }

    if (fechaStr == null || importe == null) continue

    const concepto = String(rawConcepto).trim()
    if (!concepto) continue

    parsedRows.push({ fila: i + 1, fecha: fechaStr, concepto, importe })
  }

  if (parsedRows.length === 0) {
    return NextResponse.json({ error: 'No se encontraron filas válidas en el extracto.' }, { status: 422 })
  }

  // ── Store in Supabase ─────────────────────────────────────────────────────────
  const admin = createAdminClient()

  const { data: statement, error: stmtErr } = await admin
    .from('bank_statements')
    .insert({
      year,
      month,
      filename:    file.name,
      row_count:   parsedRows.length,
      user_id: user.id,
    })
    .select('id')
    .single()

  if (stmtErr || !statement) {
    return NextResponse.json({ error: stmtErr?.message ?? 'Error al guardar el extracto.' }, { status: 500 })
  }

  const statementId = statement.id

  const txRows = parsedRows.map(r => ({
    statement_id: statementId,
    fila:         r.fila,
    fecha:        r.fecha,
    concepto:     r.concepto,
    importe:      r.importe,
    moneda:       'EUR',
    tipo_fiscal:  'pendiente',
  }))

  const { data: insertedTx, error: txErr } = await admin
    .from('bank_transactions')
    .insert(txRows)
    .select('id, fecha, importe')

  if (txErr) {
    // Roll back statement
    await admin.from('bank_statements').delete().eq('id', statementId)
    return NextResponse.json({ error: txErr.message }, { status: 500 })
  }

  // ── Auto-match ────────────────────────────────────────────────────────────────

  // Fetch unlinked expense scans (no bank_transaction references them yet)
  const fromDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay  = new Date(year, month, 0).getDate()
  const toDate   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  const { data: scans } = await admin
    .from('expense_scans')
    .select('id, monto, fecha_ticket')
    .gte('created_at', fromDate + 'T00:00:00')
    .lte('created_at', toDate   + 'T23:59:59')
    .not('monto', 'is', null)
    .not('fecha_ticket', 'is', null)

  // Fetch scan IDs already linked to any transaction (including this batch we just created)
  const { data: alreadyLinked } = await admin
    .from('bank_transactions')
    .select('expense_scan_id')
    .not('expense_scan_id', 'is', null)

  const linkedScanIds = new Set((alreadyLinked ?? []).map(r => r.expense_scan_id as string))

  const unlinkedScans = (scans ?? []).filter(s => !linkedScanIds.has(s.id))

  let matched = 0
  const usedScanIds = new Set<string>()

  if (insertedTx && unlinkedScans.length > 0) {
    for (const tx of insertedTx) {
      if (tx.importe == null || tx.importe >= 0) continue // only match expenses (negative)
      const txDate = tx.fecha ? new Date(tx.fecha) : null
      if (!txDate) continue

      const absTxAmt = Math.abs(tx.importe)

      const candidates = unlinkedScans.filter(s => {
        if (!s.monto || !s.fecha_ticket) return false
        if (usedScanIds.has(s.id)) return false
        if (Math.abs(s.monto - absTxAmt) >= 0.10) return false
        const scanDate = new Date(s.fecha_ticket)
        const diff = Math.abs((txDate.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24))
        return diff <= 3
      })

      if (candidates.length === 1) {
        const scan = candidates[0]
        await admin
          .from('bank_transactions')
          .update({ expense_scan_id: scan.id, match_confidence: 'auto' })
          .eq('id', tx.id)
        usedScanIds.add(scan.id)
        matched++
      }
    }
  }

  const total     = parsedRows.length
  const unmatched = total - matched

  return NextResponse.json({ statement_id: statementId, total, matched, unmatched })
}
