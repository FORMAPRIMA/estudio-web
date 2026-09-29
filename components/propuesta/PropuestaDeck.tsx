'use client'

// Reproductor de la propuesta. Un solo enlace, dos maneras de verla:
//   · desktop — diapositivas 1920×1080 a pantalla completa; se avanza con clic,
//     flechas, espacio, rueda o gesto. Contador, progreso y PDF.
//   · mobile  — el diseño vertical 1080×1920, una diapositiva tras otra a lo
//     ancho de la pantalla, y se recorre con scroll.
// El servidor elige por user-agent (para no parpadear); aquí se corrige por el
// tamaño real de la ventana, y se vuelve a corregir si la ventana cambia (una
// tablet que gira, un escritorio con la ventana estrecha).
//
// Sustituye al <deck-stage> de Claude Design, que es el reproductor del editor:
// pesa 82 KB, trae miniaturas y notas del orador, y en móvil avanza a toques.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animador, sinMovimiento } from './animaciones'
import SlideSiguiente, { type ProyectoEnlace } from './SlideSiguiente'
import { registrarEventoPropuestaWeb } from '@/app/actions/propuestasWeb'

type Variante = 'desktop' | 'mobile'

interface Props {
  desktop: string
  mobile: string
  inicial: Variante
  slug: string
  nombreCliente: string
  proyecto: string
  proyectos: ProyectoEnlace[]
}

function elegirVariante(): Variante {
  const w = window.innerWidth
  const h = window.innerHeight
  return w < 760 || (h > w && w < 1100) ? 'mobile' : 'desktop'
}

const cuentaSecciones = (html: string) => (html.match(/<section\b/g) || []).length

/** Número de capítulo para la diapositiva final: el siguiente al último del deck ("05 Cierre" → "06"). */
function siguienteCapitulo(html: string): string {
  // Las cabeceras de capítulo son "<span …opacity:.45;">05</span>Cierre": número seguido de su nombre.
  const nums = Array.from(html.matchAll(/opacity:\.45;">(\d{2})<\/span>[A-Za-zÁÉÍÓÚÑáéíóúñ]/g)).map((m) => parseInt(m[1], 10))
  return String((nums.length ? Math.max(...nums) : 5) + 1).padStart(2, '0')
}

export default function PropuestaDeck(props: Props) {
  const [variante, setVariante] = useState<Variante>(props.inicial)
  const finalAvisado = useRef(false)

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const ajustar = () => setVariante(elegirVariante())
    const alCambiar = () => { clearTimeout(t); t = setTimeout(ajustar, 150) }
    ajustar()
    window.addEventListener('resize', alCambiar)
    registrarEventoPropuestaWeb(props.slug, 'abierta').catch(() => {})
    return () => { clearTimeout(t); window.removeEventListener('resize', alCambiar) }
  }, [props.slug])

  const alFinal = useCallback(() => {
    if (finalAvisado.current) return
    finalAvisado.current = true
    registrarEventoPropuestaWeb(props.slug, 'final').catch(() => {})
  }, [props.slug])

  const html = variante === 'desktop' ? props.desktop : props.mobile
  const numero = siguienteCapitulo(html)
  const final = (
    <SlideSiguiente
      variante={variante}
      slug={props.slug}
      nombreCliente={props.nombreCliente}
      proyecto={props.proyecto}
      numero={numero}
      proyectos={props.proyectos}
    />
  )

  return (
    <div className="fpp-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {variante === 'desktop'
        ? <Desktop key="d" html={props.desktop} final={final} alFinal={alFinal} />
        : <Mobile key="m" html={props.mobile} final={final} alFinal={alFinal} />}
    </div>
  )
}

