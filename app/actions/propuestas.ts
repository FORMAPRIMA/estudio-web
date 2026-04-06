'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ServicioId } from '@/lib/propuestas/config'

const PATH = '/team/captacion/propuestas'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
  return user
}

export async function createPropuesta(
  contactoId?: string | null,
  source: 'lead' | 'cliente' = 'lead'
): Promise<{ id: string } | { error: string }> {
  try {
    const user  = await requirePartner()
    const admin = createAdminClient()

    const numero = 'BORRADOR'

    // Pre-fill from lead or cliente
    let contactoData: Record<string, string | null> = {}
    if (contactoId) {
      if (source === 'lead') {
        const { data: lead } = await admin
          .from('leads')
          .select('nombre, apellidos, empresa, email, direccion')
          .eq('id', contactoId)
          .single()
        if (lead) {
          contactoData = {
            lead_id:   contactoId,
            titulo:    lead.nombre ? `Proyecto ${[lead.nombre, lead.apellidos].filter(Boolean).join(' ')}` : null,
            // direccion is the PROJECT address — not auto-filled from contact's personal address
          }
        }
      } else {
        const { data: cliente } = await admin
          .from('clientes')
          .select('nombre, apellidos, empresa, email, direccion')
          .eq('id', contactoId)
          .single()
        if (cliente) {
          contactoData = {
            cliente_id: contactoId,
            titulo:     cliente.nombre ? `Proyecto ${[cliente.nombre, cliente.apellidos].filter(Boolean).join(' ')}` : null,
            // direccion is the PROJECT address — not auto-filled from contact's personal address
          }
        }
      }
    }

    const { data, error } = await admin
      .from('propuestas')
      .insert({
        numero,
        status:         'borrador',
        servicios:      [],
        pct_junior:     70,
        pct_senior:     0,
        pct_partner:    30,
        porcentaje_pem: 10,
        semanas:        {},
        created_by:     user.id,
        ...contactoData,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updatePropuesta(
  id: string,
  data: Partial<{
    lead_id:           string | null
    cliente_id:        string | null
    titulo:            string | null
    direccion:         string | null
    fecha_propuesta:   string
    m2_diseno:         number | null
    costo_m2_objetivo: number | null
    porcentaje_pem:    number
    servicios:         ServicioId[]
    pct_junior:        number
    pct_senior:        number
    pct_partner:       number
    semanas:              Record<string, string>
    notas:                string | null
    status:               string
    fecha_envio:          string | null
    honorarios_override:  Record<string, number>
    entregables_override: Record<string, { grupo: string; items: string[] }[]>
  }>
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    // Si aún no tiene número real, asignarlo ahora (primer guardado)
    const { data: current } = await admin
      .from('propuestas').select('numero').eq('id', id).single()

    let extraFields: Record<string, string> = {}
    if (current?.numero === 'BORRADOR') {
      const year = new Date().getFullYear()
      const { data: lastRow } = await admin
        .from('propuestas')
        .select('numero')
        .ilike('numero', `P-${year}-%`)
        .order('numero', { ascending: false })
        .limit(1)
        .maybeSingle()
      const lastN = lastRow?.numero ? parseInt(lastRow.numero.split('-')[2] ?? '0', 10) : 0
      extraFields = { numero: `P-${year}-${String(lastN + 1).padStart(3, '0')}` }
    }

    const { error } = await admin.from('propuestas').update({ ...data, ...extraFields }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    revalidatePath(`${PATH}/${id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deletePropuesta(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('propuestas').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
