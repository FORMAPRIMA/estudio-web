'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Embedded DocuSign signing inside the Espacio.
 *
 * Asks the server for a short-lived recipient-view URL and renders it in a
 * full-screen iframe. DocuSign redirects the iframe back to our own returnUrl
 * (…?firma=ok) once signing finishes; since that page is same-origin we can
 * detect it from the iframe's onLoad and refresh the Espacio.
 */
export default function FirmarContratoButton({ token }: { token: string }) {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [signUrl, setSignUrl]   = useState<string | null>(null)
  const [done, setDone]         = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  async function abrirFirma() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/espacio/${token}/firma-url`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'No se pudo abrir la firma. Inténtalo de nuevo.')
        return
      }
      setSignUrl(data.url as string)
    } catch {
      setError('No se pudo abrir la firma. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // Lock body scroll while the signing overlay is open
  useEffect(() => {
    if (signUrl) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [signUrl])

  // Tras la ceremonia: confirmar la firma contra DocuSign (sin esperar al webhook,
  // que en demo puede tardar o no llegar) y recargar el Espacio ya en estado firmado.
  async function confirmarYRecargar() {
    for (let intento = 0; intento < 3; intento++) {
      try {
        const res = await fetch(`/api/espacio/${token}/firma-confirmar`, { method: 'POST' })
        const data = await res.json()
        if (res.ok && data.firmado) break
      } catch { /* reintentar */ }
      await new Promise(r => setTimeout(r, 1500))
    }
    window.location.reload()
  }

  function onIframeLoad() {
    // While the iframe is on docusign.net this throws (cross-origin). Once DocuSign
    // redirects back to our returnUrl it becomes readable → signing finished.
    try {
      const href = iframeRef.current?.contentWindow?.location.href
      if (href && href.includes('firma=ok')) {
        setDone(true)
        void confirmarYRecargar()
      }
    } catch {
      /* still on DocuSign — ignore */
    }
  }

  return (
    <>
      <button
        className="fp-btn-primary"
        onClick={abrirFirma}
        disabled={loading}
        style={{ width: 'auto', display: 'inline-block', cursor: loading ? 'wait' : 'pointer' }}
      >
        {loading ? 'Abriendo…' : 'Firmar contrato'}
      </button>
      {error && (
        <p style={{ fontSize: 12.5, color: '#C0392B', marginTop: 8, width: '100%' }}>{error}</p>
      )}

      {signUrl && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: '#1A1A1A',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', background: '#1A1A1A', flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.02em' }}>
              Firma segura con DocuSign
            </span>
            <button
              onClick={() => setSignUrl(null)}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>

          {done ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', background: '#fff', textAlign: 'center', padding: 24,
            }}>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#1D9E75' }}>✓ Contrato firmado</p>
              <p style={{ fontSize: 14, color: '#666', marginTop: 10 }}>
                Gracias. Estamos guardando tu contrato firmado…
              </p>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={signUrl}
              onLoad={onIframeLoad}
              title="Firma del contrato"
              style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
            />
          )}
        </div>
      )}
    </>
  )
}
