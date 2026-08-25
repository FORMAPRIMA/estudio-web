import { requireFP } from '@/lib/visual-lab/guard'
import DehesaPage from '@/components/team/visual-lab/DehesaPage'

export const metadata = { title: 'La Dehesa — FP Visual Lab' }

export default async function DehesaRoute() {
  await requireFP()
  return <DehesaPage />
}
