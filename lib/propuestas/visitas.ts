import { createAdminClient } from '@/lib/supabase/admin'

// Historial de visitas de una propuesta (para saber cómo de caliente está el
// lead): un JSON por propuesta en un bucket PRIVADO de Storage, sin tabla nueva.
// Solo lo escribe el servidor (service_role); el cliente nunca lo lee.

const BUCKET = 'propuestas-web'

export interface Visita {
  id: string
  inicio: string
  ultima: string
  dispositivo: string
  lugar: string | null
  /** Diapositiva más lejana vista (1 = portada) y total, con su etiqueta. */
  max: number
  total: number
  etiqueta: string
  final: boolean
}

const ruta = (slug: string) => `visitas/${slug}.json`

export async function leerVisitas(slug: string): Promise<Visita[]> {
  try {
    const { data, error } = await createAdminClient().storage.from(BUCKET).download(ruta(slug))
    if (error || !data) return []
    const v = JSON.parse(await data.text())
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export async function guardarVisitas(slug: string, visitas: Visita[]): Promise<void> {
  const admin = createAdminClient()
  const cuerpo = new Blob([JSON.stringify(visitas.slice(-200))], { type: 'application/json' })
  let { error } = await admin.storage.from(BUCKET).upload(ruta(slug), cuerpo, { upsert: true, contentType: 'application/json' })
  if (error && /not found|bucket/i.test(error.message)) {
    await admin.storage.createBucket(BUCKET, { public: false })
    ;({ error } = await admin.storage.from(BUCKET).upload(ruta(slug), cuerpo, { upsert: true, contentType: 'application/json' }))
  }
  if (error) console.error('[propuesta-web] guardarVisitas', error.message)
}

/** "iPhone · Safari", "Mac · Chrome"… a partir del user-agent. */
export function dispositivo(ua: string): string {
  const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android' : 'Tablet Android')
    : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Otro'
  const nav = /CriOS|Chrome\//.test(ua) && !/Edg\//.test(ua) ? 'Chrome' : /Edg\//.test(ua) ? 'Edge' : /FxiOS|Firefox\//.test(ua) ? 'Firefox'
    : /WhatsApp/.test(ua) ? 'WhatsApp' : /Instagram|FBAN|FBAV/.test(ua) ? 'app' : /Safari\//.test(ua) ? 'Safari' : ''
  return nav ? `${so} · ${nav}` : so
}

/** Ciudad y país que da Vercel por la IP (aproximado). */
export function lugar(h: Headers): string | null {
  const ciudad = h.get('x-vercel-ip-city')
  const pais = h.get('x-vercel-ip-country')
  const c = ciudad ? decodeURIComponent(ciudad) : ''
  return c || pais ? [c, pais].filter(Boolean).join(', ') : null
}
