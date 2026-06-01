import { createAdminClient } from '@/lib/supabase/admin'
import { SECCIONES_PRIVADAS } from '@/lib/finanzas/costs'

// Carga todos los datos del portal de un proyecto y devuelve las props de
// ClientPortal. Compartido por /portal/[id] (portal legacy) y por el Espacio.
export interface PortalProps {
  proyecto: {
    id: string; nombre: string; codigo: string | null; imagen_url: string | null
    direccion: string | null; cliente_nombre: string | null; cliente_empresa: string | null
  }
  renders: { id: string; url: string; nombre: string | null }[]
  portal: { floorfy_url: string | null; pdf_proyecto_url: string | null; portal_cliente_ids?: string[] | null } | null
  actualizaciones: { id: string; tipo: string; titulo: string; contenido: string | null; fecha: string }[]
  visitas: { id: string; fecha: string; titulo: string | null; asistentes: string | null; notas: string | null; acta_url: string | null; floorfy_url: string | null }[]
  partidas: { id: string; nombre: string; fecha_inicio: string | null; fecha_fin: string | null; color: string; orden: number; completado: boolean }[]
  contratos: { contrato_arquitectura_url: string | null; contrato_obra_url: string | null; pdf_presupuesto_url: string | null } | null
  facturas: { id: string; seccion: string; concepto: string; monto: number; status: string; fecha_pago_acordada: string | null; numero_factura: string | null; clientes_ids?: string[] }[]
  pagosConstructora: { id: string; concepto: string; importe_estimado: number | null; fecha_estimada: string; status?: string }[]
  hideDocumentos: boolean
}

export async function loadPortalData(
  proyectoId: string,
  viewerRol?: string | null,
): Promise<PortalProps | null> {
  const admin = createAdminClient()

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
    admin.from('proyectos')
      .select('id, nombre, codigo, imagen_url, status, direccion, clientes!cliente_id(nombre, apellidos, empresa)')
      .eq('id', proyectoId).single(),
    admin.from('proyecto_actualizaciones')
      .select('id, tipo, titulo, contenido, fecha')
      .eq('proyecto_id', proyectoId).eq('visible_cliente', true).order('fecha', { ascending: false }),
    admin.from('proyecto_renders')
      .select('id, url, nombre').eq('proyecto_id', proyectoId).order('orden').order('created_at'),
    admin.from('proyecto_portal')
      .select('floorfy_url, pdf_proyecto_url, portal_cliente_ids').eq('proyecto_id', proyectoId).maybeSingle(),
    admin.from('visitas_obra')
      .select('id, fecha, titulo, asistentes, notas, acta_url, floorfy_url')
      .eq('proyecto_id', proyectoId).eq('visible_cliente', true).order('fecha', { ascending: false }),
    admin.from('cronograma_partidas')
      .select('id, nombre, fecha_inicio, fecha_fin, color, orden, completado')
      .eq('proyecto_id', proyectoId).order('orden').order('created_at'),
    admin.from('contratos_proyecto')
      .select('contrato_arquitectura_url, contrato_obra_url, pdf_presupuesto_url')
      .eq('proyecto_id', proyectoId).maybeSingle(),
    admin.from('facturas')
      .select('id, seccion, concepto, monto, status, fecha_pago_acordada, numero_factura, clientes_ids')
      .eq('proyecto_id', proyectoId)
      .not('seccion', 'in', `(${SECCIONES_PRIVADAS.map(s => `"${s}"`).join(',')})`)
      .order('seccion').order('created_at'),
    admin.from('proyecto_pagos_constructora')
      .select('id, concepto, importe_estimado, fecha_estimada, status')
      .eq('proyecto_id', proyectoId).order('fecha_estimada', { ascending: true }),
  ])

  if (!proyecto) return null

  const portalClienteIds: string[] = (portal as { portal_cliente_ids?: string[] | null } | null)?.portal_cliente_ids ?? []
  const allFacturas = facturas ?? []
  const filteredFacturas = portalClienteIds.length === 0
    ? allFacturas
    : allFacturas.filter(f => {
        const ids: string[] = (f as unknown as { clientes_ids?: string[] }).clientes_ids ?? []
        return ids.length === 0 || ids.some(id => portalClienteIds.includes(id))
      })

  const cli = proyecto.clientes as unknown as { nombre: string; apellidos: string | null; empresa: string | null } | null
  const clienteNombre = cli ? [cli.nombre, cli.apellidos].filter(Boolean).join(' ') : null

  return {
    proyecto: {
      id:              proyecto.id,
      nombre:          proyecto.nombre,
      codigo:          proyecto.codigo ?? null,
      imagen_url:      proyecto.imagen_url ?? null,
      direccion:       (proyecto as { direccion?: string | null }).direccion ?? null,
      cliente_nombre:  clienteNombre,
      cliente_empresa: cli?.empresa ?? null,
    },
    renders:           renders ?? [],
    portal:            portal ?? null,
    actualizaciones:   actualizaciones ?? [],
    visitas:           visitas ?? [],
    partidas:          partidas ?? [],
    contratos:         contratos ?? null,
    facturas:          filteredFacturas,
    pagosConstructora: pagosConstructora ?? [],
    hideDocumentos:    viewerRol === 'fp_team',
  }
}
