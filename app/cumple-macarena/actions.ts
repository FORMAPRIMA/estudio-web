'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'

export async function submitRsvpForm(
  nombreNino: string,
  asiste: boolean,
  menuOpcion: string | null,
) {
  if (!nombreNino.trim()) throw new Error('Nombre requerido')
  const admin = createAdminClient()
  const { error } = await admin.from('cumple_form_rsvp').insert({
    nombre_nino: nombreNino.trim(),
    asiste,
    menu_opcion: menuOpcion,
  })
  if (error) throw new Error('Error al guardar RSVP')
  revalidatePath('/cumple-macarena/admin')
}

export async function deleteFormRsvp(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('cumple_form_rsvp').delete().eq('id', id)
  if (error) throw new Error('Error al eliminar RSVP')
  revalidatePath('/cumple-macarena/admin')
}

export async function submitRsvp(
  token: string,
  asiste: boolean,
  menuOpcion: string | null,
  comentario: string | null,
) {
  const admin = createAdminClient()

  const { data: invitado, error: invErr } = await admin
    .from('cumple_invitados')
    .select('id')
    .eq('token', token)
    .single()

  if (invErr || !invitado) throw new Error('Invitación no encontrada')

  const { error } = await admin.from('cumple_rsvp').upsert(
    {
      invitado_id: invitado.id,
      asiste,
      menu_opcion: menuOpcion,
      comentario,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'invitado_id' },
  )

  if (error) throw new Error('Error al guardar RSVP')
  revalidatePath('/cumple-macarena/admin')
}

export async function createInvitado(nombre: string) {
  if (!nombre.trim()) throw new Error('Nombre requerido')
  const admin = createAdminClient()
  const token = randomBytes(6).toString('hex')

  const { error } = await admin
    .from('cumple_invitados')
    .insert({ nombre: nombre.trim(), token })

  if (error) throw new Error('Error al crear invitado')
  revalidatePath('/cumple-macarena/admin')
}

export async function deleteInvitado(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('cumple_invitados').delete().eq('id', id)
  if (error) throw new Error('Error al eliminar invitado')
  revalidatePath('/cumple-macarena/admin')
}
