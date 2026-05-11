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

  const { data: invitados } = await admin
    .from('cumple_invitados')
    .select('id, nombre, token, created_at')
    .order('created_at', { ascending: true })

  const { data: rsvps } = await admin
    .from('cumple_rsvp')
    .select('invitado_id, asiste, menu_opcion, updated_at')

  const rsvpMap = Object.fromEntries((rsvps ?? []).map(r => [r.invitado_id, r]))

  const rows = (invitados ?? []).map(inv => ({
    ...inv,
    rsvp: rsvpMap[inv.id] ?? null,
  }))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  return <AdminClient rows={rows} siteUrl={siteUrl} adminKey={ADMIN_KEY} />
}
