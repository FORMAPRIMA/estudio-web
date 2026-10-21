import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prospectoPorToken } from '@/lib/salas/prospeccion'
import { icsReunion } from '@/lib/para/agenda'

// «Añadir a mi calendario» del cierre: la llamada vigente de este enlace en .ics.

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const p = await prospectoPorToken(params.token)
  if (!p) return new NextResponse(null, { status: 404 })
  const { data: r } = await createAdminClient().from('sala_reuniones').select('id, inicio, minutos')
    .eq('lead_id', p.leadId).neq('estado', 'cancelada').not('inicio', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!r?.inicio) return new NextResponse(null, { status: 404 })
  const en = p.lead.idioma === 'en'
  const ics = icsReunion({
    uid: r.id, inicio: new Date(r.inicio), minutos: r.minutos, titulo: `${p.lead.empresa} × Forma Prima`,
    descripcion: en ? `Call with ${p.lead.contacto.nombre} (Forma Prima).` : `Llamada con ${p.lead.contacto.nombre} (Forma Prima).`,
    organizador: p.lead.contacto.email,
  })
  return new NextResponse(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="forma-prima.ics"', 'Cache-Control': 'private, no-store' } })
}
