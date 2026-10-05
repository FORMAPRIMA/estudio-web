'use client'

// Alta / edición de un proyecto. Formulario en 4 pasos a la izquierda y, a la
// derecha, la comisión resultante recalculada en vivo con su desglose.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ORIGENES, PLAN, calcular, cobrosIguales, esUniforme, eur, mesIdx, mesLargo, mesStr, mesActual, pct, r2,
  sumaPct, validar, type Cobro, type ProyectoInput,
} from '@/lib/retribucion'
import { Btn, Chip, Kv, Label, NumInput, T, card, eyebrow, inputStyle } from './ui'

export function proyectoVacio(): ProyectoInput {
  const hoy = mesActual()
  return {
    nombre: '', origen: 'orig', firma: mesStr(hoy),
    honorarios: 0, obra: 0, margenPct: PLAN.margenObraDefecto, descuento: false,
    cobrosHonorarios: cobrosIguales(4, hoy), cobrosObra: cobrosIguales(6, hoy + 6), notas: '',
  }
}

export function ProyectoForm({ inicial, esNuevo, esPartner, isSaving, error, onGuardar, onCancelar, onEliminar }: {
  inicial: ProyectoInput
  esNuevo: boolean
  esPartner: boolean
  isSaving: boolean
  error: string | null
  onGuardar: (p: ProyectoInput) => void
  onCancelar: () => void
  onEliminar?: () => void
}) {
  const [p, setP] = useState<ProyectoInput>(inicial)
  const [intentado, setIntentado] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const c = useMemo(() => calcular(p), [p])
  const errores = useMemo(() => validar(p), [p])
  const set = <K extends keyof ProyectoInput>(k: K, v: ProyectoInput[K]) => setP((x) => ({ ...x, [k]: v }))

  // Escape cierra
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancelar])

  // Al mover la firma, los calendarios aún uniformes se desplazan con ella
  const cambiarFirma = (nueva: string) => {
    const a = mesIdx(p.firma), b = mesIdx(nueva)
    setP((x) => {
      if (a === null || b === null) return { ...x, firma: nueva }
      const mover = (cs: Cobro[]) => (esUniforme(cs) ? cs.map((s) => ({ ...s, mes: mesStr((mesIdx(s.mes) ?? a) + b - a) })) : cs)
      return { ...x, firma: nueva, cobrosHonorarios: mover(x.cobrosHonorarios), cobrosObra: mover(x.cobrosObra) }
    })
  }

  const guardar = () => {
    setIntentado(true)
    if (errores.length) return
    onGuardar(p)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={esNuevo ? 'Registrar proyecto' : 'Editar proyecto'}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: '#1A1A1A55',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', padding: '32px 16px',
      }}
    >
      <div style={{ background: T.bg, borderRadius: 8, width: '100%', maxWidth: 1080, boxShadow: '0 20px 60px #0000002a' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '20px 28px', borderBottom: `1px solid ${T.line}` }}>
          <div>
            <p style={eyebrow}>{esNuevo ? 'Nuevo proyecto' : 'Editar proyecto'}</p>
            <h2 style={{ fontSize: 20, fontWeight: 300, margin: '4px 0 0', letterSpacing: '-0.01em', color: T.ink }}>
              {p.nombre.trim() || 'Proyecto sin nombre'}
            </h2>
          </div>
          <button onClick={onCancelar} aria-label="Cerrar" style={{ background: 'none', border: 0, fontSize: 22, color: T.soft, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div className="retrib-form-grid" style={{ display: 'grid', gap: 24, padding: 28 }}>
          {/* ── Formulario ── */}
          <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
            <Paso n={1} titulo="El proyecto">
              <div className="retrib-2col" style={{ display: 'grid', gap: 12 }}>
                <label>
                  <Label>Nombre</Label>
                  <input
                    autoFocus={esNuevo}
                    value={p.nombre}
                    onChange={(e) => set('nombre', e.target.value)}
                    placeholder="Ej. Reforma vivienda Velázquez 21"
                    style={inputStyle}
                  />
                </label>
                <label>
                  <Label hint="cuándo se firma">Mes de firma</Label>
                  <input type="month" value={p.firma} onChange={(e) => cambiarFirma(e.target.value)} style={inputStyle} />
                </label>
              </div>
            </Paso>

            <Paso n={2} titulo="¿De dónde viene el cliente?" ayuda="Decide qué parte de la comisión te corresponde.">
              <div style={{ display: 'grid', gap: 8 }}>
                {ORIGENES.map((o) => {
                  const sel = p.origen === o.id
                  return (
                    <label key={o.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 4, cursor: 'pointer',
                      border: `1px solid ${sel ? T.ink : T.line}`, background: sel ? T.panel : 'transparent',
                    }}>
                      <input type="radio" name="origen" checked={sel} onChange={() => set('origen', o.id)} style={{ accentColor: T.ink }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: T.ink }}>{o.nombre}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: T.soft }}>{o.corto}</span>
                      </span>
                      <Chip tone={o.coef === 1 ? 'green' : o.coef === 0 ? 'muted' : 'neutral'}>
                        {o.coef === 0 ? 'no comisiona' : `${Math.round(o.coef * 100)} %`}
                      </Chip>
                    </label>
                  )
                })}
              </div>
            </Paso>

            <Paso n={3} titulo="Importes" ayuda="Siempre sin IVA. La obra solo cuenta por el margen que se lleva el estudio.">
              <div className="retrib-3col" style={{ display: 'grid', gap: 12 }}>
                <label>
                  <Label>Honorarios de proyecto</Label>
                  <NumInput value={p.honorarios} onChange={(n) => set('honorarios', n)} step={1000} suffix="€" />
                </label>
                <label>
                  <Label hint="si hay">Presupuesto de obra</Label>
                  <NumInput value={p.obra} onChange={(n) => set('obra', n)} step={5000} suffix="€" />
                </label>
                <label>
                  <Label>Margen de obra</Label>
                  <NumInput value={p.margenPct} onChange={(n) => set('margenPct', n)} step={0.5} suffix="%" />
                </label>
              </div>
              {c.margenObra > 0 && (
                <p style={{ fontSize: 11.5, color: T.soft, margin: '8px 0 0' }}>
                  Margen del estudio: {pct(p.margenPct)} de {eur(p.obra)} = <b style={{ color: T.ink }}>{eur(c.margenObra)}</b>
                </p>
              )}
            </Paso>

            <Paso n={4} titulo="¿Cuándo se cobra?" ayuda="La comisión se devenga a medida que el estudio cobra, en los mismos meses.">
              <div style={{ display: 'grid', gap: 12 }}>
                <PlanCobros
                  titulo="Honorarios"
                  importe={c.honorarios}
                  comision={c.porHonorarios}
                  cobros={p.cobrosHonorarios}
                  onChange={(cs) => set('cobrosHonorarios', cs)}
                  inicioDefecto={mesIdx(p.firma) ?? mesActual()}
                  mostrarErrores={intentado}
                />
                <PlanCobros
                  titulo="Margen de obra"
                  importe={c.margenObra}
                  comision={c.porObra}
                  cobros={p.cobrosObra}
                  onChange={(cs) => set('cobrosObra', cs)}
                  inicioDefecto={(mesIdx(p.firma) ?? mesActual()) + 6}
                  mostrarErrores={intentado}
                />
              </div>
            </Paso>

            <div style={{ display: 'grid', gap: 12 }}>
              {esPartner ? (
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: T.ink, cursor: 'pointer' }}>
                  <input type="checkbox" checked={p.descuento} onChange={(e) => set('descuento', e.target.checked)} style={{ marginTop: 2, accentColor: T.red }} />
                  <span>
                    Se dio un descuento por encima del límite sin autorización de los socios
                    <span style={{ display: 'block', fontSize: 11, color: T.soft }}>La comisión se multiplica por {PLAN.penalizacionDescuento.toLocaleString('es-ES')}. Solo pueden marcarlo los socios.</span>
                  </span>
                </label>
              ) : p.descuento ? (
                <p style={{ fontSize: 12, color: T.red, margin: 0 }}>
                  Los socios han marcado este proyecto con descuento no autorizado (comisión × {PLAN.penalizacionDescuento.toLocaleString('es-ES')}).
                </p>
              ) : null}
              <label>
                <Label hint="opcional">Notas</Label>
                <textarea
                  value={p.notas ?? ''}
                  onChange={(e) => set('notas', e.target.value)}
                  rows={2}
                  placeholder="Contexto del cliente, quién lo presentó, acuerdos…"
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </label>
            </div>
          </div>

          {/* ── Resultado ── */}
          <aside style={{ minWidth: 0 }}>
            <div className="retrib-sticky" style={{ ...card, display: 'grid', gap: 14 }}>
              <Resultado p={p} />
            </div>
          </aside>
        </div>

        {/* Pie */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 28px', borderTop: `1px solid ${T.line}`, background: T.panel, borderRadius: '0 0 8px 8px',
        }}>
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            {error && <p role="alert" style={{ fontSize: 12, color: T.red, margin: 0 }}>{error}</p>}
            {!error && intentado && errores.length > 0 && (
              <p role="alert" style={{ fontSize: 12, color: T.red, margin: 0 }}>{errores[0]}</p>
            )}
            {onEliminar && (
              confirmarBorrado ? (
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 12, color: T.red }}>
                  ¿Eliminar este proyecto?
                  <Btn kind="danger" onClick={onEliminar} disabled={isSaving}>Sí, eliminar</Btn>
                  <Btn kind="ghost" onClick={() => setConfirmarBorrado(false)}>No</Btn>
                </span>
              ) : (
                !error && !(intentado && errores.length) && (
                  <Btn kind="link" onClick={() => setConfirmarBorrado(true)} style={{ color: T.red }}>Eliminar proyecto</Btn>
                )
              )
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn kind="ghost" onClick={onCancelar}>Cancelar</Btn>
            <Btn onClick={guardar} disabled={isSaving}>
              {isSaving ? 'Guardando…' : esNuevo ? 'Registrar proyecto' : 'Guardar cambios'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

function Paso({ n, titulo, ayuda, children }: { n: number; titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section style={card}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: ayuda ? 4 : 14 }}>
        <span style={{
          width: 20, height: 20, borderRadius: '50%', background: T.ink, color: '#fff', fontSize: 10.5, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transform: 'translateY(-2px)',
        }}>{n}</span>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: T.ink, letterSpacing: '-0.01em' }}>{titulo}</h3>
      </div>
      {ayuda && <p style={{ fontSize: 11.5, color: T.soft, margin: '0 0 14px 30px' }}>{ayuda}</p>}
      {children}
    </section>
  )
}

