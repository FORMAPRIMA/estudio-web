import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UrbanAsset, UrbanRedFlag, EdificabilidadResult } from '@/lib/urban-analyst/types'
import type { InformeUrbanisticoData } from '@/components/pdfs/InformeUrbanisticoPDF'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || ['fp_partner','fp_manager'].indexOf(profile.rol) === -1) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: assetRow } = await admin.from('urban_assets').select('*').eq('id', params.id).single()
    if (!assetRow) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })
    const asset = assetRow as UrbanAsset

    const [flagsRes, analysisRes, hitsRes] = await Promise.all([
      admin.from('urban_red_flags').select('*').eq('asset_id', params.id).order('created_at'),
      admin.from('urban_analysis').select('kind, content').eq('asset_id', params.id),
      admin.from('urban_layer_hits').select('service').eq('asset_id', params.id),
    ])

    const memo = (analysisRes.data || []).find((a) => a.kind === 'memo')?.content as InformeUrbanisticoData['memo'] | undefined
    const edificabilidad = (analysisRes.data || []).find((a) => a.kind === 'edificabilidad')?.content as EdificabilidadResult | undefined
    const volumen = (analysisRes.data || []).find((a) => a.kind === 'volumen_capaz')?.content as {
      bandas?: { coef_z: string; plantas: number | null; area_banda_m2: number; capaz_m2c: number | null; existente_m2c: number; remanente_m2c: number | null }[]
      capaz_total_m2c?: number | null
      existente_total_m2c?: number | null
      remanente_materializable_m2c?: number | null
      advertencias?: string[]
    } | undefined

    // El volumen capaz se presenta dentro de la sección de edificabilidad del PDF
    const edificabilidadPdf = edificabilidad
      ? { etiquetas: [...(edificabilidad.etiquetas || [])], advertencias: [...(edificabilidad.advertencias || [])], recomendaciones: edificabilidad.recomendaciones }
      : { etiquetas: [] as { campo: string; valor: string; tipo: string }[], advertencias: [] as string[], recomendaciones: [] as string[] }
    if (volumen?.bandas && volumen.bandas.length > 0) {
      const f = (n: number | null | undefined) => (n == null ? 's/d' : new Intl.NumberFormat('es-ES').format(n))
      edificabilidadPdf.etiquetas.push({
        campo: 'Volumen capaz (bandas COEF_Z)',
        valor: `${f(volumen.capaz_total_m2c)} m²c capaz · ${f(volumen.existente_total_m2c)} m²c existente · ${f(volumen.remanente_materializable_m2c)} m²c remanente materializable`,
        tipo: 'hipotesis',
      })
      for (const b of volumen.bandas) {
        edificabilidadPdf.etiquetas.push({
          campo: `Banda COEF_Z ${b.coef_z || 's/d'}`,
          valor: `${f(b.area_banda_m2)} m² × ${b.plantas ?? '?'} plantas → ${f(b.capaz_m2c)} m²c (existente ${f(b.existente_m2c)}, remanente ${f(b.remanente_m2c)})`,
          tipo: 'hipotesis',
        })
      }
      edificabilidadPdf.advertencias.push(...(volumen.advertencias || []).slice(0, 3))
    }

    const fmt = (n: number | null | undefined, unit = '') =>
      n == null ? null : `${new Intl.NumberFormat('es-ES').format(n)}${unit}`

    const datos: InformeUrbanisticoData['datos'] = []
    if (asset.parcel_area != null) datos.push({ label: 'Superficie de parcela', valor: fmt(asset.parcel_area, ' m²')!, tipo: 'oficial' })
    if (asset.built_area != null) datos.push({ label: 'Superficie construida (Catastro)', valor: fmt(asset.built_area, ' m²')!, tipo: 'inferido' })
    if (asset.cadastral_use) datos.push({ label: 'Uso catastral', valor: asset.cadastral_use, tipo: 'oficial' })
    if (asset.year_built != null) datos.push({ label: 'Año de construcción', valor: String(asset.year_built), tipo: 'oficial' })
    if (asset.num_inmuebles != null) datos.push({ label: 'Inmuebles en parcela', valor: String(asset.num_inmuebles), tipo: 'oficial' })
    if (asset.num_viviendas != null) datos.push({ label: 'Viviendas', valor: String(asset.num_viviendas), tipo: 'oficial' })
    if (asset.uso_actual) datos.push({ label: 'Uso actual (declarado)', valor: asset.uso_actual })
    if (asset.uso_objetivo) datos.push({ label: 'Uso objetivo', valor: asset.uso_objetivo })
    if (asset.tipo_operacion) datos.push({ label: 'Tipo de operación', valor: asset.tipo_operacion })
    if (asset.precio_compra != null) datos.push({ label: 'Precio de compra', valor: fmt(asset.precio_compra, ' €')! })
    if (asset.capex_estimado != null) datos.push({ label: 'CAPEX estimado', valor: fmt(asset.capex_estimado, ' €')! })

    const servicios = Array.from(new Set(((hitsRes.data || []) as { service: string }[]).map((h) => h.service)))
    const fuentes = [
      'Dirección General del Catastro — Servicios OVC e INSPIRE (WFS CP/BU)',
      'CartoCiudad (IGN) — geocodificación',
      ...servicios.map((sv) => `Geoportal Ayto. Madrid — ${sv} (sin valor jurídico)`),
      'PGOUM 1997 — Compendio de NNUU (carácter informativo)',
    ]

    const data: InformeUrbanisticoData = {
      nombre: asset.nombre,
      direccion: asset.direccion,
      refcat: asset.refcat,
      fecha: asset.analyzed_at || asset.created_at,
      datos,
      normaZonal: asset.norma_zonal,
      normaZonalDenominacion: asset.norma_zonal_denominacion,
      memo: memo || null,
      edificabilidad: edificabilidadPdf.etiquetas.length > 0 || edificabilidadPdf.advertencias.length > 0 ? edificabilidadPdf : null,
      redFlags: ((flagsRes.data || []) as UrbanRedFlag[]).map((f) => ({
        severidad: f.severidad, titulo: f.titulo, descripcion: f.descripcion,
        recomendacion: f.recomendacion, fuente: f.fuente,
      })),
      fuentes,
    }

    // Import dinámico: @react-pdf/renderer no puede empaquetarse estáticamente
    const reactPdf = await import('@react-pdf/renderer')
    const { buildInformeUrbanisticoElement } = await import('@/components/pdfs/InformeUrbanisticoPDF')
    const element = buildInformeUrbanisticoElement(reactPdf, data)
    const buffer = await reactPdf.renderToBuffer(element)

    const filename = `Informe_Urbanistico_${asset.nombre.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[urban-analyst/informe]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando el informe' },
      { status: 500 }
    )
  }
}
