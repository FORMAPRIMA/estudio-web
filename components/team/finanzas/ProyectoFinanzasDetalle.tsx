'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { addCostoVariableProyecto, deleteCostoVariableProyecto } from '@/app/actions/finanzas'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProyectoInfo {
  id: string
  nombre: string
  codigo: string | null
  status: string
  cliente: string | null
}

interface EmployeeRow {
  nombre: string
  apellido: string | null
  avatar_url: string | null
  costeHora: number
  horas: number
  costo: number
}

interface FaseRow {
  label: string
  horas: number
  costo: number
}

interface CostSeccion {
  seccion: string
  horas: number
  costo: number
}

interface BillingSeccion {
  seccion: string
  monto: number
  cobrado: number
  count: number
  statuses: string[]
}

export interface CostoVariableRow {
  id: string
  año: number
  mes: number
  categoria: string
  concepto: string
  monto: number
  notas: string | null
}

const CATEGORIAS_PROYECTO = [
  'Suplidos y compras',
  'Proveedores y subcontratación',
  'Desplazamientos',
  'Material de proyecto',
  'Otros gastos de proyecto',
]

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  activo:    { label: 'Activo',     color: '#D85A30' },
  on_hold:   { label: 'On Hold',    color: '#378ADD' },
  terminado: { label: 'Terminado',  color: '#1D9E75' },
  archivado: { label: 'Archivado',  color: '#999' },
}

const FACTURA_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  acordada_contrato: { label: 'En contrato', color: '#888',    bg: '#F0EEE8' },
  cobrable:          { label: 'Cobrable',    color: '#378ADD', bg: '#EEF4FD' },
  enviada:           { label: 'Enviada',     color: '#E8913A', bg: '#FDF3EE' },
  pagada:            { label: 'Pagada',      color: '#1D9E75', bg: '#EEF8F4' },
  impagada:          { label: 'Impagada',    color: '#E53E3E', bg: '#FEF2F2' },
}

const AVATAR_COLORS = ['#D85A30','#E8913A','#C9A227','#1D9E75','#378ADD','#B8860B']

const fmtH = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
const fmtE = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtR = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function mkInitials(nombre: string, apellido?: string | null) {
  return (nombre[0] ?? '').toUpperCase() + ((apellido ?? '')[0] ?? '').toUpperCase()
}

// ── Styles ────────────────────────────────────────────────────────────────────

const TH: CSSProperties = {
  padding: '11px 18px',
  fontSize: 9, fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)',
  whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.07)',
  textAlign: 'left',
}

