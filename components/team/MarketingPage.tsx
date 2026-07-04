'use client'

import Link from 'next/link'

export function MarketingPage() {
  return (
    <div style={{ padding: '40px 48px', maxWidth: 900 }}>
      <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1A1A1A99', marginBottom: 8 }}>
        Forma Prima
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 300, color: '#1A1A1A', marginBottom: 4, letterSpacing: '-0.02em' }}>
        Marketing
      </h1>
      <p style={{ fontSize: 13, color: '#1A1A1A60', marginBottom: 40, fontWeight: 300 }}>
        Gestiona campañas, contenido y seguimiento de tiempo en un solo lugar.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        <Link href="/team/marketing/post-manager" style={{ textDecoration: 'none' }}>
          <div
            className="apps-card"
            style={{ background: '#fff', borderRadius: 4, padding: '28px 24px', cursor: 'pointer' }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 4,
              background: '#D85A3015',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, marginBottom: 16,
            }}>
              📝
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 6, letterSpacing: '-0.01em' }}>
              Post Manager
            </p>
            <p style={{ fontSize: 11, color: '#1A1A1A70', fontWeight: 300, lineHeight: 1.5, marginBottom: 20 }}>
              Crea, edita y gestiona posts y contenido de marketing.
            </p>
            <span style={{
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#D85A30', fontWeight: 500,
            }}>
              Abrir →
            </span>
          </div>
        </Link>

        <Link href="/team/marketing/web-publica" style={{ textDecoration: 'none' }}>
          <div
            className="apps-card"
            style={{ background: '#fff', borderRadius: 4, padding: '28px 24px', cursor: 'pointer' }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 4,
              background: '#D85A3015',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, marginBottom: 16,
            }}>
              🌐
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 6, letterSpacing: '-0.01em' }}>
              Web pública
            </p>
            <p style={{ fontSize: 11, color: '#1A1A1A70', fontWeight: 300, lineHeight: 1.5, marginBottom: 20 }}>
              Controla los proyectos e imágenes del teaser de formaprima.es.
            </p>
            <span style={{
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#D85A30', fontWeight: 500,
            }}>
              Abrir →
            </span>
          </div>
        </Link>

        <Link href="/team/marketing/horas" style={{ textDecoration: 'none' }}>
          <div
            className="apps-card"
            style={{ background: '#fff', borderRadius: 4, padding: '28px 24px', cursor: 'pointer' }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 4,
              background: '#D85A3015',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, marginBottom: 16,
            }}>
              ⏱
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 6, letterSpacing: '-0.01em' }}>
              Horas
            </p>
            <p style={{ fontSize: 11, color: '#1A1A1A70', fontWeight: 300, lineHeight: 1.5, marginBottom: 20 }}>
              Estructura editable y métricas del seguimiento de horas del equipo de marketing.
            </p>
            <span style={{
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#D85A30', fontWeight: 500,
            }}>
              Abrir →
            </span>
          </div>
        </Link>
      </div>
    </div>
  )
}
