import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdjudicationOverview } from '@/app/actions/fpe-tenders'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildContractData, fetchTechnicalDocsForContract } from '@/lib/fp-execution/contractData'
import { loadProjectScheduleInputs, computePartnerPhaseDates } from '@/lib/fp-execution/loadProjectSchedule'

export const runtime = 'nodejs'
export const maxDuration = 60

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

    const body = await req.json() as { project_id?: string; partner_id?: string }
    if (!body.project_id || !body.partner_id) {
      return NextResponse.json({ error: 'Faltan project_id o partner_id.' }, { status: 400 })
    }

    const overview = await getAdjudicationOverview(body.project_id)
    if ('error' in overview) return NextResponse.json({ error: overview.error }, { status: 400 })

    const pkg = overview.partners.find(p => p.partner_id === body.partner_id)
    if (!pkg) return NextResponse.json({ error: 'Partner sin UEs adjudicadas.' }, { status: 404 })

    const admin = createAdminClient()
    const [{ data: project }, { data: partner }] = await Promise.all([
      admin.from('fpe_projects')
        .select('id, nombre, direccion, ciudad')
        .eq('id', body.project_id)
        .single(),
      admin.from('fpe_partners')
        .select('id, nombre, razon_social, nif_cif, contacto_nombre, email_contacto, telefono, direccion, ciudad, codigo_postal')
        .eq('id', body.partner_id)
        .single(),
    ])

    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })

    const scope_unit_ids = pkg.chapters.flatMap(ch => ch.units.map(u => u.project_unit_id))

    const [technical_docs, scheduleInputs] = await Promise.all([
      fetchTechnicalDocsForContract({ admin, project_id: body.project_id, scope_unit_ids }),
      loadProjectScheduleInputs(admin, body.project_id),
    ])
    const phase_dates = scheduleInputs
      ? (computePartnerPhaseDates({ inputs: scheduleInputs, pkg }) ?? undefined)
      : undefined

    const data = buildContractData({ project, partner, pkg, technical_docs, phase_dates })

    const { generateFpeContractPDF } = await import('@/components/pdfs/FpeContractPDF')
    const buffer = await generateFpeContractPDF(data)

    const safeName = pkg.partner_nombre.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || 'partner'
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="Orden-Ejecucion-${safeName}.pdf"`,
        'Cache-Control':       'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[fpe-contracts/preview-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando preview' },
      { status: 500 }
    )
  }
}
