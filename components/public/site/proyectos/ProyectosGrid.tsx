'use client'

import { useState } from 'react'
import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { pick, esVideoUrl, type ContentMap, type WebProyecto } from '@/lib/web-publica'
import { Img } from '@/components/public/site/Img'
import { EsqueletoFoto } from '@/components/public/site/Esqueleto'

export function ProyectosGrid({ content, proyectos }: { content: ContentMap; proyectos: WebProyecto[] }) {
  const { locale, mobile } = useSite()
  const L = (es: string | null, en: string | null) => (locale === 'en' ? en || es : es) || ''

  const eyebrow = pick(content, 'hero', 'eyebrow', { locale, mobile })
  const titulo = pick(content, 'hero', 'titulo', { locale, mobile })
  const intro = pick(content, 'hero', 'intro', { locale, mobile })

  return (
    <main style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink, minHeight: '100vh',
      padding: `120px ${site.gutter} clamp(60px, 10vh, 120px)` }}>
      <div style={{ maxWidth: site.maxWidth, margin: '0 auto' }}>
        <header style={{ marginBottom: 'clamp(40px, 7vh, 80px)' }}>
          {eyebrow && <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', color: site.color.accent, margin: '0 0 16px' }}>{eyebrow}</Reveal>}
          {titulo && <Reveal as="h1" delay={100} style={{ fontSize: display.hero, fontWeight: 300, letterSpacing: '0', lineHeight: 1.2, margin: 0, maxWidth: '22ch' }}>{titulo}</Reveal>}
          {intro && <Reveal as="p" delay={180} style={{ fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)', fontWeight: 300, lineHeight: 1.6, opacity: 0.7, margin: '22px 0 0', maxWidth: '56ch', whiteSpace: 'pre-wrap' }}>{intro}</Reveal>}
        </header>

        {proyectos.length === 0 ? (
          <p style={{ opacity: 0.5, fontSize: 14 }}>{locale === 'en' ? 'No projects yet.' : 'Aún no hay proyectos.'}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'clamp(20px, 3vw, 44px)' }}>
            {proyectos.map((p, i) => (
              <Tarjeta key={p.id} p={p} i={i} locale={locale} L={L} />
            ))}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .proj-photo img { transition: transform .7s cubic-bezier(.16,1,.3,1); }
        .proj-card:hover .proj-photo img { transform: scale(1.05); }
        .proj-card:hover .proj-maqueta { opacity: 1; }
      ` }} />
    </main>
  )
}

/** Una tarjeta de proyecto. Es un componente aparte y no una rama del `.map()`
 *  porque necesita su propio estado: saber si SU foto ya pintó para retirar el
 *  esqueleto. */
function Tarjeta({ p, i, locale, L }: {
  p: WebProyecto
  i: number
  locale: 'es' | 'en'
  L: (es: string | null, en: string | null) => string
}) {
  const [cargada, setCargada] = useState(false)
  const tipologia = L(p.tipologia_es, p.tipologia_en) || p.nota || ''
  const meta = [p.ubicacion, p.anio].filter(Boolean).join(' · ')
  const maquetaVideo = p.media.find((m) => m.tipo === 'maqueta' && esVideoUrl(m.url))?.url

  const inner = (
    <>
      <div className="proj-photo" style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', background: '#e7e5df' }}>
        <EsqueletoFoto cargada={cargada || !p.hero_url} />
        {p.hero_url && (
          <Img src={p.hero_url} alt={p.nombre} contexto="rejillaProyectos" prioridad={i < 3}
            onLoad={() => setCargada(true)}
            style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {maquetaVideo && (
          // La maqueta orbital cobra vida al pasar el ratón por la tarjeta.
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video className="proj-maqueta" src={maquetaVideo} muted loop playsInline autoPlay preload="metadata"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0, transition: 'opacity .5s ease' }} />
        )}
      </div>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 400, margin: 0, letterSpacing: '-0.01em' }}>{p.nombre}</h2>
          {meta && <p style={{ fontSize: 12, opacity: 0.55, margin: '5px 0 0', letterSpacing: '0.02em' }}>{meta}</p>}
        </div>
        {tipologia && <span style={{ fontSize: 10, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.5, whiteSpace: 'nowrap' }}>{tipologia}</span>}
      </div>
    </>
  )

  return (
    <Reveal delay={Math.min(i, 6) * 70}>
      {p.slug ? (
        <Link href={href(`/proyectos/${p.slug}`)} className="proj-card" data-cursor={locale === 'en' ? 'View project' : 'Ver proyecto'}
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          {inner}
        </Link>
      ) : (
        <div className="proj-card">{inner}</div>
      )}
    </Reveal>
  )
}
