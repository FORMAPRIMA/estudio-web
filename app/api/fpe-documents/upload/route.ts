import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET  = 'fpe-documents'
const MAX_MB  = 50
const MAX_BYTES = MAX_MB * 1024 * 1024

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión activa.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) {
    return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
  }

  const admin = createAdminClient()
  const contentType = req.headers.get('content-type') ?? ''

  // ── Mode A: JSON — file already uploaded directly, just register in DB ────
  // Called after a successful direct upload via signed URL.
  if (contentType.includes('application/json')) {
    const { project_id, storage_path, filename, mime_type, size_bytes, chapter_id, project_unit_id, discipline_tags: tagsIn } = await req.json()

    if (!project_id || !storage_path || !filename)
      return NextResponse.json({ error: 'project_id, storage_path y filename requeridos.' }, { status: 400 })

    const { data: doc, error: dbErr } = await admin
      .from('fpe_documents')
      .insert({
        project_id,
        project_unit_id: project_unit_id || null,
        chapter_id: chapter_id || null,
        nombre: filename,
        storage_path,
        mime_type: mime_type || null,
        size_bytes: size_bytes || null,
        discipline_tags: tagsIn ?? [],
        uploaded_by: user.id,
      })
      .select('id, project_id, project_unit_id, chapter_id, nombre, storage_path, mime_type, size_bytes, discipline_tags, uploaded_by, created_at')
      .single()

    if (dbErr) {
      // If DB insert fails, clean up the orphaned storage object
      await admin.storage.from(BUCKET).remove([storage_path])
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ doc })
  }

  // ── Mode B: multipart/form-data — legacy fallback (file through server) ───
  const form = await req.formData()
  const file            = form.get('file') as File | null
  const project_id      = form.get('project_id') as string | null
  const project_unit_id = form.get('project_unit_id') as string | null
  const chapter_id      = form.get('chapter_id') as string | null
  const tagsRaw         = form.get('discipline_tags') as string | null

  if (!file || file.size === 0)  return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })
  if (!project_id)               return NextResponse.json({ error: 'project_id requerido.' }, { status: 400 })
  if (file.size > MAX_BYTES)     return NextResponse.json({ error: `El archivo no puede superar ${MAX_MB} MB.` }, { status: 400 })

  const discipline_tags: string[] = (() => {
    try { return JSON.parse(tagsRaw ?? '[]') } catch { return [] }
  })()

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const subPath = project_unit_id
    ? `${project_id}/units/${project_unit_id}/${Date.now()}_${safeName}`
    : chapter_id
      ? `${project_id}/chapters/${chapter_id}/${Date.now()}_${safeName}`
      : `${project_id}/general/${Date.now()}_${safeName}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { data: stored, error: storErr } = await admin.storage
    .from(BUCKET)
    .upload(subPath, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (storErr) return NextResponse.json({ error: storErr.message }, { status: 500 })

  const { data: doc, error: dbErr } = await admin
    .from('fpe_documents')
    .insert({
      project_id,
      project_unit_id: project_unit_id || null,
      chapter_id: chapter_id || null,
      nombre: file.name,
      storage_path: stored.path,
      mime_type: file.type || null,
      size_bytes: file.size,
      discipline_tags,
      uploaded_by: user.id,
    })
    .select('id, project_id, project_unit_id, chapter_id, nombre, storage_path, mime_type, size_bytes, discipline_tags, uploaded_by, created_at')
    .single()

  if (dbErr) {
    await admin.storage.from(BUCKET).remove([stored.path])
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ doc })
}
