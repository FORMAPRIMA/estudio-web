// Repasos de obra — tipos de dominio y catálogos.
// Prefijo Repaso* para todos los tipos del módulo.

// ─── Enums ────────────────────────────────────────────────────────────────────

export type RepasoEstado = 'detectado' | 'programado' | 'resuelto'
export type RepasoVisibilidad = 'interno' | 'constructora' | 'cliente'
export type RepasoPrioridad = 'alta' | 'media' | 'baja'
export type RepasoAudiencia = 'constructora' | 'cliente'
export type RepasoProyectoStatus = 'activo' | 'cerrado'
export type RepasoFotoTipo = 'antes' | 'despues'

// ─── Entidades (espejo de la BD) ──────────────────────────────────────────────

export interface RepasoProyecto {
  id: string
  nombre: string
  direccion: string | null
  cliente: string | null
  constructora: string | null
  referencia: string | null
  notas: string | null
  status: RepasoProyectoStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RepasoPlano {
  id: string
  proyecto_id: string
  nombre: string
  orden: number
  img_url: string
  pdf_url: string | null
  width: number | null
  height: number | null
  created_at: string
}

export interface RepasoFoto {
  id: string
  repaso_id: string
  url: string
  tipo: RepasoFotoTipo
  orden: number
  created_at: string
}

export interface RepasoEvento {
  id: string
  repaso_id: string
  tipo: string
  detalle: string | null
  autor_id: string | null
  autor_nombre: string | null
  created_at: string
}

export interface Repaso {
  id: string
  proyecto_id: string
  plano_id: string
  codigo: string
  x: number
  y: number
  oficio: string
  descripcion: string | null
  estado: RepasoEstado
  visibilidad: RepasoVisibilidad
  prioridad: RepasoPrioridad
  fecha_objetivo: string | null
  responsable: string | null
  autor_id: string | null
  autor_nombre: string | null
  created_at: string
  updated_at: string
  resuelto_at: string | null
  resuelto_por: string | null
  fotos: RepasoFoto[]
  eventos: RepasoEvento[]
}

export interface RepasoToken {
  id: string
  proyecto_id: string
  audiencia: RepasoAudiencia
  token: string
  label: string | null
  created_at: string
  revoked_at: string | null
  last_access: string | null
  access_count: number
}

/** Fila del índice: proyecto + portada del plano + contadores por estado. */
export interface RepasoProyectoResumen extends RepasoProyecto {
  plano_portada: string | null
  planos_count: number
  detectados: number
  programados: number
  resueltos: number
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface CreateRepasoProyectoInput {
  nombre: string
  direccion?: string | null
  cliente?: string | null
  constructora?: string | null
  referencia?: string | null
  notas?: string | null
  plano: {
    nombre: string
    img_url: string
    pdf_url?: string | null
    width?: number | null
    height?: number | null
  }
}

export interface CreateRepasoInput {
  proyecto_id: string
  plano_id: string
  x: number
  y: number
  oficio: string
  descripcion?: string | null
  estado: RepasoEstado
  visibilidad: RepasoVisibilidad
  prioridad: RepasoPrioridad
  fecha_objetivo?: string | null
  responsable?: string | null
  fotos: { url: string; tipo: RepasoFotoTipo }[]
}

export interface UpdateRepasoInput {
  oficio?: string
  descripcion?: string | null
  estado?: RepasoEstado
  visibilidad?: RepasoVisibilidad
  prioridad?: RepasoPrioridad
  fecha_objetivo?: string | null
  responsable?: string | null
}

// ─── Oficios ──────────────────────────────────────────────────────────────────
// Lista canónica de gremios que intervienen en una obra de reforma/edificación.
// El `id` es lo que se guarda en BD; nunca renombrar un id existente.

export interface Oficio {
  id: string
  label: string
  color: string
}

export const OFICIOS: Oficio[] = [
  { id: 'albanileria',         label: 'Albañilería',                    color: '#8B7355' },
  { id: 'tabiqueria_pladur',   label: 'Tabiquería y pladur',            color: '#A08B6F' },
  { id: 'yesos',               label: 'Yesos y guarnecidos',            color: '#B5A48C' },
  { id: 'falsos_techos',       label: 'Falsos techos',                  color: '#8A8A7A' },
  { id: 'solados_alicatados',  label: 'Solados y alicatados',           color: '#7A6B8A' },
  { id: 'pavimento_madera',    label: 'Pavimento de madera',            color: '#96603C' },
  { id: 'piedra_marmol',       label: 'Piedra y mármol',                color: '#6E6E78' },
  { id: 'pintura',             label: 'Pintura',                        color: '#D85A30' },
  { id: 'fontaneria',          label: 'Fontanería',                     color: '#3D7A9E' },
  { id: 'sanitarios',          label: 'Sanitarios y grifería',          color: '#5B9EC4' },
  { id: 'electricidad',        label: 'Electricidad',                   color: '#C4A532' },
  { id: 'iluminacion',         label: 'Iluminación',                    color: '#D9B94A' },
  { id: 'climatizacion',       label: 'Climatización y ventilación',    color: '#4A9E96' },
  { id: 'carpinteria_madera',  label: 'Carpintería de madera',          color: '#A5713F' },
  { id: 'carpinteria_ext',     label: 'Carpintería exterior (alu/PVC)', color: '#7D8A96' },
  { id: 'vidrieria',           label: 'Vidriería',                      color: '#6FA8B5' },
  { id: 'cerrajeria',          label: 'Cerrajería y metalistería',      color: '#5A5A5A' },
  { id: 'mobiliario_cocina',   label: 'Mobiliario y cocina',            color: '#8A6220' },
  { id: 'electrodomesticos',   label: 'Electrodomésticos',              color: '#6B6B8A' },
  { id: 'impermeabilizacion',  label: 'Impermeabilización',             color: '#2D7D5A' },
  { id: 'aislamientos',        label: 'Aislamientos',                   color: '#3D8B5F' },
  { id: 'fachada',             label: 'Fachada y revestimientos ext.',  color: '#4A6741' },
  { id: 'domotica_telecom',    label: 'Domótica y telecomunicaciones',  color: '#7A5FA6' },
  { id: 'pci',                 label: 'Protección contra incendios',    color: '#B03A2E' },
  { id: 'ascensores',          label: 'Ascensores',                     color: '#5B7FA6' },
  { id: 'jardineria',          label: 'Jardinería y exteriores',        color: '#3D7A6E' },
  { id: 'limpieza',            label: 'Limpieza y remates finales',     color: '#9A9A8A' },
  { id: 'otros',               label: 'Otros',                          color: '#888888' },
]

const OFICIO_MAP: Record<string, Oficio> = OFICIOS.reduce((acc, o) => {
  acc[o.id] = o
  return acc
}, {} as Record<string, Oficio>)

export function oficioLabel(id: string): string {
  return OFICIO_MAP[id]?.label ?? id
}

export function oficioColor(id: string): string {
  return OFICIO_MAP[id]?.color ?? '#888888'
}

// ─── Estados ──────────────────────────────────────────────────────────────────

export const ESTADOS: { id: RepasoEstado; label: string; color: string }[] = [
  { id: 'detectado',  label: 'Detectado',  color: '#D85A30' },
  { id: 'programado', label: 'Programado', color: '#C4A532' },
  { id: 'resuelto',   label: 'Resuelto',   color: '#2D7D5A' },
]

export function estadoLabel(id: RepasoEstado): string {
  return ESTADOS.find((e) => e.id === id)?.label ?? id
}

export function estadoColor(id: RepasoEstado): string {
  return ESTADOS.find((e) => e.id === id)?.color ?? '#888888'
}

// ─── Prioridades ──────────────────────────────────────────────────────────────

export const PRIORIDADES: { id: RepasoPrioridad; label: string; color: string }[] = [
  { id: 'alta',  label: 'Alta',  color: '#B03A2E' },
  { id: 'media', label: 'Media', color: '#C4A532' },
  { id: 'baja',  label: 'Baja',  color: '#7D8A96' },
]

export function prioridadLabel(id: RepasoPrioridad): string {
  return PRIORIDADES.find((p) => p.id === id)?.label ?? id
}

// ─── Visibilidad ──────────────────────────────────────────────────────────────
// Jerárquica y acumulativa: interno (0) ⊂ constructora (1) ⊂ cliente (2).
// Un repaso es visible para una audiencia si su nivel es >= al de la audiencia.

export const VISIBILIDADES: {
  id: RepasoVisibilidad
  label: string
  descripcion: string
  icon: string
}[] = [
  {
    id: 'interno',
    label: 'Solo interno',
    descripcion: 'Únicamente el equipo de Forma Prima.',
    icon: '🔒',
  },
  {
    id: 'constructora',
    label: 'Constructora',
    descripcion: 'El equipo y la constructora. No lo ve el cliente.',
    icon: '🏗',
  },
  {
    id: 'cliente',
    label: 'Cliente',
    descripcion: 'El equipo, la constructora y el cliente.',
    icon: '👁',
  },
]

const VISIBILIDAD_RANK: Record<RepasoVisibilidad, number> = {
  interno: 0,
  constructora: 1,
  cliente: 2,
}

const AUDIENCIA_RANK: Record<RepasoAudiencia, number> = {
  constructora: 1,
  cliente: 2,
}

export function visibilidadLabel(id: RepasoVisibilidad): string {
  return VISIBILIDADES.find((v) => v.id === id)?.label ?? id
}

export function visibilidadIcon(id: RepasoVisibilidad): string {
  return VISIBILIDADES.find((v) => v.id === id)?.icon ?? '🔒'
}

/** ¿Puede esta audiencia externa ver un repaso con esta visibilidad? */
export function esVisiblePara(
  visibilidad: RepasoVisibilidad,
  audiencia: RepasoAudiencia
): boolean {
  return VISIBILIDAD_RANK[visibilidad] >= AUDIENCIA_RANK[audiencia]
}

/** Visibilidades que puede ver una audiencia externa (para filtrar en la query). */
export function visibilidadesPara(audiencia: RepasoAudiencia): RepasoVisibilidad[] {
  return (Object.keys(VISIBILIDAD_RANK) as RepasoVisibilidad[]).filter((v) =>
    esVisiblePara(v, audiencia)
  )
}

// ─── Códigos ──────────────────────────────────────────────────────────────────

/** Siguiente código correlativo del proyecto: R-001, R-002… */
export function nextCodigo(codigosExistentes: string[]): string {
  const max = codigosExistentes.reduce((acc, c) => {
    const n = parseInt((c ?? '').replace(/[^0-9]/g, ''), 10)
    return Number.isFinite(n) && n > acc ? n : acc
  }, 0)
  return `R-${String(max + 1).padStart(3, '0')}`
}

/**
 * Número que se pinta dentro del pin. Es la parte numérica del código, así que
 * el pin del plano, la fila de la lista y el «R-014» que se dice por teléfono en
 * obra son siempre el mismo número.
 */
export function numeroDeCodigo(codigo: string): number {
  const n = parseInt((codigo ?? '').replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

// ─── Formateo ─────────────────────────────────────────────────────────────────

export function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function fmtFechaHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Texto legible de un evento del historial. */
export function eventoTexto(ev: RepasoEvento): string {
  const who = ev.autor_nombre ?? 'Alguien'
  switch (ev.tipo) {
    case 'creado':      return `${who} detectó el repaso`
    case 'estado':      return `${who} cambió el estado${ev.detalle ? ` · ${ev.detalle}` : ''}`
    case 'visibilidad': return `${who} cambió la visibilidad${ev.detalle ? ` · ${ev.detalle}` : ''}`
    case 'foto':        return `${who} añadió una foto${ev.detalle ? ` (${ev.detalle})` : ''}`
    case 'foto_borrada':return `${who} borró una foto`
    case 'movido':      return `${who} movió el pin en el plano`
    case 'editado':     return `${who} editó el repaso${ev.detalle ? ` · ${ev.detalle}` : ''}`
    default:            return `${who} · ${ev.detalle ?? ev.tipo}`
  }
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

export interface RepasoFiltros {
  estados: RepasoEstado[]
  oficios: string[]
  visibilidades: RepasoVisibilidad[]
  texto: string
}

export const FILTROS_VACIOS: RepasoFiltros = {
  estados: [],
  oficios: [],
  visibilidades: [],
  texto: '',
}

export function aplicaFiltros(r: Repaso, f: RepasoFiltros): boolean {
  if (f.estados.length && !f.estados.includes(r.estado)) return false
  if (f.oficios.length && !f.oficios.includes(r.oficio)) return false
  if (f.visibilidades.length && !f.visibilidades.includes(r.visibilidad)) return false
  if (f.texto.trim()) {
    const q = f.texto.trim().toLowerCase()
    const hay = [r.codigo, r.descripcion ?? '', oficioLabel(r.oficio), r.responsable ?? '']
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

export function hayFiltrosActivos(f: RepasoFiltros): boolean {
  return (
    f.estados.length > 0 ||
    f.oficios.length > 0 ||
    f.visibilidades.length > 0 ||
    f.texto.trim().length > 0
  )
}
