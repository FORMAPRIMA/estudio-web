// Propuestas de honorarios publicadas como página web: formaprima.es/propuesta/<slug>.
//
// Dos tipos de propuesta, según cómo se diseñó en Claude Design:
//   · 'deck' — diapositivas (versión desktop + versión mobile) importadas con
//     scripts/propuestas/importar.mjs y reproducidas con nuestro visor.
//   · 'dc'   — un dossier interactivo (botones, selectores, vídeo, maquetas 3D)
//     importado con scripts/propuestas/importar-dc.mjs y servido con su propio
//     runtime dentro de un iframe (ver app/propuesta/[slug]/deck/route.ts).
//   · 'teaser' — una página propia en React (components/propuesta/teaser/), no
//     un diseño importado: lleva una maqueta 3D real y su final pide una reunión,
//     no aceptar. Sus recursos 3D viven en public/propuesta/<slug>/maqueta/ y el
//     middleware solo los sirve con la cookie del PIN.
//   · 'presentacion3d' — presentación horizontal propia en React (Isla Creta,
//     components/propuesta/isla-creta/) cuyo escenario es la maqueta 3D real;
//     mismos recursos protegidos que el teaser.
// Las cifras viven en el propio diseño: cada proyecto tiene las suyas.
//
// El slug lleva un sufijo aleatorio para que la URL no se adivine a partir del
// nombre del proyecto. Aun así, la propuesta pide PIN.
//
// Solo servidor: aquí están los PIN. No importar desde un componente de cliente.

