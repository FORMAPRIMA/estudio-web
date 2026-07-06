import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isFpRole } from '@/lib/types'
import { periodFilter } from '@/lib/gastos/period'
import ScannerPage from '@/components/team/finanzas/ScannerPage'

export const metadata = { title: 'Gastos y facturas · Forma Prima' }
export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: { year?: string; month?: string; quarter?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !isFpRole(profile.rol)) redirect('/team/dashboard')

  const isPartner = profile.rol === 'fp_partner'
  const admin = createAdminClient()
  const now = new Date()
  const year  = searchParams.year  ? parseInt(searchParams.year,  10) : now.getFullYear()
  const month = searchParams.month ? parseInt(searchParams.month, 10) : now.getMonth() + 1
  // Modo trimestre cuando llega ?quarter; si no, mes.
  const quarter = searchParams.quarter ? parseInt(searchParams.quarter, 10) : null

  const { data: proyectos } = await admin
    .from('proyectos')
    .select('id, nombre, codigo')
    .eq('status', 'activo')
    .order('nombre')

  if (!isPartner) {
    // Modo personal: drop-off + solo los gastos subidos por el propio usuario
    const { data: ownScans } = await admin
      .from('expense_scans')
      .select('*, autor:profiles!user_id(nombre)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    return (
      <ScannerPage
        mode="personal"
        initialScans={(ownScans ?? []) as any}
        proyectos={(proyectos ?? []) as any}
        initialYear={year}
        initialMonth={month}
      />
    )
  }

  // Filtra por fecha_ticket dentro del período (mes o trimestre); para gastos
  // sin fecha de ticket cae a created_at.
  const { data: scans } = await admin
    .from('expense_scans')
    .select('*, autor:profiles!user_id(nombre)')
    .or(periodFilter(quarter ? { year, quarter } : { year, month }))
    .order('fecha_ticket', { ascending: false, nullsFirst: false })
    .order('created_at',   { ascending: false })

  // En modo trimestre el navegador de mes se ancla al primer mes del trimestre.
  const effectiveMonth = quarter ? (quarter - 1) * 3 + 1 : month

  return (
    <ScannerPage
      key={quarter ? `${year}-Q${quarter}` : `${year}-${month}`}
      mode="partner"
      initialScans={(scans ?? []) as any}
      proyectos={(proyectos ?? []) as any}
      initialYear={year}
      initialMonth={effectiveMonth}
      initialQuarter={quarter}
    />
  )
}
