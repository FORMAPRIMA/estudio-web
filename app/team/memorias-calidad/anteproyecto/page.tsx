import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AnteproyectoPage from '@/components/team/memorias-calidad/AnteproyectoPage'
import { normalizarWarehouseItem } from '@/lib/memorias/domain'
import type { Capitulo, Favorito, Subcapitulo } from '@/lib/memorias/domain'

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

  const [proyectosRes, capitulosRes, subcapitulosRes, favoritosRes, itemsRes] = await Promise.all([
    admin
      .from('proyectos')
      .select('id, nombre, codigo, direccion, nivel_calidad')
      .in('status', ['activo', 'on_hold'])
      .order('nombre', { ascending: true }),
    admin.from('presupuesto_capitulos').select('*').eq('activo', true).order('orden', { ascending: true }),
    admin.from('presupuesto_subcapitulos').select('*').eq('activo', true).order('orden', { ascending: true }),
    admin.from('warehouse_favoritos').select('subcapitulo_id, nivel_calidad, item_id'),
    admin.from('warehouse_items').select('*').eq('activo', true),
  ])

  return (
    <AnteproyectoPage
      proyectos={proyectosRes.data ?? []}
      capitulos={(capitulosRes.data ?? []) as Capitulo[]}
      subcapitulos={(subcapitulosRes.data ?? []) as Subcapitulo[]}
      favoritos={(favoritosRes.data ?? []) as Favorito[]}
      items={(itemsRes.data ?? []).map(normalizarWarehouseItem)}
    />
  )
}
