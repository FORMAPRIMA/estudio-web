import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MemoriaDetallePage from '@/components/team/memorias-calidad/MemoriaDetallePage'

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

export default async function MemoriaDetallePageRoute({ params }: { params: { id: string } }) {
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
    { data: proyecto },
    { data: memoriaItems },
    { data: chapters },
    { data: proveedores },
  ] = await Promise.all([
    admin
      .from('proyectos')
      .select('id, nombre, codigo, nivel_calidad, status')
      .eq('id', params.id)
      .single(),

    admin
      .from('proyecto_memoria_items')
      .select('*')
      .eq('proyecto_id', params.id)
      .eq('activo', true)
      .order('orden', { ascending: true }),

    admin
      .from('fpe_template_chapters')
      .select(`
        id, nombre, label_cliente, descripcion_cliente, imagen_portada_url, orden,
        units:fpe_template_units (
          id, chapter_id, nombre, label_cliente, descripcion_cliente, imagen_portada_url, orden,
          line_items:fpe_template_line_items (
            id, unit_id, nombre, orden
          )
        )
      `)
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('orden', { referencedTable: 'fpe_template_units', ascending: true })
      .order('orden', { referencedTable: 'fpe_template_units.fpe_template_line_items', ascending: true }),

    admin
      .from('proveedores')
      .select('id, nombre')
      .order('nombre', { ascending: true }),
  ])

  if (!proyecto) notFound()

  return (
    <MemoriaDetallePage
      proyecto={proyecto as Parameters<typeof MemoriaDetallePage>[0]['proyecto']}
      initialItems={(memoriaItems ?? []) as Parameters<typeof MemoriaDetallePage>[0]['initialItems']}
      chapters={(chapters ?? []) as Parameters<typeof MemoriaDetallePage>[0]['chapters']}
      proveedores={(proveedores ?? []) as Parameters<typeof MemoriaDetallePage>[0]['proveedores']}
    />
  )
}
