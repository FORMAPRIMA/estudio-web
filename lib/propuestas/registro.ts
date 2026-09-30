// Propuestas de honorarios publicadas como página web: formaprima.es/propuesta/<slug>.
//
// Dos tipos de propuesta, según cómo se diseñó en Claude Design:
//   · 'deck' — diapositivas (versión desktop + versión mobile) importadas con
//     scripts/propuestas/importar.mjs y reproducidas con nuestro visor.
//   · 'dc'   — un dossier interactivo (botones, selectores, vídeo, maquetas 3D)
//     importado con scripts/propuestas/importar-dc.mjs y servido con su propio
//     runtime dentro de un iframe (ver app/propuesta/[slug]/deck/route.ts).
// Las cifras viven en el propio diseño: cada proyecto tiene las suyas.
//
// El slug lleva un sufijo aleatorio para que la URL no se adivine a partir del
// nombre del proyecto. Aun así, la propuesta pide PIN.
//
// Solo servidor: aquí están los PIN. No importar desde un componente de cliente.

export interface PropuestaWeb {
  slug: string
  tipo: 'deck' | 'dc'
  /**
   * A quién va: 'cliente' = una persona concreta (se la saluda por su nombre y
   * el final pide ACEPTAR); 'comprador' = un dossier que puede circular entre
   * compradores (el final pide sus datos y crea un lead en Captación).
   */
  audiencia: 'cliente' | 'comprador'
  /** Nombre con el que se saluda y se firma el aviso ("Francisco"). */
  nombreCliente: string
  /** Nombre completo, para los avisos y el correo al equipo. */
  cliente: string
  /** Nombre del proyecto tal como aparece en la portada. */
  proyecto: string
  /** null = sin PIN: cualquiera con el enlace la abre (dossiers que circulan). */
  pin: string | null
  /** Fondo de la pantalla del PIN. */
  portada: string
  /** Vista previa al compartir el enlace (1200×630, la genera el importador). */
  og: string
  descripcion: string
  /** Textos de la pantalla del PIN; por defecto, el saludo al cliente. */
  pantallaPin?: { antetitulo: string; titulo: string; texto: string }
  /** Paleta de la pantalla del PIN y del marco; por defecto, la oscura de Forma Prima. */
  tema?: { fondo: string; tinta: string; acento: string; claro: boolean }
  /** false = la URL responde "no disponible" (propuesta retirada). */
  activa: boolean
  publicada: string
}

export const PROPUESTAS: PropuestaWeb[] = [
  {
    slug: 'ciudad-celeste-o7flw',
    tipo: 'deck',
    audiencia: 'cliente',
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
  {
    slug: 'casa-zurbano-xzw9e',
    tipo: 'dc',
    audiencia: 'comprador',
    nombreCliente: 'Casa Zurbano',
    cliente: 'Comprador · dossier Casa Zurbano',
    proyecto: 'Casa Zurbano',
    pin: null,
    portada: '/propuestas/casa-zurbano-xzw9e/assets/cz-cover-end.jpg',
    og: '/propuestas/casa-zurbano-xzw9e/og.jpg?v=2',
    descripcion: 'Zurbano 6, 3º izq. · 199 m² · Madrid. Cómo puede ser, cuánto cuesta reformarlo y cuánto tarda.',
    pantallaPin: {
      antetitulo: 'Dossier · Zurbano 6',
      titulo: 'Casa Zurbano',
      texto: 'Un lienzo con memoria. Introduce el PIN que te hemos facilitado para ver el dossier.',
    },
    tema: { fondo: '#f6f1ea', tinta: '#2b2622', acento: '#8c6a55', claro: true },
    activa: true,
    publicada: '2026-09-30',
  },
]

export function getPropuestaWeb(slug: string): PropuestaWeb | null {
  return PROPUESTAS.find((p) => p.slug === slug && p.activa) ?? null
}

/** Documento completo de un dossier interactivo ('dc'). */
export async function cargarDossier(slug: string): Promise<string | null> {
  try {
    const m = await import(`./decks/${slug}`)
    return typeof m.html === 'string' ? m.html : null
  } catch {
    return null
  }
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
