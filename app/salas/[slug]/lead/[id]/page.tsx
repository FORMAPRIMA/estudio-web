import { notFound, redirect } from 'next/navigation'
import { datosSala, etiquetasDossier, miembroActual, salaDe } from '@/lib/salas/panel'
import { getPropuestaWeb } from '@/lib/propuestas/registro'
import LeadFicha from '@/components/salas/LeadFicha'

export default async function LeadPage({ params }: { params: { slug: string; id: string } }) {
  const m = await miembroActual()
  if (!m) redirect('/')
  const sala = await salaDe(m, params.slug)
  if (!sala || !/^[0-9a-f-]{36}$/.test(params.id)) notFound()
  const [datos, etiquetas] = await Promise.all([datosSala(sala.id, { leadId: params.id }), etiquetasDossier(sala.slug)])
  if (!datos.leads.length) notFound()
  const p = getPropuestaWeb(sala.slug)
  return <LeadFicha slug={sala.slug} sala={sala.nombre} proyecto={p?.proyecto ?? sala.nombre} datos={datos} etiquetas={etiquetas} />
}
