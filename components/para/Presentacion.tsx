'use client'

// Dossier de prospección: formaprima.es/para/<token>. Una sola página fluida
// (mobile first, de 360 px a pantallas ultraanchas) que se recorre con scroll.
// Cada pantalla es una «diapositiva» de 100svh; las interactivas (mapa, maqueta)
// no atrapan el scroll: se exploran a pantalla completa con un gesto explícito.
//
// Escala y lenguaje de Torre del Mangle: Hanken Grotesk 200/300, Newsreader
// cursiva en los antetítulos, negro #0d0d0d, papel #f4f3f0, salvia #8fa596,
// curva cubic-bezier(.16,1,.3,1). Nada por debajo de 12 px.

import dynamic from 'next/dynamic'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { MapaPunto } from '@/lib/web-mapa'
import { T, mesAnio, type Idioma, type LeadPara, type Textos } from '@/lib/para/textos'
import { ETIQUETA, PANTALLAS, type PantallaId } from '@/lib/para/pantallas'
import { useMedicionSala } from '@/components/propuesta/medicionSala'
import type { EstadoAgendaCliente } from './Agenda'
import { CSS_PANTALLAS, Colaboracion, Dossier, Ejecucion, Equipo, Estudio, Hablemos, Obra, Portal, PortalVideo, Porque, Producto, VisualLab, VR } from './Pantallas'

// Hueco de pantalla completa mientras llega el código: la página no salta.
const Hueco = ({ claro }: { claro?: boolean }) => <section className="p-escena" style={{ background: claro ? '#f4f3f0' : '#0d0d0d' }} />
const MapaObras = dynamic(() => import('./MapaObras'), { ssr: false, loading: () => <Hueco /> })
const MaquetaTorre = dynamic(() => import('./MaquetaTorre'), { ssr: false, loading: () => <Hueco claro /> })

/** true en cuanto el elemento entra en pantalla al menos `umbral` (y se queda en true). */
export function useVisto<T extends HTMLElement>(umbral = 0.35) {
  const ref = useRef<T>(null)
  const [visto, setVisto] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || visto) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisto(true); io.disconnect() } }, { threshold: umbral })
    io.observe(el)
    return () => io.disconnect()
  }, [umbral, visto])
  return [ref, visto] as const
}

/** true mientras el elemento está en pantalla (para pausar 3D y mapa fuera de ella). */
export function useEnPantalla<T extends HTMLElement>(margen = '0px') {
  const ref = useRef<T>(null)
  const [dentro, setDentro] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setDentro(e.isIntersecting), { rootMargin: margen })
    io.observe(el)
    return () => io.disconnect()
  }, [margen])
  return [ref, dentro] as const
}

/** Bloquea el scroll de la página mientras se explora un interactivo a pantalla completa. */
export function useBloqueoScroll(activo: boolean) {
  useEffect(() => {
    if (!activo) return
    const h = document.documentElement, prev = h.style.overflow
    h.style.overflow = 'hidden'
    return () => { h.style.overflow = prev }
  }, [activo])
}

