import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AnteproyectoPage from '@/components/team/memorias-calidad/AnteproyectoPage'
import type { Capitulo, Subcapitulo, WarehouseItem } from '@/lib/memorias/domain'

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

export default async function MemoriaAnteproyectoRoute() {
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

  const [proyectosRes, capitulosRes, subcapitulosRes, favoritosRes] = await Promise.all([
    admin
      .from('proyectos')
      .select('id, nombre, codigo, direccion, nivel_calidad')
      .in('status', ['activo', 'on_hold'])
      .order('nombre', { ascending: true }),
    admin.from('presupuesto_capitulos').select('*').eq('activo', true).order('orden', { ascending: true }),
    admin.from('presupuesto_subcapitulos').select('*').eq('activo', true).order('orden', { ascending: true }),
    admin.from('warehouse_items').select('*').eq('es_favorito', true).eq('activo', true),
  ])

  return (
    <AnteproyectoPage
      proyectos={proyectosRes.data ?? []}
      capitulos={(capitulosRes.data ?? []) as Capitulo[]}
      subcapitulos={(subcapitulosRes.data ?? []) as Subcapitulo[]}
      favoritos={(favoritosRes.data ?? []) as WarehouseItem[]}
    />
  )
}
