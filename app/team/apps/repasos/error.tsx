'use client'

import { useEffect } from 'react'

// Límite de error del módulo. Sin esto, cualquier excepción de cliente deja la
// pantalla genérica de Next ("Application error…") sin decir qué ha pasado, y
// hay que ir a la consola del navegador para saberlo.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[repasos] error de cliente:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 460, width: '100%' }}>
        <p style={{ fontSize: 28, margin: '0 0 12px' }}>⚠️</p>
        <h1 style={{ fontSize: 17, fontWeight: 400, color: '#1A1A1A', margin: '0 0 8px' }}>
          Algo ha fallado en Repasos de obra
        </h1>
        <p
          style={{
            fontSize: 12.5,
            color: '#1A1A1A80',
            fontWeight: 300,
            lineHeight: 1.6,
            margin: '0 0 16px',
          }}
        >
          Los repasos guardados están a salvo. Vuelve a intentarlo y, si se repite, manda esta
          información:
        </p>

        <pre
          style={{
            fontSize: 11,
            fontFamily: 'ui-monospace, monospace',
            background: '#FDF4F2',
            border: '1px solid #F0D5CF',
            borderRadius: 4,
            padding: 12,
            margin: '0 0 18px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#B03A2E',
          }}
        >
          {error.message || 'Error sin mensaje'}
          {error.digest ? `\n\ndigest: ${error.digest}` : ''}
        </pre>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="rp-btn rp-btn-primary" onClick={reset}>
            Reintentar
          </button>
          <a
            className="rp-btn rp-btn-ghost"
            href="/team/apps/repasos"
            style={{ textDecoration: 'none' }}
          >
            Volver a los proyectos
          </a>
        </div>
      </div>
    </div>
  )
}
