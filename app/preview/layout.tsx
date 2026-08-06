import { redirect } from 'next/navigation'
import localFont from 'next/font/local'
import { createClient } from '@/lib/supabase/server'
import { SiteProvider } from '@/components/public/site/SiteProvider'
import { SiteNav } from '@/components/public/site/SiteNav'
import { SiteCursor } from '@/components/public/site/SiteCursor'
import { SiteEndMark } from '@/components/public/site/SiteEndMark'

// Helixa = tipografía de marca (brand book de Forma Prima), auto-alojada.
// Los .ttf del Drive se convirtieron a woff2 (~25 KB cada uno). Declaramos solo
// los 3 pesos que usa el sitio: 300 Light (displays), 400 Regular (texto),
// 700 Bold (micro-tipografía en versales; el 500/600 del CSS resuelve a estos).
const helixa = localFont({
  src: [
    { path: '../../public/fonts/Helixa-Light.woff2', weight: '300', style: 'normal' },
    { path: '../../public/fonts/Helixa-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Helixa-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-helixa',
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
    // position: relative para que el nav absoluto se ancle aquí, al tope del
    // documento, y no a un ancestro cualquiera.
    <div className={`${helixa.variable} fp-site`} style={{ position: 'relative', minHeight: '100vh', background: '#F4F3F0' }}>
      <SiteProvider>
        <SiteCursor />
        <SiteNav />
        {children}
        <SiteEndMark />
      </SiteProvider>
    </div>
  )
}
