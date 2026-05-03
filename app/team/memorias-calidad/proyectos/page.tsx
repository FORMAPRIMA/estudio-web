import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MemoriaProyectosPage from '@/components/team/memorias-calidad/MemoriaProyectosPage'

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

export default async function MemoriaProyectosListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!profile || !ALLOWED_ROLES.includes(profile.rol)) redirect('/team/dashboard')

  const admin = createAdminClient()

  const { data: proyectos } = await admin
    .from('proyectos')
    .select('id, nombre, codigo, nivel_calidad, status')
    .not('nivel_calidad', 'is', null)
    .in('status', ['activo', 'on_hold'])
    .order('nombre', { ascending: true })

  // Fetch item counts per project
  const ids = (proyectos ?? []).map(p => p.id)
  const { data: counts } = ids.length > 0
    ? await admin
        .from('proyecto_memoria_items')
        .select('proyecto_id')
        .in('proyecto_id', ids)
        .eq('activo', true)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const row of counts ?? []) {
    countMap[row.proyecto_id] = (countMap[row.proyecto_id] ?? 0) + 1
  }

  return (
    <MemoriaProyectosPage
      proyectos={(proyectos ?? []).map(p => ({ ...p, item_count: countMap[p.id] ?? 0 }))}
    />
  )
}
