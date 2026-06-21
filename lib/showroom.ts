// Showroom 3D — visor de maquetas (GLB) del estudio.
// Primera prueba interna; futura base del "showroom virtual" del sitio público.

export interface Modelo3D {
  id: string
  user_id: string
  nombre: string
  proyecto: string | null
  descripcion: string | null
  glb_url: string
  poster_url: string | null
  file_size: number | null
  created_at: string
  autor_nombre?: string | null
}

// Presets de iluminación basada en imagen (IBL). El fondo siempre es blanco;
// el HDRI solo aporta luz/reflejos, no se usa como skybox.
export interface LightingPreset {
  id: string
  label: string
  // environment-image de <model-viewer>. null = entorno neutro generado por model-viewer.
  environmentImage: string | null
  exposure: number
  shadowIntensity: number
}

export const LIGHTING_PRESETS: LightingPreset[] = [
  {
    id: 'neutro',
    label: 'Estudio neutro',
    environmentImage: '/hdri/studio_small_09_2k.hdr',
    exposure: 1.05,
    shadowIntensity: 0.9,
  },
  {
    id: 'calido',
    label: 'Estudio cálido',
    environmentImage: '/hdri/brown_photostudio_02_2k.hdr',
    exposure: 1.0,
    shadowIntensity: 1.0,
  },
  {
    id: 'suave',
    label: 'Difuso suave',
    environmentImage: null,
    exposure: 1.15,
    shadowIntensity: 0.55,
  },
]

export const DEFAULT_PRESET = LIGHTING_PRESETS[0]

const GLB_EXT = /\.(glb|gltf)$/i

export function isGlbUrl(url: string): boolean {
  return GLB_EXT.test(url.split('?')[0])
}

export function fmtFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ''
  const mb = bytes / (1024 * 1024)
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`
  return `${mb.toFixed(1)} MB`
}
