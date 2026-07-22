// Web pública — Real Estate (tabla web_propiedades).

export interface WebPropiedad {
  id:             string
  slug:           string | null
  nombre:         string
  ubicacion:      string | null
  precio:         string | null
  descripcion_es: string | null
  descripcion_en: string | null
  hero_url:       string | null
  galeria:        string[]
  disponible:     boolean
  orden:          number
  activo:         boolean
  created_at:     string
}

export function slugifyPropiedad(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'propiedad'
}
