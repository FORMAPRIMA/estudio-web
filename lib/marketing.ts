export type RedSocial = 'instagram' | 'linkedin'

export type PostStatus =
  | 'borrador'
  | 'en_revision'
  | 'feedback_disponible'
  | 'aprobado'
  | 'programado'
  | 'publicado'

export const POST_STATUSES: { value: PostStatus; label: string; color: string }[] = [
  { value: 'borrador',             label: 'Borrador',      color: '#888'    },
  { value: 'en_revision',          label: 'En revisión',   color: '#C4A532' },
  { value: 'feedback_disponible',  label: 'Feedback',      color: '#D85A30' },
  { value: 'aprobado',             label: 'Aprobado',      color: '#2D7D5A' },
  { value: 'programado',           label: 'Programado',    color: '#5B7FA6' },
  { value: 'publicado',            label: 'Publicado',     color: '#1A1A1A' },
]

export function getStatusInfo(status: PostStatus) {
  return POST_STATUSES.find(s => s.value === status) ?? POST_STATUSES[0]
}

export const TIPOS_INSTAGRAM = [
  { value: 'feed',     label: 'Feed'     },
  { value: 'carrusel', label: 'Carrusel' },
  { value: 'reel',     label: 'Reel'     },
  { value: 'story',    label: 'Story'    },
]

export const TIPOS_LINKEDIN = [
  { value: 'post',     label: 'Post'     },
  { value: 'articulo', label: 'Artículo' },
]

export interface MarketingPostMedia {
  id: string
  post_id: string
  url: string
  tipo: 'image' | 'video'
  orden: number
}

export interface MarketingPostComentario {
  id: string
  post_id: string
  autor_id: string
  autor_nombre: string | null
  contenido: string
  created_at: string
}

export interface MarketingPost {
  id: string
  red_social: RedSocial
  tipo_post: string | null
  titulo: string
  caption: string | null
  hashtags: string[]
  location: string | null
  fecha_programada: string | null
  status: PostStatus
  created_by: string
  autor_nombre: string | null
  created_at: string
  updated_at: string
  media: MarketingPostMedia[]
  comentarios: MarketingPostComentario[]
}

// Allowed status transitions per role
export function getTransitions(status: PostStatus, rol: string): { to: PostStatus; label: string }[] {
  if (rol === 'fp_biz_dev') {
    const map: Partial<Record<PostStatus, { to: PostStatus; label: string }[]>> = {
      borrador:             [{ to: 'en_revision', label: 'Enviar a revisión' }],
      en_revision:          [{ to: 'borrador', label: 'Retirar' }],
      feedback_disponible:  [{ to: 'en_revision', label: 'Reenviar a revisión' }],
      aprobado:             [{ to: 'programado', label: 'Programar' }],
      programado:           [{ to: 'publicado', label: 'Marcar como publicado' }],
    }
    return map[status] ?? []
  }
  if (rol === 'fp_partner') {
    const map: Partial<Record<PostStatus, { to: PostStatus; label: string }[]>> = {
      en_revision:          [{ to: 'aprobado', label: 'Aprobar' }, { to: 'borrador', label: 'Rechazar' }],
      feedback_disponible:  [{ to: 'aprobado', label: 'Aprobar' }, { to: 'borrador', label: 'Rechazar' }],
    }
    return map[status] ?? []
  }
  return []
}
