import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'fpe-documents'

// Returns a signed download URL for a document.
// Auth: validated via invitation token — no Supabase session required.
// El doc debe encajar en el scope de la invitación:
//   · general (chapter_id NULL AND project_unit_id NULL) → libre
//   · de capítulo → chapter_id debe estar en los chapters del scope del partner
//   · de unidad   → project_unit_id ∈ scope_unit_ids
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const token        = searchParams.get('token')
  const storage_path = searchParams.get('storage_path')

  if (!token)        return NextResponse.json({ error: 'token requerido.' }, { status: 400 })
  if (!storage_path) return NextResponse.json({ error: 'storage_path requerido.' }, { status: 400 })

  const admin = createAdminClient()

  // Validate token
  const { data: inv } = await admin
    .from('fpe_tender_invitations')
    .select('id, token_expires_at, status, scope_unit_ids, tender:fpe_tenders(project_id, status)')
    .eq('token', token)
    .single()

  if (!inv) return NextResponse.json({ error: 'Invitación no encontrada.' }, { status: 404 })
  if (inv.status === 'revoked') return NextResponse.json({ error: 'Invitación revocada.' }, { status: 403 })
  if (new Date(inv.token_expires_at) < new Date()) return NextResponse.json({ error: 'Enlace expirado.' }, { status: 403 })

  const tender = inv.tender as unknown as { project_id: string; status: string }
  const scopeUnitIds: string[] = (inv.scope_unit_ids as string[] | null) ?? []

  // Doc must belong to project + carry scope metadata so we can authorize
  const { data: doc } = await admin
    .from('fpe_documents')
    .select('id, chapter_id, project_unit_id')
    .eq('storage_path', storage_path)
    .eq('project_id', tender.project_id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 })

  // ── Scope check ───────────────────────────────────────────────────────────
  let allowed = false
  if (!doc.chapter_id && !doc.project_unit_id) {
    allowed = true
  } else if (doc.project_unit_id && scopeUnitIds.includes(doc.project_unit_id)) {
    allowed = true
  } else if (doc.chapter_id && scopeUnitIds.length > 0) {
    const { data: scopedUnits } = await admin
      .from('fpe_template_units')
      .select('chapter_id')
      .in('id', (
        await admin
          .from('fpe_project_units')
          .select('template_unit_id')
          .in('id', scopeUnitIds)
      ).data?.map(r => r.template_unit_id) ?? [])
    const scopedChapterIds = new Set((scopedUnits ?? []).map(r => r.chapter_id).filter(Boolean) as string[])
    allowed = scopedChapterIds.has(doc.chapter_id)
  }

  if (!allowed) {
    return NextResponse.json({ error: 'Documento fuera del alcance de la invitación.' }, { status: 403 })
  }

  // Generate signed URL (1 hour)
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storage_path, 60 * 60)

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'No se pudo generar URL.' }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl })
}
