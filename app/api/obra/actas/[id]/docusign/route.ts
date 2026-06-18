import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAndSendEnvelope } from '@/lib/docusign/client'
import type { ObraActaChange, ObraActaPDFData, ObraActaPhaseImpact } from '@/components/pdfs/ObraActaPDF'

export const runtime = 'nodejs'
export const maxDuration = 60

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/obra/actas/[id]/docusign
//
// Envía un acta cliente a firma electrónica vía DocuSign. El estado del acta
// pasa de 'generada' a 'sent_to_sign' y se guarda el envelope_id. El webhook
// de DocuSign (/api/webhooks/docusign) actualizará automáticamente el estado
// a 'signed' y luego a 'received' cuando llegue el PDF firmado.
// ══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
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
    const { data: acta, error: aErr } = await admin
      .from('fpe_obra_actas')
      .select(`
        id, project_id, kind, codigo, generated_at, total_delta_monto, snapshot, status,
        project:fpe_projects ( id, nombre, direccion, ciudad, linked_proyecto_id )
      `)
      .eq('id', ctx.params.id)
      .single()
    if (aErr || !acta) return NextResponse.json({ error: 'Acta no encontrada.' }, { status: 404 })

    if (acta.kind !== 'cliente') {
      return NextResponse.json({ error: 'Sólo las actas cliente se envían a DocuSign.' }, { status: 400 })
    }
    if (acta.status !== 'generada') {
      return NextResponse.json({ error: `El acta ya está en estado ${acta.status}.` }, { status: 400 })
    }

    type Project = { id: string; nombre: string; direccion: string | null; ciudad: string | null; linked_proyecto_id: string | null }
    const project = (acta as unknown as { project: Project | null }).project
    if (!project) return NextResponse.json({ error: 'Proyecto del acta no encontrado.' }, { status: 404 })

    // ── Resolve client info from linked proyecto ────────────────────────────
    if (!project.linked_proyecto_id) {
      return NextResponse.json({ error: 'El proyecto FPE no tiene proyecto interno vinculado para resolver el cliente.' }, { status: 400 })
    }
    const { data: pcRaw } = await admin
      .from('proyecto_clientes')
      .select('cliente:clientes ( nombre, apellidos, razon_social, nif, direccion, email )')
      .eq('proyecto_id', project.linked_proyecto_id)
      .limit(1)
      .maybeSingle()
    type ClienteRow = { nombre: string | null; apellidos: string | null; razon_social: string | null; nif: string | null; direccion: string | null; email: string | null }
    const c = (pcRaw as unknown as { cliente: ClienteRow | null } | null)?.cliente
    if (!c || !c.email) {
      return NextResponse.json({ error: 'No se pudo obtener el email del cliente para la firma.' }, { status: 400 })
    }
    const clientNombre = c.razon_social || `${c.nombre ?? ''} ${c.apellidos ?? ''}`.trim() || 'Cliente'

    // ── Body params (optional override of studio signer) ────────────────────
    const body = await req.json().catch(() => ({})) as { studio_signer?: { email?: string; name?: string } }
    const studioSigner = {
      email: body.studio_signer?.email ?? 'contacto@formaprima.es',
      name:  body.studio_signer?.name  ?? 'Forma Prima',
    }

    // ── Generate PDF ─────────────────────────────────────────────────────────
    type Snapshot = {
      kind: 'cliente' | 'interna'; codigo: string; year: number; numero: number;
      generated_at: string; total_delta: number; changes: ObraActaChange[]
    }
    const snap = acta.snapshot as Snapshot

    // Phase impacts asociados al acta
    const { data: impactsRaw } = await admin
      .from('fpe_obra_acta_phase_impacts')
      .select(`
        extra_dias,
        phase:fpe_obra_phases(id, nombre, planned_duration_dias, chapter_id)
      `)
      .eq('acta_id', ctx.params.id)
    type ImpactRow = {
      extra_dias: number
      phase: { id: string; nombre: string; planned_duration_dias: number | null; chapter_id: string | null } | null
    }
    const impactsRows = (impactsRaw ?? []) as unknown as ImpactRow[]
    const chapterIds = Array.from(new Set(impactsRows.map(r => r.phase?.chapter_id).filter((x): x is string => !!x)))
    const { data: chsRaw } = chapterIds.length > 0
      ? await admin.from('fpe_template_chapters').select('id, nombre').in('id', chapterIds)
      : { data: [] as Array<{ id: string; nombre: string }> }
    const chById: Record<string, string> = {}
    for (const ch of (chsRaw ?? [])) chById[ch.id] = ch.nombre
    const phaseImpacts: ObraActaPhaseImpact[] = impactsRows
      .filter(r => !!r.phase)
      .map(r => ({
        phase_nombre:        r.phase!.nombre,
        chapter_nombre:      r.phase!.chapter_id ? (chById[r.phase!.chapter_id] ?? null) : null,
        duracion_antes_dias: Number(r.phase!.planned_duration_dias ?? 0),
        extra_dias:          Number(r.extra_dias),
      }))

    const data: ObraActaPDFData = {
      kind:              'cliente',
      codigo:            acta.codigo,
      generated_at:      acta.generated_at,
      total_delta_monto: Number(acta.total_delta_monto),
      project: {
        nombre:    project.nombre,
        direccion: project.direccion,
        ciudad:    project.ciudad,
      },
      client: {
        nombre:    clientNombre,
        nif:       c.nif,
        direccion: c.direccion,
      },
      changes:       snap.changes ?? [],
      phase_impacts: phaseImpacts,
    }

    const { generateObraActaPDF } = await import('@/components/pdfs/ObraActaPDF')
    const pdfBuffer = await generateObraActaPDF(data)

    // ── Send envelope ────────────────────────────────────────────────────────
    const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'
    const webhookUrl = `${siteUrl}/api/webhooks/docusign`

    const envelope = await createAndSendEnvelope({
      contratoId:  acta.id,
      numero:      acta.codigo,
      pdfBuffer,
      cliente: { email: c.email, name: clientNombre },
      estudio: studioSigner,
      webhookUrl,
      emailSubject: `Acta de modificación ${acta.codigo} — Forma Prima`,
      documentName: `Acta-${acta.codigo}`,
    })

    // ── Update acta ─────────────────────────────────────────────────────────
    const { error: updErr } = await admin
      .from('fpe_obra_actas')
      .update({
        status:               'sent_to_sign',
        docusign_envelope_id: envelope.envelopeId,
        sent_at:              new Date().toISOString(),
      })
      .eq('id', acta.id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, envelope_id: envelope.envelopeId })
  } catch (err) {
    console.error('[obra/actas/docusign]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error enviando a DocuSign' },
      { status: 500 }
    )
  }
}
