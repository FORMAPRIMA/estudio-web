import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TRIMESTRE_ACTUAL, trimestreValido } from '@/lib/revision-gestoria/server'

export const metadata = { title: 'Revisión gestoría' }
export const dynamic = 'force-dynamic'

// La app es un HTML autocontenido (ver lib/revision-gestoria/server.ts): se monta en un
// iframe del mismo origen para que conserve sus estilos y sus rutas relativas.
export default async function Page({ searchParams }: { searchParams: { t?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/apps')

  const trimestre = searchParams.t && trimestreValido(searchParams.t) ? searchParams.t : TRIMESTRE_ACTUAL
  return (
    <iframe
      src={`/api/revision-gestoria/${trimestre}/app`}
      title="Revisión gestoría"
      style={{ display: 'block', width: '100%', height: '100vh', border: 0, background: '#fff' }}
    />
  )
}
