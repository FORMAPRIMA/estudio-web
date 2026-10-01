// Open House · Claudio Coello 38. Lo que en el prototipo de Claude Design eran
// constantes y props (capacidad, horarios, URL) vive aquí, en el servidor, que
// es quien valida.

export const EVENTO = {
  slug: 'cc38',
  nombre: 'Open House · Claudio Coello 38',
  fecha: '2026-10-08',
  /** Personas por turno de 30 min. */
  capacidad: 5,
  horarios: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'],
  duracionMin: 30,
  /** "Puedes cambiar el horario desde este enlace hasta el miércoles 7." */
  cierreCambios: '2026-10-07T23:59:59+02:00',
  direccion: 'Calle de Claudio Coello 38, 2º derecha, Madrid',
  urlBase: 'https://formaprima.es/cc38',
} as const

export const SLOT_IDS = EVENTO.horarios.map((t) => t.replace(':', ''))

export function finSlot(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const e = h * 60 + m + EVENTO.duracionMin
  return `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`
}

export function slotPorId(id: string): { id: string; t: string; end: string } | null {
  const t = EVENTO.horarios.find((x) => x.replace(':', '') === id)
  return t ? { id, t, end: finSlot(t) } : null
}

export const enlace = (token: string) => `${EVENTO.urlBase}/${token}`
