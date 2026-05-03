'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { MarketingPost, MarketingPostComentario, PostStatus, RedSocial } from '@/lib/marketing'

const PATH = '/team/marketing/post-manager'

async function requireMarketingAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('id, rol, nombre').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_biz_dev'].includes(profile.rol)) {
    throw new Error('Sin permisos.')
  }
  return { userId: user.id, rol: profile.rol as string, nombre: profile.nombre as string ?? '' }
}

async function crearAviso(
  admin: ReturnType<typeof createAdminClient>,
  titulo: string,
  contenido: string,
  visibleRoles: string[],
  nivel: 'informativo' | 'importante' = 'informativo',
  postId?: string,
) {
  const today = new Date().toISOString().split('T')[0]
  const { error } = await admin.from('avisos').insert({
    tipo: 'equipo', autor_id: null,
    titulo, contenido, nivel,
    fecha_activa:   today,
    visible_roles:  visibleRoles,
    linkeable_type: postId ? 'marketing_post' : null,
    linkeable_id:   postId ?? null,
    link_label:     postId ? 'Revisar post' : null,
  })
  if (error) console.error('[marketing] crearAviso:', error.message)
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getMarketingPosts(redSocial: RedSocial): Promise<MarketingPost[]> {
  try {
    await requireMarketingAccess()
    const admin = createAdminClient()

    const { data: posts, error } = await admin
      .from('marketing_posts')
      .select('id, red_social, tipo_post, titulo, caption, hashtags, location, fecha_programada, status, created_by, autor_nombre, created_at, updated_at')
      .eq('red_social', redSocial)
      .order('created_at', { ascending: false })

    if (error) { console.error('[marketing] posts query:', error.message); return [] }
    if (!posts?.length) return []

    const postIds = posts.map((p: any) => p.id)

    const mediaRes = await admin
      .from('marketing_post_media')
      .select('id, post_id, url, tipo, orden')
      .in('post_id', postIds)
      .order('orden')
    if (mediaRes.error) console.error('[marketing] media query:', mediaRes.error.message)

    const comentariosRes = await admin
      .from('marketing_post_comentarios')
      .select('id, post_id, autor_id, autor_nombre, contenido, created_at')
      .in('post_id', postIds)
      .order('created_at')
    if (comentariosRes.error) console.error('[marketing] comentarios query:', comentariosRes.error.message)

    const media       = mediaRes.data       ?? []
    const comentarios = comentariosRes.data ?? []

    return posts.map((r: any) => ({
      ...r,
      hashtags:    r.hashtags ?? [],
      media:       media.filter((m: any) => m.post_id === r.id),
      comentarios: comentarios.filter((c: any) => c.post_id === r.id),
    }))
  } catch (e) {
    console.error('[marketing] getMarketingPosts exception:', e)
    return []
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createMarketingPost(data: {
  red_social: RedSocial
  tipo_post?: string
  titulo: string
  caption?: string
  hashtags?: string[]
  location?: string
  fecha_programada?: string
  media?: { url: string; tipo: 'image' | 'video'; orden: number }[]
}): Promise<{ success: true; id: string } | { error: string }> {
  try {
    const { userId, nombre } = await requireMarketingAccess()
    if (!data.titulo?.trim()) return { error: 'El título es obligatorio.' }

    const admin = createAdminClient()
    const { data: row, error } = await admin
      .from('marketing_posts')
      .insert({
        red_social:       data.red_social,
        tipo_post:        data.tipo_post || null,
        titulo:           data.titulo.trim(),
        caption:          data.caption?.trim() || null,
        hashtags:         data.hashtags ?? [],
        location:         data.location?.trim() || null,
        fecha_programada: data.fecha_programada || null,
        status:           'borrador',
        created_by:       userId,
        autor_nombre:     nombre,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }

    if (data.media?.length) {
      const { error: mediaErr } = await admin.from('marketing_post_media').insert(
        data.media.map(m => ({ ...m, post_id: row.id }))
      )
      if (mediaErr) return { error: `Post creado pero fallo al guardar media: ${mediaErr.message}` }
    }

    revalidatePath(PATH)
    return { success: true, id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateMarketingPost(
  id: string,
  data: {
    tipo_post?: string | null
    titulo?: string
    caption?: string | null
    hashtags?: string[]
    location?: string | null
    fecha_programada?: string | null
  }
): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketingAccess()
    const admin = createAdminClient()
    const { error } = await admin
      .from('marketing_posts')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Status ────────────────────────────────────────────────────────────────────

export async function updatePostStatus(
  id: string,
  newStatus: PostStatus
): Promise<{ success: true } | { error: string }> {
  try {
    const { nombre, rol } = await requireMarketingAccess()
    const admin = createAdminClient()

    const { data: post } = await admin
      .from('marketing_posts')
      .select('titulo, red_social, status')
      .eq('id', id)
      .single()
    if (!post) return { error: 'Post no encontrado.' }

    await admin
      .from('marketing_posts')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    const redLabel = post.red_social === 'instagram' ? 'Instagram' : 'LinkedIn'

    if (newStatus === 'en_revision') {
      await crearAviso(admin,
        `Post listo para revisión`,
        `"${post.titulo}" (${redLabel}) está listo para tu revisión.`,
        ['fp_partner'], 'informativo', id
      )
    } else if (newStatus === 'aprobado') {
      await crearAviso(admin,
        `Post aprobado`,
        `${nombre} aprobó "${post.titulo}" (${redLabel}). Listo para programar.`,
        ['fp_biz_dev'], 'informativo', id
      )
    } else if (newStatus === 'publicado') {
      await crearAviso(admin,
        `Post publicado`,
        `"${post.titulo}" ha sido publicado en ${redLabel}.`,
        ['fp_partner', 'fp_biz_dev'], 'informativo', id
      )
    } else if (newStatus === 'borrador' && rol === 'fp_partner') {
      await crearAviso(admin,
        `Post rechazado`,
        `${nombre} rechazó "${post.titulo}" (${redLabel}). Revisa el feedback.`,
        ['fp_biz_dev'], 'importante', id
      )
    }

    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Media ─────────────────────────────────────────────────────────────────────

export async function replacePostMedia(
  postId: string,
  media: { url: string; tipo: 'image' | 'video'; orden: number }[]
): Promise<{ success: true } | { error: string }> {
  try {
    await requireMarketingAccess()
    const admin = createAdminClient()
    const { error: delErr } = await admin.from('marketing_post_media').delete().eq('post_id', postId)
    if (delErr) return { error: delErr.message }
    if (media.length > 0) {
      const { error: insErr } = await admin.from('marketing_post_media').insert(
        media.map(m => ({ url: m.url, tipo: m.tipo, orden: m.orden, post_id: postId }))
      )
      if (insErr) return { error: insErr.message }
    }
    await admin.from('marketing_posts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', postId)
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComentario(
  postId: string,
  contenido: string
): Promise<{ success: true; comentario: MarketingPostComentario; newStatus?: PostStatus } | { error: string }> {
  try {
    const { userId, rol, nombre } = await requireMarketingAccess()
    if (!contenido.trim()) return { error: 'El comentario no puede estar vacío.' }

    const admin = createAdminClient()

    const { data: post } = await admin
      .from('marketing_posts')
      .select('titulo, red_social, status')
      .eq('id', postId)
      .single()
    if (!post) return { error: 'Post no encontrado.' }

    const { data: row, error } = await admin
      .from('marketing_post_comentarios')
      .insert({
        post_id:      postId,
        autor_id:     userId,
        autor_nombre: nombre,
        contenido:    contenido.trim(),
      })
      .select('*')
      .single()
    if (error) return { error: error.message }

    // Auto-change status when partner comments on in-review post
    let newStatus: PostStatus | undefined
    if (rol === 'fp_partner' && (post.status === 'en_revision')) {
      newStatus = 'feedback_disponible'
      await admin.from('marketing_posts').update({
        status: 'feedback_disponible',
        updated_at: new Date().toISOString(),
      }).eq('id', postId)
    }

    const redLabel = post.red_social === 'instagram' ? 'Instagram' : 'LinkedIn'
    const preview = contenido.length > 70 ? contenido.slice(0, 67) + '…' : contenido

    if (rol === 'fp_partner') {
      await crearAviso(admin,
        `Feedback en "${post.titulo}"`,
        `${nombre}: "${preview}" (${redLabel})`,
        ['fp_biz_dev'], 'importante', postId
      )
    } else {
      await crearAviso(admin,
        `Comentario en "${post.titulo}"`,
        `${nombre} dejó un comentario en el post de ${redLabel}.`,
        ['fp_partner'], 'informativo', postId
      )
    }

    revalidatePath(PATH)
    return { success: true, comentario: row, newStatus }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteMarketingPost(id: string): Promise<{ success: true } | { error: string }> {
  try {
    const { userId, rol } = await requireMarketingAccess()
    const admin = createAdminClient()

    if (rol !== 'fp_partner') {
      const { data: post } = await admin
        .from('marketing_posts').select('created_by').eq('id', id).single()
      if (!post || post.created_by !== userId) return { error: 'Sin permisos para eliminar este post.' }
    }

    const { error } = await admin.from('marketing_posts').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
