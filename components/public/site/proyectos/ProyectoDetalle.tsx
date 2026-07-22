'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { esVideoUrl, type WebProyecto, type ProyectoMedia, type ProyectoMediaTipo } from '@/lib/web-publica'

// Visor 3D: Three.js solo en cliente y bajo demanda.
const ModeloViewer = dynamic(() => import('./ModeloViewer'), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1414144d', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cargando maqueta…</div>,
})

const GRUPOS: { tipo: ProyectoMediaTipo; es: string; en: string }[] = [
  { tipo: 'foto',    es: 'Fotografías',       en: 'Photography' },
  { tipo: 'render',  es: 'Renders',           en: 'Renders' },
  { tipo: 'plano',   es: 'Planos y esquemas', en: 'Drawings & diagrams' },
  { tipo: 'maqueta', es: 'Maqueta',           en: 'Model' },
  { tipo: 'video',   es: 'Vídeo',             en: 'Video' },
]

export function ProyectoDetalle({ proyecto }: { proyecto: WebProyecto }) {
  const { locale } = useSite()
  const L = (es: string | null | undefined, en: string | null | undefined) => (locale === 'en' ? en || es : es) || ''

  const tipologia = L(proyecto.tipologia_es, proyecto.tipologia_en) || proyecto.nota || ''
  const descripcion = L(proyecto.descripcion_es, proyecto.descripcion_en)
  const ficha = [
    { k: locale === 'en' ? 'Location' : 'Ubicación', v: proyecto.ubicacion },
    { k: locale === 'en' ? 'Year' : 'Año', v: proyecto.anio },
    { k: locale === 'en' ? 'Type' : 'Tipología', v: tipologia },
    { k: locale === 'en' ? 'Area' : 'Superficie', v: proyecto.superficie },
  ].filter((f) => f.v)

  return (
    <main style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink }}>
      {/* Hero */}
      <section style={{ position: 'relative', height: '82vh', minHeight: 460, background: site.color.stage, color: site.color.white, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
        {proyecto.hero_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proyecto.hero_url} alt={proyecto.nombre} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: site.maxWidth, margin: '0 auto', padding: `0 ${site.gutter} clamp(36px, 6vh, 72px)` }}>
          <Link href={href('/proyectos')} data-cursor="" style={{ display: 'inline-block', fontSize: 11, letterSpacing: site.track.wide, textTransform: 'uppercase', color: '#fff', opacity: 0.8, textDecoration: 'none', marginBottom: 20 }}>
            ← {locale === 'en' ? 'Projects' : 'Proyectos'}
          </Link>
          {tipologia && <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', opacity: 0.85, margin: '0 0 14px' }}>{tipologia}</Reveal>}
          <Reveal as="h1" delay={100} style={{ fontSize: display.hero, fontWeight: 300, letterSpacing: '-0.01em', lineHeight: 1.02, margin: 0, maxWidth: '18ch' }}>{proyecto.nombre}</Reveal>
        </div>
      </section>

      {/* Ficha + descripción */}
      <section style={{ maxWidth: site.maxWidth, margin: '0 auto', padding: `clamp(48px, 8vh, 100px) ${site.gutter}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.6fr)', gap: 'clamp(30px, 5vw, 80px)', alignItems: 'start' }} className="proj-detail-grid">
          {ficha.length > 0 && (
            <Reveal as="dl" style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px 20px' }}>
              {ficha.map((f) => (
                <div key={f.k}>
                  <dt style={{ fontSize: 10, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.45, marginBottom: 6 }}>{f.k}</dt>
                  <dd style={{ margin: 0, fontSize: 15, fontWeight: 300 }}>{f.v}</dd>
                </div>
              ))}
            </Reveal>
          )}
          {descripcion && (
            <Reveal delay={120}>
              <div style={{ fontSize: 'clamp(1rem, 1.4vw, 1.2rem)', fontWeight: 300, lineHeight: 1.75, opacity: 0.85, whiteSpace: 'pre-wrap' }}>{descripcion}</div>
            </Reveal>
          )}
        </div>
      </section>

      {/* Maqueta 3D interactiva (si hay GLB) */}
      {proyecto.glb_url && (
        <section style={{ maxWidth: site.maxWidth, margin: '0 auto', padding: `0 ${site.gutter} clamp(48px, 8vh, 96px)` }}>
          <Reveal as="h2" style={{ fontSize: display.h2, fontWeight: 300, letterSpacing: '-0.01em', margin: '0 0 clamp(20px, 3vh, 36px)' }}>
            {locale === 'en' ? '3D model' : 'Maqueta 3D'}
          </Reveal>
          <div style={{ width: '100%', height: 'clamp(360px, 60vh, 640px)', background: '#f4f3f0', border: `1px solid ${site.color.ink}12` }}>
            <ModeloViewer url={proyecto.glb_url} />
          </div>
          <p style={{ fontSize: 11, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.45, marginTop: 12 }}>
            {locale === 'en' ? 'Drag to rotate' : 'Arrastra para girar'}
          </p>
        </section>
      )}

      {/* Galerías por tipo */}
      {GRUPOS.map((g) => {
        const items = proyecto.media.filter((m) => m.tipo === g.tipo)
        if (items.length === 0) return null
        return <MediaSection key={g.tipo} titulo={locale === 'en' ? g.en : g.es} items={items} locale={locale} tipo={g.tipo} />
      })}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 760px) {
          .proj-detail-grid { grid-template-columns: 1fr !important; }
        }
      ` }} />
    </main>
  )
}

function MediaSection({ titulo, items, locale, tipo }: { titulo: string; items: ProyectoMedia[]; locale: 'es' | 'en'; tipo: ProyectoMediaTipo }) {
  const plano = tipo === 'plano'
  return (
    <section style={{ maxWidth: site.maxWidth, margin: '0 auto', padding: `0 ${site.gutter} clamp(48px, 8vh, 96px)` }}>
      <Reveal as="h2" style={{ fontSize: display.h2, fontWeight: 300, letterSpacing: '-0.01em', margin: '0 0 clamp(24px, 4vh, 44px)' }}>{titulo}</Reveal>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px, 3vh, 40px)' }}>
        {items.map((m, i) => {
          const caption = (locale === 'en' ? m.caption_en : m.caption_es) || ''
          const isVid = esVideoUrl(m.url)
          return (
            <Reveal key={m.url + i}>
              <figure style={{ margin: 0 }}>
                <div style={{ width: '100%', overflow: 'hidden', background: plano ? '#fff' : '#e7e5df', border: plano ? `1px solid ${site.color.ink}12` : 'none' }}>
                  {isVid ? (
                    // La maqueta orbital se reproduce sola en bucle; el vídeo genérico con controles.
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={m.url} style={{ width: '100%', height: 'auto', display: 'block' }}
                      controls={tipo === 'video'} autoPlay={tipo === 'maqueta'} muted={tipo === 'maqueta'} loop={tipo === 'maqueta'} playsInline preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={caption} style={{ width: '100%', height: 'auto', display: 'block', objectFit: plano ? 'contain' : 'cover' }} />
                  )}
                </div>
                {caption && <figcaption style={{ fontSize: 12, opacity: 0.55, marginTop: 10, letterSpacing: '0.02em' }}>{caption}</figcaption>}
              </figure>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
