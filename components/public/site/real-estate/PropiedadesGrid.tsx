'use client'

import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { pick, type ContentMap } from '@/lib/web-publica'
import type { WebPropiedad } from '@/lib/web-propiedades'

export function PropiedadesGrid({ content, propiedades }: { content: ContentMap; propiedades: WebPropiedad[] }) {
  const { locale, mobile } = useSite()

  const eyebrow = pick(content, 'hero', 'eyebrow', { locale, mobile })
  const titulo = pick(content, 'hero', 'titulo', { locale, mobile })
  const intro = pick(content, 'hero', 'intro', { locale, mobile })
  const modeloTitulo = pick(content, 'modelo', 'titulo', { locale, mobile })
  const modeloTexto = pick(content, 'modelo', 'texto', { locale, mobile })

  return (
    <main style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink, minHeight: '100vh',
      padding: `120px ${site.gutter} clamp(60px, 10vh, 120px)` }}>
      <div style={{ maxWidth: site.maxWidth, margin: '0 auto' }}>
        <header style={{ marginBottom: 'clamp(36px, 6vh, 64px)' }}>
          {eyebrow && <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', color: site.color.accent, margin: '0 0 16px' }}>{eyebrow}</Reveal>}
          {titulo && <Reveal as="h1" delay={100} style={{ fontSize: display.hero, fontWeight: 300, letterSpacing: '-0.01em', margin: 0, maxWidth: '16ch' }}>{titulo}</Reveal>}
          {intro && <Reveal as="p" delay={180} style={{ fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)', fontWeight: 300, lineHeight: 1.6, opacity: 0.7, margin: '22px 0 0', maxWidth: '56ch', whiteSpace: 'pre-wrap' }}>{intro}</Reveal>}
        </header>

        {/* Cómo trabajamos */}
        {(modeloTitulo || modeloTexto) && (
          <Reveal>
            <div style={{ borderTop: `1px solid ${site.color.ink}14`, borderBottom: `1px solid ${site.color.ink}14`, padding: 'clamp(28px, 4vh, 48px) 0', margin: '0 0 clamp(40px, 7vh, 72px)', display: 'grid', gridTemplateColumns: modeloTexto ? 'minmax(0,0.8fr) minmax(0,1.6fr)' : '1fr', gap: 'clamp(20px, 4vw, 64px)' }} className="re-modelo">
              {modeloTitulo && <h2 style={{ fontSize: display.h2, fontWeight: 300, letterSpacing: '-0.01em', margin: 0 }}>{modeloTitulo}</h2>}
              {modeloTexto && <p style={{ fontSize: 'clamp(0.98rem, 1.3vw, 1.12rem)', fontWeight: 300, lineHeight: 1.75, opacity: 0.8, margin: 0, whiteSpace: 'pre-wrap' }}>{modeloTexto}</p>}
            </div>
          </Reveal>
        )}

        {propiedades.length === 0 ? (
          <p style={{ opacity: 0.5, fontSize: 14 }}>{locale === 'en' ? 'No properties listed.' : 'Aún no hay propiedades.'}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'clamp(20px, 3vw, 44px)' }}>
            {propiedades.map((p, i) => {
              const badge = p.disponible ? (locale === 'en' ? 'Available' : 'Disponible') : (locale === 'en' ? 'Reserved' : 'Reservada')
              const inner = (
                <>
                  <div className="re-photo" style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', background: '#e7e5df' }}>
                    {p.hero_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.hero_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <span style={{ position: 'absolute', top: 14, left: 14, fontSize: 10, letterSpacing: site.track.normal, textTransform: 'uppercase', padding: '5px 10px', background: p.disponible ? site.color.ink : 'rgba(0,0,0,0.45)', color: '#fff' }}>{badge}</span>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 400, margin: 0, letterSpacing: '-0.01em' }}>{p.nombre}</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
                      {p.ubicacion && <span style={{ fontSize: 12, opacity: 0.55 }}>{p.ubicacion}</span>}
                      {p.precio && <span style={{ fontSize: 13, fontWeight: 400 }}>{p.precio}</span>}
                    </div>
                  </div>
                </>
              )
              return (
                <Reveal key={p.id} delay={Math.min(i, 6) * 70}>
                  {p.slug ? (
                    <Link href={href(`/real-estate/${p.slug}`)} className="re-card" data-cursor={locale === 'en' ? 'View' : 'Ver'} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>{inner}</Link>
                  ) : <div className="re-card">{inner}</div>}
                </Reveal>
              )
            })}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .re-photo img { transition: transform .7s cubic-bezier(.16,1,.3,1); }
        .re-card:hover .re-photo img { transform: scale(1.05); }
        @media (max-width: 720px) { .re-modelo { grid-template-columns: 1fr !important; } }
      ` }} />
    </main>
  )
}
