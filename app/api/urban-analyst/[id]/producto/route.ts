import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { getMercadoZona } from '@/lib/urban-analyst/mercado'
import { computeProducto, MERCADO_DEFAULTS, type MercadoInputs } from '@/lib/urban-analyst/producto'
import { nzCandidatos, type CuadroUrbanistico } from '@/lib/urban-analyst/cuadroUrbanistico'
import type { AreaMovimientoResult } from '@/lib/urban-analyst/areaMovimiento'
import { parseJsonRespuesta, IA_MODEL, REGLAS_ANALISTA } from '@/lib/urban-analyst/iaContext'
import type { UrbanAsset, NormaZonal, EdificabilidadResult } from '@/lib/urban-analyst/types'

// Producto optimizado: cruza el volumen capaz del análisis urbanístico con la
// renta de la zona (INE) y el €/m² de venta. El motor financiero es
// determinista (lib/urban-analyst/producto.ts); la IA solo redacta.

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || ['fp_partner','fp_manager'].indexOf(profile.rol) === -1) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as Partial<MercadoInputs>
  if (!body.precioVentaM2 || body.precioVentaM2 <= 0) {
    return NextResponse.json({ error: 'Indica el €/m² de venta de la zona.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const [{ data: assetRow }, { data: analysisRows }] = await Promise.all([
    admin.from('urban_assets').select('*').eq('id', params.id).single(),
    admin.from('urban_analysis').select('kind, content').eq('asset_id', params.id),
  ])
  if (!assetRow) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })
  const asset = assetRow as UrbanAsset
  if (asset.lat == null || asset.lng == null) {
    return NextResponse.json({ error: 'El activo no está localizado: lanza el análisis primero.' }, { status: 400 })
  }

  try {
    const analysis = analysisRows || []
    const cuadro = analysis.find((a) => a.kind === 'cuadro_urbanistico')?.content as
      (CuadroUrbanistico & { area_movimiento?: AreaMovimientoResult | null }) | undefined
    const volumenCapaz = analysis.find((a) => a.kind === 'volumen_capaz')?.content as
      { capaz_total_m2c?: number | null } | undefined
    const edificabilidad = analysis.find((a) => a.kind === 'edificabilidad')?.content as EdificabilidadResult | undefined

    // Volumen disponible: la fuente más sólida primero
    let m2c: number | null = null
    let volumenFuente = ''
    if (cuadro?.area_movimiento?.volumen_max_m2c != null && cuadro.area_movimiento.volumen_max_m2c > 0) {
      m2c = cuadro.area_movimiento.volumen_max_m2c
      volumenFuente = `Área de movimiento × restricciones (vincula: ${cuadro.area_movimiento.restriccion_vinculante})`
    } else if (edificabilidad?.metodo === 'formula_volumetrica' && edificabilidad.edificabilidad_teorica != null && edificabilidad.edificabilidad_teorica > 0) {
      // NZ 1: la E de la fórmula (con C) es más restrictiva que la envolvente física por bandas
      m2c = edificabilidad.edificabilidad_teorica
      volumenFuente = `Fórmula E = S × Z × C (C = ${edificabilidad.formula_c}, plano CE)`
    } else if (volumenCapaz?.capaz_total_m2c != null && volumenCapaz.capaz_total_m2c > 0) {
      m2c = volumenCapaz.capaz_total_m2c
      volumenFuente = 'Volumen capaz por bandas COEF_Z (plano de Condiciones de Edificación)'
    } else if (cuadro?.sintesis.edificabilidad_max_m2c != null && cuadro.sintesis.edificabilidad_max_m2c > 0) {
      m2c = cuadro.sintesis.edificabilidad_max_m2c
      volumenFuente = 'Edificabilidad máxima del cuadro urbanístico (más restrictiva)'
    } else if (edificabilidad?.envolvente_max != null && edificabilidad.envolvente_max > 0) {
      m2c = edificabilidad.envolvente_max
      volumenFuente = 'Envolvente máxima estimada (método volumétrico)'
    }
    if (m2c == null) {
      return NextResponse.json({ error: 'Sin volumen capaz calculado: lanza (o completa) el análisis urbanístico primero.' }, { status: 400 })
    }

    // Mercado de la zona (sección censal + renta INE + demografía municipal)
    const mercado = await getMercadoZona(asset.lat, asset.lng)

    const inputs: MercadoInputs = {
      precioVentaM2: body.precioVentaM2,
      rentaNetaHogarAnual: body.rentaNetaHogarAnual ?? mercado.renta_hogar_anual ?? 0,
      tipoInteresPct: body.tipoInteresPct ?? MERCADO_DEFAULTS.tipoInteresPct,
      plazoAnios: body.plazoAnios ?? MERCADO_DEFAULTS.plazoAnios,
      ltvPct: body.ltvPct ?? MERCADO_DEFAULTS.ltvPct,
      esfuerzoMaxPct: body.esfuerzoMaxPct ?? MERCADO_DEFAULTS.esfuerzoMaxPct,
      coefVendible: body.coefVendible ?? MERCADO_DEFAULTS.coefVendible,
    }
    if (inputs.rentaNetaHogarAnual <= 0) {
      return NextResponse.json({ error: 'Sin renta de la zona (INE) y sin renta manual: indica la renta neta anual del hogar objetivo.' }, { status: 400 })
    }

    // Régimen: unifamiliar si el uso cualificado de la NZ lo es
    let nzRow: NormaZonal | null = null
    if (asset.norma_zonal) {
      const candidatos = nzCandidatos(asset.norma_zonal)
      const { data } = await admin.from('urban_normas_zonales').select('*').in('codigo', candidatos)
      const rows = (data || []) as NormaZonal[]
      nzRow = candidatos.map((c) => rows.find((r) => r.codigo === c)).find(Boolean) || null
    }
    const esUnifamiliar = Boolean(
      nzRow && /unifamiliar/i.test(`${nzRow.uso_cualificado || ''} ${nzRow.tipologia || ''} ${nzRow.nombre || ''}`)
    )
    const parcelasPosibles = esUnifamiliar && nzRow?.parcela_minima_m2 && asset.parcel_area
      ? Math.max(1, Math.floor(asset.parcel_area / nzRow.parcela_minima_m2))
      : 1

    const producto = computeProducto({
      m2cDisponibles: m2c,
      volumenFuente,
      inputs,
      regimen: esUnifamiliar ? 'unifamiliar' : 'colectiva',
      parcelasPosibles,
    })

    // Narrativa IA sobre los números ya calculados
    let narrativa: Record<string, unknown> | null = null
    try {
      const message = await anthropic.messages.create({
        model: IA_MODEL,
        max_tokens: 3000,
        thinking: { type: 'adaptive' },
        system: REGLAS_ANALISTA,
        messages: [{
          role: 'user',
          content: `Redacta el análisis de PRODUCTO INMOBILIARIO ÓPTIMO para este activo. Los números ya están calculados por el motor determinista: NO los recalcules ni inventes otros; interpreta y recomienda.

ACTIVO: ${asset.nombre} · ${asset.direccion || ''} · NZ ${asset.norma_zonal || 's/d'} · parcela ${asset.parcel_area ?? 's/d'} m²

ZONA (fuentes: capas municipales + ${mercado.renta_fuente}):
${JSON.stringify(mercado, null, 1)}

MOTOR DE PRODUCTO (determinista):
${JSON.stringify(producto, null, 1)}

Responde ÚNICAMENTE con JSON válido:
{
  "titular": "1 frase tipo pitch: el producto óptimo y por qué (estilo: 'X viviendas de N dormitorios de M m² para <comprador> que con la renta de la zona soportan cuota de K €')",
  "comprador_tipo": "perfil concreto del comprador objetivo (edad aproximada por la demografía de la zona, situación, motivación)",
  "narrativa": "4-7 frases que conecten: renta y demografía de la zona → capacidad de compra → producto que encaja en el volumen capaz → lectura del GDV. Etiqueta [OFICIAL]/[INFERIDO]/[HIPÓTESIS] los datos clave.",
  "argumentos_venta": ["argumento 1 para un fondo/inversor", "..."],
  "riesgos_comerciales": ["riesgo 1", "..."],
  "siguiente_paso": "qué verificar antes de fiarse de este análisis (estudio de mercado real, testigos de venta, etc.)"
}`,
        }],
      })
      const block = message.content.find((b) => b.type === 'text')
      narrativa = block && block.type === 'text' ? parseJsonRespuesta(block.text) : null
    } catch (iaErr) {
      console.error('[urban-analyst/producto/ia]', iaErr)
    }

    const contenido = {
      mercado,
      producto,
      narrativa,
      generado_at: new Date().toISOString(),
    }
    await admin.from('urban_analysis').delete().eq('asset_id', params.id).eq('kind', 'producto')
    await admin.from('urban_analysis').insert({
      asset_id: params.id, kind: 'producto', content: contenido, model: narrativa ? IA_MODEL : null,
    })

    return NextResponse.json({ ok: true, contenido })
  } catch (err) {
    console.error('[urban-analyst/producto]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error calculando el producto' },
      { status: 500 }
    )
  }
}
