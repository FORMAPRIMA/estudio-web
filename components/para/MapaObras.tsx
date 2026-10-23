'use client'

// Pantalla del mapa de obra. Entra como un globo que gira despacio hasta dejar a
// la vista las cuatro sedes, y AHÍ se queda: la obra internacional es lo primero
// que se enseña. Al lado, la lista de proyectos por país; elegir uno —o tocar una
// ciudad en el globo— baja la cámara hasta él, donde se levantan los edificios.
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
import {
  CAMARA, MUNDO, ZOOM_CIUDAD, centroDe, datosDeTarjeta, limitesDeSede, ordenarPorSede, sedeDe, sedesConObra,
  tieneCoordenadas, type Caja, type MapaPunto, type SedeCodigo,
} from '@/lib/web-mapa'
import type { Idioma, Textos } from '@/lib/para/textos'
import { contenedor, useBloqueoScroll, useEnPantalla, useVisto } from './Presentacion'
import { Rotulo } from './Pantallas'
import Cifra from './Cifra'

/** Desde aquí la ciudad ya es la ciudad clara del estudio y el texto pasa a tinta. */
const ZOOM_CLARO = 5
/** La entrada: el globo llega girando desde el este hasta su sitio. */
const GIRO_MS = 3800
/** La sede que se enseña plegada en una sola fila: son muchas obras en la misma
 *  ciudad, y la lista tiene que caber en la pantalla sin desplazarse. */
const SEDE_PLEGADA: SedeCodigo = 'es'

