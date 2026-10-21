import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { esHostSalas, miembroActual, salaDe } from '@/lib/salas/panel'
import { leerLogo } from '@/lib/salas/prospeccion'

// Vista previa del logo de un lead en el panel (?modo=blanco|original).

export async function GET(req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  if (!esHostSalas()) return new NextResponse(null, { status: 404 })
  const m = await miembroActual()
  const sala = m ? await salaDe(m, params.slug) : null
  if (!sala) return new NextResponse(null, { status: 404 })
  const { data } = await createAdminClient().from('sala_leads').select('logo_path, sala_id').eq('id', params.id).maybeSingle()
  if (!data?.logo_path || data.sala_id !== sala.id) return new NextResponse(null, { status: 404 })
  const png = await leerLogo(data.logo_path, req.nextUrl.searchParams.get('modo') === 'original' ? 'original' : 'blanco')
  if (!png) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' } })
}
