import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import WarehousePage from '@/components/team/memorias-calidad/WarehousePage'

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

  const [
    { data: chapters },
    { data: items },
    { data: proveedores },
  ] = await Promise.all([
    admin
      .from('fpe_template_chapters')
      .select(`
        id, nombre, descripcion, orden, activo,
        units:fpe_template_units (
          id, chapter_id, nombre, descripcion, orden, activo,
          line_items:fpe_template_line_items (
            id, unit_id, nombre, descripcion, unidad_medida, orden, activo
          )
        )
      `)
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('orden', { referencedTable: 'fpe_template_units', ascending: true })
      .order('orden', { referencedTable: 'fpe_template_units.fpe_template_line_items', ascending: true }),

    admin
      .from('warehouse_items')
      .select('*')
      .eq('activo', true)
      .order('nivel_calidad', { ascending: true })
      .order('marca', { ascending: true, nullsFirst: true })
      .order('nombre', { ascending: true }),

    admin
      .from('proveedores')
      .select('id, nombre')
      .order('nombre', { ascending: true }),
  ])

  return (
    <WarehousePage
      initialChapters={(chapters ?? []) as Parameters<typeof WarehousePage>[0]['initialChapters']}
      initialItems={(items ?? []) as Parameters<typeof WarehousePage>[0]['initialItems']}
      proveedores={(proveedores ?? []) as Parameters<typeof WarehousePage>[0]['proveedores']}
    />
  )
}
