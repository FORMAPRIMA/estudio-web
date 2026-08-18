// Modo Diseño — traduce el estilo guardado de un bloque a CSS.
//
// El bloque guarda PASOS (escala, tracking, peso, alineación); aquí se resuelven
// contra los tokens del sitio. Lo que el bloque no sobrescribe se queda con el
// valor que el diseño original le dio: ajustar nunca parte de cero.

import type { CSSProperties } from 'react'
import { fontSizeEscalado, type BlockEstilo } from '@/lib/web-publica'
import { site } from '../theme'

interface Base {
  fontSize:       string
  letterSpacing?: string
  fontWeight?:    number
}

export function aplicarEstilo(base: Base, est: BlockEstilo): CSSProperties {
  return {
    fontSize:      fontSizeEscalado(base.fontSize, est.escala),
    letterSpacing: est.tracking ? site.track[est.tracking] : base.letterSpacing,
    fontWeight:    est.peso ?? base.fontWeight,
    // Sin valor propio no se escribe la propiedad: así hereda el text-align del
    // contenedor en vez de forzar un 'left' que nadie pidió.
    ...(est.align ? { textAlign: est.align } : {}),
  }
}
