import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/web-publica/base'
import { RUTAS_OCULTAS } from '@/lib/web-publica/navegacion'

/**
 * robots.txt.
 *
 * Hasta el go-live no hacía falta: no había nada público que rastrear. Ahora sí,
 * y lo que importa no es tanto abrir la web como CERRAR lo que nunca debió salir
 * en una búsqueda — la aplicación interna del estudio vive en el mismo despliegue
 * que el sitio, en las mismas rutas del mismo dominio.
 *
 * Esto NO es seguridad: un `Disallow` es una petición que un rastreador honesto
 * respeta, no un candado. Lo que protege /team y /area-privada sigue siendo el
 * middleware, y lo que protege el portal de cliente sigue siendo su token. Esto
 * solo evita que esas URLs acaben apareciendo en Google.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/login',
        '/team',          // aplicación interna
        '/area-privada',  // área de cliente
        '/portal',        // portal de obra
        '/espacio',       // espacios de cliente, con token en la URL
        '/propuesta',     // propuestas de honorarios, con PIN
        '/cc38',          // invitaciones personales al Open House
        '/execution-portal',
        '/gestor',
        // Páginas privadas que viven en este mismo despliegue y no son del sitio.
        '/quiniela',
        '/repasos',
        '/cumple-macarena',
        // Secciones del sitio todavía en construcción. Siguen respondiendo por
        // URL directa —se están montando— pero no se ofrecen al rastreador: una
        // sección a medias indexada es peor que una sección sin indexar.
        ...RUTAS_OCULTAS,
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
