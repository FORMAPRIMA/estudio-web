'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PATH = '/team/captacion/leads'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
}

export async function addLead(): Promise<{ id: string } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('leads')
      .insert({ nombre: 'Nuevo lead' })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateLead(
  id: string,
  data: {
    nombre?:                string
    apellidos?:             string | null
    email?:                 string | null
    email_cc?:              string | null
    telefono?:              string | null
    telefono_alt?:          string | null
    empresa?:               string | null
    nif_cif?:               string | null
    documento_identidad?:   string | null
    direccion?:             string | null
    ciudad?:                string | null
    codigo_postal?:         string | null
    pais?:                  string | null
    direccion_facturacion?: string | null
    notas_facturacion?:     string | null
    tipo_facturacion?:      string | null
    notas?:                 string | null
    fecha_nacimiento?:      string | null
    // Lead-specific
    origen?:                string | null
    estado_lead?:           string | null
    interes?:               string | null
    presupuesto_estimado?:  number | null
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('leads').update(data).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteLead(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('leads').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
