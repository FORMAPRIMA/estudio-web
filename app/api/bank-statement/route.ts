import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'
import { computeScore, MATCH_THRESHOLD, AUTO_THRESHOLD, type TxForScore } from '@/lib/finanzas/reconciliation'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

// ── Normalize bank conceptos (single batch AI call) ──────────────────────────

async function normalizeBankConceptos(
  txs: Array<{ id: string; concepto: string }>
): Promise<Map<string, { comercio: string | null; ultimos_4: string | null }>> {
  const result = new Map<string, { comercio: string | null; ultimos_4: string | null }>()

  // Extract card digits via regex (no AI needed)
  for (const tx of txs) {
    const m = tx.concepto.match(/\*+(\d{4})/) ?? tx.concepto.match(/(\d{4})\s*(?:VISA|MC|MASTERCARD|MAESTRO)/i)
    result.set(tx.id, { ultimos_4: m?.[1] ?? null, comercio: null })
  }

  if (txs.length === 0) return result

  // Normalize merchant names with a single Claude Haiku call
  try {
    const lines = txs.map(tx => `${tx.id}|||${tx.concepto.substring(0, 80)}`).join('\n')
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `Eres un normalizador de nombres de comercios de extractos bancarios españoles.
Para cada línea (formato: ID|||CONCEPTO), extrae el nombre limpio del comercio o empresa donde se realizó la compra.
Si NO es una compra en un comercio (transferencia, cuota, impuesto, nómina, cargo interno, etc.), devuelve null.
Responde ÚNICAMENTE con JSON válido: {"ID1": "Nombre Comercio", "ID2": null, ...}
Ejemplos:
- "COMPRA AMZN EU SARL AMAZON.ES" → "Amazon"
- "PAGO TPV MERCADONA 1234 MADRID" → "Mercadona"
- "UBER* TRIP 12345" → "Uber"
- "TRANSFERENCIA RECIBIDA CLIENTE" → null
- "CUOTA MANTENIMIENTO CUENTA" → null`,
      messages: [{ role: 'user', content: lines }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}'
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as Record<string, string | null>
    for (const [id, comercio] of Object.entries(parsed)) {
      const existing = result.get(id) ?? { ultimos_4: null, comercio: null }
      result.set(id, { ...existing, comercio: comercio ?? null })
    }
  } catch {
    // Fail silently — amount+date scoring still works without merchant names
  }

  return result
}

// ── Column detection by header ────────────────────────────────────────────────
// Busca una fila de cabecera por nombres (fecha/concepto/importe…) en las
// primeras filas; si no la encuentra, cae al mapeo fijo A/C/D.

interface ColumnMap {
  colFecha: string
  colHora: string | null
  colConcepto: string
  colImporte: string
  headerRows: number   // filas a saltar (cabecera incluida)
}

