import type { Metadata, Viewport } from 'next'
import { getMapaPuntosPublic } from '@/app/actions/web-mapa'
import { requireFP } from '@/lib/visual-lab/guard'
import Presentacion from '@/components/para/Presentacion'
import type { LeadPara, Idioma } from '@/lib/para/textos'
import { AGENDA_BASE } from '@/lib/para/agenda'

// Muestra del dossier de prospección (portada, mapa y maqueta) con un lead de
// ejemplo, para dar el visto bueno al listón antes de construir el resto.
// Solo para el equipo; en local se abre sin sesión.

export const dynamic = 'force-dynamic'

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0d0d0d' }

export const metadata: Metadata = {
  title: { absolute: 'Forma Prima · Muestra' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

const FUENTE = 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@200;300;400;500;600&family=Newsreader:ital,opsz,wght@1,6..72,400&display=swap'

export default async function MuestraPage({ searchParams }: { searchParams: { lang?: string; perfil?: string } }) {
  if (process.env.NODE_ENV === 'production') await requireFP()
  const idioma: Idioma = searchParams.lang === 'en' ? 'en' : 'es'
  const lead: LeadPara = {
    nombre: 'Juan', empresa: 'Be Grand', perfil: searchParams.perfil === 'constructora' ? 'constructora' : 'developer', idioma, logo: null,
    contacto: { nombre: 'Ana Cristina', cargo: 'Desarrollo de negocio', email: 'aalban@formaprima.es', foto: '/para/equipo/team-ana-cristina.webp' },
  }
  const puntos = await getMapaPuntosPublic()
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FUENTE} />
      <Presentacion lead={lead} puntos={puntos} mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null} agenda={{ agenda: AGENDA_BASE, ocupadas: [], reunion: null }} />
    </>
  )
}
