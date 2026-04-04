'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const R = 20 // ruler thickness in px

function drawHRuler(canvas: HTMLCanvasElement, width: number, scrollX: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = width
  canvas.height = R
  ctx.clearRect(0, 0, width, R)
  ctx.fillStyle = 'rgba(30,30,30,0.88)'
  ctx.fillRect(0, 0, width, R)

  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '7px monospace'
  ctx.textBaseline = 'top'

  const start = Math.floor(scrollX / 10) * 10
  for (let x = start; x < scrollX + width; x += 5) {
    const px = x - scrollX
    const isMajor = x % 100 === 0
    const isMid = x % 50 === 0
    const tickH = isMajor ? 13 : isMid ? 9 : 5
    ctx.lineWidth = isMajor ? 1 : 0.5
    ctx.beginPath()
    ctx.moveTo(px + 0.5, R)
    ctx.lineTo(px + 0.5, R - tickH)
    ctx.stroke()
    if (isMid && x > 0) {
      ctx.fillText(String(x), px + 2, 2)
    }
  }
}

function drawVRuler(canvas: HTMLCanvasElement, height: number, scrollY: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = R
  canvas.height = height
  ctx.clearRect(0, 0, R, height)
  ctx.fillStyle = 'rgba(30,30,30,0.88)'
  ctx.fillRect(0, 0, R, height)

  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '7px monospace'

  const start = Math.floor(scrollY / 10) * 10
  for (let y = start; y < scrollY + height; y += 5) {
    const py = y - scrollY
    const isMajor = y % 100 === 0
    const isMid = y % 50 === 0
    const tickW = isMajor ? 13 : isMid ? 9 : 5
    ctx.lineWidth = isMajor ? 1 : 0.5
    ctx.beginPath()
    ctx.moveTo(R, py + 0.5)
    ctx.lineTo(R - tickW, py + 0.5)
    ctx.stroke()
    if (isMid && y > 0) {
      ctx.save()
      ctx.translate(R - 3, py - 1)
      ctx.rotate(-Math.PI / 2)
      ctx.textBaseline = 'middle'
      ctx.fillText(String(y), 0, 0)
      ctx.restore()
    }
  }
}

export default function RulerOverlay() {
  const [visible, setVisible] = useState(false)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [scroll, setScroll] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ w: 0, h: 0 })
  const hRef = useRef<HTMLCanvasElement>(null)
  const vRef = useRef<HTMLCanvasElement>(null)

  const redraw = useCallback(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    const sx = window.scrollX
    const sy = window.scrollY
    setSize({ w, h })
    setScroll({ x: sx, y: sy })
    if (hRef.current) drawHRuler(hRef.current, w - R, sx)
    if (vRef.current) drawVRuler(vRef.current, h - R, sy)
  }, [])

  useEffect(() => {
    if (!visible) return
    redraw()
    window.addEventListener('resize', redraw)
    window.addEventListener('scroll', redraw)
    return () => {
      window.removeEventListener('resize', redraw)
      window.removeEventListener('scroll', redraw)
    }
  }, [visible, redraw])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setVisible(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleMouseMove = (e: React.MouseEvent) => {
    setMouse({ x: Math.round(e.clientX), y: Math.round(e.clientY) })
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setVisible(v => !v)}
        title="Toggle ruler (R)"
        style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 10000 }}
        className={`w-8 h-8 flex items-center justify-center text-[10px] font-mono border transition-colors shadow-md ${
          visible
            ? 'bg-ink text-cream border-ink'
            : 'bg-white/90 text-ink/50 border-ink/20 hover:border-ink/50'
        }`}
      >
        R
      </button>

      {visible && (
        <div
          onMouseMove={handleMouseMove}
          style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}
        >
          {/* Pointer-events layer just for mouse tracking */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'all', cursor: 'crosshair' }}
            onMouseMove={handleMouseMove} />

          {/* Corner square */}
          <div style={{
            position: 'fixed', top: 0, left: 0, width: R, height: R,
            background: 'rgba(30,30,30,0.88)', zIndex: 9999,
          }} />

          {/* Horizontal ruler */}
          <canvas ref={hRef} style={{ position: 'fixed', top: 0, left: R, zIndex: 9999 }} />

          {/* Vertical ruler */}
          <canvas ref={vRef} style={{ position: 'fixed', top: R, left: 0, zIndex: 9999 }} />

          {/* Crosshair lines */}
          <div style={{
            position: 'fixed', top: R, left: mouse.x, width: 1, bottom: 0,
            background: 'rgba(255,80,80,0.5)', pointerEvents: 'none', zIndex: 9997,
          }} />
          <div style={{
            position: 'fixed', left: R, top: mouse.y, height: 1, right: 0,
            background: 'rgba(255,80,80,0.5)', pointerEvents: 'none', zIndex: 9997,
          }} />

          {/* Marker on H ruler */}
          <div style={{
            position: 'fixed', top: 0, left: mouse.x, width: 1, height: R,
            background: 'rgba(255,80,80,0.9)', zIndex: 9999, pointerEvents: 'none',
          }} />
          {/* Marker on V ruler */}
          <div style={{
            position: 'fixed', left: 0, top: mouse.y, width: R, height: 1,
            background: 'rgba(255,80,80,0.9)', zIndex: 9999, pointerEvents: 'none',
          }} />

          {/* Coordinates tooltip near cursor */}
          <div style={{
            position: 'fixed',
            left: mouse.x + 14,
            top: mouse.y + 14,
            background: 'rgba(30,30,30,0.88)',
            color: 'rgba(255,255,255,0.9)',
            fontSize: 9,
            fontFamily: 'monospace',
            padding: '2px 6px',
            pointerEvents: 'none',
            zIndex: 10000,
            whiteSpace: 'nowrap',
          }}>
            {mouse.x + scroll.x} · {mouse.y + scroll.y}
          </div>
        </div>
      )}
    </>
  )
}
