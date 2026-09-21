'use client'

import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { Img } from '../Img'
import { ToolVideo } from './ToolVideo'
import { ToolTabs, TOPE_HEADER } from './ToolTabs'
import { bloqueTieneContenido, type WebFpToolBloque, type WebFpToolDetalle } from '@/lib/web-fp-tools'

/**
 * Una capacidad. Es TODA la sección: /fp-tools no tiene portada, entra
 * directamente en la primera y la barra de arriba lleva a las demás.
 *
 * El orden lo marcó Jose y es el que manda: primero el vídeo ocupando la pantalla
 * entera, y solo al bajar empieza el documento. Por eso el hero es una pieza
 * aparte (ToolVideo) y aquí abajo no hay más que maquetación de bloques.
 *
 * Los bloques los compone el equipo desde el CMS, así que esta página no puede
 * asumir NINGUNA composición concreta: cualquier orden de cualquiera de las
 * cuatro formas tiene que salir bien. De ahí que el ritmo vertical lo ponga un
 * único `gap` del contenedor y no márgenes de cada bloque, que es lo que acaba
 * dando dobles espacios en cuanto alguien reordena.
 */

export function FpToolDetalle({ tool, tools, indice, total }: {
  tool: WebFpToolDetalle
  /** Todas las capacidades visibles, en orden: son las pestañas de la barra. */
  tools: { slug: string; nombre: string }[]
  /** Su número dentro de la sección, 1..n. La misma serie que la barra. */
  indice: number
  total: number
}) {
  const { locale } = useSite()
  const L = (es: string | null, en: string | null) => (locale === 'en' ? en || es : es) || ''

  const tagline = L(tool.tagline_es, tool.tagline_en)
  const descripcion = L(tool.descripcion_es, tool.descripcion_en)
  const ctaLabel = L(tool.cta_label_es, tool.cta_label_en)
  const bloques = tool.bloques.filter(bloqueTieneContenido)

  return (
    <main style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink }}>

      {/* El hueco del header. SiteNav es `absolute` —se va con el scroll y no
          ocupa flujo— así que si nadie le reserva sitio, la barra de capacidades
          le nace debajo. */}
      <div style={{ height: TOPE_HEADER }} aria-hidden="true" />

      <ToolTabs tools={tools} activo={tool.slug} locale={locale} />

      <ToolVideo
        videoUrl={tool.video_url}
        posterUrl={tool.video_poster_url || tool.imagen_url}
        nombre={tool.nombre}
        eyebrow="FP Tools"
        tagline={tagline}
        locale={locale}
        indice={`${String(indice).padStart(2, '0')} / ${String(total).padStart(2, '0')}`}
        conBarra={tools.length > 1}
      />

      {/* El cuerpo. Sube unos píxeles por encima del vídeo con su propio fondo:
          el corte entre la pieza y el documento se lee como una hoja que entra,
          no como dos secciones pegadas. */}
      <div style={{
        position: 'relative', zIndex: 4, background: site.color.cream,
        padding: `clamp(64px, 11vh, 140px) 0 clamp(60px, 10vh, 120px)`,
      }}>

        {/* Entradilla: la descripción corta que ya tenía la capacidad. Es lo
            primero que se lee tras el vídeo, así que va a cuerpo grande y sola. */}
        {descripcion && (
          <Marco>
            <Reveal>
              <p style={{
                fontSize: 'clamp(1.05rem, 1.9vw, 1.55rem)', fontWeight: 300, lineHeight: 1.6,
                letterSpacing: '-0.005em', margin: 0, maxWidth: '38ch', whiteSpace: 'pre-wrap',
              }}>
                {descripcion}
              </p>
            </Reveal>
          </Marco>
        )}

        {bloques.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 'clamp(56px, 10vh, 132px)',
            marginTop: descripcion ? 'clamp(56px, 10vh, 132px)' : 0,
          }}>
            {bloques.map((b) => <Bloque key={b.id} bloque={b} locale={locale} />)}
          </div>
        )}

        {/* Cierre: solo la llamada de la capacidad.
            Ni «volver al índice» —no hay índice— ni un paso a la siguiente: de
            recorrer la sección ya se encarga la barra de arriba, que está fija y
            se alcanza desde cualquier punto. Un titular gigante repitiendo eso al
            final competía con el propio nombre de la capacidad. */}
        {ctaLabel && tool.cta_url && (
          <Marco>
            <div style={{
              marginTop: 'clamp(64px, 11vh, 150px)', paddingTop: 'clamp(34px, 5vh, 56px)',
              borderTop: '1px solid rgba(20,20,20,.10)',
            }}>
              <Reveal y={16}><Cta url={tool.cta_url} label={ctaLabel} /></Reveal>
            </div>
          </Marco>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  )
}

/** El ancho del sitio, con sus gutters. Lo comparten todos los bloques salvo la
 *  lámina a sangre, y tenerlo en un sitio evita que se separen con el tiempo. */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <section style={{ maxWidth: site.maxWidth, margin: '0 auto', padding: `0 ${site.gutter}` }}>
      {children}
    </section>
  )
}

