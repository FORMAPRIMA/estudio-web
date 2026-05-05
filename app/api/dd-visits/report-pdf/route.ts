import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DdReportPDF } from '@/components/pdfs/DdReportPDF'
import type { DdReportPDFData } from '@/components/pdfs/DdReportPDF'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { assetId, resumenEjecutivo, disclaimerOverride } = await req.json()
    if (!assetId) return NextResponse.json({ error: 'assetId requerido' }, { status: 400 })

    const admin = createAdminClient()

    const [
      { data: asset },
      { data: visits },
      { data: cards },
      { data: roles },
      { data: media },
      { data: team },
    ] = await Promise.all([
      admin.from('dd_assets').select('*').eq('id', assetId).single(),
      admin.from('dd_visits').select('*').eq('asset_id', assetId).order('fecha'),
      admin.from('dd_cards').select('*').eq('asset_id', assetId).eq('activo', true).order('orden'),
      admin.from('dd_roles').select('*').eq('activo', true).order('orden'),
      admin.from('dd_card_media').select('*').eq('asset_id', assetId).order('created_at'),
      admin.from('dd_visit_team').select('*, rol:dd_roles(*)').eq('visit_id', (
        await admin.from('dd_visits').select('id').eq('asset_id', assetId).order('fecha').limit(1).single()
      ).data?.id ?? ''),
    ])

    if (!asset) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })

    const visitsWithTeam = (visits ?? []).map(v => ({
      ...v,
      team: (team ?? []).filter((t: any) => t.visit_id === v.id),
    }))

    const pdfData: DdReportPDFData = {
      asset,
      visits: visitsWithTeam,
      cards: cards ?? [],
      roles: roles ?? [],
      media: media ?? [],
      resumenEjecutivo,
      disclaimerOverride,
    }

    const buffer = await renderToBuffer(createElement(DdReportPDF, { data: pdfData }) as any)

    const safeNombre = asset.nombre.replace(/[^a-zA-Z0-9_-]/g, '-')
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="DD-${safeNombre}.pdf"`,
        'Cache-Control':       'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[dd-visits/report-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando PDF' },
      { status: 500 },
    )
  }
}
