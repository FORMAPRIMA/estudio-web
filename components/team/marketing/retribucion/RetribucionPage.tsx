'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  PLAN, calcular, devengoMensual, eur, inicioPeriodo, liquidaciones, mesActual, mesCorto, mesIdx, mesLargo, origenDe, pct, r2,
  type PlanBeneficiario, type Proyecto, type ProyectoInput,
} from '@/lib/retribucion'
import {
  createProyectoRetribucion, deleteProyectoRetribucion, updatePlanRetribucion, updateProyectoRetribucion,
} from '@/app/actions/retribucion'
import { ProyectoForm, proyectoVacio } from './ProyectoForm'
import { Btn, Chip, Label, NumInput, T, card, eyebrow } from './ui'

type Tab = 'proyectos' | 'calendario'

export function RetribucionPage({ planes, plan, proyectos: inicial, esPartner, esPropio }: {
  planes: PlanBeneficiario[]
  plan: PlanBeneficiario
  proyectos: Proyecto[]
  esPartner: boolean
  esPropio: boolean
}) {
  const router = useRouter()
  const [proyectos, setProyectos] = useState(inicial)
  const [tab, setTab] = useState<Tab>('proyectos')
  const [editando, setEditando] = useState<Proyecto | 'nuevo' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const hoy = mesActual()
  const liqs = useMemo(() => liquidaciones(proyectos), [proyectos])
  const total = useMemo(() => proyectos.reduce((a, p) => a + calcular(p).total, 0), [proyectos])
  // Periodo en curso (aún devengándose) y los ya cerrados pendientes de pago
  const periodoActual = inicioPeriodo(hoy)
  const enCurso = liqs.find((l) => l.inicio === periodoActual)
  const proxima = liqs.find((l) => l.pago >= hoy && l.importe > 0.5)
  const anio = Math.floor(hoy / 12)
  const delAnio = liqs.filter((l) => Math.floor(l.pago / 12) === anio)
  const cobradoAnio = delAnio.filter((l) => l.pago < hoy).reduce((a, l) => a + l.importe, 0)
  const previstoAnio = delAnio.reduce((a, l) => a + l.importe, 0)

  const quien = esPropio ? 'tu' : `de ${plan.nombre.split(' ')[0]}`

  const guardar = (p: ProyectoInput) => {
    setError(null)
    startSaving(async () => {
      try {
        if (editando === 'nuevo') {
          const nuevo = await createProyectoRetribucion(plan.beneficiarioId, p)
          setProyectos((xs) => [...xs, nuevo].sort(porFirma))
        } else if (editando) {
          const act = await updateProyectoRetribucion(editando.id, p)
          setProyectos((xs) => xs.map((x) => (x.id === act.id ? act : x)).sort(porFirma))
        }
        setEditando(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo guardar.')
      }
    })
  }

  const eliminar = () => {
    if (!editando || editando === 'nuevo') return
    const id = editando.id
    startSaving(async () => {
      try {
        await deleteProyectoRetribucion(id)
        setProyectos((xs) => xs.filter((x) => x.id !== id))
        setEditando(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo eliminar.')
      }
    })
  }

  return (
    <div style={{ padding: 'clamp(24px, 4vw, 40px) clamp(16px, 4vw, 48px) 64px', maxWidth: 1240, color: T.ink }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...eyebrow, marginBottom: 8 }}>Marketing · Business development</p>
          <h1 style={{ fontSize: 28, fontWeight: 300, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Retribución</h1>
          <p style={{ fontSize: 13, color: T.faint, margin: 0, fontWeight: 300 }}>
            {esPropio
              ? 'Registra los proyectos que traes al estudio y mira cuánto variable te generan y cuándo lo cobras.'
              : `Proyectos captados por ${plan.nombre} y su retribución variable.`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {esPartner && planes.length > 1 && (
            <select
              aria-label="Persona"
              value={plan.beneficiarioId}
              onChange={(e) => router.push(`?b=${e.target.value}`)}
              style={{ padding: '9px 10px', borderRadius: 4, border: `1px solid ${T.line}`, background: T.panel, fontSize: 12, fontFamily: 'inherit' }}
            >
              {planes.map((x) => <option key={x.beneficiarioId} value={x.beneficiarioId}>{x.nombre}</option>)}
            </select>
          )}
          <Link href="/team/marketing/retribucion/como-funciona" style={{
            fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, textDecoration: 'none',
            color: T.accent, border: `1px solid #D85A3040`, padding: '10px 16px', borderRadius: 4, whiteSpace: 'nowrap',
          }}>
            ¿Cómo se calcula? →
          </Link>
          <Btn onClick={() => { setError(null); setEditando('nuevo') }}>+ Registrar proyecto</Btn>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 28 }}>
        <Kpi
          titulo="Próximo pago"
          valor={proxima ? eur(proxima.importe) : '—'}
          pie={proxima ? `En la nómina de ${mesLargo(proxima.pago)} · ${proxima.etiqueta.split(' (')[0]}` : 'Sin comisiones previstas'}
          destacado
        />
        <Kpi
          titulo="Acumulado este trimestre"
          valor={eur(enCurso?.importe ?? 0)}
          pie={`Se liquida en ${mesLargo(periodoActual + PLAN.mesesLiquidacion)}`}
        />
        <Kpi
          titulo={`Variable ${anio}`}
          valor={eur(previstoAnio)}
          pie={`${eur(cobradoAnio)} ya pagado · resto previsto`}
        />
        <Kpi
          titulo="Comisión total registrada"
          valor={eur(total)}
          pie={`${proyectos.length} ${proyectos.length === 1 ? 'proyecto' : 'proyectos'}`}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.line}`, marginBottom: 20 }}>
        {([['proyectos', 'Proyectos'], ['calendario', 'Calendario de pagos']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '10px 18px', fontSize: 10.5, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'inherit',
            background: 'none', border: 0, borderBottom: `2px solid ${tab === id ? T.ink : 'transparent'}`, marginBottom: -1,
            color: tab === id ? T.ink : T.soft, cursor: 'pointer', fontWeight: tab === id ? 500 : 400,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'proyectos' && (
        <ListaProyectos proyectos={proyectos} hoy={hoy} onAbrir={(p) => { setError(null); setEditando(p) }} onNuevo={() => setEditando('nuevo')} quien={quien} />
      )}
      {tab === 'calendario' && (
        <Calendario proyectos={proyectos} plan={plan} esPartner={esPartner} hoy={hoy} />
      )}

      {editando && (
        <ProyectoForm
          inicial={editando === 'nuevo' ? proyectoVacio() : editando}
          esNuevo={editando === 'nuevo'}
          esPartner={esPartner}
          isSaving={isSaving}
          error={error}
          onGuardar={guardar}
          onCancelar={() => setEditando(null)}
          onEliminar={editando === 'nuevo' ? undefined : eliminar}
        />
      )}
    </div>
  )
}

const porFirma = (a: Proyecto, b: Proyecto) => (mesIdx(a.firma) ?? 0) - (mesIdx(b.firma) ?? 0)

function Kpi({ titulo, valor, pie, destacado }: { titulo: string; valor: string; pie: string; destacado?: boolean }) {
  return (
    <div style={{
      ...card, padding: '16px 18px',
      ...(destacado ? { background: T.ink, borderColor: T.ink } : {}),
    }}>
      <p style={{ ...eyebrow, color: destacado ? '#FFFFFF90' : T.soft }}>{titulo}</p>
      <p style={{ fontSize: 26, fontWeight: 300, letterSpacing: '-0.02em', margin: '8px 0 4px', color: destacado ? '#fff' : T.ink, fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </p>
      <p style={{ fontSize: 11, color: destacado ? '#FFFFFF80' : T.faint, margin: 0 }}>{pie}</p>
    </div>
  )
}

// ── Proyectos ───────────────────────────────────────────────────────────────

function ListaProyectos({ proyectos, hoy, onAbrir, onNuevo, quien }: {
  proyectos: Proyecto[]
  hoy: number
  onAbrir: (p: Proyecto) => void
  onNuevo: () => void
  quien: string
}) {
  if (!proyectos.length) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
        <p style={{ fontSize: 15, fontWeight: 300, margin: '0 0 6px' }}>Aún no hay proyectos registrados.</p>
        <p style={{ fontSize: 12, color: T.soft, margin: '0 0 20px' }}>
          Cuando un cliente firme, regístralo aquí: verás al momento cuánto genera y en qué nóminas se paga.
        </p>
        <Btn onClick={onNuevo}>+ Registrar el primero</Btn>
      </div>
    )
  }

  return (
    <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 760 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: T.soft }}>
            <Th>Proyecto</Th><Th>Origen</Th><Th>Firma</Th>
            <Th right>Base que cuenta</Th><Th right>Comisión</Th><Th>Cobro de la comisión</Th>
          </tr>
        </thead>
        <tbody>
          {proyectos.map((p) => {
            const c = calcular(p)
            const o = origenDe(p.origen)
            const meses = Object.entries(devengoMensual(p)).map(([m, v]) => [Number(m), v] as const).filter(([, v]) => v > 0.005)
            const devengado = meses.filter(([m]) => m < hoy).reduce((a, [, v]) => a + v, 0)
            const avance = c.total > 0 ? Math.min(1, devengado / c.total) : 0
            const fin = meses.length ? Math.max(...meses.map(([m]) => m)) : null
            return (
              <tr
                key={p.id}
                onClick={() => onAbrir(p)}
                onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(p) }}
                tabIndex={0}
                className="retrib-row"
                style={{ cursor: 'pointer', borderTop: `1px solid ${T.lineSoft}` }}
              >
                <Td>
                  <span style={{ fontWeight: 500 }}>{p.nombre}</span>
                  {p.descuento && <span style={{ marginLeft: 8 }}><Chip tone="accent">descuento</Chip></span>}
                </Td>
                <Td><Chip tone={o.coef === 1 ? 'green' : o.coef === 0 ? 'muted' : 'neutral'}>{o.nombre}</Chip></Td>
                <Td>{mesIdx(p.firma) !== null ? mesCorto(mesIdx(p.firma)!) : '—'}</Td>
                <Td right>{eur(c.base)}</Td>
                <Td right><b>{c.total > 0 ? eur(r2(c.total), c.total % 1 !== 0) : <span style={{ color: T.faint, fontWeight: 400 }}>0 €</span>}</b></Td>
                <Td>
                  {c.total > 0 ? (
                    <div style={{ minWidth: 150 }}>
                      <div style={{ height: 4, background: T.lineSoft, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${avance * 100}%`, height: '100%', background: T.accent }} />
                      </div>
                      <span style={{ fontSize: 10.5, color: T.soft }}>
                        {avance >= 1 ? 'Devengada entera' : `${Math.round(avance * 100)} % devengado${fin !== null ? ` · hasta ${mesCorto(fin)}` : ''}`}
                      </span>
                    </div>
                  ) : <span style={{ fontSize: 11, color: T.faint }}>—</span>}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: T.faint, margin: 0, padding: '10px 16px', borderTop: `1px solid ${T.lineSoft}` }}>
        Pulsa un proyecto para ver {quien === 'tu' ? 'tu' : 'la'} comisión en detalle, editarlo o eliminarlo.
      </p>
    </div>
  )
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: '12px 16px', fontWeight: 500, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td style={{ padding: '12px 16px', textAlign: right ? 'right' : 'left', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums' }}>{children}</td>
}

// ── Calendario ──────────────────────────────────────────────────────────────

function Calendario({ proyectos, plan, esPartner, hoy }: {
  proyectos: Proyecto[]
  plan: PlanBeneficiario
  esPartner: boolean
  hoy: number
}) {
  const liqs = liquidaciones(proyectos)
  const [verDetalle, setVerDetalle] = useState(false)

  if (!liqs.length) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '40px 24px', color: T.soft, fontSize: 13 }}>
        Registra proyectos con comisión para ver aquí cuándo se paga.
      </div>
    )
  }
  const max = Math.max(...liqs.map((l) => l.importe), 1)
  const fijoPeriodo = (plan.salarioBase / 12) * PLAN.mesesLiquidacion

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <div style={{ padding: '18px 20px 6px' }}>
          <h2 style={h2}>Liquidaciones trimestrales</h2>
          <p style={sub}>
            Lo que se devenga en cada trimestre se paga en la nómina del mes siguiente al cierre.
          </p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 640 }}>
          <thead>
            <tr style={{ color: T.soft }}>
              <Th>Trimestre</Th><Th right>Variable</Th><Th /><Th>Se paga en</Th><Th right>Fijo del trimestre</Th><Th right>Total bruto</Th>
            </tr>
          </thead>
          <tbody>
            {liqs.map((l) => {
              const pagada = l.pago < hoy
              const actual = l.inicio === inicioPeriodo(hoy)
              return (
                <tr key={l.inicio} style={{ borderTop: `1px solid ${T.lineSoft}`, background: actual ? T.accentSoft : undefined }}>
                  <Td>
                    {l.etiqueta}
                    {actual && <span style={{ marginLeft: 8 }}><Chip tone="accent">en curso</Chip></span>}
                  </Td>
                  <Td right><b>{eur(r2(l.importe), true)}</b></Td>
                  <Td>
                    <div style={{ width: 140, height: 8, background: T.lineSoft, borderRadius: 2 }}>
                      <div style={{ width: `${(l.importe / max) * 100}%`, height: '100%', borderRadius: 2, background: pagada ? '#1A1A1A40' : T.accent }} />
                    </div>
                  </Td>
                  <Td>
                    <span style={{ color: pagada ? T.faint : T.ink }}>{mesLargo(l.pago)}</span>
                    {pagada && <span style={{ marginLeft: 8 }}><Chip tone="muted">pagado</Chip></span>}
                  </Td>
                  <Td right><span style={{ color: T.soft }}>{eur(fijoPeriodo)}</span></Td>
                  <Td right>{eur(fijoPeriodo + l.importe)}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <ResumenAnual liqs={liqs} plan={plan} esPartner={esPartner} />

      <section style={{ ...card, padding: 0 }}>
        <button onClick={() => setVerDetalle((v) => !v)} style={{
          width: '100%', textAlign: 'left', background: 'none', border: 0, padding: '16px 20px', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>
            <span style={{ ...h2, display: 'block', margin: 0 }}>Detalle mes a mes por proyecto</span>
            <span style={{ ...sub, display: 'block', margin: '2px 0 0' }}>De dónde sale cada liquidación.</span>
          </span>
          <span style={{ fontSize: 12, color: T.soft }}>{verDetalle ? 'Ocultar ▲' : 'Ver ▼'}</span>
        </button>
        {verDetalle && <Timeline proyectos={proyectos} hoy={hoy} />}
      </section>
    </div>
  )
}

function ResumenAnual({ liqs, plan, esPartner }: { liqs: ReturnType<typeof liquidaciones>; plan: PlanBeneficiario; esPartner: boolean }) {
  const [salario, setSalario] = useState(plan.salarioBase)
  const [ss, setSs] = useState(plan.ssPct)
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'ok' | 'error'>('idle')
  const cambiado = salario !== plan.salarioBase || ss !== plan.ssPct

  const porAnio: Record<number, number> = {}
  liqs.forEach((l) => { const y = Math.floor(l.pago / 12); porAnio[y] = (porAnio[y] ?? 0) + l.importe })

  const guardar = async () => {
    setEstado('guardando')
    try { await updatePlanRetribucion(plan.beneficiarioId, salario, ss); setEstado('ok') } catch { setEstado('error') }
  }

  return (
    <section style={{ ...card, padding: 0, overflowX: 'auto' }}>
      <div style={{ padding: '18px 20px 6px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={h2}>Resumen por año</h2>
          <p style={sub}>Según el año en que se paga cada liquidación.</p>
        </div>
        {esPartner && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ width: 150 }}><Label>Salario fijo anual</Label><NumInput value={salario} step={500} suffix="€" onChange={(n) => { setSalario(n); setEstado('idle') }} /></label>
            <label style={{ width: 110 }}><Label>SS empresa</Label><NumInput value={ss} step={0.1} suffix="%" onChange={(n) => { setSs(n); setEstado('idle') }} /></label>
            <Btn kind="ghost" onClick={guardar} disabled={!cambiado || estado === 'guardando'}>
              {estado === 'guardando' ? 'Guardando…' : estado === 'ok' && !cambiado ? 'Guardado' : 'Guardar'}
            </Btn>
            {estado === 'error' && <span style={{ fontSize: 11, color: T.red }}>No se pudo guardar</span>}
          </div>
        )}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 640 }}>
        <thead>
          <tr style={{ color: T.soft }}>
            <Th>Año</Th><Th right>Variable</Th><Th right>Fijo</Th><Th right>Total bruto</Th><Th right>Peso del variable</Th>
            {esPartner && <Th right>Coste empresa</Th>}
          </tr>
        </thead>
        <tbody>
          {Object.keys(porAnio).map(Number).sort().map((y) => {
            const v = porAnio[y], t = salario + v
            return (
              <tr key={y} style={{ borderTop: `1px solid ${T.lineSoft}` }}>
                <Td>{y}</Td>
                <Td right><b>{eur(v)}</b></Td>
                <Td right>{eur(salario)}</Td>
                <Td right>{eur(t)}</Td>
                <Td right><span style={{ color: T.soft }}>{t ? pct(r2((v / t) * 100)) : '—'}</span></Td>
                {esPartner && <Td right>{eur(t * (1 + ss / 100))}</Td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function Timeline({ proyectos, hoy }: { proyectos: Proyecto[]; hoy: number }) {
  const filas = proyectos.map((p) => ({ p, meses: devengoMensual(p) })).filter((f) => Object.values(f.meses).some((v) => v > 0.005))
  const todos = filas.flatMap((f) => Object.keys(f.meses).map(Number))
  if (!todos.length) return null
  const ini = inicioPeriodo(Math.min(...todos))
  let fin = inicioPeriodo(Math.max(...todos)) + PLAN.mesesLiquidacion - 1
  if (fin - ini > 59) fin = ini + 59
  const meses = Array.from({ length: fin - ini + 1 }, (_, j) => ini + j)
  const max = Math.max(...filas.flatMap((f) => Object.values(f.meses)), 1)
  const cierre = (m: number) => ((m % 12) + 1) % PLAN.mesesLiquidacion === 0
  const cell = { padding: '6px 6px', minWidth: 54, textAlign: 'right' as const, whiteSpace: 'nowrap' as const, fontVariantNumeric: 'tabular-nums' as const }
  const sticky = { position: 'sticky' as const, left: 0, background: T.panel, zIndex: 1, minWidth: 180, maxWidth: 220, borderRight: `1px solid ${T.line}`, textAlign: 'left' as const }

  return (
    <div style={{ overflowX: 'auto', borderTop: `1px solid ${T.line}` }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
        <thead>
          <tr style={{ color: T.soft }}>
            <th style={{ ...cell, ...sticky, fontWeight: 500 }}>Proyecto</th>
            {meses.map((m) => (
              <th key={m} style={{ ...cell, fontWeight: m === hoy ? 600 : 500, color: m === hoy ? T.accent : T.soft, borderRight: cierre(m) ? `2px solid ${T.line}` : undefined }}>
                {mesCorto(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ p, meses: dm }) => (
            <tr key={p.id}>
              <td style={{ ...cell, ...sticky, overflow: 'hidden', textOverflow: 'ellipsis', borderTop: `1px solid ${T.lineSoft}` }} title={p.nombre}>
                {p.nombre}
                <span style={{ display: 'block', fontSize: 10, color: T.faint }}>{origenDe(p.origen).nombre}</span>
              </td>
              {meses.map((m) => {
                const v = dm[m] ?? 0
                return (
                  <td key={m} style={{
                    ...cell, borderTop: `1px solid ${T.lineSoft}`, borderRight: cierre(m) ? `2px solid ${T.line}` : undefined,
                    background: v > 0.5 ? `rgba(216, 90, 48, ${(0.08 + (v / max) * 0.4).toFixed(2)})` : undefined,
                  }}>
                    {v > 0.5 ? Math.round(v).toLocaleString('es-ES', { useGrouping: true }) : ''}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, ...sticky, fontWeight: 600, borderTop: `2px solid ${T.ink}` }}>Total del mes</td>
            {meses.map((m) => {
              const v = filas.reduce((a, f) => a + (f.meses[m] ?? 0), 0)
              return (
                <td key={m} style={{ ...cell, fontWeight: 600, borderTop: `2px solid ${T.ink}`, borderRight: cierre(m) ? `2px solid ${T.line}` : undefined }}>
                  {v > 0.5 ? Math.round(v).toLocaleString('es-ES', { useGrouping: true }) : ''}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 10.5, color: T.faint, margin: 0, padding: '8px 16px' }}>
        Importes en euros. La línea vertical marca el cierre de cada trimestre.
      </p>
    </div>
  )
}

const h2 = { fontSize: 14, fontWeight: 600, margin: 0, color: T.ink, letterSpacing: '-0.01em' } as const
const sub = { fontSize: 11.5, color: T.soft, margin: '4px 0 10px' } as const
