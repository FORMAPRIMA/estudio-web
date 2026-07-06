import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { buildContextoActivo, stripVolumenGeometrias, IA_MODEL, REGLAS_ANALISTA } from '@/lib/urban-analyst/iaContext'
import type { UrbanAsset, NormaZonal, EdificabilidadResult, UrbanChatMessage } from '@/lib/urban-analyst/types'

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

  const { message } = (await req.json()) as { message?: string }
  if (!message?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

  const admin = createAdminClient()
  const { data: assetRow } = await admin.from('urban_assets').select('*').eq('id', params.id).single()
  if (!assetRow) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })
  const asset = assetRow as UrbanAsset

  // Contexto completo del activo (capas, flags, edificabilidad, memo, docs)
  const [hitsRes, flagsRes, analysisRes, docsRes, historyRes] = await Promise.all([
    admin.from('urban_layer_hits').select('categoria, layer_name, attributes').eq('asset_id', params.id),
    admin.from('urban_red_flags').select('severidad, titulo, descripcion, recomendacion').eq('asset_id', params.id),
    admin.from('urban_analysis').select('kind, content').eq('asset_id', params.id),
    admin.from('urban_documents').select('*').eq('asset_id', params.id),
    admin.from('urban_chat_messages').select('*').eq('asset_id', params.id).order('created_at').limit(40),
  ])

  let nzRow: NormaZonal | null = null
  if (asset.norma_zonal) {
    const { data } = await admin.from('urban_normas_zonales').select('*')
      .in('codigo', [asset.norma_zonal, asset.norma_zonal.split('.')[0]])
    const rows = (data || []) as NormaZonal[]
    nzRow = rows.find((r) => r.codigo === asset.norma_zonal) || rows[0] || null
  }

  const edificabilidad = (analysisRes.data || []).find((a) => a.kind === 'edificabilidad')?.content as EdificabilidadResult | undefined
  const memo = (analysisRes.data || []).find((a) => a.kind === 'memo')?.content
  const volumen = (analysisRes.data || []).find((a) => a.kind === 'volumen_capaz')?.content as Record<string, unknown> | undefined
  const lectura = (analysisRes.data || []).find((a) => a.kind === 'documentos_oficiales')?.content as Record<string, unknown> | undefined

  const contexto = buildContextoActivo({
    asset,
    nzRow,
    hits: (hitsRes.data || []) as never[],
    flags: (flagsRes.data || []) as never[],
    edificabilidad: edificabilidad ?? null,
    volumenCapaz: stripVolumenGeometrias(volumen ?? null),
    lecturaDocumentos: lectura ?? null,
    documentos: (docsRes.data || []) as never[],
  })

  const system = `${REGLAS_ANALISTA}

Estás en el chat del activo. Responde de forma directa y conversacional (sin JSON), citando la fuente de cada dato relevante y usando las etiquetas [OFICIAL]/[INFERIDO]/[HIPÓTESIS] cuando aportes datos. Si la pregunta requiere información que no está en el contexto, dilo claramente y explica cómo obtenerla (consulta urbanística común/especial, CONEX, nota simple, ficha de catálogo...).

CONTEXTO DEL ACTIVO (datos ya recopilados por el sistema):
${contexto}
${memo ? `\nFICHA DEL ANALISTA YA GENERADA:\n${JSON.stringify(memo)}` : ''}`

  const history = ((historyRes.data || []) as UrbanChatMessage[]).map((m) => ({
    role: m.role,
    content: m.content,
  }))

  try {
    const response = await anthropic.messages.create({
      model: IA_MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system,
      messages: [...history, { role: 'user' as const, content: message.trim() }],
    })

    const block = response.content.find((b) => b.type === 'text')
    const texto = block && block.type === 'text' ? block.text.trim() : ''
    if (!texto) return NextResponse.json({ error: 'Respuesta vacía del modelo' }, { status: 502 })

    await admin.from('urban_chat_messages').insert([
      { asset_id: params.id, role: 'user', content: message.trim() },
      { asset_id: params.id, role: 'assistant', content: texto },
    ])

    return NextResponse.json({ texto })
  } catch (err) {
    console.error('[urban-analyst/chat]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error en el chat' },
      { status: 500 }
    )
  }
}
