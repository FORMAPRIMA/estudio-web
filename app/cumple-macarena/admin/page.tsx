import { createAdminClient } from '@/lib/supabase/admin'
import AdminClient from './AdminClient'

const ADMIN_KEY = process.env.CUMPLE_ADMIN_KEY ?? 'maca2026'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { key?: string }
}) {
  if (searchParams.key !== ADMIN_KEY) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1736', color: '#FFD93B', fontFamily: 'sans-serif', fontSize: 24, flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div>Acceso denegado</div>
        <div style={{ fontSize: 14, color: '#fff', opacity: 0.5 }}>Añade ?key=TU_CLAVE a la URL</div>
      </div>
    )
  }

  const admin = createAdminClient()
  const { data: rsvps } = await admin
    .from('cumple_form_rsvp')
    .select('id, nombre_nino, asiste, menu_opcion, created_at')
    .order('created_at', { ascending: false })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const invitacionUrl = `${siteUrl}/cumple-macarena/invitacion`

  return (
    <AdminClient
      rsvps={rsvps ?? []}
      invitacionUrl={invitacionUrl}
      adminKey={ADMIN_KEY}
    />
  )
}
