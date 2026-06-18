import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEspacioCookieToken, espacioCookieName } from '@/lib/espacio/access'
import type { ContratoPDFData, ServicioContrato, ContratoHonorario } from '@/components/pdfs/ContratoPDF'
import { CLAUSULAS_DEFAULT, type ContratoClausula } from '@/lib/contratos/clausulas'

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

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { token } = params

  const cookie = req.cookies.get(espacioCookieName(token))?.value
  const cookieOk = cookie === generateEspacioCookieToken(token)
  if (!cookieOk && !(await isTeamMember())) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: espacio } = await admin
    .from('espacios').select('lead_id, cliente_id').eq('token', token).single()
  if (!espacio) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })

  let contrato: Record<string, unknown> | null = null
  if (espacio.lead_id) {
    const { data } = await admin.from('contratos').select('*').eq('lead_id', espacio.lead_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    contrato = data
  }
  if (!contrato && espacio.cliente_id) {
    const { data } = await admin.from('contratos').select('*').eq('cliente_id', espacio.cliente_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    contrato = data
  }
  if (!contrato) return NextResponse.json({ error: 'No hay contrato.' }, { status: 404 })

  const { data: plantillaRows } = await admin
    .from('propuestas_servicios_plantilla')
    .select('id, label_en, texto_en, entregables_en, semanas_default_en, pago_en, notas_en')
  const plantilla_en: NonNullable<ContratoPDFData['plantilla_en']> = {}
  for (const row of (plantillaRows ?? [])) {
    plantilla_en[row.id] = {
      label_en: row.label_en, texto_en: row.texto_en, entregables_en: row.entregables_en,
      semanas_default_en: row.semanas_default_en, pago_en: row.pago_en, notas_en: row.notas_en,
    }
  }

  const c = contrato as Record<string, any>
  const pdfData: ContratoPDFData = {
    numero:             c.numero ?? '—',
    fecha_contrato:     c.fecha_contrato ?? c.fecha_firma ?? null, // viva hasta la firma
    tipo_cliente:       (c.contenido?.tipo_cliente ?? (c.cliente_empresa ? 'juridica' : 'fisica')) as 'fisica' | 'juridica',
    cliente_nombre:     c.cliente_nombre ?? null,
    cliente_apellidos:  c.cliente_apellidos ?? null,
    cliente_empresa:    c.cliente_empresa ?? null,
    cliente_nif:        c.cliente_nif ?? null,
    cliente_direccion:  c.cliente_direccion ?? null,
    cliente_ciudad:     c.cliente_ciudad ?? null,
    proyecto_nombre:    c.proyecto_nombre ?? null,
    proyecto_direccion: c.proyecto_direccion ?? null,
    proyecto_tipo:      c.proyecto_tipo ?? null,
    servicios_contrato: (c.contenido?.servicios ?? []) as ServicioContrato[],
    honorarios:         (c.honorarios ?? []) as ContratoHonorario[],
    notas:              c.notas ?? null,
    clausulas:          (c.contenido?.clausulas as ContratoClausula[] | undefined) ?? CLAUSULAS_DEFAULT,
    plantilla_en,
    lang: 'es',
  }

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { ContratoPDF } = await import('@/components/pdfs/ContratoPDF')
  const buffer = await renderToBuffer(createElement(ContratoPDF, { data: pdfData }) as never)

  const numero = c.numero && c.numero !== 'BORRADOR' ? c.numero : 'Forma-Prima'
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Contrato-${numero}.pdf"`,
    },
  })
}
