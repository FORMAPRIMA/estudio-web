'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { addFactura, updateFactura, deleteFactura, updateClienteBilling, aplazarFactura, emitirFacturaDesdeContrato } from '@/app/actions/facturacion'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProyectoInfo {
  id: string; nombre: string; codigo: string | null
  imagen_url: string | null; status: string
}

interface ClienteInfo {
  id: string; nombre: string; apellidos: string | null; empresa: string | null
  email: string | null; email_cc: string | null
  telefono: string | null; telefono_alt: string | null
  nif_cif: string | null; direccion_facturacion: string | null
  ciudad: string | null; codigo_postal: string | null; pais: string | null
}

interface Factura {
  id: string; seccion: string; concepto: string; numero_factura: string | null
  monto: number; fecha_emision: string | null; fecha_pago_acordada: string | null
  fecha_cobro: string | null; status: string; notas: string | null
  factura_emitida_id: string | null; clientes_ids: string[]; proveedor_id: string | null
}

interface ConstructorInfo {
  id: string; nombre: string; nif_cif: string | null
  direccion_fiscal: string | null; iban: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  acordada_contrato: { label: 'En contrato',  color: '#888',    bg: '#F0EEE8'  },
  cobrable:          { label: 'Cobrable',     color: '#378ADD', bg: '#EEF4FD'  },
  enviada:           { label: 'Enviada',      color: '#E8913A', bg: '#FDF3EE'  },
  pagada:            { label: 'Pagada',       color: '#1D9E75', bg: '#EEF8F4'  },
  impagada:          { label: 'Impagada',     color: '#E53E3E', bg: '#FEF2F2'  },
}

const STATUS_ORDER = ['acordada_contrato', 'cobrable', 'enviada', 'pagada', 'impagada']

const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  activo:    { label: 'En proceso',  color: '#D85A30' },
  on_hold:   { label: 'On Hold',     color: '#378ADD' },
  terminado: { label: 'Terminado',   color: '#1D9E75' },
  archivado: { label: 'Archivado',   color: '#999'    },
}

const fmtE = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtE0 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Styles ────────────────────────────────────────────────────────────────────

const TH: CSSProperties = {
  padding: '10px 16px', fontSize: 9, fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
}

const TD: CSSProperties = {
  padding: '11px 16px', fontSize: 12, color: '#2A2A2A',
  verticalAlign: 'middle', borderBottom: '1px solid #F0EEE8',
}

