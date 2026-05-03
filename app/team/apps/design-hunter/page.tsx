import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'
import { getDesignHunterEntries, getDesignHunterViajes } from '@/app/actions/design-hunter'
import DesignHunterPage from '@/components/team/design-hunter/DesignHunterPage'

export const metadata = { title: 'Design Hunter' }
export const dynamic = 'force-dynamic'

export default async function DesignHunterRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('id, rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  const [entries, viajes] = await Promise.all([
    getDesignHunterEntries(),
    getDesignHunterViajes(),
  ])

  return (
    <DesignHunterPage
      entries={entries}
      viajes={viajes}
      currentUserId={user.id}
    />
  )
}
