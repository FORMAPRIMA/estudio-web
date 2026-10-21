'use client'

// Deja en este navegador la marca de «visita del equipo» de un enlace /para/<token>
// (ver firmaEquipo en lib/salas/prospeccion.ts) y limpia la URL, para que si se
// copia desde la barra no viaje la firma.

import { useEffect } from 'react'

export default function MarcaEquipo({ nombre, valor }: { nombre: string; valor: string }) {
  useEffect(() => {
    document.cookie = `${nombre}=${valor}; path=/; max-age=${365 * 24 * 3600}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
    const u = new URL(location.href)
    u.searchParams.delete('equipo')
    history.replaceState(null, '', u.pathname + u.search + u.hash)
  }, [nombre, valor])
  return null
}
