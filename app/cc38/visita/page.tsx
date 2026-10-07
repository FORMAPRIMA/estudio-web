import Invitado from '@/components/recorrido/Invitado'
import { datosInvitado } from '@/lib/recorrido/invitado'

// QR genérico impreso en el piso: para quien llega sin su invitación a mano.

export const dynamic = 'force-dynamic'

export default async function Page() {
  return <Invitado {...await datosInvitado('')} />
}