// ── Pista animada de la bienvenida ("Scroll" / "Clic · →") ───────────────────
function animarPista(root: HTMLElement, dy: number): (() => void) | undefined {
  const hint = root.querySelector('[data-hint]')
  if (!hint || sinMovimiento()) return
  const a = hint.animate(
    [{ transform: 'translateY(0)', opacity: 0.6 }, { transform: `translateY(${dy}px)`, opacity: 1 }, { transform: 'translateY(0)', opacity: 0.6 }],
    { duration: 1800, iterations: Infinity, easing: 'ease-in-out' },
  )
  return () => a.cancel()
}

const esInteractivo = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest('a,button,input,textarea,select,label,[data-no-nav]')

// ═════════════════════════════════════════════════════════════════════════════
// DESKTOP
// ═════════════════════════════════════════════════════════════════════════════
function Desktop({ html, final, alFinal }: { html: string; final: React.ReactNode; alFinal: () => void }) {
  const canvas = useRef<HTMLDivElement>(null)
  const anim = useRef<Animador>()
  const [i, setI] = useState(0)
  const [n, setN] = useState(() => cuentaSecciones(html) + 1)
  const [escala, setEscala] = useState(1)
  const [ui, setUi] = useState(true)
  const [puedeFs, setPuedeFs] = useState(false)

  // La primera diapositiva ya sale visible en el HTML del servidor.
  const inicial = useMemo(() => html.replace('<section', '<section data-deck-active=""'), [html])

  const slides = useCallback(() => Array.from(canvas.current?.querySelectorAll<HTMLElement>('section') ?? []), [])

  const ir = useCallback((d: number) => setI((x) => Math.max(0, Math.min(n - 1, x + d))), [n])

  // Montaje: escala, deep-link (#07), pista.
  useEffect(() => {
    anim.current = new Animador()
    setN(slides().length)
    setPuedeFs(!!document.documentElement.requestFullscreen)
    const m = location.hash.match(/^#(\d{1,2})$/)
    if (m) setI(Math.max(0, Math.min(slides().length - 1, parseInt(m[1], 10) - 1)))
    const medir = () => setEscala(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
    medir()
    window.addEventListener('resize', medir)
    const parar = canvas.current ? animarPista(canvas.current, 12) : undefined
    const imprimir = () => anim.current?.terminarTodo()
    window.addEventListener('beforeprint', imprimir)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('beforeprint', imprimir)
      parar?.()
      anim.current?.terminarTodo()
    }
  }, [slides])

  // Cambio de diapositiva.
  useEffect(() => {
    const ss = slides()
    const actual = ss[i]
    if (!actual) return
    ss.forEach((s) => (s === actual ? s.setAttribute('data-deck-active', '') : s.removeAttribute('data-deck-active')))
    ss.forEach((s) => s !== actual && anim.current?.terminar(s))
    // dos frames: que la diapositiva ya esté visible y medida a su escala final
    let r2 = 0
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => anim.current?.animar(actual)) })
    history.replaceState(null, '', i === 0 ? location.pathname : `#${String(i + 1).padStart(2, '0')}`)
    if (i === ss.length - 1) alFinal()
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [i, slides, alFinal])

  // Teclado, rueda, gestos.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (esInteractivo(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); ir(1) }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(k)) { e.preventDefault(); ir(-1) }
      else if (k === 'Home') setI(0)
      else if (k === 'End') setI(n - 1)
      else if (k === 'f' || k === 'F') pantallaCompleta()
    }
    let bloqueo = 0
    const rueda = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      if (Math.abs(d) < 20 || Date.now() < bloqueo) return
      bloqueo = Date.now() + 800
      ir(d > 0 ? 1 : -1)
    }
    let x0: number | null = null
    let y0 = 0
    const tStart = (e: TouchEvent) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY }
    const tEnd = (e: TouchEvent) => {
      if (x0 === null) return
      const dx = e.changedTouches[0].clientX - x0
      const dy = e.changedTouches[0].clientY - y0
      x0 = null
      const d = Math.abs(dx) > Math.abs(dy) ? dx : dy
      if (Math.abs(d) > 50) ir(d < 0 ? 1 : -1)
    }
    window.addEventListener('keydown', tecla)
    window.addEventListener('wheel', rueda, { passive: true })
    window.addEventListener('touchstart', tStart, { passive: true })
    window.addEventListener('touchend', tEnd, { passive: true })
    return () => {
      window.removeEventListener('keydown', tecla)
      window.removeEventListener('wheel', rueda)
      window.removeEventListener('touchstart', tStart)
      window.removeEventListener('touchend', tEnd)
    }
  }, [ir, n])

  // Los controles se retiran solos cuando el ratón se queda quieto.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const mostrar = () => { setUi(true); clearTimeout(t); t = setTimeout(() => setUi(false), 2600) }
    mostrar()
    window.addEventListener('mousemove', mostrar)
    return () => { clearTimeout(t); window.removeEventListener('mousemove', mostrar) }
  }, [])

  const clic = (e: React.MouseEvent) => {
    if (esInteractivo(e.target)) return
    if (window.getSelection()?.toString()) return
    ir(e.clientX < window.innerWidth * 0.3 ? -1 : 1)
  }

  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const pdf = () => {
    anim.current?.terminarTodo()
    slides().forEach((s) => anim.current?.terminar(s))
    window.print()
  }

  return (
    <div className="fpd-stage" onClick={clic}>
      <div ref={canvas} className="fpd-canvas" style={{ transform: `scale(${escala})` }}>
        <div className="fpd-slides" dangerouslySetInnerHTML={{ __html: inicial }} />
        {final}
      </div>

      <div className="fpd-progreso" style={{ transform: `scaleX(${(i + 1) / n})` }} />

      <div className={`fpd-ui${ui ? ' on' : ''}`} data-no-nav="">
        <button type="button" aria-label="Anterior" disabled={i === 0} onClick={() => ir(-1)}>←</button>
        <span className="fpd-n">{String(i + 1).padStart(2, '0')}<span> / {String(n).padStart(2, '0')}</span></span>
        <button type="button" aria-label="Siguiente" disabled={i === n - 1} onClick={() => ir(1)}>→</button>
        <span className="fpd-sep" />
        <button type="button" className="fpd-txt" onClick={pdf}>PDF</button>
        {puedeFs && <button type="button" aria-label="Pantalla completa" onClick={pantallaCompleta}>⤢</button>}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MOBILE
// ═════════════════════════════════════════════════════════════════════════════
function Mobile({ html, final, alFinal }: { html: string; final: React.ReactNode; alFinal: () => void }) {
  // Scroll "a imanes": cada diapositiva ocupa la pantalla y el scroll se detiene
  // siempre en una (scroll-snap, una por gesto). Cada una va en su propia página
  // SIN transformar —el encaje y la detección de cuál está en pantalla se hacen
  // sobre cajas reales—, y dentro se escala el lienzo 1080×1920 para que quepa
  // entero. El margen que sobra toma el color de fondo de la propia diapositiva.
  const scroller = useRef<HTMLDivElement>(null)
  const barra = useRef<HTMLDivElement>(null)
  const partes = useMemo(() => html.match(/<section\b[\s\S]*?<\/section>/g) ?? [], [html])
  const [medida, setMedida] = useState({ escala: 0, alto: 1920 })

  useEffect(() => {
    const sc = scroller.current
    if (!sc) return
    // El lienzo mide 1080 de ancho y se estira en alto hasta la proporción de la
    // pantalla (un iPhone es más alargado que 9:16), para que cada diapositiva la
    // llene entera. Nunca baja de 1920: en pantallas más chatas se encaja entera
    // y sobra un filo a los lados.
    const medir = () => {
      const w = sc.clientWidth
      const h = sc.clientHeight
      const alto = Math.max(1920, Math.round((1080 * h) / w))
      setMedida({ escala: Math.min(w / 1080, h / alto), alto })
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(sc)

    const anim = new Animador()
    const paginas = Array.from(sc.querySelectorAll<HTMLElement>('.fpm-page'))
    paginas.forEach((p) => {
      const s = p.querySelector('section')
      if (s) p.style.background = getComputedStyle(s).backgroundColor
    })

    // Una diapositiva se "enciende" (y se anima) al entrar en cuadro, y se apaga
    // al salir del todo: al volver a ella se anima otra vez, como en escritorio.
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        const p = en.target as HTMLElement
        const s = p.querySelector('section') as HTMLElement | null
        if (!s) return
        if (en.isIntersecting && en.intersectionRatio >= 0.4 && !p.classList.contains('on')) {
          p.classList.add('on')
          anim.animar(s)
          anim.carrusel(s, true)
          const i = paginas.indexOf(p)
          if (barra.current) barra.current.style.transform = `scaleX(${(i + 1) / paginas.length})`
          if (i === paginas.length - 1) alFinal()
        } else if (!en.isIntersecting && p.classList.contains('on')) {
          p.classList.remove('on')
          anim.terminar(s)
          anim.carrusel(s, false)
        }
      })
    }, { root: sc, threshold: [0, 0.4, 0.75] })
    paginas.forEach((p) => io.observe(p))

    const parar = animarPista(sc, -18)
    const imprimir = () => { anim.terminarTodo(); anim.pararCarruseles() }
    window.addEventListener('beforeprint', imprimir)
    return () => {
      io.disconnect()
      ro.disconnect()
      paginas.forEach((p) => p.classList.remove('on'))
      window.removeEventListener('beforeprint', imprimir)
      parar?.()
      anim.pararCarruseles()
      anim.terminarTodo()
    }
  }, [alFinal, partes])

  const { escala, alto } = medida
  const marco = { width: 1080 * escala, height: alto * escala }
  const lienzo = { height: alto, transform: `scale(${escala})` }

  return (
    <div className="fpm" ref={scroller} style={{ visibility: escala ? 'visible' : 'hidden' }}>
      <div className="fpm-barra" ref={barra} />
      {partes.map((h, i) => (
        <div className="fpm-page" key={i}>
          <div className="fpm-marco" style={marco}>
            <div className="fpm-escala" style={lienzo}><HtmlFijo html={h} /></div>
          </div>
        </div>
      ))}
      <div className="fpm-page">
        <div className="fpm-marco" style={marco}>
          <div className="fpm-escala" style={lienzo}><div className="fpm-lienzo">{final}</div></div>
        </div>
      </div>
    </div>
  )
}

