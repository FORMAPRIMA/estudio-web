import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ObraActaPDFData, ObraActaChange } from '@/components/pdfs/ObraActaPDF'

export const runtime = 'nodejs'
export const maxDuration = 60

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/obra/actas/[id]/pdf
// Genera (o regenera) el PDF de un acta de obra y lo sirve inline.
// La fuente de verdad para el contenido es fpe_obra_actas.snapshot — el PDF
// se construye desde ahí para mantener el documento inmutable.
// ══════════════════════════════════════════════════════════════════════════════

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: acta, error } = await admin
      .from('fpe_obra_actas')
      .select(`
        id, project_id, kind, codigo, generated_at, total_delta_monto, snapshot,
        project:fpe_projects ( id, nombre, direccion, ciudad, linked_proyecto_id )
      `)
      .eq('id', ctx.params.id)
      .single()
    if (error || !acta) return NextResponse.json({ error: 'Acta no encontrada.' }, { status: 404 })

    type Project = { id: string; nombre: string; direccion: string | null; ciudad: string | null; linked_proyecto_id: string | null }
    const project = (acta as unknown as { project: Project | null }).project
    if (!project) return NextResponse.json({ error: 'Proyecto del acta no encontrado.' }, { status: 404 })

    // Obtener datos del cliente si es acta cliente y el proyecto está linkado
    let clientInfo: ObraActaPDFData['client'] = undefined
    if (acta.kind === 'cliente' && project.linked_proyecto_id) {
      const { data: pcRaw } = await admin
        .from('proyecto_clientes')
        .select('cliente:clientes ( nombre, apellidos, razon_social, nif, direccion )')
        .eq('proyecto_id', project.linked_proyecto_id)
        .limit(1)
        .maybeSingle()
      type ClienteRow = { nombre: string | null; apellidos: string | null; razon_social: string | null; nif: string | null; direccion: string | null }
      const c = (pcRaw as unknown as { cliente: ClienteRow | null } | null)?.cliente
      if (c) {
        clientInfo = {
          nombre:    c.razon_social || `${c.nombre ?? ''} ${c.apellidos ?? ''}`.trim() || '—',
          nif:       c.nif,
          direccion: c.direccion,
        }
      }
    }

    type Snapshot = {
      kind:               'cliente' | 'interna'
      codigo:             string
      year:               number
      numero:             number
      generated_at:       string
      total_delta:        number
      changes:            ObraActaChange[]
    }
    const snap = acta.snapshot as Snapshot

    const data: ObraActaPDFData = {
      kind:              acta.kind as 'cliente' | 'interna',
      codigo:            acta.codigo,
      generated_at:      acta.generated_at,
      total_delta_monto: Number(acta.total_delta_monto),
      project: {
        nombre:    project.nombre,
        direccion: project.direccion,
        ciudad:    project.ciudad,
      },
      client:  clientInfo,
      changes: snap.changes ?? [],
    }

    const { generateObraActaPDF } = await import('@/components/pdfs/ObraActaPDF')
    const buffer = await generateObraActaPDF(data)

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="${acta.codigo}.pdf"`,
        'Cache-Control':       'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[obra/actas/pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando PDF' },
      { status: 500 }
    )
  }
}
