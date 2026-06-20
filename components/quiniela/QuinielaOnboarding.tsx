'use client'

import { useState } from 'react'
import { upsertPickCampeon, updatePichichi } from '@/app/actions/quiniela'
import { PUNTOS_ESCALERA, PUNTOS_PICHICHI, formatCountdown } from '@/lib/quiniela/config'
import type { QuinielaEquipo } from '@/lib/quiniela/config'
import { Q, FONT, labelStyle, pixelStyle } from '@/components/team/quiniela/theme'

export default function QuinielaOnboarding({
  equipos, pickActualId, pichichiActual, deadlineMs, ahora, onClose, onChanged,
}: {
  equipos: QuinielaEquipo[]
  pickActualId: string | null
  pichichiActual: string | null
  deadlineMs: number
  ahora: number
  onClose: () => void
  onChanged: () => void
}) {
  const [pickId, setPickId] = useState<string | null>(pickActualId)
  const [pickState, setPickState] = useState<'idle' | 'saving' | 'saved' | 'error'>(pickActualId ? 'saved' : 'idle')
  const [pickError, setPickError] = useState('')
  const [pichichi, setPichichi] = useState(pichichiActual || '')
  const [pichichiState, setPichichiState] = useState<'idle' | 'saving' | 'saved' | 'error'>(pichichiActual ? 'saved' : 'idle')
  const [pichichiError, setPichichiError] = useState('')

  async function handlePick(equipoId: string) {
    setPickId(equipoId)
    setPickState('saving')
    setPickError('')
    const result = await upsertPickCampeon({ ventana: 'apertura', equipoId })
    if ('error' in result) { setPickState('error'); setPickError(result.error) }
    else { setPickState('saved'); onChanged() }
  }

  async function handlePichichi() {
    if (!pichichi.trim()) return
    setPichichiState('saving')
    setPichichiError('')
    const result = await updatePichichi(pichichi)
    if ('error' in result) { setPichichiState('error'); setPichichiError(result.error) }
    else { setPichichiState('saved'); onChanged() }
  }

  const restante = deadlineMs - ahora
  const urgente = restante < 3 * 3600 * 1000
  const listo = pickState === 'saved' && pichichiState === 'saved'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(5,7,15,.82)', backdropFilter: 'blur(4px)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONT.body,
    }}>
      <div className="q-scroll" style={{
        background: Q.card, border: `1.5px solid rgba(52,227,255,.35)`, borderRadius: '22px 22px 0 0',
        maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '20px 18px 26px',
        animation: 'q-slideUp .3s ease both', boxShadow: '0 -10px 40px rgba(0,0,0,.5)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 3, background: 'rgba(255,255,255,.18)', margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
          <h2 style={{ ...pixelStyle, fontSize: 13, color: Q.cyan }}>⏳ TUS DOS PICKS URGENTES</h2>
          <span style={{
            ...labelStyle, fontSize: 9, whiteSpace: 'nowrap', borderRadius: 999, padding: '5px 10px',
            background: urgente ? 'rgba(255,91,118,.14)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${urgente ? 'rgba(255,91,118,.4)' : Q.borderHi}`,
            color: urgente ? Q.pink : Q.textMid,
          }}>
            🕐 {formatCountdown(restante)}
          </span>
        </div>
        <p style={{ fontSize: 12, color: Q.textMid, lineHeight: 1.6, marginBottom: 20 }}>
          Antes de nada, dos apuestas que solo se pueden hacer ahora. El resto de predicciones
          (partido a partido) las tienes en Partidos, cada una hasta 1 hora antes de su kickoff.
        </p>

        {/* Campeón */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ ...labelStyle, marginBottom: 4 }}>
            1 · ¿QUIÉN GANA EL MUNDIAL? · <strong style={{ color: Q.gold }}>{PUNTOS_ESCALERA.apertura} PTS</strong>
          </p>
          <p style={{ fontSize: 11, color: Q.textMid, marginBottom: 10 }}>
            {pickState === 'saved' && pickId
              ? <>Tu pick: <strong style={{ color: Q.text }}>{equipos.find(e => e.id === pickId)?.bandera} {equipos.find(e => e.id === pickId)?.nombre}</strong> ✓ (puedes cambiarlo hasta el cierre)</>
              : 'Elige un equipo. Podrás volver a elegir en cada fase, pero este es el que más vale.'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {equipos.map(eq => (
              <button
                key={eq.id}
                onClick={() => handlePick(eq.id)}
                disabled={pickState === 'saving'}
                title={eq.nombre}
                style={{
                  background: pickId === eq.id ? Q.green : Q.cardHi,
                  color: pickId === eq.id ? '#06210f' : Q.textSoft,
                  border: `1px solid ${pickId === eq.id ? Q.green : Q.border}`,
                  borderRadius: 20, padding: '4px 9px', fontSize: 11, cursor: 'pointer',
                  opacity: pickState === 'saving' ? 0.6 : 1,
                }}
              >
                {eq.bandera} {eq.codigo}
              </button>
            ))}
          </div>
          {pickError && <p style={{ fontSize: 11, color: Q.pink, marginTop: 8 }}>{pickError}</p>}
        </div>

        {/* Pichichi */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ ...labelStyle, marginBottom: 4 }}>
            2 · PICHICHI (MÁXIMO GOLEADOR) · <strong style={{ color: Q.gold }}>{PUNTOS_PICHICHI} PTS</strong>
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={pichichi}
              onChange={e => { setPichichi(e.target.value); setPichichiState('idle') }}
              placeholder="Ej: Mbappé, Haaland, Lamine Yamal…"
              style={{ flex: 1, background: Q.cardHi, border: `1px solid ${Q.borderHi}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', color: Q.text, fontFamily: FONT.body }}
            />
            <button
              onClick={handlePichichi}
              disabled={pichichiState === 'saving' || pichichiState === 'saved'}
              style={{
                background: pichichiState === 'saved' ? 'rgba(54,245,154,.1)' : Q.green,
                color: pichichiState === 'saved' ? Q.green : '#06210f',
                border: pichichiState === 'saved' ? '1px solid rgba(54,245,154,.5)' : 'none',
                borderRadius: 10, padding: '10px 16px', ...labelStyle, fontSize: 9, cursor: 'pointer',
              }}
            >
              {pichichiState === 'saving' ? '…' : pichichiState === 'saved' ? '✓ GUARDADO' : 'GUARDAR'}
            </button>
          </div>
          {pichichiError && <p style={{ fontSize: 11, color: Q.pink, marginTop: 8 }}>{pichichiError}</p>}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', ...pixelStyle, fontSize: 10, cursor: 'pointer', borderRadius: 12, padding: '13px',
            ...(listo
              ? { background: 'linear-gradient(180deg,#48ffa6,#23d985)', color: '#06210f', border: 0, boxShadow: '0 4px 0 #128a52' }
              : { background: Q.cardHi, color: Q.textSoft, border: `1px solid ${Q.border}` }),
          }}
        >
          {listo ? '¡LISTO! A PREDECIR PARTIDOS →' : `LUEGO (QUEDAN ${formatCountdown(restante)})`}
        </button>
      </div>
    </div>
  )
}
