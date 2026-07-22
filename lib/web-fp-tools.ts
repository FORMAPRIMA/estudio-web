// Web pública — FP Tools (tabla web_fp_tools). Escaparate de capacidades.

export interface WebFpTool {
  id:             string
  nombre:         string
  tagline_es:     string | null
  tagline_en:     string | null
  descripcion_es: string | null
  descripcion_en: string | null
  imagen_url:     string | null
  cta_label_es:   string | null
  cta_label_en:   string | null
  cta_url:        string | null
  orden:          number
  activo:         boolean
  created_at:     string
}
