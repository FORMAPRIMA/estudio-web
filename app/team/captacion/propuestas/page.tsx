import { redirect } from 'next/navigation'

// La lista de propuestas se retiró: ahora viven como columna del tablero de Leads.
// El editor sigue en /team/captacion/propuestas/[id].
export default function Page() {
  redirect('/team/captacion/leads')
}
