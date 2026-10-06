import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { miembroActual, salasDe } from '@/lib/salas/panel'
import EquipoPanel, { type MiembroFila, type Registro } from '@/components/salas/EquipoPanel'

export default async function EquipoPage() {
  const m = await miembroActual()
  if (!m) redirect('/')
  if (m.rol !== 'propietario') notFound()
  const admin = createAdminClient()
  const [salas, { data: miembros }, { data: asig }, { data: audit }] = await Promise.all([
    salasDe(m),
    admin.from('sala_miembros').select('id, nombre, email, empresa, rol, activo, ultimo_acceso, created_at').order('created_at'),
    admin.from('sala_miembro_salas').select('miembro_id, sala_id'),
    admin.from('sala_auditoria').select('miembro_id, sala_id, accion, detalle, at').order('at', { ascending: false }).limit(40),
  ])
  const filas: MiembroFila[] = (miembros ?? []).map((x) => ({
    id: x.id, nombre: x.nombre, email: x.email, empresa: x.empresa, rol: x.rol, activo: x.activo, ultimoAcceso: x.ultimo_acceso,
    salas: (asig ?? []).filter((a) => a.miembro_id === x.id).map((a) => a.sala_id),
  }))
  const nombres = Object.fromEntries((miembros ?? []).map((x) => [x.id, x.nombre]))
  const salasN = Object.fromEntries(salas.map((s) => [s.id, s.nombre]))
  const registro: Registro[] = (audit ?? []).map((a) => ({
    quien: nombres[a.miembro_id ?? ''] ?? '—', sala: salasN[a.sala_id ?? ''] ?? null, accion: a.accion, detalle: a.detalle, at: a.at,
  }))
  return <EquipoPanel yo={m.id} miembros={filas} salas={salas.map((s) => ({ id: s.id, nombre: s.nombre }))} registro={registro} />
}
