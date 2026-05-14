// ── Business Days Utility ─────────────────────────────────────────────────────
// Toda la lógica de cronograma de FP Execution opera en DÍAS LABORABLES.
// 5 días laborables = 1 semana laborable.
//
// Convención:
//   - Sábado y domingo nunca son laborables
//   - Festivos nacionales españoles + festivos locales de Madrid se excluyen
//   - Los plazos administrativos (validez de licitación, recordatorios,
//     expiry de tokens) usan días naturales — esta utility no aplica ahí.
//
// Para añadir más años o festivos de otras CCAA: ampliar HOLIDAYS abajo.

const HOLIDAYS = new Set<string>([
  // ── 2024 — Nacionales ──
  '2024-01-01', // Año Nuevo
  '2024-01-06', // Reyes
  '2024-03-29', // Viernes Santo
  '2024-05-01', // Día del Trabajo
  '2024-08-15', // Asunción
  '2024-10-12', // Fiesta Nacional
  '2024-11-01', // Todos los Santos
  '2024-12-06', // Constitución
  '2024-12-09', // Inmaculada (trasladado)
  '2024-12-25', // Navidad
  // ── 2024 — Madrid ──
  '2024-03-28', // Jueves Santo
  '2024-05-02', // Día Comunidad de Madrid
  '2024-05-15', // San Isidro
  '2024-11-09', // Almudena

  // ── 2025 — Nacionales ──
  '2025-01-01',
  '2025-01-06',
  '2025-04-18', // Viernes Santo
  '2025-05-01',
  '2025-08-15',
  '2025-11-01',
  '2025-12-06',
  '2025-12-08',
  '2025-12-25',
  // ── 2025 — Madrid ──
  '2025-04-17', // Jueves Santo
  '2025-05-02',
  '2025-05-15',
  '2025-11-10', // Almudena trasladada

  // ── 2026 — Nacionales ──
  '2026-01-01',
  '2026-01-06',
  '2026-04-03', // Viernes Santo
  '2026-05-01',
  '2026-08-15', // sábado, sin efecto
  '2026-10-12',
  '2026-11-02', // Todos los Santos trasladado
  '2026-12-07', // Constitución trasladada
  '2026-12-08',
  '2026-12-25',
  // ── 2026 — Madrid ──
  '2026-04-02', // Jueves Santo
  '2026-05-15',
  '2026-11-09',

  // ── 2027 — Nacionales (provisional, revisar BOE cuando se publique) ──
  '2027-01-01',
  '2027-01-06',
  '2027-03-26',
  '2027-05-01', // sábado
  '2027-08-15', // domingo
  '2027-10-12',
  '2027-11-01',
  '2027-12-06',
  '2027-12-08',
  '2027-12-25', // sábado
])

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isBusinessDay(d: Date): boolean {
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return false // 0=domingo, 6=sábado
  return !HOLIDAYS.has(isoDate(d))
}

/**
 * Devuelve la fecha resultante de sumar n días laborables a `start`.
 * - Si n=0, devuelve `start` tal cual (sin normalizar a laborable).
 * - n se redondea al entero más cercano.
 * - Soporta n negativo (resta días laborables).
 */
export function addBusinessDays(start: Date, n: number): Date {
  const days = Math.round(n)
  if (days === 0) return new Date(start)
  const direction = days > 0 ? 1 : -1
  const target = Math.abs(days)
  const d = new Date(start)
  let count = 0
  while (count < target) {
    d.setDate(d.getDate() + direction)
    if (isBusinessDay(d)) count++
  }
  return d
}

/**
 * Si `d` cae en fin de semana o festivo, devuelve el siguiente día laborable.
 * Si ya es laborable, lo devuelve sin cambios.
 */
export function snapToNextBusinessDay(d: Date): Date {
  const out = new Date(d)
  while (!isBusinessDay(out)) {
    out.setDate(out.getDate() + 1)
  }
  return out
}

/**
 * Cuenta días laborables entre dos fechas (incluyendo `start`, excluyendo `end`).
 * Útil para medir cuántos días de trabajo han transcurrido.
 */
export function businessDaysBetween(start: Date, end: Date): number {
  if (end <= start) return 0
  let count = 0
  const d = new Date(start)
  while (d < end) {
    if (isBusinessDay(d)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/**
 * Días naturales (calendario) entre dos fechas, redondeado.
 * Útil para posicionar barras en el Gantt sobre un eje calendario.
 */
export function calendarDaysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}
