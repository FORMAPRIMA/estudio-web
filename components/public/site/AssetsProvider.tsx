'use client'

// Manifiesto de variantes disponible en todo el árbol del sitio.
//
// Por contexto y no por props: los <img> están repartidos por doce componentes a
// tres y cuatro niveles de profundidad, y encadenar un prop `assets` por todos
// ellos ensuciaría cada firma para nada. El manifiesto completo pesa unos 8 KB
// serializado, así que el layout lo carga una vez y aquí queda para todos.

import { createContext, useContext } from 'react'
import type { Manifiesto, Variantes } from '@/lib/web-publica/imagenes'

const AssetsContext = createContext<Manifiesto>({})

export function AssetsProvider({ manifiesto, children }: { manifiesto: Manifiesto; children: React.ReactNode }) {
  return <AssetsContext.Provider value={manifiesto}>{children}</AssetsContext.Provider>
}

/** Variantes de una URL, o null si no está registrada (se sirve el original). */
export function useVariantes(url: string | null | undefined): Variantes | null {
  const manifiesto = useContext(AssetsContext)
  if (!url) return null
  return manifiesto[url] ?? null
}
