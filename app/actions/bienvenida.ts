'use server'

// ── SQL Migration (run in Supabase SQL editor) ────────────────────────────────
//
// CREATE TABLE bienvenida_tokens (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
//   nombre_cliente text NOT NULL,
//   nota_interna text,
//   used boolean NOT NULL DEFAULT false,
//   created_at timestamptz NOT NULL DEFAULT now(),
//   created_by uuid REFERENCES auth.users(id)
// );
// ALTER TABLE bienvenida_tokens ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Partners can manage tokens" ON bienvenida_tokens FOR ALL TO authenticated USING (true);
//
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') throw new Error('Sin permisos.')
  return user
}

export async function createBienvenidaToken(
  nombreCliente: string,
  notaInterna: string
): Promise<{ token: string } | { error: string }> {
  try {
    const user = await requirePartner()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('bienvenida_tokens')
      .insert({
        nombre_cliente: nombreCliente.trim(),
        nota_interna: notaInterna.trim() || null,
        created_by: user.id,
      })
      .select('token')
      .single()
    if (error) return { error: error.message }
    revalidatePath('/team/captacion/leads')
    return { token: data.token as string }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function submitBienvenidaForm(
  token: string,
  formData: {
    nombre: string
    apellidos: string
    email: string
    telefono: string
    empresa?: string
    interes?: string
    notas?: string
  }
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()

    // 1. Fetch token row
    const { data: tokenRow, error: fetchError } = await admin
      .from('bienvenida_tokens')
      .select('id, used')
      .eq('token', token)
      .single()

    if (fetchError || !tokenRow) return { error: 'Este enlace no es válido.' }
    if (tokenRow.used) return { error: 'Este enlace ya ha sido utilizado.' }

    // 2. Insert lead
    const { error: leadError } = await admin
      .from('leads')
      .insert({
        nombre: formData.nombre.trim(),
        apellidos: formData.apellidos.trim() || null,
        email: formData.email.trim() || null,
        telefono: formData.telefono.trim() || null,
        empresa: formData.empresa?.trim() || null,
        interes: formData.interes?.trim() || null,
        notas: formData.notas?.trim() || null,
        origen: 'Formulario bienvenida',
        estado_lead: 'nuevo',
      })

    if (leadError) return { error: leadError.message }

    // 3. Mark token as used
    await admin
      .from('bienvenida_tokens')
      .update({ used: true })
      .eq('id', tokenRow.id)

    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

function parseDispositivo(ua: string): string {
  const isMobile  = /Mobile|Android|iPhone/i.test(ua)
  const isTablet  = /iPad|Tablet/i.test(ua)
  const device    = isTablet ? 'Tablet' : isMobile ? 'Móvil' : 'Escritorio'
  const browser   =
    /Edg\//i.test(ua)     ? 'Edge'    :
    /OPR\//i.test(ua)     ? 'Opera'   :
    /Chrome\//i.test(ua)  ? 'Chrome'  :
    /Firefox\//i.test(ua) ? 'Firefox' :
    /Safari\//i.test(ua)  ? 'Safari'  : 'Desconocido'
  return `${device} · ${browser}`
}

export async function registrarAccesoBienvenida(
  token: string,
  ip: string,
  ua: string,
): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: row } = await admin
      .from('bienvenida_tokens')
      .select('id, primer_acceso, num_accesos, accesos')
      .eq('token', token)
      .single()
    if (!row) return

    const now       = new Date().toISOString()
    const accesos   = (row.accesos as object[] | null) ?? []
    const entrada   = { ts: now, ip, dispositivo: parseDispositivo(ua) }

    await admin
      .from('bienvenida_tokens')
      .update({
        primer_acceso: row.primer_acceso ?? now,
        num_accesos:   ((row.num_accesos as number) ?? 0) + 1,
        accesos:       [...accesos, entrada],
      })
      .eq('id', row.id)
  } catch { /* swallow — non-blocking */ }
}

export async function getBienvenidaToken(token: string): Promise<{
  nombre_cliente: string
  nota_interna: string | null
  used: boolean
} | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('bienvenida_tokens')
      .select('nombre_cliente, nota_interna, used')
      .eq('token', token)
      .single()
    if (error || !data) return null
    return {
      nombre_cliente: data.nombre_cliente as string,
      nota_interna: data.nota_interna as string | null,
      used: data.used as boolean,
    }
  } catch {
    return null
  }
}