export interface PropuestaWeb {
  slug: string
  tipo: 'deck' | 'dc' | 'teaser' | 'presentacion3d'
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
  /** PIN del estudio: abre la propuesta sin generar avisos ni correos. */
  pinAdmin?: string
  /** Correos a los que avisar en cada visita del cliente (con su historial). */
  avisarA?: string[]
  /** Fondo de la pantalla del PIN. */
  portada: string
  /** Vista previa al compartir el enlace (1200×630, la genera el importador). */
  og: string
  descripcion: string
  /** Textos de la pantalla del PIN; por defecto, el saludo al cliente. */
  pantallaPin?: { antetitulo: string; titulo: string; texto: string }
  /**
   * Solo 'dc': proporción del lienzo del diseño. 'vertical' (por defecto) =
   * 1080×1920, historia para móvil; 'horizontal' = 1920×1080, presentación.
   */
  formato?: 'vertical' | 'horizontal'
  /** Logo del cliente junto al de Forma Prima en la pantalla del PIN (versión para fondo oscuro). */
  logoSocio?: string
  /** Paleta de la pantalla del PIN y del marco; por defecto, la oscura de Forma Prima. */
  tema?: { fondo: string; tinta: string; acento: string; claro: boolean }
  /**
   * Solo 'dc': el dossier tiene una versión anterior accesible. Al entrar se
   * muestra una vez un aviso de "propuesta actualizada" y un conmutador siempre
   * visible alterna entre la actual y la anterior. La versión anterior vive en
   * `decks/<slug>-anterior.ts` + `public/propuestas/<slug>-anterior/`, se sirve
   * con `/propuesta/<slug>/deck?rev=anterior` y comparte PIN y cookie con la actual.
   */
  versionAnterior?: { etiquetaActual: string; etiquetaAnterior: string }
  /**
   * Solo 'dc' horizontal: tiene versión móvil (página de scroll) para teléfonos,
   * en `decks/<slug>-movil.ts` + `public/propuestas/<slug>-movil/`, servida con
   * `/propuesta/<slug>/deck?movil=1` (importar-dc.mjs --movil <slug>).
   */
  versionMovil?: boolean
  /**
   * Solo 'dc' horizontal con audiencia 'cliente': qué pide el final. 'aceptar'
   * (por defecto) = aceptar la propuesta; 'reunion' = presentación del estudio
   * sin cifras del proyecto, que pide la primera reunión.
   */
  final?: 'aceptar' | 'reunion'
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
    portada: '/propuestas/casa-zurbano-xzw9e/assets/cz-cover-end.webp',
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
  {
    slug: 'torre-del-mangle-zxu7z',
    tipo: 'dc',
    formato: 'horizontal',
    audiencia: 'cliente',
    nombreCliente: 'Javier',
    cliente: 'Javier Ponce · PONCE3',
    proyecto: 'Torre del Mangle',
    pin: '3333',
    pinAdmin: '0000',
    avisarA: ['jlorag@formaprima.es'],
    portada: '/propuestas/torre-del-mangle-zxu7z/assets/manglar-cover.webp',
    og: '/propuestas/torre-del-mangle-zxu7z/og.jpg',
    descripcion: 'Edificio multifamiliar · 8 niveles · Vía a la Costa, Guayaquil, Ecuador',
    versionAnterior: { etiquetaActual: 'Propuesta actualizada', etiquetaAnterior: 'Versión anterior' },
    activa: true,
    publicada: '2026-10-02',
  },
  {
    // Teaser para conseguir la reunión: maqueta en modo muestra (solo la manzana
    // 1), casa club y casas tipo sin cifras. Los honorarios van en la reunión.
    // Es una SALA (sala_salas, acceso_anonimo = false): sin PIN común ni del
    // estudio; cada persona de RSA entra con su PIN personal de 6 cifras, creado
    // en salas.formaprima.es, y los avisos los manda Salas.
    slug: 'isla-creta-uk38g',
    tipo: 'teaser',
    audiencia: 'cliente',
    nombreCliente: 'Grupo RSA',
    cliente: 'Grupo inmobiliario RSA',
    proyecto: 'Isla Creta',
    pin: null,
    portada: '/propuestas/isla-creta-uk38g/portada.webp',
    og: '/propuestas/isla-creta-uk38g/og.jpg?v=2',
    descripcion: 'Maqueta digital comercial, casa club y casas tipo · Samborondón, Ecuador',
    logoSocio: '/propuestas/isla-creta-uk38g/logo-rsa-claro.png',
    pantallaPin: {
      antetitulo: 'Isla Creta · Grupo RSA',
      titulo: 'Isla Creta, en 3D.',
      texto: 'Una vista previa de lo que proponemos para el equipo inmobiliario de Grupo RSA. Introduzca su código personal de 6 cifras, que figura en nuestro correo.',
    },
    activa: true,
    publicada: '2026-10-06',
  },
  {
    // La propuesta de honorarios que sigue al teaser (reunión del 15 oct 2026):
    // presentación en directo cuyo escenario es la maqueta 3D. La interacción
    // sigue limitada a la manzana 1, con estados y precios de ejemplo. Sala
    // cerrada, como el teaser: PIN personal de 6 cifras por persona de RSA.
    slug: 'isla-creta-propuesta-jnpho',
    tipo: 'presentacion3d',
    audiencia: 'cliente',
    nombreCliente: 'Grupo RSA',
    cliente: 'Grupo inmobiliario RSA',
    proyecto: 'Isla Creta',
    pin: null,
    // PIN del estudio (6 cifras, como los de la sala): para presentarla en directo
    // sin generar avisos ni medirse como visita de RSA.
    pinAdmin: '880336',
    portada: '/propuestas/isla-creta-propuesta-jnpho/portada.webp',
    og: '/propuestas/isla-creta-propuesta-jnpho/og.jpg',
    descripcion: 'Maqueta digital comercial, casas tipo y casa club · Samborondón, Ecuador',
    logoSocio: '/propuestas/isla-creta-propuesta-jnpho/logo-rsa-claro.png',
    pantallaPin: {
      antetitulo: 'Isla Creta · Grupo RSA',
      titulo: 'Propuesta de honorarios',
      texto: 'Maqueta digital comercial, casas tipo y casa club para Grupo RSA. Introduzca su código personal de 6 cifras.',
    },
    activa: true,
    publicada: '2026-10-15',
  },
  {
    // Sala cerrada (sala_salas, acceso_anonimo = false), como Isla Creta: sin PIN
    // común ni del estudio; cada persona entra con su PIN personal de 6 cifras,
    // creado en salas.formaprima.es, y los avisos los manda Salas.
    slug: 'ne56-miami-5jjoy',
    tipo: 'dc',
    formato: 'horizontal',
    audiencia: 'cliente',
    nombreCliente: '', // sin nombre: el final dice solo "¿Empezamos?"
    cliente: '223–231 NE 56th Street · Miami',
    proyecto: '223–231 NE 56th Street',
    pin: null,
    portada: '/propuestas/ne56-miami-5jjoy/assets/ne56-aerea.webp',
    og: '/propuestas/ne56-miami-5jjoy/og.jpg',
    descripcion: '6 townhouses de obra nueva · 3 edificios dúplex · Miami, FL',
    versionMovil: true,
    // 2026-10-14: v2 — fase 02 pasa a «Sistemas de ejecución» (el AoR redacta y firma el
    // proyecto de ejecución), sin tarifa por SF: 38.180 + 65.320 = USD 103.500.
    versionAnterior: { etiquetaActual: 'Propuesta actualizada', etiquetaAnterior: 'Versión anterior' },
    pantallaPin: {
      antetitulo: 'Propuesta de honorarios',
      titulo: '223–231 NE 56th Street',
      texto: 'Seis townhouses en Miami. Introduce tu código personal de 6 cifras para ver la propuesta.',
    },
    activa: true,
    publicada: '2026-10-13',
  },
  {
    // Sala cerrada, como NE 56th Street: PIN personal de 6 cifras por persona.
    slug: 'palmetto-sw77-xkp5c',
    tipo: 'dc',
    formato: 'horizontal',
    audiencia: 'cliente',
    nombreCliente: '', // sin nombre: el final dice solo "¿Empezamos?"
    cliente: '14321 SW 77th Ave · Palmetto Bay',
    proyecto: '14321 SW 77th Ave',
    pin: null,
    portada: '/propuestas/palmetto-sw77-xkp5c/assets/sw77-aerea.webp',
    og: '/propuestas/palmetto-sw77-xkp5c/og.jpg',
    descripcion: 'Remodelación integral de vivienda unifamiliar · 2.192 sq ft · Palmetto Bay, FL',
    versionMovil: true,
    // 2026-10-14: segundo proyecto del ciclo (el nº 1 es 10820) → tramo 02, USD 9.488.
    versionAnterior: { etiquetaActual: 'Propuesta actualizada', etiquetaAnterior: 'Versión anterior' },
    pantallaPin: {
      antetitulo: 'Propuesta de honorarios',
      titulo: '14321 SW 77th Ave',
      texto: 'Una casa en Palmetto Bay. Introduce tu código personal de 6 cifras para ver la propuesta.',
    },
    activa: true,
    publicada: '2026-10-13',
  },
  {
    // Presentación del estudio (sin cifras del proyecto) para una pareja que valora
    // a Forma Prima para su chalet de obra nueva. Sala con PIN común
    // (acceso_anonimo = true, como Torre del Mangle): sus visitas se miden como
    // anónimas. El final pide la primera reunión, no aceptar.
    slug: 'arturo-soria-bl6at',
    tipo: 'dc',
    formato: 'horizontal',
    audiencia: 'cliente',
    final: 'reunion',
    versionMovil: true,
    nombreCliente: 'Alejandra y Damián',
    cliente: 'Alejandra y Damián · Arturo Soria',
    proyecto: 'Chalet en Arturo Soria',
    pin: '6889',
    pinAdmin: '163759',
    avisarA: ['jlorag@formaprima.es'],
    portada: '/propuestas/arturo-soria-bl6at/assets/cc38-3919-portada.webp',
    og: '/propuestas/arturo-soria-bl6at/og.jpg',
    descripcion: 'Forma Prima · estudio, método de trabajo y honorarios · Vivienda unifamiliar de obra nueva, Madrid',
    pantallaPin: {
      antetitulo: 'Forma Prima · Arquitectura e interiorismo',
      titulo: 'Alejandra y Damián',
      texto: 'Os presentamos el estudio, cómo trabajamos y cómo calculamos los honorarios. Introducid el PIN que os hemos facilitado.',
    },
    activa: true,
    publicada: '2026-10-16',
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
