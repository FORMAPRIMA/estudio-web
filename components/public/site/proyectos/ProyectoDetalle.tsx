'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { esVideoUrl, type WebProyecto, type ProyectoMedia, type ProyectoMediaTipo, type ProyectoCredito, type CreditoGrupo } from '@/lib/web-publica'
import type { WebEquipo } from '@/lib/web-equipo'
import { Img } from '@/components/public/site/Img'
import { EsqueletoPlinto } from '@/components/public/site/Esqueleto'

// Visor 3D: Three.js solo en cliente y bajo demanda.
const ModeloViewer = dynamic(() => import('./ModeloViewer'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <EsqueletoPlinto />
    </div>
  ),
})

const GRUPOS: { tipo: ProyectoMediaTipo; es: string; en: string }[] = [
  { tipo: 'foto',    es: 'Fotografías',       en: 'Photography' },
  { tipo: 'render',  es: 'Renders',           en: 'Renders' },
  { tipo: 'plano',   es: 'Planos y esquemas', en: 'Drawings & diagrams' },
  { tipo: 'maqueta', es: 'Maqueta',           en: 'Model' },
  { tipo: 'video',   es: 'Vídeo',             en: 'Video' },
]

export function ProyectoDetalle({ proyecto, equipo = [] }: { proyecto: WebProyecto; equipo?: WebEquipo[] }) {
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
          <Img src={proyecto.hero_url} alt={proyecto.nombre} contexto="hero" prioridad
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: site.maxWidth, margin: '0 auto', padding: `0 ${site.gutter} clamp(36px, 6vh, 72px)` }}>
          <Link href={href('/proyectos')} data-cursor="" style={{ display: 'inline-block', fontSize: 11, letterSpacing: site.track.wide, textTransform: 'uppercase', color: '#fff', opacity: 0.8, textDecoration: 'none', marginBottom: 20 }}>
            ← {locale === 'en' ? 'Projects' : 'Proyectos'}
          </Link>
          {tipologia && <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', opacity: 0.85, margin: '0 0 14px' }}>{tipologia}</Reveal>}
          <Reveal as="h1" delay={100} style={{ fontSize: display.hero, fontWeight: 300, letterSpacing: '0', lineHeight: 1.18, margin: 0, maxWidth: '24ch' }}>{proyecto.nombre}</Reveal>
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

        {/* Créditos. Los tres bloques se ocultan por separado: un proyecto puede
            tener equipo y proveedores pero ningún partner, y entonces solo faltan
            los partners. Van debajo de la ficha y no dentro de ella porque son
            personas, no datos de la obra. */}
        <Creditos creditos={proyecto.creditos} equipo={equipo} locale={locale} />
      </section>

      {/* Maqueta 3D interactiva (si hay GLB) */}
      {proyecto.glb_url && (
        <section style={{ maxWidth: site.maxWidth, margin: '0 auto', padding: `0 ${site.gutter} clamp(48px, 8vh, 96px)` }}>
          <Reveal as="h2" style={{ fontSize: display.h2, fontWeight: 300, letterSpacing: '-0.01em', margin: '0 0 clamp(20px, 3vh, 36px)' }}>
            {locale === 'en' ? '3D model' : 'Maqueta 3D'}
          </Reveal>
          {/* Sin borde y sin caja: el fondo del canvas es el mismo crema de la
              página, así que la maqueta se apoya sobre la hoja en lugar de vivir
              en una ventana. Lo que impide que se salga del lienzo al acercar no
              es un marco, es el tope de zoom que ModeloViewer deriva de la esfera
              envolvente del propio modelo. */}
          <div style={{ width: '100%', height: 'clamp(360px, 60vh, 640px)' }}>
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

        /* Créditos: tres columnas en escritorio, apiladas en móvil. El grid se
           adapta al número de bloques que sobrevivan (uno, dos o tres). */
        .proj-creditos {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: clamp(24px, 4vw, 56px);
          margin-top: clamp(40px, 6vh, 72px);
          padding-top: clamp(28px, 4vh, 44px);
          border-top: 1px solid ${site.color.ink}14;
        }

        /* ── Pie de lámina ──────────────────────────────────────────────────
           Cinco constantes tomadas de cómo tratan el pie El Croquis, 2G, A+U,
           Detail y Divisare: índice numérico ligado a la lámina · medida corta,
           nunca el ancho de la imagen · filete y aire de separación, no diez
           píxeles · autoría tipográficamente distinta de la descripción ·
           metadata en versales con tracking, descripción en caja baja. */
        .fig-pie {
          display: grid;
          grid-template-columns: 3.2ch 1fr;
          gap: 0 15px;
          margin-top: 16px;
          align-items: start;
        }
        .fig-idx {
          font-size: 11px;
          letter-spacing: 0.14em;
          font-variant-numeric: tabular-nums;
          opacity: 0.42;
          padding-top: 2px;
        }
        .fig-txt {
          display: flex;
          flex-direction: column;
          gap: 7px;
          max-width: 44ch;
          border-left: 1px solid ${site.color.ink}1f;
          padding-left: 16px;
        }
        .fig-desc { font-size: 13.5px; font-weight: 300; line-height: 1.62; opacity: 0.78; }
        .fig-cred {
          font-size: 9.5px;
          letter-spacing: ${site.track.normal};
          text-transform: uppercase;
          opacity: 0.42;
        }
        @media (max-width: 640px) {
          /* En una columna estrecha el filete y la sangría se comen la medida
             que precisamente estamos protegiendo: el índice pasa a línea. */
          .fig-pie { grid-template-columns: 1fr; gap: 7px; }
          .fig-txt { border-left: none; padding-left: 0; max-width: none; }
        }
      ` }} />
    </main>
  )
}

const GRUPOS_CREDITO: { grupo: CreditoGrupo; es: string; en: string }[] = [
  { grupo: 'equipo',    es: 'Equipo',      en: 'Team' },
  { grupo: 'partner',   es: 'Partners',    en: 'Partners' },
  { grupo: 'proveedor', es: 'Proveedores', en: 'Suppliers' },
]

function Creditos({ creditos, equipo, locale }: { creditos: ProyectoCredito[]; equipo: WebEquipo[]; locale: 'es' | 'en' }) {
  if (!creditos.length) return null
  const porId = new Map(equipo.map((m) => [m.id, m]))

  // Cada crédito se resuelve ANTES de decidir si su bloque se pinta: un crédito de
  // equipo cuyo id ya no existe (miembro borrado de la base) no cuenta, y si era
  // el único de su grupo ese bloque tampoco debe aparecer vacío.
  const resueltos = GRUPOS_CREDITO.map((g) => ({
    titulo: locale === 'en' ? g.en : g.es,
    filas: creditos
      .filter((c) => c.grupo === g.grupo)
      .map((c) => {
        const rol = (locale === 'en' ? c.rol_en : c.rol_es) || c.rol_es || ''
        if (c.grupo === 'equipo') {
          const m = c.equipo_id ? porId.get(c.equipo_id) : undefined
          if (!m) return null
          return { nombre: m.nombre, rol: rol || (locale === 'en' ? m.rol_en : m.rol_es) || '', href: href(`/estudio/${m.slug}`), externo: false }
        }
        if (!c.nombre?.trim()) return null
        return { nombre: c.nombre.trim(), rol, href: c.url?.trim() || null, externo: true }
      })
      .filter(Boolean) as { nombre: string; rol: string; href: string | null; externo: boolean }[],
  })).filter((g) => g.filas.length > 0)

  if (!resueltos.length) return null

  return (
    <Reveal delay={200}>
      <div className="proj-creditos">
        {resueltos.map((g) => (
          <div key={g.titulo}>
            <h3 style={{ fontSize: 10, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.45,
              fontWeight: 400, margin: 0, paddingBottom: 9, borderBottom: `1px solid ${site.color.ink}1f` }}>{g.titulo}</h3>
            <ul style={{ listStyle: 'none', margin: '13px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {g.filas.map((f, i) => (
                <li key={f.nombre + i}>
                  <div style={{ fontSize: 14, fontWeight: 300 }}>
                    {f.href ? (
                      <a href={f.href} data-cursor=""
                        {...(f.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        style={{ color: 'inherit', textDecoration: 'none', borderBottom: `1px solid ${site.color.ink}26` }}>{f.nombre}</a>
                    ) : f.nombre}
                  </div>
                  {f.rol && <div style={{ fontSize: 11, letterSpacing: '0.02em', opacity: 0.5, marginTop: 3 }}>{f.rol}</div>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Reveal>
  )
}

/** La autoría no se llama igual en una foto que en un render o un plano. */
function creditoEtiqueta(tipo: ProyectoMediaTipo, locale: 'es' | 'en') {
  if (tipo === 'render' || tipo === 'maqueta') return locale === 'en' ? 'Render' : 'Render'
  if (tipo === 'plano') return locale === 'en' ? 'Drawing' : 'Delineación'
  if (tipo === 'video') return locale === 'en' ? 'Film' : 'Realización'
  return locale === 'en' ? 'Photography' : 'Fotografía'
}

function MediaSection({ titulo, items, locale, tipo }: { titulo: string; items: ProyectoMedia[]; locale: 'es' | 'en'; tipo: ProyectoMediaTipo }) {
  const plano = tipo === 'plano'
  // Las láminas se numeran solo si en esta sección hay algo escrito. Si no hay ni
  // un pie ni una autoría, una columna de números sueltos bajo cada foto sería
  // ruido; y si hay texto, se numeran TODAS para que la serie no salte.
  const numerar = items.some((m) => (locale === 'en' ? m.caption_en : m.caption_es) || m.credito)
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
                    <Img src={m.url} alt={caption} contexto="galeria"
                      style={{ width: '100%', height: 'auto', display: 'block', objectFit: plano ? 'contain' : 'cover' }} />
                  )}
                </div>
                {numerar && (
                  // Pie a dos columnas: índice tabular, filete, y el texto en
                  // MEDIDA CORTA. Ese es el cambio que más hace de todos: un pie a
                  // todo el ancho de una imagen de 1440 px se lee como un párrafo
                  // de web; a 44 caracteres se lee como un pie de publicación.
                  <figcaption className="fig-pie">
                    <span className="fig-idx">{String(i + 1).padStart(2, '0')}</span>
                    <span className="fig-txt">
                      {caption && <span className="fig-desc">{caption}</span>}
                      {m.credito && (
                        <span className="fig-cred">
                          {creditoEtiqueta(tipo, locale)} — {m.credito}
                        </span>
                      )}
                    </span>
                  </figcaption>
                )}
              </figure>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
