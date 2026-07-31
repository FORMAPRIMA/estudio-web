'use client'

import { useEffect, useState } from 'react'
import { MODO_CLIENTE_STORAGE_KEY } from '@/lib/memorias/domain'

/**
 * Modo cliente: para revisiones con el cliente delante. Oculta coste, margen y
 * cualquier rastro del descuento profesional, y el PVP pasa a llamarse "precio".
 *
 * Se recuerda en sessionStorage a propósito: sobrevive a un refresco a mitad de
 * reunión, pero no se queda encendido mañana sin que nadie se dé cuenta.
 */
export function useModoCliente() {
  const [modoCliente, setModoCliente] = useState(false)

  useEffect(() => {
    try {
      setModoCliente(window.sessionStorage.getItem(MODO_CLIENTE_STORAGE_KEY) === '1')
    } catch {
      // sin storage disponible: se queda en modo interno
    }
  }, [])

  const cambiar = (valor: boolean) => {
    setModoCliente(valor)
    try {
      window.sessionStorage.setItem(MODO_CLIENTE_STORAGE_KEY, valor ? '1' : '0')
    } catch {
      // la preferencia se pierde al recargar, nada más
    }
  }

  return [modoCliente, cambiar] as const
}

/** Ojo abierto = ves todo. Ojo cerrado = modo cliente. */
export default function ModoClienteToggle({
  modoCliente,
  onChange,
}: {
  modoCliente: boolean
  onChange: (valor: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!modoCliente)}
      title={
        modoCliente
          ? 'Modo cliente activo: coste y margen ocultos. Pulsa para volver a la vista interna.'
          : 'Ocultar coste y margen para revisar con el cliente'
      }
      aria-pressed={modoCliente}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: modoCliente ? '5px 10px' : '5px 7px',
        fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em',
        border: `1px solid ${modoCliente ? '#F0D89B' : '#EAE8E3'}`,
        borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
        background: modoCliente ? '#FFFBEB' : 'transparent',
        color: modoCliente ? '#B7791F' : '#C4C1BA',
        transition: 'color 0.15s, background 0.15s',
      }}
    >
      {/* Ojo abierto / tachado, en línea para no depender de iconografía externa */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        {modoCliente ? (
          <>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </>
        ) : (
          <>
            <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </svg>
      {modoCliente && 'Modo cliente'}
    </button>
  )
}
