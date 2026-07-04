import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import FacturasEmitidasPage from '@/components/team/finanzas/FacturasEmitidasPage'
import { getEstudioConfig } from '@/app/actions/facturasEmitidas'
import { SECCIONES_PRIVADAS, SECCION_CONSTRUCTORA } from '@/lib/finanzas/costs'
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
      .select('id, numero_completo, serie, fecha_emision, fecha_operacion, cliente_id, cliente_nombre, cliente_contacto, cliente_nif, cliente_direccion, proyecto_id, proyecto_nombre, seccion, items, tipo_iva, base_imponible, cuota_iva, tipo_irpf, cuota_irpf, total, iban, forma_pago, condiciones_pago, notas, mencion_legal, es_rectificativa, factura_original_id, motivo_rectificacion, estado, created_at')
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
        id, concepto, monto, seccion, proyecto_id, clientes_ids, proveedor_id,
        proyectos(
          id, nombre, codigo, direccion, constructor_id,
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
        constructor_id: string | null
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
        seccion:           f.seccion ?? '',
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

      // ── Secciones privadas (márgenes): facturar al PROVEEDOR, no al cliente ──
      // "Margen prorrateado de obra" → constructora del proyecto (constructor_id)
      // "Margen de mobiliario"       → proveedor de muebles (factura.proveedor_id)
      const seccionF = f.seccion as string | null
      if (seccionF && SECCIONES_PRIVADAS.includes(seccionF)) {
        // Nunca al cliente: borra cualquier email/identidad de cliente del prefill
        prefill.clienteId      = ''
        prefill.clienteContacto = ''
        prefill.clienteEmpresa = ''
        prefill.clienteNif     = ''
        prefill.clienteDireccion = ''
        prefill.clienteEmail   = ''
        prefill.clienteEmailCC = ''

        // Rellena con los datos fiscales del proveedor correspondiente
        let provId = (f as Record<string, unknown>).proveedor_id as string | null
        if (seccionF === SECCION_CONSTRUCTORA && !provId) provId = proyecto?.constructor_id ?? null
        if (provId) {
          const { data: prov } = await admin
            .from('proveedores')
            .select('id, nombre, razon_social, nif_cif, direccion_fiscal, direccion')
            .eq('id', provId)
            .single()
          if (prov) {
            prefill.clienteEmpresa   = (prov.razon_social as string | null) ?? prov.nombre
            prefill.clienteNif       = (prov.nif_cif as string | null) ?? ''
            prefill.clienteDireccion = (prov.direccion_fiscal as string | null) ?? (prov.direccion as string | null) ?? ''
          }
        }
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
