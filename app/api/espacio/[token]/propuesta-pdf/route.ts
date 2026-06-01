import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlantillaServicios } from '@/app/actions/plantillaPropuestas'
import { generateEspacioCookieToken, espacioCookieName } from '@/lib/espacio/access'
import type { ServicioId } from '@/lib/propuestas/config'
import type { PropuestaPDFData } from '@/components/pdfs/PropuestaPDF'

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

  // Acceso: cookie de sesión del Espacio o miembro del equipo.
  const cookie = req.cookies.get(espacioCookieName(token))?.value
  const cookieOk = cookie === generateEspacioCookieToken(token)
  if (!cookieOk && !(await isTeamMember())) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: espacio } = await admin
    .from('espacios')
    .select('lead_id')
    .eq('token', token)
    .single()
  if (!espacio?.lead_id) return NextResponse.json({ error: 'No hay propuesta.' }, { status: 404 })

  const { data: propuesta } = await admin
    .from('propuestas')
    .select('*')
    .eq('lead_id', espacio.lead_id)
    .in('status', ['enviada', 'aceptada'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!propuesta) return NextResponse.json({ error: 'No hay propuesta.' }, { status: 404 })

  const { data: leadRow } = await admin
    .from('leads')
    .select('nombre, apellidos, empresa, email, telefono, direccion')
    .eq('id', espacio.lead_id)
    .single()

  const [serviciosPlantilla, { data: ratiosFases }] = await Promise.all([
    getPlantillaServicios(),
    admin.from('catalogo_fases').select('id, label, seccion, ratio').eq('seccion', 'Interiorismo').order('orden'),
  ])
  const ratios = (ratiosFases ?? []).map(r => ({
    label: r.label as string, servicio: 'interiorismo' as ServicioId, ratio: (r.ratio as number) ?? 0,
  }))

  const pdfData: PropuestaPDFData = {
    numero:              propuesta.numero,
    titulo:              propuesta.titulo ?? null,
    fecha_propuesta:     propuesta.fecha_propuesta ?? new Date().toISOString().split('T')[0],
    direccion:           propuesta.direccion ?? null,
    notas:               propuesta.notas ?? null,
    servicios:           (propuesta.servicios ?? []) as ServicioId[],
    m2:                  propuesta.m2_diseno ?? 0,
    costo_m2:            propuesta.costo_m2_objetivo ?? 0,
    porcentaje_pem:      propuesta.porcentaje_pem ?? 10,
    pct_junior:          propuesta.pct_junior ?? 0,
    pct_senior:          propuesta.pct_senior ?? 70,
    pct_partner:         propuesta.pct_partner ?? 30,
    semanas:             (propuesta.semanas ?? {}) as Record<string, string>,
    honorarios_override: (propuesta.honorarios_override ?? {}) as Record<string, number>,
    serviciosPlantilla,
    ratios,
    lead: leadRow ?? null,
  }

  // Import dinámico del renderer (regla del proyecto para @react-pdf/renderer).
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { PropuestaPDF } = await import('@/components/pdfs/PropuestaPDF')
  const buffer = await renderToBuffer(createElement(PropuestaPDF, { data: pdfData }) as never)

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Propuesta-${propuesta.numero && propuesta.numero !== 'BORRADOR' ? propuesta.numero : 'Forma-Prima'}.pdf"`,
    },
  })
}
