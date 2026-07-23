'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react'
import Link from 'next/link'
import {
  BASE_INPUTS, computeModelo, esViable, eur, num, pct,
  type Escenario, type ModeloInputs, type ModeloResults,
} from '@/lib/modelo-cafe/domain'
import { type CapexItem } from '@/lib/modelo-cafe/capex'
import { createEscenario, deleteEscenario, updateEscenario, saveCapex } from '@/app/actions/modelo-cafe'
import { C, panelStyle, h2Style } from './theme'
import { NumField, RangeField } from './Field'
import DossierTab from './DossierTab'
import MercadoTab from './MercadoTab'
import PropuestaTab from './PropuestaTab'
import CapexTab from './CapexTab'

function Group({ title, cols = 2, children }: { title: string; cols?: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: C.coffee,
        }}>{title}</span>
        <span style={{ flex: 1, height: 1, background: C.line }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0 14px' }}>
        {children}
      </div>
    </div>
  )
}

// ── Piezas de presentación ──────────────────────────────────────────

function KPI({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'g' | 'r' }) {
  return (
    <div style={{ ...panelStyle, flex: 1, minWidth: 150, padding: '16px 18px' }}>
      <div style={{
        fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: C.faint, marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontSize: 24, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.02em',
        color: tone === 'g' ? C.green : tone === 'r' ? C.red : C.ink,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function Row({ label, m, a, strong, tone }: { label: string; m: number; a?: number; strong?: boolean; tone?: 'g' | 'r' }) {
  const color = tone === 'g' ? C.green : tone === 'r' ? C.red : C.ink
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', padding: '6px 0',
      borderTop: strong ? `1.5px solid ${C.ink}` : `1px solid ${C.line}`, alignItems: 'baseline',
    }}>
      <span style={{ fontSize: 12.5, color: C.ink, fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span style={{ textAlign: 'right', fontSize: strong ? 14 : 12.5, fontWeight: strong ? 600 : 500, color }}>
        {eur(m)}
      </span>
      <span style={{ textAlign: 'right', fontSize: strong ? 14 : 12.5, fontWeight: strong ? 600 : 500, color: C.faint }}>
        {a === undefined ? '' : eur(a)}
      </span>
    </div>
  )
}

function Stat({ label, value, tone, last }: { label: string; value: string; tone?: 'g' | 'r'; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '9px 0', borderBottom: last ? 'none' : `1px solid ${C.line}`,
    }}>
      <span style={{ fontSize: 12, color: C.soft }}>{label}</span>
      <span style={{
        fontSize: 15, fontWeight: 600,
        color: tone === 'g' ? C.green : tone === 'r' ? C.red : C.ink,
      }}>{value}</span>
    </div>
  )
}

function FinRow({ label, value, accent, strong }: { label: string; value: string; accent: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0' }}>
      <span style={{ fontSize: 12, color: '#FFFFFF75' }}>{label}</span>
      <span style={{ fontSize: strong ? 17 : 14, fontWeight: 600, color: strong ? accent : '#FFFFFFE6' }}>
        {value}
      </span>
    </div>
  )
}

function Phase({ title, note, value }: { title: string; note: string; value: number }) {
  const bad = value < 0
  return (
    <div style={{
      border: `1px solid ${bad ? '#E3B7AE' : C.line}`,
      background: bad ? '#FBEEEB' : C.bg,
      borderRadius: 6, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{title}</div>
      <div style={{ fontSize: 11, color: C.soft, marginBottom: 8 }}>{note}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: bad ? C.red : C.green }}>
        {eur(value)}<span style={{ fontSize: 11, fontWeight: 400, color: C.faint }}> /mes</span>
      </div>
    </div>
  )
}

function Concl({ n, t }: { n: string; t: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.gold, marginBottom: 4 }}>{n}</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#FFFFFFCC' }}>{t}</div>
    </div>
  )
}

function Marker({ x, label, value, color, up }: { x: number; label: string; value: string; color: string; up?: boolean }) {
  return (
    <div style={{ position: 'absolute', top: up ? -6 : 30, left: `${x}%`, transform: 'translateX(-50%)', textAlign: 'center' }}>
      {!up && <div style={{ width: 2, height: 8, background: color, margin: '0 auto 2px' }} />}
      <div style={{ fontSize: 10, color, fontWeight: 600, whiteSpace: 'nowrap' }}>{value} · {label}</div>
      {up && <div style={{ width: 2, height: 8, background: color, margin: '2px auto 0' }} />}
    </div>
  )
}

// ── Botones de la barra de escenarios ───────────────────────────────

function BarBtn({ children, onClick, primary, danger, disabled }: {
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 14px', borderRadius: 4, fontSize: 11.5, fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        border: `1px solid ${primary ? C.accent : danger ? '#E3B7AE' : C.line}`,
        background: primary ? C.accent : '#fff',
        color: primary ? '#fff' : danger ? C.red : C.ink,
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
      }}
    >{children}</button>
  )
}

// ── Componente principal ────────────────────────────────────────────

type Tab = 'modelo' | 'sensibilidad' | 'comparativa'
type Seccion = 'modelo' | 'capex' | 'dossier' | 'mercado' | 'propuesta'

