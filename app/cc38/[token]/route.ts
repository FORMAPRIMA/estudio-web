import { invitacion } from '@/lib/open-house/plantillas'
import { leerTodo, paraInvitado, marcarAbierto, tokenValido } from '@/lib/open-house/datos'
import { documento, respuestaHtml, esRelecturaDelRuntime } from '@/lib/open-house/servir'

// Invitación personal al Open House: formaprima.es/cc38/<token>. El diseño de
// Claude Design con los datos de SU grupo (ver lib/open-house/datos.ts).

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const token = tokenValido(params.token) ? params.token : ''
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
