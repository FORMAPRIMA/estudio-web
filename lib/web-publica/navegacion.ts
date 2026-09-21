// Las secciones del sitio público: una sola lista.
//
// Estaba escrita dos veces, en SiteNav y en SiteFooter, y ninguna de las dos
// sabía de la otra. Ahora vive aquí, y de aquí beben también el sitemap y el
// robots.txt — que es lo que hace que ocultar una sección sea UN interruptor y no
// cuatro ficheros que alguien tiene que acordarse de tocar a la vez.

export interface Tab {
  path: string
  es:   string
  en:   string
  /**
   * Existe pero no se anuncia.
   *
   * La página sigue respondiendo con su URL —para poder ir viéndola mientras se
   * construye— pero desaparece del menú, del pie y del sitemap, y se le pide al
   * rastreador que no entre. No es un candado: quien tenga el enlace, pasa. Es
   * dejar de invitar.
   */
  oculta?: boolean
}

export const TABS: Tab[] = [
  { path: '/estudio',     es: 'Estudio',     en: 'Studio' },
  { path: '/proyectos',   es: 'Proyectos',   en: 'Projects' },
  { path: '/mapa',        es: 'Mapa',        en: 'Map' },
  // En construcción: FP Tools está a la espera de sus vídeos, y Real Estate no
  // tiene ninguna propiedad activa —se publicaría vacía—. Se quitan de `oculta`
  // el día que tengan contenido, y vuelven solas al menú, al pie y al sitemap.
  { path: '/fp-tools',    es: 'FP Tools',    en: 'FP Tools',    oculta: true },
  { path: '/real-estate', es: 'Real Estate', en: 'Real Estate', oculta: true },
  { path: '/contacto',    es: 'Contacto',    en: 'Contact' },
]

/** Las que se anuncian: menú y pie. */
export const TABS_VISIBLES = TABS.filter((t) => !t.oculta)

/** Las que no: fuera del sitemap y con Disallow en robots.txt. */
export const RUTAS_OCULTAS = TABS.filter((t) => t.oculta).map((t) => t.path)
