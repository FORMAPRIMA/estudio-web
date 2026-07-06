import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { buildContextoActivo, stripVolumenGeometrias, parseJsonRespuesta, IA_MODEL, REGLAS_ANALISTA } from '@/lib/urban-analyst/iaContext'
import type { UrbanAsset, NormaZonal, EdificabilidadResult } from '@/lib/urban-analyst/types'

export const maxDuration = 180
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

  const { scenarioId } = (await req.json()) as { scenarioId?: string }
  if (!scenarioId) return NextResponse.json({ error: 'Falta scenarioId' }, { status: 400 })

  const admin = createAdminClient()
  const [{ data: assetRow }, { data: scenario }] = await Promise.all([
    admin.from('urban_assets').select('*').eq('id', params.id).single(),
    admin.from('urban_scenarios').select('*').eq('id', scenarioId).eq('asset_id', params.id).single(),
  ])
  if (!assetRow || !scenario) return NextResponse.json({ error: 'Activo o escenario no encontrado' }, { status: 404 })
  const asset = assetRow as UrbanAsset

  await admin.from('urban_scenarios').update({ status: 'generando' }).eq('id', scenarioId)

  try {
    const [hitsRes, flagsRes, analysisRes] = await Promise.all([
      admin.from('urban_layer_hits').select('categoria, layer_name, attributes').eq('asset_id', params.id),
      admin.from('urban_red_flags').select('severidad, titulo, descripcion, recomendacion').eq('asset_id', params.id),
      admin.from('urban_analysis').select('kind, content').eq('asset_id', params.id),
    ])
    let nzRow: NormaZonal | null = null
    if (asset.norma_zonal) {
      const { data } = await admin.from('urban_normas_zonales').select('*')
        .in('codigo', [asset.norma_zonal, asset.norma_zonal.split('.')[0]])
      const rows = (data || []) as NormaZonal[]
      nzRow = rows.find((r) => r.codigo === asset.norma_zonal) || rows[0] || null
    }
    const edificabilidad = (analysisRes.data || []).find((a) => a.kind === 'edificabilidad')?.content as EdificabilidadResult | undefined
    const volumen = (analysisRes.data || []).find((a) => a.kind === 'volumen_capaz')?.content as Record<string, unknown> | undefined
    const lectura = (analysisRes.data || []).find((a) => a.kind === 'documentos_oficiales')?.content as Record<string, unknown> | undefined

    const contexto = buildContextoActivo({
      asset, nzRow,
      hits: (hitsRes.data || []) as never[],
      flags: (flagsRes.data || []) as never[],
      edificabilidad: edificabilidad ?? null,
      volumenCapaz: stripVolumenGeometrias(volumen ?? null),
      lecturaDocumentos: lectura ?? null,
    })

    const message = await anthropic.messages.create({
      model: IA_MODEL,
      max_tokens: 6000,
      thinking: { type: 'adaptive' },
      system: REGLAS_ANALISTA,
      messages: [{
        role: 'user',
        content: `Analiza la viabilidad de este ESCENARIO DE INVERSIÓN sobre el activo:

Escenario: ${scenario.nombre} (tipo: ${scenario.tipo})
${scenario.descripcion ? `Descripción del usuario: ${scenario.descripcion}` : ''}

DATOS DEL ACTIVO:
${contexto}

Separa siempre potencial urbanístico teórico / viabilidad jurídico-registral / viabilidad técnico-económica. Sé conservador: si un dato clave no está verificado, la viabilidad no puede ser "alta".

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (textos en español, sin markdown):
{
  "viabilidad_urbanistica": "alta|media|baja",
  "riesgo_patrimonial": "bajo|medio|alto",
  "riesgo_administrativo": "bajo|medio|alto",
  "analisis": "análisis razonado con etiquetas [OFICIAL]/[INFERIDO]/[HIPÓTESIS], separando las tres capas de viabilidad",
  "procedimiento_probable": "licencia / declaración responsable / consulta previa + informes sectoriales probables",
  "necesita_consulta_urbanistica": true,
  "superficie_potencial_m2": null,
  "unidades_potenciales": null,
  "documentacion_necesaria": ["..."],
  "red_flags": ["..."],
  "proximos_pasos": ["..."]
}
(superficie_potencial_m2 y unidades_potenciales: número o null si no puede estimarse con rigor)`,
      }],
    })

    const block = message.content.find((b) => b.type === 'text')
    const resultado = block && block.type === 'text' ? parseJsonRespuesta(block.text) : null
    if (!resultado) throw new Error('El modelo no devolvió un resultado válido.')

    await admin.from('urban_scenarios').update({
      resultado, status: 'completado', model: IA_MODEL,
    }).eq('id', scenarioId)

    return NextResponse.json({ ok: true, resultado })
  } catch (err) {
    console.error('[urban-analyst/escenario]', err)
    await admin.from('urban_scenarios').update({ status: 'error' }).eq('id', scenarioId)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando el escenario' },
      { status: 500 }
    )
  }
}
