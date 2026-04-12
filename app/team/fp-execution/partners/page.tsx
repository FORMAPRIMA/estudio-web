import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PartnersPage from '@/components/team/fp-execution/PartnersPage'

export default async function FpePartnersPage() {
  const supabase = await createClient()
  const admin    = createAdminClient()

  const [{ data: partners }, { data: disciplines }] = await Promise.all([
    admin
      .from('fpe_partners')
      .select(`
        id, nombre, razon_social, nif_cif, contacto_nombre,
        email_contacto, email_notificaciones, email_facturacion,
        telefono, direccion, ciudad, codigo_postal, pais, iban, notas, activo,
        partner_disciplines:fpe_partner_disciplines ( discipline_id )
      `)
      .order('nombre', { ascending: true }),

    supabase
      .from('fpe_disciplines')
      .select('id, nombre, descripcion, color, orden, activo')
      .eq('activo', true)
      .order('orden', { ascending: true }),
  ])

  // Flatten partner_disciplines to discipline_ids[]
  type RawPartner = {
    id: string; nombre: string; razon_social: string | null; nif_cif: string | null
    contacto_nombre: string | null; email_contacto: string | null
    email_notificaciones: string | null; email_facturacion: string | null
    telefono: string | null; direccion: string | null; ciudad: string | null
    codigo_postal: string | null; pais: string; iban: string | null; notas: string | null
    activo: boolean; partner_disciplines: { discipline_id: string }[]
  }

  const mappedPartners = ((partners ?? []) as unknown as RawPartner[]).map(p => ({
    ...p,
    discipline_ids: (p.partner_disciplines ?? []).map(pd => pd.discipline_id),
  }))

  return (
    <PartnersPage
      initialPartners={mappedPartners}
      disciplines={disciplines ?? []}
    />
  )
}
