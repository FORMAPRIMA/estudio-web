'use client'

// Pantalla del mapa de obra. Entra como un globo con las cuatro sedes y, al
// llegar a ella, la cámara vuela sola hasta Madrid, donde se levantan los
// edificios y aparecen las obras una a una. Luego orbita despacio.
//
// No atrapa el scroll: en reposo la rueda y el dedo son de la página (en
// escritorio se puede arrastrar para girar). «Explorar el mapa» lo abre a
// pantalla completa con todos los gestos; «Seguir» lo cierra y baja a la
// siguiente pantalla.
//
// Mismo estilo de Mapbox y mismos datos que el mapa de la web pública
// (lib/web-mapa.ts); es mapbox-gl v3 porque el estilo usa Mapbox Standard.

import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { CAMARA, datosDeTarjeta, tieneCoordenadas, type MapaPunto } from '@/lib/web-mapa'
import type { Idioma, Textos } from '@/lib/para/textos'
import { useBloqueoScroll, useEnPantalla, useVisto } from './Presentacion'

/** Las cuatro sedes, para la vista de globo (mismo orden que T.paises). */
const SEDES: [number, number][] = [
  [-3.7038, 40.4168],   // Madrid
  [-80.1918, 25.7617],  // Miami
  [-100.3161, 25.6866], // Monterrey
  [-79.9224, -2.1709],  // Guayaquil
]
const GLOBO = { center: [-46, 22] as [number, number], zoom: 1.35, pitch: 0, bearing: 0 }
const VUELO_MS = 7200
const GRADOS_ORBITA = 60
const MS_POR_GRADO = 320

