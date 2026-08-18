'use server'

// Modo Diseño — mutaciones que hace el Studio sobre los bloques del sitio.
//
// Guarda estilo (pasos sobre los tokens) y texto in-situ. Mismo guard que el CMS
// clásico: solo socios y biz dev. El estilo se escribe con merge sobre el jsonb
// para que dos ajustes seguidos (tamaño y luego tracking) no se pisen, y para que
// tocar móvil no borre lo que hay en escritorio.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  ESCALA_MAX, ESCALA_MIN,
  type BlockEstilo, type BlockEstiloPatch, type EstiloJson, type Locale, type Viewport,
} from '@/lib/web-publica'

const PATH_CMS = '/team/marketing/web-publica'

async function requireDesign() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_biz_dev'].includes(profile.rol)) throw new Error('Sin permisos.')
}

function revalidar(pagina: string) {
  revalidatePath(PATH_CMS)
  revalidatePath(`${PATH_CMS}/studio`)
  revalidatePath(pagina === 'home' ? '/preview' : `/preview/${pagina.replace('_', '-')}`)
}

/** Saneado: solo dejamos entrar valores del sistema de diseño, nunca CSS libre. */
function sanearEstilo(patch: BlockEstiloPatch): BlockEstilo {
  const out: BlockEstilo = {}
  if (patch.escala != null) {
    const n = Math.round(Number(patch.escala) || 0)
    out.escala = Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, n))
  }
  if (patch.tracking != null && ['tight', 'normal', 'wide', 'ultra'].includes(patch.tracking)) {
    out.tracking = patch.tracking
  }
  if (patch.peso != null && [300, 400, 700].includes(Number(patch.peso))) {
    out.peso = Number(patch.peso) as BlockEstilo['peso']
  }
  if (patch.align != null && ['left', 'center', 'right'].includes(patch.align)) {
    out.align = patch.align
  }
  return out
}

/**
 * Merge del estilo de un bloque en un viewport. `null` en un campo lo BORRA
 * (volver al token del sistema es un estado legítimo, no un valor más).
 */
export async function saveBlockEstilo(
  pagina: string,
  seccion: string,
  clave: string,
  viewport: Viewport,
  patch: BlockEstiloPatch,
  opts?: { reset?: boolean },
): Promise<{ success: true } | { error: string }> {
  try {
    await requireDesign()
    const admin = createAdminClient()

    const { data: row, error: readError } = await admin
      .from('web_content')
      .select('estilo')
      .eq('pagina', pagina).eq('seccion', seccion).eq('clave', clave)
      .maybeSingle()
    if (readError) {
      if (/column .*estilo/i.test(readError.message)) {
        return { error: 'Falta ejecutar la migración web_design.sql en Supabase.' }
      }
      return { error: readError.message }
    }

    const actual: EstiloJson = (row?.estilo && typeof row.estilo === 'object' ? row.estilo : {}) as EstiloJson
    const previo = (viewport === 'mobile' ? actual.mobile : actual.desktop) ?? {}
    const nuevo: BlockEstilo = opts?.reset ? {} : { ...previo, ...sanearEstilo(patch) }
    // Un campo puesto a undefined/null se elimina: el bloque vuelve al token.
    for (const k of Object.keys(patch) as (keyof BlockEstiloPatch)[]) {
      if (patch[k] === undefined || patch[k] === null) delete nuevo[k]
    }

    const estilo: EstiloJson = { ...actual, [viewport]: nuevo }
    const { error } = await admin
      .from('web_content')
      .upsert({ pagina, seccion, clave, estilo, updated_at: new Date().toISOString() },
        { onConflict: 'pagina,seccion,clave' })
    if (error) return { error: error.message }

    revalidar(pagina)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/**
 * Texto editado in-situ. En viewport móvil escribe el valor de móvil y ACTIVA el
 * override de ese bloque: si estás mirando el móvil y escribes, es porque quieres
 * que el móvil diga otra cosa.
 */
export async function saveBlockTexto(
  pagina: string,
  seccion: string,
  clave: string,
  locale: Locale,
  viewport: Viewport,
  valor: string,
): Promise<{ success: true } | { error: string }> {
  try {
    await requireDesign()
    const admin = createAdminClient()

    const row: Record<string, unknown> = {
      pagina, seccion, clave, updated_at: new Date().toISOString(),
    }
    if (viewport === 'mobile') {
      row.mobile_override = true
      row[locale === 'en' ? 'valor_mobile_en' : 'valor_mobile_es'] = valor
    } else {
      row[locale === 'en' ? 'valor_en' : 'valor_es'] = valor
    }

    const { error } = await admin
      .from('web_content').upsert(row, { onConflict: 'pagina,seccion,clave' })
    if (error) return { error: error.message }

    revalidar(pagina)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/** Enciende un interruptor del CMS desde el canvas (p. ej. mostrar el texto de portada). */
export async function setInterruptor(
  pagina: string,
  seccion: string,
  clave: string,
  valor: 'si' | 'no' | '',
): Promise<{ success: true } | { error: string }> {
  try {
    await requireDesign()
    const admin = createAdminClient()
    const { error } = await admin.from('web_content').upsert(
      { pagina, seccion, clave, valor_es: valor, updated_at: new Date().toISOString() },
      { onConflict: 'pagina,seccion,clave' },
    )
    if (error) return { error: error.message }
    revalidar(pagina)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
