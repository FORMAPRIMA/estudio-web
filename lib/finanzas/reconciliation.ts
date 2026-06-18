import type { SupabaseClient } from '@supabase/supabase-js'

// ── Score-based matching entre movimientos bancarios y gastos escaneados ──────
//
// El importe es el filtro duro: tolerancia máxima ±0,02 (céntimos). Si el
// importe no cuadra, el par se descarta sin mirar nada más. La fecha es el
// segundo criterio; tarjeta, comercio y hora suman confianza.

export interface TxForScore {
  importe: number
  fecha: string
  hora: string | null
  comercio: string | null
  ultimos_4: string | null
}

export interface ScanForScore {
  monto: number
  fecha_ticket: string
  hora_ticket: string | null
  proveedor: string | null
  ultimos_4: string | null
  nif_proveedor: string | null
}

export function computeScore(tx: TxForScore, scan: ScanForScore): number {
  const absTx = Math.abs(tx.importe)

  // ── Importe (filtro duro, 0–60 pts) — tolerancia máxima ±0,02 ───────────
  const diff = Math.abs(absTx - scan.monto)
  let amountScore: number
  if      (diff <= 0.01) amountScore = 60
  else if (diff <= 0.02) amountScore = 50
  else return 0   // Importe no cuadra → no es candidato

  // ── Fecha (0–25 pts) — segundo filtro ────────────────────────────────────
  const days = Math.abs(
    (new Date(tx.fecha).getTime() - new Date(scan.fecha_ticket).getTime()) / 86400000
  )
  let dateScore: number
  if      (days === 0)  dateScore = 25
  else if (days <= 1)   dateScore = 22
  else if (days <= 3)   dateScore = 17
  else if (days <= 5)   dateScore = 12
  else if (days <= 7)   dateScore = 7
  else if (days <= 14)  dateScore = 2   // tarjetas que liquidan tarde
  else return 0

  let score = amountScore + dateScore

  // ── Últimos 4 dígitos de tarjeta (+30 pts) ───────────────────────────────
  if (tx.ultimos_4 && scan.ultimos_4 && tx.ultimos_4 === scan.ultimos_4) {
    score += 30
  }

  // ── Similitud de comercio (0–15 pts) ─────────────────────────────────────
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

  // ── Hora (0–10 pts) — solo si ambas disponibles ──────────────────────────
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

// Umbral mínimo para considerar un par y umbral de vínculo automático
export const MATCH_THRESHOLD = 50
export const AUTO_THRESHOLD  = 70

// ── matchScanToBank ───────────────────────────────────────────────────────────
// Se ejecuta cada vez que se guarda (o corrige) un gasto escaneado: busca
// movimientos bancarios sin justificante en una ventana de ±14 días y, si hay
// candidato, lo vincula ('auto' ≥70, 'sugerido' ≥50).

export interface ScanForMatch {
  id: string
  monto: number | null
  moneda: string | null
  fecha_ticket: string | null
  hora_ticket: string | null
  proveedor: string | null
  ultimos_4: string | null
  nif_proveedor: string | null
}

export async function matchScanToBank(
  admin: SupabaseClient,
  scan: ScanForMatch
): Promise<{ txId: string; confidence: string; score: number } | null> {
  if (!scan.monto || !scan.fecha_ticket) return null
  if (scan.moneda && scan.moneda !== 'EUR') return null

  // Si el scan ya está vinculado a un movimiento, no hacer nada
  const { data: existing } = await admin
    .from('bank_transactions')
    .select('id')
    .eq('expense_scan_id', scan.id)
    .limit(1)
  if (existing && existing.length > 0) return null

  const base = new Date(scan.fecha_ticket)
  const from = new Date(base); from.setDate(from.getDate() - 14)
  const to   = new Date(base); to.setDate(to.getDate() + 14)
  const fromStr = from.toISOString().split('T')[0]
  const toStr   = to.toISOString().split('T')[0]

  const { data: txs } = await admin
    .from('bank_transactions')
    .select('id, fecha, hora, importe, comercio, ultimos_4')
    .is('expense_scan_id', null)
    .gte('fecha', fromStr)
    .lte('fecha', toStr)
    .not('importe', 'is', null)

  if (!txs || txs.length === 0) return null

  let best: { txId: string; score: number } | null = null
  for (const tx of txs) {
    if (tx.importe == null || !tx.fecha) continue
    const score = computeScore(
      {
        importe:   tx.importe,
        fecha:     tx.fecha,
        hora:      tx.hora ?? null,
        comercio:  tx.comercio ?? null,
        ultimos_4: tx.ultimos_4 ?? null,
      },
      {
        monto:         scan.monto,
        fecha_ticket:  scan.fecha_ticket,
        hora_ticket:   scan.hora_ticket ?? null,
        proveedor:     scan.proveedor ?? null,
        ultimos_4:     scan.ultimos_4 ?? null,
        nif_proveedor: scan.nif_proveedor ?? null,
      }
    )
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { txId: tx.id, score }
    }
  }

  if (!best) return null

  const confidence = best.score >= AUTO_THRESHOLD ? 'auto' : 'sugerido'
  const { error } = await admin
    .from('bank_transactions')
    .update({ expense_scan_id: scan.id, match_confidence: confidence, match_score: best.score })
    .eq('id', best.txId)
    .is('expense_scan_id', null)   // protección contra carreras

  if (error) return null
  return { txId: best.txId, confidence, score: best.score }
}
