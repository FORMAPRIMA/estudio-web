// Agenda viva del dossier de prospección. Puro (cliente y servidor): el servidor
// recalcula lo mismo al reservar, así que nadie puede pedir un hueco que no se
// ofreció.
//
// Regla: desde el día en que se ve el dossier se saltan los 5 días laborables
// siguientes y se ofrecen los días 6 a 10 (sin fines de semana ni festivos de
// Madrid). Las franjas son fijas, de quien envió el enlace, en su zona horaria;
// se muestran en la del visitante.

export interface Agenda {
  zona: string          // zona de las franjas (la de quien envía): 'Europe/Madrid'
  franjas: string[]     // 'HH:MM'
  minutos: number
}

// Mañana y tarde de Madrid: así siempre quedan horas decentes también para América
// (las 16:00 de Madrid son las 9:00 en Ciudad de México y las 10:00 en Miami).
export const AGENDA_BASE: Agenda = { zona: 'Europe/Madrid', franjas: ['09:30', '11:00', '12:30', '16:00', '17:30', '19:00'], minutos: 30 }

/** Solo se enseñan las franjas que caen entre las 8:00 y las 20:00 de quien mira. */
export function horaRazonable(inicio: string, zonaVisitante: string): boolean {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: zonaVisitante, hour: '2-digit', hourCycle: 'h23' }).format(new Date(inicio)))
  return h >= 8 && h < 20
}

export function agendaDe(v: unknown): Agenda {
  const a = (v && typeof v === 'object' ? v : {}) as Partial<Agenda>
  const franjas = Array.isArray(a.franjas) ? a.franjas.filter((f) => typeof f === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(f)).sort() : []
  return {
    zona: typeof a.zona === 'string' && a.zona ? a.zona : AGENDA_BASE.zona,
    franjas: franjas.length ? Array.from(new Set(franjas)).slice(0, 8) : AGENDA_BASE.franjas,
    minutos: [20, 30, 45, 60].includes(Number(a.minutos)) ? Number(a.minutos) : AGENDA_BASE.minutos,
  }
}

// Festivos nacionales, de la Comunidad y de la ciudad de Madrid. Revisar cada
// año con el calendario laboral del BOCM.
const FESTIVOS = new Set([
  '2026-01-01', '2026-01-06', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-02', '2026-05-15', '2026-08-15',
  '2026-10-12', '2026-11-02', '2026-11-09', '2026-12-07', '2026-12-08', '2026-12-25',
  '2027-01-01', '2027-01-06', '2027-03-25', '2027-03-26', '2027-05-01', '2027-05-03', '2027-05-15', '2027-08-16',
  '2027-10-12', '2027-11-01', '2027-11-09', '2027-12-06', '2027-12-08', '2027-12-25',
])

const SALTO = 5, OFERTA = 5

/** 'AAAA-MM-DD' de un instante en una zona horaria. */
export function fechaEn(d: Date, zona: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

const laborable = (f: string) => {
  const dow = new Date(`${f}T12:00:00Z`).getUTCDay()
  return dow !== 0 && dow !== 6 && !FESTIVOS.has(f)
}
const masUno = (f: string) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }

/** Los días que se ofrecen hoy (en la zona de la agenda). */
export function diasOfrecidos(ahora: Date, zona: string): string[] {
  let f = fechaEn(ahora, zona), saltados = 0
  const dias: string[] = []
  while (dias.length < OFERTA) {
    f = masUno(f)
    if (!laborable(f)) continue
    if (saltados < SALTO) { saltados++; continue }
    dias.push(f)
  }
  return dias
}

/** Desfase (ms) de una zona respecto a UTC en un instante. */
function desfase(instante: number, zona: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instante)).map((x) => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - instante
}

/** Hora local de una zona («2026-11-04», «10:00», «Europe/Madrid») → instante UTC. */
export function aInstante(fecha: string, hora: string, zona: string): Date {
  const [y, m, d] = fecha.split('-').map(Number), [h, mi] = hora.split(':').map(Number)
  const ingenuo = Date.UTC(y, m - 1, d, h, mi)
  let t = ingenuo - desfase(ingenuo, zona)
  t = ingenuo - desfase(t, zona)   // segunda pasada: días de cambio de hora
  return new Date(t)
}

export interface Hueco { inicio: string; fecha: string; hora: string }

/** Todos los huecos ofrecidos hoy, menos los ocupados (instantes ISO). */
export function huecos(ahora: Date, agenda: Agenda, ocupadas: string[] = []): Hueco[] {
  const fuera = new Set(ocupadas.map((x) => new Date(x).toISOString()))
  return diasOfrecidos(ahora, agenda.zona).flatMap((fecha) => agenda.franjas.map((hora) => {
    const inicio = aInstante(fecha, hora, agenda.zona).toISOString()
    return { inicio, fecha, hora }
  })).filter((h) => !fuera.has(h.inicio))
}

/** ¿Es este instante uno de los huecos ofrecidos hoy? (para validar en servidor) */
export const esHuecoValido = (inicio: string, ahora: Date, agenda: Agenda, ocupadas: string[]) =>
  huecos(ahora, agenda, ocupadas).some((h) => h.inicio === new Date(inicio).toISOString())

// ── .ics ──────────────────────────────────────────────────────────────────────

const icsFecha = (d: Date) => d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
const icsTexto = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`)

export function icsReunion(o: { uid: string; inicio: Date; minutos: number; titulo: string; descripcion: string; organizador: string }): string {
  const fin = new Date(o.inicio.getTime() + o.minutos * 60_000)
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Forma Prima//Salas//ES', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${o.uid}@formaprima.es`, `DTSTAMP:${icsFecha(new Date())}`, `DTSTART:${icsFecha(o.inicio)}`, `DTEND:${icsFecha(fin)}`,
    `SUMMARY:${icsTexto(o.titulo)}`, `DESCRIPTION:${icsTexto(o.descripcion)}`, `ORGANIZER;CN=Forma Prima:mailto:${o.organizador}`,
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
}
