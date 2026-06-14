'use client'

import { useState } from 'react'
import { upsertPickCampeon, updatePichichi } from '@/app/actions/quiniela'
import { PUNTOS_ESCALERA, PUNTOS_PICHICHI, formatCountdown } from '@/lib/quiniela/config'
import type { QuinielaEquipo } from '@/lib/quiniela/config'

const C = { ink: '#1A1A1A', cream: '#F8F7F4', accent: '#D85A30', border: '#F0EEE8', green: '#3D8B5F' }

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
  const listo = pickState === 'saved' && pichichiState === 'saved'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#1A1A1AB0', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 6, maxWidth: 560, width: '100%',
        maxHeight: '88vh', overflowY: 'auto', padding: '30px 32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
          <h2 style={{ fontSize: 20, fontWeight: 300, color: C.ink }}>
            ⏳ Tus dos picks urgentes
          </h2>
          <span style={{
            background: restante < 3 * 3600 * 1000 ? '#D85A3015' : C.cream,
            border: `1px solid ${restante < 3 * 3600 * 1000 ? '#D85A3040' : C.border}`,
            color: restante < 3 * 3600 * 1000 ? C.accent : C.ink,
            borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
          }}>
            🕐 cierran en {formatCountdown(restante)}
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#1A1A1A70', lineHeight: 1.6, marginBottom: 20 }}>
          Antes de nada, dos apuestas que solo se pueden hacer ahora. El resto de predicciones
          (partido a partido) las tienes en la pestaña Partidos, cada una hasta 1 hora antes
          de su kickoff.
        </p>

        {/* Campeón */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 4 }}>
            1 · ¿Quién gana el Mundial? · <strong style={{ color: C.accent }}>{PUNTOS_ESCALERA.apertura} pts</strong>
          </p>
          <p style={{ fontSize: 11, color: '#1A1A1A60', marginBottom: 10 }}>
            {pickState === 'saved' && pickId
              ? <>Tu pick: <strong>{equipos.find(e => e.id === pickId)?.bandera} {equipos.find(e => e.id === pickId)?.nombre}</strong> ✓ (puedes cambiarlo hasta el cierre)</>
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
                  background: pickId === eq.id ? C.ink : '#fff',
                  color: pickId === eq.id ? '#fff' : C.ink,
                  border: `1px solid ${pickId === eq.id ? C.ink : C.border}`,
                  borderRadius: 20, padding: '4px 9px', fontSize: 11, cursor: 'pointer',
                  opacity: pickState === 'saving' ? 0.6 : 1,
                }}
              >
                {eq.bandera} {eq.codigo}
              </button>
            ))}
          </div>
          {pickError && <p style={{ fontSize: 11, color: C.accent, marginTop: 8 }}>{pickError}</p>}
        </div>

        {/* Pichichi */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 4 }}>
            2 · Pichichi (máximo goleador) · <strong style={{ color: C.accent }}>{PUNTOS_PICHICHI} pts</strong>
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={pichichi}
              onChange={e => { setPichichi(e.target.value); setPichichiState('idle') }}
              placeholder="Ej: Mbappé, Haaland, Lamine Yamal…"
              style={{
                flex: 1, border: '1px solid #E5E2DA', borderRadius: 4, padding: '10px 12px',
                fontSize: 13, outline: 'none', color: C.ink, background: '#FDFDFC',
              }}
            />
            <button
              onClick={handlePichichi}
              disabled={pichichiState === 'saving' || pichichiState === 'saved'}
              style={{
                background: pichichiState === 'saved' ? '#3D8B5F12' : C.ink,
                color: pichichiState === 'saved' ? C.green : '#fff',
                border: pichichiState === 'saved' ? '1px solid #3D8B5F40' : 'none',
                borderRadius: 4, padding: '10px 16px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}
            >
              {pichichiState === 'saving' ? '…' : pichichiState === 'saved' ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>
          {pichichiError && <p style={{ fontSize: 11, color: C.accent, marginTop: 8 }}>{pichichiError}</p>}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', background: listo ? C.green : '#fff', color: listo ? '#fff' : '#1A1A1A70',
            border: listo ? 'none' : `1px solid ${C.border}`, borderRadius: 4, padding: '12px',
            fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, cursor: 'pointer',
          }}
        >
          {listo ? '¡Listo! A predecir partidos →' : 'Luego (me quedan ' + formatCountdown(restante) + ')'}
        </button>
      </div>
    </div>
  )
}
