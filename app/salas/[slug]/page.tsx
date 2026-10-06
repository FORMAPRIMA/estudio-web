import { notFound, redirect } from 'next/navigation'
import { datosSala, etiquetasDossier, miembroActual, salaDe } from '@/lib/salas/panel'
import { getPropuestaWeb } from '@/lib/propuestas/registro'
import SalaPanel from '@/components/salas/SalaPanel'

export default async function SalaPage({ params }: { params: { slug: string } }) {
  const m = await miembroActual()
  if (!m) redirect('/')
  const sala = await salaDe(m, params.slug)
  if (!sala) notFound()
  const [datos, etiquetas] = await Promise.all([datosSala(sala.id), etiquetasDossier(sala.slug)])
  const p = getPropuestaWeb(sala.slug)
  return <SalaPanel slug={sala.slug} nombre={sala.nombre} proyecto={p?.proyecto ?? sala.nombre} accesoAnonimo={sala.accesoAnonimo} datos={datos} etiquetas={etiquetas} />
}
