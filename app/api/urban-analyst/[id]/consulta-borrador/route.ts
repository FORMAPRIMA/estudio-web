import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { buildContextoActivo, stripVolumenGeometrias, parseJsonRespuesta, IA_MODEL, REGLAS_ANALISTA } from '@/lib/urban-analyst/iaContext'
import type { ConsultaUrbanisticaData } from '@/components/pdfs/ConsultaUrbanisticaPDF'
import type { UrbanAsset, NormaZonal, EdificabilidadResult, UrbanDocument } from '@/lib/urban-analyst/types'

// Genera el BORRADOR de consulta urbanística especial en PDF: la IA redacta
// antecedentes (con fuente) y cuestiones concretas a partir del análisis, y el
// documento sale listo para revisión del técnico antes de presentarse.

export const maxDuration = 180
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { matices } = (await req.json().catch(() => ({}))) as { matices?: string }

    const admin = createAdminClient()
    const { data: assetRow } = await admin.from('urban_assets').select('*').eq('id', params.id).single()
    if (!assetRow) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })
    const asset = assetRow as UrbanAsset

    const [hitsRes, flagsRes, analysisRes, docsRes] = await Promise.all([
      admin.from('urban_layer_hits').select('categoria, layer_name, attributes').eq('asset_id', params.id),
      admin.from('urban_red_flags').select('severidad, titulo, descripcion, recomendacion').eq('asset_id', params.id),
      admin.from('urban_analysis').select('kind, content').eq('asset_id', params.id),
      admin.from('urban_documents').select('*').eq('asset_id', params.id),
    ])

    let nzRow: NormaZonal | null = null
    if (asset.norma_zonal) {
      const { data } = await admin.from('urban_normas_zonales').select('*')
        .in('codigo', [asset.norma_zonal, asset.norma_zonal.split('.')[0]])
      const rows = (data || []) as NormaZonal[]
      nzRow = rows.find((r) => r.codigo === asset.norma_zonal) || rows[0] || null
    }
    const analysis = analysisRes.data || []
    const contexto = buildContextoActivo({
      asset, nzRow,
      hits: (hitsRes.data || []) as never[],
      flags: (flagsRes.data || []) as never[],
      edificabilidad: (analysis.find((a) => a.kind === 'edificabilidad')?.content as EdificabilidadResult | undefined) ?? null,
      volumenCapaz: stripVolumenGeometrias(analysis.find((a) => a.kind === 'volumen_capaz')?.content as Record<string, unknown> | undefined ?? null),
      lecturaDocumentos: (analysis.find((a) => a.kind === 'documentos_oficiales')?.content as Record<string, unknown> | undefined) ?? null,
      documentos: (docsRes.data || []) as UrbanDocument[],
    })

    // La IA redacta antecedentes y cuestiones (formales, concretas, con fuente)
    const message = await anthropic.messages.create({
      model: IA_MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system: REGLAS_ANALISTA,
      messages: [{
        role: 'user',
        content: `Redacta el contenido de un BORRADOR de consulta urbanística especial (Ordenanza 6/2022 del Ayto. de Madrid) para este activo. Registro formal administrativo, frases completas, sin markdown.

${contexto}
${matices ? `\nMATICES DEL SOLICITANTE (incorpóralos a las cuestiones si procede): ${matices}` : ''}

Los ANTECEDENTES deben ser hechos comprobables con su origen (Catastro, plano CE, catálogo...), no opiniones. Las CUESTIONES deben ser las preguntas cuya respuesta administrativa desbloquea la decisión de inversión (edificabilidad materializable, régimen de obras según protección, compatibilidad del uso pretendido, procedimiento aplicable...): concretas, numerables y respondibles por la administración. Máximo 6 cuestiones, prioriza las que condicionan la oferta.

Responde ÚNICAMENTE con JSON válido:
{
  "antecedentes": ["hecho 1 (fuente)", "..."],
  "cuestiones": ["cuestión concreta 1", "..."],
  "documentacion_anexa": ["plano catastral...", "..."]
}`,
      }],
    })

    const block = message.content.find((b) => b.type === 'text')
    const redaccion = block && block.type === 'text' ? parseJsonRespuesta(block.text) : null
    if (!redaccion || !Array.isArray(redaccion.cuestiones)) {
      throw new Error('No se pudo redactar el borrador.')
    }

    const fecha = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    const data: ConsultaUrbanisticaData = {
      fecha,
      solicitante: {
        nombre: 'GEINEX GROUP, S.L.',
        nif: 'B44873552',
        direccion: 'CL/ Ppe de Vergara 56 6ª 2ª · 28006 Madrid',
        email: 'contacto@formaprima.es',
      },
      inmueble: {
        direccion: asset.direccion,
        refcat: asset.refcat,
        normaZonal: asset.norma_zonal ? `${asset.norma_zonal}${asset.norma_zonal_denominacion ? ` — ${asset.norma_zonal_denominacion}` : ''}` : null,
        superficieParcela: asset.parcel_area,
        superficieConstruida: asset.built_area,
      },
      antecedentes: (redaccion.antecedentes as string[]) || [],
      cuestiones: redaccion.cuestiones as string[],
      documentacionAnexa: (redaccion.documentacion_anexa as string[]) || [],
    }

    const reactPdf = await import('@react-pdf/renderer')
    const { buildConsultaUrbanisticaElement } = await import('@/components/pdfs/ConsultaUrbanisticaPDF')
    const element = buildConsultaUrbanisticaElement(reactPdf, data)
    const buffer = await reactPdf.renderToBuffer(element)

    const filename = `Borrador_Consulta_Urbanistica_${(asset.nombre || 'activo').replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[urban-analyst/consulta-borrador]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando el borrador' },
      { status: 500 }
    )
  }
}
