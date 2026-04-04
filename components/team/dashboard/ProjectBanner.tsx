'use client'

import { useState, useEffect, useRef } from 'react'

interface BannerImage {
  url: string
  nombre: string
}

interface Props {
  images: BannerImage[]
  nombre: string
  roleLabel: string
}

export default function ProjectBanner({ images, nombre, roleLabel }: Props) {
  const [current, setCurrent] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedule = (length: number) => {
    const delay = Math.random() * 4000 + 3000 // 3–7 s random
    timeoutRef.current = setTimeout(() => {
      setCurrent(c => {
        const next = (c + 1) % length
        setPrev(c)
        return next
      })
      schedule(length)
    }, delay)
  }

  useEffect(() => {
    if (images.length <= 1) return
    schedule(images.length)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length])

  return (
    <div className="relative w-full h-[calc(31vh+20px)] min-h-[200px] overflow-hidden bg-ink/10">
      {/* Stacked images — current on top, prev fading out */}
      {images.map((img, i) => (
        <div
          key={img.url + i}
          className="absolute inset-0 transition-opacity duration-[1400ms] ease-in-out"
          style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 2 : i === prev ? 1 : 0 }}
        >
          <img
            src={img.url}
            alt={img.nombre}
            className="w-full h-full object-cover"
          />
        </div>
      ))}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/75 z-10" />

      {/* Greeting */}
      <div className="absolute bottom-0 left-0 right-0 px-8 pb-[15px] lg:px-14 lg:pb-[23px] z-20">
        <p className="text-[10px] tracking-widest uppercase font-medium text-white/70 mb-2">
          {roleLabel}
        </p>
        <h1 className="text-4xl lg:text-5xl font-light text-white tracking-tight leading-none drop-shadow-sm">
          Hola, {nombre}.
        </h1>
      </div>

      {/* Slide indicator dots */}
      {images.length > 1 && (
        <div className="absolute bottom-4 right-8 lg:right-14 z-20 flex gap-1.5">
          {images.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === current ? 'bg-white w-5' : 'bg-white/40 w-1'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
