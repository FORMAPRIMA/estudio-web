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
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })

  if (rawRows.length < 2) return NextResponse.json({ error: 'El archivo no contiene datos suficientes.' }, { status: 422 })

  const headers = rawRows[0] as (string | null)[]
  const dataRows = rawRows.slice(1).filter(r => (r as unknown[]).some(c => c != null))

  if (headers.length === 0) return NextResponse.json({ error: 'Sin cabeceras detectadas.' }, { status: 422 })

  // ── Ask Claude to detect columns ─────────────────────────────────────────────
  const sampleRows = dataRows.slice(0, 3)
  const prompt = `Tienes los headers y primeras filas de un extracto bancario en Excel.
Headers: ${JSON.stringify(headers)}
Primeras filas de datos: ${JSON.stringify(sampleRows)}

Identifica cuál columna corresponde a:
- col_fecha: fecha de la transacción
- col_concepto: descripción o concepto
- col_importe: importe o cantidad (puede ser negativo para gastos)

Responde ÚNICAMENTE con JSON exacto, sin markdown ni explicaciones:
{"col_fecha": "NombreColumna", "col_concepto": "NombreColumna", "col_importe": "NombreColumna"}`

  let colMap: { col_fecha: string; col_concepto: string; col_importe: string }
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}'
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    colMap = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'No se pudo detectar las columnas del extracto.' }, { status: 422 })
  }

  const idxFecha    = headers.indexOf(colMap.col_fecha)
  const idxConcepto = headers.indexOf(colMap.col_concepto)
  const idxImporte  = headers.indexOf(colMap.col_importe)

  if (idxFecha < 0 || idxConcepto < 0 || idxImporte < 0) {
    return NextResponse.json({ error: `Columnas no encontradas. Claude detectó: ${JSON.stringify(colMap)}. Headers disponibles: ${JSON.stringify(headers)}` }, { status: 422 })
  }

  // ── Parse rows ───────────────────────────────────────────────────────────────

  interface ParsedRow {
    fila: number
    fecha: string
    concepto: string
    importe: number
  }

  const parsedRows: ParsedRow[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] as (unknown)[]
    const rawFecha    = row[idxFecha]
    const rawConcepto = row[idxConcepto]
    const rawImporte  = row[idxImporte]

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
      uploaded_by: user.id,
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
