'use client'

import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import type { WebEquipo } from '@/lib/web-equipo'

export function MiembroDetalle({ miembro }: { miembro: WebEquipo }) {
  const { locale } = useSite()
  const L = (es: string | null, en: string | null) => (locale === 'en' ? en || es : es) || ''
  const foto = miembro.foto_detalle_url || miembro.foto_url
  const cv = L(miembro.cv_largo_es, miembro.cv_largo_en)

  return (
    <main style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink, minHeight: '100vh',
      padding: `120px ${site.gutter} clamp(60px, 10vh, 120px)` }}>
      <div style={{ maxWidth: site.maxWidth, margin: '0 auto' }}>
        <Link href={href('/estudio')} data-cursor=""
          style={{ display: 'inline-block', fontSize: 11, letterSpacing: site.track.wide, textTransform: 'uppercase', color: site.color.ink, opacity: 0.6, textDecoration: 'none', marginBottom: 'clamp(30px, 5vh, 56px)' }}>
          ← {locale === 'en' ? 'Team' : 'Equipo'}
        </Link>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 'clamp(30px, 5vw, 72px)', alignItems: 'start' }} className="miembro-grid">
          {/* Foto */}
          <Reveal>
            <div style={{ width: '100%', aspectRatio: '3 / 4', overflow: 'hidden', background: '#e7e5df' }}>
              {foto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt={miembro.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
          </Reveal>

          {/* CV */}
          <div>
            <Reveal as="h1" style={{ fontSize: display.h1, fontWeight: 300, margin: 0, letterSpacing: '-0.01em' }}>{miembro.nombre}</Reveal>
            {L(miembro.rol_es, miembro.rol_en) && (
              <Reveal as="p" delay={100} style={{ fontSize: 12, letterSpacing: site.track.wide, textTransform: 'uppercase', color: site.color.accent, margin: '12px 0 0' }}>
                {L(miembro.rol_es, miembro.rol_en)}
              </Reveal>
            )}
            {cv && (
              <Reveal delay={180}>
                <div style={{ marginTop: 'clamp(24px, 4vh, 40px)', fontSize: 'clamp(0.98rem, 1.3vw, 1.12rem)', fontWeight: 300, lineHeight: 1.75, opacity: 0.82, whiteSpace: 'pre-wrap' }}>
                  {cv}
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 760px) {
          .miembro-grid { grid-template-columns: 1fr !important; }
        }
      ` }} />
    </main>
  )
}
