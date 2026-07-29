'use client'

import { useState } from 'react'
import { fmtFechaHora } from '@/lib/repasos/domain'
import type { Repaso, RepasoAudiencia, RepasoToken } from '@/lib/repasos/domain'
import { createRepasoToken, revokeRepasoToken } from '@/app/actions/repasos'

// Links de solo lectura por audiencia. El token va en la URL (sin PIN) y es
// revocable: si un enlace se filtra, se revoca y deja de funcionar al instante.

interface Props {
  proyectoId: string
  proyectoNombre: string
  tokens: RepasoToken[]
  repasos: Repaso[]
  onClose: () => void
  onChange: () => void
}

const AUDIENCIAS: { id: RepasoAudiencia; label: string; nota: string }[] = [
  {
    id: 'constructora',
    label: 'Constructora',
    nota: 'Ve los repasos marcados como «Constructora» y «Cliente». Nunca los internos.',
  },
  {
    id: 'cliente',
    label: 'Cliente',
    nota: 'Ve solo los repasos marcados como «Cliente».',
  },
]

export default function RepasoLinksModal({
  proyectoId,
  proyectoNombre,
  tokens,
  repasos,
  onClose,
  onChange,
}: Props) {
  const [creando, setCreando] = useState<RepasoAudiencia | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const urlDe = (t: RepasoToken) => `${origin}/repasos/${t.token}`

  const cuenta = (a: RepasoAudiencia) =>
    repasos.filter((r) =>
      a === 'cliente' ? r.visibilidad === 'cliente' : r.visibilidad !== 'interno'
    ).length

  async function crear(audiencia: RepasoAudiencia) {
    setCreando(audiencia)
    setError(null)
    const res = await createRepasoToken(proyectoId, audiencia, label)
    setCreando(null)
    setLabel('')
    if ('error' in res) setError(res.error)
    else onChange()
  }

  async function revocar(id: string) {
    setError(null)
    const res = await revokeRepasoToken(id)
    if ('error' in res) setError(res.error)
    else onChange()
  }

  async function copiar(t: RepasoToken) {
    try {
      await navigator.clipboard.writeText(urlDe(t))
      setCopiado(t.id)
      setTimeout(() => setCopiado(null), 1800)
    } catch {
      setError('No se pudo copiar. Copia el enlace a mano.')
    }
  }

  return (
    <div className="rp-backdrop" role="dialog" aria-modal="true">
      <div className="rp-modal">
        <div className="rp-modal-head">
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>
              Compartir repasos
            </h2>
            <p style={{ fontSize: 10.5, color: '#1A1A1A60', margin: '5px 0 0', fontWeight: 300 }}>
              {proyectoNombre}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 4,
              border: '1px solid #E2E0D9', background: '#fff',
              fontSize: 15, cursor: 'pointer', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div className="rp-modal-body">
          <div style={{ marginBottom: 18 }}>
            <label className="rp-label">Etiqueta del enlace (opcional)</label>
            <input
              className="rp-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej. Construcciones Pérez · obra Goya"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
            {AUDIENCIAS.map((a) => (
              <div
                key={a.id}
                style={{
                  border: '1px solid #E8E6E0', borderRadius: 4, padding: 13,
                  background: '#FCFBF9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: '#1A1A1A', margin: 0, fontWeight: 400 }}>
                      Enlace para {a.label.toLowerCase()}
                    </p>
                    <p style={{ fontSize: 10.5, color: '#1A1A1A70', margin: '4px 0 0', fontWeight: 300, lineHeight: 1.5 }}>
                      {a.nota} Ahora mismo verá <strong>{cuenta(a.id)}</strong> repasos, y podrá
                      descargarlos en PDF desde el propio enlace.
                    </p>
                  </div>
                  <button
                    className="rp-btn rp-btn-primary"
                    disabled={creando !== null}
                    onClick={() => crear(a.id)}
                    style={{ flexShrink: 0, padding: '9px 13px', fontSize: 11.5 }}
                  >
                    {creando === a.id ? '…' : 'Generar'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <label className="rp-label">Enlaces emitidos</label>
          {tokens.length === 0 ? (
            <p style={{ fontSize: 12, color: '#1A1A1A70', fontWeight: 300, margin: '4px 0 0' }}>
              Todavía no has generado ningún enlace.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tokens.map((t) => {
                const activo = !t.revoked_at
                return (
                  <div
                    key={t.id}
                    style={{
                      border: '1px solid #E8E6E0', borderRadius: 4, padding: 11,
                      background: activo ? '#fff' : '#FAF9F6',
                      opacity: activo ? 1 : 0.65,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 9.5, padding: '2px 7px', borderRadius: 3,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          background: t.audiencia === 'cliente' ? '#5B7FA618' : '#8A622018',
                          color: t.audiencia === 'cliente' ? '#5B7FA6' : '#8A6220',
                          fontWeight: 500,
                        }}
                      >
                        {t.audiencia}
                      </span>
                      {t.label && (
                        <span style={{ fontSize: 11.5, color: '#1A1A1A', fontWeight: 300 }}>{t.label}</span>
                      )}
                      {!activo && (
                        <span style={{ fontSize: 10, color: '#B03A2E' }}>revocado</span>
                      )}
                    </div>

                    {activo && (
                      <p
                        style={{
                          fontSize: 10.5, color: '#1A1A1A80', margin: '0 0 8px',
                          fontFamily: 'ui-monospace, monospace',
                          wordBreak: 'break-all', lineHeight: 1.5,
                        }}
                      >
                        {urlDe(t)}
                      </p>
                    )}

                    <p style={{ fontSize: 10, color: '#1A1A1A55', margin: '0 0 9px' }}>
                      Creado {fmtFechaHora(t.created_at)}
                      {t.last_access
                        ? ` · último acceso ${fmtFechaHora(t.last_access)} · ${t.access_count} visitas`
                        : ' · sin accesos todavía'}
                    </p>

                    {activo && (
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button
                          className="rp-btn rp-btn-ghost"
                          onClick={() => copiar(t)}
                          style={{ padding: '7px 11px', fontSize: 11 }}
                        >
                          {copiado === t.id ? '✓ Copiado' : 'Copiar enlace'}
                        </button>
                        <a
                          className="rp-btn rp-btn-ghost"
                          href={urlDe(t)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ padding: '7px 11px', fontSize: 11, textDecoration: 'none' }}
                        >
                          Abrir
                        </a>
                        <button
                          className="rp-btn rp-btn-danger"
                          onClick={() => revocar(t.id)}
                          style={{ padding: '7px 11px', fontSize: 11 }}
                        >
                          Revocar
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {error && (
            <p
              style={{
                fontSize: 11.5, color: '#B03A2E', marginTop: 14,
                padding: '9px 11px', borderRadius: 4,
                background: '#FDF4F2', border: '1px solid #F0D5CF',
              }}
            >
              {error}
            </p>
          )}
        </div>

        <div className="rp-modal-foot">
          <button className="rp-btn rp-btn-primary" style={{ flex: 1 }} onClick={onClose}>
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
