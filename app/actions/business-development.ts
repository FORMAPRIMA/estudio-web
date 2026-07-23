'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { SEED } from '@/lib/business-development/seed'
import type { BdCompany, BdWeeklyLogEntry, BusinessDevelopmentData } from '@/lib/business-development/types'

const PATH = '/team/captacion/business-development'
const LEADS_PATH = '/team/captacion/leads'

// Acceso: mismos roles que Captación (fp_partner, fp_manager, fp_biz_dev).
async function requireCaptacionRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_biz_dev'].includes(profile.rol)) {
    throw new Error('Sin permisos.')
  }
  return { userId: user.id }
}

// Lectura inicial del CRM. Fallback a SEED / defaults si la migración aún no está aplicada.
export async function getBusinessDevelopmentData(): Promise<BusinessDevelopmentData> {
  await requireCaptacionRole()
  const admin = createAdminClient()
  try {
    const [companiesRes, wlogRes, configRes] = await Promise.all([
      admin.from('bd_companies').select('data'),
      admin.from('bd_weekly_log').select('data').order('created_at', { ascending: false }),
      admin.from('bd_config').select('value').eq('key', 'rule').single(),
    ])
    if (companiesRes.error) throw companiesRes.error
    const companies = (companiesRes.data ?? []).map((r: any) => r.data as BdCompany)
    const wlog = (wlogRes.data ?? []).map((r: any) => r.data as BdWeeklyLogEntry)
    const ruleActive = (configRes.data?.value as any)?.ruleActive ?? true
    if (!companies.length) return { companies: SEED, wlog: [], config: { ruleActive } }
    return { companies, wlog, config: { ruleActive } }
  } catch {
    // Migración no aplicada todavía → funciona con los datos por defecto (no persiste).
    return { companies: SEED, wlog: [], config: { ruleActive: true } }
  }
}

// Upsert del conjunto de empresas (el componente reemplaza el array completo tras cada cambio;
// son ~58 filas, el coste es trivial y preserva la semántica original del CRM).
export async function saveCompanies(companies: BdCompany[]): Promise<{ ok: true } | { error: string }> {
  try {
    await requireCaptacionRole()
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const rows = companies.map((c) => ({ id: c.id, data: c, updated_at: now }))
    const { error } = await admin.from('bd_companies').upsert(rows, { onConflict: 'id' })
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Reemplaza el historial de Weekly Update (incluye borrados por "deshacer").
export async function replaceWeeklyLog(wlog: BdWeeklyLogEntry[]): Promise<{ ok: true } | { error: string }> {
  try {
    await requireCaptacionRole()
    const admin = createAdminClient()
    await admin.from('bd_weekly_log').delete().not('id', 'is', null)
    if (wlog.length) {
      const rows = wlog.map((w) => ({ id: w.id, data: w }))
      const { error } = await admin.from('bd_weekly_log').insert(rows)
      if (error) return { error: error.message }
    }
    revalidatePath(PATH)
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Persiste el toggle de la regla de elegibilidad (constructoras de Madrid).
export async function setRule(ruleActive: boolean): Promise<{ ok: true } | { error: string }> {
  try {
    await requireCaptacionRole()
    const admin = createAdminClient()
    const { error } = await admin.from('bd_config').upsert({ key: 'rule', value: { ruleActive } }, { onConflict: 'key' })
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Restaura los datos originales (SEED) — usado por Admin & Reglas. Devuelve las empresas
// para que el cliente actualice su estado sin cargar el SEED en el bundle del navegador.
export async function restoreSeed(): Promise<{ companies: BdCompany[] } | { error: string }> {
  try {
    await requireCaptacionRole()
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const rows = SEED.map((c) => ({ id: c.id, data: c, updated_at: now }))
    const { error } = await admin.from('bd_companies').upsert(rows, { onConflict: 'id' })
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { companies: JSON.parse(JSON.stringify(SEED)) as BdCompany[] }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Puente con Leads: crea un lead real a partir de un partner del CRM y lo enlaza.
export async function crearLeadDesdePartner(
  companyId: string,
): Promise<{ leadId: string; alreadyExisted?: boolean } | { error: string }> {
  try {
    await requireCaptacionRole()
    const admin = createAdminClient()

    const { data: row, error: readErr } = await admin
      .from('bd_companies').select('data').eq('id', companyId).single()
    if (readErr || !row) return { error: 'Empresa no encontrada.' }
    const c = row.data as BdCompany

    // No duplicar: si ya existe un lead enlazado a este partner, devolverlo.
    const { data: existing } = await admin
      .from('leads').select('id').eq('bd_company_id', companyId).maybeSingle()
    if (existing?.id) return { leadId: existing.id, alreadyExisted: true }

    const contacto = c.contacto || {}
    const hipotesis = c.fit?.hipotesisValor || c.research?.descripcion || ''
    const notas = [
      `Generado desde Business development — ${c.empresa} (${c.perfilPrincipal}).`,
      contacto.personaIntro ? `Introducción vía: ${contacto.personaIntro}.` : '',
      hipotesis ? `Hipótesis de valor: ${hipotesis}` : '',
    ].filter(Boolean).join('\n')

    const { data: lead, error: insErr } = await admin
      .from('leads')
      .insert({
        nombre: contacto.nombre || c.empresa,
        empresa: c.empresa,
        email: contacto.email || null,
        telefono: contacto.telefono || null,
        ciudad: c.ciudad || null,
        pais: c.pais || null,
        origen: 'Business development',
        estado_lead: 'nuevo',
        notas,
        bd_company_id: companyId,
      })
      .select('id')
      .single()
    if (insErr || !lead) return { error: insErr?.message || 'No se pudo crear el lead.' }

    // Marcar el partner con el lead generado.
    const updated = JSON.parse(JSON.stringify(c)) as BdCompany
    updated.pipeline = updated.pipeline || {}
    updated.pipeline.leadGeneradoId = lead.id
    updated.pipeline.historial = updated.pipeline.historial || []
    updated.pipeline.historial.unshift({
      date: new Date().toISOString().slice(0, 10),
      who: 'Sistema',
      text: 'Lead generado en Captación desde Business development.',
    })
    await admin.from('bd_companies').update({ data: updated, updated_at: new Date().toISOString() }).eq('id', companyId)

    revalidatePath(PATH)
    revalidatePath(LEADS_PATH)
    return { leadId: lead.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
