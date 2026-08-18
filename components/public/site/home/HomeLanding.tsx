'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { site, display } from '../theme'
import { useSite, href } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { Img } from '../Img'
import { pick, esSi, esNo, type ContentMap } from '@/lib/web-publica'
import { IntroVideo } from './IntroVideo'
import { useDesign, useEstilo, usePropio } from '../design/DesignProvider'
import { Editable } from '../design/Editable'
import { aplicarEstilo } from '../design/aplicarEstilo'

export interface HomeBackground {
  src: string
  srcMobile: string | null
  nombre: string | null
  ubicacion: string | null
  anio: string | null
  /** Slug del proyecto de esta foto: la portada entera enlaza a su ficha. */
  slug: string | null
}

const DURATION = 6800 // ms por fondo


export function HomeLanding({ content, backgrounds }: { content: ContentMap; backgrounds: HomeBackground[] }) {
  const { locale, mobile } = useSite()
  const design = useDesign()
  const [idx, setIdx] = useState(0)
  const [reduced, setReduced] = useState(false)

  // La Home es solo imagen: el texto está OCULTO por defecto y se recupera desde
  // el CMS (Marketing → Web pública → Home → Portada). Ocultar, no borrar: el
  // titular sigue guardado en web_content esperando a que Jose lo reactive.
  const mostrarTextoWeb = esSi(pick(content, 'hero', 'mostrar_texto', { locale, mobile }))
  // En Modo Diseño el texto oculto SÍ se pinta (atenuado y con su chapa «oculto»):
  // no se puede afinar el tamaño de un titular que no se ve, y así se decide con
  // el resultado delante antes de encenderlo.
  const mostrarTexto = mostrarTextoWeb || design.active
  // El pie con el nombre del proyecto SÍ se muestra por defecto (solo se oculta
  // escribiendo "no"): es crédito de la foto, no titular de portada.
  const mostrarPie = !esNo(pick(content, 'hero', 'mostrar_pie', { locale, mobile }))

  // Un bloque vacío no se pinta, y lo que no se pinta no se puede seleccionar: en
  // Modo Diseño se le pone un texto fantasma para tener dónde hacer doble clic y
  // empezar a escribir. Nunca llega a la web (solo existe con el Studio abierto).
  const fantasma = (valor: string, ph: string) => valor || (design.active ? ph : '')
  const eyebrow = mostrarTexto ? fantasma(pick(content, 'hero', 'eyebrow', { locale, mobile }), locale === 'en' ? 'Eyebrow' : 'Antetítulo') : ''
  const titulo = mostrarTexto ? fantasma(pick(content, 'hero', 'titulo', { locale, mobile }), locale === 'en' ? 'Headline' : 'Titular') : ''
  const subtitulo = mostrarTexto ? fantasma(pick(content, 'hero', 'subtitulo', { locale, mobile }), locale === 'en' ? 'Subtitle' : 'Subtítulo') : ''

  // Ajustes de tamaño/tracking/peso hechos desde el Studio (Modo Diseño). En
  // lectura normal devuelven {} y cada bloque se pinta con su token de siempre.
  const estEyebrow = useEstilo(content, 'hero', 'eyebrow')
  const estTitulo = useEstilo(content, 'hero', 'titulo')
  const estSubtitulo = useEstilo(content, 'hero', 'subtitulo')
  const proEyebrow = usePropio(content, 'hero', 'eyebrow')
  const proTitulo = usePropio(content, 'hero', 'titulo')
  const proSubtitulo = usePropio(content, 'hero', 'subtitulo')

  const has = backgrounds.length > 0

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // ── La Home no scrollea: se bloquea el documento mientras está montada ─────
  // En móvil `100vh` es el viewport GRANDE (barra del navegador oculta) mientras
  // `innerHeight` es el pequeño: la Home medía ~100 px más que la pantalla y se
  // podía arrastrar sin tener nada debajo. Y peor: al arrastrar, la barra se
  // retraía, el viewport crecía y el overlay fijo del vídeo de intro se estiraba
  // con él, moviendo la invitación anclada al pie mientras la pieza corría.
  //
  // Con el documento bloqueado la barra ya no se retrae, el viewport queda quieto
  // y además `scrollHeight === innerHeight`, que es justo la condición que el
  // amago del nav exige para encenderse (SiteNav, bump()) y que en móvil nunca se
  // cumplía. Un solo arreglo cierra las tres cosas.
  //
  // En Modo Diseño no: el Studio necesita el documento vivo.
  useEffect(() => {
    if (design.active) return
    const html = document.documentElement
    const body = document.body
    const previo = [html.style.cssText, body.style.cssText] as const
    for (const el of [html, body]) {
      el.style.height = '100vh'   // peldaño para navegadores sin dvh
      el.style.height = '100dvh'
      el.style.overflow = 'hidden'
      el.style.overscrollBehavior = 'none'
    }
    return () => { html.style.cssText = previo[0]; body.style.cssText = previo[1] }
  }, [design.active])

  // Rotación de fondos. Se PARA mientras se edita un texto: por respeto a quien
  // compone (juzgar un titular con la foto cambiando debajo es imposible) y por
  // una razón técnica — cada cambio de fondo re-renderiza esta pantalla y le
  // borraría al editor lo que está escribiendo.
  useEffect(() => {
    if (!has || backgrounds.length < 2 || reduced || design.editing) return
    const t = setInterval(() => setIdx((i) => (i + 1) % backgrounds.length), DURATION)
    return () => clearInterval(t)
  }, [has, backgrounds.length, reduced, design.editing])

  const current = backgrounds[idx]

  return (
    <main style={{ position: 'relative', minHeight: '100dvh', background: site.color.stage, color: site.color.white, fontFamily: site.font, overflow: 'hidden' }}>
      <Hero backgrounds={backgrounds} idx={idx} mobile={mobile} reduced={reduced} />

      {/* Scrim para legibilidad del titular. Sin texto no hay nada que proteger:
          se retira para que la foto se vea limpia. */}
      {mostrarTexto && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'radial-gradient(120% 90% at 50% 55%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 100%)' }} />
      )}

      {/* La portada entera enlaza al proyecto de la foto que se está viendo. Va
          por encima del titular (que no es interactivo) y por debajo del nav. El
          destino cambia con el crossfade: el pie de abajo dice de quién es.
          En Modo Diseño se retira: si no, cada clic para seleccionar el titular
          se convertiría en una navegación a la ficha del proyecto. */}
      {current?.slug && !design.active && (
        <Link href={href(`/proyectos/${current.slug}`)}
          data-cursor={locale === 'en' ? 'View project' : 'Ver proyecto'}
          aria-label={[locale === 'en' ? 'View project' : 'Ver proyecto', current.nombre].filter(Boolean).join(': ')}
          style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'block' }} />
      )}

      {/* Titular centrado */}
      <section style={{ position: 'relative', zIndex: 3, minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: `0 ${site.gutter}`,
        // En lectura el titular no intercepta el ratón (la portada entera es un
        // enlace al proyecto); en Modo Diseño sí, para poder seleccionarlo.
        pointerEvents: design.active ? 'auto' : 'none' }}>
        {eyebrow && (
          <Reveal as="p" delay={0} style={{ textTransform: 'uppercase',
            color: site.color.white, opacity: 0.85, margin: '0 0 22px',
            ...aplicarEstilo({ fontSize: display.eyebrow, letterSpacing: site.track.ultra }, estEyebrow) }}>
            <Editable pagina="home" seccion="hero" clave="eyebrow" estilo={estEyebrow} propio={proEyebrow}
              oculto={!mostrarTextoWeb} interruptor="hero.mostrar_texto">{eyebrow}</Editable>
          </Reveal>
        )}
        {titulo && (
          <Reveal as="h1" delay={120} style={{ lineHeight: 1.2, margin: 0, maxWidth: '22ch',
            ...aplicarEstilo({ fontSize: display.hero, letterSpacing: '0', fontWeight: 300 }, estTitulo) }}>
            <Editable pagina="home" seccion="hero" clave="titulo" estilo={estTitulo} propio={proTitulo}
              oculto={!mostrarTextoWeb} interruptor="hero.mostrar_texto">{titulo}</Editable>
          </Reveal>
        )}
        {subtitulo && (
          <Reveal as="p" delay={260} style={{ opacity: 0.82, margin: '24px 0 0', maxWidth: '42ch', lineHeight: 1.55,
            ...aplicarEstilo({ fontSize: 'clamp(0.9rem, 1.6vw, 1.15rem)', fontWeight: 300 }, estSubtitulo) }}>
            <Editable pagina="home" seccion="hero" clave="subtitulo" estilo={estSubtitulo} propio={proSubtitulo}
              oculto={!mostrarTextoWeb} interruptor="hero.mostrar_texto">{subtitulo}</Editable>
          </Reveal>
        )}
      </section>

      {/* Caption del proyecto actual + índice */}
      {mostrarPie && has && current && (
        <div style={{ position: 'absolute', left: site.gutter, bottom: 30, zIndex: 3, display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontSize: 11, letterSpacing: site.track.wide, fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>
            {String(idx + 1).padStart(2, '0')} / {String(backgrounds.length).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 12, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.9 }}>
            {[current.nombre, current.ubicacion].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}

      {/* Sin hint de scroll: la Home es una sola pantalla y no scrollea, así que
          invitaba a un gesto que no existe (retirado a petición de Jose). */}

      {/* La intro no se monta en Modo Diseño: taparía el canvas con un vídeo a
          pantalla completa que hay que despachar a doble clic antes de poder
          tocar nada. El vídeo se sigue gestionando en el CMS clásico. */}
      {!design.active && <IntroVideo content={content} locale={locale} mobile={mobile} />}
    </main>
  )
}

/** Capa de fondos con crossfade + parallax de ratón (desktop). */
function Hero({ backgrounds, idx, mobile, reduced }: { backgrounds: HomeBackground[]; idx: number; mobile: boolean; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null)

  // Qué fondos tienen permiso para existir en el DOM.
  //
  // Antes se montaban los seis a la vez con opacity:0 para el crossfade, y el
  // navegador se descargaba los seis en el primer paint: 31 MB para ver uno. Ahora
  // solo el actual y el siguiente, más los ya vistos —que están en caché y quitarlos
  // provocaría una recarga al volver el ciclo—. El siguiente entra montado y a
  // opacity 0, así que llega decodificado cuando le toca y el fundido no parpadea.
  const [montados, setMontados] = useState<Set<number>>(() => new Set([0, backgrounds.length > 1 ? 1 : 0]))
  useEffect(() => {
    setMontados((prev) => {
      const siguiente = (idx + 1) % Math.max(backgrounds.length, 1)
      if (prev.has(idx) && prev.has(siguiente)) return prev
      const n = new Set(prev); n.add(idx); n.add(siguiente); return n
    })
  }, [idx, backgrounds.length])

  useEffect(() => {
    if (mobile || reduced) return
    const el = ref.current
    if (!el) return
    let raf = 0
    let tx = 0, ty = 0, cx = 0, cy = 0
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * -24
      ty = (e.clientY / window.innerHeight - 0.5) * -24
    }
    const tick = () => {
      cx += (tx - cx) * 0.06
      cy += (ty - cy) * 0.06
      el.style.transform = `scale(1.06) translate(${cx}px, ${cy}px)`
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('mousemove', onMove)
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf) }
  }, [mobile, reduced])

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, zIndex: 1, transform: 'scale(1.06)', willChange: 'transform' }}>
      {backgrounds.map((b, i) => {
        if (!montados.has(i)) return null
        const url = mobile && b.srcMobile ? b.srcMobile : b.src
        return (
          <div key={b.src + i} aria-hidden={i !== idx}
            style={{
              position: 'absolute', inset: 0,
              opacity: i === idx ? 1 : 0, transition: `opacity 1.6s ${site.ease}`,
            }}>
            {/* <Img> en vez del backgroundImage que había aquí: un fondo CSS no
                admite srcset, así que el navegador se bajaba el original de 18 MB
                pasara lo que pasara. Con objectFit cover y objectPosition center el
                resultado visual es idéntico. */}
            <Img src={url} alt="" contexto="hero" prioridad={i === 0}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
          </div>
        )
      })}
      {backgrounds.length === 0 && <div style={{ position: 'absolute', inset: 0, background: '#111' }} />}
    </div>
  )
}
