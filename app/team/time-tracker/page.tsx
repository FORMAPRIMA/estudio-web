import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TimeTracker from '@/components/team/TimeTracker'

const FP_ROLES = ['fp_team', 'fp_manager', 'fp_partner']

export const metadata = { title: 'Time Tracker' }

export default async function TimeTrackerPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  if (!profile || !FP_ROLES.includes(profile.rol)) redirect('/login')

  return (
    <TimeTracker
      currentUserId={session.user.id}
      currentUserRole={profile.rol as 'fp_team' | 'fp_manager' | 'fp_partner'}
    />
  )
}
