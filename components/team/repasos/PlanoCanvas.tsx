'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

// Visor del plano: pan + pinch-zoom + pins.
//
// Los pins NO viven dentro del elemento transformado: se posicionan en coordenadas
// de pantalla calculadas a partir de la matriz. Así mantienen su tamaño al hacer
// zoom (un pin de 200 px sería inusable) y siguen anclados al punto exacto.
//
// Las coordenadas de un repaso son normalizadas (0..1) sobre la imagen del plano.

export interface PlanoPin {
  id: string
  x: number
  y: number
  numero: number
  codigo: string
  color: string
  dimmed?: boolean
}

export interface PlanoCanvasHandle {
  /** Centra y acerca el plano sobre un punto normalizado. */
  focusPoint: (x: number, y: number) => void
  /** Vuelve a encajar el plano completo. */
  fit: () => void
}

interface Props {
  src: string
  /** Dimensiones naturales de la imagen del plano (para el aspect ratio). */
  imgW: number
  imgH: number
  pins: PlanoPin[]
  selectedId: string | null
  onSelectPin: (id: string) => void
  /** Modo colocación: el siguiente toque sitúa (o arrastra) el pin fantasma. */
  placing?: boolean
  ghost?: { x: number; y: number } | null
  onPlace?: (p: { x: number; y: number }) => void
  /** Toque en el plano fuera de un pin, en modo normal. */
  onBackgroundTap?: () => void
}

interface View {
  scale: number
  tx: number
  ty: number
}

const TAP_SLOP = 8         // px de movimiento que siguen contando como toque
const TAP_MS = 400
const DOUBLE_TAP_MS = 300
const MAX_SCALE_FACTOR = 12 // respecto al scale de encaje

