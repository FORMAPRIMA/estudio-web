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

// ── AI match helper ───────────────────────────────────────────────────────────

interface ScanCandidate {
  id: string
  fecha_ticket: string
  hora_ticket: string | null
  monto: number
  proveedor: string | null
  descripcion: string | null
}

async function aiPickBestMatch(
  tx: { fecha: string; hora: string | null; importe: number; concepto: string },
  candidates: ScanCandidate[]
): Promise<string | null> {
  const candidateLines = candidates.map((c, i) =>
    `${i + 1}. Fecha: ${c.fecha_ticket}${c.hora_ticket ? ` hora ${c.hora_ticket}` : ''} | Monto: ${c.monto.toFixed(2)}€ | Proveedor: ${c.proveedor ?? '(sin nombre)'} | Desc: ${c.descripcion ?? ''}`
  ).join('\n')

  const prompt = `Transacción bancaria:
- Fecha: ${tx.fecha}${tx.hora ? ` hora ${tx.hora}` : ''}
- Importe: ${Math.abs(tx.importe).toFixed(2)}€
- Concepto: ${tx.concepto}

Tickets/facturas candidatos (montos similares al importe):
${candidateLines}

¿Cuál es el mejor match para esta transacción?
Criterios: proximidad de fecha y hora, similitud de monto exacto.
Responde SOLO con el número (1, 2, etc.) o "ninguno" si ninguno encaja bien.`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : 'ninguno'
    const num = parseInt(text)
    if (!isNaN(num) && num >= 1 && num <= candidates.length) {
      return candidates[num - 1].id
    }
    return null
  } catch {
    return null
  }
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
  // header:'A' → each row keyed by column letter (A, B, C, D...)
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 'A', defval: null })
  const dataRows = rawRows.filter(r => Object.values(r).some(v => v != null))

  if (dataRows.length < 2) return NextResponse.json({ error: 'El archivo no contiene datos suficientes.' }, { status: 422 })

  // ── Column mapping (fixed format: A=fecha, C=descripción, D=importe) ─────────
  const colFecha    = 'A'
  const colConcepto = 'C'
  const colImporte  = 'D'

  // Skip first row if it looks like a header
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

    // Parse fecha and try to extract hora
    let fechaStr: string | null = null
    let horaStr: string | null = null

    if (rawFecha instanceof Date) {
      fechaStr = rawFecha.toISOString().split('T')[0]
      // Extract time if non-zero
      const h = rawFecha.getHours()
      const m = rawFecha.getMinutes()
      if (h !== 0 || m !== 0) {
        horaStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
    } else if (typeof rawFecha === 'number') {
      // Excel serial date
      const d = new Date(Math.round((rawFecha - 25569) * 86400 * 1000))
      fechaStr = d.toISOString().split('T')[0]
    } else if (typeof rawFecha === 'string') {
      const d = new Date(rawFecha)
      if (!isNaN(d.getTime())) {
        fechaStr = d.toISOString().split('T')[0]
        // Try to extract time if string contains it
        const timeMatch = rawFecha.match(/(\d{1,2}):(\d{2})/)
        if (timeMatch) {
          horaStr = `${String(parseInt(timeMatch[1])).padStart(2, '0')}:${timeMatch[2]}`
        }
      } else {
        // try DD/MM/YYYY
        const parts = rawFecha.split('/')
        if (parts.length === 3) {
          const d2 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
          if (!isNaN(d2.getTime())) fechaStr = d2.toISOString().split('T')[0]
        }
      }
    }

    // Also check column B for a separate time value
    if (!horaStr) {
      const rawColB = row['B']
      if (rawColB != null) {
        const bStr = String(rawColB).trim()
        if (/^\d{1,2}:\d{2}/.test(bStr)) {
          horaStr = bStr.substring(0, 5)
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

    parsedRows.push({ fila: i + 1, fecha: fechaStr, hora: horaStr, concepto, importe })
  }

  if (parsedRows.length === 0) {
    return NextResponse.json({ error: 'No se encontraron filas válidas en el extracto.' }, { status: 422 })
  }

  // ── Auto-detect date range from transactions ──────────────────────────────────
  const sortedFechas = parsedRows.map(r => r.fecha).sort()
  const dateFrom = sortedFechas[0]
  const dateTo   = sortedFechas[sortedFechas.length - 1]
  // year/month derived from the earliest transaction in the file
  const year     = parseInt(dateFrom.split('-')[0])
  const month    = parseInt(dateFrom.split('-')[1])
  const monthTo  = parseInt(dateTo.split('-')[1])
  // year_to handles cross-year statements (Dec→Jan)
  const yearTo   = parseInt(dateTo.split('-')[0])

  // ── Store in Supabase ─────────────────────────────────────────────────────────
  const admin = createAdminClient()

  const { data: statement, error: stmtErr } = await admin
    .from('bank_statements')
    .insert({
      year,
      month,
      month_to:  monthTo,
      date_from: dateFrom,
      date_to:   dateTo,
      filename:  file.name,
      row_count: parsedRows.length,
      user_id:   user.id,
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
    hora:         r.hora,
    concepto:     r.concepto,
    importe:      r.importe,
    moneda:       'EUR',
    tipo_fiscal:  'pendiente',
  }))

  const { data: insertedTx, error: txErr } = await admin
    .from('bank_transactions')
    .insert(txRows)
    .select('id, fecha, hora, importe, concepto')

  if (txErr) {
    // Roll back statement
    await admin.from('bank_statements').delete().eq('id', statementId)
    return NextResponse.json({ error: txErr.message }, { status: 500 })
  }

  // ── AI-assisted auto-match ────────────────────────────────────────────────────
  // Use the actual date range from the transactions (±14 days buffer for settlement)
  const scanFrom = new Date(dateFrom)
  const scanTo   = new Date(dateTo)
  scanFrom.setDate(scanFrom.getDate() - 14)
  scanTo.setDate(scanTo.getDate() + 14)
  const scanFromStr = scanFrom.toISOString().split('T')[0]
  const scanToStr   = scanTo.toISOString().split('T')[0]

  const { data: scans } = await admin
    .from('expense_scans')
    .select('id, monto, moneda, fecha_ticket, hora_ticket, proveedor, descripcion')
    .gte('fecha_ticket', scanFromStr)
    .lte('fecha_ticket', scanToStr)
    .not('monto', 'is', null)
    .not('fecha_ticket', 'is', null)
    .eq('moneda', 'EUR')

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
      if (tx.importe == null || tx.fecha == null) continue

      const absTxAmt = Math.abs(tx.importe)
      if (absTxAmt < 0.01) continue

      // ±5% or €2 — wider tolerance, AI will confirm the real match
      const amtTolerance = Math.max(absTxAmt * 0.05, 2.0)
      const txDate = new Date(tx.fecha)

      const candidates: ScanCandidate[] = unlinkedScans.filter(s => {
        if (!s.monto || !s.fecha_ticket) return false
        if (usedScanIds.has(s.id)) return false
        // Amount check
        if (Math.abs(s.monto - absTxAmt) > amtTolerance) return false
        // Date check: ±14 days
        const scanDate = new Date(s.fecha_ticket)
        const diffDays = Math.abs((txDate.getTime() - scanDate.getTime()) / 86400000)
        return diffDays <= 14
      }).map(s => ({
        id: s.id,
        fecha_ticket: s.fecha_ticket!,
        hora_ticket:  s.hora_ticket ?? null,
        monto:        s.monto!,
        proveedor:    s.proveedor ?? null,
        descripcion:  s.descripcion ?? null,
      }))

      if (candidates.length === 0) continue

      // Sort candidates by date proximity before sending to AI
      candidates.sort((a, b) => {
        const dA = Math.abs(new Date(a.fecha_ticket).getTime() - txDate.getTime())
        const dB = Math.abs(new Date(b.fecha_ticket).getTime() - txDate.getTime())
        return dA - dB
      })

      // Ask AI to pick the best match
      const pickedId = await aiPickBestMatch(
        { fecha: tx.fecha, hora: tx.hora ?? null, importe: tx.importe, concepto: tx.concepto ?? '' },
        candidates
      )

      if (pickedId) {
        const confidence = candidates.length === 1 ? 'auto' : 'auto_ai'
        await admin
          .from('bank_transactions')
          .update({ expense_scan_id: pickedId, match_confidence: confidence })
          .eq('id', tx.id)
        usedScanIds.add(pickedId)
        matched++
      }
    }
  }

  const total     = parsedRows.length
  const unmatched = total - matched

  return NextResponse.json({
    statement_id: statementId,
    total,
    matched,
    unmatched,
    year,
    month,
    month_to: monthTo,
    year_to:  yearTo,
    date_from: dateFrom,
    date_to:   dateTo,
  })
}
