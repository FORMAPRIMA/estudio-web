'use client'

import { useState, useTransition, Fragment } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  updateMemberCosts, addCostoFijo, updateCostoFijo, deleteCostoFijo, updateFinanzasConfig,
  addCostoVariable, updateCostoVariable, deleteCostoVariable,
} from '@/app/actions/finanzas'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string; nombre: string; apellido: string | null; avatar_url: string | null
  rol: string; blocked?: boolean | null; seniority: string | null
  salario_mensual: number | null; horas_mensuales: number | null
}

interface CostoFijo {
  id: string; concepto: string; monto: number; orden: number
}

interface CostoVariable {
  id: string; año: number; mes: number
  categoria: string; concepto: string; monto: number; notas: string | null
  proyecto_id?: string | null; proyecto_nombre?: string | null
}

type EditableField   = 'seniority' | 'salario_mensual' | 'horas_mensuales'
type EditingCell     = { userId: string; field: EditableField } | null
type EditingFijo     = { id: string; field: 'concepto' | 'monto' } | null
type EditingVariable = { id: string; field: 'monto' | 'concepto' | 'notas' } | null

// ── Constants ─────────────────────────────────────────────────────────────────

const ROL_LABELS: Record<string, string> = { fp_partner: 'Partner', fp_manager: 'Manager', fp_team: 'Team' }
const ROL_COLORS: Record<string, string> = { fp_partner: '#D85A30', fp_manager: '#378ADD', fp_team: '#1D9E75' }
const ROL_ORDER:  Record<string, number> = { fp_partner: 0, fp_manager: 1, fp_team: 2 }