const tactil = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const sinMovimiento = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function MapaObras({ puntos, t, idioma, token: tokenServidor, num, alEvento }: {
  puntos: MapaPunto[]; t: Textos; idioma: Idioma; token: string | null; num: number; alEvento: (k: string, d?: string) => void
}) {
  const obras = useMemo(() => puntos.filter(tieneCoordenadas), [puntos])
  const [refCerca, cerca] = useEnPantalla<HTMLElement>('60% 0px')
  const [refVisto, visto] = useVisto<HTMLDivElement>(0.55)
  const lienzo = useRef<HTMLDivElement>(null)
  const mapa = useRef<mapboxgl.Map | null>(null)
  const marcasObra = useRef<mapboxgl.Marker[]>([])
  const marcasSede = useRef<mapboxgl.Marker[]>([])
  const orbitando = useRef(false)
  const volado = useRef(false)
  const [listo, setListo] = useState(false)
  const [aterrizado, setAterrizado] = useState(false)
  // La ciudad del estudio es clara: el texto pasa a tinta en cuanto la cámara deja el espacio.
  const [claro, setClaro] = useState(false)
  const [explorando, setExplorando] = useState(false)
  const [sel, setSel] = useState<number | null>(null)
  const [fallo, setFallo] = useState(false)
  const [tocado, setTocado] = useState(false)
  useBloqueoScroll(explorando)

  // Montaje perezoso: el mapa (≈250 KB + teselas) solo se pide cuando la
  // pantalla se acerca, nunca con la portada.
  useEffect(() => {
    if (!cerca || mapa.current || !lienzo.current) return
    // El token llega del servidor: no depende de que el paquete del cliente se
    // haya compilado con la variable ya puesta.
    const token = tokenServidor || process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    let ok = false
    try { ok = !!token && !!document.createElement('canvas').getContext('webgl2') } catch { ok = false }
    if (!ok) { setFallo(true); return }
    mapboxgl.accessToken = token!
    const m = new mapboxgl.Map({
      container: lienzo.current,
      style: CAMARA.estilo,
      projection: 'globe',
      ...GLOBO,
      attributionControl: false,
      cooperativeGestures: false,
      scrollZoom: false,
      dragPan: !tactil(),
      dragRotate: !tactil(),
      touchZoomRotate: false,
      touchPitch: false,
      doubleClickZoom: false,
      keyboard: false,
      maxZoom: CAMARA.zoomMax,
    })
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
    mapa.current = m
    m.on('load', () => setListo(true))
    m.on('error', () => { /* teselas sueltas que fallan: no tumban la pantalla */ })
    // el primer gesto del visitante corta la órbita y ya no vuelve
    const cortar = () => { orbitando.current = false }
    m.on('mousedown', cortar); m.on('touchstart', cortar); m.on('wheel', cortar)

    SEDES.forEach((c, i) => {
      const el = document.createElement('div')
      // Mapbox coloca la marca con un transform en línea sobre este elemento: la
      // animación va en el hijo, o la pisaría y todas caerían en la esquina.
      el.className = 'p-sede'
      el.innerHTML = `<span class="p-sede-in" style="--d:${0.25 + i * 0.12}s"><span class="p-sede-punto"></span><span class="p-sede-txt"><b>${t.paises[i].pais}</b>${t.paises[i].ciudad}</span></span>`
      marcasSede.current.push(new mapboxgl.Marker({ element: el, anchor: 'left' }).setLngLat(c).addTo(m))
    })
    return undefined
  }, [cerca, t.paises, tokenServidor])

  useEffect(() => () => { mapa.current?.remove(); mapa.current = null }, [])

  // Las etiquetas de las sedes siguen al idioma.
  useEffect(() => {
    marcasSede.current.forEach((mk, i) => {
      const txt = mk.getElement().querySelector('.p-sede-txt')
      if (txt) txt.innerHTML = `<b>${t.paises[i].pais}</b>${t.paises[i].ciudad}`
    })
  }, [t.paises])

  // El vuelo: globo → Madrid, cuando la pantalla está a la vista y el estilo cargado.
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || !visto || volado.current) return
    volado.current = true
    const lng = obras.reduce((a, p) => a + p.lng, 0) / (obras.length || 1)
    const lat = obras.reduce((a, p) => a + p.lat, 0) / (obras.length || 1)
    const destino = { center: [lng || CAMARA.centro[0], lat || CAMARA.centro[1]] as [number, number], zoom: CAMARA.zoomEdificios, pitch: CAMARA.cabeceo, bearing: CAMARA.rumbo }
    const aterrizar = () => {
      setAterrizado(true)
      setClaro(true)
      // la barra superior relee el tema de la pantalla (oscura → clara)
      requestAnimationFrame(() => window.dispatchEvent(new Event('scroll')))
      marcasSede.current.forEach((mk) => mk.getElement().classList.add('fuera'))
      obras.forEach((p, i) => {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'p-obra'
        el.setAttribute('aria-label', p.nombre)
        el.innerHTML = `<span class="p-obra-in" style="--d:${0.15 + i * 0.06}s"><span></span></span>`
        el.addEventListener('click', (e) => { e.stopPropagation(); setSel(i) })
        marcasObra.current.push(new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m))
      })
      if (!sinMovimiento()) { orbitando.current = true; orbitar() }
    }
    const orbitar = () => {
      if (!orbitando.current || !mapa.current) return
      m.easeTo({ bearing: m.getBearing() + GRADOS_ORBITA, duration: GRADOS_ORBITA * MS_POR_GRADO, easing: (x) => x })
      m.once('moveend', () => { if (orbitando.current) orbitar() })
    }
    setTimeout(() => {
      if (sinMovimiento()) { m.jumpTo(destino); aterrizar(); return }
      m.flyTo({ ...destino, duration: VUELO_MS, curve: 1.42, essential: true })
      setTimeout(() => { setClaro(true); requestAnimationFrame(() => window.dispatchEvent(new Event('scroll'))) }, 1700)
      m.once('moveend', aterrizar)
    }, 1400)
  }, [listo, visto, obras])

  // Explorar: todos los gestos y pantalla completa. En reposo: solo arrastrar en escritorio.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    const toque = tactil()
    const h = [m.scrollZoom, m.touchZoomRotate, m.doubleClickZoom, m.keyboard] as const
    if (explorando) {
      orbitando.current = false
      m.stop()
      h.forEach((x) => x.enable())
      m.dragPan.enable(); m.dragRotate.enable(); m.touchPitch.enable()
    } else {
      h.forEach((x) => x.disable())
      m.touchPitch.disable()
      if (toque) { m.dragPan.disable(); m.dragRotate.disable() }
    }
    const r = requestAnimationFrame(() => m.resize())
    return () => cancelAnimationFrame(r)
  }, [explorando, listo])

  useEffect(() => {
    if (!explorando) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setExplorando(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [explorando])

  // La obra elegida se enciende y la cámara se acerca un poco, sin perder la ciudad.
  useEffect(() => {
    marcasObra.current.forEach((mk, i) => mk.getElement().classList.toggle('sel', i === sel))
    const m = mapa.current
    if (m && sel != null && obras[sel]) {
      orbitando.current = false
      m.easeTo({ center: [obras[sel].lng, obras[sel].lat], zoom: Math.max(m.getZoom(), 15.6), duration: 1200, essential: true })
    }
  }, [sel, obras])

  const seguir = () => {
    setExplorando(false)
    setSel(null)
    requestAnimationFrame(() => {
      const sec = (refCerca.current?.nextElementSibling as HTMLElement | null)
      sec?.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth' })
    })
  }

  useEffect(() => { if (explorando) alEvento('3d', 'mapa') }, [explorando, alEvento])
  useEffect(() => { if (sel != null && obras[sel]) alEvento('3d', `obra:${obras[sel].nombre}`) }, [sel, obras, alEvento])

  const obra = sel != null ? obras[sel] : null
  const tarjeta = obra ? datosDeTarjeta(obra, idioma) : null

  return (
    <section ref={refCerca} data-pantalla="mapa" data-tema={claro ? 'claro' : undefined} className={`p-escena p-mapa${claro ? ' ciudad' : ''}${explorando ? ' explorando' : ''}`} aria-label={t.mapaTitulo}>
      <div ref={lienzo} className="p-lienzo" onPointerDown={() => setTocado(true)} />
      {aterrizado && !tocado && !explorando && <span className="p-gesto" aria-hidden>↔ {t.arrastra}</span>}
      {fallo && <img className="p-lienzo p-mapa-fallo" src="/para/portada-1400.webp" alt="" />}
      <div className="p-mapa-velo" aria-hidden />

      {/* En móvil, en reposo, un toque abre el mapa; el deslizamiento sigue siendo de la página. */}
      {!explorando && <button type="button" className="p-mapa-toque" aria-label={t.explorarMapa} onClick={() => setExplorando(true)} />}

      <div ref={refVisto} className={`p-mapa-txt${visto ? ' visto' : ''}${explorando ? ' oculto' : ''}`}>
        <p className="p-it p-in">{String(num).padStart(2, '0')} · {t.mapaRotulo}</p>
        <h2 className="p-h2"><span className="p-in-h"><span key={aterrizado ? 'b' : 'a'} className={aterrizado ? 'p-cambio' : ''} style={{ ['--d' as string]: '.12s' }}>{aterrizado ? t.mapaAterriza : t.mapaTitulo}</span></span></h2>
        <div className="p-mapa-pie p-in" style={{ ['--d' as string]: '.4s' }}>
          <span className={`p-cifra${aterrizado ? ' on' : ''}`}><b>{obras.length}</b> {t.obrasEnMadrid}</span>
          <button type="button" className="p-explorar" onClick={() => setExplorando(true)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" /></svg>
            {t.explorarMapa}
          </button>
        </div>
      </div>

      {explorando && (
        <button type="button" className="p-explorar p-seguir" onClick={seguir}>
          {t.cerrar}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" /></svg>
        </button>
      )}
      {explorando && !obra && <p className="p-mapa-ayuda">{t.tocaObra}</p>}

      {obra && tarjeta && (
        <article className="p-tarjeta" key={obra.id}>
          {tarjeta.imagen && <img src={tarjeta.imagen} alt="" loading="lazy" />}
          <div className="p-tarjeta-txt">
            <p className="p-tarjeta-nombre">{obra.nombre}</p>
            <p className="p-tarjeta-meta">{[tarjeta.descriptor, obra.anio].filter(Boolean).join(' · ')}</p>
            {tarjeta.slug && <a href={`/proyectos/${tarjeta.slug}`} target="_blank" rel="noopener" className="p-tarjeta-link">{t.verProyecto} ↗</a>}
          </div>
          <button type="button" className="p-tarjeta-x" aria-label="×" onClick={() => setSel(null)}>×</button>
        </article>
      )}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </section>
  )
}

const CSS = `
.p-mapa{background:#0d0d0d;}
.p-mapa .mapboxgl-canvas{outline:none;}
.p-mapa .mapboxgl-ctrl-attrib{background:rgba(13,13,13,.5)!important;}
.p-mapa .mapboxgl-ctrl-attrib a{color:rgba(251,251,250,.6)!important;}
.p-mapa-fallo{object-fit:cover;filter:brightness(.45);}
.p-mapa.ciudad .p-gesto{background:rgba(20,20,20,.72);}
.p-mapa-velo{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(180deg,rgba(13,13,13,.86) 0%,rgba(13,13,13,.25) 34%,rgba(13,13,13,0) 55%,rgba(13,13,13,.35) 80%,rgba(13,13,13,.8) 100%);transition:opacity .8s;}
.p-mapa.explorando .p-mapa-velo{opacity:.35;}
.p-mapa-toque{position:absolute;inset:0;z-index:1;background:transparent;border:0;padding:0;display:none;}
@media (pointer:coarse){.p-mapa-toque{display:block;}}
.p-mapa-txt{position:absolute;z-index:2;left:var(--p-gutter);right:var(--p-gutter);top:calc(env(safe-area-inset-top) + 76px);pointer-events:none;
  display:flex;flex-direction:column;gap:16px;transition:opacity .5s;}
.p-mapa-txt.oculto{opacity:0;}
.p-mapa-txt .p-h2{max-width:15ch;}
.p-cambio{animation:p-cambio 1.4s var(--p-curva) both;}
@keyframes p-cambio{from{transform:translateY(105%)}to{transform:none}}
.p-mapa-txt .p-h2,.p-mapa-txt .p-it,.p-cifra{text-shadow:0 2px 24px rgba(13,13,13,.55);transition:color 1.2s,text-shadow 1.2s;}
/* Ya en la ciudad: el estilo del estudio es claro, así que la pantalla pasa a tinta sobre papel */
.p-mapa-velo::after{content:'';position:absolute;inset:0;opacity:0;transition:opacity 1.6s;
  background:linear-gradient(180deg,rgba(244,243,240,.8) 0%,rgba(244,243,240,.25) 28%,rgba(244,243,240,0) 52%,rgba(244,243,240,.55) 78%,rgba(244,243,240,.95) 100%);}
.p-mapa.ciudad .p-mapa-velo{background:none;}
.p-mapa.ciudad .p-mapa-velo::after{opacity:1;}
.p-mapa.ciudad .p-mapa-txt .p-h2,.p-mapa.ciudad .p-cifra b{color:#141414;text-shadow:none;}
.p-mapa.ciudad .p-mapa-txt .p-it{color:#4f6556;text-shadow:none;}
.p-mapa.ciudad .p-cifra{color:rgba(20,20,20,.62);text-shadow:none;}
.p-mapa.ciudad .p-explorar{color:#141414;border-color:rgba(20,20,20,.22);background:rgba(244,243,240,.72);}
.p-mapa.ciudad .p-mapa-ayuda{color:rgba(20,20,20,.7);}
.p-mapa.ciudad .p-obra-in span{background:#141414;box-shadow:0 0 0 3px rgba(244,243,240,.85),0 6px 16px rgba(0,0,0,.25);}
.p-mapa.ciudad .p-obra.sel .p-obra-in span{background:#2f4238;}
.p-mapa.ciudad .mapboxgl-ctrl-attrib{background:rgba(244,243,240,.6)!important;}
.p-mapa.ciudad .mapboxgl-ctrl-attrib a{color:rgba(20,20,20,.6)!important;}
.p-mapa-pie{display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;margin-top:6px;pointer-events:auto;}
.p-cifra{font-size:13px;letter-spacing:.04em;color:rgba(251,251,250,.7);opacity:0;transform:translateY(8px);transition:opacity 1s var(--p-curva),transform 1s var(--p-curva);}
.p-cifra.on{opacity:1;transform:none;}
.p-cifra b{font-weight:200;font-size:28px;color:var(--p-blanco);margin-right:6px;letter-spacing:-.02em;vertical-align:-3px;}
.p-mapa-ayuda{position:absolute;z-index:3;left:50%;bottom:calc(env(safe-area-inset-bottom) + 26px);transform:translateX(-50%);font-size:12px;letter-spacing:.16em;
  text-transform:uppercase;color:rgba(251,251,250,.75);font-weight:500;white-space:nowrap;pointer-events:none;}

/* Sedes en el globo */
.p-sede{pointer-events:none;transition:opacity .9s;}
.p-sede-in{display:flex;align-items:center;gap:10px;opacity:0;transform:translateY(6px);animation:p-entra 1s var(--p-curva) forwards;animation-delay:var(--d);}
.p-sede.fuera{opacity:0!important;}
.p-sede-punto{position:relative;width:9px;height:9px;border-radius:50%;background:#fbfbfa;box-shadow:0 0 0 4px rgba(143,165,150,.35);}
.p-sede-punto::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:1px solid rgba(251,251,250,.7);animation:p-pulso 2.4s ease-out infinite;}
.p-sede-txt{font-size:12px;line-height:1.35;color:rgba(251,251,250,.8);text-shadow:0 1px 10px rgba(0,0,0,.6);white-space:nowrap;}
.p-sede-txt b{display:block;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#fbfbfa;}
@keyframes p-entra{to{opacity:1;transform:none;}}
@keyframes p-pulso{0%{transform:scale(.6);opacity:1}100%{transform:scale(2.6);opacity:0}}

/* Obras */
.p-obra{width:30px;height:30px;padding:0;border:0;background:transparent;}
.p-obra-in{width:30px;height:30px;display:grid;place-items:center;opacity:0;transform:translateY(-14px);animation:p-entra .9s var(--p-curva) forwards;animation-delay:var(--d);}
.p-obra-in span{width:11px;height:11px;border-radius:50%;background:#fbfbfa;box-shadow:0 0 0 3px rgba(13,13,13,.35),0 6px 16px rgba(0,0,0,.4);transition:transform .35s var(--p-curva),background .35s;}
.p-obra:hover .p-obra-in span{transform:scale(1.35);}
.p-obra.sel .p-obra-in span{background:var(--p-salvia);transform:scale(1.6);box-shadow:0 0 0 5px rgba(143,165,150,.3),0 6px 18px rgba(0,0,0,.45);}
@media (pointer:coarse){.p-mapa:not(.explorando) .p-obra{pointer-events:none;}}

/* Tarjeta de obra */
.p-tarjeta{position:absolute;z-index:4;left:var(--p-gutter);right:var(--p-gutter);bottom:calc(env(safe-area-inset-bottom) + 20px);display:grid;grid-template-columns:104px 1fr auto;
  background:rgba(20,20,20,.86);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border:1px solid rgba(251,251,250,.12);overflow:hidden;
  animation:p-sube .7s var(--p-curva);}
@keyframes p-sube{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.p-tarjeta img{width:104px;height:100%;min-height:104px;object-fit:cover;}
.p-tarjeta-txt{padding:16px 18px;display:flex;flex-direction:column;gap:5px;justify-content:center;min-width:0;}
.p-tarjeta-nombre{font-size:18px;font-weight:300;letter-spacing:-.01em;}
.p-tarjeta-meta{font-size:13px;color:rgba(251,251,250,.6);}
.p-tarjeta-link{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--p-salvia);text-decoration:none;margin-top:4px;font-weight:500;}
.p-tarjeta-x{background:none;border:0;color:rgba(251,251,250,.6);font-size:24px;font-weight:200;width:48px;}
@media (min-width:1024px){
  .p-mapa-txt{top:auto;bottom:clamp(48px,9vh,104px);max-width:640px;}
  .p-tarjeta{left:auto;right:var(--p-gutter);bottom:clamp(48px,9vh,104px);width:440px;grid-template-columns:150px 1fr auto;}
  .p-tarjeta img{width:150px;min-height:150px;}
}
`
