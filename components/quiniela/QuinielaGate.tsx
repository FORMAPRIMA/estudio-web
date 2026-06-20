'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerJugadorExterno, loginJugadorExterno } from '@/app/actions/quiniela'
import QuinielaReglas from '@/components/quiniela/QuinielaReglas'
import { Q, FONT, QUINIELA_KEYFRAMES, labelStyle, pixelStyle } from '@/components/team/quiniela/theme'

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
      minHeight: '100vh', background: Q.bg, fontFamily: FONT.body, color: Q.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <style>{QUINIELA_KEYFRAMES}</style>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ ...labelStyle, color: Q.textMid, marginBottom: 12 }}>FORMA PRIMA PRESENTA</div>
          <h1 style={{ ...pixelStyle, fontSize: 22, color: Q.green, marginBottom: 12, textShadow: '0 0 16px rgba(54,245,154,.4)', lineHeight: 1.4 }}>
            LA PORRA<br />DEL MUNDIAL ⚽
          </h1>
          <p style={{ fontSize: 13, color: Q.textMid, lineHeight: 1.6 }}>
            Predice marcadores, elige a tu campeón y pelea por el bote.
            <br />
            Entrada: <strong style={{ color: Q.gold }}>{monto.toFixed(0)} €</strong>
            {numJugadores > 0 && <> · ya hay <strong style={{ color: Q.text }}>{numJugadores}</strong> dentro</>}
          </p>
          <button
            onClick={() => setVerReglas(true)}
            style={{
              marginTop: 14, background: 'rgba(52,227,255,.1)', border: '1px solid rgba(52,227,255,.3)',
              borderRadius: 999, padding: '8px 18px', ...labelStyle, fontSize: 9, color: Q.cyan, cursor: 'pointer',
            }}
          >
            📖 VER REGLAS
          </button>
        </div>

        <div style={{ background: Q.card, borderRadius: 18, border: `1px solid ${Q.border}`, padding: '24px 22px', boxShadow: '0 0 40px rgba(0,0,0,.4)' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: Q.panel, borderRadius: 11, padding: 4 }}>
            {(['registro', 'login'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setModo(m); setError('') }}
                style={{
                  flex: 1, padding: '10px', ...labelStyle, fontSize: 9, cursor: 'pointer', borderRadius: 8,
                  background: modo === m ? Q.cardHi : 'transparent',
                  color: modo === m ? Q.green : Q.textMid,
                  border: modo === m ? `1px solid ${Q.border}` : '1px solid transparent',
                }}
              >
                {m === 'registro' ? 'Quiero jugar' : 'Ya tengo cuenta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle as React.CSSProperties}>Tu nombre</label>
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
              <label style={labelStyle as React.CSSProperties}>PIN (4–6 dígitos)</label>
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
                display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: Q.textSoft,
                background: 'rgba(255,91,118,.08)', border: '1px solid rgba(255,91,118,.25)', borderRadius: 10,
                padding: '10px 12px', cursor: 'pointer', lineHeight: 1.5,
              }}>
                <input
                  type="checkbox"
                  checked={compromiso}
                  onChange={e => setCompromiso(e.target.checked)}
                  style={{ marginTop: 2, accentColor: Q.green }}
                />
                <span>
                  Me comprometo a pagar la entrada de <strong style={{ color: Q.gold }}>{monto.toFixed(0)} €</strong>,{' '}
                  <strong style={{ color: Q.text }}>aunque no rellene mis predicciones a tiempo</strong>. Apuntarse es apostar.
                </span>
              </label>
            )}

            {error && <p style={{ fontSize: 12, color: Q.pink }}>{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...pixelStyle, fontSize: 11, color: '#06210f', background: 'linear-gradient(180deg,#48ffa6,#23d985)',
                border: 'none', borderRadius: 12, padding: '14px', cursor: 'pointer',
                opacity: isSubmitting ? 0.6 : 1, marginTop: 4, boxShadow: '0 4px 0 #128a52, 0 0 22px rgba(54,245,154,.4)',
              }}
            >
              {isSubmitting ? 'UN MOMENTO…' : modo === 'registro' ? 'REGISTRARME Y JUGAR ▸' : 'ENTRAR ▸'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 10, color: Q.textDim, marginTop: 16, lineHeight: 1.6 }}>
          Porra privada entre amigos de Forma Prima. Tu nombre y tus predicciones
          serán visibles para el resto de jugadores.
        </p>
      </div>

      {verReglas && <QuinielaReglas monto={monto} onClose={() => setVerReglas(false)} />}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: Q.cardHi, border: `1px solid ${Q.borderHi}`,
  borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none', color: Q.text, fontFamily: FONT.body,
  marginTop: 6,
}
