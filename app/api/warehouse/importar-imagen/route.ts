import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPublicUrl, fetchImagen } from '@/lib/memorias/scrape'

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team']
const BUCKET = 'warehouse'

const EXT_POR_TIPO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
}

/**
 * Descarga una imagen remota y la re-sube a nuestro bucket. Nunca guardamos la
 * URL del CDN de la tienda: caducan y romperían las memorias ya emitidas.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const raw = typeof body?.url === 'string' ? body.url : ''
    const prefijo = typeof body?.prefijo === 'string' && /^[a-z-]{1,20}$/.test(body.prefijo)
      ? body.prefijo
      : 'importadas'
    if (!raw.trim()) return NextResponse.json({ error: 'Falta la URL de la imagen.' }, { status: 400 })

    const url = await assertPublicUrl(raw)
    const { bytes, contentType } = await fetchImagen(url)

    const ext = EXT_POR_TIPO[contentType] ?? 'jpg'
    const path = `${prefijo}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`

    const admin = createAdminClient()
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('[warehouse/importar-imagen]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado importando la imagen.' },
      { status: 500 }
    )
  }
}
