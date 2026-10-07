'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'

// Plano del recorrido: pan + pinch-zoom + pins + la ruta de la visita.
// Mismo motor que el PlanoCanvas de Repasos (los pins viven en coordenadas de
// pantalla, no dentro del elemento escalado, para no crecer con el zoom), con
// la estética del Open House: plano entonado, pins de bronce y ruta punteada.

export interface RcPin {
  id: string
  x: number
  y: number
  /** Número del recorrido; sin número = detalle secundario (punto discreto). */
  numero?: number
  apagado?: boolean
}

export interface PlanoHandle {
  focusPoint: (x: number, y: number, zoom?: number) => void
  fit: () => void
}

interface Props {
  src: string
  imgW: number
  imgH: number
  pins: RcPin[]
  selectedId?: string | null
  /** Pin "en vivo" (donde está ahora la visita): halo que respira. */
  vivoId?: string | null
  onSelectPin?: (id: string) => void
  ruta?: { x: number; y: number }[]
  tema?: 'oscuro' | 'claro'
  placing?: boolean
  ghost?: { x: number; y: number } | null
  onPlace?: (p: { x: number; y: number }) => void
  onBackgroundTap?: () => void
  /** Sin controles ni gestos: el minimapa de la story. */
  estatico?: boolean
  margen?: number
}

interface View { scale: number; tx: number; ty: number }

const TAP_SLOP = 8
const TAP_MS = 400
const DOUBLE_TAP_MS = 300
const MAX_ZOOM = 10

