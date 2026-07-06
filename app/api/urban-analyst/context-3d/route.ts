import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { queryEdificiosAlturas } from '@/lib/urban-analyst/geoportal'

// Proxy del contexto 3D de manzana: edificios con altura real (restitución
// fotogramétrica) de la cartografía base municipal. Se proxea en servidor
// porque sigma.madrid.es no sirve CORS al navegador.

export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || ['fp_partner','fp_manager'].indexOf(profile.rol) === -1) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const bboxParam = req.nextUrl.searchParams.get('bbox')
  const parts = bboxParam?.split(',').map(Number) || []
  if (parts.length !== 4 || parts.some(isNaN)) {
    return NextResponse.json({ error: 'bbox inválido (minLng,minLat,maxLng,maxLat)' }, { status: 400 })
  }
  // Límite de tamaño: ~0,01° (≈1 km) por eje para no pedir media ciudad
  if (Math.abs(parts[2] - parts[0]) > 0.012 || Math.abs(parts[3] - parts[1]) > 0.012) {
    return NextResponse.json({ error: 'bbox demasiado grande' }, { status: 400 })
  }

  const edificios = await queryEdificiosAlturas([parts[0], parts[1], parts[2], parts[3]])
  return NextResponse.json({
    type: 'FeatureCollection',
    features: edificios.map((e) => ({
      type: 'Feature',
      geometry: e.geometry,
      properties: { altura: Math.round(e.alturaM * 10) / 10 },
    })),
  }, {
    headers: { 'Cache-Control': 'private, max-age=3600' },
  })
}
