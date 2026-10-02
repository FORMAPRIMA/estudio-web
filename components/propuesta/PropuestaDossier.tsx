'use client'

// Marco de un dossier interactivo ('dc'). El dossier corre con su propio runtime
// dentro de un iframe (/propuesta/<slug>/deck, mismo origen); esta página:
//   · lo encaja: en móvil a pantalla completa, con el lienzo estirado a la
//     proporción de la pantalla; en escritorio, como una historia vertical
//     centrada sobre la portada desenfocada, con una columna de contexto;
//   · escucha su puente (postMessage): diapositiva actual e idioma, y el botón
//     "Me interesa" de la diapositiva final, que abre aquí el formulario;
//   · avisa al equipo al abrirlo y al llegar al final.
//
// Un dossier 'horizontal' (presentación 1920×1080, p. ej. Torre del Mangle) va
// siempre a pantalla completa —deck-stage lo encaja con bandas— y en un móvil
// en vertical pide girarlo. Su final pide ACEPTAR la propuesta.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { aceptarPropuestaWeb, progresoPropuestaWeb, registrarEventoPropuestaWeb, registrarInteresPropuestaWeb } from '@/app/actions/propuestasWeb'

interface Tema { fondo: string; tinta: string; acento: string; claro: boolean }

interface Props {
  slug: string
  proyecto: string
  descripcion: string
  portada: string
  tema: Tema
  logo: string
  formato?: 'vertical' | 'horizontal'
}

type Idioma = 'es' | 'en'

const T = {
  es: {
    titulo: 'Me interesa', sub: 'Te llamamos para enseñarte el piso y preparar tu diseño.',
    nombre: 'Nombre', email: 'Email', telefono: 'Teléfono', o: 'Email o teléfono, al menos uno.',
    distribucion: 'Distribución', nivel: 'Nivel de calidad', nose: 'Aún no lo sé',
    mensaje: '¿Algo que quieras contarnos? (opcional)',
    privacidad: ['He leído y acepto la ', 'política de privacidad', '.'],
    enviar: 'Enviar', enviando: 'Enviando…', cerrar: 'Cerrar',
    hecho: 'Recibido. Gracias.', hechoSub: 'Te llamamos muy pronto para organizar la visita.',
  },
  en: {
    titulo: 'I’m interested', sub: 'We will call you to show you the apartment and prepare your design.',
    nombre: 'Name', email: 'Email', telefono: 'Phone', o: 'Email or phone, at least one.',
    distribucion: 'Layout', nivel: 'Quality level', nose: 'Not sure yet',
    mensaje: 'Anything you would like to tell us? (optional)',
    privacidad: ['I have read and accept the ', 'privacy policy', '.'],
    enviar: 'Send', enviando: 'Sending…', cerrar: 'Close',
    hecho: 'Received. Thank you.', hechoSub: 'We will call you very soon to arrange a visit.',
  },
}

function modoEscritorio() {
  return window.innerWidth >= 900 && window.innerWidth > window.innerHeight
}

