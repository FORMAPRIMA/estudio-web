// Alta de una sala (el panel crea leads, no salas).
//   node scripts/salas/sala.mjs <slug> "Nombre" [--anonimo]   (sin --anonimo: solo con PIN personal)
import { db, args } from './_db.mjs'
const { pos: [slug, nombre], op } = args(process.argv.slice(2))
if (!slug || !nombre) { console.error('Uso: node scripts/salas/sala.mjs <slug> "Nombre" [--anonimo]'); process.exit(1) }
const { data, error } = await db.from('sala_salas')
  .upsert({ slug, nombre, acceso_anonimo: !!op.anonimo, activa: true }, { onConflict: 'slug' })
  .select('id, slug, nombre, acceso_anonimo').single()
if (error) throw new Error(error.message)
console.log(`Sala lista: ${data.nombre} (${data.slug}) · ${data.acceso_anonimo ? 'enlace abierto (anónimo)' : 'solo con PIN personal'}`)