const PlanoCanvas = forwardRef<PlanoCanvasHandle, Props>(function PlanoCanvas(
  { src, imgW, imgH, pins, selectedId, onSelectPin, placing, ghost, onPlace, onBackgroundTap },
  ref
) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 })
  const [dragging, setDragging] = useState(false)

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const pinchStart = useRef<{ dist: number; mx: number; my: number; view: View } | null>(null)
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null)
  const ghostDrag = useRef(false)
  const viewRef = useRef(view)
  viewRef.current = view

  // ── Encaje y clamps ─────────────────────────────────────────────────────────

  const fitScale = useCallback(() => {
    if (!box.w || !box.h) return 1
    return Math.min(box.w / imgW, box.h / imgH) * 0.96
  }, [box.w, box.h, imgW, imgH])

  const clampView = useCallback(
    (v: View): View => {
      const min = fitScale()
      const scale = Math.min(Math.max(v.scale, min), min * MAX_SCALE_FACTOR)
      const rw = imgW * scale
      const rh = imgH * scale
      // Si el plano cabe en el eje, se centra; si no, no se puede dejar hueco.
      const tx = rw <= box.w ? (box.w - rw) / 2 : Math.min(0, Math.max(box.w - rw, v.tx))
      const ty = rh <= box.h ? (box.h - rh) / 2 : Math.min(0, Math.max(box.h - rh, v.ty))
      return { scale, tx, ty }
    },
    [box.w, box.h, imgW, imgH, fitScale]
  )

  const doFit = useCallback(() => {
    const scale = fitScale()
    setView(clampView({ scale, tx: 0, ty: 0 }))
  }, [fitScale, clampView])

  // Medida del contenedor (y re-encaje al rotar el móvil o cambiar de plano)
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (box.w && box.h) doFit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.w, box.h, src, imgW, imgH])

  // ── Conversión de coordenadas ───────────────────────────────────────────────

  const toNormalized = useCallback(
    (clientX: number, clientY: number) => {
      const rect = boxRef.current!.getBoundingClientRect()
      const v = viewRef.current
      const x = (clientX - rect.left - v.tx) / (imgW * v.scale)
      const y = (clientY - rect.top - v.ty) / (imgH * v.scale)
      return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
    },
    [imgW, imgH]
  )

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      setView((v) => {
        const min = fitScale()
        const next = Math.min(Math.max(v.scale * factor, min), min * MAX_SCALE_FACTOR)
        const k = next / v.scale
        return clampView({ scale: next, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k })
      })
    },
    [fitScale, clampView]
  )

  useImperativeHandle(ref, () => ({
    focusPoint(x: number, y: number) {
      const min = fitScale()
      const scale = Math.min(min * 2.6, min * MAX_SCALE_FACTOR)
      setView(
        clampView({
          scale,
          tx: box.w / 2 - x * imgW * scale,
          ty: box.h / 2 - y * imgH * scale,
        })
      )
    },
    fit: doFit,
  }))

  // ── Rueda del ratón (desktop) ───────────────────────────────────────────────

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.14 : 1 / 1.14, e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // ── Punteros: pan, pinch y toques ───────────────────────────────────────────

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }
      tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      const rect = boxRef.current!.getBoundingClientRect()
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mx: (a.x + b.x) / 2 - rect.left,
        my: (a.y + b.y) / 2 - rect.top,
        view: viewRef.current,
      }
      tapStart.current = null
      setDragging(false)
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Arrastre del pin fantasma: manda sobre el pan.
    if (ghostDrag.current && onPlace) {
      onPlace(toNormalized(e.clientX, e.clientY))
      return
    }

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values())
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const start = pinchStart.current
      const factor = dist / (start.dist || 1)
      const min = fitScale()
      const scale = Math.min(Math.max(start.view.scale * factor, min), min * MAX_SCALE_FACTOR)
      const k = scale / start.view.scale
      setView(
        clampView({
          scale,
          tx: start.mx - (start.mx - start.view.tx) * k,
          ty: start.my - (start.my - start.view.ty) * k,
        })
      )
      return
    }

    if (pointers.current.size === 1 && panStart.current) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      if (!dragging && Math.hypot(dx, dy) > TAP_SLOP) setDragging(true)
      setView((v) =>
        clampView({ scale: v.scale, tx: panStart.current!.tx + dx, ty: panStart.current!.ty + dy })
      )
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const wasGhostDrag = ghostDrag.current
    ghostDrag.current = false
    pointers.current.delete(e.pointerId)

    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) {
      const start = tapStart.current
      const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) : 999
      const quick = start ? Date.now() - start.t < TAP_MS : false
      const isTap = !wasGhostDrag && !!start && moved <= TAP_SLOP && quick

      if (isTap) {
        const prev = lastTap.current
        const isDouble =
          prev && Date.now() - prev.t < DOUBLE_TAP_MS &&
          Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24

        if (isDouble && !placing) {
          const rect = boxRef.current!.getBoundingClientRect()
          const min = fitScale()
          const zoomedIn = viewRef.current.scale > min * 1.4
          if (zoomedIn) doFit()
          else zoomAt(2.6, e.clientX - rect.left, e.clientY - rect.top)
          lastTap.current = null
        } else {
          lastTap.current = { x: e.clientX, y: e.clientY, t: Date.now() }
          if (placing && onPlace) onPlace(toNormalized(e.clientX, e.clientY))
          else onBackgroundTap?.()
        }
      }

      panStart.current = null
      tapStart.current = null
      setDragging(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const screenOf = (x: number, y: number) => ({
    left: view.tx + x * imgW * view.scale,
    top: view.ty + y * imgH * view.scale,
  })

  const zoomed = view.scale > fitScale() * 1.05

  return (
    <div
      ref={boxRef}
      className="rp-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#111',
        touchAction: 'none',
        cursor: placing ? 'crosshair' : dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Plano */}
      <img
        src={src}
        alt="Plano del proyecto"
        draggable={false}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: imgW,
          height: imgH,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
          imageRendering: zoomed ? 'auto' : 'auto',
        }}
      />

      {/* Pins */}
      {pins.map((p) => {
        const pos = screenOf(p.x, p.y)
        const selected = p.id === selectedId
        return (
          <button
            key={p.id}
            className={`rp-pin${selected ? ' rp-pin-selected' : ''}`}
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
            onClick={(e) => {
              e.stopPropagation()
              onSelectPin(p.id)
            }}
            title={`${p.codigo}`}
            style={{
              position: 'absolute',
              left: pos.left,
              top: pos.top,
              transform: `translate(-50%, -100%) scale(${selected ? 1.18 : 1})`,
              opacity: p.dimmed ? 0.28 : 1,
              zIndex: selected ? 6 : 4,
              ['--rp-pin-color' as string]: p.color,
            }}
          >
            <span className="rp-pin-body">{p.numero}</span>
            <span className="rp-pin-tail" />
            {selected && <span className="rp-pin-halo" />}
          </button>
        )
      })}

      {/* Pin fantasma (modo colocación) */}
      {placing && ghost && (
        <div
          className="rp-ghost"
          onPointerDown={(e) => {
            e.stopPropagation()
            ghostDrag.current = true
            ;(e.target as Element).setPointerCapture?.(e.pointerId)
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
          }}
          onPointerMove={(e) => {
            if (ghostDrag.current && onPlace) onPlace(toNormalized(e.clientX, e.clientY))
          }}
          onPointerUp={(e) => {
            ghostDrag.current = false
            pointers.current.delete(e.pointerId)
          }}
          style={{
            position: 'absolute',
            left: screenOf(ghost.x, ghost.y).left,
            top: screenOf(ghost.x, ghost.y).top,
            zIndex: 8,
          }}
        >
          <span className="rp-ghost-ring" />
          <span className="rp-ghost-dot" />
        </div>
      )}

      {/* Retícula del modo colocación */}
      {placing && !ghost && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 50% 50%, rgba(216,90,48,0.10) 0%, rgba(0,0,0,0) 45%)',
          }}
        />
      )}

      {/* Controles de zoom */}
      <div className="rp-zoom">
        <button onClick={() => zoomAt(1.4, box.w / 2, box.h / 2)} aria-label="Acercar">+</button>
        <button onClick={() => zoomAt(1 / 1.4, box.w / 2, box.h / 2)} aria-label="Alejar">−</button>
        <button onClick={doFit} aria-label="Encajar" style={{ fontSize: 11 }}>◱</button>
      </div>
    </div>
  )
})

export default PlanoCanvas
