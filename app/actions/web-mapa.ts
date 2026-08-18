'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { MapaPunto } from '@/lib/web-mapa'

const PATH = '/team/marketing/web-publica'
const FP_ROLES = ['fp_partner', 'fp_biz_dev']

async function requireMarketing() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol)) throw new Error('Sin permisos.')
}

const SELECT = 'id, nombre, direccion, lat, lng, anio, proyecto_id, orden, activo'

function mapRow(r: any, slugPorProyecto: Map<string, string>): MapaPunto {
  return {
    id: r.id,
    nombre: r.nombre,
    direccion: r.direccion ?? null,
    lat: typeof r.lat === 'number' ? r.lat : null,
    lng: typeof r.lng === 'number' ? r.lng : null,
    anio: r.anio ?? null,
    proyecto_id: r.proyecto_id ?? null,
    proyecto_slug: (r.proyecto_id && slugPorProyecto.get(r.proyecto_id)) || null,
    orden: r.orden ?? 0,
    activo: r.activo ?? true,
  }
}

/**
 * Slugs de los proyectos publicados, para saber qué puntos pueden enlazar a una
 * ficha. Se resuelve aquí y no con un join anidado de PostgREST: con tablas
 * recién creadas el join puede fallar en silencio hasta que se refresca la caché
 * de claves foráneas (ver CLAUDE.md, sección Supabase).
 */
async function slugsPublicados(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin.from('web_proyectos').select('id, slug').eq('activo', true)
  const m = new Map<string, string>()
  for (const p of data ?? []) if (p.slug) m.set(p.id, p.slug)
  return m
}

/** Lectura pública: solo los activos, en orden. */
export async function getMapaPuntosPublic(): Promise<MapaPunto[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_mapa_puntos').select(SELECT)
    .eq('activo', true).order('orden', { ascending: true })
  // La migración puede no estar aplicada todavía: el sitio no se cae, se queda
  // sin mapa nuevo y el visor cae al plano PNG de siempre.
  if (error) { console.error('[web-mapa] getPublic:', error.message); return [] }
  const slugs = await slugsPublicados(admin)
  return (data ?? []).map((r) => mapRow(r, slugs))
}

/** Lectura del CMS: también los desactivados y los que aún no tienen coordenadas. */
export async function getMapaPuntosAdmin(): Promise<MapaPunto[]> {
  await requireMarketing()
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_mapa_puntos').select(SELECT)
    .order('orden', { ascending: true })
  if (error) { console.error('[web-mapa] getAdmin:', error.message); return [] }
  const slugs = await slugsPublicados(admin)
  return (data ?? []).map((r) => mapRow(r, slugs))
}

export async function createMapaPunto(): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { data: ultimo } = await admin.from('web_mapa_puntos')
      .select('orden').order('orden', { ascending: false }).limit(1).maybeSingle()
    const { error } = await admin.from('web_mapa_puntos')
      .insert({ nombre: 'Nueva obra', orden: (ultimo?.orden ?? 0) + 1 })
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateMapaPunto(id: string, data: {
  nombre?: string
  direccion?: string | null
  lat?: number | null
  lng?: number | null
  anio?: string | null
  proyecto_id?: string | null
  activo?: boolean
}): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const patch: Record<string, unknown> = {}
    if (data.nombre !== undefined) {
      const nombre = data.nombre.trim()
      if (!nombre) return { error: 'El nombre no puede quedar vacío.' }
      patch.nombre = nombre
    }
    if (data.direccion !== undefined) patch.direccion = data.direccion?.trim() || null
    if (data.anio !== undefined)      patch.anio = data.anio?.trim() || null
    if (data.proyecto_id !== undefined) patch.proyecto_id = data.proyecto_id || null
    if (data.activo !== undefined)    patch.activo = data.activo
    // Coordenadas: se aceptan las dos o ninguna. Media coordenada pintaría el
    // punto en el Golfo de Guinea.
    if (data.lat !== undefined || data.lng !== undefined) {
      const lat = data.lat ?? null
      const lng = data.lng ?? null
      if ((lat === null) !== (lng === null)) return { error: 'Hacen falta latitud y longitud, o ninguna de las dos.' }
      if (lat !== null && (Math.abs(lat) > 90 || Math.abs(lng as number) > 180)) return { error: 'Coordenadas fuera de rango.' }
      patch.lat = lat
      patch.lng = lng
    }
    const { error } = await admin.from('web_mapa_puntos').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    revalidatePath('/wip')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteMapaPunto(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const { error } = await admin.from('web_mapa_puntos').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function reorderMapaPuntos(ids: string[]): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    await Promise.all(ids.map((id, i) => admin.from('web_mapa_puntos').update({ orden: i }).eq('id', id)))
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/**
 * Geocodifica una dirección con la API de Mapbox y guarda las coordenadas.
 *
 * Se hace en SERVIDOR aunque el token sea público: así el CMS puede geocodificar
 * en lote sin abrir 27 peticiones desde el navegador, y el resultado se guarda en
 * el mismo viaje.
 *
 * Acierta en torno al 95% con direcciones de calle de Madrid. NO se publica nada
 * sin revisar punto por punto: una chincheta en la calle equivocada es una
 * afirmación falsa sobre dónde ha trabajado el estudio.
 */
export async function geocodificarPunto(id: string): Promise<{ success: true; lat: number; lng: number; encontrado: string } | { error: string }> {
  try {
    await requireMarketing()
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return { error: 'Falta NEXT_PUBLIC_MAPBOX_TOKEN.' }

    const admin = createAdminClient()
    const { data: punto } = await admin.from('web_mapa_puntos').select('direccion, nombre').eq('id', id).maybeSingle()
    const consulta = punto?.direccion?.trim() || punto?.nombre?.trim()
    if (!consulta) return { error: 'El punto no tiene dirección ni nombre.' }

    // `proximity` sesga el resultado hacia el centro de Madrid: sin él, «Serrano
    // 84» puede resolver a una calle Serrano de otra ciudad.
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(consulta)}.json`
      + `?limit=1&language=es&country=es&proximity=-3.6883,40.4189&types=address&access_token=${token}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return { error: `Mapbox respondió ${res.status}.` }
    const json = await res.json()
    const f = json?.features?.[0]
    if (!f?.center) return { error: `Sin resultado para «${consulta}».` }

    const [lng, lat] = f.center as [number, number]
    const { error } = await admin.from('web_mapa_puntos').update({ lat, lng }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true, lat, lng, encontrado: f.place_name ?? consulta }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
