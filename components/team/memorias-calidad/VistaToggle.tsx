'use client'

import { useEffect, useState } from 'react'
import { VISTA_STORAGE_KEY, type VistaModo } from '@/lib/memorias/domain'

/**
 * Toggle tarjetas / listado desplegable. La preferencia se recuerda entre
 * pantallas y sesiones (localStorage), porque cada uno trabaja de una manera.
 */
export function useVistaModo(inicial: VistaModo = 'cards') {
  const [vista, setVista] = useState<VistaModo>(inicial)

  useEffect(() => {
    const guardada = window.localStorage.getItem(VISTA_STORAGE_KEY)
    if (guardada === 'cards' || guardada === 'lista') setVista(guardada)
  }, [])

  const cambiar = (modo: VistaModo) => {
    setVista(modo)
    try {
      window.localStorage.setItem(VISTA_STORAGE_KEY, modo)
    } catch {
      // modo privado / storage lleno: la preferencia se pierde, no pasa nada
    }
  }

  return [vista, cambiar] as const
}

const OPCIONES: { value: VistaModo; label: string; icono: string }[] = [
  { value: 'cards', label: 'Tarjetas', icono: '▦' },
  { value: 'lista', label: 'Listado',  icono: '☰' },
]

export default function VistaToggle({
  vista,
  onChange,
}: {
  vista: VistaModo
  onChange: (modo: VistaModo) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 2, background: '#fff', padding: 3, borderRadius: 6, border: '1px solid #E8E6E0', flexShrink: 0 }}>
      {OPCIONES.map(o => {
        const activa = vista === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            title={`Ver como ${o.label.toLowerCase()}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 11px', fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
              border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
              background: activa ? '#1A1A1A' : 'transparent',
              color: activa ? '#fff' : '#777',
            }}
          >
            <span style={{ fontSize: 12, lineHeight: 1 }}>{o.icono}</span>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