const SENIORITY_OPTIONS = [
  { value: '',       label: '—' },
  { value: 'junior', label: 'Junior' },
  { value: 'semi',   label: 'Semi-senior' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead',   label: 'Lead' },
  { value: 'socio',  label: 'Socio/a' },
]

const AVATAR_COLORS = ['#D85A30','#E8913A','#C9A227','#E6B820','#B8860B','#D4622A','#F0A500','#C07020']

const IVA_RATE = 0.21

const PRECIO_HORA_COMERCIAL: Record<string, number> = {
  socio:  150,
  lead:   150,
  senior: 100,
  semi:   100,
  junior:  60,
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Default variable cost categories pre-populated for each month
const DEFAULT_CATEGORIAS = [
  'Tarjeta de crédito corporativa',
  'Viajes y desplazamientos',
  'Team building',
  'Material de oficina',
  'Software y suscripciones',
  'Formación y desarrollo',
  'Eventos y representación',
  'Seguros variables',
  'Otros',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkInitials(nombre: string, apellido?: string | null) {
  const f = nombre.trim()[0]?.toUpperCase() ?? ''
  const l = (apellido ?? '').trim()[0]?.toUpperCase() ?? ''
  return f + l || f
}

const fmtMoney = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtRate  = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Styles ────────────────────────────────────────────────────────────────────

const TH: CSSProperties = {
  padding: '13px 20px', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
}

const TD: CSSProperties = {
  padding: '13px 20px', fontSize: 12, color: '#2A2A2A',
  verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8',
}

const CELL_INPUT: CSSProperties = {
  background: '#FFF8F0', border: '1px solid #E8913A', borderRadius: 4,
  padding: '4px 8px', fontSize: 12, color: '#1A1A1A', fontFamily: 'inherit', outline: 'none',
}

// ── Cost Breakdown Bar ────────────────────────────────────────────────────────

const MONTH_NAMES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function CostBreakdownBar({
  members, costosFijos, costosVariables, año,
}: {
  members: Member[]
  costosFijos: CostoFijo[]
  costosVariables: CostoVariable[]
  año: number
}) {
  const [mes, setMes] = useState(new Date().getMonth() + 1)

  const teamCost     = members.filter(m => !m.blocked).reduce((s, m) => s + (m.salario_mensual ?? 0), 0)
  const fixedCost    = costosFijos.reduce((s, c) => s + c.monto * (1 + IVA_RATE), 0)
  const variableCost = costosVariables
    .filter(v => v.mes === mes && v.año === año)
    .reduce((s, v) => s + v.monto, 0)
  const total = teamCost + fixedCost + variableCost

  const segments = [
    { label: 'Equipo',          color: '#D85A30', value: teamCost     },
    { label: 'Costes fijos',    color: '#1A1A1A', value: fixedCost    },
    { label: 'Costes variables', color: '#378ADD', value: variableCost },
  ].filter(s => s.value > 0)

  const fmtE = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div style={{ padding: '24px 40px', background: '#fff', borderBottom: '1px solid #E8E6E0' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 2px' }}>
            Coste total mensual estimado
          </p>
          <p style={{ fontSize: 26, fontWeight: 300, color: '#1A1A1A', margin: 0, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {total > 0 ? `€ ${fmtE.format(total)}` : '—'}
          </p>
        </div>

        {/* Month picker */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {MONTH_NAMES_SHORT.map((mn, i) => {
            const m  = i + 1
            const isActive = m === mes
            const hasVar = costosVariables.some(v => v.mes === m && v.año === año)
            return (
              <button
                key={m}
                onClick={() => setMes(m)}
                style={{
                  padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 9.5,
                  fontWeight: isActive ? 700 : 400,
                  background: isActive ? '#1A1A1A' : hasVar ? '#EEF4FD' : '#F0EEE8',
                  color: isActive ? '#fff' : hasVar ? '#378ADD' : '#888',
                  letterSpacing: '0.04em',
                  transition: 'all 0.1s',
                }}
              >
                {mn}
              </button>
            )
          })}
        </div>
      </div>

      {/* Stacked bar */}
      {total > 0 ? (
        <>
          <div style={{ height: 10, borderRadius: 6, overflow: 'hidden', display: 'flex', background: '#F0EEE8', marginBottom: 14 }}>
            {segments.map(s => (
              <div
                key={s.label}
                title={`${s.label}: € ${fmtE.format(s.value)}`}
                style={{
                  height: '100%',
                  width: `${(s.value / total) * 100}%`,
                  background: s.color,
                  transition: 'width 0.4s ease',
                }}
              />
            ))}
          </div>

          {/* Legend with amounts */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {segments.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#1A1A1A', marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
                    € {fmtE.format(s.value)}
                  </span>
                  <span style={{ fontSize: 10, color: '#BBB', marginLeft: 5 }}>
                    {((s.value / total) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ height: 10, borderRadius: 6, background: '#F0EEE8', marginBottom: 14 }} />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Cell({ children, onClick, empty, align = 'left' }: {
  children?: ReactNode; onClick: () => void; empty: boolean; align?: 'left' | 'right'
}) {
  return (
    <span
      onClick={onClick}
      title="Click para editar"
      style={{
        display: 'inline-block', cursor: 'pointer', borderRadius: 3,
        padding: '2px 6px', minWidth: 32, textAlign: align,
        color: empty ? '#CCC' : 'inherit',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F0EEE8' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {empty ? '—' : children}
    </span>
  )
}

// ── Costos Variables Month Row ────────────────────────────────────────────────

function MonthRow({
  mes, año, entries, onAdd, onUpdate, onDelete,
}: {
  mes: number
  año: number
  entries: CostoVariable[]
  onAdd: (categoria: string, concepto: string, monto: number) => void
  onUpdate: (id: string, field: 'monto' | 'concepto' | 'notas', value: string) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editingVar, setEditingVar] = useState<EditingVariable>(null)
  const [addingCategoria, setAddingCategoria] = useState<string | null>(null)
  const [addingConcepto, setAddingConcepto] = useState('')
  const [addingMonto, setAddingMonto] = useState('')

  const total = entries.reduce((s, e) => s + e.monto, 0)
  const isCurrentMonth = new Date().getMonth() + 1 === mes && new Date().getFullYear() === año

  // Defaults: show ghost rows for categories not yet in DB
  const presentCats = new Set(entries.map(e => e.categoria))
  const ghostRows = DEFAULT_CATEGORIAS.filter(c => !presentCats.has(c))

  const commitEdit = (id: string, field: 'monto' | 'concepto' | 'notas', raw: string) => {
    setEditingVar(null)
    onUpdate(id, field, raw)
  }

  return (
    <div style={{ borderBottom: '1px solid #F0EEE8' }}>
      {/* Month header row */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', padding: '14px 20px',
          cursor: 'pointer', gap: 16, background: open ? '#FAFAF8' : 'transparent',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <span style={{
          fontSize: 9, transition: 'transform 0.15s',
          display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          color: '#BBB',
        }}>▾</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', flex: 1 }}>
          {MONTH_NAMES[mes - 1]}
          {isCurrentMonth && (
            <span style={{ marginLeft: 8, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#378ADD', background: '#EEF4FD', padding: '2px 6px', borderRadius: 3 }}>
              Este mes
            </span>
          )}
        </span>
        {total > 0 ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
            € {fmtMoney.format(total)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#CCC' }}>Sin gastos</span>
        )}
        <span style={{ fontSize: 10, color: '#CCC', minWidth: 60, textAlign: 'right' }}>
          {entries.length > 0 ? `${entries.length} entrada${entries.length !== 1 ? 's' : ''}` : ''}
        </span>
      </div>

      {/* Expanded content */}
      {open && (
        <div className="fp-table-wrap" style={{ background: '#FAFAF8', borderTop: '1px solid #F0EEE8' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#2A2A2A' }}>
                <th style={{ ...TH, textAlign: 'left', fontSize: 8 }}>Categoría</th>
                <th style={{ ...TH, textAlign: 'left', fontSize: 8 }}>Concepto / detalle</th>
                <th style={{ ...TH, textAlign: 'right', width: 160, fontSize: 8 }}>Importe</th>
                <th style={{ ...TH, textAlign: 'left', width: 220, fontSize: 8 }}>Notas</th>
                <th style={{ ...TH, width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {/* Real entries */}
              {entries.map(e => {
                const editMonto   = editingVar?.id === e.id && editingVar.field === 'monto'
                const editConc    = editingVar?.id === e.id && editingVar.field === 'concepto'
                const editNotas   = editingVar?.id === e.id && editingVar.field === 'notas'
                return (
                  <tr
                    key={e.id}
                    onMouseEnter={ev => {
                      (ev.currentTarget as HTMLElement).style.background = '#F4F2EC'
                      const btn = ev.currentTarget.querySelector<HTMLElement>('[data-del]')
                      if (btn) btn.style.opacity = '1'
                    }}
                    onMouseLeave={ev => {
                      (ev.currentTarget as HTMLElement).style.background = 'transparent'
                      const btn = ev.currentTarget.querySelector<HTMLElement>('[data-del]')
                      if (btn) btn.style.opacity = '0'
                    }}
                  >
                    <td style={{ ...TD, fontSize: 11, background: 'transparent', paddingLeft: 28 }}>
                      <span style={{ color: '#555' }}>{e.categoria}</span>
                    </td>
                    <td style={{ ...TD, fontSize: 11, background: 'transparent' }}>
                      {editConc ? (
                        <input autoFocus type="text" defaultValue={e.concepto}
                          onBlur={ev => commitEdit(e.id, 'concepto', ev.target.value)}
                          onKeyDown={ev => {
                            if (ev.key === 'Enter')  commitEdit(e.id, 'concepto', (ev.target as HTMLInputElement).value)
                            if (ev.key === 'Escape') setEditingVar(null)
                          }}
                          style={{ ...CELL_INPUT, width: '100%' }}
                        />
                      ) : (
                        <Cell onClick={() => !e.proyecto_id && setEditingVar({ id: e.id, field: 'concepto' })} empty={!e.concepto} align="left">
                          <span>{e.concepto || undefined}</span>
                          {e.proyecto_nombre && (
                            <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#D85A30', background: '#FDF1EC', padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                              {e.proyecto_nombre}
                            </span>
                          )}
                        </Cell>
                      )}
                    </td>
                    <td style={{ ...TD, textAlign: 'right', background: 'transparent' }}>
                      {editMonto ? (
                        <input autoFocus type="number" min={0} defaultValue={e.monto}
                          onBlur={ev => commitEdit(e.id, 'monto', ev.target.value)}
                          onKeyDown={ev => {
                            if (ev.key === 'Enter')  commitEdit(e.id, 'monto', (ev.target as HTMLInputElement).value)
                            if (ev.key === 'Escape') setEditingVar(null)
                          }}
                          style={{ ...CELL_INPUT, width: 110, textAlign: 'right' }}
                        />
                      ) : (
                        <Cell onClick={() => setEditingVar({ id: e.id, field: 'monto' })} empty={e.monto === 0} align="right">
                          {`€ ${fmtMoney.format(e.monto)}`}
                        </Cell>
                      )}
                    </td>
                    <td style={{ ...TD, fontSize: 11, background: 'transparent' }}>
                      {editNotas ? (
                        <input autoFocus type="text" defaultValue={e.notas ?? ''}
                          onBlur={ev => commitEdit(e.id, 'notas', ev.target.value)}
                          onKeyDown={ev => {
                            if (ev.key === 'Enter')  commitEdit(e.id, 'notas', (ev.target as HTMLInputElement).value)
                            if (ev.key === 'Escape') setEditingVar(null)
                          }}
                          style={{ ...CELL_INPUT, width: '100%' }}
                        />
                      ) : (
                        <Cell onClick={() => setEditingVar({ id: e.id, field: 'notas' })} empty={!e.notas} align="left">
                          {e.notas ?? undefined}
                        </Cell>
                      )}
                    </td>
                    <td style={{ ...TD, textAlign: 'center', padding: '0 10px', background: 'transparent' }}>
                      <button data-del onClick={() => onDelete(e.id)}
                        style={{ opacity: 0, transition: 'opacity 0.15s', background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 14, padding: '4px 6px', borderRadius: 3 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D85A30' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}
                      >×</button>
                    </td>
                  </tr>
                )
              })}

              {/* Ghost rows — default categories not yet saved */}
              {ghostRows.map(cat => (
                <tr key={`ghost-${cat}`} style={{ opacity: 0.45 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.45' }}
                >
                  <td style={{ ...TD, fontSize: 11, background: 'transparent', paddingLeft: 28 }}>
                    <span style={{ color: '#888' }}>{cat}</span>
                  </td>
                  <td style={{ ...TD, background: 'transparent' }}>
                    <span style={{ fontSize: 11, color: '#CCC' }}>—</span>
                  </td>
                  <td style={{ ...TD, textAlign: 'right', background: 'transparent' }}>
                    <button
                      onClick={() => { setAddingCategoria(cat); setAddingConcepto(''); setAddingMonto('') }}
                      style={{ background: 'none', border: '1px dashed #D4D0C8', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: '#AAA', padding: '3px 10px' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8913A'; (e.currentTarget as HTMLElement).style.color = '#E8913A' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D4D0C8'; (e.currentTarget as HTMLElement).style.color = '#AAA' }}
                    >
                      + Registrar
                    </button>
                  </td>
                  <td style={{ ...TD, background: 'transparent' }} />
                  <td style={{ ...TD, background: 'transparent' }} />
                </tr>
              ))}

              {/* Quick-add form */}
              {addingCategoria && (
                <tr style={{ background: '#FFF8F0' }}>
                  <td style={{ ...TD, fontSize: 11, paddingLeft: 28, borderBottom: 'none' }}>
                    <span style={{ color: '#D85A30', fontWeight: 500 }}>{addingCategoria}</span>
                  </td>
                  <td style={{ ...TD, borderBottom: 'none' }}>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Detalle (opcional)"
                      value={addingConcepto}
                      onChange={e => setAddingConcepto(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          onAdd(addingCategoria, addingConcepto, parseFloat(addingMonto.replace(',', '.')) || 0)
                          setAddingCategoria(null)
                        }
                        if (e.key === 'Escape') setAddingCategoria(null)
                      }}
                      style={{ ...CELL_INPUT, width: '100%' }}
                    />
                  </td>
                  <td style={{ ...TD, textAlign: 'right', borderBottom: 'none' }}>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={addingMonto}
                      onChange={e => setAddingMonto(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          onAdd(addingCategoria, addingConcepto, parseFloat(addingMonto.replace(',', '.')) || 0)
                          setAddingCategoria(null)
                        }
                        if (e.key === 'Escape') setAddingCategoria(null)
                      }}
                      style={{ ...CELL_INPUT, width: 110, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ ...TD, borderBottom: 'none' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          onAdd(addingCategoria, addingConcepto, parseFloat(addingMonto.replace(',', '.')) || 0)
                          setAddingCategoria(null)
                        }}
                        style={{ background: '#D85A30', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: '#fff', padding: '4px 12px' }}
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setAddingCategoria(null)}
                        style={{ background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: '#AAA', padding: '4px 10px' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                  <td style={{ ...TD, borderBottom: 'none' }} />
                </tr>
              )}

              {/* Add custom entry */}
              <tr>
                <td colSpan={5} style={{ padding: '10px 20px 12px' }}>
                  <button
                    onClick={() => { setAddingCategoria('Otros'); setAddingConcepto(''); setAddingMonto('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#AAA', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 5 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E8913A' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Añadir gasto variable
                  </button>
                </td>
              </tr>

              {/* Month total */}
              {total > 0 && (
                <tr style={{ background: '#F0EDE6' }}>
                  <td colSpan={2} style={{ ...TD, borderBottom: 'none', padding: '12px 28px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888' }}>
                      Total {MONTH_NAMES[mes - 1]}
                    </span>
                  </td>
                  <td style={{ ...TD, textAlign: 'right', borderBottom: 'none', padding: '12px 20px', fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                    € {fmtMoney.format(total)}
                  </td>
                  <td colSpan={2} style={{ ...TD, borderBottom: 'none' }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CostesGeneralesPage({
  members: initialMembers,
  costosFijos: initialCostosFijos,
  minoracion: initialMinoracion,
  costosVariables: initialCostosVariables,
  año,
}: {
  members: Member[]
  costosFijos: CostoFijo[]
  minoracion: number
  costosVariables: CostoVariable[]
  año: number
}) {
  const [members, setMembers]             = useState(initialMembers)
  const [costosFijos, setCostosFijos]     = useState(initialCostosFijos)
  const [minoracion, setMinoracion]       = useState(initialMinoracion)
  const [costosVariables, setCostosVariables] = useState(initialCostosVariables)
  const [editing, setEditing]             = useState<EditingCell>(null)
  const [editingFijo, setEditingFijo]     = useState<EditingFijo>(null)
  const [editingMinoracion, setEditingMinoracion] = useState(false)
  const [, startTransition] = useTransition()

  const sorted = [...members].sort((a, b) => {
    const ro = (ROL_ORDER[a.rol] ?? 9) - (ROL_ORDER[b.rol] ?? 9)
    return ro !== 0 ? ro : a.nombre.localeCompare(b.nombre)
  })

  const groups = (['fp_partner', 'fp_manager', 'fp_team'] as const)
    .map(rol => ({ rol, members: sorted.filter(m => m.rol === rol) }))
    .filter(g => g.members.length > 0)

  // ── Equipo actions ───────────────────────────────────────────────────────────

  const commit = (userId: string, field: EditableField, rawValue: string) => {
    setEditing(null)
    const numeric = field === 'salario_mensual' || field === 'horas_mensuales'
    const value: string | number | null = rawValue === ''
      ? null
      : numeric
        ? parseFloat(rawValue.replace(',', '.'))
        : rawValue
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, [field]: value } : m))
    startTransition(async () => {
      await updateMemberCosts(userId, { [field]: value } as Parameters<typeof updateMemberCosts>[1])
    })
  }

  // ── Costos fijos actions ─────────────────────────────────────────────────────

  const commitFijo = (id: string, field: 'concepto' | 'monto', rawValue: string) => {
    setEditingFijo(null)
    const value = field === 'monto' ? parseFloat(rawValue.replace(',', '.')) || 0 : rawValue
    setCostosFijos(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
    startTransition(async () => {
      await updateCostoFijo(id, { [field]: value } as { concepto?: string; monto?: number })
    })
  }

  const handleAddFijo = () => {
    startTransition(async () => {
      const res = await addCostoFijo()
      if ('id' in res) {
        setCostosFijos(prev => [...prev, { id: res.id, concepto: 'Nuevo concepto', monto: 0, orden: prev.length + 1 }])
      }
    })
  }

  const handleDeleteFijo = (id: string) => {
    setCostosFijos(prev => prev.filter(c => c.id !== id))
    startTransition(async () => { await deleteCostoFijo(id) })
  }

  const commitMinoracion = (rawValue: string) => {
    setEditingMinoracion(false)
    const value = Math.min(100, Math.max(0, parseFloat(rawValue.replace(',', '.')) || 0))
    setMinoracion(value)
    startTransition(async () => { await updateFinanzasConfig('minoracion_no_facturable', value) })
  }

  // ── Costos variables actions ─────────────────────────────────────────────────

  const handleAddVariable = (mes: number, categoria: string, concepto: string, monto: number) => {
    startTransition(async () => {
      const res = await addCostoVariable({ año, mes, categoria, concepto, monto })
      if ('id' in res) {
        setCostosVariables(prev => [...prev, { id: res.id, año, mes, categoria, concepto, monto, notas: null }])
      }
    })
  }

  const handleUpdateVariable = (id: string, field: 'monto' | 'concepto' | 'notas', raw: string) => {
    const value = field === 'monto' ? parseFloat(raw.replace(',', '.')) || 0 : raw || null
    setCostosVariables(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
    startTransition(async () => {
      await updateCostoVariable(id, { [field]: value } as Parameters<typeof updateCostoVariable>[1])
    })
  }

  const handleDeleteVariable = (id: string) => {
    setCostosVariables(prev => prev.filter(v => v.id !== id))
    startTransition(async () => { await deleteCostoVariable(id) })
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const hrsFacturables   = members.reduce((sum, m) => sum + (m.horas_mensuales ?? 0), 0)
  const hrsEfectivas     = hrsFacturables * (1 - minoracion / 100)
  const totalFijos       = costosFijos.reduce((sum, c) => sum + (c.monto * (1 + IVA_RATE)), 0)
  const repercusion      = hrsFacturables > 0 ? totalFijos / hrsFacturables : 0
  const repercusionAjust = hrsEfectivas  > 0 ? totalFijos / hrsEfectivas   : 0

  const totalVariablesAño = costosVariables
    .filter(v => v.año === año)
    .reduce((s, v) => s + v.monto, 0)

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Finanzas generales
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
            Costes fijos/variables
          </h1>
          <span style={{ fontSize: 11, color: '#AAA', paddingBottom: 4 }}>
            {members.length} persona{members.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Cost breakdown bar */}
      <CostBreakdownBar
        members={members}
        costosFijos={costosFijos}
        costosVariables={costosVariables}
        año={año}
      />

      <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 40 }}>

        {/* ── Costes de equipo ── */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 12 }}>
            Costes de equipo
          </p>
          <div className="fp-table-wrap" style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1A1A1A' }}>
                  <th style={{ ...TH, textAlign: 'left' }}>Nombre</th>
                  <th style={{ ...TH, textAlign: 'left' }}>Rol</th>
                  <th style={{ ...TH, textAlign: 'left',  width: 130 }}>Seniority</th>
                  <th style={{ ...TH, textAlign: 'right', width: 180 }}>Salario mensual</th>
                  <th style={{ ...TH, textAlign: 'right', width: 170 }}>Acuerdo horario mensual</th>
                  <th style={{ ...TH, textAlign: 'right', width: 150 }}>Coste / hora</th>
                  <th style={{ ...TH, textAlign: 'right', width: 180 }}>Coste empresa + CF</th>
                  <th style={{ ...TH, textAlign: 'right', width: 170 }}>Precio hora comercial</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group, gi) => (
                  <Fragment key={group.rol}>
                    <tr>
                      <td colSpan={8} style={{
                        padding: '7px 20px', background: '#F8F7F4',
                        borderTop: gi > 0 ? '2px solid #E8E6E0' : undefined,
                        borderBottom: '1px solid #ECEAE4',
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ROL_COLORS[group.rol] }}>
                          {ROL_LABELS[group.rol]}
                        </span>
                      </td>
                    </tr>
                    {group.members.map((m) => {
                      const avatarIdx   = sorted.indexOf(m)
                      const avatarColor = AVATAR_COLORS[avatarIdx % AVATAR_COLORS.length]
                      const senLabel    = SENIORITY_OPTIONS.find(o => o.value === (m.seniority ?? ''))?.label
                      const ch          = (m.salario_mensual && m.horas_mensuales)
                        ? `€ ${fmtRate.format(m.salario_mensual / m.horas_mensuales)}/h`
                        : null
                      const chNum       = (m.salario_mensual && m.horas_mensuales)
                        ? m.salario_mensual / m.horas_mensuales
                        : null
                      const costeTotal  = chNum !== null ? chNum + repercusionAjust : null
                      const precioComercial = m.seniority ? (PRECIO_HORA_COMERCIAL[m.seniority] ?? null) : null
                      const editSen     = editing?.userId === m.id && editing.field === 'seniority'
                      const editSal     = editing?.userId === m.id && editing.field === 'salario_mensual'
                      const editHoras   = editing?.userId === m.id && editing.field === 'horas_mensuales'

                      return (
                        <tr key={m.id} style={{ opacity: m.blocked ? 0.4 : 1 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        >
                          <td style={{ ...TD, textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {m.avatar_url
                                  ? <img src={m.avatar_url} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{mkInitials(m.nombre, m.apellido)}</span>
                                }
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>
                                {m.nombre}{m.apellido ? ` ${m.apellido}` : ''}
                              </span>
                            </div>
                          </td>
                          <td style={{ ...TD, textAlign: 'left' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ROL_COLORS[m.rol], background: `${ROL_COLORS[m.rol]}18`, padding: '2px 7px', borderRadius: 3 }}>
                              {ROL_LABELS[m.rol]}
                            </span>
                          </td>
                          <td style={{ ...TD, textAlign: 'left' }}>
                            {editSen ? (
                              <select autoFocus defaultValue={m.seniority ?? ''}
                                onChange={e => commit(m.id, 'seniority', e.target.value)}
                                onBlur={() => setEditing(null)}
                                onKeyDown={e => e.key === 'Escape' && setEditing(null)}
                                style={{ ...CELL_INPUT, cursor: 'pointer' }}
                              >
                                {SENIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <Cell onClick={() => setEditing({ userId: m.id, field: 'seniority' })} empty={!m.seniority}>
                                {senLabel && senLabel !== '—' ? senLabel : undefined}
                              </Cell>
                            )}
                          </td>
                          <td style={{ ...TD, textAlign: 'right' }}>
                            {editSal ? (
                              <input autoFocus type="number" min={0} defaultValue={m.salario_mensual ?? ''}
                                onBlur={e => commit(m.id, 'salario_mensual', e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter')  commit(m.id, 'salario_mensual', (e.target as HTMLInputElement).value)
                                  if (e.key === 'Escape') setEditing(null)
                                }}
                                style={{ ...CELL_INPUT, width: 110, textAlign: 'right' }}
                              />
                            ) : (
                              <Cell onClick={() => setEditing({ userId: m.id, field: 'salario_mensual' })} empty={m.salario_mensual === null} align="right">
                                {m.salario_mensual !== null ? `€ ${fmtMoney.format(m.salario_mensual)}` : undefined}
                              </Cell>
                            )}
                          </td>
                          <td style={{ ...TD, textAlign: 'right' }}>
                            {editHoras ? (
                              <input autoFocus type="number" min={0} defaultValue={m.horas_mensuales ?? ''}
                                onBlur={e => commit(m.id, 'horas_mensuales', e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter')  commit(m.id, 'horas_mensuales', (e.target as HTMLInputElement).value)
                                  if (e.key === 'Escape') setEditing(null)
                                }}
                                style={{ ...CELL_INPUT, width: 80, textAlign: 'right' }}
                              />
                            ) : (
                              <Cell onClick={() => setEditing({ userId: m.id, field: 'horas_mensuales' })} empty={m.horas_mensuales === null} align="right">
                                {m.horas_mensuales !== null ? `${fmtMoney.format(m.horas_mensuales)} h/mes` : undefined}
                              </Cell>
                            )}
                          </td>
                          <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: ch ? '#1D9E75' : '#D4D0C8' }}>{ch ?? '—'}</span>
                          </td>
                          <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: costeTotal !== null ? '#D85A30' : '#D4D0C8' }}>
                              {costeTotal !== null ? `€ ${fmtRate.format(costeTotal)}/h` : '—'}
                            </span>
                          </td>

                          {/* Precio hora comercial — from seniority */}
                          <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: precioComercial !== null ? '#378ADD' : '#D4D0C8' }}>
                              {precioComercial !== null ? `€ ${precioComercial}/h` : '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 14, fontSize: 10, color: '#BBB' }}>
            Coste/hora = Salario mensual ÷ Horas mensuales · Click en cualquier celda para editar
          </p>
        </div>

        {/* ── Costes fijos mensuales ── */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 12 }}>
            Estimación costos fijos mensuales
          </p>
          <div className="fp-table-wrap" style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1A1A1A' }}>
                  <th style={{ ...TH, textAlign: 'left' }}>Concepto</th>
                  <th style={{ ...TH, textAlign: 'right', width: 180 }}>Monto sin IVA</th>
                  <th style={{ ...TH, textAlign: 'right', width: 150 }}>IVA 21%</th>
                  <th style={{ ...TH, textAlign: 'right', width: 150 }}>Subtotal</th>
                  <th style={{ ...TH, width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {costosFijos.map((c) => {
                  const iva      = c.monto * IVA_RATE
                  const subtotal = c.monto * (1 + IVA_RATE)
                  const editConc = editingFijo?.id === c.id && editingFijo.field === 'concepto'
                  const editMont = editingFijo?.id === c.id && editingFijo.field === 'monto'
                  return (
                    <tr key={c.id}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = '#FAFAF8'
                        const btn = e.currentTarget.querySelector<HTMLElement>('[data-delete]')
                        if (btn) btn.style.opacity = '1'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                        const btn = e.currentTarget.querySelector<HTMLElement>('[data-delete]')
                        if (btn) btn.style.opacity = '0'
                      }}
                    >
                      <td style={{ ...TD, textAlign: 'left' }}>
                        {editConc ? (
                          <input autoFocus type="text" defaultValue={c.concepto}
                            onBlur={e => commitFijo(c.id, 'concepto', e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  commitFijo(c.id, 'concepto', (e.target as HTMLInputElement).value)
                              if (e.key === 'Escape') setEditingFijo(null)
                            }}
                            style={{ ...CELL_INPUT, width: '100%', minWidth: 180 }}
                          />
                        ) : (
                          <Cell onClick={() => setEditingFijo({ id: c.id, field: 'concepto' })} empty={!c.concepto}>
                            {c.concepto || undefined}
                          </Cell>
                        )}
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {editMont ? (
                          <input autoFocus type="number" min={0} defaultValue={c.monto}
                            onBlur={e => commitFijo(c.id, 'monto', e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  commitFijo(c.id, 'monto', (e.target as HTMLInputElement).value)
                              if (e.key === 'Escape') setEditingFijo(null)
                            }}
                            style={{ ...CELL_INPUT, width: 110, textAlign: 'right' }}
                          />
                        ) : (
                          <Cell onClick={() => setEditingFijo({ id: c.id, field: 'monto' })} empty={c.monto === 0} align="right">
                            {`€ ${fmtMoney.format(c.monto)}`}
                          </Cell>
                        )}
                      </td>
                      <td style={{ ...TD, textAlign: 'right', color: '#AAA', fontVariantNumeric: 'tabular-nums' }}>€ {fmtMoney.format(iva)}</td>
                      <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>€ {fmtMoney.format(subtotal)}</td>
                      <td style={{ ...TD, textAlign: 'center', padding: '0 12px' }}>
                        <button data-delete onClick={() => handleDeleteFijo(c.id)}
                          style={{ opacity: 0, transition: 'opacity 0.15s', background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 14, padding: '4px 6px', borderRadius: 3 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D85A30' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}
                        >×</button>
                      </td>
                    </tr>
                  )
                })}
                <tr>
                  <td colSpan={5} style={{ padding: '10px 20px', borderBottom: '2px solid #E8E6E0' }}>
                    <button onClick={handleAddFijo}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#AAA', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 5 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E8913A' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Añadir concepto
                    </button>
                  </td>
                </tr>
                <tr style={{ background: '#F8F7F4' }}>
                  <td colSpan={2} style={{ ...TD, borderBottom: 'none', padding: '14px 20px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888' }}>Total</span>
                  </td>
                  <td colSpan={2} style={{ ...TD, textAlign: 'right', borderBottom: 'none', padding: '14px 20px', fontWeight: 600, fontSize: 13 }}>
                    € {fmtMoney.format(totalFijos)}
                  </td>
                  <td style={{ ...TD, borderBottom: 'none' }} />
                </tr>
                <tr style={{ background: '#F8F7F4' }}>
                  <td colSpan={2} style={{ ...TD, borderBottom: 'none', padding: '10px 20px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888' }}>Hrs. facturables</span>
                  </td>
                  <td colSpan={2} style={{ ...TD, textAlign: 'right', borderBottom: 'none', padding: '10px 20px', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontSize: 12, color: hrsFacturables > 0 ? '#2A2A2A' : '#D4D0C8' }}>
                      {hrsFacturables > 0 ? `${fmtMoney.format(hrsFacturables)} h/mes` : '—'}
                    </span>
                  </td>
                  <td style={{ ...TD, borderBottom: 'none' }} />
                </tr>
                <tr style={{ background: '#F8F7F4' }}>
                  <td colSpan={2} style={{ ...TD, padding: '10px 20px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888' }}>Repercusión por hora</span>
                  </td>
                  <td colSpan={2} style={{ ...TD, textAlign: 'right', padding: '10px 20px', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontSize: 12, color: repercusion > 0 ? '#2A2A2A' : '#D4D0C8' }}>
                      {repercusion > 0 ? `€ ${fmtRate.format(repercusion)}/h` : '—'}
                    </span>
                  </td>
                  <td style={{ ...TD }} />
                </tr>
                <tr style={{ background: '#F8F7F4' }}>
                  <td colSpan={2} style={{ ...TD, padding: '10px 20px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888' }}>Minoración por horas no facturables</span>
                  </td>
                  <td colSpan={2} style={{ ...TD, textAlign: 'right', padding: '10px 20px' }}>
                    {editingMinoracion ? (
                      <input autoFocus type="number" min={0} max={100} defaultValue={minoracion}
                        onBlur={e => commitMinoracion(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  commitMinoracion((e.target as HTMLInputElement).value)
                          if (e.key === 'Escape') setEditingMinoracion(false)
                        }}
                        style={{ ...CELL_INPUT, width: 60, textAlign: 'right' }}
                      />
                    ) : (
                      <Cell onClick={() => setEditingMinoracion(true)} empty={minoracion === 0} align="right">
                        {minoracion > 0 ? `${fmtMoney.format(minoracion)} %` : undefined}
                      </Cell>
                    )}
                  </td>
                  <td style={{ ...TD }} />
                </tr>
                <tr style={{ background: '#F0EDE6' }}>
                  <td colSpan={2} style={{ ...TD, borderBottom: 'none', padding: '14px 20px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#D85A30' }}>Repercusión ajustada / hora</span>
                  </td>
                  <td colSpan={2} style={{ ...TD, textAlign: 'right', borderBottom: 'none', padding: '14px 20px', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: repercusionAjust > 0 ? '#D85A30' : '#D4D0C8' }}>
                      {repercusionAjust > 0 ? `€ ${fmtRate.format(repercusionAjust)}/h` : '—'}
                    </span>
                  </td>
                  <td style={{ ...TD, borderBottom: 'none' }} />
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 14, fontSize: 10, color: '#BBB' }}>
            IVA al 21% · Minoración = % horas no productivas · Repercusión ajustada = Total (con IVA) ÷ Hrs. efectivas · Click en cualquier celda para editar
          </p>
        </div>

        {/* ── Costos variables por mes ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: 0 }}>
              Costos variables · {año}
            </p>
            {totalVariablesAño > 0 && (
              <span style={{ fontSize: 11, color: '#888' }}>
                Total año: <strong style={{ color: '#1A1A1A' }}>€ {fmtMoney.format(totalVariablesAño)}</strong>
              </span>
            )}
          </div>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
              <MonthRow
                key={mes}
                mes={mes}
                año={año}
                entries={costosVariables.filter(v => v.mes === mes && v.año === año)}
                onAdd={(cat, conc, monto) => handleAddVariable(mes, cat, conc, monto)}
                onUpdate={handleUpdateVariable}
                onDelete={handleDeleteVariable}
              />
            ))}
          </div>
          <p style={{ marginTop: 14, fontSize: 10, color: '#BBB' }}>
            Gastos que varían mes a mes · Haz click en un mes para registrar o editar gastos
          </p>
        </div>

      </div>
    </div>
  )
}
