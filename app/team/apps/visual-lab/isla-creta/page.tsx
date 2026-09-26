import { requireFP } from '@/lib/visual-lab/guard'
import IslaCretaPage from '@/components/team/visual-lab/IslaCretaPage'

export const metadata = { title: 'Isla Creta — FP Visual Lab' }

export default async function IslaCretaRoute() {
  await requireFP()
  return <IslaCretaPage />
}
