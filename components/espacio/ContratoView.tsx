import type { EspacioContrato } from '@/app/actions/espacios'
import FirmarContratoButton from './FirmarContratoButton'
import PropuestaCronograma from './PropuestaCronograma'
import ProyectosCarousel, { type ProyectoCarouselImage } from './ProyectosCarousel'

function formatFecha(iso: string | null) {
  if (!iso) return null
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return null }
}

export default function ContratoView({
  token,
  nombre,
  contrato,
  proyectoImages = [],
}: {
  token: string
  nombre: string
  contrato: EspacioContrato
  proyectoImages?: ProyectoCarouselImage[]
}) {
  const firmado = contrato.status === 'firmado'
  const listo   = contrato.status === 'enviado' || contrato.status === 'negociacion'
  const fecha   = formatFecha(contrato.fechaFirma)
  const verContratoUrl = `/api/espacio/${token}/contrato-pdf`

  return (
    <div style={{ paddingBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/FORMA_PRIMA_NEGRO.png" alt="Forma Prima" style={{ height: 22, opacity: 0.85 }} />
      </div>

      <section style={{ maxWidth: 640, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px) 24px 0' }}>
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
                Gracias por confiar en Forma Prima. A partir de aquí comenzamos a trabajar en tu proyecto:
                abajo tienes el cronograma con las fechas de cada fase. En esta misma página irás viendo
                el avance y, conforme el proyecto arranque, los planos, renders y documentos que vayamos publicando.
              </p>
            </>
          ) : listo ? (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#D85A30' }}>Tu contrato está listo</p>
              <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginTop: 12 }}>
                Hemos preparado tu contrato con todo lo acordado. Revísalo con calma a continuación
                y, cuando esté todo conforme, fírmalo aquí mismo de forma segura.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Estamos ultimando tu contrato</p>
              <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginTop: 12 }}>
                Con los datos que nos has facilitado estamos preparando el contrato. Te avisaremos
                aquí en cuanto esté listo.
              </p>
            </>
          )}

          {/* Acceso al contrato (en plataforma, sin adjuntos) */}
          {(firmado || listo) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
              {listo && !firmado ? (
                <FirmarContratoButton token={token} />
              ) : null}
              {firmado && contrato.pdfFirmadoUrl ? (
                <a className="fp-btn-primary" href={contrato.pdfFirmadoUrl} target="_blank" rel="noopener noreferrer"
                   style={{ width: 'auto', display: 'inline-block', textDecoration: 'none' }}>
                  Ver contrato firmado
                </a>
              ) : (
                <a className={listo && !firmado ? 'fp-btn-ghost' : 'fp-btn-primary'} href={verContratoUrl} target="_blank" rel="noopener noreferrer"
                   style={{ width: 'auto', display: 'inline-block', textDecoration: 'none' }}>
                  Ver contrato
                </a>
              )}
            </div>
          )}
        </div>

        {/* Histórico — documentos archivados del proceso */}
        {(contrato.hasPropuesta || (firmado && contrato.pdfFirmadoUrl)) && (
          <div style={{ marginTop: 28 }}>
            <span className="fp-section-label">Histórico</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {firmado && contrato.pdfFirmadoUrl && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', border: '1px solid #E5E2DA', borderRadius: 8, background: '#FBFAF7' }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1D9E75' }}>Firmado{fecha ? ` · ${fecha}` : ''}</p>
                    <p style={{ fontSize: 14, color: '#555', marginTop: 4 }}>Contrato {contrato.numero ?? ''}</p>
                  </div>
                  <a className="fp-btn-ghost" href={contrato.pdfFirmadoUrl} target="_blank" rel="noopener noreferrer"
                     style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    Ver PDF
                  </a>
                </div>
              )}
              {contrato.hasPropuesta && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', border: '1px solid #E5E2DA', borderRadius: 8, background: '#FBFAF7' }}>
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
            </div>
          </div>
        )}
      </section>

      {/* Cronograma de fases: estimado antes de firmar; con fechas firmadas y línea
          de "hoy" una vez firmado (ancladas a la fecha de la firma). */}
      {contrato.servicios.length > 0 && (
        <PropuestaCronograma
          servicios={contrato.servicios}
          startDate={firmado ? (contrato.fechaFirma ?? contrato.fechaContrato) : null}
        />
      )}

      {/* Próximamente: documentos del proyecto (planos, renders) cuando avance la obra */}
      {firmado && (
        <section style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(32px, 5vw, 48px) 24px' }}>
          <span className="fp-section-label">Documentos del proyecto</span>
          <div className="fp-card" style={{ marginTop: 8, textAlign: 'center', padding: 'clamp(28px, 5vw, 44px)' }}>
            <p style={{ fontSize: 14, color: '#888', lineHeight: 1.7 }}>
              Aquí iremos publicando los planos, renders y documentos de tu proyecto a medida que avance.
            </p>
          </div>
        </section>
      )}

      <div style={{ height: 56 }} />

      <ProyectosCarousel proyectoImages={proyectoImages} />
    </div>
  )
}
