'use client'

import { useEffect, useRef, useState } from 'react'
import { site, display } from '../theme'
import { useSite } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { pick, type ContentMap } from '@/lib/web-publica'

export interface HomeBackground {
  src: string
  srcMobile: string | null
  nombre: string | null
  ubicacion: string | null
  anio: string | null
}

const DURATION = 6800 // ms por fondo

export function HomeLanding({ content, backgrounds }: { content: ContentMap; backgrounds: HomeBackground[] }) {
  const { locale, mobile } = useSite()
  const [idx, setIdx] = useState(0)
  const [reduced, setReduced] = useState(false)

  const eyebrow = pick(content, 'hero', 'eyebrow', { locale, mobile })
  const titulo = pick(content, 'hero', 'titulo', { locale, mobile })
  const subtitulo = pick(content, 'hero', 'subtitulo', { locale, mobile })

  const has = backgrounds.length > 0

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Rotación de fondos.
  useEffect(() => {
    if (!has || backgrounds.length < 2 || reduced) return
    const t = setInterval(() => setIdx((i) => (i + 1) % backgrounds.length), DURATION)
    return () => clearInterval(t)
  }, [has, backgrounds.length, reduced])

  const current = backgrounds[idx]

  return (
    <main style={{ position: 'relative', minHeight: '100vh', background: site.color.stage, color: site.color.white, fontFamily: site.font, overflow: 'hidden' }}>
      <Hero backgrounds={backgrounds} idx={idx} mobile={mobile} reduced={reduced} />

      {/* Scrim para legibilidad del titular */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'radial-gradient(120% 90% at 50% 55%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 100%)' }} />

      {/* Titular centrado */}
      <section style={{ position: 'relative', zIndex: 3, minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: `0 ${site.gutter}` }}>
        {eyebrow && (
          <Reveal as="p" delay={0} style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase',
            color: site.color.white, opacity: 0.85, margin: '0 0 22px' }}>{eyebrow}</Reveal>
        )}
        {titulo && (
          <Reveal as="h1" delay={120} style={{ fontSize: display.hero, fontWeight: 300, lineHeight: 1.02, letterSpacing: '-0.01em', margin: 0, maxWidth: '16ch' }}>
            {titulo}
          </Reveal>
        )}
        {subtitulo && (
          <Reveal as="p" delay={260} style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.15rem)', fontWeight: 300, opacity: 0.82, margin: '24px 0 0', maxWidth: '42ch', lineHeight: 1.55 }}>
            {subtitulo}
          </Reveal>
        )}
      </section>

      {/* Caption del proyecto actual + índice */}
      {has && current && (
        <div style={{ position: 'absolute', left: site.gutter, bottom: 30, zIndex: 3, display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontSize: 11, letterSpacing: site.track.wide, fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>
            {String(idx + 1).padStart(2, '0')} / {String(backgrounds.length).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 12, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.9 }}>
            {[current.nombre, current.ubicacion].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}

      {/* Hint de scroll */}
      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 3,
        fontSize: 10, letterSpacing: site.track.wide, textTransform: 'uppercase', opacity: 0.6 }}>
        {locale === 'en' ? 'Scroll' : 'Desliza'}
      </div>

      <IntroVideo content={content} locale={locale} mobile={mobile} />
    </main>
  )
}

/** Capa de fondos con crossfade + parallax de ratón (desktop). */
function Hero({ backgrounds, idx, mobile, reduced }: { backgrounds: HomeBackground[]; idx: number; mobile: boolean; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mobile || reduced) return
    const el = ref.current
    if (!el) return
    let raf = 0
    let tx = 0, ty = 0, cx = 0, cy = 0
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * -24
      ty = (e.clientY / window.innerHeight - 0.5) * -24
    }
    const tick = () => {
      cx += (tx - cx) * 0.06
      cy += (ty - cy) * 0.06
      el.style.transform = `scale(1.06) translate(${cx}px, ${cy}px)`
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('mousemove', onMove)
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf) }
  }, [mobile, reduced])

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, zIndex: 1, transform: 'scale(1.06)', willChange: 'transform' }}>
      {backgrounds.map((b, i) => {
        const url = mobile && b.srcMobile ? b.srcMobile : b.src
        return (
          <div key={b.src + i} aria-hidden={i !== idx}
            style={{
              position: 'absolute', inset: 0, backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center',
              opacity: i === idx ? 1 : 0, transition: `opacity 1.6s ${site.ease}`,
            }} />
        )
      })}
      {backgrounds.length === 0 && <div style={{ position: 'absolute', inset: 0, background: '#111' }} />}
    </div>
  )
}

/** Vídeo de intro a pantalla completa. Se desvanece con doble clic/tap. */
function IntroVideo({ content, locale, mobile }: { content: ContentMap; locale: 'es' | 'en'; mobile: boolean }) {
  const activo = pick(content, 'intro', 'activo', { locale, mobile }).trim().toLowerCase()
  const videoUrl = pick(content, 'intro', 'video', { locale, mobile })
  const poster = pick(content, 'intro', 'poster', { locale, mobile })
  const enabled = (activo === 'si' || activo === 'sí' || activo === 'yes') && !!videoUrl

  const [show, setShow] = useState(false)
  const [fading, setFading] = useState(false)
  const lastTap = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const seen = sessionStorage.getItem('fp_intro_seen')
    if (!seen) setShow(true)
  }, [enabled])

  const dismiss = () => {
    setFading(true)
    sessionStorage.setItem('fp_intro_seen', '1')
    setTimeout(() => setShow(false), 700)
  }

  // Doble tap en táctil (dos toques < 320ms).
  const onTouchEnd = () => {
    const now = Date.now()
    if (now - lastTap.current < 320) dismiss()
    lastTap.current = now
  }

  if (!enabled || !show) return null

  return (
    <div onDoubleClick={dismiss} onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: '#000', cursor: 'pointer',
        opacity: fading ? 0 : 1, transition: `opacity .7s ${site.ease}`,
      }}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={videoUrl} poster={poster || undefined} autoPlay muted loop playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 48, pointerEvents: 'none' }}>
        <span style={{ fontSize: 11, letterSpacing: site.track.wide, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', fontFamily: site.font }}>
          {locale === 'en' ? 'Double tap to enter' : 'Doble clic para entrar'}
        </span>
      </div>
    </div>
  )
}
