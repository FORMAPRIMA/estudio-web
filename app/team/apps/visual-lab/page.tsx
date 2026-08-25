import { requireFP } from '@/lib/visual-lab/guard'
import PortafolioPage from '@/components/team/visual-lab/PortafolioPage'

export const metadata = { title: 'FP Visual Lab' }

export default async function VisualLabRoute() {
  await requireFP()
  return <PortafolioPage />
}
