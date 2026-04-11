import { createClient } from '@/lib/supabase/server'
import PartnersPage from '@/components/team/fp-execution/PartnersPage'

export default async function FpePartnersPage() {
  const supabase = await createClient()

  const [{ data: partners }, { data: chapters }] = await Promise.all([
    supabase
      .from('fpe_partners')
      .select(`
        id, nombre, razon_social, nif_cif, contacto_nombre,
        email_contacto, email_notificaciones, email_facturacion,
        telefono, direccion, ciudad, codigo_postal, pais, iban, notas, activo,
        capabilities:fpe_partner_capabilities ( unit_id )
      `)
      .order('nombre', { ascending: true }),

    // Fetch all units grouped by chapter for the capabilities matrix
    supabase
      .from('fpe_template_chapters')
      .select(`
        id, nombre, orden,
        units:fpe_template_units ( id, nombre, orden, activo )
      `)
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('orden', { referencedTable: 'fpe_template_units', ascending: true }),
  ])

  return (
    <PartnersPage
      initialPartners={partners ?? []}
      chapters={chapters ?? []}
    />
  )
}
