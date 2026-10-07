import { invitacion } from '@/lib/open-house/plantillas'
import { leerTodo, paraInvitado, marcarAbierto, tokenValido } from '@/lib/open-house/datos'
import { documento, respuestaHtml, esRelecturaDelRuntime } from '@/lib/open-house/servir'

// Invitación personal al Open House: formaprima.es/cc38/<token>. El diseño de
// Claude Design con los datos de SU grupo (ver lib/open-house/datos.ts).

export const dynamic = 'force-dynamic'

// El día del evento el mismo enlace (y el QR de la postal) lleva a la visita en
// directo: /cc38/<token>/visita. ?pase=1 vuelve siempre a la invitación;
// ?visita=1 adelanta el cambio (ensayos).
const DESDE_VISITA = Date.parse('2026-10-08T15:00:00+02:00')

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const token = tokenValido(params.token) ? params.token : ''
  const q = new URL(req.url).searchParams
  if (token && !esRelecturaDelRuntime(req) && q.get('pase') !== '1' && (Date.now() >= DESDE_VISITA || q.get('visita') === '1')) {
    return new Response(null, { status: 302, headers: { Location: `/cc38/${token}/visita`, 'Cache-Control': 'private, no-store' } })
  }
  let datos: unknown = { groups: [] }
  if (token && !esRelecturaDelRuntime(req)) {
    try {
      const r = paraInvitado(await leerTodo(), token)
      datos = r.datos
      if (r.valido) await marcarAbierto(token)
    } catch (e) {
      console.error('[open-house] leer', e)
    }
  }
  return respuestaHtml(documento(invitacion, { modo: 'invitado', token, datos, endpoint: `/cc38/${token}/accion` }))
}
