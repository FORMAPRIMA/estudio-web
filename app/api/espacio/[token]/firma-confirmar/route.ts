/**
 * Confirmación inmediata de la firma embebida.
 *
 * Cuando el cliente termina la ceremonia DocuSign dentro del iframe, el Espacio no
 * puede quedarse esperando al webhook (puede tardar o fallar en demo). Este endpoint
 * consulta el envelope directamente: si está "completed", descarga el PDF firmado,
 * lo archiva y dispara firmarContratoAdmin — la misma finalización que el webhook,
 * idempotente, llegue quien llegue primero.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEspacioCookieToken, espacioCookieName } from '@/lib/espacio/access'
import { getEnvelopeStatus } from '@/lib/docusign/client'
import { finalizeContratoFirmado } from '@/lib/docusign/finalizeContrato'

export const dynamic = 'force-dynamic'

async function isTeamMember(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    return ['fp_partner', 'fp_manager', 'fp_team', 'fp_biz_dev'].includes(profile?.rol as string)
  } catch { return false }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { token } = params

    // ── Authorise (misma regla que firma-url) ──────────────────────────────────
    const cookie   = req.cookies.get(espacioCookieName(token))?.value
    const cookieOk = cookie === generateEspacioCookieToken(token)
    if (!cookieOk && !(await isTeamMember())) {
      return NextResponse.json({ error: 'Sin acceso.' }, { status: 401 })
    }

    const admin = createAdminClient()

    // ── Resolve Espacio → contrato con envelope ────────────────────────────────
    const { data: espacio } = await admin
      .from('espacios').select('lead_id, cliente_id').eq('token', token).single()
    if (!espacio) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })

    let contrato: Record<string, any> | null = null
    if (espacio.lead_id) {
      const { data } = await admin.from('contratos')
        .select('id, status, docusign_status, docusign_envelope_id')
        .eq('lead_id', espacio.lead_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      contrato = data
    }
    if (!contrato && espacio.cliente_id) {
      const { data } = await admin.from('contratos')
        .select('id, status, docusign_status, docusign_envelope_id')
        .eq('cliente_id', espacio.cliente_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      contrato = data
    }
    if (!contrato?.docusign_envelope_id) {
      return NextResponse.json({ error: 'No hay envelope para este contrato.' }, { status: 404 })
    }

    if (contrato.status === 'firmado' && contrato.docusign_status === 'completed') {
      return NextResponse.json({ ok: true, firmado: true })
    }

    // ── Consultar DocuSign y finalizar si procede ──────────────────────────────
    const envelopeStatus = await getEnvelopeStatus(contrato.docusign_envelope_id as string)
    if (envelopeStatus !== 'completed') {
      return NextResponse.json({ ok: true, firmado: false, envelopeStatus })
    }

    const result = await finalizeContratoFirmado(
      contrato as { id: string; status: string | null; docusign_status: string | null },
      contrato.docusign_envelope_id as string,
    )
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true, firmado: true })
  } catch (err) {
    console.error('[espacio/firma-confirmar]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}
