import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'fpe-documents'

// Returns a signed download URL for a document.
// Auth: validated via invitation token — no Supabase session required.
// The token must be active and the document must belong to the same project.

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const token        = searchParams.get('token')
  const storage_path = searchParams.get('storage_path')

  if (!token)        return NextResponse.json({ error: 'token requerido.' }, { status: 400 })
  if (!storage_path) return NextResponse.json({ error: 'storage_path requerido.' }, { status: 400 })

  const admin = createAdminClient()

  // Validate token — must be active (not revoked/expired) and tender must be active
  const { data: inv } = await admin
    .from('fpe_tender_invitations')
    .select('id, token_expires_at, status, tender:fpe_tenders(project_id, status)')
    .eq('token', token)
    .single()

  if (!inv) return NextResponse.json({ error: 'Invitación no encontrada.' }, { status: 404 })
  if (inv.status === 'revoked') return NextResponse.json({ error: 'Invitación revocada.' }, { status: 403 })
  if (new Date(inv.token_expires_at) < new Date()) return NextResponse.json({ error: 'Enlace expirado.' }, { status: 403 })

  const tender = inv.tender as unknown as { project_id: string; status: string }

  // Verify the document belongs to this project
  const { data: doc } = await admin
    .from('fpe_documents')
    .select('id')
    .eq('storage_path', storage_path)
    .eq('project_id', tender.project_id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 })

  // Generate signed URL (1 hour)
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storage_path, 60 * 60)

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'No se pudo generar URL.' }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl })
}
