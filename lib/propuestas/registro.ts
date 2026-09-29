// Propuestas de honorarios publicadas como página web: formaprima.es/propuesta/<slug>.
//
// Cada propuesta es un diseño de Claude Design (versión desktop + versión mobile)
// importado con scripts/propuestas/importar.mjs, más una entrada aquí. Las cifras
// viven en el propio diseño: cada proyecto tiene las suyas.
//
// El slug lleva un sufijo aleatorio para que la URL no se adivine a partir del
// nombre del proyecto. Aun así, la propuesta pide PIN.
//
// Solo servidor: aquí están los PIN. No importar desde un componente de cliente.

export interface PropuestaWeb {
  slug: string
  /** Nombre con el que se saluda y se firma el aviso ("Francisco"). */
  nombreCliente: string
  /** Nombre completo, para los avisos y el correo al equipo. */
  cliente: string
  /** Nombre del proyecto tal como aparece en la portada. */
  proyecto: string
  pin: string
  /** Fondo de la pantalla del PIN. */
  portada: string
  /** Vista previa al compartir el enlace (1200×630, la genera el importador). */
  og: string
  descripcion: string
  /** false = la URL responde "no disponible" (propuesta retirada). */
  activa: boolean
  publicada: string
}

export const PROPUESTAS: PropuestaWeb[] = [
  {
    slug: 'ciudad-celeste-o7flw',
    nombreCliente: 'Francisco',
    cliente: 'Francisco Rites',
    proyecto: 'Ciudad Celeste',
    pin: '8888',
    portada: '/propuestas/ciudad-celeste-o7flw/cc-portada.jpg',
    og: '/propuestas/ciudad-celeste-o7flw/og.jpg',
    descripcion: 'Reforma de primera planta · 120 m² + 30 m² de terraza · Ciudad Celeste, Ecuador',
    activa: true,
    publicada: '2026-09-29',
  },
]

export function getPropuestaWeb(slug: string): PropuestaWeb | null {
  return PROPUESTAS.find((p) => p.slug === slug && p.activa) ?? null
}

export interface DeckPropuesta {
  desktop: string
  mobile: string
}

export async function cargarDeck(slug: string): Promise<DeckPropuesta | null> {
  try {
    const m = await import(`./decks/${slug}`)
    return { desktop: m.desktop, mobile: m.mobile }
  } catch {
    return null
  }
}