const TD: CSSProperties = {
  padding: '13px 18px',
  fontSize: 12, color: '#2A2A2A',
  verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProyectoFinanzasDetalle({
  proyecto, totalHoras, totalCosto, totalAcordado, totalCobrado,
  billingBySec, costBySec, repercusionHora, byEmployee, byFase, costosVariables: initialCostosVariables,
}: {
  proyecto: ProyectoInfo
  totalHoras: number
  totalCosto: number
  totalAcordado: number
  totalCobrado: number
  billingBySec: BillingSeccion[]
  costBySec: CostSeccion[]
  repercusionHora: number
  byEmployee: EmployeeRow[]
  byFase: FaseRow[]
  costosVariables: CostoVariableRow[]
}) {
  const router = useRouter()
  const [seccionView, setSeccionView] = React.useState<'seccion' | 'fase'>('seccion')
  const [costosVariables, setCostosVariables] = useState<CostoVariableRow[]>(initialCostosVariables)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ concepto: '', categoria: CATEGORIAS_PROYECTO[0], monto: '', fecha: new Date().toISOString().split('T')[0] })
  const [addError, setAddError] = useState<string | null>(null)
  const [addPending, startAddTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const handleAddCosto = () => {
    const monto = parseFloat(addForm.monto)
    if (!addForm.concepto.trim() || isNaN(monto) || monto <= 0) {
      setAddError('Concepto y monto son obligatorios.')
      return
    }
    const [añoStr, mesStr] = addForm.fecha.split('-')
    const año = parseInt(añoStr, 10)
    const mes = parseInt(mesStr, 10)
    setAddError(null)
    startAddTransition(async () => {
      const res = await addCostoVariableProyecto({
        proyecto_id: proyecto.id,
        proyecto_nombre: proyecto.nombre,
        concepto: addForm.concepto.trim(),
        categoria: addForm.categoria,
        monto,
        año,
        mes,
      })
      if ('error' in res) { setAddError(res.error); return }
      setCostosVariables(prev => [{ id: res.id, año, mes, categoria: addForm.categoria, concepto: addForm.concepto.trim(), monto, notas: null }, ...prev])
      setAddForm(f => ({ ...f, concepto: '', monto: '' }))
      setShowAddForm(false)
    })
  }

  const handleDeleteCosto = (id: string) => {
    setDeletingId(id)
    startAddTransition(async () => {
      await deleteCostoVariableProyecto(id, proyecto.id)
      setCostosVariables(prev => prev.filter(c => c.id !== id))
      setDeletingId(null)
    })
  }

  const meta = STATUS_META[proyecto.status] ?? { label: proyecto.status, color: '#999' }

  const margen    = totalAcordado > 0 ? totalAcordado - totalCosto : null
  const margenPct = margen !== null && totalAcordado > 0
    ? Math.round((margen / totalAcordado) * 100)
    : null

  const maxHorasEmp  = Math.max(...byEmployee.map(e => e.horas),  1)
  const maxHorasFase = Math.max(...byFase.map(f => f.horas), 1)

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div className="pfdet-header" style={{ padding: '40px 40px 32px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        {/* Breadcrumb */}
        <button
          onClick={() => router.push('/team/finanzas/operativas/proyectos')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: '#AAA', padding: 0, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#555' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
        >
          ← Análisis de proyectos
        </button>

        <div className="pfdet-title-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
                {proyecto.nombre}
              </h1>
              {proyecto.codigo && (
                <span style={{ fontSize: 11, color: '#AAA', background: '#F0EEE8', padding: '3px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                  {proyecto.codigo}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: meta.color, background: `${meta.color}18`, padding: '3px 8px', borderRadius: 3,
              }}>
                {meta.label}
              </span>
              {proyecto.cliente && (
                <span style={{ fontSize: 12, color: '#888' }}>{proyecto.cliente}</span>
              )}
            </div>
          </div>
        </div>

        {/* Summary metrics */}
        <div className="pfdet-summary" style={{ display: 'flex', gap: 0, background: '#F8F7F4', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
          <SummaryBox label="Horas invertidas" value={totalHoras > 0    ? `${fmtH.format(totalHoras)} h`     : '—'} />
          <SummaryBox label="Coste empresa"     value={totalCosto > 0    ? `€ ${fmtE.format(totalCosto)}`     : '—'} accent />
          <SummaryBox label="Total contratado"  value={totalAcordado > 0 ? `€ ${fmtE.format(totalAcordado)}` : '—'} color={totalAcordado > 0 ? '#1D9E75' : undefined} />
          <SummaryBox
            label="Margen bruto"
            value={margenPct !== null ? `${margenPct}%` : '—'}
            color={margen !== null ? (margen >= 0 ? '#1D9E75' : '#E53E3E') : undefined}
            placeholder={margenPct === null ? 'sin facturación' : undefined}
            last
          />
        </div>
      </div>

      {/* Content */}
      <div className="pfdet-content" style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 36 }}>

        {/* By employee */}
        <section>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 12 }}>
            Inversión por empleado
          </p>
          {byEmployee.length === 0 ? (
            <EmptyState text="Sin horas registradas en este proyecto" />
          ) : (
            <div className="fp-table-wrap" style={{
              background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0',
              overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1A1A1A' }}>
                    <th style={{ ...TH }}>Empleado</th>
                    <th style={{ ...TH, textAlign: 'right', width: 140 }}>Tarifa media</th>
                    <th style={{ ...TH, textAlign: 'right', width: 160 }}>Horas</th>
                    <th style={{ ...TH, textAlign: 'right', width: 160 }}>Coste empresa</th>
                    <th style={{ ...TH, width: 160 }}>Distribución</th>
                  </tr>
                </thead>
                <tbody>
                  {byEmployee.map((emp, i) => (
                    <tr
                      key={`${emp.nombre}-${emp.apellido}`}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td style={{ ...TD }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                          }}>
                            {emp.avatar_url
                              ? <img src={emp.avatar_url} alt={emp.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>{mkInitials(emp.nombre, emp.apellido)}</span>
                            }
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>
                            {emp.nombre}{emp.apellido ? ` ${emp.apellido}` : ''}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...TD, textAlign: 'right', color: '#888' }}>
                        € {fmtR.format(emp.costeHora)}/h
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtH.format(emp.horas)} h
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#D85A30' }}>
                        € {fmtE.format(emp.costo)}
                      </td>
                      <td style={{ ...TD }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: '#F0EEE8', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 2, background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                              width: `${(emp.horas / maxHorasEmp) * 100}%`,
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: 10, color: '#AAA', width: 30, textAlign: 'right' }}>
                            {Math.round((emp.horas / totalHoras) * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr style={{ background: '#F8F7F4' }}>
                    <td style={{ ...TD, fontWeight: 600, borderBottom: 'none' }}>Total</td>
                    <td style={{ ...TD, borderBottom: 'none' }} />
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 600, borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtH.format(totalHoras)} h
                    </td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#D85A30', borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                      € {fmtE.format(totalCosto)}
                    </td>
                    <td style={{ ...TD, borderBottom: 'none' }} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* By section / fase (toggle) */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: 0 }}>
              {seccionView === 'seccion' ? 'Rentabilidad por sección' : 'Inversión por fase'}
            </p>
            <div style={{ display: 'flex', border: '1px solid #E8E6E0', borderRadius: 5, overflow: 'hidden' }}>
              {(['seccion', 'fase'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setSeccionView(mode)}
                  style={{
                    background: seccionView === mode ? '#1A1A1A' : '#fff',
                    color:      seccionView === mode ? '#fff'    : '#888',
                    border:     'none',
                    borderRight: mode === 'seccion' ? '1px solid #E8E6E0' : 'none',
                    cursor: 'pointer',
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                    textTransform: 'uppercase', padding: '5px 14px',
                    transition: 'background 0.15s',
                  }}
                >
                  {mode === 'seccion' ? 'Por sección' : 'Por fase'}
                </button>
              ))}
            </div>
          </div>

          {seccionView === 'seccion' ? (
            /* ── Section view: cost + billing + margin ── */
            (() => {
              const SORDER = ['Anteproyecto', 'Proyecto de ejecución', 'Obra', 'Interiorismo', 'Post venta']
              const allSecs = Array.from(new Set([...costBySec.map(s => s.seccion), ...billingBySec.map(b => b.seccion)]))
                .sort((a, b) => {
                  const ia = SORDER.indexOf(a), ib = SORDER.indexOf(b)
                  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
                })
              if (allSecs.length === 0) return <EmptyState text="Sin datos de sección — registra horas en fases o añade facturas" />
              return (
                <div className="fp-table-wrap" style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#1A1A1A' }}>
                        <th style={{ ...TH }}>Sección</th>
                        <th style={{ ...TH, textAlign: 'right', width: 110 }}>Horas</th>
                        <th style={{ ...TH, textAlign: 'right', width: 150 }}>Coste empresa</th>
                        <th style={{ ...TH, textAlign: 'right', width: 150 }}>Facturado</th>
                        <th style={{ ...TH, textAlign: 'right', width: 140 }}>Margen €</th>
                        <th style={{ ...TH, textAlign: 'right', width: 100 }}>Margen %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSecs.map(sec => {
                        const c   = costBySec.find(s => s.seccion === sec)
                        const b   = billingBySec.find(s => s.seccion === sec)
                        const horas      = c?.horas ?? 0
                        const costo      = c?.costo ?? 0
                        const facturado  = b?.monto ?? 0
                        const hasData    = facturado > 0 || costo > 0
                        const margen     = hasData ? facturado - costo : null
                        const margenPct  = margen !== null && facturado > 0
                          ? Math.round((margen / facturado) * 100) : null
                        const mgColor    = margen === null ? '#CCC'
                          : margen >= 0 ? '#1D9E75' : '#E53E3E'
                        return (
                          <tr
                            key={sec}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                          >
                            <td style={{ ...TD, fontWeight: 500 }}>{sec}</td>
                            <td style={{ ...TD, textAlign: 'right', color: horas > 0 ? '#2A2A2A' : '#CCC', fontVariantNumeric: 'tabular-nums' }}>
                              {horas > 0 ? `${fmtH.format(horas)} h` : '—'}
                            </td>
                            <td style={{ ...TD, textAlign: 'right', fontWeight: costo > 0 ? 500 : 400, color: costo > 0 ? '#D85A30' : '#CCC', fontVariantNumeric: 'tabular-nums' }}>
                              {costo > 0 ? `€ ${fmtE.format(costo)}` : '—'}
                            </td>
                            <td style={{ ...TD, textAlign: 'right', fontWeight: facturado > 0 ? 500 : 400, color: facturado > 0 ? '#1D9E75' : '#CCC', fontVariantNumeric: 'tabular-nums' }}>
                              {facturado > 0 ? `€ ${fmtE.format(facturado)}` : '—'}
                            </td>
                            <td style={{ ...TD, textAlign: 'right', fontWeight: margen !== null ? 600 : 400, color: mgColor, fontVariantNumeric: 'tabular-nums' }}>
                              {margen !== null ? `€ ${fmtE.format(margen)}` : '—'}
                            </td>
                            <td style={{ ...TD, textAlign: 'right', fontWeight: margenPct !== null ? 600 : 400, color: mgColor }}>
                              {margenPct !== null ? `${margenPct}%` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                      {/* Total row */}
                      <tr style={{ background: '#F8F7F4' }}>
                        <td style={{ ...TD, fontWeight: 600, borderBottom: 'none' }}>Total</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 600, borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                          {totalHoras > 0 ? `${fmtH.format(totalHoras)} h` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#D85A30', borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                          {totalCosto > 0 ? `€ ${fmtE.format(totalCosto)}` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#1D9E75', borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                          {totalAcordado > 0 ? `€ ${fmtE.format(totalAcordado)}` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: margen !== null ? (margen >= 0 ? '#1D9E75' : '#E53E3E') : '#CCC', borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                          {margen !== null ? `€ ${fmtE.format(margen)}` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: margenPct !== null ? (margenPct >= 0 ? '#1D9E75' : '#E53E3E') : '#CCC', borderBottom: 'none' }}>
                          {margenPct !== null ? `${margenPct}%` : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            })()
          ) : (
            /* ── Fase view: individual phases ── */
            byFase.length === 0 ? (
              <EmptyState text="No hay horas asociadas a fases en este proyecto" />
            ) : (
              <div className="fp-table-wrap" style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#1A1A1A' }}>
                      <th style={{ ...TH }}>Fase</th>
                      <th style={{ ...TH, textAlign: 'right', width: 160 }}>Horas</th>
                      <th style={{ ...TH, textAlign: 'right', width: 160 }}>Coste empresa</th>
                      <th style={{ ...TH, width: 180 }}>Distribución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byFase.map((fase) => (
                      <tr
                        key={fase.label}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <td style={{ ...TD, fontWeight: 500 }}>{fase.label}</td>
                        <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtH.format(fase.horas)} h
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: '#D85A30' }}>
                          € {fmtE.format(fase.costo)}
                        </td>
                        <td style={{ ...TD }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 4, background: '#F0EEE8', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 2, background: '#1D9E75',
                                width: `${(fase.horas / maxHorasFase) * 100}%`,
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: 10, color: '#AAA', width: 30, textAlign: 'right' }}>
                              {totalHoras > 0 ? Math.round((fase.horas / totalHoras) * 100) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#F8F7F4' }}>
                      <td style={{ ...TD, fontWeight: 600, borderBottom: 'none' }}>Total</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 600, borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtH.format(totalHoras)} h
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#D85A30', borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                        € {fmtE.format(totalCosto)}
                      </td>
                      <td style={{ ...TD, borderBottom: 'none' }} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>

        {/* Facturación e ingresos */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: 0 }}>
              Facturación e ingresos
            </p>
            <button
              onClick={() => router.push(`/team/finanzas/facturacion/control/${proyecto.id}`)}
              style={{ background: 'none', border: '1px solid #E8E6E0', borderRadius: 5, cursor: 'pointer', fontSize: 10, color: '#888', padding: '4px 12px' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D85A30'; (e.currentTarget as HTMLElement).style.borderColor = '#D85A30' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888';    (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0' }}
            >
              Gestionar facturas →
            </button>
          </div>

          {billingBySec.length === 0 ? (
            <EmptyState text="Sin facturas registradas · Usa el módulo de Facturación para añadirlas" />
          ) : (
            <div className="fp-table-wrap" style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1A1A1A' }}>
                    <th style={{ ...TH }}>Sección</th>
                    <th style={{ ...TH, textAlign: 'center', width: 90 }}>Facturas</th>
                    <th style={{ ...TH, textAlign: 'right', width: 170 }}>Acordado</th>
                    <th style={{ ...TH, textAlign: 'right', width: 170 }}>Cobrado</th>
                    <th style={{ ...TH, textAlign: 'right', width: 170 }}>Pendiente</th>
                    <th style={{ ...TH, textAlign: 'left',  width: 200 }}>Estados</th>
                  </tr>
                </thead>
                <tbody>
                  {billingBySec.map(sec => {
                    const pendiente = sec.monto - sec.cobrado
                    // Count how many of each status
                    const statusCounts = sec.statuses.reduce<Record<string, number>>((acc, s) => {
                      acc[s] = (acc[s] ?? 0) + 1; return acc
                    }, {})
                    return (
                      <tr
                        key={sec.seccion}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <td style={{ ...TD, fontWeight: 500 }}>{sec.seccion}</td>
                        <td style={{ ...TD, textAlign: 'center', color: '#888' }}>{sec.count}</td>
                        <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                          € {fmtE.format(sec.monto)}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1D9E75', fontWeight: 500 }}>
                          {sec.cobrado > 0 ? `€ ${fmtE.format(sec.cobrado)}` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: pendiente > 0 ? '#E8913A' : '#CCC' }}>
                          {pendiente > 0 ? `€ ${fmtE.format(pendiente)}` : '—'}
                        </td>
                        <td style={{ ...TD }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {Object.entries(statusCounts).map(([s, n]) => {
                              const sm = FACTURA_STATUS[s] ?? { label: s, color: '#888', bg: '#F0EEE8' }
                              return (
                                <span key={s} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: sm.color, background: sm.bg, padding: '2px 6px', borderRadius: 3 }}>
                                  {n > 1 ? `${n}× ` : ''}{sm.label}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals */}
                  <tr style={{ background: '#F8F7F4' }}>
                    <td style={{ ...TD, fontWeight: 600, borderBottom: 'none' }}>Total</td>
                    <td style={{ ...TD, textAlign: 'center', fontWeight: 600, borderBottom: 'none', color: '#888' }}>
                      {billingBySec.reduce((s, b) => s + b.count, 0)}
                    </td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 700, borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                      € {fmtE.format(totalAcordado)}
                    </td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#1D9E75', borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                      {totalCobrado > 0 ? `€ ${fmtE.format(totalCobrado)}` : '—'}
                    </td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: totalAcordado - totalCobrado > 0 ? '#E8913A' : '#CCC', borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                      {totalAcordado - totalCobrado > 0 ? `€ ${fmtE.format(totalAcordado - totalCobrado)}` : '—'}
                    </td>
                    <td style={{ ...TD, borderBottom: 'none' }} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Costos variables del proyecto */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: 0 }}>
              Costos variables del proyecto
            </p>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                style={{ background: 'none', border: '1px solid #E8E6E0', borderRadius: 5, cursor: 'pointer', fontSize: 10, color: '#888', padding: '4px 12px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D85A30'; (e.currentTarget as HTMLElement).style.borderColor = '#D85A30' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888';    (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0' }}
              >
                + Agregar costo
              </button>
            )}
          </div>

          {/* Add form */}
          {showAddForm && (
            <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '20px 24px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D85A30', marginBottom: 16 }}>
                Nuevo costo
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4 }}>Concepto *</label>
                  <input
                    value={addForm.concepto}
                    onChange={e => setAddForm(f => ({ ...f, concepto: e.target.value }))}
                    placeholder="Ej. Compra muebles interiorismo"
                    style={{ width: '100%', height: 34, padding: '0 10px', fontSize: 12, border: '1px solid #E8E6E0', outline: 'none', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4 }}>Categoría</label>
                  <select
                    value={addForm.categoria}
                    onChange={e => setAddForm(f => ({ ...f, categoria: e.target.value }))}
                    style={{ width: '100%', height: 34, padding: '0 10px', fontSize: 12, border: '1px solid #E8E6E0', outline: 'none', background: '#fff', fontFamily: 'inherit' }}
                  >
                    {CATEGORIAS_PROYECTO.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4 }}>Monto sin IVA (€) *</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={addForm.monto}
                    onChange={e => setAddForm(f => ({ ...f, monto: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', height: 34, padding: '0 10px', fontSize: 12, border: '1px solid #E8E6E0', outline: 'none', background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4 }}>Fecha</label>
                  <input
                    type="date"
                    value={addForm.fecha}
                    onChange={e => setAddForm(f => ({ ...f, fecha: e.target.value }))}
                    style={{ width: '100%', height: 34, padding: '0 10px', fontSize: 12, border: '1px solid #E8E6E0', outline: 'none', background: '#fff', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
              {addError && <p style={{ fontSize: 11, color: '#E53E3E', marginBottom: 10 }}>{addError}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleAddCosto}
                  disabled={addPending}
                  style={{ height: 32, padding: '0 20px', background: addPending ? '#888' : '#1A1A1A', color: '#fff', border: 'none', cursor: addPending ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: 4 }}
                >
                  {addPending ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setAddError(null) }}
                  style={{ height: 32, padding: '0 16px', background: 'none', border: '1px solid #E8E6E0', cursor: 'pointer', fontSize: 11, color: '#888', borderRadius: 4 }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {costosVariables.length === 0 && !showAddForm ? (
            <EmptyState text="Sin costos variables registrados · Usa el botón «Agregar costo» para añadir suplidos, compras u otros gastos específicos de este proyecto" />
          ) : costosVariables.length > 0 ? (
            <div className="fp-table-wrap" style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1A1A1A' }}>
                    <th style={{ ...TH }}>Concepto</th>
                    <th style={{ ...TH }}>Categoría</th>
                    <th style={{ ...TH, width: 120 }}>Fecha</th>
                    <th style={{ ...TH, textAlign: 'right', width: 140 }}>Monto</th>
                    <th style={{ ...TH, width: 48 }} />
                  </tr>
                </thead>
                <tbody>
                  {costosVariables.map(c => (
                    <tr
                      key={c.id}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td style={{ ...TD, fontWeight: 500 }}>{c.concepto}</td>
                      <td style={{ ...TD, color: '#888', fontSize: 11 }}>{c.categoria}</td>
                      <td style={{ ...TD, color: '#888', fontSize: 11 }}>{MONTH_NAMES[c.mes - 1]} {c.año}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#D85A30', fontVariantNumeric: 'tabular-nums' }}>
                        € {fmtE.format(c.monto)}
                      </td>
                      <td style={{ ...TD, textAlign: 'center', padding: '0 8px' }}>
                        <button
                          onClick={() => handleDeleteCosto(c.id)}
                          disabled={deletingId === c.id}
                          title="Eliminar"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 14, lineHeight: 1, padding: '4px 6px', borderRadius: 3 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#F8F7F4' }}>
                    <td style={{ ...TD, fontWeight: 600, borderBottom: 'none' }} colSpan={3}>Total costos variables</td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#D85A30', borderBottom: 'none', fontVariantNumeric: 'tabular-nums' }}>
                      € {fmtE.format(costosVariables.reduce((s, c) => s + c.monto, 0))}
                    </td>
                    <td style={{ ...TD, borderBottom: 'none' }} />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {/* Rentabilidad operativa */}
        <section>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 12 }}>
            Rentabilidad operativa
          </p>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1, background: '#ECEAE4', borderRadius: 8, overflow: 'hidden',
            border: '1px solid #E8E6E0',
          }}>
            <RentabilidadBox
              label="Coste empresa"
              value={totalCosto > 0 ? `€ ${fmtE.format(totalCosto)}` : '—'}
              note="horas × tarifa empresa"
              color="#D85A30"
            />
            <RentabilidadBox
              label="Total contratado"
              value={totalAcordado > 0 ? `€ ${fmtE.format(totalAcordado)}` : '—'}
              note={totalAcordado > 0 ? `${billingBySec.reduce((s, b) => s + b.count, 0)} facturas` : 'sin facturación'}
              color={totalAcordado > 0 ? '#1D9E75' : undefined}
              dim={totalAcordado === 0}
            />
            <RentabilidadBox
              label="Margen bruto €"
              value={margen !== null ? `€ ${fmtE.format(margen)}` : '—'}
              note="contratado − coste"
              color={margen !== null ? (margen >= 0 ? '#1D9E75' : '#E53E3E') : undefined}
              dim={margen === null}
            />
            <RentabilidadBox
              label="Margen bruto %"
              value={margenPct !== null ? `${margenPct}%` : '—'}
              note={margenPct !== null ? (margenPct >= 0 ? 'rentable' : 'pérdidas') : 'sin datos'}
              color={margenPct !== null ? (margenPct >= 0 ? '#1D9E75' : '#E53E3E') : undefined}
              dim={margenPct === null}
              last
            />
          </div>
          {totalAcordado > 0 && totalCosto > 0 && (
            <p style={{ marginTop: 12, fontSize: 10, color: '#AAA' }}>
              Margen = Total contratado − Coste empresa (basado en horas registradas a tarifa histórica)
            </p>
          )}
        </section>

      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SummaryBox({ label, value, accent, color, placeholder, last }: {
  label: string; value: string; accent?: boolean; color?: string; placeholder?: string; last?: boolean
}) {
  const textColor = color ?? (accent ? '#D85A30' : (placeholder ? '#CCC' : '#1A1A1A'))
  return (
    <div className="pfdet-summary-box" style={{
      flex: 1, padding: '18px 24px',
      borderRight: last ? 'none' : '1px solid #E8E6E0',
      background: '#fff',
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 6px' }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 300, color: textColor, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {placeholder && (
        <p style={{ fontSize: 9, color: '#CCC', margin: '3px 0 0', fontStyle: 'italic' }}>{placeholder}</p>
      )}
    </div>
  )
}

function RentabilidadBox({ label, value, note, color, dim, last }: {
  label: string; value: string; note: string; color?: string; dim?: boolean; last?: boolean
}) {
  const textColor = dim ? '#D4D0C8' : (color ?? '#1A1A1A')
  return (
    <div style={{ background: dim ? '#FAFAF8' : '#fff', padding: '18px 20px' }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C0BCB4', margin: '0 0 6px' }}>
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: dim ? 300 : 500, color: textColor, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <p style={{ fontSize: 9, color: dim ? '#D4D0C8' : '#AAA', margin: '3px 0 0', fontStyle: 'italic' }}>{note}</p>
    </div>
  )
}

function PlaceholderSection({ icon, title, description }: {
  icon: string; title: string; description: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, border: '1px dashed #DDD',
      padding: '32px 36px', display: 'flex', gap: 20, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 8, background: '#F0EEE8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, color: '#C0BCB4', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#AAA', margin: '0 0 6px' }}>{title}</p>
        <p style={{ fontSize: 12, color: '#CCC', margin: 0, lineHeight: 1.6, maxWidth: 520 }}>{description}</p>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      padding: '28px 24px', textAlign: 'center',
      border: '1px dashed #DDD', borderRadius: 8,
      fontSize: 12, color: '#CCC', background: '#fff',
    }}>
      {text}
    </div>
  )
}
