// Indicador visible solo en "modo presentación" (acceso con PIN maestro 1330).
// Recuerda al equipo que está viendo exactamente lo que ve el cliente y que esta
// visita NO se contabiliza como acceso. pointerEvents:none para no estorbar la
// demo en una reunión / screen-share.
export default function PresentationBadge() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(26,26,26,0.92)',
        color: '#fff',
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#D85A30', flexShrink: 0 }} />
      Modo presentación · esta visita no se registra
    </div>
  )
}
