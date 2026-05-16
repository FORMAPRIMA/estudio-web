import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: contract, error } = await admin
      .from('fpe_contracts')
      .select('id, status, contenido_json')
      .eq('id', id)
      .single()
    if (error || !contract) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 })

    const path = (contract.contenido_json as Record<string, unknown> | null)?.['pdf_signed_path'] as string | undefined
    if (!path) {
      return NextResponse.json({ error: 'Aún no hay PDF firmado disponible.' }, { status: 404 })
    }

    const { data: file, error: dlErr } = await admin.storage.from('fpe-documents').download(path)
    if (dlErr || !file) return NextResponse.json({ error: dlErr?.message ?? 'No se pudo descargar el PDF.' }, { status: 500 })

    const buffer = Buffer.from(await file.arrayBuffer())
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="Contrato-Firmado-${id}.pdf"`,
        'Cache-Control':       'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[fpe-contracts/signed-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error descargando PDF firmado' },
      { status: 500 }
    )
  }
}
