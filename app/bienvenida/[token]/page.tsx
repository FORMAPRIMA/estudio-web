import { getBienvenidaToken } from '@/app/actions/bienvenida'
import { createAdminClient } from '@/lib/supabase/admin'
import BienvenidaPage from '@/components/public/BienvenidaPage'

export const dynamic = 'force-dynamic'

const HERO_IMAGE = 'https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/proyecto-imagenes/bf625278-6d96-4f81-b543-d3556ff65f3f/1775244561811.png'

const STUDIO = {
  tagline: 'Architecture and interior design studio',
  descripcion_es: `In a world where architectural uniformity prevails, where the connection with the built environment fades away, a new proposal emerges. Forma Prima embraces diversity as a source of strength. We believe that true harmony is not found in uniformity, but in the strategic amalgamation of contrasts that invite exploration.

Spaces where light and shadow engage in a perfectly synchronized discussion, where the softness of curves meets the rigidity of orthogonal lines, and where the rusticity of materials converses with the neatness of surfaces. Our mission is to transform the tension between these opposites into an enriching and memorable architectural experience.

Forma Prima represents the encounter between diversity and cohesion, where extremes converge to stimulate the senses and nurture experiences.`,
  proyectos: '+60',
  paises: 'Spain · Mexico · Ecuador',
  fundacion: '2023',
  socios: [
    {
      nombre: 'Gabriela Hidalgo',
      titulo: 'Architect · Co-founder',
      bio: `Gabriela graduated in architecture from the University of Navarra in Pamplona (2020) and continued her education with a qualifying master's degree in architecture in Madrid, complemented by business training at IESE Business School (2021).

Her dedication took her to Paris, where she deepened her specialisation in interior design. Back in Madrid, she co-founded Forma Prima together with José Lora in 2023. Today, their team brings valuable international experience from projects developed across Spain and Mexico.`,
    },
    {
      nombre: 'José Lora',
      titulo: 'Architect · Partner',
      bio: `José graduated in architecture from the University of Navarra in Pamplona, where he simultaneously worked on projects in Mexico with local architects. He later moved to Madrid to complete a double master's degree in Architecture and Business Management at IESE Business School, along with a Master's in Environmental Design and Building Management (UNAV 2021).

After completing his studies, he joined the firm of Juan Herreros & Jens Richter, contributing to international projects and competitions in Norway, Germany, Argentina and Saudi Arabia. In 2023, he co-founded Forma Prima with Gabriela Hidalgo.`,
    },
  ],
}

export default async function BienvenidaTokenPage({
  params,
}: {
  params: { token: string }
}) {
  const tokenData = await getBienvenidaToken(params.token)

  if (!tokenData || tokenData.used) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#1A1A1A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: '40px 24px',
        textAlign: 'center',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/FORMA_PRIMA_BLANCO.png" alt="Forma Prima" style={{ height: 28, marginBottom: 40, opacity: 0.9 }} />
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', fontWeight: 300 }}>
          Este enlace no está disponible.
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 10 }}>
          Es posible que ya haya sido utilizado o que no sea válido.
        </p>
      </div>
    )
  }

  // Fetch project images for carousel
  const admin = createAdminClient()
  const { data: proyectos } = await admin
    .from('proyectos')
    .select('id, nombre, imagen_url, tipologia')
    .not('imagen_url', 'is', null)
    .eq('estado', 'activo')
    .order('created_at', { ascending: false })
    .limit(10)

  const proyectoImages: { nombre: string; url: string; tipologia: string | null }[] =
    (proyectos ?? [])
      .filter((p) => !!p.imagen_url)
      .map((p) => ({ nombre: p.nombre, url: p.imagen_url as string, tipologia: p.tipologia }))

  // Castelló 42 must always be first
  const castelloEntry = proyectoImages.find(p => p.url === HERO_IMAGE)
    ?? { nombre: 'Castelló 42', url: HERO_IMAGE, tipologia: 'Interiorismo' }
  const orderedImages = [castelloEntry, ...proyectoImages.filter(p => p.url !== HERO_IMAGE)]

  return (
    <BienvenidaPage
      nombreCliente={tokenData.nombre_cliente}
      token={params.token}
      heroImage={HERO_IMAGE}
      proyectoImages={orderedImages}
      studio={STUDIO}
    />
  )
}
