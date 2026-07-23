import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAreaMovimiento, type AreaMovimientoResult, type TipoLindero, type LinderoOverride, type TipoPersonalizado, type ReglaAltura } from '@/lib/urban-analyst/areaMovimiento'
import { getParcelasVecinas } from '@/lib/urban-analyst/catastro'
import { bbox } from '@/lib/urban-analyst/geometry'
import type { UrbanAsset, GeoJSONGeometry } from '@/lib/urban-analyst/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const TIPOS: TipoLindero[] = ['frente', 'lateral', 'testero', 'custom']

interface LinderoPayload {
  key?: string
  tipo?: TipoLindero
  nombre?: string | null
  retranqueo_m?: number | null      // number = fija distancia (0 = adosado); null = usa la de la NZ
  regla_altura?: ReglaAltura | null // { base_m, factor_h } = crece con la altura; null = constante
  reset?: boolean                   // vuelve al modo heurístico (sin override)
}

function sanea(n: unknown, min: number, max: number): number | null {
  const v = typeof n === 'number' ? n : parseFloat(String(n))
  if (!Number.isFinite(v) || v < min || v > max) return null
  return Math.round(v * 100) / 100
}

function saneaRegla(r: unknown): ReglaAltura | null {
  if (!r || typeof r !== 'object') return null
  const base = sanea((r as ReglaAltura).base_m, 0, 50)
  const factor = sanea((r as ReglaAltura).factor_h, 0, 3)
  if (base == null || factor == null) return null
  return { base_m: base, factor_h: factor }
}

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

  const body = await req.json().catch(() => ({})) as LinderoPayload
  const key = body.key
  if (!key) return NextResponse.json({ error: 'Falta key del lindero' }, { status: 400 })
  if (body.tipo && !TIPOS.includes(body.tipo)) {
    return NextResponse.json({ error: `Tipo inválido: ${body.tipo}` }, { status: 400 })
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
  const linderoActual = am.linderos.find((l) => l.key === key)
  if (!linderoActual) {
    return NextResponse.json({ error: `Lindero ${key} no encontrado` }, { status: 400 })
  }

  // Overrides acumulados: los manuales previos, reconstruidos con todos sus datos
  const overrides: Record<string, LinderoOverride> = {}
  for (const l of am.linderos) {
    if (!l.override) continue
    overrides[l.key] = {
      tipo: l.tipo,
      nombre: l.nombre ?? null,
      retranqueo_m: l.retranqueo_override ? (l.retranqueo_m ?? null) : null,
      regla_altura: l.regla_altura ?? null,
    }
  }

  // Aplicar la edición pedida sobre este lindero
  if (body.reset) {
    delete overrides[key]
  } else {
    const prev = overrides[key]
    const tipo = body.tipo ?? prev?.tipo ?? linderoActual.tipo
    const retranqueo_m = 'retranqueo_m' in body ? (body.retranqueo_m == null ? null : sanea(body.retranqueo_m, 0, 100)) : (prev?.retranqueo_m ?? null)
    const regla_altura = 'regla_altura' in body ? (body.regla_altura == null ? null : saneaRegla(body.regla_altura)) : (prev?.regla_altura ?? null)
    const nombre = tipo === 'custom' ? (body.nombre ?? prev?.nombre ?? 'Personalizado') : null
    overrides[key] = { tipo, nombre, retranqueo_m, regla_altura }
  }

  // Paleta de tipos personalizados del activo (reutilizable): upsert por nombre
  const tiposPersonalizados: TipoPersonalizado[] = [...(am.tipos_personalizados || [])]
  const aplicado = overrides[key]
  if (aplicado?.tipo === 'custom' && aplicado.nombre) {
    const idx = tiposPersonalizados.findIndex((t) => t.nombre.toLowerCase() === aplicado.nombre!.toLowerCase())
    const entrada: TipoPersonalizado = { nombre: aplicado.nombre, retranqueo_m: aplicado.retranqueo_m ?? null, regla_altura: aplicado.regla_altura ?? null }
    if (idx >= 0) tiposPersonalizados[idx] = entrada
    else tiposPersonalizados.push(entrada)
  }

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
    factorAlturaFrente: am.factores_altura?.frente ?? null,
    factorAlturaLateral: am.factores_altura?.lateral ?? null,
    factorAlturaTestero: am.factores_altura?.testero ?? null,
    alturaPisoM: am.altura_piso_m ?? null,
    ocupacionPct: am.params_aplicados?.ocupacion_pct ?? null,
    coefEdificabilidad: am.params_aplicados?.coef_edificabilidad ?? null,
    plantasMax: am.plantas_aplicadas,
    construidaComputable: asset.built_area_computable ?? asset.built_area,
    overrides,
    tiposPersonalizados,
  })

  await admin.from('urban_analysis')
    .update({ content: { ...content, area_movimiento: nuevo } })
    .eq('id', cuadroRow.id)

  return NextResponse.json({ area_movimiento: nuevo })
}
