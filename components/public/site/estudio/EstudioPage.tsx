'use client'

import { useState } from 'react'
import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { pick, type ContentMap } from '@/lib/web-publica'
import type { WebEquipo } from '@/lib/web-equipo'
import { Img } from '@/components/public/site/Img'
import { EsqueletoFoto } from '@/components/public/site/Esqueleto'

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
      {/* Hero del equipo.
          ESCRITORIO: foto a sangre a pantalla completa con el titular encima.
          MÓVIL: hero PARTIDO — la foto es una banda a todo el ancho en su
          proporción nativa y el texto baja debajo, sobre el crema.
          El porqué: la foto del equipo es apaisada y `object-fit: cover` dentro
          de una caja vertical de 390×844 solo puede enseñar la franja central —
          se veía ~26% del ancho y faltaba media plantilla. No es un problema de
          encuadre, es la aritmética del cover. Y el texto encima tampoco era el
          problema: en 390 px cualquier titular sobreimpreso cae sobre la cara de
          alguien. Separarlos arregla el recorte y la legibilidad de una vez.
          El CMS admite además una imagen distinta para móvil en este bloque, así
          que una toma vertical hecha a propósito entra sin tocar nada de esto. */}
      <section className="est-hero" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Sin `position` inline: el inline gana a la hoja y aquí la posición
            cambia con el breakpoint (absoluta a sangre / en flujo en móvil). */}
        <div className="est-hero-foto" style={{ overflow: 'hidden' }}>
          {heroImg && (
            <Img src={heroImg} alt="" contexto="hero" prioridad
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
          {/* El velo solo protege texto cuando hay texto encima: en móvil el
              titular ya no está aquí, así que se retira y la foto se ve limpia. */}
          <div className="est-hero-velo" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)' }} />
        </div>

        {/* Sin `padding` inline: el atajo fija los CUATRO lados, así que ganaba al
            padding-bottom de la hoja y dejaba el titular pegado al canto de la
            foto (y sin aire arriba en móvil). Todo el relleno vive en el CSS,
            que es donde cambia con el breakpoint. */}
        <div className="est-hero-txt" style={{ maxWidth: site.maxWidth, width: '100%', margin: '0 auto' }}>
          {heroEyebrow && (
            <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', opacity: 0.85, margin: '0 0 16px' }}>{heroEyebrow}</Reveal>
          )}
          {heroTitulo && (
            <Reveal as="h1" delay={120} style={{ fontSize: display.hero, fontWeight: 300, lineHeight: 1.2, letterSpacing: '0', margin: 0, maxWidth: '24ch' }}>{heroTitulo}</Reveal>
          )}
        </div>

        <div className="est-hero-scroll" style={{ fontSize: 10, letterSpacing: site.track.wide, textTransform: 'uppercase', opacity: 0.6 }}>
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
              <MiembroCard key={m.id} m={m} i={i} locale={locale} L={L} />
            ))}
          </div>
        )}
      </section>

      <style dangerouslySetInnerHTML={{ __html: `
        /* ── Hero: a sangre en escritorio, partido en móvil ─────────────── */
        .est-hero {
          min-height: 100dvh; display: flex; align-items: flex-end;
          background: ${site.color.stage}; color: ${site.color.white};
        }
        .est-hero-foto { position: absolute; inset: 0; }
        /* <Img> emite un <picture>, que es inline y sin alto propio: sin esto el
           height:100% del <img> resuelve contra "auto" y el hero se desploma. */
        .est-hero-foto picture { display: block; width: 100%; height: 100%; }
        .est-hero-txt { position: relative; z-index: 2; padding: 0 ${site.gutter} 80px; }
        .est-hero-scroll {
          position: absolute; bottom: 28px; left: 50%;
          transform: translateX(-50%); z-index: 2;
        }
        @media (max-width: 760px) {
          /* La sección deja de imponer alto: la marca la foto entera más el
             texto. Un alto fijo aquí volvería a obligar a recortar algo.
             Y deja de ser oscura: con el titular fuera de la foto, el fondo
             negro se quedaba como una franja suelta entre la imagen y el crema
             de la página, que se leía como un resto y no como una decisión. */
          .est-hero { min-height: 0; display: block; padding-bottom: 0;
                      background: ${site.color.cream}; color: ${site.color.ink}; }
          .est-hero-foto { position: static; inset: auto; width: 100%; }
          .est-hero-foto picture { height: auto; }
          .est-hero-foto img { height: auto !important; }
          .est-hero-velo { display: none; }
          /* El titular ya no va sobre la foto sino debajo: necesita aire arriba
             para no quedarse pegado al canto. El de abajo ya lo pone la sección
             del equipo, que arranca con su propio relleno generoso. */
          .est-hero-txt { padding: 32px ${site.gutter} 0; }
          /* Fuera el «Desliza»: con el titular ya fuera de la foto, debajo se ve
             el principio de la siguiente sección. Invitar a un gesto que el
             visitante ya está viendo hacer sobra, y era lo que estiraba la
             franja bajo el titular. */
          .est-hero-scroll { display: none; }
        }

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

/** Tarjeta de un integrante. Componente aparte por el mismo motivo que la tarjeta
 *  de proyecto: necesita saber si SU foto ya pintó para retirar el esqueleto, y un
 *  hook no cabe dentro de un `.map()`. */
function MiembroCard({ m, i, locale, L }: {
  m: WebEquipo
  i: number
  locale: 'es' | 'en'
  L: (es: string | null, en: string | null) => string
}) {
  const [cargada, setCargada] = useState(false)
  const cv = L(m.cv_corto_es, m.cv_corto_en)

  return (
    <Reveal delay={Math.min(i, 6) * 70}>
      <Link href={href(`/estudio/${m.slug}`)} className="member-card" data-cursor={locale === 'en' ? 'View CV' : 'Ver CV'}
        style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
        <div className="member-photo" style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#e7e5df' }}>
          <EsqueletoFoto cargada={cargada || !m.foto_url} />
          {m.foto_url && (
            <Img src={m.foto_url} alt={m.nombre} contexto="rejillaEquipo"
              onLoad={() => setCargada(true)}
              style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {cv && (
            <div className="member-cv" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: 20,
              background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0) 100%)', color: '#fff' }}>
              <p style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.5, margin: 0 }}>{cv}</p>
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
  )
}
