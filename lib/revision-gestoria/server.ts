// Conciliación trimestral para la gestoría — SOLO `fp_partner`.
//
// La app (HTML autocontenido generado fuera del repo por _scripts/concilia.py) vive en el
// bucket PRIVADO `conciliacion`, una carpeta por trimestre:
//   <trimestre>/app.html       la app con los datos ya inyectados
//   <trimestre>/manifest.json  ruta del paquete local → objeto en files/ (deduplicado por hash)
//   <trimestre>/files/*        facturas, tickets y PDFs
//   <trimestre>/estado.json    marcas y notas de la revisión (compartidas entre los socios)
// Nada de esto va en el repo: son datos financieros reales.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const CONCILIACION_BUCKET = 'conciliacion'

/** Trimestre por defecto que abre /team/apps/revision-gestoria. */
export const TRIMESTRE_ACTUAL = 'q3-2026'

export function trimestreValido(t: string) {
  return /^q[1-4]-20\d\d$/.test(t)
}

/** Devuelve el usuario partner, o la respuesta de error que hay que devolver. */
export async function requirePartnerApi(): Promise<
  { ok: true; userId: string; nombre: string } | { ok: false; res: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Sin sesión' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('rol, nombre').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') {
    return { ok: false, res: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id, nombre: profile.nombre || user.email || '' }
}

export async function leerJson<T>(path: string): Promise<T | null> {
  const { data, error } = await createAdminClient().storage.from(CONCILIACION_BUCKET).download(path)
  if (error || !data) return null
  return JSON.parse(await data.text()) as T
}
