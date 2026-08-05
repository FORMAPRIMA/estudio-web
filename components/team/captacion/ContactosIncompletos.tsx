'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { convertirParcialEnLead, descartarParcial } from '@/app/actions/contacto'
import { resumenCualificacion, type ContactoParcial } from '@/lib/contacto'

// Contactos que empezaron el formulario de la web y no lo enviaron. Se capturan
// al salir de cada campo (app/actions/contacto.ts) y NO han recibido nada nuestro:
// ni correo de bienvenida ni Espacio. Son leads recuperables con una llamada.
//
// Se borran solos a los 30 días (cron leads-incompletos) — el aviso del formulario
// promete eso, así que aquí solo se decide: convertir en lead o descartar.

const INK = '#1A1A1A'
const BORDER = '#F0EEE8'
const ORANGE = '#D85A30'

export default function ContactosIncompletos({ parciales }: { parciales: ContactoParcial[] }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (parciales.length === 0) return null

  const actuar = (fn: () => Promise<{ success: true } | { error: string }>) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if ('error' in res) { setError(res.error); return }
      router.refresh()
    })
  }

  const hace = (iso: string) => {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (min < 60) return `hace ${min} min`
    const h = Math.round(min / 60)
    if (h < 24) return `hace ${h} h`
    return `hace ${Math.round(h / 24)} d`
  }

  return (
    <div style={{ margin: '0 0 24px', border: `1px solid ${BORDER}`, borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
      <button onClick={() => setAbierto((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 11, color: ORANGE }}>{abierto ? '▾' : '▸'}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: INK }}>Contactos a medias desde la web</span>
        <span style={{ fontSize: 11, background: '#FFF6E5', border: '1px solid #F0E0BC', color: '#8a5a00', borderRadius: 99, padding: '2px 9px' }}>
          {parciales.length}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: `${INK}55` }}>No han recibido ningún correo nuestro</span>
      </button>

      {abierto && (
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          {error && <p style={{ color: '#b3261e', fontSize: 12, margin: 0, padding: '10px 18px' }}>{error}</p>}
          {parciales.map((p) => {
            const resumen = resumenCualificacion(p)
            return (
              <div key={p.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '14px 18px', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, color: INK }}>
                    {p.nombre || <span style={{ color: `${INK}55` }}>Sin nombre</span>}
                    {p.empresa && <span style={{ color: `${INK}60` }}> · {p.empresa}</span>}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: `${INK}90` }}>
                    {[p.email, p.telefono].filter(Boolean).join(' · ')}
                  </p>
                  {resumen && <p style={{ margin: '4px 0 0', fontSize: 12, color: `${INK}70` }}>{resumen}</p>}
                  {p.mensaje && <p style={{ margin: '6px 0 0', fontSize: 12, color: `${INK}70`, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{p.mensaje}</p>}
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: `${INK}45` }}>
                    Lo dejó {hace(p.updated_at)} · idioma {p.idioma === 'en' ? 'inglés' : 'español'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                  <button onClick={() => actuar(() => convertirParcialEnLead(p.id))} disabled={isPending}
                    style={{ padding: '8px 14px', background: INK, color: '#fff', border: 'none', borderRadius: 4, fontSize: 11.5, cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                    Convertir en lead
                  </button>
                  <button onClick={() => { if (confirm('¿Descartar este contacto? Se borra del todo.')) actuar(() => descartarParcial(p.id)) }} disabled={isPending}
                    style={{ padding: '8px 12px', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 11.5, color: `${INK}70`, cursor: isPending ? 'default' : 'pointer' }}>
                    Descartar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
