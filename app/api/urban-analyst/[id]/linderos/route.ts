import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAreaMovimiento, type AreaMovimientoResult, type TipoLindero } from '@/lib/urban-analyst/areaMovimiento'
import { getParcelasVecinas } from '@/lib/urban-analyst/catastro'
import { bbox } from '@/lib/urban-analyst/geometry'
import type { UrbanAsset, GeoJSONGeometry } from '@/lib/urban-analyst/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const TIPOS: TipoLindero[] = ['frente', 'lateral', 'testero']

// Reclasifica manualmente un lindero (desde el gemelo 3D) y recalcula el área
// de movimiento y su volumen capaz con los retranqueos del nuevo tipo. El
// resultado se persiste en el análisis (kind cuadro_urbanistico) para que
// cuadro, KPIs e informe queden consistentes.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || ['fp_partner', 'fp_manager'].indexOf(profile.rol) === -1) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { key, tipo } = await req.json().catch(() => ({})) as { key?: string; tipo?: TipoLindero }
  if (!key || !tipo || !TIPOS.includes(tipo)) {
    return NextResponse.json({ error: 'Parámetros inválidos (key, tipo)' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: assetRow } = await admin.from('urban_assets').select('*').eq('id', params.id).single()
  if (!assetRow) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })
  const asset = assetRow as UrbanAsset
  if (!asset.parcel_geometry) return NextResponse.json({ error: 'El activo no tiene geometría' }, { status: 400 })

  const { data: cuadroRow } = await admin
    .from('urban_analysis').select('id, content')
    .eq('asset_id', params.id).eq('kind', 'cuadro_urbanistico').maybeSingle()
  const content = (cuadroRow?.content || null) as ({ area_movimiento?: AreaMovimientoResult | null } & Record<string, unknown>) | null
  const am = content?.area_movimiento
  if (!cuadroRow || !am || !am.linderos?.length) {
    return NextResponse.json({ error: 'Sin área de movimiento con linderos: re-analiza el activo primero' }, { status: 400 })
  }
  if (!am.linderos.some((l) => l.key === key)) {
    return NextResponse.json({ error: `Lindero ${key} no encontrado` }, { status: 400 })
  }

  // Overrides acumulados: los manuales previos + el nuevo
  const overrides: Record<string, TipoLindero> = {}
  for (const l of am.linderos) if (l.override) overrides[l.key] = l.tipo
  overrides[key] = tipo

  // Parcelario vecino para clasificar las aristas que siguen en modo heurístico
  let vecinos: GeoJSONGeometry[] = []
  try {
    const bb = bbox(asset.parcel_geometry)
    if (bb) {
      const margen = 25 / 111320
      const allRefcats = [asset.refcat, ...((asset.refcats || []) as string[])].filter(Boolean) as string[]
      const vecinas = await getParcelasVecinas(
        [bb[0] - margen, bb[1] - margen, bb[2] + margen, bb[3] + margen],
        allRefcats
      )
      vecinos = vecinas.map((v) => v.geometry)
    }
  } catch { /* sin vecinas: los overrides mandan */ }

  const nuevo = computeAreaMovimiento({
    parcelGeometry: asset.parcel_geometry,
    parcelArea: asset.parcel_area,
    vecinos,
    retranqueoFrente: am.retranqueos_aplicados.frente,
    retranqueoLateral: am.retranqueos_aplicados.lateral,
    retranqueoTestero: am.retranqueos_aplicados.testero,
    ocupacionPct: am.params_aplicados?.ocupacion_pct ?? null,
    coefEdificabilidad: am.params_aplicados?.coef_edificabilidad ?? null,
    plantasMax: am.plantas_aplicadas,
    construidaComputable: asset.built_area_computable ?? asset.built_area,
    overrides,
  })

  await admin.from('urban_analysis')
    .update({ content: { ...content, area_movimiento: nuevo } })
    .eq('id', cuadroRow.id)

  return NextResponse.json({ area_movimiento: nuevo })
}
