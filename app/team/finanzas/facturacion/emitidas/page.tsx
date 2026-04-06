import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import FacturasEmitidasPage from '@/components/team/finanzas/FacturasEmitidasPage'
import { getEstudioConfig } from '@/app/actions/facturasEmitidas'
import type { PrefillData } from '@/components/team/finanzas/FacturasEmitidasPage'

export const metadata = { title: 'Facturas emitidas · Facturación' }

export default async function Page({
  searchParams,
}: {
  searchParams: { from?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') redirect('/team/dashboard')

  const admin = createAdminClient()

  const [
    { data: facturas },
    { data: clientes },
    { data: proyectos },
    estudioConfig,
  ] = await Promise.all([
    admin
      .from('facturas_emitidas')
      .select('id, numero_completo, fecha_emision, cliente_nombre, cliente_nif, proyecto_nombre, base_imponible, cuota_iva, tipo_irpf, cuota_irpf, total, estado, es_rectificativa, created_at')
      .order('año', { ascending: false })
      .order('numero', { ascending: false }),
    admin
      .from('clientes')
      .select('id, nombre, apellidos, empresa, nif_cif, direccion_facturacion, email, email_cc')
      .order('nombre'),
    admin
      .from('proyectos')
      .select('id, nombre, codigo, direccion')
      .order('nombre'),
    getEstudioConfig(),
  ])

  // ── Pre-fill desde factura de contrato ────────────────────────────────────
  let prefill: PrefillData | null = null

  if (searchParams.from) {
    const { data: f } = await admin
      .from('facturas')
      .select(`
        id, concepto, monto, proyecto_id, clientes_ids,
        proyectos(
          id, nombre, codigo, direccion,
          clientes!cliente_id(
            id, nombre, apellidos, empresa,
            nif_cif, direccion_facturacion, ciudad, codigo_postal, email, email_cc
          )
        )
      `)
      .eq('id', searchParams.from)
      .single()

    if (f) {
      type ClienteRow = {
        id: string; nombre: string; apellidos: string | null; empresa: string | null
        nif_cif: string | null; direccion_facturacion: string | null
        ciudad: string | null; codigo_postal: string | null; email: string | null; email_cc: string | null
      }
      const proyecto = f.proyectos as unknown as {
        id: string; nombre: string; codigo: string | null; direccion: string | null
        clientes: ClienteRow | null
      } | null

      // Prefer the client explicitly selected for this factura (clientes_ids[0])
      // over the project's default primary client
      const clientesIds = (f as Record<string, unknown>).clientes_ids as string[] | null
      let cliente: ClienteRow | null = proyecto?.clientes ?? null

      if (clientesIds && clientesIds.length > 0) {
        const { data: selectedCliente } = await admin
          .from('clientes')
          .select('id, nombre, apellidos, empresa, nif_cif, direccion_facturacion, ciudad, codigo_postal, email, email_cc')
          .eq('id', clientesIds[0])
          .single()
        if (selectedCliente) cliente = selectedCliente as ClienteRow
      }
      const clienteNombreCompleto = cliente
        ? [cliente.nombre, cliente.apellidos].filter(Boolean).join(' ')
        : ''

      prefill = {
        facturaOrigenId:  f.id,
        concepto:         f.concepto,
        monto:            f.monto,
        clienteId:        cliente?.id        ?? '',
        clienteContacto:  clienteNombreCompleto,
        clienteEmpresa:   cliente?.empresa   ?? '',
        clienteNif:       cliente?.nif_cif   ?? '',
        clienteEmail:     cliente?.email    ?? '',
        clienteEmailCC:   cliente?.email_cc ?? '',
        clienteDireccion: cliente?.direccion_facturacion ?? '',
        proyectoId:        proyecto?.id        ?? '',
        proyectoNombre:    proyecto
          ? `${proyecto.codigo ? proyecto.codigo + ' · ' : ''}${proyecto.nombre}`
          : '',
        proyectoDireccion: proyecto?.direccion ?? '',
        // Emisor from estudio config
        emisorNombre:    estudioConfig?.nombre         ?? '',
        emisorNif:       estudioConfig?.nif            ?? '',
        emisorDireccion: estudioConfig?.direccion      ?? '',
        emisorCiudad:    estudioConfig?.ciudad         ?? '',
        emisorCp:        estudioConfig?.codigo_postal  ?? '',
        emisorEmail:     estudioConfig?.email          ?? '',
        emisorTelefono:  estudioConfig?.telefono       ?? '',
        iban:            estudioConfig?.iban           ?? '',
      }
    }
  }

  return (
    <FacturasEmitidasPage
      facturas={facturas ?? []}
      clientes={clientes ?? []}
      proyectos={proyectos ?? []}
      estudioConfig={estudioConfig}
      prefill={prefill}
    />
  )
}