const tactil = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const sinMovimiento = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const vertical = () => typeof window !== 'undefined' && window.innerWidth < 700
const esc = (x: string) => x.replace(/[<>&"]/g, '')

/** Una fila de la lista: una obra, o una ciudad entera plegada. */
type Fila = { tipo: 'obra'; k: number; obra: MapaPunto } | { tipo: 'sede'; sede: SedeCodigo; n: number }

export default function MapaObras({ puntos, t, idioma, token: tokenServidor, num, alEvento }: {
  puntos: MapaPunto[]; t: Textos; idioma: Idioma; token: string | null; num: number; alEvento: (k: string, d?: string) => void
}) {
  // Ordenadas por país, que es el orden de la lista.
  const obras = useMemo(() => ordenarPorSede(puntos.filter(tieneCoordenadas)) as (MapaPunto & { lat: number; lng: number })[], [puntos])
  const sedes = useMemo(() => sedesConObra(obras), [obras])
  const grupos = useMemo(() => sedes.map((s) => {
    const filas: Fila[] = s === SEDE_PLEGADA
      ? [{ tipo: 'sede', sede: s, n: obras.filter((o) => sedeDe(o) === s).length }]
      : obras.flatMap((o, k) => (sedeDe(o) === s ? [{ tipo: 'obra' as const, k, obra: o }] : []))
    return { sede: s, filas, pais: t.paises.find((p) => p.codigo === s)?.pais ?? s }
  }), [sedes, obras, t.paises])

  const [refCerca, cerca] = useEnPantalla<HTMLElement>('60% 0px')
  const [refVisto, visto] = useVisto<HTMLDivElement>(0.8)
  const lienzo = useRef<HTMLDivElement>(null)
  const mapa = useRef<mapboxgl.Map | null>(null)
  const marcasObra = useRef<mapboxgl.Marker[]>([])
  const marcasSede = useRef<{ sede: SedeCodigo; mk: mapboxgl.Marker }[]>([])
  const girado = useRef(false)
  const [listo, setListo] = useState(false)
  /** La entrada ha terminado: ya se puede elegir. */
  const [aterrizado, setAterrizado] = useState(false)
  // La ciudad del estudio es clara: el texto pasa a tinta en cuanto la cámara deja el espacio.
  const [claro, setClaro] = useState(false)
  /** La cámara está en una ciudad y no en el globo: aparece «Ver el mundo». */
  const [enCiudad, setEnCiudad] = useState(false)
  const [explorando, setExplorando] = useState(false)
  const [sel, setSel] = useState<number | null>(null)
  const [fallo, setFallo] = useState(false)
  const [tocado, setTocado] = useState(false)
  useBloqueoScroll(explorando)

  /** Baja a una caja (una ciudad entera): en planta si es una región, con la cámara
   *  de la casa si es un barrio. */
  const irACaja = (caja: Caja | null) => {
    const m = mapa.current
    if (!m || !caja) return
    const region = Math.hypot(caja[1][0] - caja[0][0], caja[1][1] - caja[0][1]) > 0.6
    setSel(null)
    m.fitBounds(caja, {
      padding: { top: 90, bottom: 90, left: 60, right: vertical() ? 60 : 420 },
      pitch: region ? 0 : CAMARA.cabeceo, bearing: region ? 0 : CAMARA.rumbo,
      maxZoom: CAMARA.zoomEdificios, curve: 1.42, speed: 1.1, essential: true,
      ...(sinMovimiento() ? { duration: 0 } : {}),
    })
  }
  const irASede = (s: SedeCodigo) => { alEvento('3d', `sede:${s}`); irACaja(limitesDeSede(obras, s)) }
  const verMundo = () => {
    const m = mapa.current
    if (!m) return
    setSel(null)
    const destino = vertical()
      ? { center: MUNDO.centroMovil, zoom: MUNDO.zoomMovil }
      : { center: MUNDO.centro, zoom: MUNDO.zoom }
    if (sinMovimiento()) m.jumpTo({ ...destino, pitch: 0, bearing: 0 })
    else m.flyTo({ ...destino, pitch: 0, bearing: 0, curve: 1.42, speed: 1.1, essential: true })
  }
  // Las marcas son DOM fuera de React: leen la versión de ahora de estas funciones.
  const irASedeRef = useRef(irASede)
  irASedeRef.current = irASede

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
    // Arranca girado hacia el este (Europa a la vista) y la entrada lo trae a su sitio.
    const base = vertical() ? { center: MUNDO.centroMovil, zoom: MUNDO.zoomMovil } : { center: MUNDO.centro, zoom: MUNDO.zoom }
    const m = new mapboxgl.Map({
      container: lienzo.current,
      style: CAMARA.estilo,
      projection: 'globe',
      center: sinMovimiento() ? base.center : [base.center[0] + 46, base.center[1]],
      zoom: base.zoom - 0.25,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      cooperativeGestures: false,
      scrollZoom: false,
      dragPan: !tactil(),
      dragRotate: !tactil(),
      touchZoomRotate: false,
      touchPitch: false,
      doubleClickZoom: false,
      keyboard: false,
      minZoom: CAMARA.zoomMin,
      maxZoom: CAMARA.zoomMax,
    })
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
    mapa.current = m
    // La entrada no espera a que llegue la última tesela: basta con el estilo (y, si
    // la red va lenta, como mucho 3,5 s).
    const listoYa = () => setListo(true)
    m.once('style.load', listoYa)
    m.once('load', listoYa)
    setTimeout(listoYa, 3500)
    m.on('error', () => { /* teselas sueltas que fallan: no tumban la pantalla */ })

    // Globo o ciudad, según el zoom: las marcas de sede y las de obra se turnan, y
    // el texto cambia de tinta. Solo cambia el estado cuando cruza el umbral.
    const alZoom = () => {
      const z = m.getZoom()
      setClaro(z >= ZOOM_CLARO)
      setEnCiudad(z >= ZOOM_CLARO)
      lienzo.current?.classList.toggle('en-ciudad', z >= ZOOM_CIUDAD)
    }
    m.on('zoom', alZoom)

    for (const s of sedesConObra(obras)) {
      const caja = limitesDeSede(obras, s)
      if (!caja) continue
      const i = marcasSede.current.length
      const el = document.createElement('button')
      el.type = 'button'
      // Mapbox coloca la marca con un transform en línea sobre este elemento: la
      // animación va en el hijo, o la pisaría y todas caerían en la esquina.
      el.className = 'p-sede'
      el.innerHTML = `<span class="p-sede-in" style="--d:${0.25 + i * 0.12}s"><span class="p-sede-punto"></span><span class="p-sede-txt"></span></span>`
      el.addEventListener('click', (e) => { e.stopPropagation(); irASedeRef.current(s) })
      // Miami y México quedan cerca en el globo: México y Ecuador llevan la etiqueta a la izquierda.
      const izquierda = s === 'mx' || s === 'ec'
      if (izquierda) el.classList.add('izq')
      marcasSede.current.push({ sede: s, mk: new mapboxgl.Marker({ element: el, anchor: izquierda ? 'right' : 'left' }).setLngLat(centroDe(caja)).addTo(m) })
    }

    obras.forEach((p, i) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'p-obra'
      el.setAttribute('aria-label', p.nombre)
      el.innerHTML = `<span class="p-obra-in" style="--d:${0.15 + (i % 12) * 0.05}s"><i class="p-obra-onda"></i><span></span><em>${esc(p.nombre)}</em></span>`
      el.addEventListener('click', (e) => { e.stopPropagation(); setSel(i) })
      marcasObra.current.push(new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m))
    })
    return undefined
  }, [cerca, tokenServidor, obras])

  useEffect(() => () => { mapa.current?.remove(); mapa.current = null }, [])

  // Las etiquetas de las sedes siguen al idioma.
  useEffect(() => {
    marcasSede.current.forEach(({ sede, mk }) => {
      const txt = mk.getElement().querySelector('.p-sede-txt')
      const p = t.paises.find((x) => x.codigo === sede)
      if (txt && p) txt.innerHTML = `<b>${esc(p.pais)}</b>${esc(p.ciudad)}`
      mk.getElement().setAttribute('aria-label', p ? `${p.pais} · ${p.ciudad}` : sede)
    })
  }, [t.paises, listo])

  // La entrada: el globo gira hasta su sitio cuando la pantalla está a la vista.
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || !visto || girado.current) return
    girado.current = true
    const destino = vertical() ? { center: MUNDO.centroMovil, zoom: MUNDO.zoomMovil } : { center: MUNDO.centro, zoom: MUNDO.zoom }
    if (sinMovimiento()) { m.jumpTo(destino); setAterrizado(true); return }
    m.easeTo({ ...destino, duration: GIRO_MS, easing: (x) => 1 - Math.pow(1 - x, 3), essential: true })
    setTimeout(() => setAterrizado(true), GIRO_MS * 0.6)
  }, [listo, visto])

  // Explorar: todos los gestos y pantalla completa. En reposo: solo arrastrar en escritorio.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    const toque = tactil()
    const h = [m.scrollZoom, m.touchZoomRotate, m.doubleClickZoom, m.keyboard] as const
    if (explorando) {
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

  // La obra elegida se enciende y la cámara baja hasta ella. Desde el globo u otra
  // ciudad es un vuelo alto que aterriza con la cámara de la casa; dentro de la
  // misma ciudad, un acercamiento corto sin perderla.
  useEffect(() => {
    marcasObra.current.forEach((mk, i) => mk.getElement().classList.toggle('sel', i === sel))
    const m = mapa.current
    const o = sel != null ? obras[sel] : null
    if (!m || !o) return
    const c = m.getCenter()
    const lejos = m.getZoom() < 12 || Math.hypot(c.lng - o.lng, c.lat - o.lat) > 1
    const destino = {
      center: [o.lng, o.lat] as [number, number],
      zoom: Math.max(m.getZoom(), 15.6),
      // La tarjeta tapa el canto de abajo (móvil) o el izquierdo (escritorio).
      padding: vertical() ? { top: 0, bottom: 180, left: 0, right: 0 } : { top: 0, bottom: 0, left: 570, right: 380 },
      // Siempre en perspectiva; el rumbo solo si se viene de lejos.
      pitch: CAMARA.cabeceo,
      ...(lejos ? { bearing: CAMARA.rumbo } : {}),
    }
    if (sinMovimiento()) { m.jumpTo(destino); return }

    // Al aterrizar, la cámara orbita despacio alrededor de la obra hasta que el
    // visitante toque el mapa o elija otra. Tramos de 90°: `easeTo` normaliza el
    // rumbo y un giro de 360° lo leería como «no gires».
    let vivo = true
    const parar = () => { vivo = false }
    const girar = () => {
      if (!vivo) return
      m.easeTo({ bearing: m.getBearing() + 90, duration: 22500, easing: (x) => x, essential: true })
      m.once('moveend', (e: any) => { if (!e?.originalEvent) girar() })
    }
    m.on('mousedown', parar); m.on('touchstart', parar); m.on('wheel', parar)
    m.once('moveend', girar)
    if (lejos) m.flyTo({ ...destino, curve: 1.42, speed: 1.1, essential: true })
    else m.easeTo({ ...destino, duration: 1200, essential: true })
    return () => {
      vivo = false
      m.off('mousedown', parar); m.off('touchstart', parar); m.off('wheel', parar)
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

      {/* sensor de pantalla completa: el vuelo arranca con la pantalla ya en su sitio */}
      <div ref={refVisto} className="p-sensor" aria-hidden />
      {/* Con una obra abierta, su tarjeta ocupa el sitio del texto. */}
      <div className={`p-mapa-txt${visto ? ' visto' : ''}${explorando || obra ? ' oculto' : ''}`}>
        <Rotulo num={num} texto={t.mapaRotulo} />
        <h2 className="p-h2"><span className="p-in-h"><span style={{ ['--d' as string]: '.12s' }}>{t.mapaTitulo}</span></span></h2>
        <p className="p-mapa-sub p-in" style={{ ['--d' as string]: '.3s' }}><span key={aterrizado ? 'b' : 'a'} className={aterrizado ? 'p-cambio-sub' : ''}>{aterrizado ? t.mapaAterriza : t.mapaSub}</span></p>
        <div className="p-mapa-pie p-in" style={{ ['--d' as string]: '.4s' }}>
          <span className={`p-cifra${aterrizado ? ' on' : ''}`}><b><Cifra texto={obras.length} activa={aterrizado} retraso={0.3} /></b> {t.obrasEnMadrid}</span>
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

      {/* La lista de proyectos por país. En escritorio, columna a la derecha; en
          móvil, tira horizontal abajo, solo con el mapa abierto y sin tarjeta. */}
      <nav className={`p-mapa-lista${aterrizado ? ' on' : ''}${obra ? ' con-obra' : ''}`} aria-label={t.mapaTitulo}>
        {enCiudad && (
          <button type="button" className="p-mapa-mundo" onClick={verMundo}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" /></svg>
            {t.verMundo}
          </button>
        )}
        {grupos.map((g) => (
          <div key={g.sede} className="p-mapa-grupo">
            <p className="p-mapa-pais">{g.pais}</p>
            {g.filas.map((f) => f.tipo === 'sede' ? (
              <button key={f.sede} type="button" className="p-mapa-fila" onClick={() => irASede(f.sede)}>
                <small>{g.pais}</small>
                <b>{t.paises.find((p) => p.codigo === f.sede)?.ciudad ?? g.pais}</b>
                <span>{f.n} {t.obrasCiudad}</span>
              </button>
            ) : (
              <button key={f.obra.id} type="button" className={`p-mapa-fila${sel === f.k ? ' sel' : ''}`} onClick={() => setSel(f.k)}>
                <small>{g.pais}</small>
                <b>{f.obra.nombre}</b>
                {datosDeTarjeta(f.obra, idioma).descriptor && <span>{datosDeTarjeta(f.obra, idioma).descriptor}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

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
.p-cambio,.p-cambio-sub{display:inline-block;animation:p-cambio 1.2s var(--p-curva) both;}
.p-mapa-sub{font-size:clamp(16px,.9rem + .4vw,20px);line-height:1.4;overflow:hidden;color:rgba(251,251,250,.8);}
.p-mapa.ciudad .p-mapa-sub{color:rgba(20,20,20,.7);}
@keyframes p-cambio{from{transform:translateY(105%)}to{transform:none}}
.p-mapa-txt .p-h2,.p-mapa-txt .p-it,.p-cifra{text-shadow:0 2px 24px rgba(13,13,13,.55);transition:color 1.2s,text-shadow 1.2s;}
/* Ya en la ciudad: el estilo del estudio es claro, así que la pantalla pasa a tinta sobre papel */
.p-mapa-velo::after{content:'';position:absolute;inset:0;opacity:0;transition:opacity 1.6s;
  background:linear-gradient(180deg,rgba(244,243,240,.8) 0%,rgba(244,243,240,.25) 28%,rgba(244,243,240,0) 52%,rgba(244,243,240,.55) 78%,rgba(244,243,240,.95) 100%);}
.p-mapa.ciudad .p-mapa-velo{background:none;}
.p-mapa.ciudad .p-mapa-velo::after{opacity:1;}
.p-mapa.ciudad .p-mapa-txt .p-h2,.p-mapa.ciudad .p-cifra b{color:#141414;text-shadow:none;}
.p-mapa.ciudad .p-mapa-txt .p-it,.p-mapa.ciudad .p-rotulo-sec{color:#4f6556;text-shadow:none;}
.p-mapa.ciudad .p-cifra{color:rgba(20,20,20,.62);text-shadow:none;}
.p-mapa.ciudad .p-explorar{color:#141414;border-color:rgba(20,20,20,.22);background:rgba(244,243,240,.72);}
.p-mapa.ciudad .p-mapa-ayuda{color:rgba(20,20,20,.7);}
.p-mapa.ciudad .p-obra-in span{background:#2f4238;box-shadow:0 0 0 3px rgba(244,243,240,.9),0 6px 16px rgba(0,0,0,.25);}
.p-mapa.ciudad .p-obra-onda{color:#2f4238;}
.p-mapa.ciudad .p-obra.sel .p-obra-in span{background:#2f4238;}
.p-mapa.ciudad .mapboxgl-ctrl-attrib{background:rgba(244,243,240,.6)!important;}
.p-mapa.ciudad .mapboxgl-ctrl-attrib a{color:rgba(20,20,20,.6)!important;}
.p-mapa-pie{display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;margin-top:6px;pointer-events:auto;}
.p-cifra{font-size:13px;letter-spacing:.04em;color:rgba(251,251,250,.7);opacity:0;transform:translateY(8px);transition:opacity 1s var(--p-curva),transform 1s var(--p-curva);}
.p-cifra.on{opacity:1;transform:none;}
.p-cifra b{font-weight:200;font-size:28px;color:var(--p-blanco);margin-right:6px;letter-spacing:-.02em;vertical-align:-3px;}

/* Lista de proyectos. Móvil: tira horizontal abajo, solo explorando y sin tarjeta. */
.p-mapa-lista{position:absolute;z-index:3;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + 18px);display:none;gap:8px;
  padding:0 var(--p-gutter);overflow-x:auto;scrollbar-width:none;overscroll-behavior:contain;}
.p-mapa-lista::-webkit-scrollbar{display:none;}
.p-mapa.explorando .p-mapa-lista{display:flex;}
.p-mapa.explorando .p-mapa-lista.con-obra{display:none;}
.p-mapa-grupo{display:contents;}
.p-mapa-pais{display:none;}
.p-mapa-fila,.p-mapa-mundo{flex:none;display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:10px 14px;min-height:46px;justify-content:center;
  background:rgba(20,20,20,.78);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid rgba(251,251,250,.14);color:#fbfbfa;
  font:inherit;text-align:left;cursor:pointer;transition:background .25s,border-color .25s;}
.p-mapa-fila small{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(251,251,250,.55);}
.p-mapa-fila b{font-size:14px;font-weight:400;white-space:nowrap;}
.p-mapa-fila span{font-size:11px;color:rgba(251,251,250,.55);white-space:nowrap;}
.p-mapa-fila.sel{background:#2f4238;border-color:var(--p-salvia);}
.p-mapa-mundo{flex-direction:row;align-items:center;gap:8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:500;}
.p-mapa-mundo svg{width:15px;height:15px;}
.p-mapa.ciudad .p-mapa-fila,.p-mapa.ciudad .p-mapa-mundo{background:rgba(244,243,240,.86);border-color:rgba(20,20,20,.12);color:#141414;}
.p-mapa.ciudad .p-mapa-fila small,.p-mapa.ciudad .p-mapa-fila span{color:rgba(20,20,20,.55);}
.p-mapa.ciudad .p-mapa-fila.sel{background:#2f4238;color:#fbfbfa;}
.p-mapa.ciudad .p-mapa-fila.sel small,.p-mapa.ciudad .p-mapa-fila.sel span{color:rgba(251,251,250,.7);}

/* Sedes en el globo */
.p-sede{padding:6px;margin:-6px;background:none;border:0;font:inherit;cursor:pointer;transition:opacity .6s;}
.p-sede:hover .p-sede-punto{transform:scale(1.4);}
.p-sede-punto{transition:transform .3s var(--p-curva);}
@media (pointer:coarse){.p-mapa:not(.explorando) .p-sede{pointer-events:none;}}
/* Globo o ciudad: las sedes se ven desde el espacio y las obras, en la ciudad. */
.p-lienzo.en-ciudad .p-sede{opacity:0;pointer-events:none;}
.p-lienzo:not(.en-ciudad) .p-obra{opacity:0;pointer-events:none;}
.p-obra{transition:opacity .6s;}
.p-sede-in{display:flex;align-items:center;gap:10px;opacity:0;transform:translateY(6px);animation:p-entra 1s var(--p-curva) forwards;animation-delay:var(--d);}
.p-sede-punto{position:relative;width:9px;height:9px;border-radius:50%;background:#fbfbfa;box-shadow:0 0 0 4px rgba(143,165,150,.35);}
.p-sede-punto::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:1px solid rgba(251,251,250,.7);animation:p-pulso 2.4s ease-out infinite;}
.p-sede-txt{font-size:12px;line-height:1.35;color:rgba(251,251,250,.8);text-shadow:0 1px 10px rgba(0,0,0,.6);white-space:nowrap;}
.p-sede-txt b{display:block;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#fbfbfa;}
.p-sede.izq .p-sede-in{flex-direction:row-reverse;text-align:right;}
@media (max-width:700px){.p-sede-txt{font-size:11px;}.p-sede-txt b{letter-spacing:.1em;}.p-sede-txt{max-width:120px;white-space:normal;}}
@keyframes p-entra{to{opacity:1;transform:none;}}
@keyframes p-pulso{0%{transform:scale(.6);opacity:1}100%{transform:scale(2.6);opacity:0}}

/* Obras */
.p-obra{width:30px;height:30px;padding:0;border:0;background:transparent;}
.p-obra-in{width:30px;height:30px;display:grid;place-items:center;opacity:0;transform:translateY(-14px);animation:p-entra .9s var(--p-curva) forwards;animation-delay:var(--d);}
.p-obra-in{position:relative;}
.p-obra-in span{position:relative;z-index:1;width:13px;height:13px;border-radius:50%;background:#fbfbfa;box-shadow:0 0 0 3px rgba(13,13,13,.35),0 6px 16px rgba(0,0,0,.4);transition:transform .35s var(--p-curva),background .35s;}
/* onda que invita a tocar: cada punto late a su ritmo */
.p-obra-onda{position:absolute;left:50%;top:50%;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;border:1.5px solid currentColor;color:#fbfbfa;
  animation:p-onda 2.6s cubic-bezier(.2,.6,.3,1) infinite;animation-delay:calc(var(--d) * 3);pointer-events:none;}
@keyframes p-onda{0%{transform:scale(1);opacity:.9}100%{transform:scale(3.4);opacity:0}}
.p-obra-in em{position:absolute;left:50%;bottom:calc(100% + 4px);transform:translate(-50%,4px);white-space:nowrap;font-style:normal;font-size:12px;font-weight:500;
  padding:4px 8px;background:#141414;color:#fbfbfa;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;}
.p-obra:hover .p-obra-in em,.p-obra.sel .p-obra-in em{opacity:1;transform:translate(-50%,0);}
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
  .p-mapa-txt{top:auto;bottom:clamp(48px,9vh,104px);max-width:min(640px,calc(100% - 300px - var(--p-gutter) * 3));}
  .p-tarjeta{right:auto;bottom:clamp(48px,9vh,104px);width:530px;grid-template-columns:240px 1fr auto;}
  .p-tarjeta img{width:240px;min-height:240px;}

  /* Columna a la derecha, siempre que la pantalla esté a la vista. Tiene que caber
     sin desplazarse: la rueda es de la página. Por eso Madrid va en una fila. */
  .p-mapa-lista,.p-mapa.explorando .p-mapa-lista,.p-mapa.explorando .p-mapa-lista.con-obra{display:flex;}
  .p-mapa-lista{left:auto;right:var(--p-gutter);top:calc(env(safe-area-inset-top) + 92px);bottom:auto;width:290px;max-height:calc(100% - 92px - clamp(48px,9vh,104px));
    flex-direction:column;gap:0;padding:0;overflow:hidden;opacity:0;transform:translateX(12px);transition:opacity 1s var(--p-curva),transform 1s var(--p-curva);}
  .p-mapa-lista.on{opacity:1;transform:none;}
  .p-mapa-grupo{display:flex;flex-direction:column;}
  .p-mapa-pais{display:block;margin:14px 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:500;color:rgba(251,251,250,.6);}
  .p-mapa-grupo:first-of-type .p-mapa-pais{margin-top:0;}
  .p-mapa-fila{min-height:0;padding:7px 12px;border-width:0 0 0 1px;border-color:rgba(251,251,250,.18);background:transparent;-webkit-backdrop-filter:none;backdrop-filter:none;
    flex-direction:row;align-items:baseline;justify-content:space-between;gap:10px;}
  .p-mapa-fila small{display:none;}
  .p-mapa-fila b{font-size:14px;overflow:hidden;text-overflow:ellipsis;}
  .p-mapa-fila:hover{border-color:#fbfbfa;background:rgba(13,13,13,.35);}
  .p-mapa-fila.sel{border-color:var(--p-salvia);border-left-width:2px;}
  .p-mapa-mundo{align-self:flex-start;margin-bottom:16px;min-height:38px;padding:0 14px;border-radius:999px;}
  .p-mapa-txt .p-h2,.p-mapa-pais,.p-mapa-fila b{text-shadow:0 2px 18px rgba(13,13,13,.5);}
  .p-mapa.ciudad .p-mapa-pais{color:#4f6556;text-shadow:none;}
  .p-mapa.ciudad .p-mapa-fila{background:transparent;border-color:rgba(20,20,20,.18);}
  .p-mapa.ciudad .p-mapa-fila b{text-shadow:none;}
  .p-mapa.ciudad .p-mapa-fila:hover{background:rgba(244,243,240,.7);border-color:#141414;}
  .p-mapa.ciudad .p-mapa-fila.sel{background:rgba(244,243,240,.85);color:#141414;border-color:#2f4238;}
  .p-mapa.ciudad .p-mapa-fila.sel span{color:rgba(20,20,20,.55);}
}
`
