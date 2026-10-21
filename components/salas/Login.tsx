'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { entrarSalas } from '@/app/actions/salas'
import { urlInternal } from '@/lib/salas/puente-url'
import { S } from './theme'

export default function Login() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [estado, setEstado] = useState<'idle' | 'comprobando' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const [internal, setInternal] = useState('https://internal.formaprima.es')
  const [paseCaducado, setPaseCaducado] = useState(false)
  useEffect(() => {
    setInternal(urlInternal(window.location.host))
    setPaseCaducado(new URLSearchParams(window.location.search).get('pase') === 'caducado')
  }, [])

  const enviar = async (v: string) => {
    if (v.length !== 8 || estado === 'comprobando') return
    setEstado('comprobando')
    const r = await entrarSalas(v)
    if (r.ok) { router.refresh(); return }
    setEstado('error'); setMsg(r.error); setCodigo(''); ref.current?.focus()
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: S.bg, padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/propuestas/logo-fp-negro.png" alt="Forma Prima" style={{ height: 18, width: 'auto', display: 'block' }} />
        <p style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: S.accent, fontWeight: 600, margin: '36px 0 10px' }}>Salas</p>
        <h1 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em', margin: 0, color: S.ink }}>Acceso privado</h1>
        <p style={{ fontSize: 14, color: S.soft, margin: '10px 0 28px', lineHeight: 1.5 }}>Introduce tu código personal de 8 cifras.</p>
        <form onSubmit={(e) => { e.preventDefault(); enviar(codigo) }}>
          <input
            ref={ref}
            autoFocus
            value={codigo.replace(/(\d{4})(?=\d)/, '$1 ')}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 8)
              setCodigo(v); if (estado === 'error') setEstado('idle')
              if (v.length === 8) enviar(v)
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Código personal"
            placeholder="0000 0000"
            style={{
              width: '100%', boxSizing: 'border-box', fontSize: 28, letterSpacing: '0.2em', fontWeight: 300, padding: '14px 16px',
              border: `1px solid ${estado === 'error' ? S.red : S.line}`, borderRadius: 8, background: S.panel, color: S.ink,
              fontFamily: 'inherit', outline: 'none', fontVariantNumeric: 'tabular-nums', textAlign: 'center',
            }}
          />
        </form>
        <p role="status" style={{ minHeight: 20, fontSize: 13, margin: '12px 0 0', color: estado === 'error' || paseCaducado ? S.red : S.soft }}>
          {estado === 'comprobando' ? 'Comprobando…' : estado === 'error' ? msg : paseCaducado ? 'El acceso con tu cuenta ha caducado. Vuelve a intentarlo.' : ''}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 18px', color: S.faint, fontSize: 12 }}>
          <span style={{ flex: 1, height: 1, background: S.line }} />o<span style={{ flex: 1, height: 1, background: S.line }} />
        </div>
        <a href={`${internal}/team/salas`} style={{
          display: 'block', textAlign: 'center', padding: '13px 16px', border: `1px solid ${S.line}`, borderRadius: 8, background: S.panel,
          color: S.ink, fontSize: 14, textDecoration: 'none', fontWeight: 500,
        }}>
          Entrar con mi cuenta de Forma Prima
        </a>
        <p style={{ fontSize: 12, color: S.soft, margin: '8px 0 0', lineHeight: 1.5, textAlign: 'center' }}>Para el equipo del estudio: usa tu acceso de internal.</p>
        <p style={{ fontSize: 12, color: S.faint, marginTop: 40, lineHeight: 1.6 }}>
          ¿No tienes código? Pídeselo a Forma Prima en <a href="mailto:contacto@formaprima.es" style={{ color: 'inherit' }}>contacto@formaprima.es</a>.
        </p>
      </div>
    </main>
  )
}
