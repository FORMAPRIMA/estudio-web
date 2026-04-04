'use client'

import { useState, useTransition, Fragment } from 'react'
import type { CSSProperties } from 'react'
import { updateMemberCosts, addCostoFijo, updateCostoFijo, deleteCostoFijo, updateFinanzasConfig } from '@/app/actions/finanzas'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string
  nombre: string
  apellido: string | null
  avatar_url: string | null
  rol: string
  blocked?: boolean | null
  seniority: string | null
  salario_mensual: number | null
  horas_mensuales: number | null
}

interface CostoFijo {
  id: string
  concepto: string
  monto: number
  orden: number
}

type EditableField = 'seniority' | 'salario_mensual' | 'horas_mensuales'
type EditingCell = { userId: string; field: EditableField } | null
type EditingFijo = { id: string; field: 'concepto' | 'monto' } | null

// ── Constants ─────────────────────────────────────────────────────────────────

const ROL_LABELS: Record<string, string> = {
  fp_partner: 'Partner',
  fp_manager: 'Manager',
  fp_team:    'Team',
}
const ROL_COLORS: Record<string, string> = {
  fp_partner: '#D85A30',
  fp_manager: '#378ADD',
  fp_team:    '#1D9E75',
}
const ROL_ORDER: Record<string, number> = {
  fp_partner: 0,
  fp_manager: 1,
  fp_team:    2,
}

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
  senior: 150,
  junior:  60,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkInitials(nombre: string, apellido?: string | null) {
  const f = nombre.trim()[0]?.toUpperCase() ?? ''
  const l = (apellido ?? '').trim()[0]?.toUpperCase() ?? ''
  return f + l || f
}

// Comma as thousands separator, period as decimal: 2,500.50
const fmtMoney = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmtRate  = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function costoHora(salario: number | null, horas: number | null): string | null {
  if (!salario || !horas) return null
  return `€ ${fmtRate.format(salario / horas)}/h`
}

// ── Styles ────────────────────────────────────────────────────────────────────

const TH: CSSProperties = {
  padding: '13px 20px',
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.45)',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
}

const TD: CSSProperties = {
  padding: '13px 20px',
  fontSize: 12,
  color: '#2A2A2A',
  verticalAlign: 'middle',
  borderBottom: '1px solid #F0EEE8',
}

