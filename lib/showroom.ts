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

// Presets de iluminación basada en imagen (IBL) para el visor R3F. El fondo
// siempre es blanco; el HDRI solo aporta luz/reflejos, no se usa como skybox.
export interface LightingPreset {
  id: string
  label: string
  environmentImage: string  // HDRI local en /public/hdri
  exposure: number          // toneMappingExposure (ACES filmic)
  envIntensity: number      // intensidad de la luz de entorno
  shadowOpacity: number     // opacidad de la sombra de contacto
}

export const LIGHTING_PRESETS: LightingPreset[] = [
  {
    id: 'neutro',
    label: 'Estudio',
    environmentImage: '/hdri/studio_small_09_2k.hdr',
    exposure: 1.0,
    envIntensity: 1.0,
    shadowOpacity: 0.55,
  },
  {
    id: 'calido',
    label: 'Cálido',
    environmentImage: '/hdri/brown_photostudio_02_2k.hdr',
    exposure: 1.0,
    envIntensity: 0.95,
    shadowOpacity: 0.62,
  },
  {
    id: 'brillante',
    label: 'Brillante',
    environmentImage: '/hdri/studio_small_09_2k.hdr',
    exposure: 1.28,
    envIntensity: 1.3,
    shadowOpacity: 0.38,
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
