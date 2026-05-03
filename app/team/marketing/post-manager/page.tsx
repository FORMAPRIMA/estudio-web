import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMarketingPosts } from '@/app/actions/marketing-posts'
import { PostManagerPage } from '@/components/team/PostManagerPage'

export const metadata = { title: 'Post Manager' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol, nombre').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_biz_dev'].includes(profile.rol)) {
    redirect('/team/marketing')
  }

  const [instagramPosts, linkedinPosts] = await Promise.all([
    getMarketingPosts('instagram'),
    getMarketingPosts('linkedin'),
  ])

  return (
    <PostManagerPage
      instagramPosts={instagramPosts}
      linkedinPosts={linkedinPosts}
      currentUserId={user.id}
      currentUserRol={profile.rol}
      currentUserNombre={profile.nombre ?? ''}
    />
  )
}
