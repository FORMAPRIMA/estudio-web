import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'

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

// ── Score-based matching ──────────────────────────────────────────────────────

interface TxForScore {
  importe: number
  fecha: string
  hora: string | null
  comercio: string | null
  ultimos_4: string | null
}

interface ScanForScore {
  monto: number
  fecha_ticket: string
  hora_ticket: string | null
  proveedor: string | null
  ultimos_4: string | null
  nif_proveedor: string | null
}

function computeScore(tx: TxForScore, scan: ScanForScore): number {
  const absTx = Math.abs(tx.importe)

  // ── Amount (0–60 pts) ────────────────────────────────────────────────────
  const diff = Math.abs(absTx - scan.monto)
  let amountScore: number
  if      (diff <= 0.01)                                  amountScore = 60
  else if (diff <= 0.50)                                  amountScore = 45
  else if (diff <= 1.00 || (absTx > 0 && diff / absTx <= 0.01)) amountScore = 30
  else if (diff <= 2.00 || (absTx > 0 && diff / absTx <= 0.05)) amountScore = 15
  else return 0   // Too far — not a candidate

  // ── Date (0–25 pts) ──────────────────────────────────────────────────────
  const days = Math.abs(
    (new Date(tx.fecha).getTime() - new Date(scan.fecha_ticket).getTime()) / 86400000
  )
  let dateScore: number
  if      (days === 0)  dateScore = 25
  else if (days <= 1)   dateScore = 22
  else if (days <= 3)   dateScore = 17
  else if (days <= 5)   dateScore = 12
  else if (days <= 7)   dateScore = 7
  else if (days <= 14 && amountScore === 60) dateScore = 2  // exact amount: allow up to 14 days
  else return 0   // >7 days and non-exact amount → not a candidate

  let score = amountScore + dateScore

  // ── Card last 4 digits (+30 pts) ────────────────────────────────────────
  if (tx.ultimos_4 && scan.ultimos_4 && tx.ultimos_4 === scan.ultimos_4) {
    score += 30
  }

  // ── Merchant similarity (0–15 pts) ──────────────────────────────────────
  if (tx.comercio && scan.proveedor) {
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    const a = normalize(tx.comercio)
    const b = normalize(scan.proveedor)
    if (a === b) score += 15
    else if (a.includes(b) || b.includes(a)) score += 10
    else {
      const wordsA = a.split(/\s+/).filter(w => w.length > 2)
      const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2))
      if (wordsA.some(w => wordsB.has(w))) score += 7
    }
  }

  // ── Hour bonus (0–10 pts) — only when both available ────────────────────
  if (tx.hora && scan.hora_ticket && scan.hora_ticket.length >= 4) {
    try {
      const [txH, txM]     = tx.hora.split(':').map(Number)
      const [scanH, scanM] = scan.hora_ticket.split(':').map(Number)
      const diffMins = Math.abs((txH * 60 + txM) - (scanH * 60 + scanM))
      if      (diffMins <= 60)  score += 10
      else if (diffMins <= 180) score += 5
    } catch { /* ignore parse errors */ }
  }

  return score
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

  // Fixed column mapping: A=fecha, C=descripción, D=importe
  const colFecha    = 'A'
  const colConcepto = 'C'
  const colImporte  = 'D'

  // Skip header row if present
  const firstFechaVal = dataRows[0]?.[colFecha]
  const firstIsHeader = typeof firstFechaVal === 'string'
    && isNaN(Date.parse(firstFechaVal))
    && !/^\d+$/.test(String(firstFechaVal))
  const rowsToProcess = firstIsHeader ? dataRows.slice(1) : dataRows

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

    // Column B may contain a separate time
    if (!horaStr) {
      const rawB = row['B']
      if (rawB != null) {
        const bStr = String(rawB).trim()
        if (/^\d{1,2}:\d{2}/.test(bStr)) horaStr = bStr.substring(0, 5)
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
      if (score >= 50) scoredPairs.push({ txId: tx.id, scanId: scan.id, score })
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
      confidence: pair.score >= 70 ? 'auto' : 'sugerido',
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
