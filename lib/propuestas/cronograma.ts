// Programación del cronograma de fases y de los hitos de pago de una propuesta /
// contrato. Es la ÚNICA fuente de esta lógica: la usa el cronograma visual del
// Espacio (PropuestaCronograma) y la tabla de hitos del PDF del contrato, de modo
// que las fechas que ve el cliente en pantalla y en el contrato siempre cuadran.
// Todas las duraciones se expresan en días hábiles (L–V).

// Orden cronológico de las fases. Solo se programan las presentes en la propuesta.
// "licitacion" es una fase sintética fija (10 días háb.) entre el fin del proyecto
// de ejecución y el comienzo de la obra.
export const CRONO_ORDER = ['anteproyecto', 'proyecto_ejecucion', 'licitacion', 'interiorismo', 'direccion_obra', 'gestion_interiorismo'] as const

export const LICITACION_DIAS = 10

export const CRONO_META: Record<string, { label: string; color: string }> = {
  anteproyecto:         { label: 'Anteproyecto',            color: '#D85A30' },
  proyecto_ejecucion:   { label: 'Proyecto de ejecución',   color: '#C0572C' },
  licitacion:           { label: 'Licitación de obra',      color: '#A89B8C' },
  interiorismo:         { label: 'Interiorismo',            color: '#B08D57' },
  direccion_obra:       { label: 'Ejecución de obra',       color: '#6B7280' },
  gestion_interiorismo: { label: 'Gestión de interiorismo', color: '#8A8170' },
}

// Forma mínima común a PropuestaVMServicio y ServicioContrato.
export interface CronoServicio {
  id: string
  label: string
  semanas: string
  pago: { label: string; pct: number; importe?: number }[]
}

export interface CronoBar {
  id: string
  label: string
  color: string
  start: number
  span: number
  open: boolean
  durLabel: string
  dias: number | null   // días hábiles a mostrar centrados en la barra
}

export interface CronoPago {
  day: number          // posición en el timeline (días hábiles desde el inicio)
  importe: number
  servicioId: string
  servicio: string
  hito: string
  pct: number
  abierto: boolean     // hito ligado a avance de obra (sin fecha comprometida)
}

export interface Cronograma {
  bars: CronoBar[]
  pagos: CronoPago[]
  total: number
  definedDias: number
  hasLicitacion: boolean
}

// Extrae días hábiles de un texto de plazo. "12 días hábiles" → 12; "6–8 semanas"
// → media×5; sin número (p.ej. "Según programa de obra") → null (fase abierta).
export function parseDias(s?: string): number | null {
  if (!s) return null
  const nums = s.match(/\d+(?:[.,]\d+)?/g)?.map(n => parseFloat(n.replace(',', '.'))) ?? []
  if (nums.length === 0) return null
  const v = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0]
  const lc = s.toLowerCase()
  if (lc.includes('semana') || lc.includes('week')) return Math.round(v * 5)
  if (lc.includes('mes') || lc.includes('month')) return Math.round(v * 21)
  return Math.round(v)
}

// Suma n días hábiles (L–V) a una fecha. n puede ser fraccional (se redondea).
export function addBusinessDays(base: Date, dias: number): Date {
  const d = new Date(base)
  let remaining = Math.round(dias)
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) remaining--
  }
  return d
}

// Días hábiles transcurridos entre dos fechas (para posicionar "hoy" en el timeline).
export function businessDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0
  const d = new Date(from)
  let count = 0
  while (d < to) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

