import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import WarehousePage from '@/components/team/memorias-calidad/WarehousePage'
import { normalizarWarehouseItem } from '@/lib/memorias/domain'
import type { Capitulo, Favorito, Proveedor, Subcapitulo } from '@/lib/memorias/domain'

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

export default async function MemoriasCalidadWarehousePage() {
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

  const [capitulosRes, subcapitulosRes, itemsRes, favoritosRes, proveedoresRes] = await Promise.all([
    admin.from('presupuesto_capitulos').select('*').eq('activo', true).order('orden', { ascending: true }),
    admin.from('presupuesto_subcapitulos').select('*').eq('activo', true).order('orden', { ascending: true }),
    admin.from('warehouse_items').select('*').eq('activo', true).order('created_at', { ascending: false }),
    admin.from('warehouse_favoritos').select('subcapitulo_id, nivel_calidad, item_id'),
    admin.from('proveedores').select('id, nombre').order('nombre', { ascending: true }),
  ])

  // Hasta que se ejecute memorias_calidad_v2.sql, la pantalla avisa en lugar de romperse
  const migracionPendiente = !!capitulosRes.error || (capitulosRes.data ?? []).length === 0

  return (
    <WarehousePage
      capitulos={(capitulosRes.data ?? []) as Capitulo[]}
      subcapitulos={(subcapitulosRes.data ?? []) as Subcapitulo[]}
      items={(itemsRes.data ?? []).map(normalizarWarehouseItem)}
      favoritos={(favoritosRes.data ?? []) as Favorito[]}
      proveedores={(proveedoresRes.data ?? []) as Proveedor[]}
      migracionPendiente={migracionPendiente}
    />
  )
}
