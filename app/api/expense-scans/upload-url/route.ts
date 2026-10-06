import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isFpRole } from '@/lib/types'

const BUCKET = 'expense-scans'
const MAX_MB = 25

// URL de subida firmada para que el navegador suba el ticket directamente a Storage.
// Por /api/expense-scans/upload el archivo pasaba por la función de Vercel, que
// rechaza cualquier petición de más de 4,5 MB (413 FUNCTION_PAYLOAD_TOO_LARGE):
// fotos de móvil y PDFs de varias páginas no llegaban.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !isFpRole(profile.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { filename, size } = await req.json().catch(() => ({})) as { filename?: string; size?: number }
  if (size && size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `El archivo no puede superar ${MAX_MB} MB.` }, { status: 400 })
  }

  const ext = (filename?.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${user.id}/${Date.now()}.${ext}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'No se pudo preparar la subida.' }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ path, token: data.token, publicUrl })
}