function Bloque({ bloque: b, locale }: { bloque: WebFpToolBloque; locale: 'es' | 'en' }) {
  const L = (es: string | null, en: string | null) => (locale === 'en' ? en || es : es) || ''
  const titulo = L(b.titulo_es, b.titulo_en)
  const cuerpo = L(b.cuerpo_es, b.cuerpo_en)
  const pie = L(b.pie_es, b.pie_en)

  if (b.tipo === 'cita') {
    return (
      <Marco>
        <Reveal>
          <blockquote style={{
            margin: 0, padding: 'clamp(8px, 2vh, 24px) 0',
            maxWidth: '24ch', marginInline: 'auto', textAlign: 'center',
          }}>
            <p style={{
              fontSize: 'clamp(1.4rem, 3.4vw, 2.5rem)', fontWeight: 300, lineHeight: 1.28,
              letterSpacing: '-0.015em', margin: 0, whiteSpace: 'pre-wrap',
            }}>
              {cuerpo}
            </p>
            {titulo && (
              <footer style={{
                marginTop: 26, fontSize: 10, letterSpacing: site.track.wide,
                textTransform: 'uppercase', opacity: 0.42,
              }}>
                {titulo}
              </footer>
            )}
          </blockquote>
        </Reveal>
      </Marco>
    )
  }

  if (b.tipo === 'imagen') {
    return (
      <Marco>
        <Reveal>
          <figure style={{ margin: 0 }}>
            {b.imagen_url && (
              <Img src={b.imagen_url} alt={pie || titulo} contexto="galeria"
                style={{ width: '100%', height: 'auto', display: 'block' }} />
            )}
            {pie && <figcaption style={pieStyle}>{pie}</figcaption>}
          </figure>
        </Reveal>
      </Marco>
    )
  }

  if (b.tipo === 'dueto') {
    return (
      <Marco>
        {/* `direction: rtl` para invertir, igual que en la portada: así el orden
            del DOM —y por tanto el del lector de pantalla y el del móvil, donde
            se apila— sigue siendo imagen y luego texto, se pinte como se pinte. */}
        <Reveal>
          <div className="ftd-dueto" style={{ direction: b.invertido ? 'rtl' : 'ltr' }}>
            <div style={{ direction: 'ltr' }}>
              {b.imagen_url && (
                <figure style={{ margin: 0 }}>
                  <Img src={b.imagen_url} alt={pie || titulo} contexto="tarjeta"
                    style={{ width: '100%', height: 'auto', display: 'block' }} />
                  {pie && <figcaption style={pieStyle}>{pie}</figcaption>}
                </figure>
              )}
            </div>
            <div style={{ direction: 'ltr' }}>
              {titulo && <h2 style={h2Style}>{titulo}</h2>}
              {cuerpo && <p style={{ ...cuerpoStyle, marginTop: titulo ? 18 : 0 }}>{cuerpo}</p>}
            </div>
          </div>
        </Reveal>
      </Marco>
    )
  }

  // 'texto': el título a la izquierda y el cuerpo a la derecha. Es la disposición
  // editorial de toda la vida y la que mejor aguanta párrafos largos: la columna
  // de lectura se queda en su medida en vez de estirarse a 1440 px.
  return (
    <Marco>
      <Reveal>
        <div className="ftd-texto">
          <div>{titulo && <h2 style={h2Style}>{titulo}</h2>}</div>
          <div>{cuerpo && <p style={cuerpoStyle}>{cuerpo}</p>}</div>
        </div>
      </Reveal>
    </Marco>
  )
}

function Cta({ url, label }: { url: string; label: string }) {
  const external = /^https?:\/\//i.test(url)
  if (external) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="ftd-link" data-cursor="">
        <span>{label} ↗</span>
      </a>
    )
  }
  return (
    <Link href={url.startsWith('/') ? href(url) : url} className="ftd-link" data-cursor="">
      <span>{label} →</span>
    </Link>
  )
}

const h2Style: React.CSSProperties = {
  fontSize: display.h2, fontWeight: 300, letterSpacing: '-0.015em', lineHeight: 1.18,
  margin: 0, maxWidth: '18ch',
}
const cuerpoStyle: React.CSSProperties = {
  fontSize: '1rem', fontWeight: 300, lineHeight: 1.75, opacity: 0.72,
  margin: 0, maxWidth: '58ch', whiteSpace: 'pre-wrap',
}
const pieStyle: React.CSSProperties = {
  margin: '14px 0 0', fontSize: 10, letterSpacing: site.track.tight,
  textTransform: 'uppercase', opacity: 0.4,
}

const CSS = `
.ftd-texto {
  display: grid; grid-template-columns: 1fr; gap: 20px;
}
.ftd-dueto {
  display: grid; grid-template-columns: 1fr; gap: clamp(24px, 4vw, 70px); align-items: center;
}
@media (min-width: 821px) {
  /* El título no se lleva la mitad: en una rejilla partida por la mitad, cuatro
     palabras a la izquierda dejan un hueco enorme frente a un párrafo apretado. */
  .ftd-texto { grid-template-columns: 0.85fr 1.35fr; gap: clamp(30px, 5vw, 90px); align-items: start; }
  .ftd-dueto { grid-template-columns: 1fr 1fr; }
}

/* Mismo enlace que el footer: filete que se abre desde la izquierda y un empujón
   mínimo del texto. Se repite el estilo en vez de compartir clase porque el
   footer vive en otro árbol y acoplarlos ataría dos piezas que no se conocen. */
.ftd-link { position: relative; display: inline-block; text-decoration: none; color: inherit;
  font-size: 11px; letter-spacing: .26em; text-transform: uppercase; }
.ftd-link > span { display: inline-block; opacity: .72;
  transition: transform .5s cubic-bezier(.22,1,.36,1), opacity .35s ease; }
.ftd-link::after { content: ''; position: absolute; left: 0; bottom: -5px; width: 100%; height: 1px;
  background: currentColor; opacity: .5; transform: scaleX(0); transform-origin: left center;
  transition: transform .55s cubic-bezier(.22,1,.36,1); }
.ftd-link:hover > span { opacity: 1; transform: translateX(3px); }
.ftd-link:hover::after { transform: scaleX(1); }

@media (prefers-reduced-motion: reduce) {
  .ftd-link > span, .ftd-link::after { transition: none; }
}
`