const Plano = forwardRef<PlanoHandle, Props>(function Plano(
  { src, imgW, imgH, pins, selectedId, vivoId, onSelectPin, ruta, tema = 'oscuro', placing, ghost, onPlace, onBackgroundTap, estatico, margen = 0.94 },
  ref
) {
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const W = nat?.w || (imgW > 0 ? imgW : 1600)
  const H = nat?.h || (imgH > 0 ? imgH : 1200)
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 })
  const [animar, setAnimar] = useState(false)
  const viewRef = useRef(view)
  viewRef.current = view

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const pinchStart = useRef<{ dist: number; mx: number; my: number; view: View } | null>(null)
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null)
  const ghostDrag = useRef(false)

  const fitScale = useCallback(() => (!box.w || !box.h ? 1 : Math.min(box.w / W, box.h / H) * margen), [box.w, box.h, W, H, margen])

  // Holgura: el plano se puede arrastrar más allá de su borde hasta que solo
  // quede un 30 % a la vista. Así cualquier esquina llega al centro de la
  // pantalla y nunca queda atrapada bajo un control.
  const clamp = useCallback((v: View): View => {
    const min = fitScale()
    const scale = Math.min(Math.max(v.scale, min), min * MAX_ZOOM)
    const rw = W * scale
    const rh = H * scale
    const tx = Math.min(box.w * 0.7, Math.max(box.w * 0.3 - rw, v.tx))
    const ty = Math.min(box.h * 0.7, Math.max(box.h * 0.3 - rh, v.ty))
    return { scale, tx, ty }
  }, [box.w, box.h, W, H, fitScale])

  const doFit = useCallback(() => {
    const scale = fitScale()
    setView(clamp({ scale, tx: (box.w - W * scale) / 2, ty: (box.h - H * scale) / 2 }))
  }, [fitScale, clamp, box.w, box.h, W, H])

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { if (box.w && box.h) doFit() }, [box.w, box.h, src, W, H]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setNat(null)
    const el = imgRef.current
    if (el?.complete && el.naturalWidth) setNat({ w: el.naturalWidth, h: el.naturalHeight })
  }, [src])

  const toNorm = useCallback((cx: number, cy: number) => {
    const el = boxRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const v = viewRef.current
    const x = (cx - r.left - v.tx) / (W * v.scale)
    const y = (cy - r.top - v.ty) / (H * v.scale)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
  }, [W, H])

  const zoomAt = useCallback((f: number, cx: number, cy: number) => {
    setView((v) => {
      const min = fitScale()
      const next = Math.min(Math.max(v.scale * f, min), min * MAX_ZOOM)
      const k = next / v.scale
      return clamp({ scale: next, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k })
    })
  }, [fitScale, clamp])

  useImperativeHandle(ref, () => ({
    focusPoint(x, y, zoom = 2.4) {
      const scale = fitScale() * zoom
      setAnimar(true)
      setView(clamp({ scale, tx: box.w / 2 - x * W * scale, ty: box.h / 2 - y * H * scale }))
      window.setTimeout(() => setAnimar(false), 650)
    },
    fit() {
      setAnimar(true)
      doFit()
      window.setTimeout(() => setAnimar(false), 650)
    },
  }))

  // Safari (iOS) se queda el pellizco para hacer zoom a TODA la página si no se
  // le cancela: sin esto el plano no amplía en el iPhone.
  useEffect(() => {
    const el = boxRef.current
    if (!el || estatico) return
    const cancelar = (e: Event) => e.preventDefault()
    const dosDedos = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault() }
    el.addEventListener('gesturestart', cancelar as EventListener, { passive: false })
    el.addEventListener('gesturechange', cancelar as EventListener, { passive: false })
    el.addEventListener('touchmove', dosDedos, { passive: false })
    return () => {
      el.removeEventListener('gesturestart', cancelar as EventListener)
      el.removeEventListener('gesturechange', cancelar as EventListener)
      el.removeEventListener('touchmove', dosDedos)
    }
  }, [estatico])

  useEffect(() => {
    const el = boxRef.current
    if (!el || estatico) return
    // Trackpad: dos dedos MUEVEN el plano y pellizcar (ctrlKey) hace zoom
    // proporcional al gesto. Rueda de ratón clásica (líneas): zoom por pasos.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      if (e.ctrlKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top)
      } else if (e.deltaMode !== 0) {
        zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top)
      } else {
        setView((v) => clamp({ scale: v.scale, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt, clamp, estatico])

  const capture = (t: EventTarget | null, id: number) => { try { (t as Element | null)?.setPointerCapture?.(id) } catch { /* soltado */ } }

  function onDown(e: React.PointerEvent) {
    if (estatico) return
    // Primer dedo de un gesto nuevo: se olvidan punteros cuyo «soltar» se perdió
    // (iOS a veces no lo manda) y que convertirían un arrastre en un pellizco.
    if (e.isPrimary) { pointers.current.clear(); pinchStart.current = null }
    capture(e.target, e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty }
      tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      const r = boxRef.current?.getBoundingClientRect()
      if (!a || !b || !r) return
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, view: viewRef.current }
      tapStart.current = null
      panStart.current = null
    }
  }

  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ghostDrag.current && onPlace) { const p = toNorm(e.clientX, e.clientY); if (p) onPlace(p); return }
    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values())
      if (!a || !b) return
      const s = pinchStart.current
      const min = fitScale()
      const scale = Math.min(Math.max(s.view.scale * (Math.hypot(a.x - b.x, a.y - b.y) / (s.dist || 1)), min), min * MAX_ZOOM)
      const k = scale / s.view.scale
      // El punto medio sigue a los dedos: pellizcar y arrastrar a la vez, como en Mapas.
      const r = boxRef.current?.getBoundingClientRect()
      const mx = r ? (a.x + b.x) / 2 - r.left : s.mx
      const my = r ? (a.y + b.y) / 2 - r.top : s.my
      const v = clamp({ scale, tx: mx - (s.mx - s.view.tx) * k, ty: my - (s.my - s.view.ty) * k })
      viewRef.current = v
      setView(v)
      return
    }
    if (pointers.current.size === 1 && panStart.current) {
      const s = panStart.current
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      const v = clamp({ scale: viewRef.current.scale, tx: s.tx + dx, ty: s.ty + dy })
      viewRef.current = v
      setView(v)
    }
  }

  function onUp(e: React.PointerEvent) {
    const wasGhost = ghostDrag.current
    ghostDrag.current = false
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 1) {
      // Al soltar un dedo tras el pellizco, el que queda sigue arrastrando desde
      // donde está AHORA el plano. Antes reutilizaba el arrastre previo al zoom
      // y el plano saltaba a su esquina superior izquierda.
      const [rest] = Array.from(pointers.current.values())
      panStart.current = rest ? { x: rest.x, y: rest.y, tx: viewRef.current.tx, ty: viewRef.current.ty } : null
      tapStart.current = null
    }
    if (pointers.current.size === 0) {
      const s = tapStart.current
      const isTap = !wasGhost && !!s && Math.hypot(e.clientX - s.x, e.clientY - s.y) <= TAP_SLOP && Date.now() - s.t < TAP_MS
      if (isTap) {
        const prev = lastTap.current
        const dbl = prev && Date.now() - prev.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24
        if (dbl && !placing) {
          const r = boxRef.current?.getBoundingClientRect()
          if (viewRef.current.scale > fitScale() * 1.4 || !r) doFit()
          else zoomAt(2.4, e.clientX - r.left, e.clientY - r.top)
          lastTap.current = null
        } else {
          lastTap.current = { x: e.clientX, y: e.clientY, t: Date.now() }
          if (placing && onPlace) { const p = toNorm(e.clientX, e.clientY); if (p) onPlace(p) }
          else {
            // Los pins no capturan toques (si lo hicieran, un dedo sobre una
            // chincheta bloquearía el pellizco): el toque corto busca la más cercana.
            const id = pinCercano(e.clientX, e.clientY)
            if (id) onSelectPin?.(id)
            else onBackgroundTap?.()
          }
        }
      }
      panStart.current = null
      tapStart.current = null
    }
  }

  function pinCercano(cx: number, cy: number): string | null {
    const el = boxRef.current
    if (!el || !onSelectPin) return null
    const r = el.getBoundingClientRect()
    const v = viewRef.current
    let mejor: string | null = null
    let dmin = 26
    for (const p of pins) {
      if (p.apagado) continue
      const d = Math.hypot(v.tx + p.x * W * v.scale + r.left - cx, v.ty + p.y * H * v.scale + r.top - cy)
      if (d < dmin) { dmin = d; mejor = p.id }
    }
    return mejor
  }

  const scr = (x: number, y: number) => ({ left: view.tx + x * W * view.scale, top: view.ty + y * H * view.scale })
  const trans = animar ? 'left .6s cubic-bezier(.2,.7,.2,1), top .6s cubic-bezier(.2,.7,.2,1), width .6s cubic-bezier(.2,.7,.2,1), height .6s cubic-bezier(.2,.7,.2,1)' : 'none'
  const pinTrans = animar ? 'left .6s cubic-bezier(.2,.7,.2,1), top .6s cubic-bezier(.2,.7,.2,1)' : undefined

  return (
    <div
      ref={boxRef}
      className={`rc-plano rc-plano-${tema}${placing ? ' rc-plano-placing' : ''}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <img
        ref={imgRef}
        src={src}
        alt="Plano de Claudio Coello 38"
        draggable={false}
        onLoad={(e) => {
          const el = e.currentTarget
          if (el.naturalWidth && (nat?.w !== el.naturalWidth || nat?.h !== el.naturalHeight)) setNat({ w: el.naturalWidth, h: el.naturalHeight })
        }}
        className="rc-plano-img"
        decoding="async"
        // Tamaño real en cada nivel de zoom, NUNCA transform: scale(). En iPhone
        // un transform obliga a rasterizar la capa entera a scale × 3 (DPR) y
        // con un plano de 2.600 px eso son cientos de MB: Safari mata la pestaña
        // y la recarga. Pintada a su tamaño, WebKit dibuja por teselas solo lo visible.
        style={{ left: view.tx, top: view.ty, width: W * view.scale, height: H * view.scale, transition: trans }}
      />

      {ruta && ruta.length > 1 && !animar && (
        <svg className="rc-ruta" width={box.w} height={box.h}>
          <polyline points={ruta.map((p) => { const s = scr(p.x, p.y); return `${s.left},${s.top}` }).join(' ')} />
        </svg>
      )}

      {pins.map((p) => {
        const s = scr(p.x, p.y)
        const sel = p.id === selectedId
        const vivo = p.id === vivoId
        const principal = p.numero !== undefined
        return (
          <span
            key={p.id}
            className={`rc-pin ${principal ? 'rc-pin-main' : 'rc-pin-sec'}${sel ? ' is-sel' : ''}${vivo ? ' is-vivo' : ''}${p.apagado ? ' is-off' : ''}`}
            style={{ left: s.left, top: s.top, transition: pinTrans }}
            aria-hidden
          >
            {vivo && <span className="rc-pin-halo" />}
            <span className="rc-pin-body">{principal ? p.numero : ''}</span>
          </span>
        )
      })}

      {placing && ghost && (
        <div
          className="rc-ghost"
          style={{ left: scr(ghost.x, ghost.y).left, top: scr(ghost.x, ghost.y).top }}
          onPointerDown={(e) => {
            e.stopPropagation()
            ghostDrag.current = true
            capture(e.target, e.pointerId)
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          }}
          onPointerMove={(e) => { if (ghostDrag.current && onPlace) { const p = toNorm(e.clientX, e.clientY); if (p) onPlace(p) } }}
          onPointerUp={(e) => { ghostDrag.current = false; pointers.current.delete(e.pointerId) }}
        >
          <span className="rc-ghost-ring" />
          <span className="rc-ghost-dot" />
        </div>
      )}

      {!estatico && (
        <div className="rc-zoom">
          <button onClick={() => zoomAt(1.4, box.w / 2, box.h / 2)} aria-label="Acercar">+</button>
          <button onClick={() => zoomAt(1 / 1.4, box.w / 2, box.h / 2)} aria-label="Alejar">−</button>
          <button onClick={doFit} aria-label="Ver todo" className="rc-zoom-fit">⤢</button>
        </div>
      )}
    </div>
  )
})

export default Plano
