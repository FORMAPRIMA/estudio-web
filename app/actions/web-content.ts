'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { contentKey, type WebContent, type ContentMap, type ContentTipo } from '@/lib/web-publica'

const PATH = '/team/marketing/web-publica'

// Marketing: solo socios y biz dev gestionan la web pública.
async function requireMarketing() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_biz_dev'].includes(profile.rol)) throw new Error('Sin permisos.')
}

const SELECT = 'id, pagina, seccion, clave, tipo, valor_es, valor_en, mobile_override, valor_mobile_es, valor_mobile_en, updated_at'

function mapRow(r: any): WebContent {
  return {
    id:              r.id,
    pagina:          r.pagina,
    seccion:         r.seccion,
    clave:           r.clave,
    tipo:            (r.tipo ?? 'texto') as ContentTipo,
    valor_es:        r.valor_es ?? null,
    valor_en:        r.valor_en ?? null,
    mobile_override: r.mobile_override ?? false,
    valor_mobile_es: r.valor_mobile_es ?? null,
    valor_mobile_en: r.valor_mobile_en ?? null,
    updated_at:      r.updated_at,
  }
}

function toMap(rows: WebContent[]): ContentMap {
  const map: ContentMap = {}
  for (const r of rows) map[contentKey(r.seccion, r.clave)] = r
  return map
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/** Lectura pública para el sitio. Devuelve el contenido de una página como mapa. */
export async function getContent(pagina: string): Promise<ContentMap> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_content').select(SELECT).eq('pagina', pagina)
  if (error) {
    console.error('[web-content] getContent:', error.message)
    return {}
  }
  return toMap((data ?? []).map(mapRow))
}

/** Lectura para el editor (gated). Mismo shape que getContent. */
export async function getContentAdmin(pagina: string): Promise<ContentMap> {
  await requireMarketing()
  return getContentRaw(pagina)
}

async function getContentRaw(pagina: string): Promise<ContentMap> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('web_content').select(SELECT).eq('pagina', pagina)
  if (error) {
    console.error('[web-content] getContentRaw:', error.message)
    return {}
  }
  return toMap((data ?? []).map(mapRow))
}

// ── Mutación ───────────────────────────────────────────────────────────────

/**
 * Upsert de un bloque de contenido (por pagina+seccion+clave). Guarda solo los
 * campos presentes en `patch`. Revalida el editor y la página pública afectada.
 */
export async function upsertContent(
  pagina: string,
  seccion: string,
  clave: string,
  patch: {
    tipo?:            ContentTipo
    valor_es?:        string | null
    valor_en?:        string | null
    mobile_override?: boolean
    valor_mobile_es?: string | null
    valor_mobile_en?: string | null
  },
): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketing()
    const admin = createAdminClient()
    const row: Record<string, unknown> = { pagina, seccion, clave, updated_at: new Date().toISOString() }
    if (patch.tipo !== undefined)            row.tipo = patch.tipo
    if (patch.valor_es !== undefined)        row.valor_es = patch.valor_es
    if (patch.valor_en !== undefined)        row.valor_en = patch.valor_en
    if (patch.mobile_override !== undefined) row.mobile_override = patch.mobile_override
    if (patch.valor_mobile_es !== undefined) row.valor_mobile_es = patch.valor_mobile_es
    if (patch.valor_mobile_en !== undefined) row.valor_mobile_en = patch.valor_mobile_en

    const { error } = await admin
      .from('web_content')
      .upsert(row, { onConflict: 'pagina,seccion,clave' })
    if (error) return { error: error.message }

    revalidatePath(PATH)
    revalidatePath(pagina === 'home' ? '/' : `/${pagina.replace('_', '-')}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
