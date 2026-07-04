import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refcatFromCoords } from '@/lib/urban-analyst/catastro'

// Proxy: referencia catastral de la parcela en unas coordenadas (para el
// "clic en el mapa → añadir parcela al activo"). OVC no sirve CORS.

export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const lat = parseFloat(req.nextUrl.searchParams.get('lat') || '')
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') || '')
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat/lng inválidos' }, { status: 400 })
  }

  const rc = await refcatFromCoords(lat, lng)
  if (!rc) return NextResponse.json({ error: 'Sin parcela en ese punto' }, { status: 404 })
  return NextResponse.json({ refcat: rc.refcat, direccion: rc.direccion })
}
