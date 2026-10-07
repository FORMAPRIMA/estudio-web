import { requireEquipoPagina } from '@/lib/recorrido/guard'
import { leerDetalles, leerPlano } from '@/lib/recorrido/data'
import Captura from '@/components/recorrido/Captura'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const yo = await requireEquipoPagina('/recorrido')
  const [detalles, plano] = await Promise.all([leerDetalles(), leerPlano()])
  return <Captura inicial={detalles} plano={plano} usuario={yo.nombre} />
}
