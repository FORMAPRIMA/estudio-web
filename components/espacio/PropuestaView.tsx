'use client'

import { useState } from 'react'
import { fmtEur } from '@/lib/propuestas/config'
import type { PropuestaVM } from '@/lib/propuestas/build'
import { aceptarPropuestaEspacio } from '@/app/actions/espacios'

function formatFecha(iso: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return null }
}

export default function PropuestaView({
  token,
  nombre,
  vm,
  status,
}: {
  token: string
  nombre: string
  vm: PropuestaVM
  status: string
}) {
  const [accepting, setAccepting]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const aceptada = status === 'aceptada'

  async function handleAccept() {
    setAccepting(true)
    setError(null)
    const res = await aceptarPropuestaEspacio(token)
    if ('error' in res) { setError(res.error); setAccepting(false); return }
    window.location.reload()
  }

  const fecha = formatFecha(vm.fecha)

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/FORMA_PRIMA_NEGRO.png" alt="Forma Prima" style={{ height: 22, opacity: 0.85 }} />
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{
        background: '#1A1A1A', color: '#fff',
        padding: 'clamp(56px, 9vw, 96px) 24px',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
          Propuesta de honorarios
        </span>
        <h1 style={{ fontSize: 'clamp(30px, 6vw, 52px)', fontWeight: 200, margin: '18px 0 0', lineHeight: 1.12 }}>
          {vm.titulo || `Hola, ${nombre}.`}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 18, letterSpacing: '0.04em' }}>
          {vm.numero}{fecha ? `  ·  ${fecha}` : ''}
        </p>
        <div style={{ width: 48, height: 2, background: '#D85A30', margin: '32px auto 0', opacity: 0.85 }} />
      </section>

      {/* ── Resumen ejecutivo ───────────────────────────────────────────────── */}
      <section style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(40px, 6vw, 72px) 24px 0' }}>
        <div
          className="fp-prop-summary"
          style={{
            display: 'grid', ['--cols' as string]: vm.hasPem ? 3 : 2,
            gap: 1, background: '#E5E2DA', border: '1px solid #E5E2DA', borderRadius: 8, overflow: 'hidden',
          } as React.CSSProperties}
        >
          <Stat label="Superficie" value={`${vm.m2.toLocaleString('es-ES')} m²`} />
          {vm.hasPem && <Stat label="Coste objetivo de obra" value={`${fmtEur(vm.pem)}`} suffix="+ IVA" />}
          <Stat label="Honorarios totales" value={fmtEur(vm.total)} suffix="+ IVA" highlight />
        </div>

        <p style={{ fontSize: 15, color: '#444', lineHeight: 1.8, marginTop: 36, maxWidth: 680 }}>
          En Forma Prima entendemos cada espacio como una oportunidad única de transformar la vida de
          las personas. A continuación encontrará el detalle de los servicios que conforman esta
          propuesta, con sus entregables, plazos y condiciones de pago.
        </p>
      </section>

      {/* ── Alcance de servicios ────────────────────────────────────────────── */}
      <section style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(40px, 6vw, 64px) 24px 0' }}>
        <span className="fp-section-label">Alcance de servicios</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
          {vm.servicios.map(s => (
            <div key={s.id} className="fp-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 400, color: '#1A1A1A' }}>{s.label}</h3>
                <span style={{ fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 600, color: '#D85A30', whiteSpace: 'nowrap' }}>
                  {fmtEur(s.importe)} <span style={{ fontSize: 12, color: '#AAA', fontWeight: 400 }}>+ IVA</span>
                </span>
              </div>
              {s.texto && <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginTop: 12 }}>{s.texto}</p>}

              {s.entregables.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginTop: 20 }}>
                  {s.entregables.map(g => (
                    <div key={g.grupo}>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>{g.grupo}</p>
                      {g.items.map(item => (
                        <p key={item} style={{ fontSize: 13, color: '#555', lineHeight: 1.6, paddingLeft: 12, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 0, color: '#D85A30' }}>·</span>{item}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {s.semanas && (
                <p style={{ fontSize: 12, color: '#888', marginTop: 18 }}>
                  <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>Plazo</span>
                  &nbsp;&nbsp;{s.semanas}
                </p>
              )}

              {s.pago.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid #F0EEE8', paddingTop: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>Hitos de pago</p>
                  {s.pago.map(p => (
                    <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '6px 0', borderBottom: '1px solid #F6F4EF' }}>
                      <span style={{ fontSize: 13, color: '#555', flex: 1 }}>{p.label}</span>
                      <span style={{ fontSize: 12, color: '#AAA', minWidth: 36, textAlign: 'right' }}>{p.pct}%</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', minWidth: 90, textAlign: 'right' }}>{fmtEur(p.importe)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Resumen económico ───────────────────────────────────────────────── */}
      <section style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(40px, 6vw, 64px) 24px 0' }}>
        <span className="fp-section-label">Resumen económico</span>
        <div className="fp-card" style={{ marginTop: 8 }}>
          {vm.servicios.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F0EEE8' }}>
              <span style={{ fontSize: 14, color: '#555' }}>{s.label}</span>
              <span style={{ fontSize: 14, color: '#555' }}>{fmtEur(s.importe)} <span style={{ fontSize: 11, color: '#BBB' }}>+ IVA</span></span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1A1A1A', color: '#fff', padding: '14px 16px', marginTop: 14, borderRadius: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Total honorarios</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#D85A30' }}>{fmtEur(vm.total)} <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>+ IVA</span></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#D85A30', color: '#fff', padding: '12px 16px', marginTop: 2, borderRadius: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Total IVA incluido</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{fmtEur(vm.totalIva)}</span>
          </div>
          <p style={{ fontSize: 11, color: '#AAA', marginTop: 12, lineHeight: 1.5 }}>
            Todos los importes indicados no incluyen IVA (21%). Se facturarán según los hitos de pago descritos en cada servicio.
          </p>
        </div>

        {vm.notas && (
          <div style={{ marginTop: 24 }}>
            <span className="fp-section-label">Notas</span>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{vm.notas}</p>
          </div>
        )}
      </section>

      {/* ── Barra de acción fija ────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
        borderTop: '1px solid #E5E2DA', padding: '14px 24px',
      }}>
        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#888' }}>
            {aceptada
              ? <span style={{ color: '#1D9E75', fontWeight: 600 }}>✓ Oferta aceptada — gracias por tu confianza.</span>
              : <>Total <strong style={{ color: '#1A1A1A' }}>{fmtEur(vm.total)}</strong> + IVA</>}
            {error && <span style={{ color: '#E53E3E', marginLeft: 12 }}>{error}</span>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a className="fp-btn-ghost" href={`/api/espacio/${token}/propuesta-pdf`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Descargar PDF
            </a>
            {!aceptada && !confirming && (
              <button className="fp-btn-primary" style={{ width: 'auto' }} onClick={() => setConfirming(true)}>
                Aceptar oferta
              </button>
            )}
            {!aceptada && confirming && (
              <button className="fp-btn-primary" style={{ width: 'auto' }} onClick={handleAccept} disabled={accepting}>
                {accepting ? 'Confirmando…' : '¿Confirmas? Aceptar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, suffix, highlight }: { label: string; value: string; suffix?: string; highlight?: boolean }) {
  return (
    <div style={{ background: '#fff', padding: 'clamp(18px, 3vw, 26px)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 'clamp(20px, 3.5vw, 26px)', fontWeight: highlight ? 700 : 300, color: highlight ? '#D85A30' : '#1A1A1A' }}>
        {value}{suffix && <span style={{ fontSize: 11, color: '#BBB', fontWeight: 400 }}> {suffix}</span>}
      </p>
    </div>
  )
}
