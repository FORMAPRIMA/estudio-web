'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SECCION_ORDER } from '@/lib/finanzas/costs'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProyectoInfo {
  id: string; nombre: string; codigo: string | null; imagen_url: string | null
  direccion: string | null; cliente_nombre: string | null; cliente_empresa: string | null
}
interface Render       { id: string; url: string; nombre: string | null }
interface PortalData   { floorfy_url: string | null; pdf_proyecto_url: string | null }
interface Actualizacion { id: string; tipo: string; titulo: string; contenido: string | null; fecha: string }
interface Visita       { id: string; fecha: string; titulo: string | null; asistentes: string | null; notas: string | null; acta_url: string | null; floorfy_url: string | null }
interface Partida      { id: string; nombre: string; fecha_inicio: string | null; fecha_fin: string | null; color: string; orden: number; completado: boolean }
interface Contratos    { contrato_arquitectura_url: string | null; contrato_obra_url: string | null; pdf_presupuesto_url: string | null }
interface Factura      { id: string; seccion: string; concepto: string; monto: number; status: string; fecha_pago_acordada: string | null; numero_factura: string | null }

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPOS: Record<string, { label: string; icon: string; color: string }> = {
  acta_obra:  { label: 'Acta de obra', icon: '📋', color: '#D85A30' },
  fotografia: { label: 'Fotografías',  icon: '📷', color: '#378ADD' },
  documento:  { label: 'Documento',    icon: '📄', color: '#C9A227' },
  avance:     { label: 'Avance',       icon: '📊', color: '#1D9E75' },
  nota:       { label: 'Nota',         icon: '📝', color: '#888'    },
}

const FACTURA_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  acordada_contrato: { label: 'Programada',  color: '#888',    bg: '#F4F4F4'  },
  cobrable:          { label: 'Por emitir',  color: '#C9A227', bg: '#FDF8EE'  },
  enviada:           { label: 'Emitida',     color: '#378ADD', bg: '#EEF4FD'  },
  pagada:            { label: 'Pagada',      color: '#1D9E75', bg: '#EEF8F4'  },
  impagada:          { label: 'Impagada',    color: '#E53E3E', bg: '#FEF2F2'  },
}

const NAV_H = 58

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

const fmtShort = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

const fmtMoney = (n: number) =>
  `€ ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`

// ── FP Logo mark ──────────────────────────────────────────────────────────────

