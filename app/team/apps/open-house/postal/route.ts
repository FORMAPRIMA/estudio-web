import { postal } from '@/lib/open-house/plantillas'
import { leerTodo } from '@/lib/open-house/datos'
import { usuarioEquipo } from '@/lib/open-house/equipo'
import { documento, respuestaHtml, esRelecturaDelRuntime } from '@/lib/open-house/servir'

// Postal A5 con QR de una invitación (?i=<token>&print=1 abre el diálogo de imprimir / PDF).

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!(await usuarioEquipo())) return new Response('No autorizado', { status: 403 })
  const datos = esRelecturaDelRuntime(req) ? { groups: [] } : await leerTodo()
  return respuestaHtml(documento(postal, { modo: 'admin', token: '', datos, endpoint: '' }))
}
