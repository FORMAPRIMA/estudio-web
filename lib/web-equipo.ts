// Web pública — equipo del estudio (tabla web_equipo).
// Se gestiona desde /team/marketing/web-publica (tab Equipo).

export interface WebEquipo {
  id:               string
  nombre:           string
  slug:             string
  rol_es:           string | null
  rol_en:           string | null
  foto_url:         string | null
  foto_detalle_url: string | null
  cv_corto_es:      string | null
  cv_corto_en:      string | null
  cv_largo_es:      string | null
  cv_largo_en:      string | null
  orden:            number
  activo:           boolean
  created_at:       string
}

/** Slug URL-safe a partir del nombre. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'miembro'
}
