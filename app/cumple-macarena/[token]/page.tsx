import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import InvitacionClient from './InvitacionClient'

export default async function InvitacionPage({
  params,
}: {
  params: { token: string }
}) {
  const admin = createAdminClient()

  const { data: invitado } = await admin
    .from('cumple_invitados')
    .select('id, nombre, token')
    .eq('token', params.token)
    .single()

  if (!invitado) notFound()

  const { data: rsvp } = await admin
    .from('cumple_rsvp')
    .select('asiste, menu_opcion')
    .eq('invitado_id', invitado.id)
    .maybeSingle()

  return (
    <InvitacionClient
      token={invitado.token}
      nombre={invitado.nombre}
      existingRsvp={rsvp ?? null}
    />
  )
}
