import type { EspacioContrato } from '@/app/actions/espacios'

function formatFecha(iso: string | null) {
  if (!iso) return null
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return null }
}

export default function ContratoView({
  token,
  nombre,
  contrato,
}: {
  token: string
  nombre: string
  contrato: EspacioContrato
}) {
  const firmado = contrato.status === 'firmado'
  const enFirma = contrato.status === 'enviado' || contrato.status === 'negociacion'
  const fecha   = formatFecha(contrato.fechaFirma)

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/FORMA_PRIMA_NEGRO.png" alt="Forma Prima" style={{ height: 22, opacity: 0.85 }} />
      </div>

      <section style={{ maxWidth: 640, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px) 24px' }}>
        <span className="fp-section-label">Contrato</span>
        <h1 style={{ fontSize: 'clamp(26px, 5vw, 38px)', fontWeight: 300, lineHeight: 1.18 }}>
          {firmado ? `Todo listo, ${nombre}.` : `Tu contrato, ${nombre}.`}
        </h1>
        {contrato.numero && (
          <p style={{ fontSize: 13, color: '#AAA', letterSpacing: '0.04em', marginTop: 10 }}>{contrato.numero}</p>
        )}

        {/* Estado del contrato */}
        <div className="fp-card" style={{ marginTop: 28 }}>
          {firmado ? (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1D9E75' }}>✓ Contrato firmado</p>
              {fecha && <p style={{ fontSize: 13, color: '#888', marginTop: 6 }}>Firmado el {fecha}.</p>}
              <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginTop: 12 }}>
                Gracias por confiar en Forma Prima. A partir de aquí comenzamos a trabajar en tu proyecto.
              </p>
              {contrato.pdfFirmadoUrl && (
                <a className="fp-btn-primary" href={contrato.pdfFirmadoUrl} target="_blank" rel="noopener noreferrer"
                   style={{ width: 'auto', display: 'inline-block', textDecoration: 'none', marginTop: 16 }}>
                  Descargar contrato firmado
                </a>
              )}
            </>
          ) : enFirma ? (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#D85A30' }}>Tu contrato está listo para firmar</p>
              <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginTop: 12 }}>
                Te hemos enviado el contrato para su firma electrónica (DocuSign) al correo
                que nos facilitaste. Ábrelo desde ese email para revisarlo y firmarlo. Una vez
                firmado, podrás descargarlo aquí mismo.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Estamos ultimando tu contrato</p>
              <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginTop: 12 }}>
                Con los datos que nos has facilitado estamos preparando el contrato. Te avisaremos
                aquí en cuanto esté listo para firmar.
              </p>
            </>
          )}
        </div>

        {/* Propuesta archivada */}
        {contrato.hasPropuesta && (
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', border: '1px solid #E5E2DA', borderRadius: 8, background: '#FBFAF7' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Archivado</p>
              <p style={{ fontSize: 14, color: '#555', marginTop: 4 }}>Propuesta de honorarios</p>
            </div>
            <a className="fp-btn-ghost" href={`/api/espacio/${token}/propuesta-pdf`} target="_blank" rel="noopener noreferrer"
               style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Ver PDF
            </a>
          </div>
        )}
      </section>
    </div>
  )
}
