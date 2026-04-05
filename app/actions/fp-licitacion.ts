'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireFP() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' as const }
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_team', 'fp_manager', 'fp_partner'].includes(profile.rol))
    return { error: 'Sin acceso.' as const }
  return { user, profile, supabase }
}

// ─── Execution Projects ───────────────────────────────────────────────────────

export async function upsertExecutionProject(project: {
  id: string
  nombre: string
  cliente?: string
  direccion?: string
  ciudad?: string
  descripcion?: string
  linked_project_id?: string
  active_sub_ids: string[]
  general_files: object[]
  chapter_zones: object
  status?: string
}) {
  const auth = await requireFP()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const { data, error } = await supabase
    .from('fp_execution_projects')
    .upsert({
      id: project.id,
      nombre: project.nombre,
      cliente: project.cliente ?? '',
      direccion: project.direccion ?? '',
      ciudad: project.ciudad ?? '',
      descripcion: project.descripcion ?? '',
      linked_project_id: project.linked_project_id ?? null,
      active_sub_ids: project.active_sub_ids,
      general_files: project.general_files,
      chapter_zones: project.chapter_zones,
      status: project.status ?? 'borrador',
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/team/fp-execution/project')
  return { data }
}

export async function loadExecutionProjects() {
  const auth = await requireFP()
  if ('error' in auth) return { error: auth.error, data: [] }
  const { supabase } = auth

  const { data, error } = await supabase
    .from('fp_execution_projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function deleteExecutionProject(id: string) {
  const auth = await requireFP()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const { error } = await supabase.from('fp_execution_projects').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/team/fp-execution/project')
  return { success: true }
}

// ─── Lanzar licitación ───────────────────────────────────────────────────────

export interface PaqueteInput {
  partnerId: string
  scope: {
    projectNombre: string
    projectDireccion: string
    projectDescripcion: string
    fechaLimite: string
    generalFiles: { id: string; name: string; size: number; path?: string }[]
    capitulos: {
      id: string
      numero: number
      nombre: string
      subcapitulos: { id: string; nombre: string }[]
      zonas: { pdf: { id: string; name: string; path?: string } | null; dwg: { id: string; name: string; path?: string } | null; textFile: { id: string; name: string; path?: string } | null }[]
    }[]
  }
}

export async function lanzarLicitacion({
  projectId,
  descripcionProyecto,
  fechaLimite,
  paquetes,
}: {
  projectId: string
  descripcionProyecto: string
  fechaLimite: string
  paquetes: PaqueteInput[]
}) {
  const auth = await requireFP()
  if ('error' in auth) return { error: auth.error }
  const admin = createAdminClient()

  // Create proceso
  const { data: proceso, error: procesoErr } = await admin
    .from('fp_procesos_licitacion')
    .insert({
      execution_project_id: projectId,
      descripcion_proyecto: descripcionProyecto,
      fecha_limite: fechaLimite,
      status: 'activo',
    })
    .select()
    .single()

  if (procesoErr || !proceso) return { error: procesoErr?.message ?? 'Error al crear proceso' }

  // Create paquetes
  const { data: paquetesCreados, error: paqErr } = await admin
    .from('fp_paquetes_licitacion')
    .insert(paquetes.map(p => ({
      proceso_id: proceso.id,
      partner_id: p.partnerId,
      scope: p.scope,
      status: 'enviado',
    })))
    .select('id, token, partner_id')

  if (paqErr) return { error: paqErr.message }

  // Update project status
  await admin.from('fp_execution_projects').update({ status: 'en_licitacion' }).eq('id', projectId)

  revalidatePath('/team/fp-execution/project')
  return { proceso, paquetes: paquetesCreados }
}

// ─── Portal — marcar como visto ───────────────────────────────────────────────

export async function marcarPaqueteVisto(token: string) {
  const admin = createAdminClient()
  await admin
    .from('fp_paquetes_licitacion')
    .update({ status: 'visto', viewed_at: new Date().toISOString() })
    .eq('token', token)
    .eq('status', 'enviado') // solo si aún no ha sido visto
}

// ─── Portal — enviar oferta ───────────────────────────────────────────────────

export async function enviarOferta({
  paqueteId,
  lineas,
  totalAmount,
  notas,
}: {
  paqueteId: string
  lineas: object[]
  totalAmount: number
  notas?: string
}) {
  const admin = createAdminClient()

  const { error } = await admin.from('fp_ofertas').upsert({
    paquete_id: paqueteId,
    lineas,
    total_amount: totalAmount,
    notas: notas ?? '',
    submitted_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }

  await admin
    .from('fp_paquetes_licitacion')
    .update({ status: 'oferta_recibida', submitted_at: new Date().toISOString() })
    .eq('id', paqueteId)

  return { success: true }
}

// ─── Mesa de ofertas — cargar datos ──────────────────────────────────────────

export async function loadMesaOfertas(projectId: string) {
  const auth = await requireFP()
  if ('error' in auth) return { error: auth.error }
  const admin = createAdminClient()

  const { data: procesos } = await admin
    .from('fp_procesos_licitacion')
    .select('*, fp_paquetes_licitacion(*, fp_ofertas(*), execution_partners(id, nombre, contacto_nombre, email_contacto))')
    .eq('execution_project_id', projectId)
    .order('created_at', { ascending: false })

  return { data: procesos ?? [] }
}