export function buildCronograma(servicios: CronoServicio[]): Cronograma | null {
  const byId = new Map(servicios.map(s => [s.id, s]))
  const present: string[] = CRONO_ORDER.filter(id => id !== 'licitacion' && byId.has(id))
  if (present.length === 0) return null

  const diasOf = (id: string) => parseDias(byId.get(id)?.semanas)
  const SMALL = 10 // ancho mínimo para una fase sin número

  const has = (id: string) => present.includes(id)
  const placed: Record<string, CronoBar> = {}
  const add = (id: string, start: number, span: number, open: boolean, durLabel: string, dias: number | null) => {
    placed[id] = { id, label: CRONO_META[id].label, color: CRONO_META[id].color, start, span: Math.max(span, 6), open, durLabel, dias }
  }

  // 1) Fases de diseño previas a obra, secuenciales: anteproyecto → proyecto de ejecución.
  let cursor = 0
  for (const id of ['anteproyecto', 'proyecto_ejecucion']) {
    if (!has(id)) continue
    const d = diasOf(id)
    const defined = !!(d && d > 0)
    const span = defined ? (d as number) : SMALL
    add(id, cursor, span, !defined, defined ? `≈ ${d} días háb.` : 'Por definir', defined ? (d as number) : null)
    cursor += span
  }
  const designEnd = cursor

  // 2) Licitación de obra: barra fija de 10 días háb. entre el fin del proyecto de
  //    ejecución y el comienzo de la obra. Solo aplica si hay obra en el alcance.
  const hasLicitacion = has('direccion_obra')
  if (hasLicitacion) {
    add('licitacion', designEnd, LICITACION_DIAS, false, `${LICITACION_DIAS} días háb.`, LICITACION_DIAS)
  }
  const obraStart = designEnd + (hasLicitacion ? LICITACION_DIAS : 0)

  // 3) Obra: barra abierta (duración sin definir) que arranca tras la licitación.
  const interiDias = has('interiorismo') ? diasOf('interiorismo') : null
  const interiDefined = !!(interiDias && interiDias > 0)
  // La obra debe ser lo bastante larga para contener el solape de interiorismo + la cola de gestión.
  const nominalObra = Math.max(Math.round(designEnd * 0.8), Math.round((interiDias ?? 0) * 1.4) - (hasLicitacion ? LICITACION_DIAS : 0), 30)
  const obraEnd = obraStart + nominalObra
  if (has('direccion_obra')) {
    add('direccion_obra', obraStart, nominalObra, true, 'Según proyecto de obra', null)
  }

  // 4) Interiorismo: arranca cuando TERMINA el proyecto de ejecución (corre en
  //    paralelo a la licitación y al arranque de obra).
  if (has('interiorismo')) {
    const span = interiDefined ? (interiDias as number) : SMALL
    add('interiorismo', designEnd, span, !interiDefined, interiDefined ? `≈ ${interiDias} días háb.` : 'Por definir', interiDefined ? (interiDias as number) : null)
  }

  // 5) Gestión de interiorismo: su FINAL coincide con el final de la obra (cola de obra).
  //    Sin obra, termina con el interiorismo.
  if (has('gestion_interiorismo')) {
    const interiEnd = placed['interiorismo'] ? placed['interiorismo'].start + placed['interiorismo'].span : designEnd
    const endRef = has('direccion_obra') ? obraEnd : interiEnd
    const startRef = has('direccion_obra') ? obraStart : designEnd
    const gestSpan = Math.max(Math.round((endRef - startRef) * 0.45), SMALL)
    add('gestion_interiorismo', Math.max(endRef - gestSpan, 0), gestSpan, true, 'Hasta fin de obra', null)
  }

  const bars: CronoBar[] = CRONO_ORDER.filter(id => placed[id]).map(id => placed[id])
  const definedDias = ['anteproyecto', 'proyecto_ejecucion'].reduce((s, id) => s + (has(id) ? (diasOf(id) ?? 0) : 0), 0)
    + (hasLicitacion ? LICITACION_DIAS : 0)
  const total = Math.max(...bars.map(b => b.start + b.span), 1)

  // ── Hitos de pago: uno por hito, posicionado en su momento del cronograma ───
  // Regla (la misma que usa el cálculo de fechas de facturas al firmar): hito "a la
  // firma" → día 0; último hito de una fase → fin de su barra; intermedios →
  // proporcional. Hitos de fases abiertas (obra) → repartidos sobre la barra, sin
  // fecha comprometida.
  const pagos: CronoPago[] = []
  for (const id of CRONO_ORDER) {
    const bar = placed[id]
    const svc = byId.get(id)
    if (!bar || !svc || !svc.pago?.length) continue
    svc.pago.forEach((p, i) => {
      const esALaFirma = p.label.toLowerCase().includes('firma')
      const frac = svc.pago.length === 1 ? 1 : i / (svc.pago.length - 1)
      pagos.push({
        day:        esALaFirma ? 0 : bar.start + bar.span * frac,
        importe:    p.importe ?? 0,
        servicioId: svc.id,
        servicio:   svc.label,
        hito:       p.label,
        pct:        p.pct,
        abierto:    bar.open && !esALaFirma,
      })
    })
  }
  pagos.sort((a, b) => a.day - b.day)

  return { bars, pagos, total, definedDias, hasLicitacion }
}
