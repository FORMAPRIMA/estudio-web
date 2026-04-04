export const metadata = { title: 'Dashboard · Facturación' }

export default function Page() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '40px 32px', minHeight: '100vh', background: '#F8F7F4' }}>
      <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
        Facturación
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
        Dashboard general
      </h1>
      <p style={{ marginTop: 48, fontSize: 12, color: '#CCC' }}>Próximamente</p>
    </div>
  )
}
