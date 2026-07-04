'use client'

import { useState } from 'react'
import { upsertPickCampeon, upsertPickPichichi } from '@/app/actions/quiniela'
import { Q, FONT, labelStyle, pixelStyle } from '@/components/team/quiniela/theme'
import { PUNTOS_ESCALERA, PUNTOS_PICHICHI_ESCALERA } from '@/lib/quiniela/config'
import type { QuinielaEquipo, VentanaCampeon } from '@/lib/quiniela/config'

// Modal BLOQUEANTE al arrancar una nueva fase de eliminatorias: obliga a fijar
// campeón y goleador de la ventana abierta (puntos decrecientes) y explica las
// apuestas. No se puede cerrar hasta completar ambos picks.

export default function QuinielaFaseModal({
  faseLabel, ventana, equiposElegibles, miPickCampeonId, miPichichiNombre, stake, onChanged,
}: {
  faseLabel: string
  ventana: VentanaCampeon
  equiposElegibles: QuinielaEquipo[]
  miPickCampeonId: string | null
  miPichichiNombre: string | null
  stake: number
  onChanged: () => void
}) {
  const [pichichi, setPichichi] = useState(miPichichiNombre || '')
  const [savingCampeon, setSavingCampeon] = useState(false)
  const [savingPichichi, setSavingPichichi] = useState(false)
  const [error, setError] = useState('')

  const campeonHecho = !!miPickCampeonId
  const pichichiHecho = !!miPichichiNombre

  async function elegirCampeon(equipoId: string) {
    setSavingCampeon(true); setError('')
    const result = await upsertPickCampeon({ ventana, equipoId })
    setSavingCampeon(false)
    if ('error' in result) setError(result.error)
    else onChanged()
  }
  async function guardarPichichi() {
    if (!pichichi.trim()) return
    setSavingPichichi(true); setError('')
    const result = await upsertPickPichichi({ ventana, nombre: pichichi })
    setSavingPichichi(false)
    if ('error' in result) setError(result.error)
    else onChanged()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(5,8,18,.85)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      fontFamily: FONT.body, backdropFilter: 'blur(3px)',
    }}>
      <div className="q-scroll" style={{
        width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto',
        background: Q.bg, borderTop: `2px solid ${Q.green}`, borderRadius: '20px 20px 0 0',
        padding: '22px 18px 26px', animation: 'q-slideUp .35s ease both',
        boxShadow: '0 -10px 50px rgba(0,0,0,.6)',
      }}>
        {/* Cabecera */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 30, animation: 'q-bob 2.4s ease-in-out infinite' }}>⚽🔥</div>
          <p style={{ ...pixelStyle, fontSize: 14, color: Q.green, marginTop: 8, textShadow: '0 0 14px rgba(54,245,154,.4)' }}>
            ¡ARRANCAN LOS {faseLabel.toUpperCase()}!
          </p>
          <p style={{ fontSize: 12, color: Q.textMid, marginTop: 8, lineHeight: 1.5 }}>
            Ya puedes meter tus marcadores de esta ronda. Pero antes, <strong style={{ color: Q.text }}>mantén vivas</strong> tus
            dos predicciones largas: campeón y goleador. Ojo: cuanto más tarde aciertas, <strong style={{ color: Q.gold }}>menos puntos</strong> —
            quien acertó desde la fase de grupos gana más.
          </p>
        </div>

        {/* Campeón */}
        <div style={{ background: Q.card, border: `1px solid ${campeonHecho ? 'rgba(54,245,154,.4)' : Q.borderHi}`, borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
          <p style={{ ...labelStyle, color: Q.cyan, marginBottom: 4 }}>
            🏆 CAMPEÓN · ESTA VENTANA VALE {PUNTOS_ESCALERA[ventana]} PTS {campeonHecho && <span style={{ color: Q.green, textTransform: 'none', letterSpacing: 0 }}>✓</span>}
          </p>
          <p style={{ fontSize: 11, color: Q.textDim, marginBottom: 10 }}>
            Elige tu campeón entre los 32 supervivientes. Es independiente de lo que elegiste antes y suma aparte.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {equiposElegibles.length === 0 && <p style={{ fontSize: 11, color: Q.textDim }}>Esperando los cruces…</p>}
            {equiposElegibles.map(eq => (
              <button
                key={eq.id}
                onClick={() => elegirCampeon(eq.id)}
                disabled={savingCampeon}
                style={{
                  background: miPickCampeonId === eq.id ? Q.green : Q.cardHi,
                  color: miPickCampeonId === eq.id ? '#06210f' : Q.textSoft,
                  border: `1px solid ${miPickCampeonId === eq.id ? Q.green : Q.border}`,
                  borderRadius: 20, padding: '5px 11px', fontSize: 11, cursor: 'pointer',
                  opacity: savingCampeon ? 0.6 : 1,
                }}
              >
                {eq.bandera} {eq.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Pichichi */}
        <div style={{ background: Q.card, border: `1px solid ${pichichiHecho ? 'rgba(54,245,154,.4)' : Q.borderHi}`, borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
          <p style={{ ...labelStyle, color: Q.purple, marginBottom: 4 }}>
            ⚽ GOLEADOR (PICHICHI) · {PUNTOS_PICHICHI_ESCALERA[ventana]} PTS {pichichiHecho && <span style={{ color: Q.green, textTransform: 'none', letterSpacing: 0 }}>✓</span>}
          </p>
          <p style={{ fontSize: 11, color: Q.textDim, marginBottom: 10 }}>
            Tu apuesta al máximo goleador del Mundial para esta ventana. También suma en paralelo.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={pichichi}
              onChange={e => setPichichi(e.target.value)}
              placeholder="Máximo goleador del Mundial…"
              style={{ flex: 1, border: `1px solid ${Q.borderHi}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: Q.text, background: Q.cardHi, fontFamily: FONT.body }}
            />
            <button
              onClick={guardarPichichi}
              disabled={savingPichichi || !pichichi.trim()}
              style={{ background: Q.green, color: '#06210f', border: 'none', borderRadius: 10, padding: '0 16px', ...labelStyle, fontSize: 9, cursor: 'pointer', opacity: savingPichichi || !pichichi.trim() ? 0.6 : 1 }}
            >
              {savingPichichi ? '…' : 'OK'}
            </button>
          </div>
        </div>

        {/* Apuestas */}
        <div style={{ background: 'linear-gradient(160deg,#1a1430,#101733)', border: '1px solid rgba(157,123,255,.3)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
          <p style={{ ...labelStyle, color: Q.purple, marginBottom: 6 }}>🎰 NOVEDAD · LAS APUESTAS</p>
          <p style={{ fontSize: 12, color: Q.textSoft, lineHeight: 1.5 }}>
            En cada partido de eliminatorias hay una <strong style={{ color: Q.text }}>apuesta secreta</strong>: si te atreves,
            bloqueas <strong style={{ color: Q.gold }}>{stake} pts</strong> y se revela una pregunta especial de ese partido
            (goleadores, tarjetas, prórroga…). Si aciertas multiplicas tus puntos; si fallas, los pierdes. Es opcional y
            la verás dentro de cada partido.
          </p>
        </div>

        {error && <p style={{ fontSize: 12, color: Q.pink, textAlign: 'center', marginBottom: 12 }}>{error}</p>}

        <button
          disabled={!campeonHecho || !pichichiHecho}
          onClick={onChanged}
          style={{
            width: '100%', ...pixelStyle, fontSize: 12,
            color: campeonHecho && pichichiHecho ? '#06210f' : Q.textDim,
            background: campeonHecho && pichichiHecho ? 'linear-gradient(180deg,#48ffa6,#23d985)' : Q.cardHi,
            border: 0, borderRadius: 12, padding: '14px', cursor: campeonHecho && pichichiHecho ? 'pointer' : 'default',
            boxShadow: campeonHecho && pichichiHecho ? '0 4px 0 #128a52' : 'none',
          }}
        >
          {campeonHecho && pichichiHecho ? '¡A PREDECIR! ▸' : 'COMPLETA CAMPEÓN Y GOLEADOR'}
        </button>
      </div>
    </div>
  )
}
