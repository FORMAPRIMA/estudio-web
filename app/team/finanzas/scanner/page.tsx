import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ScannerPage from '@/components/team/finanzas/ScannerPage'

export const metadata = { title: 'Scanner de gastos · Finanzas' }
export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: { year?: string; month?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const admin = createAdminClient()
  const now = new Date()
  const year  = searchParams.year  ? parseInt(searchParams.year,  10) : now.getFullYear()
  const month = searchParams.month ? parseInt(searchParams.month, 10) : now.getMonth() + 1
  const from  = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to    = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  // Filter by fecha_ticket when available; fall back to created_at for scans with no ticket date
  const { data: scans } = await admin
    .from('expense_scans')
    .select('*, autor:profiles!user_id(nombre)')
    .or(`and(fecha_ticket.gte.${from},fecha_ticket.lte.${to}),and(fecha_ticket.is.null,created_at.gte.${from}T00:00:00,created_at.lte.${to}T23:59:59)`)
    .order('fecha_ticket', { ascending: false, nullsFirst: false })
    .order('created_at',   { ascending: false })

  const { data: proyectos } = await admin
    .from('proyectos')
    .select('id, nombre, codigo')
    .eq('status', 'activo')
    .order('nombre')

  return (
    <ScannerPage
      initialScans={(scans ?? []) as any}
      proyectos={(proyectos ?? []) as any}
      initialYear={year}
      initialMonth={month}
    />
  )
}
