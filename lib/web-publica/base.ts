// Dónde vive el sitio público.
//
// Vive en un módulo SIN 'use client' a propósito. Estaba en SiteProvider, que sí
// lo es, y eso lo dejaba fuera del alcance de los Server Components: Next sustituye
// los módulos de cliente por referencias cuando los importa el servidor, así que
// leer la constante desde una página habría devuelto una referencia y no la ruta.
// SiteProvider la reexporta, así que ningún import existente cambia.

/**
 * Prefijo del sitio público. Vacío desde el go-live: la web vive en la raíz.
 *
 * Se conserva la constante —en vez de borrarla y dejar las rutas a pelo— porque
 * es lo que permitió mover el sitio entero de /preview a / cambiando una línea,
 * y lo que permitiría volver a montarlo bajo un prefijo (un idioma, un rediseño
 * en paralelo) sin perseguir cada enlace por el código.
 */
export const SITE_BASE = ''

/** Una ruta del sitio, con su base. `/` no duplica la barra. */
export const href = (path: string) => `${SITE_BASE}${path === '/' ? '' : path}` || '/'

/**
 * El origen público del sitio: lo usan robots.txt, el sitemap y el `metadataBase`
 * del layout raíz, que es de donde salen las URLs absolutas de OpenGraph.
 *
 * Constante y NO `NEXT_PUBLIC_SITE_URL`. Esa variable existe, pero es el origen de
 * la APLICACIÓN INTERNA —con ella se arman los enlaces del portal de obra, las
 * vueltas de DocuSign y los correos— y en producción vale internal.formaprima.es.
 * Leerla aquí salía caro y en silencio: el primer sitemap generado anunciaba
 * `https://internal.formaprima.es/sitemap.xml`, o sea, invitaba a Google al panel
 * del estudio. En local habría sido peor todavía: localhost:3000.
 *
 * Sin www, que es como el sitio se ha nombrado siempre a sí mismo. El www sirve lo
 * mismo y de momento se queda así; el día que se decida un canónico, se cambia
 * aquí y le siguen el sitemap, el robots y las etiquetas sociales.
 */
export const SITE_URL = 'https://formaprima.es'
