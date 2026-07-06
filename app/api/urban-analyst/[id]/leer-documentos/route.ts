import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { candidatosLectura, downloadPdfBase64 } from '@/lib/urban-analyst/documentosOficiales'
import { parseJsonRespuesta, IA_MODEL, REGLAS_ANALISTA } from '@/lib/urban-analyst/iaContext'
import type { UrbanAsset, UrbanLayerHit, UrbanDocument } from '@/lib/urban-analyst/types'

// Lee con visión (Claude) los documentos oficiales del activo: plano de
// Condiciones de Edificación, ficha de catálogo y PDFs aportados (nota simple,
// dossier...). Extrae parámetros al análisis con trazabilidad de fuente.

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_DOCS = 3

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || ['fp_partner','fp_manager'].indexOf(profile.rol) === -1) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient()
  const [{ data: assetRow }, { data: hitsRows }, { data: docsRows }] = await Promise.all([
    admin.from('urban_assets').select('*').eq('id', params.id).single(),
    admin.from('urban_layer_hits').select('service, layer_name, attributes').eq('asset_id', params.id),
    admin.from('urban_documents').select('nombre, tipo, file_url').eq('asset_id', params.id),
  ])
  if (!assetRow) return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })
  const asset = assetRow as UrbanAsset

  const candidatos = candidatosLectura(
    (hitsRows || []) as UrbanLayerHit[],
    (docsRows || []) as UrbanDocument[]
  )
  if (candidatos.length === 0) {
    return NextResponse.json({ error: 'No hay documentos oficiales detectados ni PDFs aportados para este activo.' }, { status: 404 })
  }

  try {
    // Descarga (máx. 3 documentos por lectura, oficiales primero)
    const ordenados = [...candidatos].sort((a, b) =>
      (a.tipo === 'aportado' ? 1 : 0) - (b.tipo === 'aportado' ? 1 : 0)
    ).slice(0, MAX_DOCS)

    const descargados: { doc: typeof ordenados[number]; base64: string }[] = []
    const fallidos: string[] = []
    for (const doc of ordenados) {
      const pdf = await downloadPdfBase64(doc.url)
      if (pdf) descargados.push({ doc, base64: pdf.base64 })
      else fallidos.push(doc.nombre)
    }
    if (descargados.length === 0) {
      return NextResponse.json({ error: `No se pudo descargar ningún documento (${fallidos.join(', ')}).` }, { status: 502 })
    }

    // Bloques de contenido: cada PDF como document block + instrucción final
    const content: Anthropic.ContentBlockParam[] = []
    descargados.forEach(({ doc, base64 }) => {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        title: doc.nombre,
      } as Anthropic.ContentBlockParam)
    })
    content.push({
      type: 'text',
      text: `Estás leyendo ${descargados.length} documento(s) del activo "${asset.nombre}" (${asset.direccion || ''}, referencia catastral ${asset.refcat || 's/d'}, Norma Zonal ${asset.norma_zonal || 's/d'}).

Documentos adjuntos:
${descargados.map((d, i) => `${i + 1}. ${d.doc.nombre} — ${d.doc.fuente}`).join('\n')}

Para cada documento, extrae SOLO lo que realmente se lee en él (no completes con conocimiento general):
- Si es un PLANO de Condiciones de Edificación: localiza la manzana/parcela del activo (por la dirección y trama urbana) y extrae fondos, alturas/plantas por tramo, y cualquier grafismo aplicable. Si no puedes identificar la parcela con certeza en el plano, dilo.
- Si es una FICHA de catálogo: nivel y grado de protección, elementos protegidos, obras admisibles, condiciones particulares.
- Si es una NOTA SIMPLE o documento registral: titularidad, superficies declaradas, cargas, división horizontal, menciones al vuelo.
- Si es un dossier/tasación: superficies y datos relevantes que contrasten con Catastro.

Responde ÚNICAMENTE con JSON válido:
{
  "documentos": [
    {
      "nombre": "...",
      "legible": true,
      "hallazgos": ["hallazgo textual concreto 1", "..."],
      "parametros": { "plantas_por_tramo": null, "fondo_m": null, "nivel_proteccion": null, "grado": null, "otros": null },
      "contradicciones_con_datos_previos": ["..."],
      "advertencias": ["..."]
    }
  ],
  "sintesis": "2-4 frases: qué aportan estos documentos al análisis del activo",
  "impacto_en_analisis": ["qué dato del análisis previo se confirma, matiza o corrige"]
}
Reglas: lo extraído de un plano/ficha oficial se etiqueta como lectura visual [INFERIDO de documento oficial]; si la resolución no permite leer algo, decláralo en advertencias. No inventes valores.`,
    })

    const message = await anthropic.messages.create({
      model: IA_MODEL,
      max_tokens: 6000,
      thinking: { type: 'adaptive' },
      system: REGLAS_ANALISTA,
      messages: [{ role: 'user', content }],
    })

    const block = message.content.find((b) => b.type === 'text')
    const lectura = block && block.type === 'text' ? parseJsonRespuesta(block.text) : null
    if (!lectura) throw new Error('La lectura de documentos no devolvió un resultado válido.')

    const resultado = {
      ...lectura,
      documentos_procesados: descargados.map((d) => ({ nombre: d.doc.nombre, url: d.doc.url, fuente: d.doc.fuente, tipo: d.doc.tipo })),
      documentos_fallidos: fallidos,
      leido_en: new Date().toISOString(),
    }

    await admin.from('urban_analysis').delete().eq('asset_id', params.id).eq('kind', 'documentos_oficiales')
    await admin.from('urban_analysis').insert({
      asset_id: params.id, kind: 'documentos_oficiales', content: resultado, model: IA_MODEL,
    })

    return NextResponse.json({ ok: true, resultado })
  } catch (err) {
    console.error('[urban-analyst/leer-documentos]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error leyendo documentos' },
      { status: 500 }
    )
  }
}
