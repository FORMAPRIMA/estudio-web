'use client'

import { useState } from 'react'

// Gate de acceso del Espacio. En la primera visita a contenido privado el cliente
// FIJA su PIN (needsSetup); después lo introduce para entrar. Tras verificar, el
// servidor setea la cookie de sesión y recargamos para leerla.
export default function EspacioGate({
  token,
  nombre,
  needsSetup,
}: {
  token: string
  nombre: string
  needsSetup: boolean
}) {
  const [pin, setPin]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^\d{4}$/.test(pin)) { setError('El PIN debe tener 4 dígitos.'); return }
    if (needsSetup && pin !== confirm) { setError('Los PIN no coinciden.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/espacio/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error de acceso.'); setLoading(false); return }
      window.location.reload()
    } catch {
      setError('No se pudo verificar. Inténtalo de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1A1A1A',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: '40px 24px',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/FORMA_PRIMA_BLANCO.png" alt="Forma Prima" style={{ height: 30, marginBottom: 40, opacity: 0.92 }} />

      <div style={{
        background: '#fff',
        borderRadius: 10,
        padding: 'clamp(28px, 6vw, 44px)',
        width: '100%',
        maxWidth: 380,
        textAlign: 'center',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: '#D85A30', display: 'block', marginBottom: 14,
        }}>
          {needsSetup ? 'Crea tu acceso' : 'Tu espacio'}
        </span>
        <h1 style={{ fontSize: 22, fontWeight: 300, marginBottom: 10, color: '#1A1A1A' }}>
          {needsSetup ? `Hola, ${nombre}.` : 'Introduce tu PIN'}
        </h1>
        <p style={{ fontSize: 13.5, color: '#888', lineHeight: 1.6, marginBottom: 28 }}>
          {needsSetup
            ? 'Crea un PIN de 4 dígitos para proteger tu espacio. Lo necesitarás para volver a entrar.'
            : 'Este espacio es privado. Introduce el PIN que creaste.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            className="fp-input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoFocus
            placeholder="• • • •"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: 20, padding: '14px' }}
          />
          {needsSetup && (
            <input
              className="fp-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Repite el PIN"
              value={confirm}
              onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))}
              style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: 20, padding: '14px' }}
            />
          )}
          {error && (
            <p style={{ fontSize: 13, color: '#E53E3E', background: '#FFF5F5', border: '1px solid #FCA5A5', borderRadius: 4, padding: '8px 12px' }}>
              {error}
            </p>
          )}
          <button type="submit" className="fp-btn-primary" disabled={loading}>
            {loading ? 'Verificando…' : needsSetup ? 'Crear PIN y entrar' : 'Entrar'}
          </button>
        </form>
      </div>

      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 24 }}>
        © Forma Prima · Geinex Group S.L.
      </p>

      <style>{`
        .fp-input { padding: 12px 14px; border: 1px solid #E5E2DA; border-radius: 4px; font-size: 14px; width: 100%; background: #fff; color: #1A1A1A; font-family: inherit; outline: none; transition: border-color 0.15s; }
        .fp-input:focus { border-color: #D85A30; }
        .fp-btn-primary { background: #D85A30; color: #fff; border: none; border-radius: 4px; padding: 16px 32px; font-size: 15px; font-weight: 500; cursor: pointer; width: 100%; transition: background 0.2s; font-family: inherit; }
        .fp-btn-primary:hover { background: #C24E26; }
        .fp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
