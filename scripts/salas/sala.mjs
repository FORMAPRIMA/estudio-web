// Alta de una sala (el panel crea leads, no salas).
//   node scripts/salas/sala.mjs <slug> "Nombre" [--anonimo] [--compartible]
//   sin --anonimo: solo con PIN personal · sin --compartible: confidencial (no se puede
//   asignar a comerciales; las propuestas de honorarios). Al actualizar una sala que ya
//   existe no se toca su confidencialidad salvo que se pase --compartible.
import { db, args } from './_db.mjs'
const { pos: [slug, nombre], op } = args(process.argv.slice(2))
if (!slug || !nombre) { console.error('Uso: node scripts/salas/sala.mjs <slug> "Nombre" [--anonimo]'); process.exit(1) }
const fila = { slug, nombre, acceso_anonimo: !!op.anonimo, activa: true, ...(op.compartible ? { confidencial: false } : {}) }
const { data, error } = await db.from('sala_salas')
  .upsert(fila, { onConflict: 'slug' })
  .select('id, slug, nombre, acceso_anonimo, confidencial').single()
if (error) throw new Error(error.message)
console.log(`Sala lista: ${data.nombre} (${data.slug}) · ${data.acceso_anonimo ? 'enlace abierto (anónimo)' : 'solo con PIN personal'} · ${data.confidencial === false ? 'abierta al equipo' : 'confidencial'}`)
