'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { pick, esSi, esNo, type ContentMap } from '@/lib/web-publica'
import { IntroVideo } from './IntroVideo'

export interface HomeBackground {
  src: string
  srcMobile: string | null
  nombre: string | null
  ubicacion: string | null
  anio: string | null
  /** Slug del proyecto de esta foto: la portada entera enlaza a su ficha. */
  slug: string | null
}

const DURATION = 6800 // ms por fondo


export function HomeLanding({ content, backgrounds }: { content: ContentMap; backgrounds: HomeBackground[] }) {
  const { locale, mobile } = useSite()
  const [idx, setIdx] = useState(0)
  const [reduced, setReduced] = useState(false)

  // La Home es solo imagen: el texto está OCULTO por defecto y se recupera desde
  // el CMS (Marketing → Web pública → Home → Portada). Ocultar, no borrar: el
  // titular sigue guardado en web_content esperando a que Jose lo reactive.
  const mostrarTexto = esSi(pick(content, 'hero', 'mostrar_texto', { locale, mobile }))
  // El pie con el nombre del proyecto SÍ se muestra por defecto (solo se oculta
  // escribiendo "no"): es crédito de la foto, no titular de portada.
  const mostrarPie = !esNo(pick(content, 'hero', 'mostrar_pie', { locale, mobile }))

  const eyebrow = mostrarTexto ? pick(content, 'hero', 'eyebrow', { locale, mobile }) : ''
  const titulo = mostrarTexto ? pick(content, 'hero', 'titulo', { locale, mobile }) : ''
  const subtitulo = mostrarTexto ? pick(content, 'hero', 'subtitulo', { locale, mobile }) : ''

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

      {/* Scrim para legibilidad del titular. Sin texto no hay nada que proteger:
          se retira para que la foto se vea limpia. */}
      {mostrarTexto && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(120% 90% at 50% 55%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 100%)' }} />
      )}

      {/* La portada entera enlaza al proyecto de la foto que se está viendo. Va
          por encima del titular (que no es interactivo) y por debajo del nav. El
          destino cambia con el crossfade: el pie de abajo dice de quién es. */}
      {current?.slug && (
        <Link href={href(`/proyectos/${current.slug}`)}
          data-cursor={locale === 'en' ? 'View project' : 'Ver proyecto'}
          aria-label={[locale === 'en' ? 'View project' : 'Ver proyecto', current.nombre].filter(Boolean).join(': ')}
          style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'block' }} />
      )}

      {/* Titular centrado */}
      <section style={{ position: 'relative', zIndex: 3, minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: `0 ${site.gutter}`, pointerEvents: 'none' }}>
        {eyebrow && (
          <Reveal as="p" delay={0} style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase',
            color: site.color.white, opacity: 0.85, margin: '0 0 22px' }}>{eyebrow}</Reveal>
        )}
        {titulo && (
          <Reveal as="h1" delay={120} style={{ fontSize: display.hero, fontWeight: 300, lineHeight: 1.2, letterSpacing: '0', margin: 0, maxWidth: '22ch' }}>
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
      {mostrarPie && has && current && (
        <div style={{ position: 'absolute', left: site.gutter, bottom: 30, zIndex: 3, display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontSize: 11, letterSpacing: site.track.wide, fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>
            {String(idx + 1).padStart(2, '0')} / {String(backgrounds.length).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 12, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.9 }}>
            {[current.nombre, current.ubicacion].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}

      {/* Sin hint de scroll: la Home es una sola pantalla y no scrollea, así que
          invitaba a un gesto que no existe (retirado a petición de Jose). */}

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
