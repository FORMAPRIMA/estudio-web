import { invitacion } from '@/lib/open-house/plantillas'
import { leerTodo } from '@/lib/open-house/datos'
import { usuarioEquipo } from '@/lib/open-house/equipo'
import { documento, respuestaHtml, esRelecturaDelRuntime } from '@/lib/open-house/servir'

// Panel del Open House (el mismo diseño, en modo estudio, sin PIN: se entra con
// la sesión del equipo). Lo enmarca /team/apps/open-house.

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!(await usuarioEquipo())) return new Response('No autorizado', { status: 403 })
  const datos = esRelecturaDelRuntime(req) ? { groups: [] } : await leerTodo()
  return respuestaHtml(documento(invitacion, { modo: 'admin', token: '', datos, endpoint: '/team/apps/open-house/app/accion' }))
}