export default function PropuestaDossier({ slug, proyecto, descripcion, portada, tema, logo, formato = 'vertical' }: Props) {
  const horizontal = formato === 'horizontal'
  const iframe = useRef<HTMLIFrameElement>(null)
  const [escritorio, setEscritorio] = useState<boolean | null>(null)
  const [src, setSrc] = useState('')
  const [idioma, setIdioma] = useState<Idioma>('es')
  const [formulario, setFormulario] = useState(false)
  const finalAvisado = useRef(false)
  const progreso = useRef<{ max: number; n: number; l: string; t?: ReturnType<typeof setTimeout> }>({ max: 0, n: 0, l: '' })

  // Mientras la tiene abierta y a la vista, un latido por minuto: así la visita
  // sabe cuánto duró aunque se quede leyendo una sola diapositiva.
  useEffect(() => {
    const id = setInterval(() => {
      const pr = progreso.current
      if (document.visibilityState === 'visible' && pr.n) progresoPropuestaWeb(slug, pr.max, pr.n, pr.l).catch(() => {})
    }, 60_000)
    return () => clearInterval(id)
  }, [slug])

  // Encaje: se decide al montar y solo se recarga si se cruza de móvil a escritorio.
  const modo = useRef<boolean | null>(null)
  useEffect(() => {
    const decidir = () => {
      const esc = horizontal || modoEscritorio()
      if (modo.current === esc) return
      modo.current = esc
      const alto = esc ? 1920 : Math.max(1920, Math.round((1080 * window.innerHeight) / window.innerWidth))
      setEscritorio(esc)
      setSrc(horizontal ? `/propuesta/${slug}/deck` : `/propuesta/${slug}/deck?alto=${alto}`)
    }
    decidir()
    let t: ReturnType<typeof setTimeout>
    const alCambiar = () => { clearTimeout(t); t = setTimeout(decidir, 250) }
    window.addEventListener('resize', alCambiar)
    registrarEventoPropuestaWeb(slug, 'abierta').catch(() => {})
    return () => { clearTimeout(t); window.removeEventListener('resize', alCambiar) }
  }, [slug, horizontal])

  // Sin zoom con los dedos también en la página que contiene el iframe (iOS
  // ignora user-scalable=no; gesturestart sí se puede cancelar).
  useEffect(() => {
    const no = (e: Event) => e.preventDefault()
    const dos = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault() }
    document.addEventListener('gesturestart', no, { passive: false })
    document.addEventListener('touchmove', dos, { passive: false })
    return () => { document.removeEventListener('gesturestart', no); document.removeEventListener('touchmove', dos) }
  }, [])

  // Puente con el dossier.
  useEffect(() => {
    const recibir = (e: MessageEvent) => {
      if (e.origin !== location.origin || !e.data || !e.data.fp) return
      const m = e.data as { t: string; i?: number; n?: number; l?: string; lang?: string }
      if (m.lang === 'en' || m.lang === 'es') setIdioma(m.lang)
      if (m.t === 'slide' && typeof m.i === 'number' && m.n) {
        // Seguimiento de la visita: la diapositiva más lejana, sin esperar a irse.
        const pr = progreso.current
        pr.n = m.n
        if (m.i > pr.max) {
          pr.max = m.i; pr.l = m.l ?? ''
          clearTimeout(pr.t)
          pr.t = setTimeout(() => { progresoPropuestaWeb(slug, pr.max, pr.n, pr.l).catch(() => {}) }, 1500)
        }
      }
      if (m.t === 'slide' && m.n && m.i === m.n - 1 && !finalAvisado.current) {
        finalAvisado.current = true
        registrarEventoPropuestaWeb(slug, 'final').catch(() => {})
      }
      if (m.t === 'interes') setFormulario(true)
      if (m.t === 'aceptar') {
        const w = e.source as Window | null
        const responder = (r: object) => w?.postMessage({ fp: 1, ...r }, location.origin)
        aceptarPropuestaWeb(slug, String((m as { comentario?: string }).comentario ?? ''))
          .then((r) => responder(r.ok ? { t: 'aceptada' } : { t: 'error', msg: r.error }))
          .catch(() => responder({ t: 'error' }))
      }
    }
    window.addEventListener('message', recibir)
    return () => window.removeEventListener('message', recibir)
  }, [slug])

  // En escritorio, las flechas funcionan aunque el foco esté fuera del iframe.
  useEffect(() => {
    if (!escritorio) return
    const tecla = (e: KeyboardEvent) => {
      if (formulario) return
      const w = iframe.current?.contentWindow
      if (!w || document.activeElement === iframe.current) return
      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) {
        e.preventDefault()
        w.document.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, bubbles: true, cancelable: true }))
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [escritorio, formulario])

  const alCargar = useCallback(() => { if (horizontal || modoEscritorio()) iframe.current?.contentWindow?.focus() }, [horizontal])

  const marcarHecho = useCallback(() => {
    iframe.current?.contentWindow?.postMessage({ fp: 1, t: 'hecho' }, location.origin)
  }, [])

  const serif = "'Cormorant Garamond', serif"
  const marco = src && (
    <iframe
      ref={iframe}
      src={src}
      title={proyecto}
      onLoad={alCargar}
      allow="autoplay; fullscreen"
      style={{ width: '100%', height: '100%', border: 0, display: 'block', background: tema.fondo }}
    />
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: tema.fondo, color: tema.tinta, fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `html,body{background:${tema.fondo}!important;overscroll-behavior:none;}` }} />
      {escritorio === false && <div style={{ position: 'fixed', inset: 0 }}>{marco}</div>}

      {escritorio && horizontal && (
        <div style={{ position: 'fixed', inset: 0 }}>
          {marco}
          {/* En un móvil en vertical la presentación no se lee: se tapa hasta que lo giren
              (Safari no deja bloquear la orientación desde una web). */}
          <div className="fpd-girar" role="dialog" aria-label="Gira el móvil para ver la propuesta">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portada} alt="" aria-hidden="true" className="fpd-girar-fondo" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="Forma Prima" style={{ height: 15, width: 'auto', opacity: 0.85 }} />
            <div className="fpd-girar-centro">
              <svg className="fpd-girar-movil" width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                <rect x="20" y="6" width="24" height="52" rx="5" stroke="currentColor" strokeWidth="1.2" />
                <line x1="29" y1="11" x2="35" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <div className="fpd-girar-ante">Propuesta de honorarios</div>
              <div className="fpd-girar-titulo">{proyecto}</div>
              <div className="fpd-girar-linea" />
              <p className="fpd-girar-texto">Para explorar esta propuesta,<br />gira tu iPhone en horizontal.</p>
            </div>
            <p className="fpd-girar-pie">¿No gira la pantalla? Desactiva el bloqueo de rotación en el Centro de control.</p>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
.fpd-girar{display:none}
@media (orientation:portrait) and (max-width:600px){
  .fpd-girar{display:flex;position:fixed;inset:0;z-index:30;flex-direction:column;align-items:center;justify-content:space-between;
    padding:calc(env(safe-area-inset-top) + 40px) 32px calc(env(safe-area-inset-bottom) + 32px);background:${tema.fondo};color:${tema.tinta};
    font-family:'Hanken Grotesk',sans-serif;text-align:center;overflow:hidden;animation:fpd-in .8s cubic-bezier(.4,0,.2,1) both}
  .fpd-girar > *{position:relative}
  .fpd-girar-fondo{position:absolute!important;inset:-40px;width:calc(100% + 80px);height:calc(100% + 80px);max-width:none;object-fit:cover;
    filter:blur(30px) saturate(.7);opacity:.28;transform:scale(1.05)}
  .fpd-girar-centro{display:flex;flex-direction:column;align-items:center}
  .fpd-girar-movil{color:${tema.acento};margin-bottom:40px;transform-origin:50% 50%;animation:fpd-rot 3.2s cubic-bezier(.65,0,.35,1) .9s infinite}
  .fpd-girar-ante{font-family:'Newsreader',serif;font-style:italic;font-size:17px;color:${tema.acento}}
  .fpd-girar-titulo{margin-top:14px;font-size:44px;font-weight:200;letter-spacing:-.03em;line-height:1.02}
  .fpd-girar-linea{width:48px;height:1px;background:${tema.acento};margin:30px 0 26px}
  .fpd-girar-texto{margin:0;font-size:16px;font-weight:300;line-height:1.55;opacity:.8}
  .fpd-girar-pie{margin:0;max-width:280px;font-size:11px;font-weight:300;line-height:1.5;opacity:.42}
}
@keyframes fpd-in{from{opacity:0}to{opacity:1}}
@keyframes fpd-rot{0%,22%{transform:rotate(0)}48%,78%{transform:rotate(-90deg)}100%{transform:rotate(0)}}
@media (prefers-reduced-motion:reduce){.fpd-girar-movil{animation:none!important}}` }} />
        </div>
      )}

      {escritorio && !horizontal && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portada} alt="" aria-hidden="true" style={{ position: 'absolute', inset: -60, width: 'calc(100% + 120px)', height: 'calc(100% + 120px)', maxWidth: 'none', objectFit: 'cover', filter: 'blur(38px) saturate(.8)', opacity: tema.claro ? 0.55 : 0.4 }} />
          <div style={{ position: 'absolute', inset: 0, background: tema.claro ? 'rgba(246,241,234,.55)' : 'rgba(13,13,13,.55)' }} />
          <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 72, padding: 32 }}>
            <aside className="fpd-lado" style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 28 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="Forma Prima" style={{ height: 16, width: 'auto', alignSelf: 'flex-start' }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.28em', textTransform: 'uppercase', color: tema.acento }}>Dossier</div>
                <h1 style={{ margin: '14px 0 0', fontFamily: serif, fontSize: 56, fontWeight: 500, lineHeight: 1 }}>{proyecto}</h1>
                <p style={{ margin: '18px 0 0', fontSize: 15, fontWeight: 300, lineHeight: 1.55, opacity: 0.75 }}>{descripcion}</p>
              </div>
              <div style={{ borderTop: `1px solid ${tema.claro ? 'rgba(43,38,34,.18)' : 'rgba(251,251,250,.18)'}`, paddingTop: 20, fontSize: 13, fontWeight: 300, lineHeight: 1.6, opacity: 0.7 }}>
                {idioma === 'en'
                  ? <>Move through it with the mouse wheel or the <b style={{ fontWeight: 500 }}>← →</b> keys.<br />Best on your phone: open this same link there.</>
                  : <>Avanza con la rueda del ratón o las flechas <b style={{ fontWeight: 500 }}>← →</b>.<br />Se disfruta más en el móvil: abre este mismo enlace allí.</>}
              </div>
            </aside>
            <div style={{ height: 'calc(100vh - 64px)', aspectRatio: '9 / 16', boxShadow: '0 30px 80px rgba(43,38,34,.28)', overflow: 'hidden', flex: 'none' }}>{marco}</div>
            <div className="fpd-lado" style={{ width: 300 }} aria-hidden="true" />
          </div>
          <style dangerouslySetInnerHTML={{ __html: '@media (max-width:1180px){.fpd-lado{display:none!important}}' }} />
        </>
      )}

      {formulario && (
        <Formulario
          slug={slug}
          idioma={idioma}
          tema={tema}
          serif={serif}
          alCerrar={() => { setFormulario(false); if (modoEscritorio()) iframe.current?.contentWindow?.focus() }}
          alEnviar={marcarHecho}
        />
      )}
    </div>
  )
}

function Formulario({ slug, idioma, tema, serif, alCerrar, alEnviar }: {
  slug: string; idioma: Idioma; tema: Tema; serif: string; alCerrar: () => void; alEnviar: () => void
}) {
  const t = T[idioma]
  const [f, setF] = useState({ web: '', nombre: '', email: '', telefono: '', distribucion: '', nivel: '', mensaje: '', privacidad: false })
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'hecho'>('idle')
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? !!e.target.checked : e.target.value }))

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setEstado('enviando'); setError(null)
    const r = await registrarInteresPropuestaWeb(slug, { ...f, idioma })
    if (r.ok) { setEstado('hecho'); alEnviar() } else { setEstado('idle'); setError(r.error ?? '') }
  }

  const linea = tema.claro ? 'rgba(43,38,34,.22)' : 'rgba(251,251,250,.22)'
  const campo: CSSProperties = {
    width: '100%', fontFamily: 'inherit', fontSize: 16, fontWeight: 300, color: tema.tinta, background: 'transparent',
    border: 0, borderBottom: `1px solid ${linea}`, borderRadius: 0, padding: '12px 0', outline: 'none', appearance: 'none',
  }
  const etiqueta: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', color: tema.acento }
  const boton: CSSProperties = {
    width: '100%', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, letterSpacing: '.22em', textTransform: 'uppercase',
    padding: '18px 24px', cursor: 'pointer', background: tema.tinta, color: tema.fondo, border: `1px solid ${tema.tinta}`, borderRadius: 0,
  }

  return (
    <div role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget && estado !== 'enviando') alCerrar() }}
      style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(43,38,34,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fpf-in .3s ease both' }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes fpf-in{from{opacity:0}to{opacity:1}}@keyframes fpf-up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}@media (min-width:700px){.fpf-panel{margin-bottom:auto!important;margin-top:auto!important}}' }} />
      <div className="fpf-panel" style={{ width: '100%', maxWidth: 520, maxHeight: '92dvh', overflowY: 'auto', background: tema.fondo, color: tema.tinta, padding: '32px 28px calc(28px + env(safe-area-inset-bottom))', animation: 'fpf-up .45s cubic-bezier(.16,1,.3,1) both' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <h2 style={{ margin: 0, fontFamily: serif, fontSize: 40, fontWeight: 500, lineHeight: 1 }}>{estado === 'hecho' ? t.hecho : t.titulo}</h2>
          <button type="button" onClick={alCerrar} aria-label={t.cerrar} disabled={estado === 'enviando'}
            style={{ background: 'none', border: 0, fontSize: 26, lineHeight: 1, color: tema.tinta, opacity: 0.6, cursor: 'pointer', padding: 4 }}>×</button>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 15, fontWeight: 300, lineHeight: 1.5, opacity: 0.75 }}>{estado === 'hecho' ? t.hechoSub : t.sub}</p>

        {estado === 'hecho' ? (
          <button type="button" onClick={alCerrar} style={{ ...boton, marginTop: 28 }}>{t.cerrar}</button>
        ) : (
          <form onSubmit={enviar} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Trampa para bots: invisible para las personas. */}
            <input type="text" name="web" value={f.web} onChange={set('web')} tabIndex={-1} autoComplete="off" aria-hidden="true"
              style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
            <label><span style={etiqueta}>{t.nombre}</span><input style={campo} value={f.nombre} onChange={set('nombre')} autoComplete="name" required /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label><span style={etiqueta}>{t.email}</span><input style={campo} type="email" value={f.email} onChange={set('email')} autoComplete="email" inputMode="email" /></label>
              <label><span style={etiqueta}>{t.telefono}</span><input style={campo} type="tel" value={f.telefono} onChange={set('telefono')} autoComplete="tel" inputMode="tel" /></label>
            </div>
            <div style={{ marginTop: -10, fontSize: 12, fontWeight: 300, opacity: 0.6 }}>{t.o}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label><span style={etiqueta}>{t.distribucion}</span>
                <select style={campo} value={f.distribucion} onChange={set('distribucion')}>
                  <option value="">{t.nose}</option><option value="01">01</option><option value="02">02</option><option value="03">03</option>
                </select>
              </label>
              <label><span style={etiqueta}>{t.nivel}</span>
                <select style={campo} value={f.nivel} onChange={set('nivel')}>
                  <option value="">{t.nose}</option><option>Functional</option><option>Select</option><option>Masterpiece</option>
                </select>
              </label>
            </div>
            <label><span style={etiqueta}>{t.mensaje}</span><textarea style={{ ...campo, resize: 'none' }} rows={2} value={f.mensaje} onChange={set('mensaje')} /></label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, fontWeight: 300, lineHeight: 1.45 }}>
              <input type="checkbox" checked={f.privacidad} onChange={set('privacidad')} required style={{ marginTop: 3, accentColor: tema.acento }} />
              <span>{t.privacidad[0]}<a href="/privacidad" target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>{t.privacidad[1]}</a>{t.privacidad[2]}</span>
            </label>
            {error && <div style={{ fontSize: 13, color: '#a4453a' }}>{error}</div>}
            <button type="submit" disabled={estado === 'enviando'} style={{ ...boton, opacity: estado === 'enviando' ? 0.6 : 1 }}>{estado === 'enviando' ? t.enviando : t.enviar}</button>
          </form>
        )}
      </div>
    </div>
  )
}
