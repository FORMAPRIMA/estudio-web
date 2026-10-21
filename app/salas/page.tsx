import Link from 'next/link'
import { redirect } from 'next/navigation'
import { datosSala, miembroActual, salasDe } from '@/lib/salas/panel'
import { kpis, duracion } from '@/lib/salas/metricas'
import { getPropuestaWeb } from '@/lib/propuestas/registro'
import { S, card, eyebrow } from '@/components/salas/theme'

export default async function SalasInicio() {
  const m = await miembroActual()
  if (!m) redirect('/')
  const salas = await salasDe(m)
  if (salas.length === 1 && m.rol !== 'propietario') redirect(`/${salas[0].slug}`)

  const filas = await Promise.all(salas.map(async (s) => ({ s, k: kpis(await datosSala(s.id)), p: getPropuestaWeb(s.slug) })))

  return (
    <>
      <p style={eyebrow}>Hola, {m.nombre.split(' ')[0]}</p>
      <h1 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em', margin: '8px 0 28px' }}>Dossiers</h1>
      {!filas.length && (
        <div style={{ ...card, padding: 32, color: S.soft, fontSize: 14 }}>Aún no tienes ningún dossier asignado.</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {filas.map(({ s, k, p }) => (
          <Link key={s.id} href={`/${s.slug}`} className="salas-tarjeta" style={{ ...card, textDecoration: 'none', color: S.ink, overflow: 'hidden', display: 'block' }}>
            <div style={{ position: 'relative', aspectRatio: '16 / 8', background: S.lineSoft }}>
              {(p?.portada || s.tipo === 'prospeccion') && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p?.portada ?? '/propuestas/para-portada-800.webp'} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {k.viendoAhora > 0 && (
                <span style={{ position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 500 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: S.green }} /> {k.viendoAhora} viendo ahora
                </span>
              )}
            </div>
            <div style={{ padding: '16px 18px 18px' }}>
              <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em' }}>{s.nombre}</div>
              {(p?.descripcion || s.tipo === 'prospeccion') && <div style={{ fontSize: 12, color: S.soft, marginTop: 4, lineHeight: 1.45 }}>{p?.descripcion ?? `Prospección · presentación del estudio para ${s.perfil === 'constructora' ? 'constructoras' : 'developers'}`}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${S.lineSoft}` }}>
                <Mini v={String(k.leads)} l="Leads" />
                <Mini v={String(k.sesiones)} l="Visitas" />
                <Mini v={k.sesiones ? duracion(k.tiempoMedioMs) : '—'} l="Tiempo medio" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}

function Mini({ v, l }: { v: string; l: string }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 11, color: S.faint }}>{l}</div>
    </div>
  )
}