// ── Calendario de cobros de un bloque ───────────────────────────────────────

function PlanCobros({ titulo, importe, comision, cobros, onChange, inicioDefecto, mostrarErrores }: {
  titulo: string
  importe: number
  comision: number
  cobros: Cobro[]
  onChange: (c: Cobro[]) => void
  inicioDefecto: number
  mostrarErrores: boolean
}) {
  const [detalle, setDetalle] = useState(() => !esUniforme(cobros))
  const activo = importe > 0
  const inicio = mesIdx(cobros[0]?.mes) ?? inicioDefecto
  const suma = sumaPct(cobros)
  const fin = cobros.length ? mesIdx(cobros[cobros.length - 1].mes) : null

  const boxStyle = {
    border: `1px solid ${T.line}`, borderRadius: 4, padding: '12px 14px', background: T.bg,
    opacity: activo ? 1 : 0.55,
  }

  return (
    <div style={boxStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: activo ? 10 : 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{titulo}</span>
        <span style={{ fontSize: 11.5, color: T.soft, fontVariantNumeric: 'tabular-nums' }}>
          {activo ? <>{eur(importe)} · comisión <b style={{ color: T.ink }}>{eur(comision, true)}</b></> : 'Sin importe: no se tiene en cuenta'}
        </span>
      </div>
      {activo && (
        <>
          {!detalle ? (
            <div className="retrib-2col" style={{ display: 'grid', gap: 12, alignItems: 'end' }}>
              <label>
                <Label>Número de cobros</Label>
                <NumInput value={cobros.length} min={1} onChange={(n) => onChange(cobrosIguales(n, inicio))} />
              </label>
              <label>
                <Label>Primer cobro</Label>
                <input
                  type="month"
                  value={mesStr(inicio)}
                  onChange={(e) => { const m = mesIdx(e.target.value); if (m !== null) onChange(cobrosIguales(cobros.length, m)) }}
                  style={inputStyle}
                />
              </label>
              <p style={{ gridColumn: '1 / -1', fontSize: 11.5, color: T.soft, margin: 0 }}>
                {cobros.length === 1
                  ? `Un único cobro en ${mesLargo(inicio)}.`
                  : `${cobros.length} cobros iguales, uno al mes, de ${mesLargo(inicio)} a ${fin !== null ? mesLargo(fin) : '—'}.`}
                {' '}
                <button onClick={() => setDetalle(true)} style={{ background: 'none', border: 0, padding: 0, color: T.accent, cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit' }}>
                  Ajustar cobro a cobro
                </button>
              </p>
            </div>
          ) : (
            <div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 380 }}>
                  <thead>
                    <tr style={{ color: T.soft, textAlign: 'left' }}>
                      <th style={th}>#</th><th style={th}>Mes</th><th style={th}>% del bloque</th>
                      <th style={{ ...th, textAlign: 'right' }}>Comisión</th><th style={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {cobros.map((s, j) => (
                      <tr key={j}>
                        <td style={td}>{j + 1}</td>
                        <td style={td}>
                          <input type="month" aria-label={`Mes del cobro ${j + 1}`} value={s.mes}
                            onChange={(e) => onChange(cobros.map((x, k) => (k === j ? { ...x, mes: e.target.value } : x)))}
                            style={{ ...inputStyle, padding: '6px 8px', background: T.panel }} />
                        </td>
                        <td style={{ ...td, width: 110 }}>
                          <NumInput ariaLabel={`Porcentaje del cobro ${j + 1}`} value={s.pct} step={0.5} suffix="%"
                            onChange={(n) => onChange(cobros.map((x, k) => (k === j ? { ...x, pct: n } : x)))}
                            style={{ padding: '6px 8px', background: T.panel }} />
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{eur(r2(comision * s.pct / 100), true)}</td>
                        <td style={{ ...td, width: 28 }}>
                          {cobros.length > 1 && (
                            <button aria-label={`Quitar cobro ${j + 1}`} onClick={() => onChange(cobros.filter((_, k) => k !== j))}
                              style={{ background: 'none', border: 0, color: T.faint, cursor: 'pointer', fontSize: 15 }}>×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginTop: 8, fontSize: 11.5 }}>
                <span style={{ color: suma === 100 ? T.green : T.red, fontWeight: 500 }}>
                  Suman {pct(suma)}{suma === 100 ? ' ✓' : ' · deben sumar 100 %'}
                </span>
                <button onClick={() => {
                  const last = mesIdx(cobros[cobros.length - 1]?.mes) ?? inicio - 1
                  onChange([...cobros, { mes: mesStr(last + 1), pct: r2(Math.max(0, 100 - suma)) }])
                }} style={linkBtn}>+ Añadir cobro</button>
                {suma !== 100 && cobros.length > 0 && (
                  <button onClick={() => {
                    const k = cobros.length - 1
                    onChange(cobros.map((x, j) => (j === k ? { ...x, pct: r2(x.pct + 100 - suma) } : x)))
                  }} style={linkBtn}>Cuadrar en el último</button>
                )}
                <button onClick={() => { onChange(cobrosIguales(cobros.length, inicio)); setDetalle(false) }} style={{ ...linkBtn, color: T.soft }}>
                  Volver a cobros iguales
                </button>
              </div>
            </div>
          )}
          {mostrarErrores && cobros.some((x) => mesIdx(x.mes) === null) && (
            <p style={{ fontSize: 11.5, color: T.red, margin: '6px 0 0' }}>Falta el mes de algún cobro.</p>
          )}
        </>
      )}
    </div>
  )
}

const th = { padding: '4px 6px', fontWeight: 500, fontSize: 11 } as const
const td = { padding: '4px 6px', borderTop: `1px solid ${T.lineSoft}` } as const
const linkBtn = { background: 'none', border: 0, padding: 0, color: T.accent, cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit' } as const

// ── Panel de resultado ──────────────────────────────────────────────────────

export function Resultado({ p }: { p: ProyectoInput }) {
  const c = calcular(p)
  const o = ORIGENES.find((x) => x.id === p.origen)!
  const colores = ['#D85A30', '#D85A30B0', '#D85A3070']

  return (
    <>
      <div>
        <p style={eyebrow}>Tu comisión por este proyecto</p>
        <p style={{ fontSize: 40, fontWeight: 300, letterSpacing: '-0.03em', margin: '6px 0 2px', color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
          {eur(c.total, c.total % 1 !== 0)}
        </p>
        <p style={{ fontSize: 11.5, color: T.soft, margin: 0 }}>
          {c.baseBruta > 0
            ? c.bajoMinimo
              ? `No llega al mínimo de ${eur(PLAN.minimo)}: no genera comisión.`
              : c.coef === 0
              ? 'Las cuentas del estudio no generan comisión.'
              : `Equivale al ${pct(r2(c.efectivo))} de lo que factura el estudio por el proyecto.`
            : 'Introduce los importes para ver el cálculo.'}
        </p>
      </div>

      {/* Barra de tramos */}
      <div>
        <div style={{ display: 'flex', height: 38, border: `1px solid ${T.line}`, borderRadius: 4, overflow: 'hidden', background: T.bg }}>
          {c.tramos.map((t, i) => {
            const ancho = ((t.hasta - t.desde) / PLAN.tope) * 100
            const lleno = t.hasta > t.desde ? (t.importe / (t.hasta - t.desde)) * 100 : 0
            return (
              <div key={i} style={{ position: 'relative', width: `${ancho}%`, borderRight: i < c.tramos.length - 1 ? `1px dashed ${T.line}` : 0 }}>
                <div style={{ position: 'absolute', inset: 0, width: `${lleno}%`, background: colores[i], opacity: 0.35, transition: 'width .3s' }} />
                <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10.5, fontWeight: 600, color: T.ink }}>
                  {pct(t.pct * 100)}
                </span>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', fontSize: 10, color: T.faint, marginTop: 4 }}>
          {c.tramos.map((t, i) => (
            <span key={i} style={{ width: `${((t.hasta - t.desde) / PLAN.tope) * 100}%`, textAlign: 'right' }}>{eur(t.hasta)}</span>
          ))}
        </div>
      </div>

      <div>
        <Kv k="Honorarios" v={eur(c.honorarios)} />
        <Kv k="Margen de obra" v={c.margenObra ? eur(c.margenObra) : '—'} />
        <Kv k={c.exceso > 0 ? 'Base que cuenta (con tope)' : 'Base que cuenta'} v={eur(c.base)} strong />
        {c.tramos.filter((t) => t.importe > 0).map((t, i) => (
          <Kv key={i} k={`${eur(t.importe)} al ${pct(t.pct * 100)}`} v={eur(r2(t.comision), true)} />
        ))}
        <Kv k={`Origen: ${o.nombre}`} v={`× ${o.coef.toLocaleString('es-ES')}`} />
        {c.bajoMinimo && <Kv k={`Por debajo del mínimo de ${eur(PLAN.minimo)}`} v="× 0" color={T.red} />}
        {p.descuento && <Kv k="Descuento no autorizado" v={`× ${PLAN.penalizacionDescuento.toLocaleString('es-ES')}`} color={T.red} />}
        <Kv k="Comisión" v={eur(r2(c.total), true)} strong />
      </div>

      {c.exceso > 0 && (
        <p style={{ fontSize: 11.5, color: T.amber, background: T.amberSoft, padding: '8px 10px', borderRadius: 4, margin: 0 }}>
          {eur(c.exceso)} superan el tope de {eur(PLAN.tope)} por proyecto y no generan comisión.
        </p>
      )}
      {c.bajoMinimo && (
        <p style={{ fontSize: 11.5, color: T.soft, background: T.lineSoft, padding: '8px 10px', borderRadius: 4, margin: 0 }}>
          Los proyectos con menos de {eur(PLAN.minimo)} entre honorarios y margen de obra no comisionan, sea cual sea su origen.
          Faltan {eur(PLAN.minimo - c.baseBruta)} para llegar. Puedes registrarlo igualmente para que conste.
        </p>
      )}
      {c.coef === 0 && c.baseBruta > 0 && !c.bajoMinimo && (
        <p style={{ fontSize: 11.5, color: T.soft, background: T.lineSoft, padding: '8px 10px', borderRadius: 4, margin: 0 }}>
          Puedes registrarlo igualmente para que conste el trabajo hecho; su comisión es 0 €.
        </p>
      )}
    </>
  )
}
