'use client'

import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { pick, type ContentMap } from '@/lib/web-publica'
import type { WebEquipo } from '@/lib/web-equipo'

export function EstudioPage({ content, equipo }: { content: ContentMap; equipo: WebEquipo[] }) {
  const { locale, mobile } = useSite()
  const L = (es: string | null, en: string | null) => (locale === 'en' ? en || es : es) || ''

  const heroImg = pick(content, 'hero', 'imagen', { locale, mobile })
  const heroEyebrow = pick(content, 'hero', 'eyebrow', { locale, mobile })
  const heroTitulo = pick(content, 'hero', 'titulo', { locale, mobile })

  const eqEyebrow = pick(content, 'equipo', 'eyebrow', { locale, mobile })
  const eqTitulo = pick(content, 'equipo', 'titulo', { locale, mobile })
  const eqIntro = pick(content, 'equipo', 'intro', { locale, mobile })

  return (
    <div style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink }}>
      {/* Hero widescreen del equipo */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'flex-end',
        background: site.color.stage, color: site.color.white, overflow: 'hidden' }}>
        {heroImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 2, padding: `0 ${site.gutter} 80px`, maxWidth: site.maxWidth, width: '100%', margin: '0 auto' }}>
          {heroEyebrow && (
            <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', opacity: 0.85, margin: '0 0 16px' }}>{heroEyebrow}</Reveal>
          )}
          {heroTitulo && (
            <Reveal as="h1" delay={120} style={{ fontSize: display.hero, fontWeight: 300, lineHeight: 1.2, letterSpacing: '0', margin: 0, maxWidth: '24ch' }}>{heroTitulo}</Reveal>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 2, fontSize: 10, letterSpacing: site.track.wide, textTransform: 'uppercase', opacity: 0.6 }}>
          {locale === 'en' ? 'Scroll' : 'Desliza'}
        </div>
      </section>

      {/* Grid del equipo. El id es el destino del «← Equipo» de la ficha de cada
          integrante: sin él se volvía al hero y parecía que el botón no hacía nada.
          scrollMarginTop deja hueco para el nav fijo (72 px). */}
      <section id="equipo" style={{ maxWidth: site.maxWidth, margin: '0 auto', padding: `clamp(64px, 10vh, 130px) ${site.gutter}`, scrollMarginTop: 92 }}>
        {eqEyebrow && (
          <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', color: site.color.accent, margin: '0 0 16px' }}>{eqEyebrow}</Reveal>
        )}
        {eqTitulo && (
          <Reveal as="h2" delay={100} style={{ fontSize: display.h2, fontWeight: 300, margin: 0, letterSpacing: '-0.01em', maxWidth: '20ch' }}>{eqTitulo}</Reveal>
        )}
        {eqIntro && (
          <Reveal as="p" delay={180} style={{ fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)', fontWeight: 300, lineHeight: 1.6, opacity: 0.7, margin: '20px 0 0', maxWidth: '58ch', whiteSpace: 'pre-wrap' }}>{eqIntro}</Reveal>
        )}

        {equipo.length > 0 && (
          <div className="equipo-grid" style={{ display: 'grid', gap: 'clamp(18px, 2.4vw, 34px)', marginTop: 'clamp(40px, 6vh, 70px)' }}>
            {equipo.map((m, i) => (
              <Reveal key={m.id} delay={Math.min(i, 6) * 70}>
                <Link href={href(`/estudio/${m.slug}`)} className="member-card" data-cursor={locale === 'en' ? 'View CV' : 'Ver CV'}
                  style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <div className="member-photo" style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#e7e5df' }}>
                    {m.foto_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.foto_url} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {(L(m.cv_corto_es, m.cv_corto_en)) && (
                      <div className="member-cv" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: 20,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0) 100%)', color: '#fff' }}>
                        <p style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.5, margin: 0 }}>{L(m.cv_corto_es, m.cv_corto_en)}</p>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>{m.nombre}</h3>
                    {L(m.rol_es, m.rol_en) && (
                      <p style={{ fontSize: 11, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.6, margin: '5px 0 0' }}>{L(m.rol_es, m.rol_en)}</p>
                    )}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        /* Equipo: 1 por fila en móvil, 2 en tablet, 3 en escritorio */
        .equipo-grid { grid-template-columns: 1fr; }
        @media (min-width: 640px)  { .equipo-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 980px)  { .equipo-grid { grid-template-columns: repeat(3, 1fr); } }
        /* Proporción del recuadro: retrato 4:5 (móvil/tablet), más esbelto 3:4 en escritorio */
        .member-photo { aspect-ratio: 4 / 5; }
        @media (min-width: 980px)  { .member-photo { aspect-ratio: 3 / 4; } }
        .member-photo img { transition: transform .6s cubic-bezier(.16,1,.3,1); }
        .member-cv { opacity: 0; transition: opacity .4s ease; }
        .member-card:hover .member-cv { opacity: 1; }
        .member-card:hover .member-photo img { transform: scale(1.05); }
      ` }} />
    </div>
  )
}