const INPUT: CSSProperties = {
  background: '#FFF8F0', border: '1px solid #E8913A',
  borderRadius: 4, padding: '4px 8px', fontSize: 12,
  color: '#1A1A1A', fontFamily: 'inherit', outline: 'none',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FacturacionProyectoDetalle({
  proyecto, cliente: initialCliente, facturas: initialFacturas, secciones, todosClientes, constructor,
}: {
  proyecto: ProyectoInfo
  cliente: ClienteInfo | null
  facturas: Factura[]
  secciones: string[]
  todosClientes: ClienteInfo[]
  constructor: ConstructorInfo | null
}) {
  const router = useRouter()
  const [facturas, setFacturas] = useState(initialFacturas)
  const [cliente, setCliente] = useState(initialCliente)
  const [editingCliente, setEditingCliente] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editCell, setEditCell] = useState<{ id: string; field: string } | null>(null)
  const [editingStatus, setEditingStatus] = useState<string | null>(null)
  const [addingSeccion, setAddingSeccion] = useState<string | null>(null)
  const [emitiendo, setEmitiendo] = useState<string | null>(null)
  const [emitError, setEmitError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const projMeta = PROJECT_STATUS[proyecto.status] ?? { label: proyecto.status, color: '#999' }

  // Summary calculations
  const totalAcordado = facturas.reduce((s, f) => s + f.monto, 0)
  const totalCobrado  = facturas.filter(f => f.status === 'pagada').reduce((s, f) => s + f.monto, 0)
  const totalEnviada  = facturas.filter(f => f.status === 'enviada').reduce((s, f) => s + f.monto, 0)
  const totalImpagada = facturas.filter(f => f.status === 'impagada').reduce((s, f) => s + f.monto, 0)

  // ── Actions ──────────────────────────────────────────────────────────────────

  const commitCell = (id: string, field: string, rawValue: string) => {
    setEditCell(null)
    const numericFields = ['monto']
    const value = numericFields.includes(field)
      ? parseFloat(rawValue.replace(',', '.')) || 0
      : rawValue || null

    setFacturas(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
    startTransition(async () => {
      await updateFactura(id, proyecto.id, { [field]: value } as Parameters<typeof updateFactura>[2])
      router.refresh()
    })
  }

  const commitStatus = (id: string, newStatus: string) => {
    setEditingStatus(null)
    setFacturas(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f))
    startTransition(async () => {
      await updateFactura(id, proyecto.id, { status: newStatus })
      router.refresh()
    })
  }

  const handleAdd = (seccion: string, data: { concepto: string; monto: string; fecha_pago_acordada: string; clientes_ids: string[]; proveedor_id: string | null }) => {
    setAddingSeccion(null)
    const monto = parseFloat(data.monto.replace(',', '.')) || 0
    startTransition(async () => {
      const res = await addFactura({
        proyecto_id:         proyecto.id,
        seccion,
        concepto:            data.concepto || 'Nueva factura',
        monto,
        fecha_pago_acordada: data.fecha_pago_acordada || null,
        clientes_ids:        data.proveedor_id ? [] : data.clientes_ids,
        proveedor_id:        data.proveedor_id ?? null,
      })
      if ('id' in res) {
        setFacturas(prev => [...prev, {
          id: res.id, seccion, concepto: data.concepto || 'Nueva factura',
          numero_factura: null, monto,
          fecha_emision: null, fecha_pago_acordada: data.fecha_pago_acordada || null,
          fecha_cobro: null, status: 'acordada_contrato', notas: null,
          factura_emitida_id: null,
          clientes_ids: data.proveedor_id ? [] : data.clientes_ids,
          proveedor_id: data.proveedor_id ?? null,
        }])
        router.refresh()
      }
    })
  }

  const handleClientesFactura = (facturaId: string, ids: string[]) => {
    setFacturas(prev => prev.map(f => f.id === facturaId ? { ...f, clientes_ids: ids, proveedor_id: null } : f))
    startTransition(async () => {
      await updateFactura(facturaId, proyecto.id, { clientes_ids: ids, proveedor_id: null })
      router.refresh()
    })
  }

  const handleProveedorFactura = (facturaId: string, proveedorId: string | null) => {
    setFacturas(prev => prev.map(f => f.id === facturaId ? { ...f, proveedor_id: proveedorId, clientes_ids: [] } : f))
    startTransition(async () => {
      await updateFactura(facturaId, proyecto.id, { proveedor_id: proveedorId, clientes_ids: [] })
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    const snapshot = facturas.find(f => f.id === id)
    setDeleteError(null)
    setFacturas(prev => prev.filter(f => f.id !== id))
    startTransition(async () => {
      const res = await deleteFactura(id, proyecto.id)
      if ('error' in res) {
        // Restore the row and show the error
        if (snapshot) setFacturas(prev => [...prev, snapshot])
        setDeleteError(`No se pudo eliminar la factura: ${res.error}`)
      } else {
        router.refresh()
      }
    })
  }

  const handleEmitir = async (facturaId: string) => {
    setEmitiendo(facturaId)
    setEmitError(null)
    const result = await emitirFacturaDesdeContrato(facturaId)
    setEmitiendo(null)
    if ('error' in result) {
      setEmitError(result.error)
      return
    }
    // Update local state: link emitida id
    setFacturas(prev => prev.map(f =>
      f.id === facturaId ? { ...f, factura_emitida_id: result.id } : f
    ))
    router.push('/team/finanzas/facturacion/emitidas')
  }

  const handleAplazar = (facturaId: string, nuevaFecha: string) => {
    if (!nuevaFecha) return
    setFacturas(prev => prev.map(f =>
      f.id === facturaId ? { ...f, fecha_pago_acordada: nuevaFecha, status: 'acordada_contrato' } : f
    ))
    startTransition(async () => {
      await aplazarFactura(facturaId, proyecto.id, nuevaFecha)
      router.refresh()
    })
  }

  const commitCliente = (field: string, value: string) => {
    if (!cliente) return
    const updated = { ...cliente, [field]: value || null }
    setCliente(updated)
    startTransition(async () => {
      await updateClienteBilling(cliente.id, { [field]: value || null } as Parameters<typeof updateClienteBilling>[1])
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div className="fpdet-header" style={{ padding: '40px 40px 32px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <button
          onClick={() => router.push('/team/finanzas/facturacion/control')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#AAA', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#555' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
        >
          ← Facturación por proyecto
        </button>

        <div className="fpdet-title-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
                {proyecto.nombre}
              </h1>
              {proyecto.codigo && (
                <span style={{ fontSize: 11, color: '#AAA', background: '#F0EEE8', padding: '3px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                  {proyecto.codigo}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: projMeta.color, background: `${projMeta.color}18`, padding: '3px 8px', borderRadius: 3 }}>
                {projMeta.label}
              </span>
              {cliente && (
                <span style={{ fontSize: 12, color: '#888' }}>{cliente.empresa ?? cliente.nombre}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push(`/team/finanzas/operativas/proyectos/${proyecto.id}`)}
            style={{ background: 'none', border: '1px solid #E8E6E0', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#888', padding: '6px 14px', marginTop: 4 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#CCC'; (e.currentTarget as HTMLElement).style.color = '#555' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0'; (e.currentTarget as HTMLElement).style.color = '#888' }}
          >
            Ver análisis de costes →
          </button>
        </div>

        {emitError && (
          <div style={{ marginBottom: 12, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Error al emitir factura: {emitError}</span>
            <button onClick={() => setEmitError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}
        {deleteError && (
          <div style={{ marginBottom: 12, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Summary */}
        <div className="fpdet-summary" style={{ display: 'flex', gap: 0, background: '#F8F7F4', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden' }}>
          <SummaryBox label="Total contratado" value={`€ ${fmtE0.format(totalAcordado)}`} accent />
          <SummaryBox label="Cobrado"     value={totalCobrado  > 0 ? `€ ${fmtE0.format(totalCobrado)}`  : '—'} color="#1D9E75" />
          <SummaryBox label="Enviadas"    value={totalEnviada  > 0 ? `€ ${fmtE0.format(totalEnviada)}`  : '—'} color="#E8913A" />
          <SummaryBox label="Impagadas"   value={totalImpagada > 0 ? `€ ${fmtE0.format(totalImpagada)}` : '—'} color={totalImpagada > 0 ? '#E53E3E' : undefined} last />
        </div>
      </div>

      {/* Content */}
      <div className="fpdet-content" style={{ padding: '28px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Cliente */}
        {cliente && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: 0 }}>
                Datos de facturación
              </p>
              <button
                onClick={() => setEditingCliente(v => !v)}
                style={{ background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: editingCliente ? '#D85A30' : '#AAA', padding: '2px 10px' }}
              >
                {editingCliente ? 'Cerrar' : 'Editar'}
              </button>
              <button
                onClick={() => router.push('/team/clientes/base-datos')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#AAA', padding: 0, marginLeft: 'auto' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#378ADD' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
              >
                Ver ficha completa →
              </button>
            </div>
            <div className="fpdet-cliente-grid" style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 32px' }}>
              {([
                { key: 'nombre',               label: 'Nombre' },
                { key: 'apellidos',            label: 'Apellidos' },
                { key: 'empresa',              label: 'Empresa' },
                { key: 'nif_cif',              label: 'NIF / CIF' },
                { key: 'email',                label: 'Email facturación' },
                { key: 'email_cc',             label: 'Email CC' },
                { key: 'telefono',             label: 'Teléfono' },
                { key: 'telefono_alt',         label: 'Teléfono alternativo' },
                { key: 'direccion_facturacion', label: 'Dirección de facturación' },
                { key: 'ciudad',               label: 'Ciudad' },
                { key: 'codigo_postal',        label: 'Código postal' },
                { key: 'pais',                 label: 'País' },
              ] as { key: keyof ClienteInfo; label: string }[]).map(({ key, label }) => (
                <ClienteField
                  key={key}
                  label={label}
                  value={(cliente as unknown as Record<string, string | null>)[key] ?? ''}
                  editing={editingCliente}
                  onCommit={v => commitCliente(key, v)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Sections */}
        {secciones.map(seccion => {
          const secFacturas = facturas.filter(f => f.seccion === seccion)
          const secTotal    = secFacturas.reduce((s, f) => s + f.monto, 0)
          const secCobrado  = secFacturas.filter(f => f.status === 'pagada').reduce((s, f) => s + f.monto, 0)
          const isAdding    = addingSeccion === seccion

          return (
            <section key={seccion}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', margin: 0 }}>
                  {seccion}
                </p>
                {secTotal > 0 && (
                  <>
                    <span style={{ fontSize: 11, color: '#AAA' }}>€ {fmtE0.format(secTotal)} contratado</span>
                    {secCobrado > 0 && (
                      <span style={{ fontSize: 11, color: '#1D9E75', fontWeight: 500 }}>€ {fmtE0.format(secCobrado)} cobrado</span>
                    )}
                  </>
                )}
              </div>

              <div className="fp-table-wrap" style={{ background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#1A1A1A' }}>
                      <th style={{ ...TH, textAlign: 'left' }}>Concepto</th>
                      {(todosClientes.length > 1 || !!constructor) && (
                        <th style={{ ...TH, textAlign: 'left', width: 140 }}>Destinatario</th>
                      )}
                      <th style={{ ...TH, textAlign: 'left', width: 130 }}>N.º Factura</th>
                      <th style={{ ...TH, textAlign: 'right', width: 140 }}>Monto</th>
                      <th style={{ ...TH, textAlign: 'center', width: 130 }}>F. acordada</th>
                      <th style={{ ...TH, textAlign: 'center', width: 110 }}>F. emisión</th>
                      <th style={{ ...TH, textAlign: 'center', width: 100 }}>F. cobro</th>
                      <th style={{ ...TH, textAlign: 'center', width: 130 }}>Estado</th>
                      <th style={{ ...TH, width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {secFacturas.map(f => (
                      <FacturaRow
                        key={f.id}
                        factura={f}
                        editCell={editCell}
                        editingStatus={editingStatus}
                        expanded={expandedIds.has(f.id)}
                        emitiendo={emitiendo === f.id}
                        todosClientes={todosClientes}
                        constructor={constructor}
                        onToggleExpand={() => setExpandedIds(prev => {
                          const next = new Set(prev)
                          next.has(f.id) ? next.delete(f.id) : next.add(f.id)
                          return next
                        })}
                        onEditCell={(field) => setEditCell({ id: f.id, field })}
                        onCommitCell={(field, val) => commitCell(f.id, field, val)}
                        onCancelEdit={() => setEditCell(null)}
                        onEditStatus={() => setEditingStatus(f.id)}
                        onCommitStatus={(s) => commitStatus(f.id, s)}
                        onCancelStatus={() => setEditingStatus(null)}
                        onDelete={() => handleDelete(f.id)}
                        onEmitir={() => handleEmitir(f.id)}
                        onAplazar={(date) => handleAplazar(f.id, date)}
                        onClientesChange={(ids) => handleClientesFactura(f.id, ids)}
                        onProveedorChange={(id) => handleProveedorFactura(f.id, id)}
                      />
                    ))}
                    {secFacturas.length === 0 && !isAdding && (
                      <tr>
                        <td colSpan={(todosClientes.length > 1 || !!constructor) ? 9 : 8} style={{ ...TD, textAlign: 'center', color: '#CCC', fontStyle: 'italic', borderBottom: 'none' }}>
                          Sin facturas en esta sección
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Add row */}
                {isAdding ? (
                  <AddFacturaForm
                    clientes={todosClientes}
                    constructor={constructor}
                    onConfirm={(data) => handleAdd(seccion, data)}
                    onCancel={() => setAddingSeccion(null)}
                  />
                ) : (
                  <div style={{ padding: '10px 16px', borderTop: secFacturas.length > 0 ? '1px solid #F0EEE8' : 'none' }}>
                    <button
                      onClick={() => setAddingSeccion(seccion)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#AAA', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 5 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D85A30' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
                    >
                      <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Añadir factura
                    </button>
                  </div>
                )}

                {/* Section total footer */}
                {secFacturas.length > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32, padding: '10px 16px', background: '#F8F7F4', borderTop: '2px solid #E8E6E0' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888' }}>Total sección</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', fontVariantNumeric: 'tabular-nums', minWidth: 100, textAlign: 'right' }}>
                      € {fmtE0.format(secTotal)}
                    </span>
                    <div style={{ width: (todosClientes.length > 1 || !!constructor) ? 180 : 40 }} />
                  </div>
                )}
              </div>
            </section>
          )
        })}

        {/* Grand total */}
        {facturas.length > 0 && (
          <div className="fpdet-grand-total" style={{ display: 'flex', justifyContent: 'flex-end', gap: 40, padding: '20px 24px', background: '#fff', borderRadius: 8, border: '1px solid #E8E6E0' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>Total contratado</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: '#1A1A1A', margin: 0, fontVariantNumeric: 'tabular-nums' }}>€ {fmtE0.format(totalAcordado)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>Total cobrado</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: '#1D9E75', margin: 0, fontVariantNumeric: 'tabular-nums' }}>€ {fmtE0.format(totalCobrado)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>Pendiente</p>
              <p style={{ fontSize: 20, fontWeight: 300, color: totalAcordado - totalCobrado > 0 ? '#E8913A' : '#CCC', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                € {fmtE0.format(totalAcordado - totalCobrado)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ClienteMultiSelect ────────────────────────────────────────────────────────

function ClienteMultiSelect({
  clientes,
  selectedIds,
  onChange,
  constructor: constructorOpt,
  proveedorId,
  onProveedorChange,
  compact = false,
}: {
  clientes: ClienteInfo[]
  selectedIds: Set<string>
  onChange: (ids: string[]) => void
  constructor?: ConstructorInfo | null
  proveedorId?: string | null
  onProveedorChange?: (id: string | null) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, minWidth: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({
        top:      r.bottom + 6,
        left:     r.left,
        minWidth: Math.max(r.width, 220),
      })
    }
    setOpen(v => !v)
  }

  const toggle = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange(Array.from(next))
  }

  const toggleConstructor = () => {
    if (!constructorOpt || !onProveedorChange) return
    if (proveedorId === constructorOpt.id) {
      onProveedorChange(null)
    } else {
      onProveedorChange(constructorOpt.id)
    }
  }

  const constructorSelected = !!(constructorOpt && proveedorId === constructorOpt.id)
  const selected = clientes.filter(c => selectedIds.has(c.id))
  const label = constructorSelected
    ? constructorOpt!.nombre
    : selected.length === 0
      ? 'Sin asignar'
      : selected.length === 1
        ? (selected[0].empresa ?? [selected[0].nombre, selected[0].apellidos].filter(Boolean).join(' '))
        : `${selected.length} clientes`

  const hasSelection = constructorSelected || selected.length > 0
  const triggerStyle: CSSProperties = compact
    ? {
        background: 'none', border: '1px solid transparent', borderRadius: 4,
        padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
        color: hasSelection ? (constructorSelected ? '#1D6A9E' : '#1A1A1A') : '#AAA',
        display: 'flex', alignItems: 'center', gap: 5, maxWidth: 150,
      }
    : {
        ...INPUT, height: 30, cursor: 'pointer', fontSize: 11,
        display: 'flex', alignItems: 'center', gap: 6, minWidth: 160,
        color: hasSelection ? '#1A1A1A' : '#AAA',
      }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        onMouseEnter={e => { if (compact) (e.currentTarget as HTMLElement).style.borderColor = '#D0CEC9' }}
        onMouseLeave={e => { if (compact) (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
        style={triggerStyle}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
          {label}
        </span>
        {selected.length > 1 && (
          <span style={{ fontSize: 9, fontWeight: 700, background: '#D85A30', color: '#fff', borderRadius: 10, padding: '1px 5px', flexShrink: 0 }}>
            {selected.length}
          </span>
        )}
        <span style={{ fontSize: 8, color: '#AAA', flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top:      dropPos.top,
            left:     dropPos.left,
            minWidth: dropPos.minWidth,
            zIndex:   9999,
            background: '#fff',
            border: '1px solid #E8E6E0',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid #F0EEE8' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
              Destinatario de factura
            </span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {/* Constructor option — mutually exclusive with clients */}
            {constructorOpt && (
              <>
                <button
                  type="button"
                  onClick={toggleConstructor}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '8px 14px',
                    background: constructorSelected ? '#EEF4FD' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderLeft: constructorSelected ? '2px solid #378ADD' : '2px solid transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!constructorSelected) (e.currentTarget as HTMLElement).style.background = '#F8F7F4' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = constructorSelected ? '#EEF4FD' : 'transparent' }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    border: constructorSelected ? '2px solid #378ADD' : '2px solid #D0CEC9',
                    background: constructorSelected ? '#378ADD' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}>
                    {constructorSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, color: '#1A1A1A', fontWeight: constructorSelected ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {constructorOpt.nombre}
                    </div>
                    <div style={{ fontSize: 10, color: '#378ADD', whiteSpace: 'nowrap' }}>Constructor</div>
                  </div>
                </button>
                {clientes.length > 0 && (
                  <div style={{ margin: '4px 14px', borderTop: '1px solid #F0EEE8' }} />
                )}
              </>
            )}
            {clientes.map(c => {
              const checked = !constructorSelected && selectedIds.has(c.id)
              const nombre = [c.nombre, c.apellidos].filter(Boolean).join(' ')
              const sublabel = c.empresa ?? null
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { if (constructorSelected) return; toggle(c.id) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '8px 14px',
                    background: checked ? '#FDF3EE' : 'transparent',
                    border: 'none', cursor: constructorSelected ? 'default' : 'pointer', textAlign: 'left',
                    borderLeft: checked ? '2px solid #D85A30' : '2px solid transparent',
                    transition: 'background 0.1s',
                    opacity: constructorSelected ? 0.45 : 1,
                  }}
                  onMouseEnter={e => { if (!checked && !constructorSelected) (e.currentTarget as HTMLElement).style.background = '#F8F7F4' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = checked ? '#FDF3EE' : 'transparent' }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: checked ? '2px solid #D85A30' : '2px solid #D0CEC9',
                    background: checked ? '#D85A30' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}>
                    {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, color: '#1A1A1A', fontWeight: checked ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {nombre}
                    </div>
                    {sublabel && (
                      <div style={{ fontSize: 10, color: '#AAA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sublabel}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          {(constructorSelected || selected.length > 0) && (
            <div style={{ padding: '6px 14px 10px', borderTop: '1px solid #F0EEE8', fontSize: 10, color: '#AAA' }}>
              {constructorSelected
                ? constructorOpt!.nombre
                : selected.map(c => [c.nombre, c.apellidos].filter(Boolean).join(' ')).join(' · ')
              }
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── Factura Row ───────────────────────────────────────────────────────────────

function FacturaRow({
  factura, editCell, editingStatus, expanded, emitiendo, todosClientes, constructor,
  onToggleExpand, onEditCell, onCommitCell, onCancelEdit,
  onEditStatus, onCommitStatus, onCancelStatus, onDelete,
  onEmitir, onAplazar, onClientesChange, onProveedorChange,
}: {
  factura: Factura
  editCell: { id: string; field: string } | null
  editingStatus: string | null
  expanded: boolean
  emitiendo: boolean
  todosClientes: ClienteInfo[]
  constructor: ConstructorInfo | null
  onToggleExpand: () => void
  onEditCell: (field: string) => void
  onCommitCell: (field: string, val: string) => void
  onCancelEdit: () => void
  onEditStatus: () => void
  onCommitStatus: (s: string) => void
  onCancelStatus: () => void
  onDelete: () => void
  onEmitir: () => void
  onAplazar: (date: string) => void
  onClientesChange: (ids: string[]) => void
  onProveedorChange: (id: string | null) => void
}) {
  const rowRouter = useRouter()
  const showClienteCol = todosClientes.length > 1 || !!constructor
  const meta = STATUS_META[factura.status] ?? STATUS_META.acordada_contrato
  const isActive = (field: string) => editCell?.id === factura.id && editCell.field === field

  const InlineText = ({ field, value, width, align = 'left' }: { field: string; value: string | null; width?: number; align?: 'left' | 'right' | 'center' }) =>
    isActive(field) ? (
      <input
        autoFocus
        type="text"
        defaultValue={value ?? ''}
        onBlur={e => onCommitCell(field, e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onCommitCell(field, (e.target as HTMLInputElement).value)
          if (e.key === 'Escape') onCancelEdit()
        }}
        style={{ ...INPUT, width: width ?? 160 }}
      />
    ) : (
      <span
        onClick={() => onEditCell(field)}
        title="Click para editar"
        style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 3, color: value ? 'inherit' : '#CCC', display: 'inline-block', minWidth: 24, textAlign: align }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F0EEE8' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {value || '—'}
      </span>
    )

  const InlineNum = ({ field, value }: { field: string; value: number }) =>
    isActive(field) ? (
      <input
        autoFocus
        type="number"
        min={0}
        defaultValue={value}
        onBlur={e => onCommitCell(field, e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onCommitCell(field, (e.target as HTMLInputElement).value)
          if (e.key === 'Escape') onCancelEdit()
        }}
        style={{ ...INPUT, width: 100, textAlign: 'right' }}
      />
    ) : (
      <span
        onClick={() => onEditCell(field)}
        title="Click para editar"
        style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 3, display: 'inline-block', textAlign: 'right', minWidth: 60, fontVariantNumeric: 'tabular-nums' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F0EEE8' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        € {fmtE.format(value)}
      </span>
    )

  const InlineDate = ({ field, value }: { field: string; value: string | null }) =>
    isActive(field) ? (
      <input
        autoFocus
        type="date"
        defaultValue={value ?? ''}
        onBlur={e => onCommitCell(field, e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onCommitCell(field, (e.target as HTMLInputElement).value)
          if (e.key === 'Escape') onCancelEdit()
        }}
        style={{ ...INPUT, width: 130 }}
      />
    ) : (
      <span
        onClick={() => onEditCell(field)}
        title="Click para editar"
        style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 3, color: value ? 'inherit' : '#CCC', display: 'inline-block', fontSize: 11 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F0EEE8' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {value ? formatDate(value) : '—'}
      </span>
    )

  return (
    <>
      <tr
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {/* Concepto */}
        <td style={{ ...TD }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={onToggleExpand}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 10, padding: '0 2px', flexShrink: 0 }}
            >
              {expanded ? '▾' : '▸'}
            </button>
            <InlineText field="concepto" value={factura.concepto} width={200} />
          </div>
        </td>
        {/* Destinatario */}
        {showClienteCol && (
          <td style={{ ...TD }}>
            <ClienteMultiSelect
              clientes={todosClientes}
              selectedIds={new Set(factura.clientes_ids)}
              onChange={onClientesChange}
              constructor={constructor}
              proveedorId={factura.proveedor_id}
              onProveedorChange={onProveedorChange}
              compact
            />
          </td>
        )}
        {/* N.º Factura */}
        <td style={{ ...TD }}><InlineText field="numero_factura" value={factura.numero_factura} width={110} /></td>
        {/* Monto */}
        <td style={{ ...TD, textAlign: 'right' }}><InlineNum field="monto" value={factura.monto} /></td>
        {/* Fecha acordada */}
        <td style={{ ...TD, textAlign: 'center' }}><InlineDate field="fecha_pago_acordada" value={factura.fecha_pago_acordada} /></td>
        {/* Fecha emisión */}
        <td style={{ ...TD, textAlign: 'center' }}><InlineDate field="fecha_emision" value={factura.fecha_emision} /></td>
        {/* Fecha cobro */}
        <td style={{ ...TD, textAlign: 'center' }}><InlineDate field="fecha_cobro" value={factura.fecha_cobro} /></td>
        {/* Status */}
        <td style={{ ...TD, textAlign: 'center' }}>
          {editingStatus === factura.id ? (
            <select
              autoFocus
              defaultValue={factura.status}
              onChange={e => onCommitStatus(e.target.value)}
              onBlur={() => onCancelStatus()}
              style={{ ...INPUT, cursor: 'pointer', fontSize: 11 }}
            >
              {STATUS_ORDER.map(s => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <span
                onClick={onEditStatus}
                title="Click para cambiar estado"
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: meta.color, background: meta.bg, padding: '3px 8px', borderRadius: 4,
                  cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-block',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.75' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
              >
                {meta.label}
              </span>
              {factura.status === 'cobrable' && (
                factura.factura_emitida_id ? (
                  <button
                    onClick={() => rowRouter.push('/team/finanzas/facturacion/emitidas')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#378ADD', padding: 0, whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
                  >
                    → Ver borrador
                  </button>
                ) : (
                  <button
                    onClick={() => rowRouter.push(`/team/finanzas/facturacion/emitidas?from=${factura.id}`)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#D85A30', padding: 0, whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
                  >
                    → Revisión final
                  </button>
                )
              )}
            </div>
          )}
        </td>
        {/* Delete */}
        <td style={{ ...TD, textAlign: 'center', padding: '0 8px' }}>
          <button
            onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DDD', fontSize: 15, padding: '4px 6px', borderRadius: 3 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#DDD' }}
          >
            ×
          </button>
        </td>
      </tr>
      {/* Expanded row */}
      {expanded && (
        <tr style={{ background: '#FAFAF8' }}>
          <td colSpan={showClienteCol ? 9 : 8} style={{ padding: '10px 16px 14px 44px', borderBottom: '1px solid #F0EEE8' }}>
            {/* Cobrable actions banner */}
            {factura.status === 'cobrable' && !factura.factura_emitida_id && (
              <div style={{ marginBottom: 12, padding: '12px 16px', background: '#EBF4FF', border: '1px solid #BFDBFE', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1D4ED8', flex: 1 }}>
                  Esta factura ha llegado a su fecha de cobro. ¿Qué deseas hacer?
                </span>
                <button
                  onClick={onEmitir}
                  disabled={emitiendo}
                  style={{ height: 32, padding: '0 16px', background: emitiendo ? '#888' : '#D85A30', color: '#fff', border: 'none', borderRadius: 5, cursor: emitiendo ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', opacity: emitiendo ? 0.7 : 1 }}
                >
                  {emitiendo ? 'Creando borrador…' : '→ Emitir factura'}
                </button>
                <AplazarInline onAplazar={onAplazar} />
              </div>
            )}
            {factura.status === 'cobrable' && factura.factura_emitida_id && (
              <div style={{ marginBottom: 12, padding: '8px 14px', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 6, fontSize: 11, color: '#065F46', fontWeight: 500 }}>
                ✓ Factura emitida — borrador creado en Facturas emitidas
              </div>
            )}
            {/* Notas */}
            <div>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#AAA', letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 8 }}>Notas:</span>
              {isActive('notas') ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={factura.notas ?? ''}
                  onBlur={e => onCommitCell('notas', e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') onCommitCell('notas', (e.target as HTMLInputElement).value)
                    if (e.key === 'Escape') onCancelEdit()
                  }}
                  style={{ ...INPUT, width: 400 }}
                />
              ) : (
                <span
                  onClick={() => onEditCell('notas')}
                  style={{ fontSize: 12, color: factura.notas ? '#444' : '#CCC', cursor: 'pointer' }}
                >
                  {factura.notas || 'Click para añadir notas'}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Aplazar Inline ────────────────────────────────────────────────────────────

function AplazarInline({ onAplazar }: { onAplazar: (date: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ height: 32, padding: '0 14px', background: 'none', border: '1px solid #93C5FD', borderRadius: 5, cursor: 'pointer', fontSize: 11, color: '#1D4ED8', whiteSpace: 'nowrap' }}
      >
        Aplazar fecha
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        ref={ref}
        autoFocus
        type="date"
        style={{ ...INPUT, width: 140, height: 32 }}
      />
      <button
        onClick={() => { onAplazar(ref.current?.value ?? ''); setOpen(false) }}
        style={{ height: 32, padding: '0 12px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
      >
        Guardar
      </button>
      <button
        onClick={() => setOpen(false)}
        style={{ height: 32, padding: '0 10px', background: 'none', border: '1px solid #93C5FD', borderRadius: 5, cursor: 'pointer', fontSize: 11, color: '#888' }}
      >
        ×
      </button>
    </div>
  )
}

// ── Add Form ──────────────────────────────────────────────────────────────────

function AddFacturaForm({
  clientes, constructor, onConfirm, onCancel,
}: {
  clientes: ClienteInfo[]
  constructor: ConstructorInfo | null
  onConfirm: (data: { concepto: string; monto: string; fecha_pago_acordada: string; clientes_ids: string[]; proveedor_id: string | null }) => void
  onCancel: () => void
}) {
  const concRef  = useRef<HTMLInputElement>(null)
  const montRef  = useRef<HTMLInputElement>(null)
  const fechaRef = useRef<HTMLInputElement>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(clientes.length === 1 ? [clientes[0].id] : [])
  )
  const [selectedProveedorId, setSelectedProveedorId] = useState<string | null>(null)

  const showSelector = clientes.length > 1 || !!constructor

  return (
    <div style={{ padding: '12px 16px', background: '#FFF8F0', borderTop: '1px solid #F0EEE8', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input ref={concRef}  autoFocus placeholder="Concepto"        style={{ ...INPUT, flex: 1, minWidth: 160 }} />
      <input ref={montRef}  type="number" min={0} placeholder="Monto €" style={{ ...INPUT, width: 110 }} />
      <input ref={fechaRef} type="date"  placeholder="Fecha acordada" style={{ ...INPUT, width: 140 }} />

      {showSelector && (
        <ClienteMultiSelect
          clientes={clientes}
          selectedIds={selectedIds}
          onChange={ids => { setSelectedIds(new Set(ids)); setSelectedProveedorId(null) }}
          constructor={constructor}
          proveedorId={selectedProveedorId}
          onProveedorChange={id => { setSelectedProveedorId(id); setSelectedIds(new Set()) }}
        />
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onConfirm({
            concepto:            concRef.current?.value  ?? '',
            monto:               montRef.current?.value  ?? '0',
            fecha_pago_acordada: fechaRef.current?.value ?? '',
            clientes_ids:        selectedProveedorId ? [] : Array.from(selectedIds),
            proveedor_id:        selectedProveedorId,
          })}
          style={{ background: '#D85A30', border: 'none', borderRadius: 5, cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 14px' }}
        >
          Añadir
        </button>
        <button
          onClick={onCancel}
          style={{ background: 'none', border: '1px solid #E8E6E0', borderRadius: 5, cursor: 'pointer', color: '#888', fontSize: 12, padding: '6px 12px' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Cliente Field ─────────────────────────────────────────────────────────────

function ClienteField({ label, value, editing, onCommit }: { label: string; value: string; editing: boolean; onCommit: (v: string) => void }) {
  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 4px' }}>
        {label}
      </p>
      {editing ? (
        <input
          type="text"
          defaultValue={value}
          onBlur={e => onCommit(e.target.value)}
          style={{ ...INPUT, width: '100%' }}
        />
      ) : (
        <p style={{ fontSize: 12, color: value ? '#1A1A1A' : '#CCC', margin: 0 }}>
          {value || '—'}
        </p>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SummaryBox({ label, value, accent, color, last }: { label: string; value: string; accent?: boolean; color?: string; last?: boolean }) {
  return (
    <div className="fpdet-summary-box" style={{ flex: 1, padding: '16px 22px', borderRight: last ? 'none' : '1px solid #E8E6E0', background: '#fff' }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#BBB', margin: '0 0 5px' }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 300, color: color ?? (accent ? '#D85A30' : '#1A1A1A'), margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
    </div>
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
