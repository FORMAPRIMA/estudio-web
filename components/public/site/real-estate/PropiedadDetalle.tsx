'use client'

import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import type { WebPropiedad } from '@/lib/web-propiedades'

export function PropiedadDetalle({ propiedad }: { propiedad: WebPropiedad }) {
  const { locale } = useSite()
  const descripcion = (locale === 'en' ? propiedad.descripcion_en || propiedad.descripcion_es : propiedad.descripcion_es) || ''
  const badge = propiedad.disponible ? (locale === 'en' ? 'Available' : 'Disponible') : (locale === 'en' ? 'Reserved' : 'Reservada')

  return (
    <main style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink }}>
      <section style={{ position: 'relative', height: '78vh', minHeight: 440, background: site.color.stage, color: site.color.white, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
        {propiedad.hero_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={propiedad.hero_url} alt={propiedad.nombre} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: site.maxWidth, margin: '0 auto', padding: `0 ${site.gutter} clamp(36px, 6vh, 72px)` }}>
          <Link href={href('/real-estate')} data-cursor="" style={{ display: 'inline-block', fontSize: 11, letterSpacing: site.track.wide, textTransform: 'uppercase', color: '#fff', opacity: 0.8, textDecoration: 'none', marginBottom: 18 }}>← Real Estate</Link>
          <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', opacity: 0.85, margin: '0 0 12px' }}>{badge}</Reveal>
          <Reveal as="h1" delay={100} style={{ fontSize: display.hero, fontWeight: 300, letterSpacing: '0', lineHeight: 1.18, margin: 0, maxWidth: '24ch' }}>{propiedad.nombre}</Reveal>
        </div>
      </section>

      <section style={{ maxWidth: site.maxWidth, margin: '0 auto', padding: `clamp(44px, 7vh, 90px) ${site.gutter}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.8fr) minmax(0,1.6fr)', gap: 'clamp(30px, 5vw, 72px)', alignItems: 'start' }} className="re-detail-grid">
          <Reveal as="dl" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {propiedad.ubicacion && <Item k={locale === 'en' ? 'Location' : 'Ubicación'} v={propiedad.ubicacion} />}
            {propiedad.precio && <Item k={locale === 'en' ? 'Price' : 'Precio'} v={propiedad.precio} />}
            <Item k={locale === 'en' ? 'Status' : 'Estado'} v={badge} />
            <Link href={href('/contacto')} data-cursor="" style={{ marginTop: 6, display: 'inline-block', fontSize: 12, letterSpacing: site.track.wide, textTransform: 'uppercase', color: site.color.ink, textDecoration: 'none', borderBottom: `1px solid ${site.color.ink}`, paddingBottom: 4, alignSelf: 'flex-start' }}>
              {locale === 'en' ? 'Enquire' : 'Solicitar información'} →
            </Link>
          </Reveal>
          {descripcion && (
            <Reveal delay={120}>
              <div style={{ fontSize: 'clamp(1rem, 1.4vw, 1.2rem)', fontWeight: 300, lineHeight: 1.75, opacity: 0.85, whiteSpace: 'pre-wrap' }}>{descripcion}</div>
            </Reveal>
          )}
        </div>
      </section>

      {propiedad.galeria.length > 0 && (
        <section style={{ maxWidth: site.maxWidth, margin: '0 auto', padding: `0 ${site.gutter} clamp(48px, 8vh, 96px)`, display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 3vh, 36px)' }}>
          {propiedad.galeria.map((url, i) => (
            <Reveal key={url + i}>
              <div style={{ width: '100%', overflow: 'hidden', background: '#e7e5df' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            </Reveal>
          ))}
        </section>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@media (max-width: 760px) { .re-detail-grid { grid-template-columns: 1fr !important; } }` }} />
    </main>
  )
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt style={{ fontSize: 10, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.45, marginBottom: 6 }}>{k}</dt>
      <dd style={{ margin: 0, fontSize: 16, fontWeight: 300 }}>{v}</dd>
    </div>
  )
}
