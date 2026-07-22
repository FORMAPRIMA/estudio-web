import { redirect } from 'next/navigation'
import { Hanken_Grotesk } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { SiteProvider } from '@/components/public/site/SiteProvider'
import { SiteNav } from '@/components/public/site/SiteNav'
import { SiteCursor } from '@/components/public/site/SiteCursor'

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-hanken',
  display: 'swap',
})

export const metadata = { title: 'Forma Prima' }

// Sitio en STAGING: solo visible para el equipo FP logueado. El público sigue
// viendo el teaser /wip. En el go-live se moverá a las rutas reales y se retira
// este gate (ver memoria web_publica_rebuild, Fase 6).
const FP_ROLES = ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev']

export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/preview')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol)) redirect('/login?redirectTo=/preview')

  return (
    <div className={`${hanken.variable} fp-site`} style={{ minHeight: '100vh', background: '#F4F3F0' }}>
      <SiteProvider>
        <SiteCursor />
        <SiteNav />
        {children}
      </SiteProvider>
    </div>
  )
}
