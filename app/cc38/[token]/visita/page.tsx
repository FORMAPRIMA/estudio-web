import Invitado from '@/components/recorrido/Invitado'
import { datosInvitado } from '@/lib/recorrido/invitado'
import { tokenValido } from '@/lib/open-house/datos'

// La visita del invitado: a esta URL redirige su enlace personal el día del evento.

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { token: string } }) {
  const datos = await datosInvitado(tokenValido(params.token) ? params.token : '')
  return <Invitado {...datos} />
}