const CELL_INPUT: CSSProperties = {
  background: '#FFF8F0',
  border: '1px solid #E8913A',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 12,
  color: '#1A1A1A',
  fontFamily: 'inherit',
  outline: 'none',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CostesOperativasPage({
  members: initialMembers,
  costosFijos: initialCostosFijos,
  minoracion: initialMinoracion,
}: {
  members: Member[]
  costosFijos: CostoFijo[]
  minoracion: number
}) {
  const [members, setMembers] = useState(initialMembers)
  const [costosFijos, setCostosFijos] = useState(initialCostosFijos)
  const [minoracion, setMinoracion] = useState(initialMinoracion)
  const [editing, setEditing] = useState<EditingCell>(null)
  const [editingFijo, setEditingFijo] = useState<EditingFijo>(null)
  const [editingMinoracion, setEditingMinoracion] = useState(false)
  const [, startTransition] = useTransition()

  const sorted = [...members].sort((a, b) => {
    const ro = (ROL_ORDER[a.rol] ?? 9) - (ROL_ORDER[b.rol] ?? 9)
    return ro !== 0 ? ro : a.nombre.localeCompare(b.nombre)
  })

  const groups = (['fp_partner', 'fp_manager', 'fp_team'] as const)
    .map(rol => ({ rol, members: sorted.filter(m => m.rol === rol) }))
    .filter(g => g.members.length > 0)

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
    startTransition(async () => {
      await deleteCostoFijo(id)
    })
  }

  const commitMinoracion = (rawValue: string) => {
    setEditingMinoracion(false)
    const value = Math.min(100, Math.max(0, parseFloat(rawValue.replace(',', '.')) || 0))
    setMinoracion(value)
    startTransition(async () => {
      await updateFinanzasConfig('minoracion_no_facturable', value)
    })
  }

  // Costos fijos calculations
  const hrsFacturables    = members.reduce((sum, m) => sum + (m.horas_mensuales ?? 0), 0)
  const hrsEfectivas      = hrsFacturables * (1 - minoracion / 100)
  const totalFijos        = costosFijos.reduce((sum, c) => sum + (c.monto * (1 + IVA_RATE)), 0)
  const repercusion       = hrsFacturables > 0 ? totalFijos / hrsFacturables : 0
  const repercusionAjust  = hrsEfectivas  > 0 ? totalFijos / hrsEfectivas   : 0

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Page header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Finanzas operativas
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

      {/* Tables */}
      <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 40 }}>

        {/* ── Costes de equipo ── */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 12 }}>
            Costes de equipo
          </p>
          <div style={{
            background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0',
            overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
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
                    {/* Role divider */}
                    <tr>
                      <td colSpan={8} style={{
                        padding: '7px 20px',
                        background: '#F8F7F4',
                        borderTop: gi > 0 ? '2px solid #E8E6E0' : undefined,
                        borderBottom: '1px solid #ECEAE4',
                      }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                          textTransform: 'uppercase', color: ROL_COLORS[group.rol],
                        }}>
                          {ROL_LABELS[group.rol]}
                        </span>
                      </td>
                    </tr>

                    {/* Member rows */}
                    {group.members.map((m) => {
                      const avatarIdx    = sorted.indexOf(m)
                      const avatarColor  = AVATAR_COLORS[avatarIdx % AVATAR_COLORS.length]
                      const senLabel     = SENIORITY_OPTIONS.find(o => o.value === (m.seniority ?? ''))?.label
                      const ch           = costoHora(m.salario_mensual, m.horas_mensuales)
                      const chNum        = (m.salario_mensual && m.horas_mensuales) ? m.salario_mensual / m.horas_mensuales : null
                      const costeTotal   = chNum !== null ? chNum + repercusionAjust : null
                      const precioComercial = m.seniority ? (PRECIO_HORA_COMERCIAL[m.seniority] ?? null) : null
                      const editSen      = editing?.userId === m.id && editing.field === 'seniority'
                      const editSal      = editing?.userId === m.id && editing.field === 'salario_mensual'
                      const editHoras    = editing?.userId === m.id && editing.field === 'horas_mensuales'

                      return (
                        <tr
                          key={m.id}
                          style={{ opacity: m.blocked ? 0.4 : 1 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        >
                          {/* Nombre */}
                          <td style={{ ...TD, textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                                background: avatarColor, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', overflow: 'hidden',
                              }}>
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

                          {/* Rol */}
                          <td style={{ ...TD, textAlign: 'left' }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                              color: ROL_COLORS[m.rol], background: `${ROL_COLORS[m.rol]}18`,
                              padding: '2px 7px', borderRadius: 3,
                            }}>
                              {ROL_LABELS[m.rol]}
                            </span>
                          </td>

                          {/* Seniority */}
                          <td style={{ ...TD, textAlign: 'left' }}>
                            {editSen ? (
                              <select
                                autoFocus
                                defaultValue={m.seniority ?? ''}
                                onChange={e => commit(m.id, 'seniority', e.target.value)}
                                onBlur={() => setEditing(null)}
                                onKeyDown={e => e.key === 'Escape' && setEditing(null)}
                                style={{ ...CELL_INPUT, cursor: 'pointer' }}
                              >
                                {SENIORITY_OPTIONS.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            ) : (
                              <Cell onClick={() => setEditing({ userId: m.id, field: 'seniority' })} empty={!m.seniority}>
                                {senLabel && senLabel !== '—' ? senLabel : undefined}
                              </Cell>
                            )}
                          </td>

                          {/* Salario mensual */}
                          <td style={{ ...TD, textAlign: 'right' }}>
                            {editSal ? (
                              <input
                                autoFocus
                                type="number"
                                min={0}
                                defaultValue={m.salario_mensual ?? ''}
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

                          {/* Horas mensuales */}
                          <td style={{ ...TD, textAlign: 'right' }}>
                            {editHoras ? (
                              <input
                                autoFocus
                                type="number"
                                min={0}
                                defaultValue={m.horas_mensuales ?? ''}
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

                          {/* Coste / hora — calculated */}
                          <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: ch ? '#1D9E75' : '#D4D0C8' }}>
                              {ch ?? '—'}
                            </span>
                          </td>

                          {/* Coste empresa + CF — calculated */}
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

        {/* ── Estimación costos fijos mensuales ── */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 12 }}>
            Estimación costos fijos mensuales
          </p>
          <div style={{
            background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0',
            overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
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
                    <tr
                      key={c.id}
                      style={{ position: 'relative' }}
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
                      {/* Concepto */}
                      <td style={{ ...TD, textAlign: 'left' }}>
                        {editConc ? (
                          <input
                            autoFocus
                            type="text"
                            defaultValue={c.concepto}
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

                      {/* Monto sin IVA */}
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {editMont ? (
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            defaultValue={c.monto}
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

                      {/* IVA */}
                      <td style={{ ...TD, textAlign: 'right', color: '#AAA', fontVariantNumeric: 'tabular-nums' }}>
                        € {fmtMoney.format(iva)}
                      </td>

                      {/* Subtotal */}
                      <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        € {fmtMoney.format(subtotal)}
                      </td>

                      {/* Delete */}
                      <td style={{ ...TD, textAlign: 'center', padding: '0 12px' }}>
                        <button
                          data-delete
                          onClick={() => handleDeleteFijo(c.id)}
                          title="Eliminar"
                          style={{
                            opacity: 0, transition: 'opacity 0.15s',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#CCC', fontSize: 14, padding: '4px 6px', borderRadius: 3,
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D85A30' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {/* Add row */}
                <tr>
                  <td colSpan={5} style={{ padding: '10px 20px', borderBottom: '2px solid #E8E6E0' }}>
                    <button
                      onClick={handleAddFijo}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 11, color: '#AAA', padding: '2px 6px',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E8913A' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Añadir concepto
                    </button>
                  </td>
                </tr>

                {/* TOTAL summary row */}
                <tr style={{ background: '#F8F7F4' }}>
                  <td colSpan={2} style={{ ...TD, borderBottom: 'none', padding: '14px 20px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888' }}>
                      Total
                    </span>
                  </td>
                  <td colSpan={2} style={{ ...TD, textAlign: 'right', borderBottom: 'none', padding: '14px 20px', fontWeight: 600, fontSize: 13 }}>
                    € {fmtMoney.format(totalFijos)}
                  </td>
                  <td style={{ ...TD, borderBottom: 'none' }} />
                </tr>

                {/* HRS. FACT row */}
                <tr style={{ background: '#F8F7F4' }}>
                  <td colSpan={2} style={{ ...TD, borderBottom: 'none', padding: '10px 20px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888' }}>
                      Hrs. facturables
                    </span>
                  </td>
                  <td colSpan={2} style={{ ...TD, textAlign: 'right', borderBottom: 'none', padding: '10px 20px', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontSize: 12, color: hrsFacturables > 0 ? '#2A2A2A' : '#D4D0C8' }}>
                      {hrsFacturables > 0 ? `${fmtMoney.format(hrsFacturables)} h/mes` : '—'}
                    </span>
                  </td>
                  <td style={{ ...TD, borderBottom: 'none' }} />
                </tr>

                {/* REPERCUSIÓN / HORA row */}
                <tr style={{ background: '#F8F7F4' }}>
                  <td colSpan={2} style={{ ...TD, padding: '10px 20px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888' }}>
                      Repercusión por hora
                    </span>
                  </td>
                  <td colSpan={2} style={{ ...TD, textAlign: 'right', padding: '10px 20px', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontSize: 12, color: repercusion > 0 ? '#2A2A2A' : '#D4D0C8' }}>
                      {repercusion > 0 ? `€ ${fmtRate.format(repercusion)}/h` : '—'}
                    </span>
                  </td>
                  <td style={{ ...TD }} />
                </tr>

                {/* MINORACIÓN row */}
                <tr style={{ background: '#F8F7F4' }}>
                  <td colSpan={2} style={{ ...TD, padding: '10px 20px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888' }}>
                      Minoración por horas no facturables
                    </span>
                  </td>
                  <td colSpan={2} style={{ ...TD, textAlign: 'right', padding: '10px 20px' }}>
                    {editingMinoracion ? (
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={minoracion}
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

                {/* REPERCUSIÓN AJUSTADA row */}
                <tr style={{ background: '#F0EDE6' }}>
                  <td colSpan={2} style={{ ...TD, borderBottom: 'none', padding: '14px 20px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#D85A30' }}>
                      Repercusión ajustada / hora
                    </span>
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
            IVA al 21% · Hrs. facturables = suma de acuerdos horarios del equipo · Minoración = % horas no productivas · Repercusión ajustada = Total (con IVA) ÷ Hrs. efectivas · Coste empresa + CF = Coste/h empleado + Repercusión ajustada
          </p>
        </div>

      </div>
    </div>
  )
}

// ── Cell helper ───────────────────────────────────────────────────────────────

function Cell({ children, onClick, empty, align = 'left' }: {
  children?: string
  onClick: () => void
  empty: boolean
  align?: 'left' | 'right'
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
