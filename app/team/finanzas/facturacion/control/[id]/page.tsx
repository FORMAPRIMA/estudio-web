import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import FacturacionProyectoDetalle from '@/components/team/finanzas/FacturacionProyectoDetalle'

const SECCION_ORDER = ['Anteproyecto', 'Proyecto de ejecución', 'Obra', 'Margen prorrateado de obra', 'Interiorismo', 'Margen de mobiliario', 'Post venta']

export default async function Page({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) redirect('/team/dashboard')

  const admin = createAdminClient()

  const { data: proyecto } = await admin
    .from('proyectos')
    .select(`
      id, nombre, codigo, imagen_url, status,
      cliente_id, constructor_id,
      clientes!cliente_id(id, nombre, apellidos, empresa, email, email_cc, telefono, telefono_alt, nif_cif, direccion_facturacion, ciudad, codigo_postal, pais),
      constructor:proveedores!constructor_id(id, nombre, razon_social, nif_cif, direccion_fiscal, iban),
      proyecto_fases(
        id,
        catalogo_fases(id, seccion, orden)
      )
    `)
    .eq('id', params.id)
    .single()

  if (!proyecto) notFound()

  // Try to select clientes_ids; if the column doesn't exist yet (migration pending),
  // fall back to the base query so facturas still appear.
  const BASE_SELECT = 'id, seccion, concepto, numero_factura, monto, fecha_emision, fecha_pago_acordada, fecha_cobro, status, notas, factura_emitida_id, created_at'
  const [facturasResult, { data: proyectoClientes }] = await Promise.all([
    admin
      .from('facturas')
      .select(`${BASE_SELECT}, clientes_ids, proveedor_id`)
      .eq('proyecto_id', params.id)
      .order('created_at'),
    admin
      .from('proyecto_clientes')
      .select('clientes(id, nombre, apellidos, empresa, email, email_cc, telefono, telefono_alt, nif_cif, direccion_facturacion, ciudad, codigo_postal, pais)')
      .eq('proyecto_id', params.id),
  ])

  // Fall back if clientes_ids column is missing (migration not yet applied)
  let facturas = facturasResult.data
  if (facturasResult.error) {
    const { data: fallback } = await admin
      .from('facturas')
      .select(BASE_SELECT)
      .eq('proyecto_id', params.id)
      .order('created_at')
    facturas = (fallback as typeof facturas) ?? null
  }

  // Get available secciones from project fases (in canonical order)
  type PFRow = { catalogo_fases: { seccion: string; orden: number } | null }
  const faseSecciones = (proyecto.proyecto_fases as unknown as PFRow[] ?? [])
    .flatMap(pf => pf.catalogo_fases ? [pf.catalogo_fases.seccion] : [])
  const uniqueSecciones = Array.from(new Set([...faseSecciones]))
    .sort((a, b) => {
      const ia = SECCION_ORDER.indexOf(a)
      const ib = SECCION_ORDER.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })

  // Also include secciones already in facturas (in case of manually added ones)
  const facturaSecciones = Array.from(new Set((facturas ?? []).map(f => f.seccion)))

  // Auto-include private companion sections based on active secciones
  const companionSecciones: string[] = []
  const activeSecciones = new Set([...uniqueSecciones, ...facturaSecciones])
  if (activeSecciones.has('Obra'))        companionSecciones.push('Margen prorrateado de obra')
  if (activeSecciones.has('Interiorismo')) companionSecciones.push('Margen de mobiliario')

  const allSecciones = Array.from(new Set([...uniqueSecciones, ...facturaSecciones, ...companionSecciones]))
    .sort((a, b) => {
      const ia = SECCION_ORDER.indexOf(a)
      const ib = SECCION_ORDER.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })

  type ClienteRow = {
    id: string; nombre: string; apellidos: string | null; empresa: string | null
    email: string | null; email_cc: string | null
    telefono: string | null; telefono_alt: string | null
    nif_cif: string | null; direccion_facturacion: string | null
    ciudad: string | null; codigo_postal: string | null; pais: string | null
  } | null
  const cliente = proyecto.clientes as unknown as ClienteRow

  type ConstructorRow = {
    id: string; nombre: string; razon_social: string | null
    nif_cif: string | null; direccion_fiscal: string | null; iban: string | null
  } | null
  const constructorRaw = proyecto.constructor as unknown as ConstructorRow | ConstructorRow[]
  const constructor: ConstructorRow = Array.isArray(constructorRaw) ? (constructorRaw[0] ?? null) : constructorRaw

  // All clients registered to this project
  type PCRow = { clientes: ClienteRow | ClienteRow[] | null }
  const todosClientes: NonNullable<ClienteRow>[] = (proyectoClientes ?? [])
    .flatMap((row: PCRow) => {
      const c = row.clientes
      if (!c) return []
      if (Array.isArray(c)) return c.filter(Boolean) as NonNullable<ClienteRow>[]
      return [c as NonNullable<ClienteRow>]
    })
    .filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i) // deduplicate

  return (
    <FacturacionProyectoDetalle
      proyecto={{
        id:         proyecto.id,
        nombre:     proyecto.nombre,
        codigo:     proyecto.codigo    ?? null,
        imagen_url: proyecto.imagen_url ?? null,
        status:     proyecto.status    as string,
      }}
      cliente={cliente ? {
        id:                    cliente.id,
        nombre:                cliente.nombre,
        apellidos:             cliente.apellidos             ?? null,
        empresa:               cliente.empresa               ?? null,
        email:                 cliente.email                 ?? null,
        email_cc:              cliente.email_cc              ?? null,
        telefono:              cliente.telefono              ?? null,
        telefono_alt:          cliente.telefono_alt          ?? null,
        nif_cif:               cliente.nif_cif               ?? null,
        direccion_facturacion: cliente.direccion_facturacion ?? null,
        ciudad:                cliente.ciudad                ?? null,
        codigo_postal:         cliente.codigo_postal         ?? null,
        pais:                  cliente.pais                  ?? null,
      } : null}
      facturas={(facturas ?? []).map(f => ({
        id:                  f.id,
        seccion:             f.seccion,
        concepto:            f.concepto,
        numero_factura:      f.numero_factura      ?? null,
        monto:               f.monto,
        fecha_emision:       f.fecha_emision       ?? null,
        fecha_pago_acordada: f.fecha_pago_acordada ?? null,
        fecha_cobro:         f.fecha_cobro         ?? null,
        status:              f.status,
        notas:               f.notas               ?? null,
        factura_emitida_id:  (f as Record<string, unknown>).factura_emitida_id as string | null ?? null,
        clientes_ids:        ((f as Record<string, unknown>).clientes_ids as string[] | null) ?? [],
        proveedor_id:        ((f as Record<string, unknown>).proveedor_id as string | null) ?? null,
      }))}
      secciones={allSecciones}
      todosClientes={todosClientes}
      constructor={constructor ? {
        id:              constructor.id,
        nombre:          constructor.razon_social ?? constructor.nombre,
        nif_cif:         constructor.nif_cif         ?? null,
        direccion_fiscal: constructor.direccion_fiscal ?? null,
        iban:            constructor.iban             ?? null,
      } : null}
    />
  )
}
