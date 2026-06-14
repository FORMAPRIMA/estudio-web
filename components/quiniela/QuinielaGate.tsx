'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerJugadorExterno, loginJugadorExterno } from '@/app/actions/quiniela'
import QuinielaReglas from '@/components/quiniela/QuinielaReglas'

const C = { ink: '#1A1A1A', cream: '#F8F7F4', accent: '#D85A30', border: '#F0EEE8' }

export default function QuinielaGate({ monto, numJugadores }: { monto: number; numJugadores: number }) {
  const router = useRouter()
  const [modo, setModo] = useState<'registro' | 'login'>('registro')
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [compromiso, setCompromiso] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [verReglas, setVerReglas] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (modo === 'registro' && !compromiso) {
      setError('Tienes que aceptar el compromiso de pago para entrar.')
      return
    }
    setIsSubmitting(true)
    const result = modo === 'registro'
      ? await registerJugadorExterno({ nombre, pin })
      : await loginJugadorExterno({ nombre, pin })
    setIsSubmitting(false)
    if ('error' in result) setError(result.error)
    else router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.cream,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1A1A1A99', marginBottom: 10 }}>
            Forma Prima presenta
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 300, color: C.ink, letterSpacing: '-0.02em', marginBottom: 8 }}>
            La Porra del Mundial <span style={{ fontSize: 24 }}>⚽</span>
          </h1>
          <p style={{ fontSize: 13, color: '#1A1A1A70', fontWeight: 300, lineHeight: 1.6 }}>
            Predice marcadores, elige a tu campeón y pelea por el bote.
            <br />
            Entrada: <strong>{monto.toFixed(0)} €</strong>
            {numJugadores > 0 && <> · ya hay <strong>{numJugadores}</strong> dentro</>}
          </p>
          <button
            onClick={() => setVerReglas(true)}
            style={{
              marginTop: 12, background: 'none', border: `1px solid #1A1A1A30`, borderRadius: 20,
              padding: '7px 18px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: C.ink, cursor: 'pointer',
            }}
          >
            📖 Ver reglas
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 6, border: `1px solid ${C.border}`, padding: '28px 28px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: C.cream, borderRadius: 4, padding: 4 }}>
            {(['registro', 'login'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setModo(m); setError('') }}
                style={{
                  flex: 1, padding: '9px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                  fontWeight: modo === m ? 500 : 300, cursor: 'pointer',
                  background: modo === m ? '#fff' : 'none',
                  color: modo === m ? C.ink : '#1A1A1A60',
                  border: 'none', borderRadius: 3,
                  boxShadow: modo === m ? '0 1px 3px #1A1A1A10' : 'none',
                }}
              >
                {m === 'registro' ? 'Quiero jugar' : 'Ya tengo cuenta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Tu nombre</label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Como quieres aparecer en la clasificación"
                maxLength={30}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>PIN (4–6 dígitos)</label>
              <input
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={modo === 'registro' ? 'Invéntate un PIN y no lo olvides' : 'Tu PIN'}
                inputMode="numeric"
                type="password"
                required
                style={inputStyle}
              />
            </div>

            {modo === 'registro' && (
              <label style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: C.ink,
                background: '#D85A3008', border: '1px solid #D85A3025', borderRadius: 4,
                padding: '10px 12px', cursor: 'pointer', lineHeight: 1.5,
              }}>
                <input
                  type="checkbox"
                  checked={compromiso}
                  onChange={e => setCompromiso(e.target.checked)}
                  style={{ marginTop: 2, accentColor: C.accent }}
                />
                <span>
                  Me comprometo a pagar la entrada de <strong>{monto.toFixed(0)} €</strong>,{' '}
                  <strong>aunque no rellene mis predicciones a tiempo</strong>. Apuntarse es apostar.
                </span>
              </label>
            )}

            {error && <p style={{ fontSize: 12, color: C.accent }}>{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: C.accent, color: '#fff', border: 'none', borderRadius: 4,
                padding: '13px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
                fontWeight: 500, cursor: 'pointer', opacity: isSubmitting ? 0.6 : 1, marginTop: 4,
              }}
            >
              {isSubmitting ? 'Un momento…' : modo === 'registro' ? 'Registrarme y jugar' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 10, color: '#1A1A1A50', marginTop: 16, lineHeight: 1.6 }}>
          Porra privada entre amigos de Forma Prima. Tu nombre y tus predicciones
          serán visibles para el resto de jugadores.
        </p>
      </div>

      {verReglas && <QuinielaReglas monto={monto} onClose={() => setVerReglas(false)} />}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#1A1A1A70', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #E5E2DA', borderRadius: 4,
  padding: '11px 12px', fontSize: 14, outline: 'none', color: '#1A1A1A', background: '#FDFDFC',
}
