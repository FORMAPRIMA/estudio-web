import type { Metadata, Viewport } from 'next'
import { getMapaPuntosPublic } from '@/app/actions/web-mapa'
import { prospectoPorToken } from '@/lib/salas/prospeccion'
import Presentacion from '@/components/para/Presentacion'

// Dossier del estudio personalizado para un lead: formaprima.es/para/<token>.
// El enlace es la llave (sin PIN). Se da de alta en salas.formaprima.es, en una
// sala de prospección (developers o constructoras).

export const dynamic = 'force-dynamic'

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0d0d0d' }

const robots = { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const p = await prospectoPorToken(params.token)
  if (!p) return { title: { absolute: 'Forma Prima' }, robots }
  const en = p.lead.idioma === 'en'
  const title = `Forma Prima × ${p.lead.empresa}`
  const description = en
    ? `Prepared for ${p.lead.empresa}. Architecture and design studio · Madrid · Spain, US, Mexico and Ecuador.`
    : `Preparado para ${p.lead.empresa}. Estudio de arquitectura y diseño · Madrid · España, EE. UU., México y Ecuador.`
  return {
    title: { absolute: title }, description, robots,
    openGraph: { type: 'website', siteName: 'Forma Prima', locale: en ? 'en_US' : 'es_ES', title, description },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const FUENTE = 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@200;300;400;500;600&family=Newsreader:ital,opsz,wght@1,6..72,400&display=swap'

export default async function ParaPage({ params }: { params: { token: string } }) {
  const p = await prospectoPorToken(params.token)
  const fuente = (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FUENTE} />
    </>
  )
  if (!p) {
    return (
      <main style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', background: '#0d0d0d', color: '#fbfbfa', fontFamily: "'Hanken Grotesk',sans-serif", padding: 24, textAlign: 'center' }}>
        {fuente}
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/para/logo-h-white.png" alt="Forma Prima" style={{ height: 18, margin: '0 auto 36px', display: 'block' }} />
          <h1 style={{ fontWeight: 200, fontSize: 32, margin: '0 0 12px', letterSpacing: '-.02em' }}>Este enlace ya no está disponible</h1>
          <p style={{ fontSize: 15, color: 'rgba(251,251,250,.7)', margin: 0, lineHeight: 1.6 }}>
            Escríbenos a <a href="mailto:contacto@formaprima.es" style={{ color: '#8fa596' }}>contacto@formaprima.es</a> y te lo enviamos de nuevo.
          </p>
        </div>
      </main>
    )
  }
  const puntos = await getMapaPuntosPublic()
  return (
    <>
      {fuente}
      <Presentacion lead={p.lead} puntos={puntos} mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null} />
    </>
  )
}
