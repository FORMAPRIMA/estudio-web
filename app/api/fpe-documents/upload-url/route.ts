import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET  = 'fpe-documents'
const MAX_MB  = 50
const MAX_BYTES = MAX_MB * 1024 * 1024

// Returns a signed upload URL so the browser can upload directly to
// Supabase Storage, bypassing the Next.js/Vercel function for the file bytes.
// Flow: browser → GET url → PUT file to Storage → POST /upload (register)

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión activa.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) {
    return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
  }

  const { project_id, filename, chapter_id, project_unit_id, size_bytes } = await req.json()

  if (!project_id) return NextResponse.json({ error: 'project_id requerido.' }, { status: 400 })
  if (!filename)   return NextResponse.json({ error: 'filename requerido.' }, { status: 400 })
  if (size_bytes && size_bytes > MAX_BYTES)
    return NextResponse.json({ error: `El archivo no puede superar ${MAX_MB} MB.` }, { status: 400 })

  // Build storage path (same logic as /upload)
  const safeName = (filename as string).replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = project_unit_id
    ? `${project_id}/units/${project_unit_id}/${Date.now()}_${safeName}`
    : chapter_id
      ? `${project_id}/chapters/${chapter_id}/${Date.now()}_${safeName}`
      : `${project_id}/general/${Date.now()}_${safeName}`

  // Generate signed upload URL (admin client can access private buckets)
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'No se pudo generar URL.' }, { status: 500 })
  }

  return NextResponse.json({ signed_url: data.signedUrl, storage_path: storagePath })
}
