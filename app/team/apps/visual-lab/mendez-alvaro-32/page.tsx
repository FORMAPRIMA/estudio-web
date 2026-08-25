import { requireFP } from '@/lib/visual-lab/guard'
import MendezPage from '@/components/team/visual-lab/MendezPage'

export const metadata = { title: 'Méndez Álvaro 32 — FP Visual Lab' }

export default async function MendezRoute() {
  await requireFP()
  return <MendezPage />
}
