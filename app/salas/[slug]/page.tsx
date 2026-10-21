import { notFound, redirect } from 'next/navigation'
import { datosSala, etiquetasDossier, miembroActual, salaDe } from '@/lib/salas/panel'
import { getPropuestaWeb } from '@/lib/propuestas/registro'
import SalaPanel from '@/components/salas/SalaPanel'
import ProspeccionPanel from '@/components/salas/Prospeccion'

export default async function SalaPage({ params }: { params: { slug: string } }) {
  const m = await miembroActual()
  if (!m) redirect('/')
  const sala = await salaDe(m, params.slug)
  if (!sala) notFound()
  if (sala.tipo === 'prospeccion') {
    return <ProspeccionPanel slug={sala.slug} nombre={sala.nombre} perfil={sala.perfil ?? 'developer'} firma={m.nombre} datos={await datosSala(sala.id)} />
  }
  const [datos, etiquetas] = await Promise.all([datosSala(sala.id), etiquetasDossier(sala.slug)])
  const p = getPropuestaWeb(sala.slug)
  return <SalaPanel slug={sala.slug} nombre={sala.nombre} proyecto={p?.proyecto ?? sala.nombre} accesoAnonimo={sala.accesoAnonimo} datos={datos} etiquetas={etiquetas} />
}
