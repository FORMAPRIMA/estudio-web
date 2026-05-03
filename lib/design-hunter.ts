export const DESIGN_HUNTER_CATEGORIES = [
  { value: 'materials',  label: 'Materiales' },
  { value: 'furniture',  label: 'Mobiliario' },
  { value: 'color',      label: 'Paleta de colores' },
  { value: 'spatial',    label: 'Espacios' },
  { value: 'lighting',   label: 'Iluminación' },
  { value: 'texture',    label: 'Texturas' },
  { value: 'facade',     label: 'Fachadas' },
  { value: 'detail',     label: 'Detalles constructivos' },
  { value: 'landscape',  label: 'Paisajismo' },
  { value: 'retail',     label: 'Retail / Comercial' },
  { value: 'other',      label: 'Otros' },
] as const

export type DesignHunterCategory = (typeof DESIGN_HUNTER_CATEGORIES)[number]['value']

export function getCategoryLabel(value: string): string {
  return DESIGN_HUNTER_CATEGORIES.find(c => c.value === value)?.label ?? value
}

export interface DesignHunterEntry {
  id: string
  user_id: string
  viaje_id: string | null
  titulo: string
  descripcion: string | null
  foto_url: string | null
  media_urls: string[]
  categoria: string | null
  tags: string[]
  visible_equipo: boolean
  created_at: string
  autor_nombre?: string | null
  viaje_nombre?: string | null
}

export function isVideoUrl(url: string): boolean {
  const path = url.split('?')[0].toLowerCase()
  return /\.(mp4|mov|webm|avi|m4v|3gp|mkv|ogv)$/.test(path)
}

export interface DesignHunterViaje {
  id: string
  created_by: string
  nombre: string
  fecha_inicio: string | null
  fecha_fin: string | null
  ubicacion: string | null
  created_at: string
}
