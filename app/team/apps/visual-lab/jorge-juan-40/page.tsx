import { requireFP } from '@/lib/visual-lab/guard'
import JorgeJuanPage from '@/components/team/visual-lab/JorgeJuanPage'

export const metadata = { title: 'Jorge Juan 40 — FP Visual Lab' }

export default async function JorgeJuanRoute() {
  await requireFP()
  return <JorgeJuanPage />
}
