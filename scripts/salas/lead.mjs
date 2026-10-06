// Alta, listado y revocación de leads de una sala, hasta que exista el panel (fase 2).
//   node scripts/salas/lead.mjs <slug> "Nombre" [--empresa X] [--canal Y] [--email E] [--tel T] [--caduca 2026-12-31]
//   node scripts/salas/lead.mjs <slug> --lista
//   node scripts/salas/lead.mjs <slug> --revocar <PIN>
import { randomInt } from 'crypto'
import { db, sala, args } from './_db.mjs'

const { pos: [slug, nombre], op } = args(process.argv.slice(2))
if (!slug) { console.error('Uso: node scripts/salas/lead.mjs <slug> "Nombre" | --lista | --revocar <PIN>'); process.exit(1) }
const s = await sala(slug)
const enlace = `https://formaprima.es/propuesta/${slug}/acceso`

if (op.lista) {
  const { data } = await db.from('sala_leads').select('pin, nombre, empresa, canal, estado, caduca_en, created_at').eq('sala_id', s.id).order('created_at')
  console.table((data ?? []).map((l) => ({ PIN: l.pin, nombre: l.nombre, empresa: l.empresa ?? '', canal: l.canal ?? '', estado: l.estado, caduca: l.caduca_en?.slice(0, 10) ?? '' })))
  process.exit(0)
}

if (op.revocar) {
  const { data, error } = await db.from('sala_leads').update({ estado: 'revocado' }).eq('sala_id', s.id).eq('pin', String(op.revocar)).select('nombre')
  if (error) throw new Error(error.message)
  console.log(data?.length ? `Revocado el PIN ${op.revocar} (${data[0].nombre}).` : 'No existe ese PIN en la sala.')
  process.exit(0)
}

if (!nombre) { console.error('Falta el nombre del lead.'); process.exit(1) }
let pin
for (let k = 0; k < 20 && !pin; k++) {
  const c = String(randomInt(100000, 1000000))
  if (/^(\d)\1{5}$/.test(c) || '0123456789'.includes(c) || '9876543210'.includes(c)) continue
  const { count } = await db.from('sala_leads').select('id', { count: 'exact', head: true }).eq('sala_id', s.id).eq('pin', c)
  if (!count) pin = c
}
const { error } = await db.from('sala_leads').insert({
  sala_id: s.id, pin, nombre,
  empresa: op.empresa ?? null, canal: op.canal ?? null, email: op.email ?? null, telefono: op.tel ?? null,
  caduca_en: op.caduca ? new Date(`${op.caduca}T23:59:59Z`).toISOString() : null,
})
if (error) throw new Error(error.message)
console.log(`\n${nombre} · ${s.nombre}\n  Enlace: ${enlace}\n  PIN:    ${pin}\n\nEnvíalos por separado.`)
