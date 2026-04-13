import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PlataformaInternaDetalle from '@/components/team/clientes/PlataformaInternaDetalle'
import { SECCIONES_PRIVADAS } from '@/lib/finanzas/costs'

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_team'].includes(profile.rol))
    redirect('/team/dashboard')

  const admin = createAdminClient()
  const isPrivileged = ['fp_partner', 'fp_manager'].includes(profile.rol)

  const { data: proyecto } = await admin
    .from('proyectos')
    .select('id, nombre, codigo, imagen_url, status, direccion, constructor_id, clientes!cliente_id(id, nombre)')
    .eq('id', params.id)
    .single()

  if (!proyecto) notFound()

  const { data: titularesRaw } = await admin
    .from('proyecto_clientes')
    .select('cliente_id, rol, clientes(nombre, apellidos, empresa)')
    .eq('proyecto_id', params.id)

  const titulares = (titularesRaw ?? []).map((t: any) => ({
    cliente_id: t.cliente_id as string,
    rol:        t.rol as string,
    nombre:     ([t.clientes?.nombre, t.clientes?.apellidos].filter(Boolean).join(' ')) as string,
    empresa:    (t.clientes?.empresa ?? null) as string | null,
  }))

  const [
    { data: portalData },
    { data: rendersData },
    { data: visitasData },
    { data: partidasData },
    { data: contratosData },
    { data: facturasData },
    { data: pagosConstructoraData },
  ] = await Promise.all([
    admin.from('proyecto_portal').select('*').eq('proyecto_id', params.id).maybeSingle(),
    admin.from('proyecto_renders').select('*').eq('proyecto_id', params.id).order('orden').order('created_at'),
    admin.from('visitas_obra').select('*').eq('proyecto_id', params.id).order('fecha', { ascending: false }),
    admin.from('cronograma_partidas').select('*').eq('proyecto_id', params.id).order('orden').order('created_at'),
    isPrivileged
      ? admin.from('contratos_proyecto').select('*').eq('proyecto_id', params.id).maybeSingle()
      : Promise.resolve({ data: null }),
    isPrivileged
      ? admin
          .from('facturas')
          .select('id, seccion, concepto, monto, status, fecha_pago_acordada, numero_factura')
          .eq('proyecto_id', params.id)
          .not('seccion', 'in', `(${SECCIONES_PRIVADAS.map(s => `"${s}"`).join(',')})`)
          .order('seccion')
          .order('created_at')
      : Promise.resolve({ data: [] }),
    isPrivileged
      ? admin
          .from('proyecto_pagos_constructora')
          .select('id, concepto, importe_estimado, fecha_estimada, orden, notas')
          .eq('proyecto_id', params.id)
          .order('fecha_estimada', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  const constructorId = (proyecto as { constructor_id?: string | null }).constructor_id ?? null
  let proyectoConstructor: { id: string; nombre: string } | null = null
  if (constructorId) {
    const { data: constData } = await admin
      .from('proveedores')
      .select('id, nombre')
      .eq('id', constructorId)
      .single()
    if (constData) proyectoConstructor = { id: constData.id as string, nombre: constData.nombre as string }
  }

  return (
    <PlataformaInternaDetalle
      proyecto={{
        id:          proyecto.id,
        nombre:      proyecto.nombre,
        codigo:      proyecto.codigo ?? null,
        imagen_url:  proyecto.imagen_url ?? null,
        status:      proyecto.status as string,
        cliente:     (proyecto.clientes as unknown as { nombre: string } | null)?.nombre ?? null,
        direccion:   (proyecto as { direccion?: string | null }).direccion ?? null,
        constructor: proyectoConstructor,
      }}
      userRol={profile.rol}
      titulares={titulares}
      portal={portalData ?? null}
      renders={rendersData ?? []}
      visitas={visitasData ?? []}
      partidas={partidasData ?? []}
      contratos={contratosData ?? null}
      facturas={facturasData ?? []}
      pagosConstructora={pagosConstructoraData ?? []}
    />
  )
}
