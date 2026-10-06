'use client'

// Medición de un dossier que es sala (ver app/api/salas/t/route.ts).
// Cuenta el tiempo REAL en cada diapositiva: solo suma con la pestaña visible y
// con señales de vida en el último minuto (tocar, desplazar, teclear, un vídeo
// reproduciéndose o cambiar de diapositiva). Un móvil abierto encima de la mesa
// no infla el mapa de calor. Envía lotes cada 15 s y uno último al cerrar.

import { useCallback, useEffect, useRef } from 'react'

// Una sola apertura de sesión por carga de página, aunque React monte el
// efecto dos veces (modo estricto) o se recree el componente.
const inicios = new Map<string, Promise<string | null>>()
function iniciar(slug: string): Promise<string | null> {
  let p = inicios.get(slug)
  if (!p) {
    p = fetch('/api/salas/t', { method: 'POST', body: JSON.stringify({ slug, t: 'ini' }), headers: { 'Content-Type': 'text/plain' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.tok as string) ?? null)
      .catch(() => null)
    inicios.set(slug, p)
  }
  return p
}

const INACTIVO_MS = 60_000
const LOTE_MS = 15_000
const URL = '/api/salas/t'

interface Estado {
  tok: string | null
  listo: boolean
  slide: number
  etiqueta: string
  total: number
  max: number
  ultimaVida: number
  vistas: Map<number, { l: string; ms: number; e: number }>
  activo: number
  eventos: { k: string; s?: number; d?: string }[]
}

export function useMedicionSala(slug: string, activa: boolean) {
  const st = useRef<Estado>({
    tok: null, listo: false, slide: 0, etiqueta: '', total: 0, max: 0, ultimaVida: Date.now(),
    vistas: new Map(), activo: 0, eventos: [],
  })

  const vista = (s: number, l: string) => {
    const m = st.current.vistas
    const v = m.get(s) ?? { l, ms: 0, e: 0 }
    if (l) v.l = l
    m.set(s, v)
    return v
  }

  const enviar = useCallback((alCerrar: boolean) => {
    const e = st.current
    if (!e.tok || (!e.vistas.size && !e.eventos.length && !e.activo)) return
    const cuerpo = JSON.stringify({
      slug, t: 'lote', tok: e.tok, activo: e.activo, max: e.max, total: e.total, eventos: e.eventos,
      vistas: Array.from(e.vistas, ([s, v]) => ({ s, l: v.l, ms: v.ms, e: v.e })),
    })
    e.vistas = new Map(); e.activo = 0; e.eventos = []
    if (alCerrar && navigator.sendBeacon) navigator.sendBeacon(URL, new Blob([cuerpo], { type: 'text/plain' }))
    else fetch(URL, { method: 'POST', body: cuerpo, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {})
  }, [slug])

  // Apertura de sesión + reloj de 1 s + lotes.
  useEffect(() => {
    if (!activa) return
    const e = st.current
    iniciar(slug).then((tok) => { e.tok = tok; e.listo = true })

    let previo = Date.now()
    const reloj = setInterval(() => {
      const ahora = Date.now(), dt = Math.min(ahora - previo, 5_000)
      previo = ahora
      if (document.visibilityState !== 'visible' || ahora - e.ultimaVida > INACTIVO_MS || !e.total) return
      vista(e.slide, e.etiqueta).ms += dt
      e.activo += dt
    }, 1_000)
    const lote = setInterval(() => enviar(false), LOTE_MS)
    const oculto = () => { if (document.visibilityState === 'hidden') enviar(true) }
    const cerrar = () => enviar(true)
    const vida = () => { e.ultimaVida = Date.now() }
    document.addEventListener('visibilitychange', oculto)
    window.addEventListener('pagehide', cerrar)
    ;['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, vida, { passive: true }))
    return () => {
      clearInterval(reloj); clearInterval(lote)
      document.removeEventListener('visibilitychange', oculto)
      window.removeEventListener('pagehide', cerrar)
      ;['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.removeEventListener(ev, vida))
      enviar(true)
    }
  }, [activa, slug, enviar])

  /** El dossier cambió de diapositiva. */
  const alSlide = useCallback((i: number, n: number, l: string) => {
    if (!activa) return
    const e = st.current
    e.ultimaVida = Date.now()
    if (e.total && i === e.slide) return
    e.slide = i; e.etiqueta = l; e.total = n
    if (i > e.max) e.max = i
    vista(i, l).e += 1
    if (n && i === n - 1) e.eventos.push({ k: 'final', s: i })
  }, [activa])

  /** Señal de vida desde dentro del iframe (toques, vídeo en marcha…). */
  const alVida = useCallback(() => { st.current.ultimaVida = Date.now() }, [])

  /** Interacción con nombre: vídeo, idioma, interes, 3d, enlace. */
  const alEvento = useCallback((k: string, d?: string) => {
    if (!activa) return
    const e = st.current
    e.ultimaVida = Date.now()
    e.eventos.push({ k, s: e.slide, d })
    if (k === 'interes') enviar(false)
  }, [activa, enviar])

  return { alSlide, alVida, alEvento }
}
