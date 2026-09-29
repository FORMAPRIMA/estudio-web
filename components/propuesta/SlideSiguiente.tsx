'use client'

// Última diapositiva: la que no viene del diseño. Convierte el "Gracias." del
// cierre en un siguiente paso —aceptar o preguntar— y abre la puerta a la web
// del estudio con las obras publicadas. Mismo lenguaje que el resto del deck
// (Hanken Grotesk, #0d0d0d / #fbfbfa / verde #8fa596), en las dos medidas.

import { useState, type CSSProperties } from 'react'
import { aceptarPropuestaWeb } from '@/app/actions/propuestasWeb'

export interface ProyectoEnlace {
  slug: string
  nombre: string
  ubicacion: string | null
  imagen: string
}

interface Props {
  variante: 'desktop' | 'mobile'
  slug: string
  nombreCliente: string
  proyecto: string
  numero: string
  proyectos: ProyectoEnlace[]
}

const INK = '#0d0d0d'
const PAPER = '#fbfbfa'
const SAGE = '#8fa596'
const WEB = 'https://formaprima.es'
const EMAIL = 'contacto@formaprima.es'

type Estado = 'idle' | 'confirmando' | 'enviando' | 'hecho'

export default function SlideSiguiente({ variante, slug, nombreCliente, proyecto, numero, proyectos }: Props) {
  const m = variante === 'mobile'
  const [estado, setEstado] = useState<Estado>('idle')
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Escala tipográfica: el diseño móvil trabaja a ~1,6× el de escritorio.
  const px = (d: number, mo: number) => (m ? mo : d)

  const eyebrow: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: px(10, 14), fontSize: px(14, 28), fontWeight: 400, color: SAGE }
  const boton: CSSProperties = {
    appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: px(14, 26), fontWeight: 500, letterSpacing: '.2em', textTransform: 'uppercase',
    padding: m ? '40px 48px' : '24px 40px', borderRadius: 0,
    textAlign: 'center', textDecoration: 'none', display: 'inline-block', transition: 'background .25s, color .25s, border-color .25s',
  }
  const primario: CSSProperties = { ...boton, background: PAPER, color: INK, border: `1px solid ${PAPER}` }
  const secundario: CSSProperties = { ...boton, background: 'transparent', color: PAPER, border: '1px solid rgba(251,251,250,.32)' }

  const aceptar = async () => {
    setEstado('enviando')
    setError(null)
    const r = await aceptarPropuestaWeb(slug, comentario)
    if (r.ok) setEstado('hecho')
    else { setEstado('confirmando'); setError(r.error ?? 'No se ha podido enviar. Inténtalo de nuevo.') }
  }

  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent(`Propuesta de honorarios · ${proyecto}`)}`

  const acciones = (() => {
    if (estado === 'hecho') {
      return (
        <div style={{ borderTop: `1px solid ${SAGE}`, paddingTop: px(28, 40) }}>
          <div style={{ fontSize: px(34, 56), fontWeight: 200, letterSpacing: '-.02em', lineHeight: 1.1 }}>Recibido, {nombreCliente}.</div>
          <p style={{ margin: `${px(14, 20)}px 0 0`, fontSize: px(18, 30), fontWeight: 300, lineHeight: 1.5, opacity: 0.7 }}>
            Te escribimos hoy mismo con el documento para firmar y la fecha de arranque.
          </p>
        </div>
      )
    }
    if (estado === 'confirmando' || estado === 'enviando') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: px(18, 28) }}>
          <div style={{ fontSize: px(18, 30), fontWeight: 300, lineHeight: 1.45, opacity: 0.85 }}>
            Vas a aceptar la propuesta de honorarios de {proyecto}.
          </div>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="¿Quieres comentarnos algo? (opcional)"
            rows={m ? 3 : 2}
            style={{
              fontFamily: 'inherit', fontSize: px(16, 28), fontWeight: 300, color: PAPER, lineHeight: 1.45,
              background: 'rgba(251,251,250,.04)', border: '1px solid rgba(251,251,250,.2)', borderRadius: 0,
              padding: px(16, 28), resize: 'none', outline: 'none',
            }}
          />
          {error && <div style={{ fontSize: px(14, 24), color: '#e0a39a' }}>{error}</div>}
          <div style={{ display: 'flex', flexDirection: m ? 'column' : 'row', gap: px(16, 20) }}>
            <button type="button" style={{ ...primario, opacity: estado === 'enviando' ? 0.6 : 1 }} disabled={estado === 'enviando'} onClick={aceptar}>
              {estado === 'enviando' ? 'Enviando…' : 'Confirmar aceptación'}
            </button>
            <button type="button" style={secundario} disabled={estado === 'enviando'} onClick={() => { setEstado('idle'); setError(null) }}>
              Volver
            </button>
          </div>
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: m ? 'column' : 'row', gap: px(16, 20) }}>
        <button type="button" className="fpp-btn-p" style={primario} onClick={() => setEstado('confirmando')}>Aceptar propuesta</button>
        <a className="fpp-btn-s" style={secundario} href={mailto}>Tengo dudas · escríbenos</a>
      </div>
    )
  })()

  const tarjetas = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: px(28, 32) }}>
      {proyectos.map((p) => (
        <a key={p.slug} className="fpp-card" href={`${WEB}/proyectos/${p.slug}`} target="_blank" rel="noopener"
          style={{ color: PAPER, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: px(14, 18) }}>
          <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: m ? '16 / 11' : '16 / 10', background: '#1a1a1a' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imagen} alt={p.nombre} loading="lazy" decoding="async"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'saturate(.75)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: m ? 'column' : 'row', justifyContent: 'space-between', alignItems: m ? 'flex-start' : 'baseline', gap: m ? 4 : 12 }}>
            <span style={{ fontSize: px(18, 30), fontWeight: 400, letterSpacing: '-.005em' }}>{p.nombre}</span>
            <span style={{ fontSize: px(13, 22), fontWeight: 300, opacity: 0.55, whiteSpace: 'nowrap' }}>{p.ubicacion}</span>
          </div>
        </a>
      ))}
    </div>
  )

  const visitar = (
    <a className="fpp-web" href={WEB} target="_blank" rel="noopener"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: PAPER, textDecoration: 'none',
        borderTop: '1px solid rgba(251,251,250,.18)', paddingTop: px(22, 32) }}>
      <span style={{ fontSize: px(30, 48), fontWeight: 200, letterSpacing: '-.025em' }}>Visitar formaprima.es</span>
      <span className="fpp-flecha" style={{ fontSize: px(30, 48), fontWeight: 200, color: SAGE }}>→</span>
    </a>
  )

  const logo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/propuestas/logo-fp.png" alt="Forma Prima" style={{ height: px(20, 30), width: 'auto', display: 'block', opacity: 0.7 }} />
  )

  const titular = (
    <div>
      <h2 style={{ margin: 0, fontSize: px(88, 112), fontWeight: 200, letterSpacing: '-.035em', lineHeight: 0.98 }}>
        ¿Empezamos,<br />{nombreCliente}?
      </h2>
      <div style={{ width: px(64, 80), height: 1, background: SAGE, margin: `${px(40, 52)}px 0 ${px(28, 36)}px` }} />
      <p style={{ margin: 0, maxWidth: px(620, 900), fontSize: px(22, 32), fontWeight: 300, lineHeight: 1.5, opacity: 0.75 }}>
        Si la propuesta encaja, acéptala aquí. Te escribimos hoy mismo para enviarte el documento a firma y fijar la fecha de arranque.
      </p>
    </div>
  )

  const estudio = (
    <div style={{ fontSize: px(14, 22), fontWeight: 300, lineHeight: 1.6, opacity: 0.5 }}>
      <a href={`mailto:${EMAIL}`} style={{ color: 'inherit', textDecoration: 'none' }}>{EMAIL}</a> · Príncipe de Vergara 56, Madrid
    </div>
  )

  if (m) {
    return (
      <section data-label="Siguiente paso" style={{ background: INK, color: PAPER, fontFamily: "'Hanken Grotesk',sans-serif", display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '96px 72px 88px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={eyebrow}><span style={{ opacity: 0.45 }}>{numero}</span>Siguiente paso</span>
          {logo}
        </div>
        {titular}
        {acciones}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36, paddingTop: 24 }}>
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', color: SAGE }}>Mientras tanto, conoce el estudio</span>
          {tarjetas}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {visitar}
          {estudio}
        </div>
      </section>
    )
  }

  return (
    <section data-label="Siguiente paso" style={{ background: INK, color: PAPER, fontFamily: "'Hanken Grotesk',sans-serif", display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)' }}>
      <div style={{ padding: '96px 88px 96px 104px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
        <span style={eyebrow}><span style={{ opacity: 0.45 }}>{numero}</span>Siguiente paso</span>
        {titular}
        {acciones}
        {estudio}
      </div>
      <div style={{ background: '#141414', padding: '96px 104px 96px 88px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 40, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.22em', textTransform: 'uppercase', color: SAGE }}>Mientras tanto, conoce el estudio</span>
          {logo}
        </div>
        {tarjetas}
        {visitar}
      </div>
    </section>
  )
}
