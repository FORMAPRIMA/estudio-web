// Alta de una persona del panel de Salas desde la terminal (para arrancar: las
// dos personas con rol de propiedad; el resto se da de alta desde el panel).
//   node scripts/salas/miembro.mjs "Nombre" --email x@y --rol propietario [--empresa X] --salida <fichero>
// El código NO se imprime: se añade al fichero de salida (permisos 600).
import { createHmac, randomInt } from 'crypto'
import { appendFileSync, chmodSync } from 'fs'
import { db, args } from './_db.mjs'

const { pos: [nombre], op } = args(process.argv.slice(2))
if (!nombre || !op.salida) { console.error('Uso: node scripts/salas/miembro.mjs "Nombre" --email E --rol propietario|comercial --salida <fichero>'); process.exit(1) }
const SECRET = process.env.PORTAL_SECRET ?? 'dev-only-secret-not-for-production'
const hmac = (c) => createHmac('sha256', SECRET).update(`sala-miembro:${c}`).digest('hex')

let codigo
for (;;) {
  const c = String(randomInt(10_000_000, 100_000_000))
  if (/(\d)\1{3}/.test(c) || '0123456789012'.includes(c.slice(0, 5)) || '9876543210987'.includes(c.slice(0, 5))) continue
  const { count } = await db.from('sala_miembros').select('id', { count: 'exact', head: true }).eq('codigo_hmac', hmac(c))
  if (!count) { codigo = c; break }
}
const rol = op.rol === 'propietario' ? 'propietario' : 'comercial'
const { error } = await db.from('sala_miembros').insert({ nombre, email: op.email ?? null, empresa: op.empresa ?? null, rol, codigo_hmac: hmac(codigo) })
if (error) throw new Error(error.message)
appendFileSync(op.salida, `${nombre} (${rol})${op.email ? ` · ${op.email}` : ''}\n  https://salas.formaprima.es\n  Código: ${codigo.slice(0, 4)} ${codigo.slice(4)}\n\n`)
chmodSync(op.salida, 0o600)
console.log(`${nombre} dado de alta como ${rol}. Código guardado en ${op.salida}`)