function detectColumns(rows: Record<string, unknown>[]): ColumnMap {
  const isFechaHeader    = (s: string) => /fecha|date|f\.?\s*valor|f\.?\s*operac/i.test(s)
  const isConceptoHeader = (s: string) => /concepto|descrip|movimiento|detalle/i.test(s)
  const isImporteHeader  = (s: string) => /importe|amount|monto|cargo|d[eé]bito/i.test(s)
  const isHoraHeader     = (s: string) => /^hora$/i.test(s)

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    let colFecha: string | null = null
    let colConcepto: string | null = null
    let colImporte: string | null = null
    let colHora: string | null = null

    for (const [col, val] of Object.entries(row)) {
      if (typeof val !== 'string') continue
      const v = val.trim()
      if (!v) continue
      if (!colFecha && isFechaHeader(v))            colFecha = col
      else if (!colHora && isHoraHeader(v))         colHora = col
      else if (!colConcepto && isConceptoHeader(v)) colConcepto = col
      else if (!colImporte && isImporteHeader(v))   colImporte = col
    }

    if (colFecha && colConcepto && colImporte) {
      return { colFecha, colHora, colConcepto, colImporte, headerRows: i + 1 }
    }
  }

  // Fallback: mapeo histórico A=fecha, C=concepto, D=importe (B puede traer hora)
  const firstFechaVal = rows[0]?.['A']
  const firstIsHeader = typeof firstFechaVal === 'string'
    && isNaN(Date.parse(firstFechaVal))
    && !/^\d+$/.test(String(firstFechaVal))
  return { colFecha: 'A', colHora: 'B', colConcepto: 'C', colImporte: 'D', headerRows: firstIsHeader ? 1 : 0 }
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

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })

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
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 'A', defval: null })
  const dataRows = rawRows.filter(r => Object.values(r).some(v => v != null))

  if (dataRows.length < 2) return NextResponse.json({ error: 'El archivo no contiene datos suficientes.' }, { status: 422 })

  // Detect columns by header names, with A/C/D fallback
  const { colFecha, colHora, colConcepto, colImporte, headerRows } = detectColumns(dataRows)
  const rowsToProcess = dataRows.slice(headerRows)

  // ── Parse rows ───────────────────────────────────────────────────────────────

  interface ParsedRow {
    fila: number
    fecha: string
    hora: string | null
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

    let fechaStr: string | null = null
    let horaStr:  string | null = null

    if (rawFecha instanceof Date) {
      fechaStr = rawFecha.toISOString().split('T')[0]
      const h = rawFecha.getHours(), m = rawFecha.getMinutes()
      if (h !== 0 || m !== 0) horaStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    } else if (typeof rawFecha === 'number') {
      const d = new Date(Math.round((rawFecha - 25569) * 86400 * 1000))
      fechaStr = d.toISOString().split('T')[0]
    } else if (typeof rawFecha === 'string') {
      const d = new Date(rawFecha)
      if (!isNaN(d.getTime())) {
        fechaStr = d.toISOString().split('T')[0]
        const tm = rawFecha.match(/(\d{1,2}):(\d{2})/)
        if (tm) horaStr = `${String(parseInt(tm[1])).padStart(2,'0')}:${tm[2]}`
      } else {
        const parts = rawFecha.split('/')
        if (parts.length === 3) {
          const d2 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
          if (!isNaN(d2.getTime())) fechaStr = d2.toISOString().split('T')[0]
        }
      }
    }

    // A dedicated column may contain a separate time
    if (!horaStr && colHora) {
      const rawHora = row[colHora]
      if (rawHora != null) {
        const hStr = String(rawHora).trim()
        if (/^\d{1,2}:\d{2}/.test(hStr)) horaStr = hStr.substring(0, 5)
      }
    }

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

    parsedRows.push({ fila: i + 1, fecha: fechaStr, hora: horaStr, concepto, importe })
  }

  if (parsedRows.length === 0) {
    return NextResponse.json({ error: 'No se encontraron filas válidas en el extracto.' }, { status: 422 })
  }

  // ── Auto-detect date range ────────────────────────────────────────────────────
  const sortedFechas = parsedRows.map(r => r.fecha).sort()
  const dateFrom  = sortedFechas[0]
  const dateTo    = sortedFechas[sortedFechas.length - 1]
  const year      = parseInt(dateFrom.split('-')[0])
  const month     = parseInt(dateFrom.split('-')[1])
  const monthTo   = parseInt(dateTo.split('-')[1])
  const yearTo    = parseInt(dateTo.split('-')[0])

  // ── Insert statement ──────────────────────────────────────────────────────────
  const admin = createAdminClient()

  const { data: statement, error: stmtErr } = await admin
    .from('bank_statements')
    .insert({
      year, month, month_to: monthTo, date_from: dateFrom, date_to: dateTo,
      filename: file.name, row_count: parsedRows.length, user_id: user.id,
    })
    .select('id')
    .single()

  if (stmtErr || !statement) {
    return NextResponse.json({ error: stmtErr?.message ?? 'Error al guardar el extracto.' }, { status: 500 })
  }

  const statementId = statement.id

  const txRows = parsedRows.map(r => ({
    statement_id: statementId,
    fila: r.fila, fecha: r.fecha, hora: r.hora,
    concepto: r.concepto, importe: r.importe,
    moneda: 'EUR', tipo_fiscal: 'pendiente',
  }))

  const { data: insertedTx, error: txErr } = await admin
    .from('bank_transactions')
    .insert(txRows)
    .select('id, fecha, hora, importe, concepto')

  if (txErr) {
    await admin.from('bank_statements').delete().eq('id', statementId)
    return NextResponse.json({ error: txErr.message }, { status: 500 })
  }

  // ── Step 1: Normalize bank conceptos (batch AI + regex) ───────────────────────
  const conceptosToNorm = (insertedTx ?? [])
    .filter(tx => tx.concepto)
    .map(tx => ({ id: tx.id, concepto: tx.concepto! }))

  const normMap = await normalizeBankConceptos(conceptosToNorm)

  // Update transactions with comercio + ultimos_4 in parallel
  const normUpdates = Array.from(normMap.entries()).filter(([, v]) => v.comercio || v.ultimos_4)
  await Promise.all(normUpdates.map(([id, v]) =>
    admin.from('bank_transactions')
      .update({ comercio: v.comercio, ultimos_4: v.ultimos_4 })
      .eq('id', id)
  ))

  // ── Step 2: Fetch unlinked EUR scans in the statement's date range ─────────────
  const scanFrom = new Date(dateFrom); scanFrom.setDate(scanFrom.getDate() - 14)
  const scanTo   = new Date(dateTo);   scanTo.setDate(scanTo.getDate() + 14)
  const scanFromStr = scanFrom.toISOString().split('T')[0]
  const scanToStr   = scanTo.toISOString().split('T')[0]

  const { data: scans } = await admin
    .from('expense_scans')
    .select('id, monto, moneda, fecha_ticket, hora_ticket, proveedor, ultimos_4, nif_proveedor')
    .gte('fecha_ticket', scanFromStr)
    .lte('fecha_ticket', scanToStr)
    .not('monto', 'is', null)
    .not('fecha_ticket', 'is', null)
    .eq('moneda', 'EUR')

  const { data: alreadyLinked } = await admin
    .from('bank_transactions')
    .select('expense_scan_id')
    .not('expense_scan_id', 'is', null)

  const linkedScanIds  = new Set((alreadyLinked ?? []).map(r => r.expense_scan_id as string))
  const unlinkedScans  = (scans ?? []).filter(s => !linkedScanIds.has(s.id))

  // ── Step 3: Compute scores for all (tx, scan) pairs ───────────────────────────
  const scoredPairs: Array<{ txId: string; scanId: string; score: number }> = []

  for (const tx of insertedTx ?? []) {
    if (!tx.importe || !tx.fecha) continue
    if (Math.abs(tx.importe) < 0.01) continue   // skip near-zero (fees, etc.)

    const norm = normMap.get(tx.id) ?? { comercio: null, ultimos_4: null }
    const txForScore: TxForScore = {
      importe:   tx.importe,
      fecha:     tx.fecha,
      hora:      tx.hora ?? null,
      comercio:  norm.comercio,
      ultimos_4: norm.ultimos_4,
    }

    for (const scan of unlinkedScans) {
      if (!scan.monto || !scan.fecha_ticket) continue
      const score = computeScore(txForScore, {
        monto:         scan.monto,
        fecha_ticket:  scan.fecha_ticket,
        hora_ticket:   scan.hora_ticket ?? null,
        proveedor:     scan.proveedor ?? null,
        ultimos_4:     scan.ultimos_4 ?? null,
        nif_proveedor: scan.nif_proveedor ?? null,
      })
      if (score >= MATCH_THRESHOLD) scoredPairs.push({ txId: tx.id, scanId: scan.id, score })
    }
  }

  // ── Step 4: Greedy one-to-one assignment (highest score first) ────────────────
  scoredPairs.sort((a, b) => b.score - a.score)

  const usedTxIds   = new Set<string>()
  const usedScanIds = new Set<string>()
  const assignments: Array<{ txId: string; scanId: string; confidence: string; score: number }> = []

  for (const pair of scoredPairs) {
    if (usedTxIds.has(pair.txId) || usedScanIds.has(pair.scanId)) continue
    assignments.push({
      txId:       pair.txId,
      scanId:     pair.scanId,
      confidence: pair.score >= AUTO_THRESHOLD ? 'auto' : 'sugerido',
      score:      pair.score,
    })
    usedTxIds.add(pair.txId)
    usedScanIds.add(pair.scanId)
  }

  // Apply match updates in parallel
  await Promise.all(assignments.map(a =>
    admin.from('bank_transactions')
      .update({ expense_scan_id: a.scanId, match_confidence: a.confidence, match_score: a.score })
      .eq('id', a.txId)
  ))

  const total     = parsedRows.length
  const matched   = assignments.length
  const auto      = assignments.filter(a => a.confidence === 'auto').length
  const sugerido  = assignments.filter(a => a.confidence === 'sugerido').length
  const unmatched = total - matched

  return NextResponse.json({
    statement_id: statementId,
    total, matched, auto, sugerido, unmatched,
    year, month, month_to: monthTo, year_to: yearTo,
    date_from: dateFrom, date_to: dateTo,
  })
}
