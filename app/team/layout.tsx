import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TeamSidebar from '@/components/team/TeamSidebar'
import RulerOverlay from '@/components/dev/RulerOverlay'

type FpRole = 'fp_team' | 'fp_manager' | 'fp_partner'
const FP_ROLES: FpRole[] = ['fp_team', 'fp_manager', 'fp_partner']

interface NavItem {
  href: string
  label: string
  isSubItem?: boolean
  isSection?: boolean
  isGroup?: boolean
  pinBottom?: boolean
}

const ALL_NAV: (NavItem & { roles: FpRole[] })[] = [
  {
    href: '/team/dashboard',
    label: 'Dashboard',
    roles: ['fp_team', 'fp_manager', 'fp_partner'],
  },
  {
    href: '/team/time-tracker',
    label: 'Time Tracker',
    roles: ['fp_team', 'fp_manager', 'fp_partner'],
  },
  {
    href: '/team/area-interna',
    label: 'Área Interna FP',
    roles: ['fp_team', 'fp_manager', 'fp_partner'],
    pinBottom: true,
  },
  // ── FP Execution ─────────────────────────────────────────────────────────
  { href: '/team/fp-execution', label: 'FP Execution', roles: ['fp_partner', 'fp_manager'] },
  { href: '/team/fp-execution/input', label: 'Input', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  { href: '/team/fp-execution/depot', label: 'Depot', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  { href: '/team/fp-execution/template', label: 'Template', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  { href: '/team/fp-execution/project', label: 'Project', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  { href: '/team/fp-execution/archive', label: 'Archive', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  { href: '/team/fp-execution/execution-partners', label: 'Execution Partners', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  // ──────────────────────────────────────────────────────────────────────────
  // ── Captación (group) ─────────────────────────────────────────────────────
  { href: '/team/captacion', label: 'Captación', roles: ['fp_partner', 'fp_manager'] },
  { href: '/team/captacion/leads', label: 'Leads', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  { href: '/team/captacion/propuestas', label: 'Propuestas', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  { href: '/team/captacion/contratos', label: 'Contratos', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  { href: '/team/captacion/plantilla-propuestas', label: 'Plantilla prop', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  // ──────────────────────────────────────────────────────────────────────────
  {
    href: '/team/proyectos',
    label: 'Proyectos',
    roles: ['fp_team', 'fp_manager', 'fp_partner'],
  },
  {
    href: '/team/review',
    label: 'Review',
    roles: ['fp_partner', 'fp_manager'],
    isSubItem: true,
  },
  {
    href: '/team/proyectos/plantilla',
    label: 'Plantilla',
    roles: ['fp_partner', 'fp_manager'],
    isSubItem: true,
  },
  {
    href: '/team/proyectos/ratios',
    label: 'Ratios objetivo',
    roles: ['fp_partner'],
    isSubItem: true,
  },
  // ── Finanzas (group) ─────────────────────────────────────────────────────
  { href: '/team/finanzas', label: 'Finanzas', roles: ['fp_partner'], isGroup: true },
  // ── Finanzas operativas ──────────────────────────────────────────────────
  { href: '', label: 'Finanzas por proyecto', roles: ['fp_partner'], isSection: true },
  { href: '/team/finanzas/operativas/proyectos', label: 'Análisis de proyectos', roles: ['fp_partner'], isSubItem: true },
  { href: '/team/finanzas/operativas/costes', label: 'Costes fijos', roles: ['fp_partner'], isSubItem: true },
  // ── Finanzas macro ───────────────────────────────────────────────────────
  { href: '', label: 'Finanzas generales', roles: ['fp_partner'], isSection: true },
  { href: '/team/finanzas/macro/costes', label: 'Costes fijos/variables', roles: ['fp_partner'], isSubItem: true },
  // ── Facturación: sección interna para fp_partner únicamente ─────────────
  { href: '', label: 'Facturación', roles: ['fp_partner'], isSection: true },
  { href: '/team/finanzas/facturacion/dashboard', label: 'Dashboard general', roles: ['fp_partner'], isSubItem: true },
  { href: '/team/finanzas/facturacion/control', label: 'Facturación por proyecto', roles: ['fp_partner'], isSubItem: true },
  { href: '/team/finanzas/facturacion/emitidas', label: 'Facturas emitidas', roles: ['fp_partner'], isSubItem: true },
  { href: '/team/finanzas/facturacion/empresa', label: 'Información empresa', roles: ['fp_partner'], isSubItem: true },
  // ── Clientes ─────────────────────────────────────────────────────────────
  // Parent for fp_partner / fp_manager — lands on base-datos
  {
    href: '/team/clientes/base-datos',
    label: 'Clientes',
    roles: ['fp_partner', 'fp_manager'],
  },
  // Parent for fp_team — lands on plataforma interna (sin acceso a base-datos)
  {
    href: '/team/clientes/plataforma/interna',
    label: 'Clientes',
    roles: ['fp_team'],
  },
  {
    href: '/team/clientes/base-datos',
    label: 'Base de datos',
    roles: ['fp_partner', 'fp_manager'],
    isSubItem: true,
  },
  {
    href: '/team/clientes/plataforma/interna',
    label: 'Plataforma interna',
    roles: ['fp_partner', 'fp_manager', 'fp_team'],
    isSubItem: true,
  },
  {
    href: '/team/clientes/plataforma/externa',
    label: 'Vista del cliente',
    roles: ['fp_partner', 'fp_manager', 'fp_team'],
    isSubItem: true,
  },
  // ── Proveedores ───────────────────────────────────────────────────────────
  {
    href: '/team/proveedores',
    label: 'Proveedores',
    roles: ['fp_partner', 'fp_manager'],
  },
]

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol')
    .eq('id', user.id)
    .single()

  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  const rol = profile.rol as FpRole
  const navItems = ALL_NAV.filter((item) => item.roles.includes(rol)).map(
    ({ href, label, isSubItem, isSection, isGroup, pinBottom }) => ({ href, label, isSubItem, isSection, isGroup, pinBottom })
  )

  return (
    <div className="flex min-h-screen bg-cream">
      <TeamSidebar nombre={profile.nombre} rol={rol} navItems={navItems} />
      <main className="flex-1 ml-0 lg:ml-64 pt-14 lg:pt-0 overflow-auto">{children}</main>
      <RulerOverlay />
    </div>
  )
}
