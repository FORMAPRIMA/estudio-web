// Resolución y descarga de documentos oficiales del activo.
//
// Guardrail: SOLO dominios oficiales (Ayto. de Madrid / Geoportal / Sede).
// Los documentos se detectan en los atributos de las capas ya intersectadas
// (p. ej. Planos_CE trae la URL directa del PDF del plano de Condiciones de
// Edificación; las capas de catálogo traen ENLACE cuando la ficha está
// digitalizada). Nunca se buscan documentos en fuentes no oficiales.

import type { UrbanLayerHit, UrbanDocument } from './types'

const DOMINIOS_OFICIALES = [
  'geoportal.madrid.es',
  'sede.madrid.es',
  'madrid.es',
  'munimadrid.es',
  'transparencia.madrid.es',
]

export interface DocumentoOficial {
  tipo: 'plano_ce' | 'ficha_catalogo' | 'documento_capa' | 'aportado'
  nombre: string
  url: string
  fuente: string
}

function esOficial(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return DOMINIOS_OFICIALES.some((d) => host === d || host.endsWith(`.${d}`))
  } catch {
    return false
  }
}

/** Detecta documentos oficiales en los atributos de las capas intersectadas. */
export function resolveDocumentosOficiales(hits: Pick<UrbanLayerHit, 'service' | 'layer_name' | 'attributes'>[]): DocumentoOficial[] {
  const docs: DocumentoOficial[] = []
  const seen = new Set<string>()

  for (const h of hits) {
    for (const [key, value] of Object.entries(h.attributes)) {
      if (typeof value !== 'string') continue
      const v = value.trim()
      if (!/^https?:\/\//i.test(v) || !/\.pdf(\?|$)/i.test(v)) continue
      if (!esOficial(v) || seen.has(v)) continue
      seen.add(v)

      const isPlanoCE = /PLANO_CE/i.test(key) || /\/CE\//i.test(v)
      const isFicha = /ENLACE|FICHA/i.test(key) && /PROTEGIDO|CATALOGO/i.test(h.service)
      docs.push({
        tipo: isPlanoCE ? 'plano_ce' : isFicha ? 'ficha_catalogo' : 'documento_capa',
        nombre: isPlanoCE
          ? `Plano de Condiciones de Edificación ${String(h.attributes.HOJA_CE || h.attributes.NOMBRE || '')}`.trim()
          : isFicha
            ? `Ficha de catálogo ${String(h.attributes.N_CATALOGO || h.attributes.CEP_TX_NUMCAT || '')}`.trim()
            : `${key} (${h.layer_name || h.service})`,
        url: v,
        fuente: `${h.service} · capa ${h.layer_name || '?'} (Geoportal Ayto. Madrid)`,
      })
    }
  }
  return docs
}

/** Descarga un PDF oficial (o aportado al bucket propio) con límite de tamaño. */
export async function downloadPdfBase64(url: string, maxBytes = 8 * 1024 * 1024): Promise<{ base64: string; bytes: number } | null> {
  const esBucketPropio = url.includes('.supabase.co/storage/')
  if (!esOficial(url) && !esBucketPropio) return null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 45000)
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!/pdf|octet-stream/i.test(contentType)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > maxBytes) return null
    return { base64: buf.toString('base64'), bytes: buf.length }
  } catch {
    return null
  }
}

/** Combina documentos detectados en capas + PDFs aportados por el usuario. */
export function candidatosLectura(
  hits: Pick<UrbanLayerHit, 'service' | 'layer_name' | 'attributes'>[],
  aportados: Pick<UrbanDocument, 'nombre' | 'tipo' | 'file_url'>[]
): DocumentoOficial[] {
  const oficiales = resolveDocumentosOficiales(hits)
  const propios: DocumentoOficial[] = aportados
    .filter((d) => /\.pdf(\?|$)/i.test(d.file_url))
    .map((d) => ({
      tipo: 'aportado' as const,
      nombre: `${d.nombre} (${d.tipo || 'documento aportado'})`,
      url: d.file_url,
      fuente: 'Documento aportado por el usuario',
    }))
  return [...oficiales, ...propios]
}
