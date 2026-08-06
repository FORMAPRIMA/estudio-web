import type { ReactNode } from 'react'

// Layout minimalista para las páginas legales (privacidad, aviso legal).
// Independiente del resto del sitio (aún en WIP); estilo sobrio de marca.
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', color: '#1A1A1A', fontFamily: "var(--font-hanken), -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 96px' }}>
        <a href="/" style={{ display: 'inline-block', marginBottom: 40, fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: '#D85A30', textDecoration: 'none' }}>
          Forma Prima
        </a>
        {children}
        <hr style={{ margin: '56px 0 24px', border: 'none', borderTop: '1px solid #E8E6E0' }} />
        <p style={{ fontSize: 11, color: '#AAA', lineHeight: 1.7, margin: 0 }}>
          Forma Prima Arquitectos, S.L. · NIF B44873552 · CL/ Ppe de Vergara 56 6ª 2ª · 28006 Madrid ·{' '}
          <a href="mailto:contacto@formaprima.es" style={{ color: '#D85A30', textDecoration: 'none' }}>contacto@formaprima.es</a>
        </p>
        <p style={{ marginTop: 16, fontSize: 12 }}>
          <a href="/privacidad" style={{ color: '#666', textDecoration: 'none', marginRight: 18 }}>Política de Privacidad</a>
          <a href="/aviso-legal" style={{ color: '#666', textDecoration: 'none' }}>Aviso Legal</a>
        </p>
      </div>
    </div>
  )
}
