import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { miembroActual, salasDe } from '@/lib/salas/panel'
import EquipoPanel, { type MiembroFila, type PersonaFP, type Registro } from '@/components/salas/EquipoPanel'
import { FP_ROLES } from '@/lib/types'

export default async function EquipoPage() {
  const m = await miembroActual()
  if (!m) redirect('/')
  if (m.rol !== 'propietario') notFound()
  const admin = createAdminClient()
  const [salas, { data: miembros }, { data: asig }, { data: audit }, { data: perfiles }] = await Promise.all([
    salasDe(m),
    admin.from('sala_miembros').select('id, nombre, email, empresa, rol, activo, ultimo_acceso, created_at').order('created_at'),
    admin.from('sala_miembro_salas').select('miembro_id, sala_id'),
    admin.from('sala_auditoria').select('miembro_id, sala_id, accion, detalle, at').order('at', { ascending: false }).limit(40),
    admin.from('profiles').select('id, nombre, apellido, email, rol, blocked').in('rol', [...FP_ROLES]).order('nombre'),
  ])
  const filas: MiembroFila[] = (miembros ?? []).map((x) => ({
    id: x.id, nombre: x.nombre, email: x.email, empresa: x.empresa, rol: x.rol, activo: x.activo, ultimoAcceso: x.ultimo_acceso,
    salas: (asig ?? []).filter((a) => a.miembro_id === x.id).map((a) => a.sala_id),
  }))
  // Equipo de internal: ya dentro si hay alguien del panel con su email; si no, se
  // propone vincular a quien se llame igual y no tenga email (pasa con las altas antiguas).
  const sinTilde = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const equipoFP: PersonaFP[] = (perfiles ?? []).filter((p) => !p.blocked && p.email).map((p) => {
    const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || p.email!
    const email = p.email!.trim().toLowerCase()
    const dentro = filas.find((x) => x.email?.toLowerCase() === email)
    const tocayo = dentro ? undefined : filas.find((x) => !x.email && sinTilde(x.nombre) === sinTilde(nombre))
    return { perfilId: p.id, nombre, email, rol: p.rol, miembroId: dentro?.id ?? null, activo: dentro?.activo ?? false, tocayo: tocayo ? { id: tocayo.id, nombre: tocayo.nombre } : null }
  })
  const nombres = Object.fromEntries((miembros ?? []).map((x) => [x.id, x.nombre]))
  const salasN = Object.fromEntries(salas.map((s) => [s.id, s.nombre]))
  const registro: Registro[] = (audit ?? []).map((a) => ({
    quien: nombres[a.miembro_id ?? ''] ?? '—', sala: salasN[a.sala_id ?? ''] ?? null, accion: a.accion, detalle: a.detalle, at: a.at,
  }))
  return <EquipoPanel yo={m.id} miembros={filas} salas={salas.map((s) => ({ id: s.id, nombre: s.nombre, confidencial: s.confidencial, creadoPor: s.creadoPor, tipo: s.tipo }))} registro={registro} equipoFP={equipoFP} yoEmail={m.email} />
}
