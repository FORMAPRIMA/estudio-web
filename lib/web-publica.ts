// Web pública — proyectos del teaser "Work in Progress" de formaprima.es.
// Tabla web_proyectos; se gestionan desde /team/marketing/web-publica.

export interface WebProyecto {
  id:         string
  nombre:     string
  ubicacion:  string | null
  anio:       string | null
  nota:       string | null
  hero_url:   string | null
  /** Foto principal vertical: sustituye a hero_url en móvil. */
  hero_mobile_url: string | null
  galeria:    string[]
  orden:      number
  activo:     boolean
  created_at: string
}
