'use client'

import { useEffect, useRef, useState } from 'react'
import { fmtEur } from '@/lib/propuestas/config'
import {
  buildCronograma, addBusinessDays, businessDaysBetween, LICITACION_DIAS,
  type CronoPago, type CronoServicio,
} from '@/lib/propuestas/cronograma'

function fmtCorta(d: Date) {
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
}
function fmtLarga(d: Date) {
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PropuestaCronograma({
  servicios,
  startDate,
}: {
  servicios: CronoServicio[]
  // Fecha de inicio real (firma del contrato). Con ella las barras muestran fechas
  // concretas y una línea roja marca el día de hoy sobre el timeline.
  startDate?: string | null
}) {
  // ── Animación on-scroll: las barras se despliegan al entrar en viewport ─────
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.25 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const crono = buildCronograma(servicios)

  const start0 = startDate ? new Date(startDate) : null
  const fechaDe = (day: number): Date | null => (start0 ? addBusinessDays(start0, day) : null)

  // Posición de "hoy" en días hábiles desde la firma. Se calcula en cliente (efecto)
  // para que el HTML del servidor no dependa del instante del render (hidratación).
  const [hoyDay, setHoyDay] = useState<number | null>(null)
  useEffect(() => {
    if (start0 && crono) setHoyDay(businessDaysBetween(start0, new Date()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate])

  if (!crono) return null
  const { bars, pagos, total, definedDias, hasLicitacion } = crono

  const hoyPct = hoyDay !== null && hoyDay >= 0 && hoyDay <= total * 1.02
    ? Math.min((hoyDay / total) * 100, 100)
    : null

  // Fusión de hitos coincidentes: el fin de una fase y el inicio de la siguiente
  // caen el mismo día (y los hitos "a la firma" comparten el día 0), así que los
  // pagos a menos del 2% del timeline se agrupan en un solo dot con desglose.
  interface PagoCluster { day: number; importe: number; abierto: boolean; items: CronoPago[] }
  const FUSION = total * 0.02
  const clusters: PagoCluster[] = []
  for (const p of pagos) {
    const last = clusters[clusters.length - 1]
    if (last && p.day - last.day <= FUSION) {
      last.items.push(p)
      last.importe += p.importe
      last.abierto = last.abierto && p.abierto
    } else {
      clusters.push({ day: p.day, importe: p.importe, abierto: p.abierto, items: [p] })
    }
  }

  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
  const STAGGER = 0.14
  const HOY_COLOR = '#C0392B'

  const hoyLine = (pct: number): React.CSSProperties => ({
    position: 'absolute', top: -2, bottom: -2, left: `${pct}%`,
    width: 2, background: HOY_COLOR, borderRadius: 1, zIndex: 2,
    boxShadow: '0 0 0 1px rgba(192,57,43,0.12)',
  })

  return (
    <section ref={rootRef} style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(40px, 6vw, 64px) 24px 0' }}>
      <span className="fp-section-label">{startDate ? 'Cronograma del proyecto' : 'Cronograma estimado'}</span>
      <div className="fp-card" style={{ marginTop: 8 }}>
        {hoyPct !== null && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: HOY_COLOR, display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 10, height: 2, background: HOY_COLOR, borderRadius: 1, display: 'inline-block' }} />
              Hoy · {fmtCorta(new Date())}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {bars.map((b, i) => {
            const ini = fechaDe(b.start)                           // inicio siempre conocido
            const fin = b.open ? null : fechaDe(b.start + b.span)  // fin solo si la fase está acotada
            return (
              <div key={b.id} className="fp-gantt-row">
                <div className="fp-gantt-label" style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateX(0)' : 'translateX(-8px)',
                  transition: `opacity 0.5s ease ${i * STAGGER}s, transform 0.5s ${EASE} ${i * STAGGER}s`,
                }}>
                  <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>{b.label}</span>
                  <span style={{ fontSize: 11, color: b.open ? '#A0968A' : '#888' }}>{b.durLabel}</span>
                  {ini && (
                    <span style={{ fontSize: 10.5, color: '#B5AB9E' }}>
                      {fmtCorta(ini)}{fin ? ` – ${fmtCorta(fin)}` : ' →'}
                    </span>
                  )}
                </div>
                <div className="fp-gantt-track">
                  <div
                    className={b.open ? 'fp-gantt-bar fp-gantt-bar-open' : 'fp-gantt-bar'}
                    style={{
                      left: `${(b.start / total) * 100}%`,
                      width: `${(b.span / total) * 100}%`,
                      overflow: 'hidden',
                      transform: visible ? 'scaleX(1)' : 'scaleX(0)',
                      transformOrigin: 'left center',
                      transition: `transform 0.9s ${EASE} ${i * STAGGER}s`,
                      // El despliegue lo lleva la transición; conservamos solo el brillo de las abiertas.
                      animation: b.open && visible ? 'ganttShimmer 2.6s ease-in-out infinite' : 'none',
                      ...(b.open
                        ? { ['--bar-color' as string]: b.color }
                        : { background: `linear-gradient(90deg, ${b.color}, ${b.color}D9)` }),
                    } as React.CSSProperties}
                  >
                    {b.dias !== null && (
                      <span style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap',
                        letterSpacing: '0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.18)',
                        opacity: visible ? 1 : 0,
                        transition: `opacity 0.4s ease ${i * STAGGER + 0.55}s`,
                      }}>
                        {b.dias} días
                      </span>
                    )}
                  </div>
                  {hoyPct !== null && <div style={hoyLine(hoyPct)} />}
                </div>
              </div>
            )
          })}

          {/* ── Flujo de pagos al estudio ──────────────────────────────────── */}
          {pagos.length > 0 && (
            <div className="fp-gantt-row" style={{ alignItems: 'flex-start', marginTop: 6 }}>
              <div className="fp-gantt-label" style={{
                opacity: visible ? 1 : 0,
                transition: `opacity 0.5s ease ${bars.length * STAGGER + 0.3}s`,
              }}>
                <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>Flujo de pagos</span>
                <span style={{ fontSize: 11, color: '#888' }}>Hitos de facturación</span>
              </div>
              <div style={{ position: 'relative', height: 96, paddingTop: 12 }}>
                {/* línea base */}
                <div style={{
                  position: 'absolute', top: 12, left: 0, right: 0, height: 1,
                  background: '#E5E2DA',
                  transform: visible ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left center',
                  transition: `transform 0.9s ${EASE} ${bars.length * STAGGER + 0.2}s`,
                }} />
                {hoyPct !== null && (
                  <div style={{ ...hoyLine(hoyPct), top: 6, bottom: 'auto', height: 13 }} />
                )}
                {clusters.map((c, i) => {
                  const leftPct = Math.min(Math.max((c.day / total) * 100, 1.5), 98.5)
                  const delay = bars.length * STAGGER + 0.35 + i * 0.08
                  const isHover = hovered === i
                  const multi = c.items.length > 1
                  const dotSize = (multi ? 12 : 9) + (isHover ? 4 : 0)
                  const fechaCluster = !c.abierto ? fechaDe(c.day) : null
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setHovered(i)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => setHovered(isHover ? null : i)}
                      style={{
                        position: 'absolute', top: 12, left: `${leftPct}%`,
                        transform: 'translateX(-50%)', cursor: 'pointer',
                        opacity: visible ? 1 : 0,
                        transition: `opacity 0.4s ease ${delay}s`,
                        zIndex: isHover ? 5 : 1,
                      }}
                    >
                      {/* dot — los fusionados se pintan algo mayores y con halo */}
                      <div style={{
                        width: dotSize, height: dotSize, borderRadius: '50%',
                        background: c.abierto ? '#fff' : '#D85A30',
                        border: `2px solid ${c.abierto ? '#A0968A' : '#D85A30'}`,
                        margin: '0 auto', marginTop: -Math.round(dotSize / 2) - 1,
                        transition: 'all 0.18s ease',
                        boxShadow: isHover
                          ? '0 2px 10px rgba(216,90,48,0.4)'
                          : multi ? '0 0 0 3px rgba(216,90,48,0.15)' : 'none',
                      }} />
                      {/* monto en vertical (suma del grupo) */}
                      <div style={{
                        writingMode: 'vertical-rl' as const,
                        fontSize: 10, fontWeight: 600,
                        color: c.abierto ? '#A0968A' : '#8A5A40',
                        margin: '7px auto 0', letterSpacing: '0.03em', whiteSpace: 'nowrap',
                      }}>
                        {fmtEur(c.importe)}
                      </div>
                      {/* popup con desglose */}
                      {isHover && (
                        <div style={{
                          position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%',
                          transform: leftPct > 80 ? 'translateX(-85%)' : leftPct < 20 ? 'translateX(-15%)' : 'translateX(-50%)',
                          background: '#1A1A1A', color: '#fff', borderRadius: 8,
                          padding: '10px 14px', whiteSpace: 'nowrap',
                          boxShadow: '0 8px 28px rgba(0,0,0,0.25)', zIndex: 10,
                        }}>
                          {fechaCluster && (
                            <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: '0 0 6px' }}>
                              ≈ {fmtLarga(fechaCluster)}
                            </p>
                          )}
                          {c.items.map((p, j) => (
                            <div key={j} style={{ marginTop: j > 0 ? 8 : 0, paddingTop: j > 0 ? 8 : 0, borderTop: j > 0 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
                              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', margin: 0 }}>
                                {p.servicio}
                              </p>
                              <p style={{ fontSize: 12, margin: '4px 0 0', color: 'rgba(255,255,255,0.85)' }}>
                                {p.hito}{p.abierto ? ' · según avance de obra' : ''}
                              </p>
                              <p style={{ fontSize: 13, fontWeight: 700, margin: '4px 0 0', color: '#D85A30' }}>
                                {p.pct}% = {fmtEur(p.importe)} <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>+ IVA</span>
                              </p>
                            </div>
                          ))}
                          {multi && (
                            <p style={{ fontSize: 12, fontWeight: 700, margin: '8px 0 0', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}>
                              Total: {fmtEur(c.importe)} <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>+ IVA</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 14, borderTop: '1px solid #F0EEE8', flexWrap: 'wrap', gap: 8 }}>
          {definedDias > 0 && (
            <span style={{ fontSize: 12, color: '#555' }}>
              Hasta inicio de obra: <strong style={{ color: '#1A1A1A' }}>≈ {definedDias} días hábiles</strong>
              {hasLicitacion && <span style={{ color: '#AAA' }}> (incluye {LICITACION_DIAS} días háb. de licitación)</span>}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#AAA' }}>
            {startDate
              ? 'Fechas calculadas desde la firma del contrato · los plazos de obra se concretan al cerrar el proyecto de ejecución.'
              : 'Cronograma orientativo · los plazos de obra se concretan al cerrar el proyecto de ejecución.'}
          </span>
        </div>
      </div>
    </section>
  )
}
