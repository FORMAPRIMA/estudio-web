'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'

export interface ConfettiHandle {
  fire: (n?: number) => void
}

// Canvas de confetti puramente decorativo. Expone fire() vía ref.
const Confetti = forwardRef<ConfettiHandle>(function Confetti(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useImperativeHandle(ref, () => ({
    fire(n = 120) {
      const cv = canvasRef.current
      if (!cv) return
      const dpr = window.devicePixelRatio || 1
      const w = cv.clientWidth, h = cv.clientHeight
      if (!w || !h) return
      cv.width = w * dpr; cv.height = h * dpr
      const ctx = cv.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      const cols = ['#36f59a', '#34e3ff', '#ff4d9d', '#ffd23f', '#9d7bff', '#ff5b76']
      const parts: { x: number; y: number; vx: number; vy: number; g: number; s: number; c: string; rot: number; vr: number }[] = []
      for (let i = 0; i < n; i++) {
        parts.push({
          x: w / 2 + (Math.random() - 0.5) * 120, y: h * 0.38,
          vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 12 - 4,
          g: 0.34 + Math.random() * 0.2, s: 4 + Math.random() * 5,
          c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        })
      }
      let f = 0
      const tick = () => {
        ctx.clearRect(0, 0, w, h)
        let alive = false
        for (const p of parts) {
          p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr
          if (p.y < h + 20) alive = true
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot)
          ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore()
        }
        f++
        if (alive && f < 170) requestAnimationFrame(tick)
        else ctx.clearRect(0, 0, w, h)
      }
      requestAnimationFrame(tick)
    },
  }), [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, zIndex: 60, pointerEvents: 'none', width: '100%', height: '100%' }}
    />
  )
})

export default Confetti
