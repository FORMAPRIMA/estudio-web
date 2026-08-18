'use client'

import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { pick, type ContentMap } from '@/lib/web-publica'
import type { WebFpTool } from '@/lib/web-fp-tools'
import { Img } from '@/components/public/site/Img'

export function FpToolsPage({ content, tools }: { content: ContentMap; tools: WebFpTool[] }) {
  const { locale, mobile } = useSite()
  const L = (es: string | null, en: string | null) => (locale === 'en' ? en || es : es) || ''

  const eyebrow = pick(content, 'hero', 'eyebrow', { locale, mobile })
  const titulo = pick(content, 'hero', 'titulo', { locale, mobile })
  const intro = pick(content, 'hero', 'intro', { locale, mobile })

  return (
    <main style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink, minHeight: '100vh',
      padding: `120px 0 clamp(60px, 10vh, 120px)` }}>
      {/* Encabezado */}
      <header style={{ maxWidth: site.maxWidth, margin: '0 auto', padding: `0 ${site.gutter}`, marginBottom: 'clamp(48px, 8vh, 96px)' }}>
        {eyebrow && <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', color: site.color.accent, margin: '0 0 16px' }}>{eyebrow}</Reveal>}
        {titulo && <Reveal as="h1" delay={100} style={{ fontSize: display.hero, fontWeight: 300, letterSpacing: '0', lineHeight: 1.2, margin: 0, maxWidth: '24ch' }}>{titulo}</Reveal>}
        {intro && <Reveal as="p" delay={180} style={{ fontSize: 'clamp(1rem, 1.5vw, 1.25rem)', fontWeight: 300, lineHeight: 1.65, opacity: 0.7, margin: '24px 0 0', maxWidth: '60ch', whiteSpace: 'pre-wrap' }}>{intro}</Reveal>}
      </header>

      {/* Capacidades — bloques alternados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(48px, 9vh, 120px)' }}>
        {tools.map((t, i) => {
          const reverse = i % 2 === 1
          const tagline = L(t.tagline_es, t.tagline_en)
          const descripcion = L(t.descripcion_es, t.descripcion_en)
          const ctaLabel = L(t.cta_label_es, t.cta_label_en)
          return (
            <Reveal key={t.id}>
              <section style={{ maxWidth: site.maxWidth, margin: '0 auto', padding: `0 ${site.gutter}` }}>
                <div className="fptool-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(28px, 5vw, 80px)', alignItems: 'center', direction: reverse ? 'rtl' : 'ltr' }}>
                  <div style={{ direction: 'ltr' }}>
                    {t.imagen_url ? (
                      <div style={{ width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', background: '#e7e5df' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <Img src={t.imagen_url} alt={t.nombre} contexto="tarjeta"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : <div style={{ width: '100%', aspectRatio: '4 / 3', background: '#e7e5df' }} />}
                  </div>
                  <div style={{ direction: 'ltr' }}>
                    <span style={{ fontSize: 11, letterSpacing: site.track.normal, textTransform: 'uppercase', color: site.color.accent, fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
                    <h2 style={{ fontSize: display.h2, fontWeight: 300, letterSpacing: '-0.01em', margin: '10px 0 0' }}>{t.nombre}</h2>
                    {tagline && <p style={{ fontSize: 'clamp(1rem, 1.4vw, 1.2rem)', fontWeight: 400, margin: '10px 0 0', opacity: 0.9 }}>{tagline}</p>}
                    {descripcion && <p style={{ fontSize: '1rem', fontWeight: 300, lineHeight: 1.7, opacity: 0.72, margin: '18px 0 0', whiteSpace: 'pre-wrap' }}>{descripcion}</p>}
                    {ctaLabel && t.cta_url && (
                      <Cta url={t.cta_url} label={ctaLabel} />
                    )}
                  </div>
                </div>
              </section>
            </Reveal>
          )
        })}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 820px) {
          .fptool-row { grid-template-columns: 1fr !important; direction: ltr !important; }
        }
      ` }} />
    </main>
  )
}

function Cta({ url, label }: { url: string; label: string }) {
  const external = /^https?:\/\//i.test(url)
  const style: React.CSSProperties = {
    display: 'inline-block', marginTop: 26, fontSize: 12, letterSpacing: site.track.wide, textTransform: 'uppercase',
    color: site.color.ink, textDecoration: 'none', borderBottom: `1px solid ${site.color.ink}`, paddingBottom: 4,
  }
  if (external) return <a href={url} target="_blank" rel="noopener noreferrer" data-cursor="" style={style}>{label} ↗</a>
  // Enlace interno: si empieza por / lo prefijamos con la base del sitio.
  return <Link href={url.startsWith('/') ? href(url) : url} data-cursor="" style={style}>{label} →</Link>
}
