import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import EjecucionPage from '@/components/team/memorias-calidad/EjecucionPage'
import { normalizarEstanciaItem, normalizarWarehouseItem } from '@/lib/memorias/domain'
import type {
  Capitulo,
  Estancia,
  Proveedor,
  ProyectoMemoria,
  Subcapitulo,
} from '@/lib/memorias/domain'

const ALLOWED_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

export default async function MemoriaEjecucionRoute({ params }: { params: { id: string } }) {
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

  const [proyectoRes, estanciasRes, capitulosRes, subcapitulosRes, warehouseRes, proveedoresRes] = await Promise.all([
    admin.from('proyectos').select('id, nombre, codigo, direccion, nivel_calidad, status').eq('id', params.id).single(),
    admin.from('memoria_estancias').select('id, proyecto_id, nombre, orden').eq('proyecto_id', params.id).order('orden', { ascending: true }),
    admin.from('presupuesto_capitulos').select('*').eq('activo', true).order('orden', { ascending: true }),
    admin.from('presupuesto_subcapitulos').select('*').eq('activo', true).order('orden', { ascending: true }),
    admin.from('warehouse_items').select('*').eq('activo', true).order('nombre', { ascending: true }),
    admin.from('proveedores').select('id, nombre').order('nombre', { ascending: true }),
  ])

  if (!proyectoRes.data) notFound()

  const estancias = (estanciasRes.data ?? []) as Estancia[]
  const estanciaIds = estancias.map(e => e.id)

  const { data: items } = estanciaIds.length > 0
    ? await admin
        .from('memoria_estancia_items')
        .select('*')
        .in('estancia_id', estanciaIds)
        .order('orden', { ascending: true })
    : { data: [] }

  return (
    <EjecucionPage
      proyecto={proyectoRes.data as ProyectoMemoria}
      estancias={estancias}
      items={(items ?? []).map(normalizarEstanciaItem)}
      capitulos={(capitulosRes.data ?? []) as Capitulo[]}
      subcapitulos={(subcapitulosRes.data ?? []) as Subcapitulo[]}
      warehouse={(warehouseRes.data ?? []).map(normalizarWarehouseItem)}
      proveedores={(proveedoresRes.data ?? []) as Proveedor[]}
    />
  )
}
