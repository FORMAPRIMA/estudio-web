import { getBienvenidaToken } from '@/app/actions/bienvenida'
import BienvenidaPage from '@/components/public/BienvenidaPage'

export const dynamic = 'force-dynamic'

const STUDIO = {
  nombre: 'Forma Prima',
  tagline: 'Arquitectura e interiorismo de autor',
  descripcion:
    'Somos un estudio de arquitectura e interiorismo fundado con una convicción: los espacios bien diseñados transforman la vida de las personas. Cada proyecto es un proceso de escucha, creatividad y precisión técnica, desde el primer boceto hasta el último detalle de la obra terminada.',
  fundacion: '2018',
  proyectos: '+60',
  ciudades: 'Madrid · Bélgica · Internacional',
  socios: [
    {
      nombre: 'Gabriela Hidalgo',
      titulo: 'Arquitecta · Socia fundadora',
      bio: 'Arquitecta colegiada con más de 12 años de experiencia en reforma y diseño residencial. Especializada en dirección de obra y coordinación técnica.',
    },
    {
      nombre: 'Jose Lora',
      titulo: 'Interiorista · Socio',
      bio: 'Especialista en interiorismo de alto standing y gestión de proyectos internacionales. Combina el rigor técnico con una visión estética contemporánea.',
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
      <div
        style={{
          minHeight: '100vh',
          background: '#1A1A1A',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 14,
            fontWeight: 200,
            letterSpacing: '0.25em',
            color: '#fff',
            marginBottom: 32,
          }}
        >
          FORMA PRIMA
        </p>
        <div
          style={{
            width: 40,
            height: 1,
            background: 'rgba(255,255,255,0.2)',
            margin: '0 auto 32px',
          }}
        />
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', fontWeight: 300 }}>
          Este enlace no está disponible.
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>
          Es posible que ya haya sido utilizado o que no sea válido.
        </p>
      </div>
    )
  }

  return (
    <BienvenidaPage
      nombreCliente={tokenData.nombre_cliente}
      token={params.token}
      studio={STUDIO}
    />
  )
}
