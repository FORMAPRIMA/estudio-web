// Prueba de integridad del flujo crítico de la porra contra la BD real:
// registro (nombre+PIN) → login → predicción → relectura → constraints → limpieza.
// Uso: node scripts/test-quiniela-db.mjs
import { createClient } from '@supabase/supabase-js'
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { readFileSync } from 'fs'

// Cargar .env.local
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// Réplica exacta de lib/quiniela/auth.ts
function hashPin(pin) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}`
}
function verifyPin(pin, stored) {
  const [salt, hash] = stored.split(':')
  const calc = scryptSync(pin, salt, 32).toString('hex')
  return timingSafeEqual(Buffer.from(calc), Buffer.from(hash))
}

let fallos = 0
function check(nombre, ok, detalle = '') {
  console.log(`${ok ? '✅' : '❌'} ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallos++
}

const TEST_NAME = `__test_bot_${Date.now()}`

// 1. Registro
const { data: jugador, error: e1 } = await admin
  .from('quiniela_jugadores')
  .insert({ nombre: TEST_NAME, pin_hash: hashPin('1234') })
  .select('*')
  .single()
check('Registro de jugador externo', !e1 && !!jugador?.id, e1?.message)

// 2. Nombre duplicado (case-insensitive) debe fallar
const { error: e2 } = await admin
  .from('quiniela_jugadores')
  .insert({ nombre: TEST_NAME.toUpperCase(), pin_hash: hashPin('9999') })
check('Nombre duplicado rechazado (constraint)', e2?.code === '23505', e2?.code)

// 3. Login: buscar por nombre case-insensitive + verificar PIN
const { data: encontrado } = await admin
  .from('quiniela_jugadores').select('id, pin_hash')
  .ilike('nombre', TEST_NAME.toUpperCase()).maybeSingle()
check('Login: búsqueda case-insensitive', encontrado?.id === jugador.id)
check('Login: PIN correcto verifica', verifyPin('1234', encontrado.pin_hash))
check('Login: PIN incorrecto NO verifica', !verifyPin('4321', encontrado.pin_hash))

// 4. Predicción sobre un partido real futuro
const { data: partido } = await admin
  .from('quiniela_partidos').select('id, numero')
  .eq('estado', 'programado').order('numero', { ascending: false }).limit(1).single()
const { error: e4 } = await admin.from('quiniela_predicciones').upsert({
  jugador_id: jugador.id, partido_id: partido.id,
  goles_local: 2, goles_visitante: 1, updated_at: new Date().toISOString(),
}, { onConflict: 'jugador_id,partido_id' })
check(`Predicción guardada (partido #${partido.numero})`, !e4, e4?.message)

// 5. Upsert: editar la misma predicción no duplica
const { error: e5 } = await admin.from('quiniela_predicciones').upsert({
  jugador_id: jugador.id, partido_id: partido.id,
  goles_local: 3, goles_visitante: 0, updated_at: new Date().toISOString(),
}, { onConflict: 'jugador_id,partido_id' })
const { data: preds } = await admin.from('quiniela_predicciones')
  .select('goles_local, goles_visitante').eq('jugador_id', jugador.id)
check('Upsert edita sin duplicar', !e5 && preds?.length === 1
  && preds[0].goles_local === 3 && preds[0].goles_visitante === 0,
  `${preds?.length} filas, ${JSON.stringify(preds?.[0])}`)

// 6. Pick de campeón
const { data: equipo } = await admin.from('quiniela_equipos').select('id').limit(1).single()
const { error: e6 } = await admin.from('quiniela_picks_campeon').upsert({
  jugador_id: jugador.id, ventana: 'apertura', equipo_id: equipo.id,
}, { onConflict: 'jugador_id,ventana' })
check('Pick de campeón guardado', !e6, e6?.message)

// 7. Datos del fixture: conteos y partido 29
const { count: nEquipos } = await admin.from('quiniela_equipos').select('id', { count: 'exact', head: true })
const { count: nPartidos } = await admin.from('quiniela_partidos').select('id', { count: 'exact', head: true })
const { data: p29 } = await admin.from('quiniela_partidos').select('fecha_hora').eq('numero', 29).single()
check('48 equipos en BD', nEquipos === 48, `hay ${nEquipos}`)
check('104 partidos en BD', nPartidos === 104, `hay ${nPartidos}`)
check('Partido 29 corregido a 01:00Z', new Date(p29.fecha_hora).toISOString() === '2026-06-20T01:00:00.000Z', p29.fecha_hora)

// 8. Limpieza (cascade borra predicciones y picks)
const { error: e8 } = await admin.from('quiniela_jugadores').delete().eq('id', jugador.id)
const { count: quedan } = await admin.from('quiniela_predicciones')
  .select('id', { count: 'exact', head: true }).eq('jugador_id', jugador.id)
check('Limpieza con cascade', !e8 && quedan === 0)

console.log(fallos === 0 ? '\n🟢 TODO OK — el flujo de datos es fiable.' : `\n🔴 ${fallos} FALLOS`)
process.exit(fallos === 0 ? 0 : 1)
