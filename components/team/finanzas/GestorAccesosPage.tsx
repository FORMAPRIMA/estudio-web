'use client'

import { useState } from 'react'
import { createGestorToken, revokeGestorToken, type GestorToken } from '@/app/actions/gestor'

interface Props {
  initialTokens: GestorToken[]
}

export default function GestorAccesosPage({ initialTokens }: Props) {
  const [tokens, setTokens] = useState<GestorToken[]>(initialTokens)
  const [label, setLabel]   = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const portalUrl = (token: string) =>
    `${typeof window !== 'undefined' ? window.location.origin : ''}/gestor/${token}`

  const handleCreate = async () => {
    setIsCreating(true)
    setError(null)
    const res = await createGestorToken(label)
    setIsCreating(false)
    if ('error' in res) { setError(res.error); return }
    setTokens(prev => [res.token, ...prev])
    setLabel('')
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('¿Revocar este acceso? El enlace dejará de funcionar inmediatamente.')) return
    const res = await revokeGestorToken(id)
    if ('error' in res) { alert(res.error); return }
    setTokens(prev => prev.map(t => t.id === id ? { ...t, revoked_at: new Date().toISOString() } : t))
  }

  const handleCopy = async (t: GestorToken) => {
    try {
      await navigator.clipboard.writeText(portalUrl(t.token))
      setCopiedId(t.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      alert(portalUrl(t.token))
    }
  }

  const activos   = tokens.filter(t => !t.revoked_at)
  const revocados = tokens.filter(t => t.revoked_at)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>Finanzas</p>
      <h1 style={{ fontSize: 20, fontWeight: 300, color: '#1A1A1A', margin: '0 0 8px', letterSpacing: '-0.01em' }}>Portal del gestor</h1>
      <p style={{ fontSize: 12, color: '#888', margin: '0 0 24px', lineHeight: 1.5 }}>
        Genera enlaces de solo lectura para que la gestoría consulte y descargue los gastos
        escaneados, las facturas emitidas y el estado de la conciliación bancaria.
      </p>

      {/* Crear nuevo acceso */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Nombre del acceso (ej: Gestoría Martínez)"
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{ flex: 1, padding: '10px 12px', fontSize: 13, border: '1px solid #E8E6E0', borderRadius: 8, fontFamily: 'inherit' }}
        />
        <button
          onClick={handleCreate}
          disabled={isCreating}
          style={{ padding: '10px 18px', background: '#D85A30', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: isCreating ? 0.6 : 1, flexShrink: 0 }}
        >
          {isCreating ? 'Generando…' : '+ Generar enlace'}
        </button>
      </div>

      {error && <p style={{ fontSize: 12, color: '#DC2626', margin: '0 0 16px' }}>{error}</p>}

      {/* Accesos activos */}
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 10px' }}>
        Accesos activos ({activos.length})
      </p>
      {activos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', border: '2px dashed #E8E6E0', borderRadius: 12, marginBottom: 28 }}>
          <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Sin accesos activos. Genera un enlace para tu gestor.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {activos.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', margin: '0 0 2px' }}>
                  {t.label ?? 'Acceso sin nombre'}
                </p>
                <p style={{ fontSize: 10, color: '#AAA', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Creado {new Date(t.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {t.last_access ? ` · Último acceso ${new Date(t.last_access).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}` : ' · Sin accesos aún'}
                </p>
              </div>
              <button
                onClick={() => handleCopy(t)}
                style={{ fontSize: 11, padding: '6px 12px', background: copiedId === t.id ? '#ECFDF5' : 'none', border: `1px solid ${copiedId === t.id ? '#A7F3D0' : '#E8E6E0'}`, borderRadius: 6, cursor: 'pointer', color: copiedId === t.id ? '#065F46' : '#555', flexShrink: 0 }}
              >
                {copiedId === t.id ? '✓ Copiado' : '🔗 Copiar enlace'}
              </button>
              <button
                onClick={() => handleRevoke(t.id)}
                style={{ fontSize: 11, padding: '6px 12px', background: 'none', border: '1px solid #FECACA', borderRadius: 6, cursor: 'pointer', color: '#DC2626', flexShrink: 0 }}
              >
                Revocar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Revocados */}
      {revocados.length > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#CCC', margin: '0 0 10px' }}>
            Revocados ({revocados.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {revocados.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#FAFAF8', border: '1px solid #F0EEE8', borderRadius: 8, opacity: 0.6 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{t.label ?? 'Acceso sin nombre'}</p>
                </div>
                <span style={{ fontSize: 10, color: '#BBB' }}>
                  Revocado {new Date(t.revoked_at!).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
