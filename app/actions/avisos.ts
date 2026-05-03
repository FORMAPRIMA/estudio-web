'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { LinkeableType } from '@/lib/avisos/getAvisoRoute'

const PATH = '/team/dashboard'

export async function addAviso(data: {
  titulo:            string
  contenido?:        string
  nivel:             string
  tipo?:             'equipo' | 'personal'
  hora_activa?:      string | null   // "HH:MM" — only used when tipo === 'personal'
  fecha_activa:      string
  fecha_caducidad?:  string
  linkeable_type?:   LinkeableType | null
  linkeable_id?:     string | null
  link_label?:       string | null
}): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Sin sesión activa.' }

    const isPersonal = data.tipo === 'personal'

    const { error } = await supabase
      .from('avisos')
      .insert({
        tipo:            isPersonal ? 'personal' : 'equipo',
        autor_id:        user.id,
        destinatario_id: isPersonal ? user.id : null,
        titulo:          data.titulo.trim(),
        contenido:       data.contenido?.trim() || null,
        nivel:           data.nivel,
        hora_activa:     isPersonal ? (data.hora_activa || null) : null,
        fecha_activa:    data.fecha_activa,
        fecha_caducidad: data.fecha_caducidad || null,
        linkeable_type:  data.linkeable_type  ?? null,
        linkeable_id:    data.linkeable_id    ?? null,
        link_label:      data.link_label      ?? null,
      })

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function archivarAviso(avisoId: string): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Sin sesión activa.' }

    const { error } = await supabase
      .from('avisos_archivados')
      .insert({ aviso_id: avisoId, user_id: user.id })

    // Ignore duplicate (already archived)
    if (error && !error.code?.includes('23505')) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
