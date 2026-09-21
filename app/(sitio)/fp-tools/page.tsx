import { redirect } from 'next/navigation'
import { SITE_BASE } from '@/lib/web-publica/base'
import { getFpToolsIndice } from '@/app/actions/web-fp-tools'
import { FpToolsVacio } from '@/components/public/site/fp-tools/FpToolsVacio'

export const dynamic = 'force-dynamic'

/**
 * FP Tools no tiene portada: la sección ES su primera capacidad.
 *
 * Se redirige en el SERVIDOR y no se pinta aquí la primera tool, aunque sería una
 * línea menos. Si esta ruta pintara lo mismo que /fp-tools/<primera>, habría dos
 * URLs con el mismo contenido: el buscador tendría que elegir una, la pestaña de
 * la barra no sabría cuál marcar, y compartir el enlace daría una cosa u otra
 * según por dónde se hubiera entrado. Una capacidad, una URL.
 */
export default async function Page() {
  const tools = await getFpToolsIndice()
  // Sin ninguna capacidad publicada no hay a dónde redirigir: antes que un bucle
  // o un 404, la sección dice que todavía no hay nada.
  if (!tools.length) return <FpToolsVacio />
  redirect(`${SITE_BASE}/fp-tools/${tools[0].slug}`)
}
