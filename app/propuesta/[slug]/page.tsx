import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { getPropuestaWeb, cargarDeck } from '@/lib/propuestas/registro'
import { propuestaCookieName, propuestaCookieValue } from '@/lib/propuestas/acceso'
import { getProyectosSite } from '@/app/actions/web-publica'
import { getManifiesto } from '@/app/actions/web-assets'
import { urlVariante } from '@/lib/web-publica/imagenes'
import PropuestaGate from '@/components/propuesta/PropuestaGate'
import PropuestaDeck from '@/components/propuesta/PropuestaDeck'
import type { ProyectoEnlace } from '@/components/propuesta/SlideSiguiente'

// Propuesta de honorarios de un cliente: formaprima.es/propuesta/<slug>.
// Ver lib/propuestas/registro.ts (alta) y scripts/propuestas/importar.mjs (diseño).

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = getPropuestaWeb(params.slug)
  const robots = { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
  if (!p) return { title: { absolute: 'Forma Prima' }, robots }
  const title = `Propuesta de honorarios · ${p.proyecto}`
  const description = `Preparada para ${p.cliente}. ${p.descripcion}`
  const imagen = `https://formaprima.es${p.og}`
  return {
    title: { absolute: `${title} — Forma Prima` },
    description,
    robots,
    openGraph: { type: 'website', siteName: 'Forma Prima', locale: 'es_ES', title, description, images: [{ url: imagen, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [imagen] },
  }
}

function NoDisponible() {
  return (
    <main style={{
      position: 'fixed', inset: 0, background: '#0d0d0d', color: 'rgba(251,251,250,.55)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 36, fontFamily: "'Hanken Grotesk',sans-serif", fontWeight: 300, textAlign: 'center', padding: 24,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/propuestas/logo-fp.png" alt="Forma Prima" style={{ height: 26, opacity: 0.9 }} />
      <p style={{ margin: 0, fontSize: 16 }}>Este enlace no está disponible.</p>
    </main>
  )
}

/** Obras publicadas en la web, con una variante de ~1080 px en vez del original. */
async function obrasDestacadas(): Promise<ProyectoEnlace[]> {
  const [proyectos, manifiesto] = await Promise.all([getProyectosSite(), getManifiesto().catch(() => ({}))])
  return proyectos
    .filter((p) => p.slug && p.hero_url)
    .slice(0, 4)
    .map((p) => {
      const v = (manifiesto as Record<string, { stem: string; webp: number[] }>)[p.hero_url!]
      const ancho = v?.webp.find((a) => a >= 1080) ?? v?.webp[v.webp.length - 1]
      return {
        slug: p.slug!,
        nombre: p.nombre,
        ubicacion: p.ubicacion,
        imagen: v && ancho ? urlVariante(p.hero_url!, v.stem, ancho, 'webp') : p.hero_url!,
      }
    })
}

const FUENTE = 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@200;300;400;500;600&display=swap'

export default async function PropuestaPage({ params }: { params: { slug: string } }) {
  const p = getPropuestaWeb(params.slug)
  if (!p) return <NoDisponible />

  const fuente = (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FUENTE} />
    </>
  )

  const autorizado = cookies().get(propuestaCookieName(p.slug))?.value === propuestaCookieValue(p.slug)
  if (!autorizado) {
    return (
      <>
        {fuente}
        <PropuestaGate slug={p.slug} nombreCliente={p.nombreCliente} proyecto={p.proyecto} portada={p.portada} />
      </>
    )
  }

  const [deck, proyectos] = await Promise.all([cargarDeck(p.slug), obrasDestacadas()])
  if (!deck) return <NoDisponible />

  const ua = headers().get('user-agent') || ''
  const inicial = /Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop'

  return (
    <>
      {fuente}
      <PropuestaDeck
        desktop={deck.desktop}
        mobile={deck.mobile}
        inicial={inicial}
        slug={p.slug}
        nombreCliente={p.nombreCliente}
        proyecto={p.proyecto}
        proyectos={proyectos}
      />
    </>
  )
}
