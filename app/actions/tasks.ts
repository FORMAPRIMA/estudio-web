'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { TaskStatus } from '@/lib/types'

export async function updateTaskStatus(taskId: string, status: TaskStatus, proyectoId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
  if (error) return { error: error.message }

  if (proyectoId) revalidatePath(`/team/proyectos/${proyectoId}`)
  return { success: true }
}

export async function updateTaskResponsables(taskId: string, responsableIds: string[], proyectoId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const admin = createAdminClient()
  const { error } = await admin.from('tasks').update({ responsable_ids: responsableIds }).eq('id', taskId)
  if (error) return { error: error.message }

  if (proyectoId) revalidatePath(`/team/proyectos/${proyectoId}`)
  return { success: true }
}

export async function updateTaskPrioridad(taskId: string, prioridad: number, proyectoId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const { error } = await supabase.from('tasks').update({ prioridad }).eq('id', taskId)
  if (error) return { error: error.message }

  if (proyectoId) revalidatePath(`/team/proyectos/${proyectoId}`)
  return { success: true }
}

export async function updateTaskTitulo(
  taskId: string,
  titulo: string,
  descripcion: string | null,
  proyectoId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const { error } = await supabase.from('tasks').update({ titulo, descripcion }).eq('id', taskId)
  if (error) return { error: error.message }

  if (proyectoId) revalidatePath(`/team/proyectos/${proyectoId}`)
  return { success: true }
}

export async function updateTaskFechaLimite(taskId: string, fecha_limite: string | null, proyectoId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const { error } = await supabase.from('tasks').update({ fecha_limite }).eq('id', taskId)
  if (error) return { error: error.message }

  if (proyectoId) revalidatePath(`/team/proyectos/${proyectoId}`)
  return { success: true }
}

export async function deleteTask(taskId: string, proyectoId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) return { error: error.message }

  if (proyectoId) revalidatePath(`/team/proyectos/${proyectoId}`)
  return { success: true }
}
