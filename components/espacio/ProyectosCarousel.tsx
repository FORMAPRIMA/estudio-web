// Carrusel horizontal de proyectos recientes sobre fondo oscuro. Nació en la
// landing de Bienvenida y se reusa en otras etapas del Espacio (p.ej. Contrato)
// para mantener presencia de marca mientras el cliente espera o firma.

export interface ProyectoCarouselImage {
  nombre: string
  url: string
  tipologia: string | null
}

export default function ProyectosCarousel({
  proyectoImages,
  title = 'Proyectos recientes',
}: {
  proyectoImages: ProyectoCarouselImage[]
  title?: string
}) {
  if (proyectoImages.length === 0) return null
  return (
    <section style={{ background: '#1A1A1A', padding: 'clamp(48px, 6vw, 72px) 0' }}>
      <div style={{ padding: '0 24px 20px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
          {title}
        </span>
      </div>
      <div
        className="fp-carousel"
        style={{
          display: 'flex',
          gap: 3,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        {proyectoImages.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              flexShrink: 0,
              width: 'clamp(260px, 45vw, 380px)',
              aspectRatio: '3/4',
              borderRadius: 4,
              overflow: 'hidden',
              background: '#2A2A2A',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.nombre}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
              padding: '24px 16px 16px',
            }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#fff', letterSpacing: '0.02em' }}>{p.nombre}</p>
              {p.tipologia && (
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{p.tipologia}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