const SECCIONES: [Seccion, string][] = [
  ['modelo', 'Modelo financiero'],
  ['capex', 'CAPEX / equipamiento'],
  ['dossier', 'Dossier bancario'],
  ['mercado', 'Análisis de mercado'],
  ['propuesta', 'Propuesta final'],
]

export default function ModeloCafePage({ escenariosIniciales, capexInicial }: {
  escenariosIniciales: Escenario[]
  capexInicial: CapexItem[]
}) {
  const [escenarios, setEscenarios] = useState<Escenario[]>(escenariosIniciales)
  const [activeId, setActiveId] = useState<string>(escenariosIniciales[0].id)
  const active = escenarios.find((e) => e.id === activeId) ?? escenarios[0]

  const [v, setV] = useState<ModeloInputs>({ ...active.inputs })
  const [notas, setNotas] = useState<string>(active.notas ?? '')
  const [tab, setTab] = useState<Tab>('modelo')
  const [seccion, setSeccion] = useState<Seccion>('modelo')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  // CAPEX compartido: estado + autoguardado en la nube (debounce)
  const [capex, setCapex] = useState<CapexItem[]>(capexInicial)
  const [capexEstado, setCapexEstado] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [capexError, setCapexError] = useState<string | null>(null)
  const capexPrimera = useRef(true)
  useEffect(() => {
    if (capexPrimera.current) { capexPrimera.current = false; return }
    setCapexEstado('saving')
    const t = setTimeout(async () => {
      const res = await saveCapex(capex)
      if ('error' in res) { setCapexEstado('error'); setCapexError(res.error) }
      else { setCapexEstado('saved'); setCapexError(null) }
    }, 900)
    return () => clearTimeout(t)
  }, [capex])

  const r = useMemo(() => computeModelo(v), [v])
  const dirty = JSON.stringify(v) !== JSON.stringify(active.inputs) || notas !== (active.notas ?? '')
  const viable = esViable(v, r)

  const set = (k: keyof ModeloInputs) => (n: number) => setV((p) => ({ ...p, [k]: n }))

  const applyEscenario = (e: Escenario) => {
    setActiveId(e.id)
    setV({ ...e.inputs })
    setNotas(e.notas ?? '')
  }

  const upsertLocal = (e: Escenario) => {
    setEscenarios((prev) => {
      const idx = prev.findIndex((x) => x.id === e.id)
      if (idx === -1) return [...prev, e]
      const next = [...prev]
      next[idx] = e
      return next
    })
  }

  const selectEscenario = (e: Escenario) => {
    if (e.id === activeId) return
    if (dirty && !confirm('Hay cambios sin guardar en este escenario. ¿Descartarlos y cambiar?')) return
    applyEscenario(e)
  }

  const handleSave = () => {
    setError(null)
    startSaving(async () => {
      const res = await updateEscenario(active.id, { inputs: v, notas })
      if ('error' in res) setError(res.error)
      else upsertLocal(res.escenario)
    })
  }

  const handleSaveAs = () => {
    const nombre = prompt('Nombre del nuevo escenario:', `${active.nombre} (variante)`)
    if (!nombre) return
    setError(null)
    startSaving(async () => {
      const res = await createEscenario(nombre, v, notas)
      if ('error' in res) setError(res.error)
      else {
        upsertLocal(res.escenario)
        setActiveId(res.escenario.id)
      }
    })
  }

  const handleRename = () => {
    const nombre = prompt('Nuevo nombre del escenario:', active.nombre)
    if (!nombre || nombre.trim() === active.nombre) return
    setError(null)
    startSaving(async () => {
      const res = await updateEscenario(active.id, { nombre })
      if ('error' in res) setError(res.error)
      else upsertLocal(res.escenario)
    })
  }

  const handleDelete = () => {
    if (active.es_base) return
    if (!confirm(`¿Eliminar el escenario «${active.nombre}»? Esta acción no se puede deshacer.`)) return
    setError(null)
    startSaving(async () => {
      const res = await deleteEscenario(active.id)
      if ('error' in res) setError(res.error)
      else {
        const rest = escenarios.filter((e) => e.id !== active.id)
        setEscenarios(rest)
        applyEscenario(rest[0])
      }
    })
  }

  const handleDiscard = () => {
    if (!dirty) return
    setV({ ...active.inputs })
    setNotas(active.notas ?? '')
  }

  const handleDefaults = () => {
    if (!confirm('¿Cargar los supuestos por defecto del modelo? (No se guarda hasta que pulses Guardar.)')) return
    setV({ ...BASE_INPUTS })
  }

  const gaugeMax = Math.max(r.cafesObj * 1.25, v.cafe_ud * 1.15, r.cafesCaja0 * 1.3, 60)
  const gp = (x: number) => Math.min(100, (x / gaugeMax) * 100)

  return (
    <div style={{ padding: '32px 40px 60px', maxWidth: 1240, color: C.ink }}>
      {/* Cabecera */}
      <Link href="/team/apps" style={{ fontSize: 11, color: C.faint, textDecoration: 'none' }}>
        ← Apps
      </Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.coffee, marginBottom: 6 }}>
            Modelo financiero · escenarios editables
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 300, margin: 0, letterSpacing: '-0.02em' }}>
            Modelo Café Goya
          </h1>
          <p style={{ fontSize: 13, color: C.soft, marginTop: 4, fontWeight: 300 }}>
            Del quiosco al café de especialidad · Calle Goya 63, Madrid · concesión municipal · to-go
          </p>
        </div>
        {seccion === 'modelo' && (
          <div style={{ display: 'flex', gap: 4, background: '#EFEDE7', borderRadius: 5, padding: 3 }}>
            {([['modelo', 'Modelo'], ['sensibilidad', 'Sensibilidad'], ['comparativa', 'Comparativa']] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: '7px 16px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500,
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? C.ink : C.faint,
                  boxShadow: tab === t ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Secciones de la app */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 22, borderBottom: `1px solid ${C.line}` }}>
        {SECCIONES.map(([sk, label]) => {
          const on = seccion === sk
          return (
            <button
              key={sk}
              type="button"
              onClick={() => setSeccion(sk)}
              style={{
                padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 13, fontWeight: on ? 600 : 500, color: on ? C.ink : C.faint,
                borderBottom: `2px solid ${on ? C.accent : 'transparent'}`, marginBottom: -1,
              }}
            >{label}</button>
          )
        })}
      </div>

      {seccion === 'modelo' && (
        <>
          {/* Barra de escenarios */}
          <div style={{
            ...panelStyle, marginTop: 20, marginBottom: 20, padding: '14px 18px',
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
          }}>
            <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.faint }}>
              Escenario
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 200 }}>
              {escenarios.map((e) => {
                const isActive = e.id === active.id
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => selectEscenario(e)}
                    style={{
                      padding: '6px 13px', borderRadius: 99, fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
                      border: `1px solid ${isActive ? C.ink : C.line}`,
                      background: isActive ? C.ink : '#fff',
                      color: isActive ? '#fff' : C.soft,
                    }}
                  >
                    {e.nombre}{e.es_base ? ' ·' : ''}{isActive && dirty ? ' •' : ''}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {dirty && <BarBtn onClick={handleDiscard}>Descartar</BarBtn>}
              <BarBtn onClick={handleSave} primary disabled={!dirty || isSaving}>
                {isSaving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Guardado'}
              </BarBtn>
              <BarBtn onClick={handleSaveAs} disabled={isSaving}>Guardar como…</BarBtn>
              <BarBtn onClick={handleRename} disabled={isSaving}>Renombrar</BarBtn>
              <BarBtn onClick={handleDefaults} disabled={isSaving}>Valores por defecto</BarBtn>
              {!active.es_base && <BarBtn onClick={handleDelete} danger disabled={isSaving}>Eliminar</BarBtn>}
            </div>
            {error && (
              <div style={{ width: '100%', fontSize: 12, color: C.red }}>⚠ {error}</div>
            )}
          </div>

          {tab === 'modelo' && (
            <ModeloTab
              v={v} r={r} set={set} setV={setV} viable={viable}
              gp={gp} gaugeMax={gaugeMax} notas={notas} setNotas={setNotas}
            />
          )}
          {tab === 'sensibilidad' && <SensibilidadTab v={v} />}
          {tab === 'comparativa' && (
            <ComparativaTab escenarios={escenarios} activeId={active.id} dirty={dirty} current={v} />
          )}

          <p style={{ fontSize: 11, color: C.faint, marginTop: 20, lineHeight: 1.6, maxWidth: 900 }}>
            Estimación orientativa con referencias de mercado de Madrid (préstamo a autónomo/pyme a principios
            de 2026: ~6,5 % TIN, 5 años, 1 % de apertura; ajústalo a la oferta real). Los gastos financieros del
            P&amp;L usan el interés medio del periodo; las cuotas mostradas son la cuota constante real. No es
            asesoramiento financiero ni fiscal: contrasta la oferta del banco, el canon del pliego y el coste
            laboral antes de decidir.
          </p>
        </>
      )}

      {seccion === 'capex' && (
        <div style={{ marginTop: 20 }}>
          <CapexTab
            items={capex}
            onChange={setCapex}
            estado={capexEstado}
            estadoError={capexError}
            onUsarEnModelo={(t) => setV((p) => ({ ...p, equipo: Math.round(t) }))}
          />
        </div>
      )}
      {seccion === 'dossier' && (
        <div style={{ marginTop: 20 }}>
          <DossierTab escenarios={escenarios} capex={capex} />
        </div>
      )}
      {seccion === 'mercado' && (
        <div style={{ marginTop: 20 }}>
          <MercadoTab nuestroTicket={v.cafe_p} />
        </div>
      )}
      {seccion === 'propuesta' && (
        <div style={{ marginTop: 20 }}>
          <PropuestaTab />
        </div>
      )}
    </div>
  )
}

