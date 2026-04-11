export default function ExecutionPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {children}
    </div>
  )
}
