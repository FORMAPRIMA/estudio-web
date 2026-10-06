import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPropuestaWeb } from '@/lib/propuestas/registro'
import { getSala, leadCookieName, leadDeCookie, leadVigente } from '@/lib/salas/servidor'
import PropuestaGate from '@/components/propuesta/PropuestaGate'

// Enlace personal de un lead: /propuesta/<slug>/acceso. Aunque el dossier sea
// público, aquí se pide el PIN de 6 cifras que identifica al lead (Salas). Si
// ese navegador ya está identificado, pasa directo.

export const dynamic = 'force-dynamic'
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover' }

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = getPropuestaWeb(params.slug)
  const robots = { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
  if (!p) return { title: { absolute: 'Forma Prima' }, robots }
  const title = p.audiencia === 'comprador' ? `${p.proyecto} · Dossier` : `Propuesta de honorarios · ${p.proyecto}`
  const imagen = `https://formaprima.es${p.og}`
  return {
    title: { absolute: `${title} — Forma Prima` },
    description: p.descripcion,
    robots,
    openGraph: { type: 'website', siteName: 'Forma Prima', locale: 'es_ES', title, description: p.descripcion, images: [{ url: imagen, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description: p.descripcion, images: [imagen] },
  }
}

const FUENTE = 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@200;300;400;500;600&family=Cormorant+Garamond:wght@400;500;600&display=swap'

export default async function AccesoPage({ params }: { params: { slug: string } }) {
  const p = getPropuestaWeb(params.slug)
  const sala = p ? await getSala(p.slug) : null
  if (!p || !sala) redirect(`/propuesta/${params.slug}`)

  const lead = leadDeCookie(p.slug, cookies().get(leadCookieName(p.slug))?.value)
  if (lead && await leadVigente(lead)) redirect(`/propuesta/${p.slug}`)

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FUENTE} />
      <PropuestaGate
        slug={p.slug}
        nombreCliente={p.nombreCliente}
        proyecto={p.proyecto}
        portada={p.portada}
        textos={p.pantallaPin}
        tema={p.tema}
        digitos={6}
        destino={`/propuesta/${p.slug}`}
      />
    </>
  )
}
