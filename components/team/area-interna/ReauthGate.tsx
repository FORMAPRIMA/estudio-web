'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Session cache helpers ────────────────────────────────────────────────────

const AUTH_KEY   = 'fp_area_interna_auth'
const AUTH_TTL   = 30 * 60 * 1000 // 30 minutos

export function checkAuthCache(userId: string): boolean {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    if (!raw) return false
    const { uid, ts } = JSON.parse(raw)
    return uid === userId && Date.now() - ts < AUTH_TTL
  } catch {
    return false
  }
}

export function setAuthCache(userId: string) {
  try {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify({ uid: userId, ts: Date.now() }))
  } catch {}
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  userEmail: string
  userId:    string
  onVerified: () => void
}

export default function ReauthGate({ userEmail, userId, onVerified }: Props) {
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email:    userEmail,
      password,
    })

    if (authError) {
      setError('Contraseña incorrecta. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    setAuthCache(userId)
    onVerified()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F2F2F0',
    }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 28px' }}>

        {/* Logo */}
        <img
          src="/FORMA_PRIMA_NEGRO.png"
          alt="Forma Prima"
          style={{ height: 28, width: 'auto', marginBottom: 32, display: 'block' }}
        />

        <p style={{
          fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: '#AAA', fontWeight: 300, marginBottom: 10,
        }}>
          Área Interna FP
        </p>

        <h1 style={{
          fontSize: 24, fontWeight: 300, color: '#1A1A1A',
          letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.2,
        }}>
          Verificación<br />de acceso
        </h1>

        <p style={{
          fontSize: 12, color: '#888', fontWeight: 300,
          marginBottom: 36, lineHeight: 1.7,
        }}>
          Esta sección contiene información personal y confidencial.
          Confirma tu identidad para continuar.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Email (read-only) */}
          <div>
            <p style={{
              fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: '#BBB', fontWeight: 300, marginBottom: 7,
            }}>Cuenta</p>
            <div style={{
              padding: '9px 13px',
              border: '1px solid #E8E6E0',
              background: '#F8F8F6',
              fontSize: 13, color: '#999', fontWeight: 300,
              letterSpacing: '0.01em',
            }}>
              {userEmail}
            </div>
          </div>

          {/* Password */}
          <div>
            <p style={{
              fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: '#BBB', fontWeight: 300, marginBottom: 7,
            }}>Contraseña</p>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              required
              placeholder="••••••••••••"
              style={{
                width: '100%', padding: '9px 13px',
                border: `1px solid ${error ? '#D85A30' : '#E8E6E0'}`,
                background: '#fff',
                fontSize: 13, color: '#1A1A1A', fontWeight: 300,
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 11, color: '#C04828', fontWeight: 300, marginTop: -8 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            style={{
              background: loading || !password.trim() ? '#CCC' : '#1A1A1A',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 300,
              cursor: loading || !password.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              marginTop: 4,
            }}
          >
            {loading ? 'Verificando…' : 'Acceder'}
          </button>
        </form>

        <div style={{
          marginTop: 36,
          paddingTop: 24,
          borderTop: '1px solid #E8E6E0',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="#CCC" strokeWidth="1" />
            <path d="M6 5.5V8.5M6 3.5V4.5" stroke="#CCC" strokeWidth="1" strokeLinecap="round" />
          </svg>
          <p style={{ fontSize: 10, color: '#CCC', fontWeight: 300 }}>
            La sesión expira a los 30 min de inactividad.
          </p>
        </div>

      </div>
    </div>
  )
}
