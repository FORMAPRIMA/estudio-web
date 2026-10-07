'use client'

import { useEffect, useRef, useState } from 'react'

// Visor de fotos a pantalla completa: la foto entera (contain, nunca recortada),
// swipe o flechas para pasar, Esc o ✕ para cerrar.

export default function Visor({ fotos, inicio = 0, titulo, onCerrar }: {
  fotos: string[]
  inicio?: number
  titulo?: string
  onCerrar: () => void
}) {
  const [i, setI] = useState(Math.min(inicio, Math.max(0, fotos.length - 1)))
  const toque = useRef<{ x: number; y: number } | null>(null)
  const n = fotos.length

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowRight') setI((x) => Math.min(n - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [n, onCerrar])

  if (!n) return null
  return (
    <div
      className="rc-visor"
      role="dialog"
      aria-modal="true"
      onPointerDown={(e) => { toque.current = { x: e.clientX, y: e.clientY } }}
      onPointerUp={(e) => {
        const s = toque.current
        toque.current = null
        if (!s) return
        const dx = e.clientX - s.x
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) setI((x) => Math.max(0, Math.min(n - 1, x + (dx < 0 ? 1 : -1))))
      }}
    >
      <img key={fotos[i]} className="rc-visor-img" src={fotos[i]} alt={titulo ?? ''} draggable={false} />
      <div className="rc-visor-cab">
        <span>{titulo}{n > 1 ? ` · ${i + 1}/${n}` : ''}</span>
        <button onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>
      {i > 0 && <button className="rc-visor-nav is-izq" onClick={() => setI(i - 1)} aria-label="Anterior">‹</button>}
      {i < n - 1 && <button className="rc-visor-nav is-der" onClick={() => setI(i + 1)} aria-label="Siguiente">›</button>}
    </div>
  )
}