/**
 * El HTML de una diapositiva, fuera del alcance de los re-renders. Sin el memo,
 * cada cambio de escala volvía a volcar el innerHTML y se llevaba por delante
 * las animaciones recién arrancadas (en el iPhone no se veía ninguna).
 */
const HtmlFijo = memo(function HtmlFijo({ html }: { html: string }) {
  return <div className="fpm-lienzo" dangerouslySetInnerHTML={{ __html: html }} />
})

// ═════════════════════════════════════════════════════════════════════════════
// Estilos. Las diapositivas traen sus estilos en línea; esto solo neutraliza el
// preflight de Tailwind (interlineado 1.5, peso 300 del body) y monta el escenario.
// ═════════════════════════════════════════════════════════════════════════════
const CSS = `
html,body{background:#0d0d0d!important;}
.fpp-root{font-family:'Hanken Grotesk',sans-serif;font-weight:400;line-height:normal;color:#fbfbfa;}
.fpp-root *{box-sizing:border-box;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
.fpp-root img{max-width:none;}

.fpp-btn-p:hover{background:transparent!important;color:#fbfbfa!important;}
.fpp-btn-s:hover{border-color:#fbfbfa!important;}
.fpp-card img{transition:transform 1.2s cubic-bezier(.16,1,.3,1),filter .6s;}
.fpp-card:hover img{transform:scale(1.04);filter:saturate(1)!important;}
.fpp-web .fpp-flecha{transition:transform .4s cubic-bezier(.16,1,.3,1);}
.fpp-web:hover .fpp-flecha{transform:translateX(10px);}

.fpd-stage{position:fixed;inset:0;overflow:hidden;background:#0d0d0d;display:flex;align-items:center;justify-content:center;}
.fpd-canvas{position:relative;width:1920px;height:1080px;flex-shrink:0;transform-origin:center center;}
.fpd-slides{position:absolute;inset:0;}
.fpd-canvas section{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;overflow:hidden;visibility:hidden;opacity:0;pointer-events:none;}
.fpd-canvas section[data-deck-active]{visibility:visible;opacity:1;pointer-events:auto;}
.fpd-progreso{position:fixed;left:0;right:0;bottom:0;height:2px;background:#8fa596;transform-origin:0 50%;transition:transform .6s cubic-bezier(.16,1,.3,1);opacity:.8;}
.fpd-ui{position:fixed;right:24px;bottom:20px;display:flex;align-items:center;gap:4px;padding:6px 8px;background:rgba(13,13,13,.62);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(251,251,250,.1);color:rgba(251,251,250,.85);font:400 13px/1 'Hanken Grotesk',sans-serif;opacity:0;transform:translateY(6px);transition:opacity .4s,transform .4s;pointer-events:none;}
.fpd-ui.on{opacity:1;transform:none;pointer-events:auto;}
.fpd-ui button{appearance:none;background:none;border:0;color:inherit;font:inherit;font-size:15px;min-width:34px;height:30px;cursor:pointer;opacity:.85;}
.fpd-ui button:hover:not(:disabled){opacity:1;color:#8fa596;}
.fpd-ui button:disabled{opacity:.25;cursor:default;}
.fpd-ui .fpd-txt{font-size:11px;font-weight:600;letter-spacing:.2em;padding:0 8px;}
.fpd-n{font-variant-numeric:tabular-nums;letter-spacing:.06em;padding:0 6px;}
.fpd-n span{opacity:.45;}
.fpd-sep{width:1px;height:16px;background:rgba(251,251,250,.18);margin:0 6px;}

.fpm{position:fixed;inset:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:none;-webkit-overflow-scrolling:touch;scroll-snap-type:y mandatory;background:#0d0d0d;scrollbar-width:none;}
.fpm::-webkit-scrollbar{display:none;}
.fpm-page{position:relative;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always;}
.fpm-marco{position:relative;flex:none;overflow:hidden;}
.fpm-escala{position:absolute;top:0;left:0;width:1080px;transform-origin:0 0;}
.fpm-lienzo{width:100%;height:100%;}
.fpm-lienzo > section{position:relative!important;width:1080px!important;height:100%!important;overflow:hidden;}
.fpm-page:not(.on) .fpm-lienzo > section{opacity:0;}
.fpm-barra{position:fixed;top:0;left:0;right:0;height:3px;background:#8fa596;transform:scaleX(0);transform-origin:0 50%;transition:transform .5s cubic-bezier(.16,1,.3,1);z-index:10;}
@media (prefers-reduced-motion:reduce){.fpm-page:not(.on) .fpm-lienzo > section{opacity:1;}}

@media print{
  @page{size:1920px 1080px;margin:0;}
  html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .fpd-stage{position:static;display:block;overflow:visible;}
  .fpd-canvas{transform:none!important;width:1920px;height:auto;}
  .fpd-slides{position:static;}
  .fpd-canvas section{position:relative!important;inset:auto!important;width:1920px!important;height:1080px!important;visibility:visible!important;opacity:1!important;break-after:page;page-break-after:always;}
  .fpd-canvas > section:last-child{break-after:auto;page-break-after:auto;}
  .fpd-ui,.fpd-progreso,.fpm-barra{display:none!important;}
}
`
