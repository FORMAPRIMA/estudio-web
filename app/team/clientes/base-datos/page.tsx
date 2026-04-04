import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientesBDPage from '@/components/team/clientes/ClientesBDPage'

export const metadata = { title: 'Base de datos clientes' }

const SELECT_FULL = `
  id, nombre, apellidos, documento_identidad,
  direccion, ciudad, codigo_postal, pais,
  email, email_cc, telefono, telefono_alt,
  tipo_facturacion, empresa, nif_cif,
  direccion_facturacion, notas_facturacion, notas, fecha_nacimiento, created_at,
  proyectos!cliente_id(id, nombre, codigo, status),
  proyecto_clientes(rol, proyectos(id, nombre, codigo, status))
`

const SELECT_SAFE = `
  id, nombre, apellidos,
  direccion, ciudad, codigo_postal, pais,
  email, email_cc, telefono, telefono_alt,
  empresa, nif_cif,
  direccion_facturacion, notas, created_at,
  proyectos!cliente_id(id, nombre, codigo, status),
  proyecto_clientes(rol, proyectos(id, nombre, codigo, status))
`

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol))
    redirect('/team/dashboard')

  const admin = createAdminClient()

  // Try with new columns first; if missing (migration not run), fall back to safe set
  let { data: clientes, error } = await admin
    .from('clientes')
    .select(SELECT_FULL)
    .order('nombre')

  if (error) {
    console.warn('[clientes/page] Full select failed, falling back to safe select:', error.message)
    const fallback = await admin
      .from('clientes')
      .select(SELECT_SAFE)
      .order('nombre')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clientes = fallback.data as any
    if (fallback.error) {
      console.error('[clientes/page] Safe select also failed:', fallback.error.message)
    }
  }

  // Merge proyectos!cliente_id (primary) + proyecto_clientes (junction) into a single deduplicated list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged = (clientes ?? []).map((c: any) => {
    const primary: any[]   = Array.isArray(c.proyectos)       ? c.proyectos       : c.proyectos ? [c.proyectos] : []
    const junction: any[]  = Array.isArray(c.proyecto_clientes) ? c.proyecto_clientes : []
    const junctionProys    = junction.map((jc: any) => (Array.isArray(jc.proyectos) ? jc.proyectos[0] : jc.proyectos)).filter(Boolean)
    const seen             = new Set(primary.map((p: any) => p.id))
    const extra            = junctionProys.filter((p: any) => !seen.has(p.id))
    return { ...c, proyectos: [...primary, ...extra] }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ClientesBDPage clientes={merged as any[]} />
}
