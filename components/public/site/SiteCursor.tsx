'use client'

import { useEffect, useRef, useState } from 'react'
import { site } from './theme'

// Cursor personalizado (anillo que sigue al ratón con easing y crece sobre
// elementos interactivos, mostrando una etiqueta si tienen data-cursor).
// Portado del teaser WIP. Solo en puntero fino y sin reduce-motion.
// mix-blend-mode: difference → se lee sobre fondos claros y oscuros por igual.

const SEL = 'a,button,[data-cursor],.fp-interactive'

export function SiteCursor() {
  const [active, setActive] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (fine && !reduce) setActive(true)
  }, [])

  useEffect(() => {
    if (!active) return
    const wrap = wrapRef.current, ring = ringRef.current, label = labelRef.current
    if (!wrap || !ring || !label) return

    const ac = new AbortController()
    const sig = { signal: ac.signal }
    let curX = -100, curY = -100, cgX = -100, cgY = -100, raf = 0

    document.addEventListener('mousemove', (e) => { curX = e.clientX; curY = e.clientY }, sig)

    const tick = () => {
      // Factor de seguimiento: más alto = la bolita persigue al ratón más de cerca.
      cgX += (curX - cgX) * 0.34
      cgY += (curY - cgY) * 0.34
      wrap.style.transform = `translate(${cgX.toFixed(1)}px,${cgY.toFixed(1)}px) translate(-50%,-50%)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const grow = (w: string) => { ring.style.width = w; ring.style.height = w }

    document.addEventListener('mouseover', (e) => {
      const el = (e.target as HTMLElement).closest?.(SEL) as HTMLElement | null
      if (!el) return
      const txt = el.getAttribute('data-cursor')
      if (txt) { grow('58px'); label.textContent = txt; label.style.opacity = '1' }
      else grow('34px')
    }, sig)

    document.addEventListener('mouseout', (e) => {
      const el = (e.target as HTMLElement).closest?.(SEL) as HTMLElement | null
      if (!el) return
      const to = (e as MouseEvent).relatedTarget as HTMLElement | null
      if (to && to.closest?.(SEL)) return
      grow('9px'); label.style.opacity = '0'
    }, sig)

    return () => { ac.abort(); cancelAnimationFrame(raf) }
  }, [active])

  if (!active) return null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `.fp-site, .fp-site * { cursor: none !important; }` }} />
      <div ref={wrapRef}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none', mixBlendMode: 'difference', color: '#fff', transform: 'translate(-9999px,-9999px)' }}>
        <div ref={ringRef}
          style={{ width: 9, height: 9, borderRadius: '50%', border: '1px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'width .3s cubic-bezier(.2,.8,.2,1), height .3s cubic-bezier(.2,.8,.2,1), opacity .3s ease' }}>
          <span ref={labelRef}
            style={{ fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0, whiteSpace: 'nowrap', transition: 'opacity .25s ease', fontFamily: site.font }} />
        </div>
      </div>
    </>
  )
}
