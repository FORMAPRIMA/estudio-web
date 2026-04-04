'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PATH = '/team/proveedores'

async function requireManagerOrPartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol))
    throw new Error('Sin permisos.')
}

export async function createProveedor(data: {
  nombre: string
  tipo?: string | null
  contacto_nombre?: string | null
  email?: string | null
  email_cc?: string | null
  telefono?: string | null
  web?: string | null
  direccion?: string | null
  notas?: string | null
  nif_cif?: string | null
  razon_social?: string | null
  direccion_fiscal?: string | null
  iban?: string | null
  forma_pago?: string | null
  condiciones_pago?: string | null
}): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('proveedores')
      .insert(data)
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function addProveedor(): Promise<{ id: string } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('proveedores')
      .insert({ nombre: 'Nuevo proveedor' })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateProveedor(
  id: string,
  data: {
    nombre?:           string
    tipo?:             string | null
    contacto_nombre?:  string | null
    email?:            string | null
    email_cc?:         string | null
    telefono?:         string | null
    web?:              string | null
    direccion?:        string | null
    notas?:            string | null
    nif_cif?:          string | null
    razon_social?:     string | null
    direccion_fiscal?: string | null
    iban?:             string | null
    forma_pago?:       string | null
    condiciones_pago?: string | null
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('proveedores').update(data).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteProveedor(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requireManagerOrPartner()
    const admin = createAdminClient()
    const { error } = await admin.from('proveedores').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
