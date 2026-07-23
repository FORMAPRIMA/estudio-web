import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { candidatosLectura, downloadPdfBase64 } from '@/lib/urban-analyst/documentosOficiales'
import { parseJsonRespuesta, IA_MODEL, REGLAS_ANALISTA } from '@/lib/urban-analyst/iaContext'
import { computeCuadroUrbanistico, nzCandidatos, type CuadroHit, type CuadroUrbanistico } from '@/lib/urban-analyst/cuadroUrbanistico'
import type { UrbanAsset, UrbanLayerHit, UrbanDocument, NormaZonal } from '@/lib/urban-analyst/types'

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
  "impacto_en_analisis": ["qué dato del análisis previo se confirma, matiza o corrige"],
  "parametros_cuadro": [
    {
      "parametro": "edificabilidad|ocupacion|plantas_sobre|plantas_bajo|altura_cornisa|altura_maxima|retranqueo_frente|retranqueo_lateral|retranqueo_testero|altura_piso|altura_piso_pb|altura_libre|parcela_minima|usos",
      "valor": "texto legible del valor (con unidad)",
      "valor_num": 0.0,
      "documento": "nombre del documento del que sale",
      "detalle": "dónde se lee exactamente (plano/página/apartado)"
    }
  ]
}
Sobre "parametros_cuadro": SOLO parámetros urbanísticos NUMÉRICOS o de usos que se lean con claridad en los documentos y que apliquen a la parcela del activo (p. ej. edificabilidad de la ficha de un ámbito, plantas por tramo del plano CE, ocupación de una ficha de APE). valor_num en la unidad canónica: edificabilidad en m²c/m²s, ocupacion en %, plantas en nº, alturas y retranqueos en m, parcela_minima en m². Para "usos", valor_num = null. Si nada es legible con certeza, devuelve [].
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

    // ── Volcar los parámetros leídos al cuadro urbanístico ───────────────────
    // Cada valor extraído de una ficha/plano entra como figura adicional del
    // cuadro y participa en la resolución de la más restrictiva.
    try {
      const parametrosLeidos = Array.isArray(lectura.parametros_cuadro)
        ? (lectura.parametros_cuadro as { parametro?: string; valor?: string; valor_num?: number | null; documento?: string; detalle?: string }[])
        : []
      const clavesValidas = new Set([
        'edificabilidad','ocupacion','plantas_sobre','plantas_bajo','altura_cornisa','altura_maxima',
        'retranqueo_frente','retranqueo_lateral','retranqueo_testero','altura_piso','altura_piso_pb','altura_libre','parcela_minima','usos',
      ])
      const valoresExternos = parametrosLeidos
        .filter((p) => p.parametro && clavesValidas.has(p.parametro) && p.valor)
        .map((p) => ({
          parametro: p.parametro!,
          valor: {
            figura: `Lectura IA — ${p.documento || 'documento oficial'}`,
            valor: String(p.valor),
            valor_num: typeof p.valor_num === 'number' ? p.valor_num : null,
            tipo: 'inferido' as const,
            fuente: p.detalle || null,
          },
        }))

      const { data: cuadroRow } = await admin
        .from('urban_analysis').select('id, content').eq('asset_id', params.id).eq('kind', 'cuadro_urbanistico').maybeSingle()
      const cuadroPrevio = cuadroRow?.content as (CuadroUrbanistico & { area_movimiento?: unknown }) | undefined
      const snapshot = cuadroPrevio?.inputs_snapshot

      if (valoresExternos.length > 0 && snapshot) {
        const { data: hitsFull } = await admin
          .from('urban_layer_hits').select('categoria, service, layer_name, attributes').eq('asset_id', params.id)
        let nzRow: NormaZonal | null = null
        if (snapshot.normaZonal) {
          const candidatos = nzCandidatos(snapshot.normaZonal)
          const { data } = await admin.from('urban_normas_zonales').select('*').in('codigo', candidatos)
          const rows = (data || []) as NormaZonal[]
          nzRow = candidatos.map((c) => rows.find((r) => r.codigo === c)).find(Boolean) || null
        }
        const cuadro = computeCuadroUrbanistico({
          parcelArea: snapshot.parcelArea,
          builtArea: snapshot.builtArea,
          huellaM2: snapshot.huellaM2,
          plantasExistentes: snapshot.plantasExistentes,
          alturaExistenteM: snapshot.alturaExistenteM,
          usoCatastral: snapshot.usoCatastral,
          normaZonal: snapshot.normaZonal,
          normaZonalDenominacion: snapshot.normaZonalDenominacion,
          nzRow,
          plantasCondiciones: snapshot.plantasCondiciones,
          hits: (hitsFull || []) as CuadroHit[],
          valoresExternos,
        })
        cuadro.advertencias.push(
          `Cuadro recalculado incorporando ${valoresExternos.length} parámetro(s) leídos por IA de documentos oficiales (verificar contra el documento original).`
        )
        await admin.from('urban_analysis').delete().eq('asset_id', params.id).eq('kind', 'cuadro_urbanistico')
        await admin.from('urban_analysis').insert({
          asset_id: params.id, kind: 'cuadro_urbanistico',
          content: { ...cuadro, area_movimiento: cuadroPrevio?.area_movimiento ?? null },
          model: IA_MODEL,
        })
      }
    } catch (cuadroErr) {
      // La lectura ya está guardada: un fallo del recálculo no debe romperla
      console.error('[urban-analyst/leer-documentos/cuadro]', cuadroErr)
    }

    return NextResponse.json({ ok: true, resultado })
  } catch (err) {
    console.error('[urban-analyst/leer-documentos]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error leyendo documentos' },
      { status: 500 }
    )
  }
}
