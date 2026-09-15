/**
 * Verifica la red de seguridad que impide que una factura a proveedor (margen de
 * obra, rappel o descuento de mobiliario) llegue al cliente del proyecto.
 *
 *   set -a && . ./.env.local && set +a && npx tsx scripts/test-guard-facturas.ts
 *
 * Solo lectura: no crea, modifica ni envía nada. Ejecutar tras tocar
 * lib/finanzas/guardCliente.ts o las rutas de envío de facturas emitidas.
 */
import { createClient } from '@supabase/supabase-js'
import {
  assertSinClientesEnDestinatarios,
  getEmailsClientesProyecto,
  ClienteEnDestinatariosError,
} from '../lib/finanzas/guardCliente'

const PROYECTO = 'fcb79619-6269-4122-bfc5-adadc8ad10fb'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
) as unknown as { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

let fallos = 0
const check = (nombre: string, ok: boolean, detalle = '') => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${nombre}${detalle ? ' — ' + detalle : ''}`)
  if (!ok) fallos++
}

async function main() {
  const emails = await getEmailsClientesProyecto(admin, PROYECTO)
  console.log('\nEmails de cliente detectados en el proyecto:', Array.from(emails))
  check('el guard conoce los emails del cliente', emails.size > 0, `${emails.size} encontrados`)

  const emailCliente = Array.from(emails)[0]
  const emailCC      = Array.from(emails)[1]

  console.log('\n1. Envío correcto: solo al proveedor')
  try {
    await assertSinClientesEnDestinatarios(admin, {
      proyectoId: PROYECTO,
      to: ['reformasarmico@gmail.com'],
      cc: ['jlorag@formaprima.es'],
    })
    check('deja pasar el envío al proveedor', true)
  } catch {
    check('deja pasar el envío al proveedor', false, 'bloqueó un envío legítimo')
  }

  console.log('\n2. Fuga en el TO: el cliente como destinatario principal')
  try {
    await assertSinClientesEnDestinatarios(admin, {
      proyectoId: PROYECTO, to: [emailCliente],
    })
    check('bloquea al cliente en TO', false, 'NO bloqueó')
  } catch (e) {
    check('bloquea al cliente en TO', e instanceof ClienteEnDestinatariosError)
  }

  console.log('\n3. Fuga en CC, con el proveedor en TO')
  try {
    await assertSinClientesEnDestinatarios(admin, {
      proyectoId: PROYECTO, to: ['reformasarmico@gmail.com'], cc: [emailCliente],
    })
    check('bloquea al cliente en CC', false, 'NO bloqueó')
  } catch (e) {
    check('bloquea al cliente en CC', e instanceof ClienteEnDestinatariosError)
  }

  console.log('\n4. Fuga en BCC (la más difícil de detectar a ojo)')
  try {
    await assertSinClientesEnDestinatarios(admin, {
      proyectoId: PROYECTO, to: ['reformasarmico@gmail.com'], bcc: [emailCliente],
    })
    check('bloquea al cliente en BCC', false, 'NO bloqueó')
  } catch (e) {
    check('bloquea al cliente en BCC', e instanceof ClienteEnDestinatariosError)
  }

  console.log('\n5. Fuga por el email secundario (email_cc del cliente)')
  if (emailCC) {
    try {
      await assertSinClientesEnDestinatarios(admin, {
        proyectoId: PROYECTO, to: [emailCC],
      })
      check('bloquea el email secundario del cliente', false, 'NO bloqueó')
    } catch (e) {
      check('bloquea el email secundario del cliente', e instanceof ClienteEnDestinatariosError)
    }
  }

  console.log('\n6. Mayúsculas y espacios (no debe colarse por normalización)')
  try {
    await assertSinClientesEnDestinatarios(admin, {
      proyectoId: PROYECTO, to: ['  ' + emailCliente.toUpperCase() + ' '],
    })
    check('normaliza antes de comparar', false, 'NO bloqueó')
  } catch (e) {
    check('normaliza antes de comparar', e instanceof ClienteEnDestinatariosError)
  }

  console.log(`\n${fallos === 0 ? '✅ Todo correcto' : `❌ ${fallos} fallo(s)`}\n`)
  process.exit(fallos === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
