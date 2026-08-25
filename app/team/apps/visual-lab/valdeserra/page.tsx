import { requireFP } from '@/lib/visual-lab/guard'
import ValdeserraPage from '@/components/team/visual-lab/ValdeserraPage'

export const metadata = { title: 'Valdeserra — FP Visual Lab' }

export default async function ValdeserraRoute() {
  await requireFP()
  return <ValdeserraPage />
}