// ── Tab: Modelo ─────────────────────────────────────────────────────

function ModeloTab({ v, r, set, setV, viable, gp, gaugeMax, notas, setNotas }: {
  v: ModeloInputs
  r: ModeloResults
  set: (k: keyof ModeloInputs) => (n: number) => void
  setV: React.Dispatch<React.SetStateAction<ModeloInputs>>
  viable: boolean
  gp: (x: number) => number
  gaugeMax: number
  notas: string
  setNotas: (s: string) => void
}) {
  return (
    <>
      {/* Hero: palanca + KPIs */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.faint }}>
              La palanca del negocio
            </div>
            <div>
              <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em' }}>{num(v.cafe_ud)}</span>
              <span style={{ fontSize: 13, color: C.faint }}> cafés/día</span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 46, marginTop: 22, marginBottom: 8 }}>
            <div style={{
              position: 'absolute', top: 18, left: 0, right: 0, height: 10, borderRadius: 5,
              background: `linear-gradient(90deg, ${C.red} 0%, ${C.red} ${gp(r.cafesCaja0)}%, ${C.gold} ${gp(r.cafesCaja0)}%, ${C.gold} ${gp(r.cafesObj)}%, ${C.green} ${gp(r.cafesObj)}%)`,
              opacity: 0.85,
            }} />
            <Marker x={gp(r.cafesCaja0)} label="No pierdes dinero" value={num(r.cafesCaja0)} color={C.red} />
            <Marker x={gp(r.cafesObj)} label="Objetivo" value={num(r.cafesObj)} color={C.green} up />
            <div style={{
              position: 'absolute', top: 8, left: `calc(${gp(v.cafe_ud)}% - 2px)`,
              width: 4, height: 30, background: C.ink, borderRadius: 2, boxShadow: `0 0 0 3px ${C.panel}`,
            }} />
          </div>
          <input
            type="range" min={0} max={Math.round(gaugeMax)} value={v.cafe_ud}
            onChange={(e) => set('cafe_ud')(Number(e.target.value))}
            style={{ width: '100%', accentColor: C.accent }}
          />
          <div style={{ fontSize: 12, color: C.soft, marginTop: 6 }}>
            Necesitas <b style={{ color: C.red }}>{num(r.cafesCaja0)}</b> cafés/día para no perder dinero
            (cubriendo gastos, amortización y las cuotas de banco y vendedor) y <b style={{ color: C.green }}>{num(r.cafesObj)}</b> para
            ganar {eur(v.obj)}/mes limpios. El equilibrio solo operativo (EBITDA 0) son {num(r.cafesBE)}.
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <KPI label="Beneficio neto / mes" value={eur(r.neto)} tone={r.neto >= 0 ? 'g' : 'r'}
            sub={`Margen neto ${pct(r.margenNeto)}`} />
          <KPI label="Capital propio (día 1)" value={eur(r.capitalPropio)} tone="g"
            sub={`Sin banco serían ${eur(r.desembInicial)}`} />
          <KPI label="Caja/mes en el arranque" value={eur(r.cashArranque)}
            tone={r.cashArranque >= 0 ? 'g' : 'r'} sub="Pagando banco + traspaso" />
          <KPI label="Rentab. sobre lo puesto" value={pct(r.roiPropio)}
            sub={`Recuperas en ${r.payback > 0 ? num(r.payback, 1) + ' años' : '—'}`}
            tone={r.roiPropio > 0 ? 'g' : 'r'} />
        </div>
      </section>

      {/* Financiación */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: C.ink, color: '#fff', borderRadius: 6, padding: '20px 22px' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.gold, marginBottom: 14 }}>
            Traspaso · entrada + aplazamiento al vendedor
          </div>
          <RangeField label="Precio del traspaso" value={v.traspaso} min={0} max={120000} step={500}
            onChange={set('traspaso')} fmt={eur} accent={C.gold} dark />
          <RangeField label="Entrada inicial (al contado)" value={v.entrada} min={0} max={Math.max(v.traspaso, 1000)} step={500}
            onChange={set('entrada')} fmt={eur} accent={C.gold} dark />
          <RangeField label="Plazo del aplazamiento a los vendedores" value={v.plazo} min={0} max={72} step={1}
            onChange={set('plazo')} fmt={(n) => (n <= 0 ? 'sin aplazamiento' : `${num(n)} meses`)} accent={C.gold} dark />
          <RangeField label="Interés anual del aplazamiento (0 % si sin recargo)" value={v.interes} min={0} max={0.15} step={0.005}
            onChange={set('interes')} fmt={pct} accent={C.gold} dark />
          <div style={{ borderTop: '1px solid #FFFFFF20', marginTop: 6, paddingTop: 10 }}>
            <FinRow label="Aplazado al vendedor" value={eur(r.aplazado)} accent={C.gold} />
            <FinRow label={`Cuota vendedor (${r.plazoT} meses)`} value={`${eur(r.cuotaT)}/mes`} accent={C.gold} strong />
          </div>
        </div>
        <div style={{ background: '#16232E', color: '#E7F0F6', borderRadius: 6, padding: '20px 22px' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8FC0E6', marginBottom: 14 }}>
            Préstamo bancario · ajústalo a la oferta real
          </div>
          <RangeField label="% del desembolso financiado por el banco" value={v.banco_pct} min={0} max={1} step={0.05}
            onChange={set('banco_pct')} fmt={pct} accent="#8FC0E6" dark />
          <RangeField label="Interés del préstamo (TIN)" value={v.banco_tin} min={0} max={0.12} step={0.0025}
            onChange={set('banco_tin')} fmt={pct} accent="#8FC0E6" dark />
          <RangeField label="Plazo del préstamo" value={v.banco_plazo} min={12} max={120} step={6}
            onChange={set('banco_plazo')} fmt={(n) => `${num(n)} meses`} accent="#8FC0E6" dark />
          <RangeField label="Comisión de apertura" value={v.banco_comision} min={0} max={0.03} step={0.0025}
            onChange={set('banco_comision')} fmt={pct} accent="#8FC0E6" dark />
          <div style={{ borderTop: '1px solid #FFFFFF20', marginTop: 6, paddingTop: 10 }}>
            <FinRow label="Importe del préstamo" value={eur(r.prestamo)} accent="#8FC0E6" />
            <FinRow label={`Cuota banco (${r.plazoB} meses)`} value={`${eur(r.cuotaB)}/mes`} accent="#8FC0E6" strong />
          </div>
        </div>
      </section>

      {/* Caja por fases */}
      <section style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.coffee, marginBottom: 14 }}>
          Tu caja mes a mes, por fases
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Phase title={`Meses 1–${r.plazoT}`} note="Pagas banco + traspaso" value={r.cashArranque} />
          <Phase title={`Meses ${r.plazoT + 1}–${r.plazoB}`} note="Solo cuota del banco" value={r.cashSoloBanco} />
          <Phase title={`Desde mes ${r.plazoB + 1}`} note="Sin cuotas, negocio libre" value={r.cashLibre} />
        </div>
        <div style={{ fontSize: 12, color: C.soft, marginTop: 12, lineHeight: 1.55 }}>
          El apalancamiento reduce lo que pones de tu bolsillo el día 1 a <b>{eur(r.capitalPropio)}</b>,
          pero el arranque es la fase más tensa: vigila que la caja de los primeros {r.plazoT} meses
          no se acerque a cero. Coste financiero total (intereses + comisión): <b>{eur(r.costeFinanciero)}</b>.
        </div>
      </section>

      {/* Supuestos + resultados */}
      <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 16 }}>
        <section style={{ ...panelStyle, paddingBottom: 8 }}>
          <h2 style={h2Style}>Supuestos · edítalos todos</h2>
          <Group title="Operativa">
            <NumField label="Días de apertura al mes" unit="días" value={v.dias} onChange={set('dias')} />
            <div />
          </Group>
          <Group title="Café">
            <NumField label="Precio medio por café" unit="€/ud" value={v.cafe_p} onChange={set('cafe_p')} step={0.1} />
            <NumField label="Cafés vendidos al día" unit="ud/día" value={v.cafe_ud} onChange={set('cafe_ud')} />
            <NumField label="Coste de material por café" unit="€/ud" value={v.cafe_c} onChange={set('cafe_c')} step={0.05} />
            <div />
          </Group>
          <Group title="Otras bebidas">
            <NumField label="Unidades al día" unit="ud/día" value={v.beb_ud} onChange={set('beb_ud')} />
            <NumField label="Precio medio" unit="€/ud" value={v.beb_p} onChange={set('beb_p')} step={0.1} />
            <NumField label="% coste sobre PVP" unit="%" value={v.beb_c} onChange={set('beb_c')} pctInput />
            <div />
          </Group>
          <Group title="Bollería y alimentos">
            <NumField label="Unidades al día" unit="ud/día" value={v.bol_ud} onChange={set('bol_ud')} />
            <NumField label="Precio medio" unit="€/ud" value={v.bol_p} onChange={set('bol_p')} step={0.1} />
            <NumField label="% coste sobre PVP" unit="%" value={v.bol_c} onChange={set('bol_c')} pctInput />
            <div />
          </Group>
          <Group title="Prensa · publicidad · pagos">
            <NumField label="Prensa: ventas brutas/mes" unit="€/mes" value={v.prensa_v} onChange={set('prensa_v')} />
            <NumField label="Margen comercial prensa" unit="%" value={v.prensa_m} onChange={set('prensa_m')} pctInput />
            <NumField label="Publicidad mensual" unit="€/mes" value={v.pub} onChange={set('pub')} />
            <NumField label="% ventas con tarjeta" unit="%" value={v.tar_pct} onChange={set('tar_pct')} pctInput />
            <NumField label="Comisión tarjeta" unit="%" value={v.tar_com} onChange={set('tar_com')} pctInput step={0.1} />
            <div />
          </Group>
          <Group title="Costes fijos mensuales">
            <NumField label="Personal (2 empleados + SS)" unit="€" value={v.personal} onChange={set('personal')} />
            <NumField label="Cuota autónomo" unit="€" value={v.autonomo} onChange={set('autonomo')} />
            <NumField label="Canon municipal" unit="€" value={v.canon} onChange={set('canon')} />
            <NumField label="Electricidad y agua" unit="€" value={v.luz} onChange={set('luz')} />
            <NumField label="Gestoría" unit="€" value={v.gest} onChange={set('gest')} />
            <NumField label="Seguros" unit="€" value={v.seg} onChange={set('seg')} />
            <NumField label="Mantenimiento y limpieza" unit="€" value={v.mant} onChange={set('mant')} />
            <NumField label="Software y telecom" unit="€" value={v.soft} onChange={set('soft')} />
            <NumField label="Marketing" unit="€" value={v.mkt} onChange={set('mkt')} />
            <NumField label="Otros gastos" unit="€" value={v.otros} onChange={set('otros')} />
          </Group>
          <Group title="Resto de inversión (traspaso y préstamo, arriba)">
            <NumField label="Reforma y adecuación" unit="€" value={v.reforma} onChange={set('reforma')} />
            <NumField label="Máquina café y equipamiento" unit="€" value={v.equipo} onChange={set('equipo')} />
            <NumField label="Licencias y trámites" unit="€" value={v.licencias} onChange={set('licencias')} />
            <NumField label="Mobiliario e imagen" unit="€" value={v.mobiliario} onChange={set('mobiliario')} />
            <NumField label="Stock inicial" unit="€" value={v.stock} onChange={set('stock')} />
            <NumField label="Fondo de maniobra" unit="€" value={v.fondo} onChange={set('fondo')} />
          </Group>
          <Group title="Amortización · impuestos · objetivo">
            <NumField label="Años amort. traspaso" unit="años" value={v.amort_t} onChange={set('amort_t')} />
            <NumField label="Años amort. activos" unit="años" value={v.amort_a} onChange={set('amort_a')} />
            <NumField label="Tipo impositivo efectivo" unit="%" value={v.tax} onChange={set('tax')} pctInput />
            <NumField label="Beneficio neto objetivo/mes" unit="€" value={v.obj} onChange={set('obj')} />
          </Group>
          <Group title="Notas del escenario" cols={1}>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Apuntes internos: origen de los supuestos, oferta del banco, dudas…"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 4, boxSizing: 'border-box',
                border: `1px solid ${C.line}`, background: C.bg, color: C.ink,
                fontSize: 12.5, lineHeight: 1.5, outline: 'none', resize: 'vertical',
                fontFamily: 'inherit', marginBottom: 12,
              }}
            />
          </Group>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={panelStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', paddingBottom: 6 }}>
              <h2 style={{ ...h2Style, margin: 0 }}>Cuenta de resultados</h2>
              <span style={colHead}>Mensual</span>
              <span style={colHead}>Anual</span>
            </div>
            <Row label="Venta de café" m={r.cafeIng} a={r.cafeIng * 12} />
            <Row label="Venta de otras bebidas" m={r.bebIng} a={r.bebIng * 12} />
            <Row label="Venta de bollería y alimentos" m={r.bolIng} a={r.bolIng * 12} />
            <Row label="Venta de prensa y revistas" m={r.prensaIng} a={r.prensaIng * 12} />
            <Row label="Ingreso por publicidad" m={r.pubIng} a={r.pubIng * 12} />
            <Row label="Facturación total" m={r.fact} a={r.fact * 12} strong />
            <div style={{ height: 10 }} />
            <Row label="Coste variable total" m={-r.cv} a={-r.cv * 12} tone="r" />
            <Row label="Margen bruto" m={r.mb} a={r.mb * 12} strong tone="g" />
            <div style={{ height: 10 }} />
            <Row label="Costes fijos totales" m={-r.cf} a={-r.cf * 12} tone="r" />
            <Row label="EBITDA" m={r.ebitda} a={r.ebitdaAnual} strong tone={r.ebitda >= 0 ? 'g' : 'r'} />
            <Row label="Amortización" m={-r.amortMes} a={-r.amortMes * 12} tone="r" />
            <Row label="Gastos financieros (banco + aplazamiento)" m={-r.gastoFin} a={-r.gastoFin * 12} tone="r" />
            <Row label="Beneficio antes de impuestos" m={r.bai} a={r.bai * 12} />
            <Row label="Impuesto sobre beneficio" m={-r.impuesto} a={-r.impuesto * 12} tone="r" />
            <Row label="Beneficio neto" m={r.neto} a={r.netoAnual} strong tone={r.neto >= 0 ? 'g' : 'r'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={panelStyle}>
              <h2 style={h2Style}>Puntos de equilibrio (cafés/día)</h2>
              <Stat label="Equilibrio operativo (EBITDA 0)" value={num(r.cafesBE)} />
              <Stat label="Beneficio 0 (+ amortización e intereses)" value={num(r.cafesNeto0)} />
              <Stat label="No perder caja (+ cuotas banco y vendedor)" value={num(r.cafesCaja0)} tone="r" />
              <Stat label={`Objetivo (${eur(v.obj)}/mes limpios)`} value={num(r.cafesObj)} tone="g" />
              <Stat label="Cafés/día actuales" value={num(v.cafe_ud)} last />
            </div>
            <div style={panelStyle}>
              <h2 style={h2Style}>Inversión y rentabilidad</h2>
              <Stat label="Capital propio (día 1)" value={eur(r.capitalPropio)} tone="g" />
              <Stat label="Coste financiero total" value={eur(r.costeFinanciero)} tone="r" />
              <Stat label="Recuperación (payback)" value={r.payback > 0 ? num(r.payback, 1) + ' años' : '—'} />
              <Stat label="Rentab. sobre capital propio" value={pct(r.roiPropio)} last />
            </div>
          </div>
        </section>
      </div>

      {/* Conclusión */}
      <section style={{ marginTop: 16, background: C.ink, color: '#fff', borderRadius: 6, padding: '26px 30px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#D8B466', marginBottom: 14 }}>
          Conclusión ejecutiva
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 34px' }}>
          <Concl n="Cómo queda financiado"
            t={`Traspaso: ${eur(r.entrada)} de entrada + ${eur(r.aplazado)} al vendedor en ${r.plazoT} cuotas de ${eur(r.cuotaT)}. Banco: ${eur(r.prestamo)} (${pct(v.banco_pct)} del desembolso) a ${pct(v.banco_tin)} TIN y ${r.plazoB} meses, cuota ${eur(r.cuotaB)}. De tu bolsillo, el día 1, solo ${eur(r.capitalPropio)}.`} />
          <Concl n="Efecto del apalancamiento"
            t={`Poner menos capital propio dispara la rentabilidad sobre lo invertido al ${pct(r.roiPropio)} anual y acorta el payback a ~${num(r.payback, 1)} años. La contrapartida: ${eur(r.costeFinanciero)} de coste financiero total y una caja más tensa al principio.`} />
          <Concl n="Vigila el arranque"
            t={`Durante los primeros ${r.plazoT} meses pagas banco + vendedor a la vez y te quedan ${eur(r.cashArranque)}/mes. Cuando termines el traspaso subes a ${eur(r.cashSoloBanco)}/mes, y al liquidar el préstamo a ${eur(r.cashLibre)}/mes.`} />
          <Concl n="Tres riesgos principales"
            t="1) Volumen de cafés/día por debajo de lo previsto. 2) Caja tensa en el arranque por las dos cuotas simultáneas: si las ventas flojean, alarga plazos o sube la entrada propia. 3) Subida de tipos o menor % concedido por el banco, que encarece o reduce la financiación." />
        </div>
        <div style={{
          marginTop: 20, paddingTop: 18, borderTop: '1px solid #FFFFFF25',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FFFFFF80' }}>
            Veredicto
          </span>
          <span style={{
            background: viable ? C.green : C.red, color: '#fff',
            padding: '6px 16px', borderRadius: 99, fontWeight: 600, fontSize: 13,
          }}>
            {viable ? 'Viable' : 'Arranque ajustado'}
          </span>
          <span style={{ fontSize: 12.5, color: '#FFFFFFB3', flex: 1, minWidth: 260, lineHeight: 1.5 }}>
            {viable
              ? `Con el préstamo del banco arriesgas mucho menos capital y la rentabilidad se dispara, a cambio de un arranque más justo de caja. Sólido mientras sostengas el volumen y dejes colchón para los primeros ${r.plazoT} meses.`
              : 'La caja del arranque queda muy justa o negativa. Sube cafés/día o precio, alarga plazos, reduce el % financiado o aumenta el fondo de maniobra.'}
          </span>
        </div>
      </section>
    </>
  )
}

const colHead: CSSProperties = {
  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
  color: C.faint, textAlign: 'right', alignSelf: 'end', paddingBottom: 2,
}

// ── Tab: Sensibilidad ───────────────────────────────────────────────

type Metrica = 'neto' | 'cashArranque' | 'payback' | 'roiPropio'

const METRICAS: { key: Metrica; label: string }[] = [
  { key: 'neto', label: 'Beneficio neto/mes' },
  { key: 'cashArranque', label: 'Caja/mes en el arranque' },
  { key: 'payback', label: 'Payback (años)' },
  { key: 'roiPropio', label: 'ROI sobre capital propio' },
]

function SensibilidadTab({ v }: { v: ModeloInputs }) {
  const [metrica, setMetrica] = useState<Metrica>('neto')

  const udsDeltas = [-50, -25, 0, 25, 50]
  const priceDeltas = [-0.3, -0.15, 0, 0.15, 0.3]

  const grid = udsDeltas.map((du) =>
    priceDeltas.map((dp) => {
      const res = computeModelo({
        ...v,
        cafe_ud: Math.max(0, v.cafe_ud + du),
        cafe_p: Math.max(0, Math.round((v.cafe_p + dp) * 100) / 100),
      })
      return res
    })
  )

  const fmt = (res: ModeloResults): string => {
    if (metrica === 'neto') return eur(res.neto)
    if (metrica === 'cashArranque') return eur(res.cashArranque)
    if (metrica === 'payback') return res.payback > 0 ? num(res.payback, 1) : '—'
    return pct(res.roiPropio)
  }

  const cellBg = (res: ModeloResults): string => {
    if (metrica === 'payback') {
      if (res.payback <= 0) return '#FBEEEB'
      if (res.payback <= 4) return '#EAF3EE'
      if (res.payback <= 6) return '#FBF4E2'
      return '#FBEEEB'
    }
    const val = metrica === 'neto' ? res.neto : metrica === 'cashArranque' ? res.cashArranque : res.roiPropio
    return val >= 0 ? '#EAF3EE' : '#FBEEEB'
  }

  const cellColor = (res: ModeloResults): string => {
    if (metrica === 'payback') {
      if (res.payback <= 0) return C.red
      return res.payback <= 6 ? C.green : C.red
    }
    const val = metrica === 'neto' ? res.neto : metrica === 'cashArranque' ? res.cashArranque : res.roiPropio
    return val >= 0 ? C.green : C.red
  }

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <h2 style={{ ...h2Style, margin: 0 }}>Sensibilidad · volumen × precio del café</h2>
        <div style={{ display: 'flex', gap: 4, background: '#EFEDE7', borderRadius: 5, padding: 3 }}>
          {METRICAS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetrica(m.key)}
              style={{
                padding: '6px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
                fontSize: 11.5, fontWeight: 500,
                background: metrica === m.key ? '#fff' : 'transparent',
                color: metrica === m.key ? C.ink : C.faint,
                boxShadow: metrica === m.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >{m.label}</button>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 12, color: C.soft, marginBottom: 16 }}>
        Cada celda recalcula el modelo completo variando cafés/día y precio medio sobre el escenario actual.
        La celda enmarcada es tu situación actual ({num(v.cafe_ud)} cafés/día a {v.cafe_p.toLocaleString('es-ES')} €).
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 4, width: '100%' }}>
          <thead>
            <tr>
              <th style={sensHead}>cafés/día \ precio</th>
              {priceDeltas.map((dp) => (
                <th key={dp} style={sensHead}>
                  {(Math.max(0, Math.round((v.cafe_p + dp) * 100) / 100)).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  {dp === 0 && ' ·'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {udsDeltas.map((du, i) => (
              <tr key={du}>
                <td style={{ ...sensHead, textAlign: 'left' }}>
                  {num(Math.max(0, v.cafe_ud + du))}{du === 0 && ' ·'}
                </td>
                {priceDeltas.map((dp, j) => {
                  const res = grid[i][j]
                  const current = du === 0 && dp === 0
                  return (
                    <td
                      key={dp}
                      style={{
                        padding: '12px 10px', borderRadius: 4, textAlign: 'center',
                        fontSize: 13, fontWeight: current ? 700 : 500,
                        background: cellBg(res), color: cellColor(res),
                        border: current ? `2px solid ${C.ink}` : '2px solid transparent',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmt(res)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const sensHead: CSSProperties = {
  fontSize: 10.5, fontWeight: 600, color: '#1A1A1A80', textAlign: 'center',
  textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 6px', whiteSpace: 'nowrap',
}

// ── Tab: Comparativa ────────────────────────────────────────────────

function ComparativaTab({ escenarios, activeId, dirty, current }: {
  escenarios: Escenario[]
  activeId: string
  dirty: boolean
  current: ModeloInputs
}) {
  const rows = escenarios.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    esActivo: e.id === activeId,
    inputs: e.inputs,
    r: computeModelo(e.inputs),
  }))
  if (dirty) {
    rows.push({
      id: '__actual__',
      nombre: 'Cambios sin guardar',
      esActivo: true,
      inputs: current,
      r: computeModelo(current),
    })
  }

  return (
    <section style={{ ...panelStyle, overflowX: 'auto' }}>
      <h2 style={h2Style}>Comparativa de escenarios</h2>
      <p style={{ fontSize: 12, color: C.soft, marginBottom: 16 }}>
        Todos los escenarios guardados, recalculados con el modelo completo. Guarda variantes
        (pesimista, optimista, con otra oferta bancaria…) desde «Guardar como…» para compararlas aquí.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
        <thead>
          <tr>
            {['Escenario', 'Cafés/día', 'Precio café', 'Facturación/mes', 'EBITDA/mes', 'Neto/mes',
              'Capital propio', 'Caja arranque', 'Payback', 'ROI propio', 'Veredicto'].map((h, i) => (
              <th key={h} style={{
                fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.faint,
                textAlign: i === 0 ? 'left' : 'right', padding: '8px 10px',
                borderBottom: `1.5px solid ${C.ink}`, whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const viable = esViable(row.inputs, row.r)
            const tdBase: CSSProperties = {
              padding: '10px 10px', fontSize: 12.5, textAlign: 'right',
              borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap',
            }
            return (
              <tr key={row.id} style={{ background: row.id === '__actual__' ? '#FBF4E2' : row.esActivo ? '#F8F7F4' : 'transparent' }}>
                <td style={{ ...tdBase, textAlign: 'left', fontWeight: row.esActivo ? 600 : 400 }}>
                  {row.nombre}{row.id === '__actual__' ? ' •' : ''}
                </td>
                <td style={tdBase}>{num(row.inputs.cafe_ud)}</td>
                <td style={tdBase}>{row.inputs.cafe_p.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                <td style={tdBase}>{eur(row.r.fact)}</td>
                <td style={{ ...tdBase, color: row.r.ebitda >= 0 ? C.ink : C.red }}>{eur(row.r.ebitda)}</td>
                <td style={{ ...tdBase, fontWeight: 600, color: row.r.neto >= 0 ? C.green : C.red }}>{eur(row.r.neto)}</td>
                <td style={tdBase}>{eur(row.r.capitalPropio)}</td>
                <td style={{ ...tdBase, color: row.r.cashArranque >= 0 ? C.ink : C.red }}>{eur(row.r.cashArranque)}</td>
                <td style={tdBase}>{row.r.payback > 0 ? num(row.r.payback, 1) + ' años' : '—'}</td>
                <td style={tdBase}>{pct(row.r.roiPropio)}</td>
                <td style={{ ...tdBase, textAlign: 'right' }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                    background: viable ? '#EAF3EE' : '#FBEEEB',
                    color: viable ? C.green : C.red,
                  }}>
                    {viable ? 'Viable' : 'Ajustado'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
