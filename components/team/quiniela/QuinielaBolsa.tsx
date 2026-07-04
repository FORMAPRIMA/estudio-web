'use client'

import { useState } from 'react'
import { abrirApuesta, placeApuesta, liquidarMercadoAdmin } from '@/app/actions/quiniela'
import type { QuinielaData } from '@/app/actions/quiniela'
import { Q, labelStyle, pixelStyle } from '@/components/team/quiniela/theme'
import { calcPayout } from '@/lib/quiniela/config'
import type { QuinielaEquipo, QuinielaMercado, QuinielaPartido } from '@/lib/quiniela/config'

// ── Apuesta embebida en el card de un partido ────────────────────────────────
// Flujo: 1) teaser tapado "¿te juegas X pts?" → 2) al decir Sí se bloquean las
// fichas y se revela la pregunta con sus opciones → 3) eliges tu respuesta.

export function MatchBet({
  mercado, miApuesta, apuestasMercado, nombresById, miJugadorId,
  stake, saldo, soyParticipante, locked, settled, onChanged, fireConfetti,
}: {
  mercado: QuinielaMercado
  miApuesta: QuinielaData['misApuestas'][number] | null
  apuestasMercado: QuinielaData['apuestasReveladas']
  nombresById: Map<string, string>
  miJugadorId: string | null
  stake: number
  saldo: number
  soyParticipante: boolean
  locked: boolean
  settled: boolean
  onChanged: () => void
  fireConfetti: (n?: number) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rechazado, setRechazado] = useState(false)

  const committed = !!miApuesta
  const pending = committed && (miApuesta!.opcion === '' || miApuesta!.opcion == null)
  const canBet = soyParticipante && !locked && !settled
  const sinSaldo = !committed && saldo < stake

  async function reservar() {
    setBusy(true); setError('')
    const result = await abrirApuesta({ mercadoId: mercado.id })
    setBusy(false)
    if ('error' in result) setError(result.error)
    else { fireConfetti(50); onChanged() }
  }
  async function elegir(opcion: string) {
    if (miApuesta?.opcion === opcion) return
    setBusy(true); setError('')
    const result = await placeApuesta({ mercadoId: mercado.id, opcion })
    setBusy(false)
    if ('error' in result) setError(result.error)
    else { fireConfetti(70); onChanged() }
  }
  const wrap: React.CSSProperties = {
    marginTop: 10, borderTop: `1px dashed ${Q.borderHi}`, paddingTop: 10,
  }

  // ── Teaser tapado: aún no ha apostado y puede hacerlo ──
  if (canBet && !committed) {
    if (rechazado) {
      return (
        <div style={wrap}>
          <button onClick={() => setRechazado(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: Q.textMid, padding: 0 }}>
            🎰 ¿Cambias de idea? Hay una apuesta aquí…
          </button>
        </div>
      )
    }
    return (
      <div style={wrap}>
        <div style={{
          background: 'linear-gradient(160deg,#1a1430,#101733)',
          border: '1px solid rgba(157,123,255,.35)', borderRadius: 12, padding: '11px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            <span style={{ fontSize: 17 }}>🎰</span>
            <div>
              <p style={{ ...labelStyle, fontSize: 8, color: Q.purple }}>APUESTA SECRETA</p>
              <p style={{ fontSize: 12, color: Q.textSoft, marginTop: 2 }}>
                Una jugada oculta de este partido. Si entras, bloqueas {stake} pts <strong style={{ color: Q.pink }}>sin marcha atrás</strong>.
              </p>
            </div>
          </div>
          {error && <p style={{ fontSize: 11, color: Q.pink, marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={reservar}
              disabled={busy || sinSaldo}
              style={{
                flex: 1, ...pixelStyle, fontSize: 10, color: sinSaldo ? Q.textDim : '#1a1030',
                background: sinSaldo ? Q.cardHi : 'linear-gradient(180deg,#c7a3ff,#9d7bff)',
                border: 0, borderRadius: 10, padding: '10px', cursor: sinSaldo ? 'default' : 'pointer',
                opacity: busy ? 0.6 : 1, boxShadow: sinSaldo ? 'none' : '0 3px 0 #6a4bd1',
              }}
            >
              {sinSaldo ? `NECESITAS ${stake} PTS` : `SÍ, ME LA JUEGO (${stake} PTS) ▸`}
            </button>
            <button
              onClick={() => setRechazado(true)}
              disabled={busy}
              style={{ ...labelStyle, fontSize: 9, color: Q.textMid, background: Q.cardHi, border: `1px solid ${Q.border}`, borderRadius: 10, padding: '0 14px', cursor: 'pointer' }}
            >
              Paso
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Sin apostar y ya cerrada/resuelta: nada que mostrar ──
  if (!committed && !settled && locked) return null
  if (!committed && settled) {
    // Informativo: enseñar la pregunta y la opción ganadora
    const ganadora = mercado.opciones.find(o => o.key === mercado.opcion_ganadora)
    return (
      <div style={wrap}>
        <p style={{ fontSize: 11, color: Q.textDim }}>
          🎰 {mercado.pregunta} {ganadora && <span style={{ color: Q.gold }}>→ {ganadora.label}</span>} · no apostaste
        </p>
      </div>
    )
  }

  // ── Apostó (pendiente de elegir, ya elegida, cerrada o resuelta) ──
  const miResultado = settled && miApuesta ? (miApuesta.payout ?? 0) - miApuesta.fichas : null
  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: Q.text, lineHeight: 1.3 }}>
          🎰 {mercado.pregunta}
        </p>
        {settled ? (
          <span style={{ ...labelStyle, fontSize: 8, color: Q.gold, flex: 'none' }}>✓ RESUELTA</span>
        ) : locked ? (
          <span style={{ ...labelStyle, fontSize: 8, color: Q.pink, flex: 'none' }}>🔒 CERRADA</span>
        ) : pending ? (
          <span style={{ ...labelStyle, fontSize: 8, color: Q.purple, flex: 'none' }}>ELIGE YA</span>
        ) : null}
      </div>
      {mercado.subtitulo && <p style={{ fontSize: 10, color: Q.textDim, marginTop: -4, marginBottom: 8 }}>{mercado.subtitulo}</p>}

      {pending && canBet && (
        <p style={{ fontSize: 11, color: Q.purple, marginBottom: 8 }}>
          🔒 {miApuesta!.fichas} pts bloqueados — elige tu respuesta:
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mercado.opciones.map(opt => {
          const elegida = miApuesta?.opcion === opt.key
          const ganadora = settled && mercado.opcion_ganadora === opt.key
          const payout = calcPayout(stake, opt.mult)
          const apagada = settled && !ganadora
          return (
            <button
              key={opt.key}
              onClick={() => canBet && elegir(opt.key)}
              disabled={!canBet || busy}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                width: '100%', textAlign: 'left', cursor: canBet ? 'pointer' : 'default',
                background: ganadora ? 'rgba(255,210,63,.14)' : elegida ? 'rgba(54,245,154,.12)' : Q.cardHi,
                border: `1.5px solid ${ganadora ? 'rgba(255,210,63,.6)' : elegida ? 'rgba(54,245,154,.55)' : Q.border}`,
                borderRadius: 10, padding: '9px 11px', opacity: apagada ? 0.4 : busy ? 0.7 : 1,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%', flex: 'none',
                  border: `2px solid ${elegida || ganadora ? (ganadora ? Q.gold : Q.green) : Q.textDim}`,
                  background: elegida || ganadora ? (ganadora ? Q.gold : Q.green) : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#06210f',
                }}>{(elegida || ganadora) ? '✓' : ''}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: Q.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>
                <span style={{ fontSize: 9, color: Q.green, fontWeight: 600 }}>+{payout - stake}</span>
                <span style={{ ...pixelStyle, fontSize: 9, color: Q.gold, background: 'rgba(255,210,63,.1)', border: '1px solid rgba(255,210,63,.3)', borderRadius: 7, padding: '3px 6px' }}>x{opt.mult}</span>
              </span>
            </button>
          )
        })}
      </div>

      {error && <p style={{ fontSize: 11, color: Q.pink, marginTop: 8, textAlign: 'center' }}>{error}</p>}

      <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {settled && miApuesta ? (
          <span style={{
            ...labelStyle, fontSize: 9, color: (miResultado ?? 0) > 0 ? Q.green : Q.red,
            background: (miResultado ?? 0) > 0 ? 'rgba(54,245,154,.12)' : 'rgba(255,91,118,.12)', borderRadius: 8, padding: '5px 9px',
          }}>
            {(miResultado ?? 0) > 0 ? `🏆 GANASTE +${miResultado}` : `💀 PERDISTE ${miApuesta.fichas}`}
          </span>
        ) : pending ? (
          <span style={{ fontSize: 10, color: Q.textDim }}>Si no eliges, pierdes los {miApuesta!.fichas} pts</span>
        ) : committed ? (
          <span style={{ fontSize: 11, color: Q.green, fontWeight: 600 }}>🎟️ {miApuesta!.fichas} pts en juego · sin marcha atrás</span>
        ) : <span />}
      </div>

      {(locked || settled) && apuestasMercado.length > 0 && (
        <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {apuestasMercado.map(a => {
            const opt = mercado.opciones.find(o => o.key === a.opcion)
            const gano = settled && mercado.opcion_ganadora === a.opcion
            return (
              <span key={a.id} style={{
                fontSize: 10, padding: '4px 9px', borderRadius: 20,
                background: a.jugador_id === miJugadorId ? 'rgba(52,227,255,.12)' : Q.cardHi,
                border: `1px solid ${a.jugador_id === miJugadorId ? 'rgba(52,227,255,.4)' : Q.border}`, color: Q.textSoft,
              }}>
                {nombresById.get(a.jugador_id) || '—'} · {opt?.label || 'sin responder'}
                {settled && <strong style={{ color: gano ? Q.green : Q.textDim, marginLeft: 5 }}>{gano ? `+${(a.payout ?? 0) - a.fichas}` : `−${a.fichas}`}</strong>}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Admin: resolver apuestas ──────────────────────────────────────────────────

export function BolsaAdmin({ data, equiposById, onChanged }: {
  data: QuinielaData
  equiposById: Map<string, QuinielaEquipo>
  onChanged: () => void
}) {
  const partidosById = new Map(data.partidos.map(p => [p.id, p]))
  const resolvibles = data.mercados
    .map(m => ({ m, partido: partidosById.get(m.partido_id) }))
    .filter(x => x.partido && (x.partido.estado === 'finalizado' || new Date(x.partido.fecha_hora).getTime() <= Date.now()))
    .sort((a, b) => (a.m.estado === 'liquidado' ? 1 : 0) - (b.m.estado === 'liquidado' ? 1 : 0)
      || (a.partido!.numero - b.partido!.numero))

  if (data.mercados.length === 0) return null

  return (
    <div>
      <p style={{ ...labelStyle, fontSize: 9, marginBottom: 10 }}>🎰 Resolver apuestas (La Bolsa)</p>
      {resolvibles.length === 0 ? (
        <p style={{ fontSize: 11, color: Q.textDim }}>Ningún partido con apuesta ha empezado todavía.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resolvibles.map(({ m, partido }) => (
            <BolsaAdminRow key={m.id} mercado={m} partido={partido!} equiposById={equiposById} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  )
}

function BolsaAdminRow({ mercado, partido, equiposById, onChanged }: {
  mercado: QuinielaMercado
  partido: QuinielaPartido
  equiposById: Map<string, QuinielaEquipo>
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const local = partido.equipo_local_id ? equiposById.get(partido.equipo_local_id) : undefined
  const visitante = partido.equipo_visitante_id ? equiposById.get(partido.equipo_visitante_id) : undefined

  async function resolver(opcion: string) {
    setBusy(true); setError('')
    const result = await liquidarMercadoAdmin({ mercadoId: mercado.id, opcionGanadora: opcion })
    setBusy(false)
    if ('error' in result) setError(result.error)
    else onChanged()
  }

  return (
    <div style={{ background: Q.card, borderRadius: 12, border: `1px solid ${mercado.estado === 'liquidado' ? 'rgba(54,245,154,.3)' : Q.border}`, padding: '11px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: Q.text }}>
          <span style={{ color: Q.textDim, marginRight: 6 }}>#{partido.numero}</span>
          {local?.codigo || '—'} vs {visitante?.codigo || '—'} · {mercado.pregunta}
        </span>
        {mercado.estado === 'liquidado' && <span style={{ fontSize: 9, color: Q.green, flex: 'none' }}>✓ resuelta</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {mercado.opciones.map(opt => {
          const ganadora = mercado.opcion_ganadora === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => resolver(opt.key)}
              disabled={busy}
              style={{
                background: ganadora ? Q.green : Q.cardHi, color: ganadora ? '#06210f' : Q.textSoft,
                border: `1px solid ${ganadora ? Q.green : Q.border}`, borderRadius: 20, padding: '6px 12px',
                fontSize: 11, cursor: 'pointer', opacity: busy ? 0.6 : 1,
              }}
            >
              {opt.label} {ganadora && '✓'}
            </button>
          )
        })}
      </div>
      {mercado.estado === 'liquidado' && (
        <p style={{ fontSize: 9, color: Q.textDim, marginTop: 7 }}>Pulsa otra opción para corregir la resolución.</p>
      )}
      {error && <p style={{ fontSize: 10, color: Q.pink, marginTop: 6 }}>{error}</p>}
    </div>
  )
}
