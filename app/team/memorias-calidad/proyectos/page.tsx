import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MemoriaProyectosPage from '@/components/team/memorias-calidad/MemoriaProyectosPage'
import { ceilCent } from '@/lib/memorias/domain'

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
    .in('status', ['activo', 'on_hold'])
    .order('nombre', { ascending: true })

  const ids = (proyectos ?? []).map(p => p.id)

  const { data: estancias } = ids.length > 0
    ? await admin.from('memoria_estancias').select('id, proyecto_id').in('proyecto_id', ids)
    : { data: [] as { id: string; proyecto_id: string }[] }

  const estanciaIds = (estancias ?? []).map(e => e.id)
  const { data: items } = estanciaIds.length > 0
    ? await admin
        .from('memoria_estancia_items')
        .select('estancia_id, cantidad, precio_pvp')
        .in('estancia_id', estanciaIds)
    : { data: [] as { estancia_id: string; cantidad: number; precio_pvp: number | null }[] }

  const proyectoPorEstancia = new Map((estancias ?? []).map(e => [e.id, e.proyecto_id]))
  const resumen = new Map<string, { estancias: number; items: number; pvp: number }>()
  for (const e of estancias ?? []) {
    const actual = resumen.get(e.proyecto_id) ?? { estancias: 0, items: 0, pvp: 0 }
    actual.estancias += 1
    resumen.set(e.proyecto_id, actual)
  }
  for (const it of items ?? []) {
    const proyectoId = proyectoPorEstancia.get(it.estancia_id)
    if (!proyectoId) continue
    const actual = resumen.get(proyectoId) ?? { estancias: 0, items: 0, pvp: 0 }
    actual.items += 1
    actual.pvp += (it.precio_pvp ?? 0) * (it.cantidad ?? 0)
    resumen.set(proyectoId, actual)
  }

  return (
    <MemoriaProyectosPage
      proyectos={(proyectos ?? []).map(p => {
        const r = resumen.get(p.id)
        return {
          ...p,
          estancias_count: r?.estancias ?? 0,
          items_count: r?.items ?? 0,
          total_pvp: ceilCent(r?.pvp ?? 0),
        }
      })}
    />
  )
}
