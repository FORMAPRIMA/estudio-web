'use client'

import { useState } from 'react'

export default function ClientPortalGate({
  proyectoId,
  proyectoNombre,
  imagenUrl,
}: {
  proyectoId: string
  proyectoNombre: string
  imagenUrl: string | null
}) {
  const [fecha, setFecha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fecha) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId, fecha_nacimiento: fecha }),
      })
      const json = await res.json()
      if (res.ok) {
        window.location.reload()
      } else {
        setError(json.error ?? 'Error al verificar.')
      }
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      background: '#0F0F0E', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Background image */}
      {imagenUrl && (
        <>
          <img
            src={imagenUrl} alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.15, filter: 'blur(8px)', transform: 'scale(1.05)' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(15,15,14,0.7) 0%, rgba(15,15,14,0.95) 100%)' }} />
        </>
      )}

      {/* Card */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img
            src="/FORMA_PRIMA_BLANCO.png"
            alt="Forma Prima"
            style={{ height: 26, width: 'auto', objectFit: 'contain', opacity: 0.85 }}
          />
          <div style={{ width: 32, height: 1, background: '#D85A30', margin: '14px auto 0' }} />
        </div>

        <div className="cpg-card" style={{
          background: 'rgba(255,255,255,0.04)', borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          padding: '40px 36px',
        }}>
          <h1 style={{ fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,0.9)', margin: '0 0 6px', lineHeight: 1.4 }}>
            Portal de proyecto
          </h1>
          <p style={{ fontSize: 20, fontWeight: 200, color: '#fff', margin: '0 0 28px', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
            {proyectoNombre}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 28px', lineHeight: 1.6 }}>
            Para acceder a tu portal introduce tu fecha de nacimiento.
          </p>

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
              Fecha de nacimiento
            </label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 14px', fontSize: 14,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, color: '#fff', fontFamily: 'inherit',
                boxSizing: 'border-box', outline: 'none',
                colorScheme: 'dark',
              }}
            />

            {error && (
              <p style={{ fontSize: 12, color: '#F87171', margin: '10px 0 0', lineHeight: 1.5 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !fecha}
              style={{
                marginTop: 20, width: '100%', padding: '13px',
                background: loading || !fecha ? 'rgba(216,90,48,0.4)' : '#D85A30',
                color: '#fff', border: 'none', borderRadius: 8, cursor: loading || !fecha ? 'not-allowed' : 'pointer',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Verificando…' : 'Acceder al portal'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
          ¿Problemas de acceso? Contacta con tu arquitecto.
        </p>
      </div>
    </div>
  )
}
