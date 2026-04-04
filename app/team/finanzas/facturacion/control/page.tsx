import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import FacturacionKanbanPage from '@/components/team/finanzas/FacturacionKanbanPage'

export const metadata = { title: 'Facturación por proyecto · Facturación' }

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const admin = createAdminClient()

  const [{ data: proyectos }, { data: facturas }] = await Promise.all([
    admin
      .from('proyectos')
      .select('id, nombre, codigo, imagen_url, status, clientes!cliente_id(id, nombre)')
      .order('created_at', { ascending: false }),
    admin
      .from('facturas')
      .select('proyecto_id, monto, status'),
  ])

  // Aggregate billing stats per project
  type BillingStats = {
    totalAcordado: number
    totalCobrado: number
    totalEnviada: number
    totalCobrable: number
    totalImpagada: number
    count: number
  }
  const statsMap = new Map<string, BillingStats>()

  for (const f of (facturas ?? [])) {
    const prev = statsMap.get(f.proyecto_id) ?? {
      totalAcordado: 0, totalCobrado: 0, totalEnviada: 0,
      totalCobrable: 0, totalImpagada: 0, count: 0,
    }
    statsMap.set(f.proyecto_id, {
      totalAcordado: prev.totalAcordado + f.monto,
      totalCobrado:  prev.totalCobrado  + (f.status === 'pagada'    ? f.monto : 0),
      totalEnviada:  prev.totalEnviada  + (f.status === 'enviada'   ? f.monto : 0),
      totalCobrable: prev.totalCobrable + (f.status === 'cobrable'  ? f.monto : 0),
      totalImpagada: prev.totalImpagada + (f.status === 'impagada'  ? f.monto : 0),
      count: prev.count + 1,
    })
  }

  const cards = (proyectos ?? []).map(p => {
    const s       = statsMap.get(p.id) ?? { totalAcordado: 0, totalCobrado: 0, totalEnviada: 0, totalCobrable: 0, totalImpagada: 0, count: 0 }
    const cliente = p.clientes as { nombre: string } | null
    return {
      id:            p.id,
      nombre:        p.nombre,
      codigo:        p.codigo    ?? null,
      imagen_url:    p.imagen_url ?? null,
      status:        p.status    as string,
      cliente:       cliente?.nombre ?? null,
      totalAcordado: s.totalAcordado,
      totalCobrado:  s.totalCobrado,
      totalEnviada:  s.totalEnviada,
      totalCobrable: s.totalCobrable,
      totalImpagada: s.totalImpagada,
      facturaCount:  s.count,
    }
  })

  return <FacturacionKanbanPage cards={cards} />
}
