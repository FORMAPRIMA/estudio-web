import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import ClientPortalGate from '@/components/portal/ClientPortalGate'
import ClientPortal from '@/components/portal/ClientPortal'
import { SECCIONES_PRIVADAS } from '@/lib/finanzas/costs'

const SECRET = process.env.PORTAL_SECRET ?? 'fp-portal-secret-2024'
const TEAM_ROLES = ['fp_partner', 'fp_manager', 'fp_team']

function verifyToken(proyectoId: string, token: string): boolean {
  const expected = createHmac('sha256', SECRET).update(proyectoId).digest('hex')
  return token === expected
}

export default async function PortalPage({ params }: { params: { id: string } }) {
  const { id } = params
  const admin = createAdminClient()

  // Team members (logged-in staff) bypass the client gate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isTeamMember = false
  let viewerRol: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    viewerRol = profile?.rol ?? null
    isTeamMember = TEAM_ROLES.includes(viewerRol ?? '')
  }

  // Check access cookie (for actual clients)
  const cookieName = `fp_portal_${id.replace(/-/g, '').slice(0, 12)}`
  const cookieStore = await cookies()
  const token = cookieStore.get(cookieName)?.value
  const isVerified = isTeamMember || (token ? verifyToken(id, token) : false)

  // Always fetch proyecto basics (for gate display)
  const { data: proyectoBasic } = await admin
    .from('proyectos')
    .select('id, nombre, imagen_url')
    .eq('id', id)
    .single()

  if (!proyectoBasic) notFound()

  if (!isVerified) {
    return (
      <ClientPortalGate
        proyectoId={id}
        proyectoNombre={proyectoBasic.nombre}
        imagenUrl={proyectoBasic.imagen_url ?? null}
      />
    )
  }

  // Fetch all portal data
  const [
    { data: proyecto },
    { data: actualizaciones },
    { data: renders },
    { data: portal },
    { data: visitas },
    { data: partidas },
    { data: contratos },
    { data: facturas },
    { data: pagosConstructora },
  ] = await Promise.all([
    admin
      .from('proyectos')
      .select('id, nombre, codigo, imagen_url, status, direccion, clientes!cliente_id(nombre, apellidos, empresa)')
      .eq('id', id)
      .single(),
    admin
      .from('proyecto_actualizaciones')
      .select('id, tipo, titulo, contenido, fecha')
      .eq('proyecto_id', id)
      .eq('visible_cliente', true)
      .order('fecha', { ascending: false }),
    admin
      .from('proyecto_renders')
      .select('id, url, nombre')
      .eq('proyecto_id', id)
      .order('orden')
      .order('created_at'),
    admin
      .from('proyecto_portal')
      .select('floorfy_url, pdf_proyecto_url, portal_cliente_ids')
      .eq('proyecto_id', id)
      .maybeSingle(),
    admin
      .from('visitas_obra')
      .select('id, fecha, titulo, asistentes, notas, acta_url, floorfy_url')
      .eq('proyecto_id', id)
      .eq('visible_cliente', true)
      .order('fecha', { ascending: false }),
    admin
      .from('cronograma_partidas')
      .select('id, nombre, fecha_inicio, fecha_fin, color, orden, completado')
      .eq('proyecto_id', id)
      .order('orden')
      .order('created_at'),
    admin
      .from('contratos_proyecto')
      .select('contrato_arquitectura_url, contrato_obra_url, pdf_presupuesto_url')
      .eq('proyecto_id', id)
      .maybeSingle(),
    admin
      .from('facturas')
      .select('id, seccion, concepto, monto, status, fecha_pago_acordada, numero_factura, clientes_ids')
      .eq('proyecto_id', id)
      .not('seccion', 'in', `(${SECCIONES_PRIVADAS.map(s => `"${s}"`).join(',')})`)
      .order('seccion')
      .order('created_at'),
    admin
      .from('proyecto_pagos_constructora')
      .select('id, concepto, importe_estimado, fecha_estimada')
      .eq('proyecto_id', id)
      .order('fecha_estimada', { ascending: true }),
  ])

  if (!proyecto) notFound()

  // Filter invoices: if portal_cliente_ids is set, only show invoices with no client
  // assignment (visible to all) or those explicitly assigned to a portal-authorized client
  const portalClienteIds: string[] = (portal as { portal_cliente_ids?: string[] | null } | null)?.portal_cliente_ids ?? []
  const allFacturas = facturas ?? []
  const filteredFacturas = portalClienteIds.length === 0
    ? allFacturas
    : allFacturas.filter(f => {
        const ids: string[] = (f as unknown as { clientes_ids?: string[] }).clientes_ids ?? []
        return ids.length === 0 || ids.some(id => portalClienteIds.includes(id))
      })

  const cli = proyecto.clientes as unknown as { nombre: string; apellidos: string | null; empresa: string | null } | null
  const clienteNombre = cli
    ? [cli.nombre, cli.apellidos].filter(Boolean).join(' ')
    : null

  return (
    <ClientPortal
      proyecto={{
        id:        proyecto.id,
        nombre:    proyecto.nombre,
        codigo:    proyecto.codigo ?? null,
        imagen_url: proyecto.imagen_url ?? null,
        direccion: (proyecto as { direccion?: string | null }).direccion ?? null,
        cliente_nombre: clienteNombre,
        cliente_empresa: cli?.empresa ?? null,
      }}
      renders={renders ?? []}
      portal={portal ?? null}
      actualizaciones={actualizaciones ?? []}
      visitas={visitas ?? []}
      partidas={partidas ?? []}
      contratos={contratos ?? null}
      facturas={filteredFacturas}
      pagosConstructora={pagosConstructora ?? []}
      hideDocumentos={viewerRol === 'fp_team'}
    />
  )
}
