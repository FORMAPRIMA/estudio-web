// Informe en consola de una sala (hasta que exista el panel, fase 2).
//   node scripts/salas/informe.mjs <slug> [--lead <PIN>]
import { db, sala, args } from './_db.mjs'

const { pos: [slug], op } = args(process.argv.slice(2))
const s = await sala(slug)
const { data: leads } = await db.from('sala_leads').select('id, pin, nombre').eq('sala_id', s.id)
const porId = new Map((leads ?? []).map((l) => [l.id, l]))
let q = db.from('sala_sesiones').select('*').eq('sala_id', s.id).order('inicio', { ascending: false }).limit(500)
if (op.lead) {
  const l = (leads ?? []).find((x) => x.pin === String(op.lead))
  if (!l) throw new Error('No existe ese PIN.')
  q = q.eq('lead_id', l.id)
}
const { data: ses } = await q
const ids = (ses ?? []).map((x) => x.id)
const { data: vistas } = ids.length ? await db.from('sala_vistas').select('*').in('sesion_id', ids) : { data: [] }
const { data: eventos } = ids.length ? await db.from('sala_eventos').select('*').in('sesion_id', ids) : { data: [] }

const min = (ms) => `${Math.round(ms / 1000 / 6) / 10} min`
const madrid = (iso) => new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

console.log(`\n${s.nombre} — ${ses?.length ?? 0} sesiones (${(ses ?? []).filter((x) => x.lead_id).length} identificadas)\n`)
console.table((ses ?? []).slice(0, 25).map((x) => ({
  cuando: madrid(x.inicio), quien: x.lead_id ? `${porId.get(x.lead_id)?.nombre} (${porId.get(x.lead_id)?.pin})` : 'anónimo',
  desde: [x.ciudad, x.pais].filter(Boolean).join(', '), dispositivo: x.dispositivo, activo: min(x.activo_ms),
  hasta: x.total_slides ? `${x.max_slide + 1}/${x.total_slides}` : '-', final: x.final ? 'sí' : '',
})))

const calor = new Map()
for (const v of vistas ?? []) {
  const c = calor.get(v.slide) ?? { etiqueta: v.etiqueta, ms: 0, sesiones: 0 }
  c.ms += v.ms; c.sesiones += 1; if (v.etiqueta) c.etiqueta = v.etiqueta
  calor.set(v.slide, c)
}
const maxMs = Math.max(1, ...Array.from(calor.values(), (c) => c.ms))
console.log('\nMapa de calor (tiempo activo total por diapositiva)\n')
for (const [slide, c] of [...calor].sort((a, b) => a[0] - b[0])) {
  const barra = '█'.repeat(Math.round((c.ms / maxMs) * 30)).padEnd(30, '·')
  console.log(`${String(slide + 1).padStart(3)} ${String(c.etiqueta ?? '').slice(0, 24).padEnd(24)} ${barra} ${min(c.ms).padStart(9)} · ${c.sesiones} ses.`)
}
const cuenta = {}
for (const e of eventos ?? []) cuenta[e.tipo] = (cuenta[e.tipo] ?? 0) + 1
console.log('\nInteracciones:', Object.keys(cuenta).length ? cuenta : 'ninguna', '\n')
