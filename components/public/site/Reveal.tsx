'use client'

import { useEffect, useRef, useState } from 'react'

// Entrada editorial de títulos/bloques: fade-up + desenfoque que se disipa.
// Se dispara al entrar en viewport (IntersectionObserver), así sirve tanto para
// el hero (visible al cargar) como para headings más abajo al hacer scroll.
// Respeta prefers-reduced-motion (aparece sin animación).

export function Reveal({
  children, delay = 0, as, style, className, once = true, y = 24,
}: {
  children: React.ReactNode
  delay?: number
  as?: keyof JSX.IntrinsicElements
  style?: React.CSSProperties
  className?: string
  once?: boolean
  y?: number
}) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setReduce(true); setShown(true); return }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { setShown(true); if (once) io.disconnect() }
        else if (!once) setShown(false)
      })
    }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [once])

  const Tag = (as || 'div') as any
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : `translateY(${y}px)`,
        filter: shown ? 'blur(0px)' : 'blur(6px)',
        transition: reduce ? 'none'
          : `opacity .95s cubic-bezier(.16,1,.3,1) ${delay}ms, transform .95s cubic-bezier(.16,1,.3,1) ${delay}ms, filter .95s ease ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Tag>
  )
}