export default function Presentacion({ lead, puntos, mapboxToken, medicion = null, agenda, token = null }: {
  lead: LeadPara; puntos: MapaPunto[]; mapboxToken: string | null
  agenda: EstadoAgendaCliente
  /** El enlace del lead (para reservar); null en la muestra. */
  token?: string | null
  /** Clave de medición (`para:<token>`); null = no se mide (muestra, equipo). */
  medicion?: string | null
}) {
  const [idioma, setIdioma] = useState<Idioma>(lead.idioma)
  const t = T[idioma]
  const orden = PANTALLAS[lead.perfil]
  const { alSlide, alEvento } = useMedicionSala(medicion ?? '', !!medicion)

  // Una pantalla por gesto. En táctil lo hace el CSS (scroll-snap obligatorio con
  // scroll-snap-stop: no se puede saltar ninguna). En escritorio la rueda y el
  // trackpad pasan por aquí: el primer movimiento de un gesto lleva a la pantalla
  // siguiente y el resto del gesto —la inercia del trackpad— se ignora hasta que
  // termina, así nunca se saltan dos. Teclado: flechas, Av/Re Pág y espacio.
  useEffect(() => {
    const secciones = () => Array.from(document.querySelectorAll<HTMLElement>('[data-pantalla]'))
    const actual = () => {
      const ss = secciones(); let i = 0, mejor = Infinity
      ss.forEach((el, k) => { const d = Math.abs(el.getBoundingClientRect().top); if (d < mejor) { mejor = d; i = k } })
      return i
    }
    const bloqueada = () => document.documentElement.style.overflow === 'hidden'
    const ir = (paso: number) => {
      const ss = secciones(), i = actual(), j = Math.max(0, Math.min(ss.length - 1, i + paso))
      if (j !== i) ss[j].scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
    let armado = true, t0 = 0, ultimo = 0, acum = 0
    const rueda = (e: WheelEvent) => {
      if (bloqueada() || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      if ((e.target as HTMLElement).closest?.('textarea, .p-agenda-dias, [data-scroll-propio]')) return
      e.preventDefault()
      const ahora = Date.now(), pausa = ahora - ultimo
      ultimo = ahora
      if (!armado && pausa > 200 && ahora - t0 > 650) armado = true
      if (!armado) return
      acum += e.deltaY
      if (Math.abs(acum) < 18) return
      ir(acum > 0 ? 1 : -1)
      armado = false; t0 = ahora; acum = 0
    }
    const teclas = (e: KeyboardEvent) => {
      if (bloqueada() || e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return
      const el = e.target as HTMLElement
      if (el.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === ' ' && el.closest?.('button, a')) return
      const paso = ['ArrowDown', 'PageDown', ' '].includes(e.key) ? (e.shiftKey && e.key === ' ' ? -1 : 1) : ['ArrowUp', 'PageUp'].includes(e.key) ? -1 : 0
      if (!paso) return
      e.preventDefault(); ir(paso)
    }
    window.addEventListener('wheel', rueda, { passive: false })
    window.addEventListener('keydown', teclas)
    return () => { window.removeEventListener('wheel', rueda); window.removeEventListener('keydown', teclas) }
  }, [])

  // Qué pantalla se está viendo: la que ocupa el centro de la ventana.
  useEffect(() => {
    const vistas = new Map<Element, number>()
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => vistas.set(e.target, e.intersectionRatio))
      let mejor: Element | null = null, r = 0
      vistas.forEach((v, el) => { if (v > r) { r = v; mejor = el } })
      const id = (mejor as HTMLElement | null)?.dataset.pantalla as PantallaId | undefined
      if (id && r > 0.35) alSlide(orden.indexOf(id), orden.length, ETIQUETA[id])
    }, { threshold: [0, 0.2, 0.35, 0.5, 0.7, 0.9] })
    const observar = () => document.querySelectorAll('[data-pantalla]').forEach((el) => io.observe(el))
    observar()
    // el mapa y la maqueta llegan después (import dinámico): se observan al aparecer
    const mo = new MutationObserver(observar)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => { io.disconnect(); mo.disconnect() }
  }, [orden, alSlide])

  const [progreso, setProgreso] = useState(0)
  const [pasada, setPasada] = useState(false)
  const [claro, setClaro] = useState(false)

  useEffect(() => {
    document.documentElement.lang = idioma
  }, [idioma])

  useEffect(() => {
    let raf = 0
    const medir = () => {
      raf = 0
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      setProgreso(max > 0 ? h.scrollTop / max : 0)
      setPasada(h.scrollTop > window.innerHeight * 0.6)
      // la barra cambia de tinta sobre las pantallas claras (la maqueta)
      const y = 36
      setClaro(Array.from(document.querySelectorAll<HTMLElement>('[data-tema="claro"]')).some((el) => {
        const r = el.getBoundingClientRect()
        return r.top <= y && r.bottom > y
      }))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(medir) }
    medir()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [])

  function pantalla(id: PantallaId, num: number) {
    switch (id) {
      case 'portada': return <Portada lead={lead} t={t} idioma={idioma} />
      case 'estudio': return <Estudio t={t} lead={lead} num={num} />
      case 'mapa': return <MapaObras puntos={puntos} t={t} idioma={idioma} token={mapboxToken} num={num} alEvento={alEvento} />
      case 'obra': return <Obra t={t} num={num} />
      case 'equipo': return <Equipo t={t} lead={lead} num={num} />
      case 'producto': return <Producto t={t} num={num} />
      case 'ejecucion': return <Ejecucion t={t} num={num} />
      case 'colaboracion': return <Colaboracion t={t} num={num} />
      case 'visuallab': return <VisualLab t={t} num={num} />
      case 'maqueta': return <MaquetaTorre t={t} num={num} alEvento={alEvento} />
      case 'dossier': return <Dossier t={t} num={num} alEvento={alEvento} />
      case 'vr': return <VR t={t} num={num} alEvento={alEvento} />
      case 'portal': return <Portal t={t} idioma={idioma} num={num} alEvento={alEvento} />
      case 'portalvideo': return <PortalVideo t={t} num={num} alEvento={alEvento} />
      case 'porque': return <Porque t={t} lead={lead} num={num} />
      case 'hablemos': return <Hablemos t={t} idioma={idioma} lead={lead} num={num} alEvento={alEvento} agenda={agenda} token={token} />
    }
  }

  return (
    <div className="para">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={`p-progreso${claro ? ' claro' : ''}`} style={{ transform: `scaleX(${progreso})` }} aria-hidden />
      <header className={`p-barra${pasada ? ' on' : ''}${claro ? ' claro' : ''}`}>
        <img src="/para/logo-h-white.png" alt="Forma Prima" className="p-barra-logo" />
        <button type="button" className="p-idioma" onClick={() => { const n = idioma === 'es' ? 'en' : 'es'; setIdioma(n); alEvento('idioma', n) }} lang={idioma === 'es' ? 'en' : 'es'}>
          {t.idioma}
        </button>
      </header>

      {orden.map((id, i) => <Fragment key={id}>{pantalla(id, i)}</Fragment>)}
      <style dangerouslySetInnerHTML={{ __html: CSS_PANTALLAS }} />
    </div>
  )
}

function Portada({ lead, t, idioma }: { lead: LeadPara; t: Textos; idioma: Idioma }) {
  const [listo, setListo] = useState(false)
  useEffect(() => { const r = requestAnimationFrame(() => setListo(true)); return () => cancelAnimationFrame(r) }, [])
  const fecha = mesAnio(new Date(), idioma)
  return (
    <section data-pantalla="portada" className={`p-portada${listo ? ' in' : ''}`} aria-label="Forma Prima">
      <div className="p-portada-img">
        <img
          src="/para/portada-1400.webp"
          srcSet="/para/portada-800.webp 800w, /para/portada-1400.webp 1400w"
          sizes="(min-width: 1024px) 50vw, 100vw"
          alt=""
          fetchPriority="high"
        />
      </div>
      <div className="p-portada-txt">
        <div className="p-marcas">
          <img src="/para/logo-h-white.png" alt="Forma Prima" className="p-marca-fp" />
          <span className="p-marcas-lead">
            <span className="p-marcas-x" aria-hidden>×</span>
            {lead.logo
              ? <img src={lead.logo} alt={lead.empresa} className="p-marca-lead" />
              : <span className="p-marca-texto">{lead.empresa}</span>}
          </span>
        </div>

        <div className="p-portada-centro">
          <p className="p-it p-a" style={{ ['--d' as string]: '.55s' }}>{t.preparado(lead.empresa, fecha)}</p>
          <h1 className="p-portada-h1">
            <span className="p-linea"><span style={{ ['--d' as string]: '.7s' }}>{t.hola(lead.nombre)}</span></span>
            <span className="p-linea"><span style={{ ['--d' as string]: '.84s' }}>{t.marca}</span></span>
          </h1>
          <span className="p-raya p-a" style={{ ['--d' as string]: '1.15s' }} aria-hidden />
          <p className="p-lema p-a" style={{ ['--d' as string]: '1.25s' }}>{t.lema[lead.perfil]}</p>
        </div>

        <div className="p-bajar p-a" style={{ ['--d' as string]: '1.6s' }} aria-hidden>
          <span className="p-bajar-linea" />
          {t.bajar}
        </div>
      </div>
    </section>
  )
}

const CSS = `
:root{--p-negro:#0d0d0d;--p-grafito:#141414;--p-blanco:#fbfbfa;--p-papel:#f4f3f0;--p-tinta:#141414;--p-salvia:#8fa596;--p-verde:#2f4238;
  --p-curva:cubic-bezier(.16,1,.3,1);--p-gutter:clamp(20px,5.4vw,104px);}
html{background:#0d0d0d;scroll-behavior:auto;scroll-snap-type:y mandatory;overscroll-behavior-y:none;}
/* Cada pantalla mide exactamente lo que la ventana y es un punto de parada obligatorio. */
[data-pantalla]{scroll-snap-align:start;scroll-snap-stop:always;height:100svh!important;min-height:0!important;overflow:hidden;}
[data-pantalla].explorando,[data-pantalla].amplio{height:100%!important;}
body{background:#0d0d0d!important;margin:0;}
.para{font-family:'Hanken Grotesk',system-ui,sans-serif;color:var(--p-blanco);background:var(--p-negro);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;font-weight:300;}
.para *{box-sizing:border-box;}
.para img{display:block;max-width:100%;}
.para h1,.para h2,.para h3{margin:0;font-weight:200;letter-spacing:-.03em;text-wrap:balance;}
.para p{margin:0;text-wrap:pretty;}
.para button{font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;}

/* Tipografía fluida: el mismo diseño a 390 y a 1920 */
.p-it{font-family:'Newsreader',serif;font-style:italic;font-weight:400;font-size:clamp(16px,.9rem + .35vw,19px);color:var(--p-salvia);letter-spacing:0;}
.p-rotulo{font-size:12px;letter-spacing:.2em;text-transform:uppercase;font-weight:500;color:var(--p-salvia);}
.p-h2{font-size:clamp(32px,1.35rem + 2.6vw,58px);line-height:1.04;}
.p-texto{font-size:clamp(15px,.88rem + .2vw,17px);line-height:1.6;color:rgba(251,251,250,.72);max-width:44ch;}

/* Barra superior y progreso */
.p-progreso{position:fixed;top:0;left:0;right:0;height:2px;background:var(--p-salvia);transform-origin:0 50%;z-index:60;pointer-events:none;}
.p-barra{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;
  padding:calc(env(safe-area-inset-top) + 14px) var(--p-gutter) 14px;pointer-events:none;}
.p-barra-logo{height:14px;width:auto;opacity:0;transform:translateY(-6px);transition:opacity .6s var(--p-curva),transform .6s var(--p-curva);}
.p-barra.on .p-barra-logo{opacity:.9;transform:none;}
.p-idioma{pointer-events:auto;min-height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(251,251,250,.22);background:rgba(13,13,13,.38);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--p-blanco);font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:500;
  transition:background .3s,border-color .3s;}
.p-idioma:hover{background:rgba(13,13,13,.6);border-color:rgba(251,251,250,.4);}
.p-barra.claro .p-barra-logo{filter:invert(1);}
.p-barra.claro .p-idioma{color:#141414;background:rgba(244,243,240,.6);border-color:rgba(20,20,20,.2);}
.p-progreso.claro{background:#2f4238;}

/* ── Portada ─────────────────────────────────────────────────────────── */
.p-portada{position:relative;height:100svh;display:grid;overflow:hidden;background:var(--p-negro);}
.p-portada-img{position:absolute;inset:0;overflow:hidden;}
.p-portada-img img{width:100%;height:100%;object-fit:cover;object-position:50% 40%;transform:scale(1.12);opacity:0;
  transition:transform 2.8s cubic-bezier(.22,1,.36,1),opacity 1.6s cubic-bezier(.33,0,.2,1);}
.p-portada.in .p-portada-img img{transform:scale(1);opacity:1;}
.p-portada-img::after{content:'';position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(13,13,13,.55) 0%,rgba(13,13,13,.05) 26%,rgba(13,13,13,.25) 52%,rgba(13,13,13,.92) 82%,#0d0d0d 100%);}
.p-portada-txt{position:relative;z-index:1;display:flex;flex-direction:column;justify-content:space-between;height:100svh;
  padding:calc(env(safe-area-inset-top) + 22px) var(--p-gutter) calc(env(safe-area-inset-bottom) + 26px);}
.p-marcas{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;min-height:40px;padding-right:112px;opacity:0;transition:opacity 1.2s .35s var(--p-curva);}
.p-portada.in .p-marcas{opacity:1;}
.p-marca-fp{height:clamp(15px,.7rem + .5vw,20px);width:auto;}
.p-marcas-lead{display:inline-flex;align-items:center;gap:12px;white-space:nowrap;}
.p-marcas-x{font-weight:200;font-size:18px;color:rgba(251,251,250,.5);line-height:1;}
.p-marca-lead{max-height:clamp(22px,1rem + .8vw,32px);max-width:150px;width:auto;object-fit:contain;}
.p-marca-texto{font-size:13px;letter-spacing:.22em;text-transform:uppercase;font-weight:500;white-space:nowrap;}
.p-portada-centro{margin-top:auto;padding-bottom:clamp(28px,6vh,72px);}
.p-portada-h1{font-size:clamp(46px,1.4rem + 7.2vw,104px);line-height:.98;margin-top:18px !important;}
.p-linea{display:block;overflow:hidden;padding-bottom:.08em;margin-bottom:-.08em;}
.p-linea>span{display:block;transform:translateY(105%);transition:transform 1.5s var(--p-curva);transition-delay:var(--d,0s);}
.p-portada.in .p-linea>span{transform:none;}
.p-a{opacity:0;transform:translateY(14px);transition:opacity 1.2s var(--p-curva),transform 1.2s var(--p-curva);transition-delay:var(--d,0s);}
.p-portada.in .p-a{opacity:1;transform:none;}
.p-raya{display:block;width:44px;height:1px;background:rgba(251,251,250,.45);margin:clamp(22px,3.4vh,34px) 0 clamp(16px,2.4vh,22px);}
.p-lema{font-size:clamp(16px,.9rem + .45vw,21px);line-height:1.5;color:rgba(251,251,250,.78);max-width:30ch;}
.p-bajar{display:flex;align-items:center;gap:14px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:rgba(251,251,250,.6);font-weight:500;}
.p-bajar-linea{position:relative;width:1px;height:34px;background:rgba(251,251,250,.18);overflow:hidden;}
.p-bajar-linea::after{content:'';position:absolute;left:0;top:-40%;width:1px;height:40%;background:var(--p-blanco);animation:p-cae 2.2s cubic-bezier(.65,0,.35,1) infinite 2.2s;}
@keyframes p-cae{0%{top:-40%}70%,100%{top:100%}}

@media (min-width:1024px){
  .p-portada{grid-template-columns:1fr 1fr;}
  .p-portada-img{position:relative;inset:auto;height:100svh;}
  .p-portada-img::after{background:linear-gradient(90deg,rgba(13,13,13,0) 70%,rgba(13,13,13,.35) 100%);}
  .p-portada-txt{padding-top:calc(env(safe-area-inset-top) + 40px);padding-bottom:44px;}
  .p-portada-centro{margin-top:auto;margin-bottom:auto;padding-bottom:0;}
  .p-portada-h1{font-size:clamp(56px,1.6rem + 3.6vw,96px);}
  .p-barra-logo{display:none;}
  .p-barra.on .p-barra-logo{display:block;}
}

/* ── Pantallas interactivas (mapa, maqueta): patrón común ─────────────── */
.p-escena{position:relative;height:100svh;overflow:hidden;}
.p-escena.explorando{position:fixed;inset:0;height:100%;min-height:0;z-index:80;}
.p-lienzo{position:absolute;inset:0;}
.p-explorar{display:inline-flex;align-items:center;gap:10px;min-height:46px;padding:0 20px;border-radius:999px;border:1px solid rgba(251,251,250,.3);
  background:rgba(13,13,13,.42);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--p-blanco);font-size:12px;letter-spacing:.16em;
  text-transform:uppercase;font-weight:500;transition:background .3s,border-color .3s,transform .3s var(--p-curva);}
.p-explorar:hover{background:rgba(13,13,13,.62);border-color:rgba(251,251,250,.5);}
.p-explorar:active{transform:scale(.97);}
.p-explorar svg{width:14px;height:14px;}
.p-seguir{position:absolute;z-index:5;top:calc(env(safe-area-inset-top) + 14px);right:var(--p-gutter);}
.p-gesto{position:absolute;z-index:3;left:50%;bottom:clamp(24px,5vh,48px);transform:translateX(-50%);display:none;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;
  background:rgba(13,13,13,.5);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fbfbfa;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:500;
  pointer-events:none;transition:opacity .6s;animation:p-gesto 2.6s ease-in-out infinite;}
.p-gesto.fuera{opacity:0;}
@keyframes p-gesto{0%,100%{transform:translateX(-50%)}50%{transform:translateX(calc(-50% + 8px))}}
@media (pointer:fine){.p-gesto{display:inline-flex;}}
.p-in{opacity:0;transform:translateY(18px);transition:opacity 1.2s var(--p-curva),transform 1.2s var(--p-curva);transition-delay:var(--d,0s);}
.visto .p-in{opacity:1;transform:none;}
.p-in-h{display:block;overflow:hidden;padding-bottom:.1em;margin-bottom:-.1em;}
.p-in-h>span{display:block;transform:translateY(105%);transition:transform 1.4s var(--p-curva);transition-delay:var(--d,0s);}
.visto .p-in-h>span{transform:none;}

@media (prefers-reduced-motion:reduce){
  .para *,.para *::before,.para *::after{transition-duration:.01ms!important;animation:none!important;transition-delay:0s!important;}
}
`
