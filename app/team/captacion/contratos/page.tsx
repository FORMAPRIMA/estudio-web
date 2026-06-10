import { redirect } from 'next/navigation'

// La lista de contratos se retiró: ahora viven como columna del tablero de Leads.
// El editor sigue en /team/captacion/contratos/[id].
export default function Page() {
  redirect('/team/captacion/leads')
}
