'use client'

// Cifra que sube desde cero cuando se activa (la «rampa» de Torre del Mangle):
// curva 1 − (1 − t)^4, más larga cuanto mayor es el número. Conserva lo que lleva
// alrededor («+60», «62 %», «USD 9.488»). Con «reducir movimiento», la cifra final.

import { useEffect, useState } from 'react'

const partes = (texto: string) => {
  const m = texto.match(/^(\D*?)(\d[\d.]*)(.*)$/)
  if (!m) return null
  return { antes: m[1], valor: Number(m[2].replace(/\./g, '')), miles: m[2].includes('.'), despues: m[3] }
}

export default function Cifra({ texto, activa, retraso = 0 }: { texto: string | number; activa: boolean; retraso?: number }) {
  const t = String(texto)
  const p = partes(t)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!p) return
    if (!activa) { setN(0); return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(p.valor); return }
    let raf = 0, inicio = 0
    const dur = Math.min(2400, 1200 + Math.log10(p.valor + 1) * 420)
    const paso = (ahora: number) => {
      if (!inicio) inicio = ahora + retraso * 1000
      const k = Math.min(1, Math.max(0, (ahora - inicio) / dur))
      setN(Math.round(p.valor * (1 - Math.pow(1 - k, 4))))
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [activa, t]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return <>{t}</>
  const num = p.miles ? n.toLocaleString('es-ES').replace(/\s/g, '.') : String(n)
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.antes}{num}{p.despues}</span>
}
