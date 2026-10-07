import { requireEquipoPagina } from '@/lib/recorrido/guard'
import { leerDetalles, leerPlano } from '@/lib/recorrido/data'
import Guia from '@/components/recorrido/Guia'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const yo = await requireEquipoPagina('/recorrido/guia')
  const [detalles, plano] = await Promise.all([leerDetalles(), leerPlano()])
  return <Guia inicial={detalles} plano={plano} yo={yo.nombre} />
}