function FPLogo() {
  return (
    <img
      src="/FORMA_PRIMA_BLANCO.png"
      alt="Forma Prima"
      style={{ height: 28, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
    />
  )
}

// ── Render carousel ───────────────────────────────────────────────────────────

function RenderCarousel({ renders, imagenUrl }: { renders: Render[]; imagenUrl: string | null }) {
  const images = renders.length > 0 ? renders.map(r => r.url) : imagenUrl ? [imagenUrl] : []
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (images.length <= 1) return
    const t = setInterval(() => setCurrent(c => (c + 1) % images.length), 5500)
    return () => clearInterval(t)
  }, [images.length])

  if (images.length === 0) {
    return <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A28 100%)' }} />
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {images.map((url, i) => (
        <img key={url + i} src={url} alt="" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', opacity: i === current ? 1 : 0,
          transition: 'opacity 2s ease',
        }} />
      ))}
      {images.length > 1 && (
        <div style={{ position: 'absolute', bottom: 28, right: 40, display: 'flex', gap: 6, zIndex: 2 }}>
          {images.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} style={{
              width: i === current ? 24 : 6, height: 6, borderRadius: 3, border: 'none',
              background: i === current ? '#fff' : 'rgba(255,255,255,0.35)',
              cursor: 'pointer', padding: 0, transition: 'all 0.35s ease',
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section title ─────────────────────────────────────────────────────────────

function STitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <div style={{ width: 2, height: 18, background: '#D85A30', borderRadius: 1 }} />
      <h2 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1A1A1A', margin: 0 }}>
        {children}
      </h2>
    </div>
  )
}

// ── Tab: INICIO ───────────────────────────────────────────────────────────────

function TabInicio({ proyecto, renders, portal }: {
  proyecto: ProyectoInfo; renders: Render[]; portal: PortalData | null
}) {
  return (
    <div>
      {/* Hero carousel */}
      <div style={{ position: 'relative', height: 'calc(100vh - 58px)', overflow: 'hidden' }}>
        <RenderCarousel renders={renders} imagenUrl={proyecto.imagen_url} />
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)', pointerEvents: 'none' }} />
        {/* Project info overlay */}
        <div className="cp-hero-overlay" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 60px 52px' }}>
          {proyecto.codigo && (
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>
              {proyecto.codigo}
            </p>
          )}
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 200, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            {proyecto.nombre}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 28px', alignItems: 'center' }}>
            {proyecto.cliente_nombre && (
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#D85A30', flexShrink: 0, display: 'inline-block' }} />
                {proyecto.cliente_nombre}
                {proyecto.cliente_empresa && <span style={{ color: 'rgba(255,255,255,0.35)' }}> · {proyecto.cliente_empresa}</span>}
              </span>
            )}
            {proyecto.direccion && (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                {proyecto.direccion}
              </span>
            )}
          </div>
        </div>
        {/* Scroll hint */}
        <div className="cp-hero-scroll-hint" style={{ position: 'absolute', bottom: 52, right: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.4 }}>
          <div style={{ width: 1, height: 40, background: '#fff' }} />
          <span style={{ fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', writingMode: 'vertical-rl' }}>scroll</span>
        </div>
      </div>

      {/* Below-fold info */}
      {portal?.floorfy_url && (
        <div style={{ background: '#fff', borderTop: '1px solid #E8E6E0' }}>
          <div className="cp-section-pad" style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 60px' }}>
            <STitle>Tour virtual 3D</STitle>
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #E8E6E0' }}>
              <iframe src={portal.floorfy_url} style={{ width: '100%', height: 520, border: 'none', display: 'block' }} allowFullScreen />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PDF Document Card ─────────────────────────────────────────────────────────

function PdfDocCard({ label, url }: { label: string; url: string }) {
  const [hov, setHov] = useState(false)
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          borderRadius: 10, border: `1px solid ${hov ? '#C8B49A' : '#E8E6E0'}`,
          overflow: 'hidden', cursor: 'pointer',
          transform: hov ? 'translateY(-4px)' : 'none',
          boxShadow: hov ? '0 12px 32px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
          transition: 'all 0.22s ease',
        }}
      >
        {/* Document visual */}
        <div style={{ background: '#F2F0EB', height: 148, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <svg width="72" height="92" viewBox="0 0 72 92" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 0h44l24 22v66H4V0z" fill="#FEFEFE" stroke="#DDD9D2" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M48 0v22h24" fill="none" stroke="#DDD9D2" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M48 0l24 22" fill="#E8E5DF" stroke="none"/>
            <line x1="13" y1="38" x2="55" y2="38" stroke="#D8D4CC" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="13" y1="47" x2="55" y2="47" stroke="#D8D4CC" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="13" y1="56" x2="55" y2="56" stroke="#D8D4CC" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="13" y1="65" x2="38" y2="65" stroke="#D8D4CC" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span style={{
            position: 'absolute', bottom: 11, right: 13,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#B0A090', background: '#E8E5DF', padding: '3px 7px', borderRadius: 3,
          }}>PDF</span>
        </div>
        {/* Label */}
        <div style={{ padding: '13px 17px 15px', background: '#fff', borderTop: '1px solid #F0EEE8' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', margin: '0 0 5px', lineHeight: 1.35 }}>{label}</p>
          <p style={{ fontSize: 10, color: hov ? '#D85A30' : '#AAA', margin: 0, letterSpacing: '0.03em', transition: 'color 0.2s' }}>
            Ver documento →
          </p>
        </div>
      </div>
    </a>
  )
}

// ── Tab: DOCUMENTOS Y FACTURACIÓN ─────────────────────────────────────────────

function TabDocumentosYPagos({
  portal, contratos, facturas,
}: {
  portal: PortalData | null
  contratos: Contratos | null
  facturas: Factura[]
}) {
  const docs = [
    portal?.pdf_proyecto_url             ? { label: 'Proyecto Arquitectónico', url: portal.pdf_proyecto_url }            : null,
    contratos?.pdf_presupuesto_url       ? { label: 'Presupuesto de Obra',     url: contratos.pdf_presupuesto_url }      : null,
    contratos?.contrato_arquitectura_url ? { label: 'Contrato Arquitectura',   url: contratos.contrato_arquitectura_url }: null,
    contratos?.contrato_obra_url         ? { label: 'Contrato de Obra',        url: contratos.contrato_obra_url }        : null,
  ].filter(Boolean) as { label: string; url: string }[]

  const hasDocs     = docs.length > 0
  const hasFacturas = facturas.length > 0

  const total     = facturas.reduce((s, f) => s + f.monto, 0)
  const pagado    = facturas.filter(f => f.status === 'pagada').reduce((s, f) => s + f.monto, 0)
  const pendiente = total - pagado
  const pct       = total > 0 ? (pagado / total) * 100 : 0
  const grouped   = facturas.reduce<Record<string, Factura[]>>((acc, f) => {
    if (!acc[f.seccion]) acc[f.seccion] = []
    acc[f.seccion].push(f)
    return acc
  }, {})

  if (!hasDocs && !hasFacturas) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 40px', color: '#CCC' }}>
        <svg width="36" height="44" viewBox="0 0 36 44" fill="none" style={{ marginBottom: 16, opacity: 0.35 }}>
          <path d="M2 0h22l12 11v31H2V0z" stroke="#888" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
          <path d="M24 0v11h12" stroke="#888" strokeWidth="1.5" fill="none"/>
          <line x1="7" y1="19" x2="27" y2="19" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="7" y1="25" x2="27" y2="25" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="7" y1="31" x2="18" y2="31" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <p style={{ fontSize: 13 }}>No hay documentos ni información de facturación disponibles aún.</p>
      </div>
    )
  }

  return (
    <div className="cp-section-pad" style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 60px' }}>

      {/* ── Documentos ── */}
      {hasDocs && (
        <>
          <STitle>Documentación</STitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: hasFacturas ? 56 : 0 }}>
            {docs.map(doc => <PdfDocCard key={doc.url} label={doc.label} url={doc.url} />)}
          </div>
        </>
      )}

      {/* ── Facturación ── */}
      {hasFacturas && (
        <>
          <STitle>Facturación</STitle>

          {/* Summary metrics */}
          <div className="cp-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Total del proyecto', value: fmtMoney(total),    color: '#1A1A1A', sub: `${facturas.length} partida${facturas.length !== 1 ? 's' : ''}` },
              { label: 'Importe cobrado',    value: fmtMoney(pagado),   color: '#1D9E75', sub: `${Math.round(pct)}% completado` },
              { label: 'Pendiente de cobro', value: fmtMoney(pendiente), color: pendiente > 0 ? '#C9A227' : '#1D9E75', sub: pendiente > 0 ? 'Por facturar o cobrar' : 'Al corriente' },
            ].map(card => (
              <div key={card.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', padding: '22px 26px' }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 10px' }}>{card.label}</p>
                <p style={{ fontSize: 24, fontWeight: 300, color: card.color, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{card.value}</p>
                <p style={{ fontSize: 10, color: '#CCC', margin: 0 }}>{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>Progreso de cobro</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75' }}>{Math.round(pct)}%</span>
            </div>
            <div style={{ height: 5, background: '#F0EEE8', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(to right, #1D9E75, #27C490)', borderRadius: 3, transition: 'width 0.8s ease' }} />
            </div>
          </div>

          {/* Invoice list by section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(grouped).sort(([a], [b]) => {
              const ia = SECCION_ORDER.indexOf(a as typeof SECCION_ORDER[number])
              const ib = SECCION_ORDER.indexOf(b as typeof SECCION_ORDER[number])
              return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
            }).map(([seccion, facts]) => (
              <div key={seccion} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
                {/* Section header */}
                <div style={{ padding: '13px 22px', background: '#F8F7F4', borderBottom: '1px solid #E8E6E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A' }}>{seccion}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{fmtMoney(facts.reduce((s, f) => s + f.monto, 0))}</span>
                </div>

                {/* Desktop table */}
                <div className="cp-invoice-table">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {facts.map((f, i) => {
                        const st = FACTURA_STATUS[f.status] ?? { label: f.status, color: '#888', bg: '#F4F4F4' }
                        return (
                          <tr key={f.id} style={{ borderBottom: i < facts.length - 1 ? '1px solid #F5F4F1' : 'none' }}>
                            <td style={{ padding: '13px 22px', fontSize: 13, color: '#1A1A1A' }}>{f.concepto}</td>
                            <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 4, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                                {st.label}
                              </span>
                            </td>
                            <td style={{ padding: '13px 12px', fontSize: 11, color: '#AAA', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {f.fecha_pago_acordada ? fmtShort(f.fecha_pago_acordada) : '—'}
                            </td>
                            <td style={{ padding: '13px 22px', fontSize: 14, fontWeight: 600, color: '#1A1A1A', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {fmtMoney(f.monto)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="cp-invoice-cards">
                  {facts.map((f, i) => {
                    const st = FACTURA_STATUS[f.status] ?? { label: f.status, color: '#888', bg: '#F4F4F4' }
                    return (
                      <div key={f.id} style={{ padding: '14px 18px', borderBottom: i < facts.length - 1 ? '1px solid #F5F4F1' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                          <p style={{ fontSize: 13, color: '#1A1A1A', margin: 0, flex: 1, lineHeight: 1.35 }}>{f.concepto}</p>
                          <p style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', margin: 0, whiteSpace: 'nowrap' }}>{fmtMoney(f.monto)}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 4, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                          {f.fecha_pago_acordada && (
                            <span style={{ fontSize: 10, color: '#AAA' }}>{fmtShort(f.fecha_pago_acordada)}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab: GALERÍA ──────────────────────────────────────────────────────────────

function TabGaleria({ renders }: { renders: Render[] }) {
  const [lightbox, setLightbox] = useState<{ url: string; nombre: string | null } | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  if (renders.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 40px', color: '#CCC' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🖼️</div>
        <p style={{ fontSize: 13 }}>La galería de renders se publicará próximamente.</p>
      </div>
    )
  }

  return (
    <div className="cp-section-pad" style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 60px' }}>
      <STitle>Galería de renders</STitle>
      <div className="cp-gallery" style={{ columns: '3 280px', gap: 12 }}>
        {renders.map(r => (
          <div key={r.id}
            onClick={() => setLightbox({ url: r.url, nombre: r.nombre })}
            onMouseEnter={() => setHovered(r.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              breakInside: 'avoid', marginBottom: 12, borderRadius: 10, overflow: 'hidden',
              cursor: 'zoom-in', background: '#E8E6E0', position: 'relative',
              transform: hovered === r.id ? 'scale(1.01)' : 'none',
              boxShadow: hovered === r.id ? '0 8px 32px rgba(0,0,0,0.18)' : 'none',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
          >
            <img src={r.url} alt={r.nombre ?? ''} style={{ width: '100%', display: 'block' }} />
            {r.nombre && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
                padding: '28px 14px 12px',
                opacity: hovered === r.id ? 1 : 0,
                transition: 'opacity 0.25s ease',
                pointerEvents: 'none',
              }}>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em' }}>
                  {r.nombre}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.94)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightbox.url} style={{ maxWidth: '92vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }} />
          {lightbox.nombre && (
            <p style={{ color: '#E8E6E0', fontSize: 14, marginTop: 16, letterSpacing: '0.04em', fontWeight: 400, opacity: 0.85 }}>
              {lightbox.nombre}
            </p>
          )}
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 24, right: 28, background: 'none', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', opacity: 0.6, lineHeight: 1 }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ── Tab: OBRA ─────────────────────────────────────────────────────────────────

type GanttTooltipInfo = { fase: string; subfase: string | null; duracion: string; x: number; y: number }

function duracionSemanas(fi: string | null, ff: string | null): string {
  if (!fi || !ff) return '—'
  const days = (new Date(ff + 'T00:00:00').getTime() - new Date(fi + 'T00:00:00').getTime()) / 86_400_000
  const w = Math.round(days / 7)
  return w <= 0 ? '< 1 semana' : w === 1 ? '1 semana' : `${w} semanas`
}

function GanttTooltip({ info }: { info: GanttTooltipInfo | null }) {
  if (!info) return null
  return (
    <div style={{
      position: 'fixed', left: info.x, top: info.y - 10,
      transform: 'translateX(-50%) translateY(-100%)',
      background: '#1A1A1A', color: '#fff', borderRadius: 7,
      padding: '8px 11px', fontSize: 11, pointerEvents: 'none',
      zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: info.subfase ? 2 : 0 }}>{info.fase}</div>
      {info.subfase && <div style={{ color: '#BBBBBB', marginBottom: 4 }}>{info.subfase}</div>}
      <div style={{ color: '#D85A30', fontWeight: 600 }}>{info.duracion}</div>
    </div>
  )
}

function groupPartidasForGantt(partidas: Partida[]): { label: string; color: string; items: Partida[] }[] {
  const result: { label: string; color: string; items: Partida[] }[] = []
  const indexMap = new Map<string, number>()
  for (const p of partidas) {
    const sep = p.nombre.indexOf(' — ')
    if (sep >= 0) {
      const label = p.nombre.slice(0, sep)
      if (indexMap.has(label)) {
        result[indexMap.get(label)!].items.push(p)
      } else {
        indexMap.set(label, result.length)
        result.push({ label, color: p.color, items: [p] })
      }
    } else {
      result.push({ label: p.nombre, color: p.color, items: [p] })
    }
  }
  return result
}

function GanttReadOnly({ partidas }: { partidas: Partida[] }) {
  const [tooltip, setTooltip] = useState<GanttTooltipInfo | null>(null)
  const dates = partidas.flatMap(p => [p.fecha_inicio, p.fecha_fin].filter(Boolean) as string[])
  const groups = groupPartidasForGantt(partidas)

  // Card list — always rendered; used as the only view when no dates,
  // and as the mobile-only view when dates exist (cp-gantt-mobile hides on desktop)
  const cardList = (
    <div className={dates.length > 0 ? 'cp-gantt-mobile' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.map((g, gi) => {
        const allDone = g.items.every(p => p.completado)
        const fi = g.items.find(p => p.fecha_inicio)?.fecha_inicio ?? null
        const ff = [...g.items].reverse().find(p => p.fecha_fin)?.fecha_fin ?? null
        return (
          <div key={gi} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: allDone ? '#CCC' : g.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: allDone ? '#AAA' : '#1A1A1A', textDecoration: allDone ? 'line-through' : 'none', flex: 1 }}>{g.label}</span>
            {(fi || ff) && !allDone && (
              <span style={{ fontSize: 10, color: '#AAA', whiteSpace: 'nowrap' }}>
                {fi ? fmtShort(fi) : ''}{fi && ff ? ' → ' : ''}{ff ? fmtShort(ff) : ''}
              </span>
            )}
            {allDone && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1D9E75', background: '#EEF8F4', padding: '2px 8px', borderRadius: 3, flexShrink: 0 }}>Completado</span>}
          </div>
        )
      })}
    </div>
  )

  if (dates.length === 0) return cardList

  const minD = dates.reduce((a, b) => a < b ? a : b)
  const maxD = dates.reduce((a, b) => a > b ? a : b)
  const start = new Date(minD + 'T00:00:00'); start.setDate(1)
  const end   = new Date(maxD + 'T00:00:00'); end.setMonth(end.getMonth() + 1, 0)
  const totalMs = end.getTime() - start.getTime() || 1
  const pct = (d: string) => (new Date(d + 'T00:00:00').getTime() - start.getTime()) / totalMs * 100

  const today = new Date().toISOString().split('T')[0]
  const todayPct  = pct(today)
  const showToday = todayPct >= 0 && todayPct <= 100

  const months: { label: string; left: number }[] = []
  const cur = new Date(start)
  while (cur <= end) {
    months.push({ label: cur.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }), left: (cur.getTime() - start.getTime()) / totalMs * 100 })
    cur.setMonth(cur.getMonth() + 1)
  }

  return (
    <>
    {/* Desktop gantt chart */}
    <div className="cp-gantt-desktop" style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', padding: '24px 28px', overflowX: 'auto' }}>
      <div style={{ minWidth: 560 }}>
        <div style={{ position: 'relative', height: 22, marginLeft: 200, marginBottom: 10 }}>
          {months.map((m, i) => (
            <div key={i} style={{ position: 'absolute', left: `${m.left}%`, fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#BBB' }}>{m.label}</div>
          ))}
          {showToday && (
            <div style={{ position: 'absolute', left: `${todayPct}%`, top: 5, transform: 'translateX(-50%)', fontSize: 8, fontWeight: 700, color: '#E53E3E', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
              HOY
            </div>
          )}
        </div>
        {groups.map((g, gi) => {
          const allDone = g.items.every(p => p.completado)
          return (
            <div key={gi} style={{ display: 'flex', alignItems: 'center', height: 34, marginBottom: 6 }}>
              <div style={{ width: 200, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, paddingRight: 18 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: allDone ? '#CCC' : g.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: allDone ? '#AAA' : '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: allDone ? 'line-through' : 'none' }}>
                  {g.label}
                </span>
              </div>
              <div style={{ flex: 1, height: '100%', position: 'relative', background: '#F5F4F1', borderRadius: 4 }}>
                {g.items.map(p => {
                  if (!p.fecha_inicio && !p.fecha_fin) return null
                  const l = p.fecha_inicio ? Math.max(0, pct(p.fecha_inicio)) : 0
                  const r = p.fecha_fin   ? Math.min(100, pct(p.fecha_fin))  : l + 4
                  const w = Math.max(0.8, r - l)
                  const subfaseLabel = p.nombre.includes(' — ') ? p.nombre.split(' — ')[1] : null
                  return (
                    <div
                      key={p.id}
                      style={{ position: 'absolute', left: `${l}%`, width: `${w}%`, top: 5, bottom: 5, borderRadius: 3, background: p.completado ? '#CCC' : p.color, opacity: p.completado ? 0.5 : 1, cursor: 'default' }}
                      onMouseEnter={e => { const rect = e.currentTarget.getBoundingClientRect(); setTooltip({ fase: g.label, subfase: subfaseLabel, duracion: duracionSemanas(p.fecha_inicio, p.fecha_fin), x: rect.left + rect.width / 2, y: rect.top }) }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                })}
                {showToday && (
                  <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1.5, background: '#E53E3E', zIndex: 2, opacity: 0.85 }} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>

    {/* Mobile card list */}
    {cardList}

    <GanttTooltip info={tooltip} />
    </>
  )
}

function TabObra({ visitas, partidas }: { visitas: Visita[]; partidas: Partida[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="cp-section-pad" style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 60px', display: 'flex', flexDirection: 'column', gap: 52 }}>

      {partidas.length > 0 && (
        <section>
          <STitle>Cronograma de obra</STitle>
          <GanttReadOnly partidas={partidas} />
        </section>
      )}

      {visitas.length > 0 && (
        <section>
          <STitle>Visitas de obra</STitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visitas.map(v => (
              <div key={v.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
                <div
                  style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 20, cursor: v.notas ? 'pointer' : 'default' }}
                  onClick={() => v.notas && setExpandedId(expandedId === v.id ? null : v.id)}
                >
                  <div style={{ width: 48, flexShrink: 0, textAlign: 'center', paddingRight: 12, borderRight: '1px solid #F0EEE8' }}>
                    <div style={{ fontSize: 22, fontWeight: 300, color: '#D85A30', lineHeight: 1 }}>
                      {new Date(v.fecha + 'T00:00:00').getDate()}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#AAA', marginTop: 2 }}>
                      {new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-ES', { month: 'short' })} {new Date(v.fecha + 'T00:00:00').getFullYear()}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: '0 0 3px' }}>{v.titulo ?? 'Visita de obra'}</p>
                    {v.asistentes && <p style={{ fontSize: 11, color: '#AAA', margin: 0 }}>{v.asistentes}</p>}
                  </div>
                  {v.notas && <span style={{ fontSize: 11, color: '#CCC' }}>{expandedId === v.id ? '▲' : '▼'}</span>}
                  {v.acta_url && (
                    <a href={v.acta_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, fontWeight: 600, color: '#D85A30', textDecoration: 'none', padding: '5px 12px', border: '1px solid #D85A3033', borderRadius: 6, background: '#FDF3EE', flexShrink: 0 }}>
                      Acta PDF →
                    </a>
                  )}
                </div>
                {expandedId === v.id && v.notas && (
                  <div style={{ padding: '0 24px 18px', marginLeft: 92 }}>
                    <p style={{ fontSize: 13, color: '#555', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{v.notas}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {visitas.length === 0 && partidas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 40px', color: '#CCC' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🏗️</div>
          <p style={{ fontSize: 13 }}>Información de obra disponible próximamente.</p>
        </div>
      )}
    </div>
  )
}

// ── Tab: VISITAS DE OBRA ──────────────────────────────────────────────────────

function TabVisitasObra({ visitas }: { visitas: Visita[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(visitas[0]?.id ?? null)

  if (visitas.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 40px', color: '#CCC' }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ marginBottom: 16, opacity: 0.3 }}>
          <rect x="1" y="1" width="34" height="34" rx="4" stroke="#888" strokeWidth="1.5"/>
          <line x1="9" y1="11" x2="27" y2="11" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="9" y1="18" x2="27" y2="18" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="9" y1="25" x2="19" y2="25" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p style={{ fontSize: 13 }}>No hay visitas de obra publicadas aún.</p>
      </div>
    )
  }

  const selected = visitas.find(v => v.id === selectedId) ?? visitas[0]
  const hasPdf = Boolean(selected.acta_url)
  const hasTour = Boolean(selected.floorfy_url)

  return (
    <div className="cp-section-pad" style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 60px' }}>
      <STitle>Visitas de obra</STitle>

      {/* Sub-tabs: one per visit */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E8E6E0', marginBottom: 40, overflowX: 'auto' }}>
        {visitas.map(v => {
          const active = v.id === selected.id
          return (
            <button
              key={v.id}
              onClick={() => setSelectedId(v.id)}
              style={{
                padding: '10px 22px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: active ? 500 : 400, whiteSpace: 'nowrap',
                color: active ? '#1A1A1A' : '#AAA',
                borderBottom: active ? '2px solid #1A1A1A' : '2px solid transparent',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              {fmtShort(v.fecha)}
            </button>
          )
        })}
      </div>

      {/* Visit header */}
      <div style={{ marginBottom: 36 }}>
        {selected.titulo && (
          <h3 style={{ fontSize: 22, fontWeight: 300, color: '#1A1A1A', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            {selected.titulo}
          </h3>
        )}
        {selected.asistentes && (
          <p style={{ fontSize: 12, color: '#AAA', margin: '0 0 6px' }}>
            <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9 }}>Asistentes</span>
            {'  '}{selected.asistentes}
          </p>
        )}
        {selected.notas && (
          <p style={{ fontSize: 13, color: '#666', margin: '14px 0 0', lineHeight: 1.75, whiteSpace: 'pre-wrap', maxWidth: 680 }}>
            {selected.notas}
          </p>
        )}
      </div>

      {/* PDF + Floorfy */}
      {hasPdf || hasTour ? (
        <div className="cp-visit-grid" style={{ display: 'grid', gridTemplateColumns: hasPdf && hasTour ? '1fr 1fr' : '1fr', gap: 28 }}>
          {hasPdf && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#AAA', marginBottom: 12 }}>
                Acta de visita
              </p>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #E8E6E0' }}>
                <iframe
                  src={selected.acta_url!}
                  style={{ width: '100%', height: 620, border: 'none', display: 'block' }}
                  title="Acta de visita de obra"
                />
              </div>
              <a
                href={selected.acta_url!}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, color: '#D85A30', textDecoration: 'none', display: 'inline-block', marginTop: 10, letterSpacing: '0.02em' }}
              >
                Descargar PDF →
              </a>
            </div>
          )}
          {hasTour && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#AAA', marginBottom: 12 }}>
                Recorrido virtual 3D
              </p>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #E8E6E0' }}>
                <iframe
                  src={selected.floorfy_url!}
                  style={{ width: '100%', height: 620, border: 'none', display: 'block' }}
                  allowFullScreen
                  title="Tour virtual de la visita"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#CCC', fontSize: 13, border: '1px dashed #E0DDD8', borderRadius: 10 }}>
          El acta y el recorrido virtual de esta visita estarán disponibles próximamente.
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'inicio',      label: 'Proyecto'    },
  { id: 'documentos',  label: 'Documentos'  },
  { id: 'galeria',     label: 'Galería'     },
  { id: 'obra',        label: 'Obra'        },
  { id: 'novedades',   label: 'Visitas de obra' },
]

export default function ClientPortal({
  proyecto, renders, portal, actualizaciones, visitas, partidas, contratos, facturas,
  hideDocumentos = false,
}: {
  proyecto:        ProyectoInfo
  renders:         Render[]
  portal:          PortalData | null
  actualizaciones: Actualizacion[]
  visitas:         Visita[]
  partidas:        Partida[]
  contratos:       Contratos | null
  facturas:        Factura[]
  hideDocumentos?: boolean
}) {
  const [tab, setTab] = useState('inicio')
  const router = useRouter()

  const visibleTabs = hideDocumentos ? TABS.filter(t => t.id !== 'documentos') : TABS

  // Poll for data changes every 30s so the portal reflects updates without a manual reload
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(id)
  }, [router])

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4', color: '#1A1A1A' }}>

      {/* ── Fixed top nav ── */}
      <nav className="cp-nav" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: NAV_H, background: '#111110',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        padding: '0 40px', gap: 48,
      }}>
        <FPLogo />

        {/* Tabs */}
        <div className="cp-nav-tabs" style={{ display: 'flex', flex: 1, gap: 0, height: '100%' }}>
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '0 18px', height: '100%', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: tab === t.id ? 600 : 400,
              letterSpacing: '0.06em',
              color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.35)',
              borderBottom: tab === t.id ? `2px solid #D85A30` : '2px solid transparent',
              transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
            }}
              onMouseEnter={e => { if (tab !== t.id) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)' }}
              onMouseLeave={e => { if (tab !== t.id) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Project code */}
        {proyecto.codigo && (
          <span className="cp-nav-code" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
            {proyecto.codigo}
          </span>
        )}
      </nav>

      {/* ── Content (offset by nav) ── */}
      <div style={{ paddingTop: NAV_H }}>
        {tab === 'inicio'     && <TabInicio            proyecto={proyecto} renders={renders} portal={portal} />}
        {tab === 'documentos' && <TabDocumentosYPagos  portal={portal} contratos={contratos} facturas={facturas} />}
        {tab === 'galeria'    && <TabGaleria            renders={renders} />}
        {tab === 'obra'       && <TabObra              visitas={visitas} partidas={partidas} />}
        {tab === 'novedades'  && <TabVisitasObra        visitas={visitas} />}
      </div>

      {/* ── Footer ── */}
      {tab !== 'inicio' && (
        <footer className="cp-footer" style={{ borderTop: '1px solid #E8E6E0', padding: '28px 60px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 60 }}>
          <img src="/FORMA_PRIMA_NEGRO.png" alt="Forma Prima" style={{ height: 20, width: 'auto', objectFit: 'contain' }} />
          <p style={{ fontSize: 10, color: '#CCC', margin: 0 }}>Portal privado · {proyecto.nombre}</p>
        </footer>
      )}
    </div>
  )
}
