import type { EspacioProyecto } from '@/app/actions/espacios'

const STATUS_LABEL: Record<string, string> = {
  activo: 'En curso', on_hold: 'En pausa', terminado: 'Finalizado', archivado: 'Archivado',
}

export default function ProyectoHome({
  token,
  nombre,
  proyectos,
}: {
  token: string
  nombre: string
  proyectos: EspacioProyecto[]
}) {
  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/FORMA_PRIMA_NEGRO.png" alt="Forma Prima" style={{ height: 22, opacity: 0.85 }} />
      </div>

      <section style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px) 24px' }}>
        <span className="fp-section-label">Tus proyectos</span>
        <h1 style={{ fontSize: 'clamp(26px, 5vw, 38px)', fontWeight: 300, lineHeight: 1.18, marginBottom: 32 }}>
          Hola, {nombre}.
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {proyectos.map(p => (
            <a
              key={p.id}
              href={`/espacio/${token}?p=${p.id}`}
              style={{ textDecoration: 'none', color: 'inherit', border: '1px solid #E5E2DA', borderRadius: 10, overflow: 'hidden', background: '#fff', display: 'block' }}
            >
              <div style={{ aspectRatio: '4 / 3', background: '#F0EDE8', position: 'relative' }}>
                {p.imagen_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              <div style={{ padding: '16px 18px' }}>
                {p.status && (
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D85A30' }}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                )}
                <p style={{ fontSize: 16, fontWeight: 500, marginTop: 6 }}>{p.nombre}</p>
                {p.codigo && <p style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>{p.codigo}</p>}
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
