import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TeamSidebar from '@/components/team/TeamSidebar'
import RulerOverlay from '@/components/dev/RulerOverlay'

import type { FpRole } from '@/lib/types'
import { FP_ROLES } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  isSubItem?: boolean
  isSection?: boolean
  isGroup?: boolean
  pinBottom?: boolean
  small?: boolean
}

const ALL_NAV: (NavItem & { roles: FpRole[] })[] = [
  // ── Items que fp_team y fp_biz_dev comparten ─────────────────────────────
  {
    href: '/team/dashboard',
    label: 'Dashboard',
    roles: ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev'],
  },
  {
    href: '/team/time-tracker',
    label: 'Time Tracker',
    roles: ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev'],
  },
  // Gastos y facturas: los no-partner solo ven (y suben) sus propios gastos
  {
    href: '/team/gastos',
    label: 'Gastos y facturas',
    roles: ['fp_team', 'fp_manager', 'fp_biz_dev'],
  },
  {
    href: '/team/mejoras',
    label: 'Mejoras & Bugs',
    roles: ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev'],
    pinBottom: true,
    small: true,
  },
  {
    href: '/team/area-interna',
    label: 'Área Interna FP',
    roles: ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev'],
    pinBottom: true,
  },
  // ── FP Execution ─────────────────────────────────────────────────────────
  { href: '/team/fp-execution/dashboard', label: 'FP Execution', roles: ['fp_partner', 'fp_manager'] },
  { href: '/team/fp-execution/dashboard', label: 'Dashboard', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  { href: '/team/fp-execution/projects', label: 'Proyectos', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  { href: '/team/fp-execution/partners', label: 'Partners', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  { href: '/team/fp-execution/template', label: 'Template', roles: ['fp_partner', 'fp_manager'], isSubItem: true },
  // ── Captación (fp_partner, fp_manager, fp_biz_dev) ────────────────────────
  { href: '/team/captacion', label: 'Captación', roles: ['fp_partner', 'fp_manager', 'fp_biz_dev'] },
  { href: '/team/captacion/business-development', label: 'Business development', roles: ['fp_partner', 'fp_manager', 'fp_biz_dev'], isSubItem: true },
  { href: '/team/captacion/leads', label: 'Leads', roles: ['fp_partner', 'fp_manager', 'fp_biz_dev'], isSubItem: true },
  { href: '/team/captacion/plantilla-propuestas', label: 'Plantilla prop', roles: ['fp_partner', 'fp_manager', 'fp_biz_dev'], isSubItem: true },
  { href: '/team/captacion/plantilla-contratos', label: 'Plantilla contr', roles: ['fp_partner', 'fp_manager', 'fp_biz_dev'], isSubItem: true },
  { href: '/team/captacion/due-diligencia', label: 'Due Diligence Tec.', roles: ['fp_partner', 'fp_manager', 'fp_biz_dev'], isSubItem: true },
  // ── Proyectos ─────────────────────────────────────────────────────────────
  {
    href: '/team/proyectos',
    label: 'Proyectos',
    roles: ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev'],
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
  { href: '', label: 'Finanzas por proyecto', roles: ['fp_partner'], isSection: true },
  { href: '/team/finanzas/operativas/proyectos', label: 'Análisis de proyectos', roles: ['fp_partner'], isSubItem: true },
  { href: '/team/finanzas/operativas/costes', label: 'Costes fijos', roles: ['fp_partner'], isSubItem: true },
  { href: '', label: 'Finanzas generales', roles: ['fp_partner'], isSection: true },
  { href: '/team/finanzas/macro/costes', label: 'Costes fijos/variables', roles: ['fp_partner'], isSubItem: true },
  { href: '', label: 'Gastos', roles: ['fp_partner'], isSection: true },
  { href: '/team/gastos', label: 'Gastos y facturas', roles: ['fp_partner'], isSubItem: true },
  { href: '/team/finanzas/conciliacion', label: 'Conciliación bancaria', roles: ['fp_partner'], isSubItem: true },
  { href: '/team/finanzas/gestor', label: 'Portal del gestor', roles: ['fp_partner'], isSubItem: true },
  { href: '', label: 'Facturación', roles: ['fp_partner'], isSection: true },
  { href: '/team/finanzas/facturacion/dashboard', label: 'Dashboard general', roles: ['fp_partner'], isSubItem: true },
  { href: '/team/finanzas/facturacion/control', label: 'Facturación por proyecto', roles: ['fp_partner'], isSubItem: true },
  { href: '/team/finanzas/facturacion/emitidas', label: 'Facturas emitidas', roles: ['fp_partner'], isSubItem: true },
  { href: '/team/finanzas/facturacion/empresa', label: 'Información empresa', roles: ['fp_partner'], isSubItem: true },
  // ── Clientes ─────────────────────────────────────────────────────────────
  // fp_partner / fp_manager: Clientes → base-datos
  {
    href: '/team/clientes/base-datos',
    label: 'Clientes',
    roles: ['fp_partner', 'fp_manager'],
  },
  // fp_team / fp_biz_dev: Clientes → plataforma interna (sin base-datos)
  {
    href: '/team/clientes/plataforma/interna',
    label: 'Clientes',
    roles: ['fp_team', 'fp_biz_dev'],
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
    roles: ['fp_partner', 'fp_manager', 'fp_team', 'fp_biz_dev'],
    isSubItem: true,
  },
  {
    href: '/team/clientes/plataforma/externa',
    label: 'Vista del cliente',
    roles: ['fp_partner', 'fp_manager', 'fp_team', 'fp_biz_dev'],
    isSubItem: true,
  },
  // ── Proveedores ───────────────────────────────────────────────────────────
  {
    href: '/team/proveedores',
    label: 'Proveedores',
    roles: ['fp_partner', 'fp_manager', 'fp_team'],
  },
  // ── Memorias de Calidades ─────────────────────────────────────────────────
  {
    href: '/team/memorias-calidad/warehouse',
    label: 'Memorias de Calidades',
    roles: ['fp_partner', 'fp_manager', 'fp_team'],
  },
  {
    href: '/team/memorias-calidad/warehouse',
    label: 'Warehouse',
    roles: ['fp_partner', 'fp_manager', 'fp_team'],
    isSubItem: true,
  },
  {
    href: '/team/memorias-calidad/anteproyecto',
    label: 'Anteproyecto',
    roles: ['fp_partner', 'fp_manager', 'fp_team'],
    isSubItem: true,
  },
  {
    href: '/team/memorias-calidad/proyectos',
    label: 'Ejecución',
    roles: ['fp_partner', 'fp_manager', 'fp_team'],
    isSubItem: true,
  },
  // ── Marketing ─────────────────────────────────────────────────────────────
  { href: '/team/marketing', label: 'Marketing', roles: ['fp_partner', 'fp_biz_dev'] },
  { href: '/team/marketing/post-manager', label: 'Post Manager', roles: ['fp_partner', 'fp_biz_dev'], isSubItem: true },
  { href: '/team/marketing/horas', label: 'Horas', roles: ['fp_partner', 'fp_biz_dev'], isSubItem: true },
  // ── Apps ──────────────────────────────────────────────────────────────────
  {
    href: '/team/apps',
    label: 'Apps',
    roles: ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev'],
  },
  {
    href: '/team/apps/urban-analyst',
    label: 'Urban Analyst',
    roles: ['fp_partner', 'fp_manager'],
    isSubItem: true,
  },
  {
    href: '/team/apps/design-hunter',
    label: 'Design Hunter',
    roles: ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev'],
    isSubItem: true,
  },
  {
    href: '/team/apps/dd-visits',
    label: 'DD Visits',
    roles: ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev'],
    isSubItem: true,
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
    ({ href, label, isSubItem, isSection, isGroup, pinBottom, small }) => ({ href, label, isSubItem, isSection, isGroup, pinBottom, small })
  )

  return (
    <div className="flex min-h-screen bg-cream">
      <TeamSidebar nombre={profile.nombre} rol={rol} navItems={navItems} />
      <main className="flex-1 ml-0 lg:ml-64 pt-14 lg:pt-0 overflow-auto">{children}</main>
      <RulerOverlay />
    </div>
  )
}
