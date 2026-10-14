// Se ve al instante al pulsar "Revisión final" mientras el servidor prepara el formulario.
export default function Loading() {
  return (
    <div style={{ padding: '80px 40px', display: 'flex', alignItems: 'center', gap: 12, color: '#888', fontSize: 13 }}>
      <span style={{ width: 14, height: 14, border: '2px solid #E8E6E0', borderTopColor: '#D85A30', borderRadius: '50%', display: 'inline-block', animation: 'fp-spin 0.8s linear infinite' }} />
      Preparando la factura…
      <style>{'@keyframes fp-spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}
