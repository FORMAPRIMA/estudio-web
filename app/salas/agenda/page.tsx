import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { miembroActual, salasDe } from '@/lib/salas/panel'
import { agendaDe } from '@/lib/para/agenda'
import AgendaPanel, { type ReunionAgenda } from '@/components/salas/AgendaPanel'

// Mi agenda: las franjas que ofrecen mis enlaces de prospección y las llamadas
// que ya me han reservado (las de todos, para las personas de propiedad).

export default async function AgendaPage() {
  const m = await miembroActual()
  if (!m) redirect('/')
  const admin = createAdminClient()
  const salas = (await salasDe(m)).filter((s) => s.tipo === 'prospeccion')
  const [{ data: yo }, { data: rs }] = await Promise.all([
    admin.from('sala_miembros').select('agenda').eq('id', m.id).single(),
    salas.length
      ? admin.from('sala_reuniones').select('id, sala_id, lead_id, miembro_id, inicio, minutos, estado, email, nota, zona_lead, created_at')
          .in('sala_id', salas.map((s) => s.id)).neq('estado', 'cancelada').order('inicio', { ascending: true, nullsFirst: true })
      : Promise.resolve({ data: [] as never[] }),
  ])
  const mias = (rs ?? []).filter((r) => m.rol === 'propietario' || r.miembro_id === m.id)
  const leadIds = Array.from(new Set(mias.map((r) => r.lead_id)))
  const [{ data: leads }, { data: miembros }] = await Promise.all([
    leadIds.length ? admin.from('sala_leads').select('id, nombre, empresa').in('id', leadIds) : Promise.resolve({ data: [] as never[] }),
    admin.from('sala_miembros').select('id, nombre'),
  ])
  const ln = new Map((leads ?? []).map((l) => [l.id, l]))
  const mn = new Map((miembros ?? []).map((x) => [x.id, x.nombre]))
  const sn = new Map(salas.map((s) => [s.id, s.slug]))
  const reuniones: ReunionAgenda[] = mias
    .filter((r) => !r.inicio || Date.parse(r.inicio) > Date.now() - 3600_000)
    .map((r) => ({
      id: r.id, slug: sn.get(r.sala_id) ?? '', leadId: r.lead_id, empresa: ln.get(r.lead_id)?.empresa || ln.get(r.lead_id)?.nombre || '—',
      contacto: ln.get(r.lead_id)?.nombre ?? '', con: mn.get(r.miembro_id ?? '') ?? null, inicio: r.inicio, minutos: r.minutos,
      estado: r.estado, email: r.email, nota: r.nota, zonaLead: r.zona_lead,
    }))
  return <AgendaPanel agenda={agendaDe(yo?.agenda)} reuniones={reuniones} verTodas={m.rol === 'propietario'} />
}
