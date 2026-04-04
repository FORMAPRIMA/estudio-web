'use client'

import React, { useState, useMemo, useTransition, useRef, useEffect, useCallback, memo } from 'react'
import {
  updateFacturaEmitidaEstado,
  deleteFacturaEmitida,
  updateEstudioConfig,
  getClientesDelProyecto,
  type FacturaItem,
  type CreateFacturaInput,
  type ClienteDelProyecto,
} from '@/app/actions/facturasEmitidas'
import type { ExtraEmail } from '@/app/actions/emitirFactura'
import { calcTotals } from '@/lib/facturasUtils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FacturaEmitida {
  id:               string
  numero_completo:  string
  fecha_emision:    string
  cliente_nombre:   string
  cliente_nif:      string | null
  proyecto_nombre:  string | null
  base_imponible:   number
  cuota_iva:        number
  tipo_irpf:        number | null
  cuota_irpf:       number | null
  total:            number
  estado:           string
  es_rectificativa: boolean
  created_at:       string
}

interface Cliente {
  id: string; nombre: string; apellidos: string | null
  empresa: string | null; nif_cif: string | null
  direccion_facturacion: string | null; email: string | null; email_cc: string | null
}

interface Proyecto {
  id: string; nombre: string; codigo: string | null; direccion: string | null
}

interface EstudioConfig {
  nombre: string; nif: string | null; direccion: string | null
  ciudad: string | null; codigo_postal: string | null
  pais: string | null; email: string | null
  telefono: string | null; iban: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ESTADO_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  borrador: { bg: '#F0EEE8', color: '#888', label: 'Borrador' },
  enviada:  { bg: '#EBF4FF', color: '#378ADD', label: 'Enviada' },
  pagada:   { bg: '#ECFDF5', color: '#1D9E75', label: 'Pagada' },
  anulada:  { bg: '#FEF2F2', color: '#DC2626', label: 'Anulada' },
}

const IVA_OPTS = [21, 10, 4, 0]
const IRPF_OPTS = [null, 7, 15, 19]

// ── Formatters ────────────────────────────────────────────────────────────────

function eur(n: number) {
  return `€ ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function clienteLabel(c: Cliente) {
  const name = [c.nombre, c.apellidos].filter(Boolean).join(' ')
  return c.empresa ? `${name} — ${c.empresa}` : name
}

// ── ClienteCombobox ───────────────────────────────────────────────────────────

const ClienteCombobox = memo(function ClienteCombobox({
  clientes, value, onChange,
}: {
  clientes: Cliente[]; value: string; onChange: (id: string, c: Cliente | null) => void
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const ref               = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLInputElement>(null)
  const selected          = clientes.find(c => c.id === value) ?? null

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return clientes
    return clientes.filter(c =>
      [c.nombre, c.apellidos, c.empresa, c.nif_cif]
        .some(v => v?.toLowerCase().includes(q))
    )
  }, [query, clientes])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
        style={{ width: '100%', height: 34, padding: '0 10px', border: '1px solid #E8E6E0', background: '#fff', textAlign: 'left', fontSize: 12, color: selected ? '#1A1A1A' : '#AAA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? clienteLabel(selected) : 'Seleccionar cliente…'}
        </span>
        <span style={{ color: '#AAA', marginLeft: 6, flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 2, zIndex: 50, background: '#fff', border: '1px solid #C8C5BE', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', maxHeight: 240 }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #EDEAE4' }}>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
              placeholder="Buscar por nombre, empresa, NIF…"
              style={{ width: '100%', fontSize: 12, border: 'none', outline: 'none', background: 'transparent', color: '#1A1A1A' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <button type="button" onClick={() => { onChange('', null); setOpen(false); setQuery('') }}
              style={{ width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: 11, color: '#AAA', background: 'none', border: 'none', borderBottom: '1px solid #F5F3EE', cursor: 'pointer' }}>
              — Sin cliente seleccionado —
            </button>
            {filtered.map(c => (
              <button key={c.id} type="button"
                onClick={() => { onChange(c.id, c); setOpen(false); setQuery('') }}
                style={{ width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 12, background: c.id === value ? '#F8F6F1' : 'none', border: 'none', borderBottom: '1px solid #F5F3EE', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ color: '#1A1A1A' }}>{[c.nombre, c.apellidos].filter(Boolean).join(' ')}</span>
                {(c.empresa || c.nif_cif) && (
                  <span style={{ fontSize: 10, color: '#888' }}>
                    {[c.empresa, c.nif_cif].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p style={{ padding: '12px 10px', fontSize: 11, color: '#CCC' }}>Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

// ── ProyectoCombobox ──────────────────────────────────────────────────────────

const ProyectoCombobox = memo(function ProyectoCombobox({
  proyectos, value, onChange,
}: {
  proyectos: Proyecto[]; value: string; onChange: (id: string, p: Proyecto | null) => void
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const ref               = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLInputElement>(null)
  const selected          = proyectos.find(p => p.id === value) ?? null

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return proyectos
    return proyectos.filter(p =>
      [p.nombre, p.codigo].some(v => v?.toLowerCase().includes(q))
    )
  }, [query, proyectos])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
        style={{ width: '100%', height: 34, padding: '0 10px', border: '1px solid #E8E6E0', background: '#fff', textAlign: 'left', fontSize: 12, color: selected ? '#1A1A1A' : '#AAA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <span>{selected ? `${selected.codigo ? selected.codigo + ' · ' : ''}${selected.nombre}` : 'Proyecto asociado (opcional)…'}</span>
        <span style={{ color: '#AAA', marginLeft: 6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 2, zIndex: 50, background: '#fff', border: '1px solid #C8C5BE', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', maxHeight: 200 }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #EDEAE4' }}>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
              placeholder="Buscar proyecto…"
              style={{ width: '100%', fontSize: 12, border: 'none', outline: 'none', background: 'transparent', color: '#1A1A1A' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <button type="button" onClick={() => { onChange('', null); setOpen(false); setQuery('') }}
              style={{ width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: 11, color: '#AAA', background: 'none', border: 'none', borderBottom: '1px solid #F5F3EE', cursor: 'pointer' }}>
              — Sin proyecto —
            </button>
            {filtered.map(p => (
              <button key={p.id} type="button"
                onClick={() => { onChange(p.id, p); setOpen(false); setQuery('') }}
                style={{ width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 12, background: p.id === value ? '#F8F6F1' : 'none', border: 'none', borderBottom: '1px solid #F5F3EE', cursor: 'pointer' }}>
                <span style={{ color: '#888', marginRight: 6, fontSize: 10 }}>{p.codigo}</span>
                <span style={{ color: '#1A1A1A' }}>{p.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

// ── ItemsTable ────────────────────────────────────────────────────────────────

const ItemsTable = memo(function ItemsTable({
  items, onChange,
}: {
  items: FacturaItem[]; onChange: (items: FacturaItem[]) => void
}) {
  const update = (i: number, field: keyof FacturaItem, val: string) => {
    const next = items.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [field]: field === 'descripcion' ? val : Number(val) || 0 }
      if (field === 'cantidad' || field === 'precio_unitario') {
        updated.subtotal = Math.round(updated.cantidad * updated.precio_unitario * 100) / 100
      }
      return updated
    })
    onChange(next)
  }

  const addRow = () => onChange([...items, { descripcion: '', cantidad: 1, precio_unitario: 0, subtotal: 0 }])
  const removeRow = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', height: 30, padding: '0 8px', fontSize: 12,
    border: '1px solid #E8E6E0', outline: 'none', background: '#fff',
    fontFamily: 'inherit', color: '#1A1A1A', ...style,
  })

  return (
    <div>
      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 110px 28px', gap: 4, marginBottom: 4 }}>
        {['Descripción del servicio / concepto', 'Cant.', 'Precio unit.', 'Subtotal', ''].map((h, i) => (
          <p key={i} style={{ fontSize: 9, fontWeight: 700, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>{h}</p>
        ))}
      </div>
      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 110px 28px', gap: 4 }}>
            <input value={item.descripcion} onChange={e => update(i, 'descripcion', e.target.value)}
              placeholder="Ej. Honorarios anteproyecto" style={inp()} />
            <input type="number" value={item.cantidad || ''} onChange={e => update(i, 'cantidad', e.target.value)}
              min={0} style={inp({ textAlign: 'right' })} />
            <input type="number" value={item.precio_unitario || ''} onChange={e => update(i, 'precio_unitario', e.target.value)}
              min={0} step={0.01} style={inp({ textAlign: 'right' })} />
            <div style={{ ...inp({ background: '#F8F7F4', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' } as React.CSSProperties) }}>
              {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.subtotal)}
            </div>
            <button type="button" onClick={() => removeRow(i)}
              style={{ height: 30, background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#CCC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}>×</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow}
        style={{ marginTop: 8, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, color: '#AAA', background: 'none', border: '1px dashed #E8E6E0', padding: '6px 14px', cursor: 'pointer', width: '100%' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D85A30'; (e.currentTarget as HTMLElement).style.borderColor = '#D85A30' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA'; (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0' }}>
        + Añadir línea
      </button>
    </div>
  )
})

// ── TotalsPreview ─────────────────────────────────────────────────────────────

const TotalsPreview = memo(function TotalsPreview({
  items, tipoIva, tipoIrpf,
}: {
  items: FacturaItem[]; tipoIva: number; tipoIrpf: number | null
}) {
  const t = calcTotals(items, tipoIva, tipoIrpf)
  return (
    <div style={{ background: '#F8F7F4', border: '1px solid #E8E6E0', padding: '16px 20px', minWidth: 240 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#888' }}>Base imponible</span>
        <span style={{ fontSize: 11, color: '#1A1A1A', fontWeight: 500 }}>{eur(t.base_imponible)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#888' }}>IVA ({tipoIva}%)</span>
        <span style={{ fontSize: 11, color: '#1A1A1A' }}>{eur(t.cuota_iva)}</span>
      </div>
      {tipoIrpf && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#888' }}>IRPF (-{tipoIrpf}%)</span>
          <span style={{ fontSize: 11, color: '#DC2626' }}>-{eur(t.cuota_irpf)}</span>
        </div>
      )}
      <div style={{ borderTop: '1px solid #E8E6E0', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>Total a pagar</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#D85A30' }}>{eur(t.total)}</span>
      </div>
    </div>
  )
})

// ── CreateModal ───────────────────────────────────────────────────────────────

function CreateModal({
  clientes, proyectos, estudioConfig, prefill, onCreated, onClose,
}: {
  clientes: Cliente[]
  proyectos: Proyecto[]
  estudioConfig: EstudioConfig | null
  prefill: PrefillData | null
  onCreated: () => void
  onClose: () => void
}) {
  const [, startTransition] = useTransition()
  const today = new Date().toISOString().split('T')[0]

  // Emisor — always from estudioConfig (editable in /facturacion/empresa)
  const emisorNombre    = estudioConfig?.nombre         ?? ''
  const emisorNif       = estudioConfig?.nif            ?? ''
  const emisorDireccion = estudioConfig?.direccion      ?? ''
  const emisorCiudad    = estudioConfig?.ciudad         ?? null
  const emisorCp        = estudioConfig?.codigo_postal  ?? null
  const emisorEmail     = estudioConfig?.email          ?? null
  const emisorTelefono  = estudioConfig?.telefono       ?? null

  // Factura meta
  const [serie,          setSerie]          = useState('F')
  const [fechaEmision,   setFechaEmision]   = useState(today)
  const [fechaOperacion, setFechaOperacion] = useState('')

  // Cliente — from prefill or empty
  const [clienteId,        setClienteId]        = useState(prefill?.clienteId        ?? '')
  const [clienteContacto,  setClienteContacto]  = useState(prefill?.clienteContacto  ?? '')
  const [clienteEmpresa,   setClienteEmpresa]   = useState(prefill?.clienteEmpresa   ?? '')
  const [clienteNif,       setClienteNif]        = useState(prefill?.clienteNif       ?? '')
  const [clienteDireccion, setClienteDireccion]  = useState(prefill?.clienteDireccion ?? '')

  // Proyecto
  const [proyectoId,        setProyectoId]        = useState(prefill?.proyectoId        ?? '')
  const [proyectoNombre,    setProyectoNombre]    = useState(prefill?.proyectoNombre    ?? '')
  const [proyectoDireccion, setProyectoDireccion] = useState(prefill?.proyectoDireccion ?? '')

  // Items — if prefill, create a single line with the contract amount (append address if available)
  const [items, setItems] = useState<FacturaItem[]>(() => {
    if (!prefill) return [{ descripcion: '', cantidad: 1, precio_unitario: 0, subtotal: 0 }]
    const desc = prefill.proyectoDireccion
      ? `${prefill.concepto} — ${prefill.proyectoDireccion}`
      : prefill.concepto
    return [{ descripcion: desc, cantidad: 1, precio_unitario: prefill.monto, subtotal: prefill.monto }]
  })

  // Impuestos
  const [tipoIva,  setTipoIva]  = useState(21)
  const [tipoIrpf, setTipoIrpf] = useState<number | null>(null)

  // Pago / notas
  const [iban,             setIban]             = useState(prefill?.iban ?? estudioConfig?.iban ?? '')
  const [formaPago,        setFormaPago]        = useState('Transferencia bancaria')
  const [condicionesPago,  setCondicionesPago]  = useState('')
  const [notas,            setNotas]            = useState('')
  const [mencionLegal,     setMencionLegal]     = useState('')

  // Rectificativa
  const [esRectificativa,     setEsRectificativa]     = useState(false)
  const [facturaOriginalNum,  setFacturaOriginalNum]  = useState('')
  const [motivoRectificacion, setMotivoRectificacion] = useState('')

  const [loading,         setLoading]         = useState(false)
  const [previewing,      setPreviewing]      = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  const [emailCliente,    setEmailCliente]    = useState(prefill?.clienteEmail   ?? '')
  const [emailClienteCC,  setEmailClienteCC]  = useState(prefill?.clienteEmailCC ?? '')
  const [extraEmails,     setExtraEmails]     = useState<ExtraEmail[]>([])
  const [proyectoClientes, setProyectoClientes] = useState<ClienteDelProyecto[]>([])
  const [includeCTA,   setIncludeCTA]   = useState(false)

  const handleClienteChange = useCallback((id: string, c: Cliente | null) => {
    setClienteId(id)
    if (c) {
      setClienteContacto([c.nombre, c.apellidos].filter(Boolean).join(' '))
      setClienteEmpresa(c.empresa ?? '')
      setClienteNif(c.nif_cif ?? '')
      setClienteDireccion(c.direccion_facturacion ?? '')
      setEmailCliente(c.email ?? '')
      setEmailClienteCC(c.email_cc ?? '')
    } else {
      setClienteContacto(''); setClienteEmpresa(''); setClienteNif(''); setClienteDireccion('')
      setEmailCliente(''); setEmailClienteCC('')
    }
  }, [])

  const handleProyectoChange = useCallback((id: string, p: Proyecto | null) => {
    setProyectoId(id)
    setProyectoNombre(p ? `${p.codigo ? p.codigo + ' · ' : ''}${p.nombre}` : '')
    const dir = p?.direccion ?? ''
    setProyectoDireccion(dir)
    if (dir) {
      setItems(prev => prev.map((item, i) =>
        i === 0 && item.descripcion
          ? { ...item, descripcion: item.descripcion.replace(/ — .*$/, '') + ` — ${dir}` }
          : item
      ))
    }
    if (id) {
      getClientesDelProyecto(id).then(setProyectoClientes)
    } else {
      setProyectoClientes([])
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emisorNombre.trim()) { setError('Configura primero los datos de empresa en Facturación → Información empresa.'); return }
    const clienteNombre = clienteEmpresa.trim() || clienteContacto.trim()
    if (!clienteNombre) { setError('El nombre del cliente o razón social es obligatorio.'); return }
    if (items.every(i => i.subtotal === 0)) { setError('Añade al menos una línea con importe.'); return }
    if (!emailCliente.trim()) { setError('Introduce el email del cliente para el envío.'); return }

    setLoading(true); setError(null)
    const input: CreateFacturaInput = {
      serie, fecha_emision: fechaEmision,
      fecha_operacion: fechaOperacion || null,
      emisor_nombre: emisorNombre, emisor_nif: emisorNif,
      emisor_direccion: emisorDireccion, emisor_ciudad: emisorCiudad || null,
      emisor_cp: emisorCp || null, emisor_email: emisorEmail || null,
      emisor_telefono: emisorTelefono || null,
      cliente_id: clienteId || null, cliente_nombre: clienteNombre,
      cliente_contacto: clienteEmpresa.trim() ? clienteContacto.trim() || null : null,
      cliente_nif: clienteNif || null, cliente_direccion: clienteDireccion || null,
      proyecto_id: proyectoId || null, proyecto_nombre: proyectoNombre || null,
      items, tipo_iva: tipoIva, tipo_irpf: tipoIrpf,
      notas: notas || null, mencion_legal: mencionLegal || null,
      iban: iban || null, forma_pago: formaPago || null,
      condiciones_pago: condicionesPago || null,
      es_rectificativa: esRectificativa,
      factura_original_id: null,
      motivo_rectificacion: motivoRectificacion || null,
      factura_origen_id: prefill?.facturaOrigenId ?? null,
    }

    const res = await fetch('/api/facturas-emitidas/emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input, emailCliente, includeCTA,
        clientesAdicionales: proyectoClientes
          .filter(c => c.id !== clienteId)
          .map(c => ({
            nombre:    c.nombre,
            apellidos: c.apellidos,
            email:     c.email,
            email_cc:  c.email_cc,
          })),
        extraEmails: [
          ...(emailClienteCC.trim() ? [{ email: emailClienteCC.trim(), tipo: 'cc' as const }] : []),
          ...extraEmails,
        ],
      }),
    })
    const result = await res.json()
    setLoading(false)
    if (!res.ok || 'error' in result) { setError(result.error ?? 'Error desconocido'); return }
    onCreated()
  }

  const handlePreview = async () => {
    setPreviewing(true)
    setError(null)
    const clienteNombre = clienteEmpresa.trim() || clienteContacto.trim()
    const totals = calcTotals(items, tipoIva, tipoIrpf)
    const body: Record<string, unknown> = {
      numero_completo:  'BORRADOR',
      serie,
      fecha_emision:    fechaEmision,
      fecha_operacion:  fechaOperacion || null,
      emisor_nombre:    emisorNombre,
      emisor_nif:       emisorNif,
      emisor_direccion: emisorDireccion,
      emisor_ciudad:    emisorCiudad   ?? null,
      emisor_cp:        emisorCp       ?? null,
      emisor_email:     emisorEmail    ?? null,
      emisor_telefono:  emisorTelefono ?? null,
      cliente_nombre:   clienteNombre || 'Cliente por definir',
      cliente_contacto: clienteEmpresa.trim() ? clienteContacto.trim() || null : null,
      cliente_nif:      clienteNif      || null,
      cliente_direccion: clienteDireccion || null,
      proyecto_nombre:  proyectoNombre   || null,
      items,
      tipo_iva:         tipoIva,
      tipo_irpf:        tipoIrpf,
      base_imponible:   totals.base_imponible,
      cuota_iva:        totals.cuota_iva,
      cuota_irpf:       totals.cuota_irpf,
      total:            totals.total,
      notas:            notas            || null,
      mencion_legal:    mencionLegal     || null,
      iban:             iban             || null,
      forma_pago:       formaPago        || null,
      condiciones_pago: condicionesPago  || null,
      es_rectificativa: esRectificativa,
      factura_original_numero: facturaOriginalNum || null,
      motivo_rectificacion:    motivoRectificacion || null,
    }
    try {
      const res = await fetch('/api/facturas-emitidas/preview-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error generando preview' }))
        setError(err.error ?? 'Error generando preview')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Revoke after a short delay so the new tab has time to load it
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } finally {
      setPreviewing(false)
    }
  }

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', height: 34, padding: '0 10px', fontSize: 12, border: '1px solid #E8E6E0',
    outline: 'none', background: '#fff', fontFamily: 'inherit', color: '#1A1A1A', ...style,
  })
  const label = (style?: React.CSSProperties): React.CSSProperties => ({
    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: '#AAA', marginBottom: 4, display: 'block', ...style,
  })
  const section = (style?: React.CSSProperties): React.CSSProperties => ({
    marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid #F0EEE8', ...style,
  })
  const sectionTitle = (): React.CSSProperties => ({
    fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: '#D85A30', marginBottom: 14,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
      <div style={{ width: '100%', maxWidth: 700, height: '100vh', background: '#FAFAF8', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #E8E6E0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10, color: prefill ? '#D85A30' : '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
              {prefill ? 'Revisión final · Pre-rellena desde contrato' : 'Nueva factura'}
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>Emitir factura</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#AAA', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Form */}
        <form id="factura-form" onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 0' }}>

          {/* ── Identificación ────────────────────────────── */}
          <div style={section()}>
            <p style={sectionTitle()}>Identificación</p>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 12 }}>
              <div>
                <span style={label()}>Serie</span>
                <input value={serie} onChange={e => setSerie(e.target.value.toUpperCase().slice(0, 5))}
                  style={inp({ fontFamily: 'monospace', letterSpacing: 2 })} maxLength={5} />
              </div>
              <div>
                <span style={label()}>Fecha de emisión *</span>
                <input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} style={inp()} />
              </div>
              <div>
                <span style={label()}>Fecha de operación <span style={{ fontWeight: 400 }}>(si difiere)</span></span>
                <input type="date" value={fechaOperacion} onChange={e => setFechaOperacion(e.target.value)} style={inp()} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={esRectificativa} onChange={e => setEsRectificativa(e.target.checked)} />
              <span style={{ fontSize: 12, color: '#555' }}>Es una factura rectificativa</span>
            </label>
            {esRectificativa && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <span style={label()}>Nº factura original</span>
                  <input value={facturaOriginalNum} onChange={e => setFacturaOriginalNum(e.target.value)}
                    placeholder="F-24" style={inp()} />
                </div>
                <div>
                  <span style={label()}>Motivo rectificación</span>
                  <input value={motivoRectificacion} onChange={e => setMotivoRectificacion(e.target.value)}
                    placeholder="Descripción del motivo" style={inp()} />
                </div>
              </div>
            )}
          </div>

          {/* ── Emisor (read-only chip) ──────────────────── */}
          <div style={{ ...section(), paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={sectionTitle()}>Emisor</p>
              <a href="/team/finanzas/facturacion/empresa" target="_blank"
                style={{ fontSize: 10, color: '#AAA', textDecoration: 'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D85A30' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}>
                Editar datos empresa →
              </a>
            </div>
            <div style={{ background: '#F8F7F4', border: '1px solid #E8E6E0', borderRadius: 6, padding: '12px 16px', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#AAA', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>Razón social</p>
                <p style={{ fontSize: 12, color: '#1A1A1A', margin: 0, fontWeight: 500 }}>{emisorNombre || <span style={{ color: '#CCC' }}>Sin configurar</span>}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#AAA', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>NIF / CIF</p>
                <p style={{ fontSize: 12, color: '#1A1A1A', margin: 0, fontFamily: 'monospace' }}>{emisorNif || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#AAA', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>Dirección</p>
                <p style={{ fontSize: 12, color: '#1A1A1A', margin: 0 }}>{emisorDireccion || '—'}{emisorCiudad ? `, ${emisorCiudad}` : ''}</p>
              </div>
            </div>
          </div>

          {/* ── Cliente ───────────────────────────────────── */}
          <div style={section()}>
            <p style={sectionTitle()}>Datos del cliente</p>

            {/* Buscador */}
            <div style={{ marginBottom: 16 }}>
              <span style={label()}>Buscar cliente en base de datos</span>
              <ClienteCombobox clientes={clientes} value={clienteId} onChange={handleClienteChange} />
            </div>

            {/* Persona de contacto — siempre visible */}
            <div style={{ marginBottom: 14 }}>
              <span style={label()}>Persona de contacto *</span>
              <input
                value={clienteContacto}
                onChange={e => setClienteContacto(e.target.value)}
                placeholder="Nombre y apellidos"
                style={inp()}
              />
            </div>

            {/* Persona jurídica — aparece si hay empresa o si se escribe */}
            <div style={{ background: '#F8F7F4', border: '1px solid #EDEAE4', borderRadius: 6, padding: '14px 16px' }}>
              <div style={{ marginBottom: 10 }}>
                <span style={label({ color: '#888' })}>Razón social <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(si persona jurídica)</span></span>
                <input
                  value={clienteEmpresa}
                  onChange={e => setClienteEmpresa(e.target.value)}
                  placeholder="Nombre empresa, S.L. — dejar vacío si persona física"
                  style={inp({ background: clienteEmpresa ? '#fff' : '#F8F7F4' })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={label()}>NIF / CIF</span>
                  <input
                    value={clienteNif}
                    onChange={e => setClienteNif(e.target.value)}
                    placeholder={clienteEmpresa ? 'CIF de la empresa' : 'DNI / NIF'}
                    style={inp()}
                  />
                </div>
                <div>
                  <span style={label()}>Dirección fiscal</span>
                  <input
                    value={clienteDireccion}
                    onChange={e => setClienteDireccion(e.target.value)}
                    placeholder="Calle, número, ciudad"
                    style={inp()}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Proyecto (opcional) ───────────────────────── */}
          <div style={section()}>
            <p style={sectionTitle()}>Proyecto asociado <span style={{ color: '#AAA', fontWeight: 400 }}>(opcional)</span></p>
            <ProyectoCombobox proyectos={proyectos} value={proyectoId} onChange={handleProyectoChange} />
          </div>

          {/* ── Conceptos / Líneas ────────────────────────── */}
          <div style={section()}>
            <p style={sectionTitle()}>Conceptos facturados</p>
            <ItemsTable items={items} onChange={setItems} />
          </div>

          {/* ── Impuestos ─────────────────────────────────── */}
          <div style={section()}>
            <p style={sectionTitle()}>Impuestos</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <span style={label()}>Tipo IVA</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {IVA_OPTS.map(v => (
                    <button key={v} type="button" onClick={() => setTipoIva(v)}
                      style={{ flex: 1, height: 34, fontSize: 12, border: `1px solid ${tipoIva === v ? '#D85A30' : '#E8E6E0'}`, background: tipoIva === v ? '#FDF0EC' : '#fff', color: tipoIva === v ? '#D85A30' : '#888', cursor: 'pointer', fontWeight: tipoIva === v ? 600 : 400 }}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span style={label()}>Retención IRPF <span style={{ fontWeight: 400 }}>(autónomos)</span></span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {IRPF_OPTS.map(v => (
                    <button key={String(v)} type="button" onClick={() => setTipoIrpf(v)}
                      style={{ flex: 1, height: 34, fontSize: 12, border: `1px solid ${tipoIrpf === v ? '#D85A30' : '#E8E6E0'}`, background: tipoIrpf === v ? '#FDF0EC' : '#fff', color: tipoIrpf === v ? '#D85A30' : '#888', cursor: 'pointer', fontWeight: tipoIrpf === v ? 600 : 400 }}>
                      {v === null ? 'No' : `-${v}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <TotalsPreview items={items} tipoIva={tipoIva} tipoIrpf={tipoIrpf} />
            </div>
          </div>

          {/* ── Pago ──────────────────────────────────────── */}
          <div style={section()}>
            <p style={sectionTitle()}>Forma de pago</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span style={label()}>IBAN</span>
                <input value={iban} onChange={e => setIban(e.target.value)}
                  placeholder="ES00 0000 0000 0000 0000 0000" style={inp({ fontFamily: 'monospace', fontSize: 11 })} />
              </div>
              <div>
                <span style={label()}>Forma de pago</span>
                <input value={formaPago} onChange={e => setFormaPago(e.target.value)} style={inp()} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={label()}>Condiciones de pago</span>
                <input value={condicionesPago} onChange={e => setCondicionesPago(e.target.value)}
                  placeholder="Ej. Pago a 30 días desde la fecha de emisión" style={inp()} />
              </div>
            </div>
          </div>

          {/* ── Notas y menciones legales ─────────────────── */}
          <div style={{ ...section(), borderBottom: 'none' }}>
            <p style={sectionTitle()}>Notas y menciones legales</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={label()}>Observaciones</span>
                <textarea value={notas} onChange={e => setNotas(e.target.value)}
                  rows={2} placeholder="Notas adicionales visibles en la factura"
                  style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0', outline: 'none', fontFamily: 'inherit', resize: 'vertical', background: '#fff', color: '#1A1A1A', boxSizing: 'border-box' }} />
              </div>
              <div>
                <span style={label()}>Mención legal <span style={{ fontWeight: 400 }}>(exención IVA, inversión sujeto pasivo, etc.)</span></span>
                <textarea value={mencionLegal} onChange={e => setMencionLegal(e.target.value)}
                  rows={2} placeholder="Ej. Exento de IVA según artículo 20.Uno.1º Ley 37/1992"
                  style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0', outline: 'none', fontFamily: 'inherit', resize: 'vertical', background: '#fff', color: '#1A1A1A', boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>

          {/* ── Envío al cliente ────────────────────────────────────── */}
          <div style={section({ borderBottom: 'none', marginBottom: 0 })}>
            <p style={sectionTitle()}>Envío al cliente</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Email principal */}
              <div>
                <span style={label()}>Email principal del cliente <span style={{ color: '#DC2626' }}>*</span></span>
                <input
                  type="email"
                  value={emailCliente}
                  onChange={e => setEmailCliente(e.target.value)}
                  placeholder="cliente@empresa.com"
                  style={inp()}
                />
              </div>

              {/* Email secundario (CC) del cliente seleccionado */}
              {emailClienteCC && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F8F7F4', border: '1px solid #F0EEE8' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', flexShrink: 0 }}>CC</span>
                  <span style={{ fontSize: 11, color: '#555', flex: 1 }}>{emailClienteCC}</span>
                  <span style={{ fontSize: 9, color: '#AAA' }}>Correo secundario de la ficha · se incluirá en copia</span>
                </div>
              )}

              {/* Otros clientes del proyecto */}
              {proyectoClientes.filter(c => c.id !== clienteId).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#D85A30', display: 'block', marginBottom: 2 }}>
                    Otros clientes del proyecto · se incluirán automáticamente
                  </span>
                  {proyectoClientes.filter(c => c.id !== clienteId).map(c => {
                    const nombre = [c.nombre, c.apellidos].filter(Boolean).join(' ')
                    return (
                      <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 12px', background: '#FDF3EE', border: '1px solid #F5DACE' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A' }}>{nombre}</span>
                        {c.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#AAA', flexShrink: 0, width: 16 }}>TO</span>
                            <span style={{ fontSize: 11, color: '#555' }}>{c.email}</span>
                          </div>
                        )}
                        {c.email_cc && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#AAA', flexShrink: 0, width: 16 }}>CC</span>
                            <span style={{ fontSize: 11, color: '#555' }}>{c.email_cc}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Emails adicionales */}
              {extraEmails.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={label()}>Correos adicionales</span>
                  {extraEmails.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="email"
                        value={entry.email}
                        onChange={e => setExtraEmails(prev => prev.map((x, j) => j === i ? { ...x, email: e.target.value } : x))}
                        placeholder="email@ejemplo.com"
                        style={{ ...inp(), flex: 1 }}
                      />
                      <select
                        value={entry.tipo}
                        onChange={e => setExtraEmails(prev => prev.map((x, j) => j === i ? { ...x, tipo: e.target.value as ExtraEmail['tipo'] } : x))}
                        style={{ height: 34, padding: '0 8px', fontSize: 11, border: '1px solid #E8E6E0', background: '#fff', color: '#555', fontFamily: 'inherit', outline: 'none', borderRadius: 0, cursor: 'pointer', flexShrink: 0 }}
                      >
                        <option value="to">Para</option>
                        <option value="cc">CC</option>
                        <option value="bcc">CCO</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setExtraEmails(prev => prev.filter((_, j) => j !== i))}
                        style={{ width: 28, height: 34, background: 'none', border: '1px solid #E8E6E0', cursor: 'pointer', fontSize: 14, color: '#AAA', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Botón añadir */}
              <button
                type="button"
                onClick={() => setExtraEmails(prev => [...prev, { email: '', tipo: 'cc' }])}
                style={{ alignSelf: 'flex-start', height: 30, padding: '0 12px', background: 'none', border: '1px dashed #D0CEC9', cursor: 'pointer', fontSize: 11, color: '#888', letterSpacing: '0.04em' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D85A30'; (e.currentTarget as HTMLElement).style.color = '#D85A30' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D0CEC9'; (e.currentTarget as HTMLElement).style.color = '#888' }}
              >
                + Añadir correo
              </button>

              {/* Partners siempre en copia */}
              <div style={{ background: '#F8F7F4', border: '1px solid #F0EEE8', padding: '10px 12px' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block', marginBottom: 5 }}>
                  Siempre en copia
                </span>
                <span style={{ fontSize: 11, color: '#888' }}>
                  jlorag@formaprima.es &nbsp;·&nbsp; ghidalgo@formaprima.es
                </span>
              </div>

            </div>
          </div>

        </form>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #E8E6E0', background: '#fff', flexShrink: 0 }}>
          {/* CTA checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeCTA}
              onChange={e => setIncludeCTA(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: '#D85A30', cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ fontSize: 11, color: '#888', lineHeight: 1.4 }}>
              Activar invitación al área de cliente en el correo
            </span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          {error && <span style={{ fontSize: 11, color: '#DC2626', flex: 1 }}>Error: {error}</span>}
          <button type="button" onClick={onClose}
            style={{ height: 36, padding: '0 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#AAA', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Cancelar
          </button>
          <button type="button" onClick={handlePreview} disabled={previewing || loading}
            style={{ height: 36, padding: '0 20px', background: 'none', border: '1px solid #D0CEC9', cursor: (previewing || loading) ? 'not-allowed' : 'pointer', fontSize: 11, color: previewing ? '#AAA' : '#555', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: (previewing || loading) ? 0.6 : 1 }}
            onMouseEnter={e => { if (!previewing && !loading) { (e.currentTarget as HTMLElement).style.borderColor = '#888'; (e.currentTarget as HTMLElement).style.color = '#1A1A1A' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D0CEC9'; (e.currentTarget as HTMLElement).style.color = previewing ? '#AAA' : '#555' }}>
            {previewing ? 'Generando…' : 'Preview PDF'}
          </button>
          <button type="submit" form="factura-form" disabled={loading}
            style={{ height: 36, padding: '0 24px', background: loading ? '#888' : '#1A1A1A', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: loading ? 0.7 : 1 }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#D85A30' }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#1A1A1A' }}>
            {loading ? 'Enviando…' : 'Emitir y enviar al cliente'}
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── EstadoBadge ───────────────────────────────────────────────────────────────

function EstadoBadge({ estado, id, onUpdate }: { estado: string; id: string; onUpdate: (id: string, e: string) => void }) {
  const [open, setOpen] = useState(false)
  const cfg = ESTADO_COLOR[estado] ?? ESTADO_COLOR.borrador
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: cfg.bg, color: cfg.color, border: 'none', padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
        {cfg.label} ▾
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 2, zIndex: 20, background: '#fff', border: '1px solid #E8E6E0', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minWidth: 120 }}>
            {Object.entries(ESTADO_COLOR).map(([key, c]) => (
              <button key={key} type="button"
                onClick={() => { onUpdate(id, key); setOpen(false) }}
                style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: c.color, fontWeight: estado === key ? 700 : 400 }}>
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── BatchPDFModal ─────────────────────────────────────────────────────────────

function BatchPDFModal({ facturas, onClose }: { facturas: FacturaEmitida[]; onClose: () => void }) {
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(() => new Set(facturas.map(f => f.id)))
  const [mesFilter,      setMesFilter]      = useState('')
  const [proyectoFilter, setProyectoFilter] = useState('')
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const meses = useMemo(() => {
    const seen = new Set<string>()
    facturas.forEach(f => { if (f.fecha_emision) seen.add(f.fecha_emision.slice(0, 7)) })
    return Array.from(seen).sort().reverse()
  }, [facturas])

  const proyectos = useMemo(() => {
    const seen = new Set<string>()
    facturas.forEach(f => { if (f.proyecto_nombre) seen.add(f.proyecto_nombre) })
    return Array.from(seen).sort()
  }, [facturas])

  const visible = useMemo(() => {
    let r = facturas
    if (mesFilter)      r = r.filter(f => f.fecha_emision?.startsWith(mesFilter))
    if (proyectoFilter) r = r.filter(f => f.proyecto_nombre === proyectoFilter)
    return r
  }, [facturas, mesFilter, proyectoFilter])

  const allVisibleSelected = visible.length > 0 && visible.every(f => selectedIds.has(f.id))

  const toggleVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) visible.forEach(f => next.delete(f.id))
      else                    visible.forEach(f => next.add(f.id))
      return next
    })
  }

  const toggle = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleDownload = async () => {
    if (selectedIds.size === 0) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/facturas-emitidas/batch-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Error generando PDF')
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `Facturas-FormaPrima${mesFilter ? `-${mesFilter}` : ''}.zip`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const fmtMes = (m: string) => {
    const [y, mo] = m.split('-')
    const s = new Date(Number(y), Number(mo) - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  const fmtDate = (iso: string) => {
    const [, m, d] = iso.split('-')
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${parseInt(d)} ${meses[parseInt(m) - 1]}`
  }

  const eur = (n: number) => `€ ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', width: '100%', maxWidth: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #F0EEE8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D85A30', marginBottom: 4 }}>Exportar</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 200, color: '#1A1A1A' }}>Descargar facturas en PDF</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#AAA', lineHeight: 1, padding: '4px 8px' }}>×</button>
        </div>

        {/* Filters */}
        <div style={{ padding: '14px 28px', borderBottom: '1px solid #F0EEE8', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>Filtrar</span>
          {meses.length > 0 && (
            <select value={mesFilter} onChange={e => setMesFilter(e.target.value)}
              style={{ height: 30, padding: '0 8px', fontSize: 11, border: `1px solid ${mesFilter ? '#1A1A1A' : '#E8E6E0'}`, outline: 'none', fontFamily: 'inherit', color: mesFilter ? '#1A1A1A' : '#AAA', background: '#fff', cursor: 'pointer', borderRadius: 3 }}>
              <option value="">Todos los meses</option>
              {meses.map(m => <option key={m} value={m}>{fmtMes(m)}</option>)}
            </select>
          )}
          {proyectos.length > 0 && (
            <select value={proyectoFilter} onChange={e => setProyectoFilter(e.target.value)}
              style={{ height: 30, padding: '0 8px', fontSize: 11, border: `1px solid ${proyectoFilter ? '#1A1A1A' : '#E8E6E0'}`, outline: 'none', fontFamily: 'inherit', color: proyectoFilter ? '#1A1A1A' : '#AAA', background: '#fff', cursor: 'pointer', borderRadius: 3, maxWidth: 200 }}>
              <option value="">Todos los proyectos</option>
              {proyectos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          {(mesFilter || proyectoFilter) && (
            <button onClick={() => { setMesFilter(''); setProyectoFilter('') }}
              style={{ height: 30, padding: '0 10px', fontSize: 11, border: '1px solid #E8E6E0', borderRadius: 3, background: 'transparent', cursor: 'pointer', color: '#AAA', fontFamily: 'inherit' }}>
              Limpiar
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#AAA' }}>{visible.length} visible{visible.length !== 1 ? 's' : ''}</span>
            <button onClick={toggleVisible}
              style={{ height: 30, padding: '0 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid #E8E6E0', borderRadius: 3, background: 'transparent', cursor: 'pointer', color: '#555', fontFamily: 'inherit' }}>
              {allVisibleSelected ? 'Deseleccionar' : 'Seleccionar'} visibles
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#CCC', fontSize: 13 }}>Sin facturas con ese filtro</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {visible.map(f => {
                  const checked = selectedIds.has(f.id)
                  return (
                    <tr key={f.id}
                      onClick={() => toggle(f.id)}
                      style={{ cursor: 'pointer', background: checked ? 'rgba(216,90,48,0.03)' : '#fff', borderBottom: '1px solid #F8F7F4' }}
                      onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = checked ? 'rgba(216,90,48,0.03)' : '#fff' }}
                    >
                      <td style={{ width: 48, padding: '10px 0 10px 20px', verticalAlign: 'middle' }}>
                        <div style={{ width: 16, height: 16, border: `2px solid ${checked ? '#D85A30' : '#DDD'}`, borderRadius: 3, background: checked ? '#D85A30' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap' }}>{f.numero_completo}</td>
                      <td style={{ padding: '10px 8px', fontSize: 11, color: '#AAA', whiteSpace: 'nowrap' }}>{fmtDate(f.fecha_emision)}</td>
                      <td style={{ padding: '10px 8px', fontSize: 12, color: '#555', flex: 1 }}>{f.cliente_nombre}</td>
                      <td style={{ padding: '10px 8px', fontSize: 11, color: '#AAA', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.proyecto_nombre ?? '—'}</td>
                      <td style={{ padding: '10px 20px 10px 8px', fontSize: 12, fontWeight: 600, color: '#1A1A1A', textAlign: 'right', whiteSpace: 'nowrap' }}>{eur(f.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #F0EEE8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{selectedIds.size}</span>
            <span style={{ fontSize: 12, color: '#AAA', marginLeft: 4 }}>factura{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}</span>
            {error && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#DC2626' }}>{error}</p>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ height: 38, padding: '0 20px', background: 'transparent', border: '1px solid #E8E6E0', color: '#888', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button
              onClick={handleDownload}
              disabled={selectedIds.size === 0 || loading}
              style={{ height: 38, padding: '0 24px', background: selectedIds.size === 0 ? '#DDD' : '#1A1A1A', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}
              onMouseEnter={e => { if (selectedIds.size > 0 && !loading) (e.currentTarget as HTMLElement).style.background = '#D85A30' }}
              onMouseLeave={e => { if (selectedIds.size > 0 && !loading) (e.currentTarget as HTMLElement).style.background = '#1A1A1A' }}
            >
              {loading ? 'Generando…' : '↓ Descargar ZIP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PrefillData type (exported for server page) ───────────────────────────────

export interface PrefillData {
  facturaOrigenId:  string
  concepto:         string
  monto:            number
  clienteId:        string
  clienteContacto:  string
  clienteEmpresa:   string
  clienteEmail:     string
  clienteEmailCC:   string
  clienteNif:       string
  clienteDireccion: string
  proyectoId:        string
  proyectoNombre:    string
  proyectoDireccion: string
  emisorNombre:      string
  emisorNif:        string
  emisorDireccion:  string
  emisorCiudad:     string
  emisorCp:         string
  emisorEmail:      string
  emisorTelefono:   string
  iban:             string
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FacturasEmitidasPage({
  facturas: initial,
  clientes,
  proyectos,
  estudioConfig,
  prefill,
}: {
  facturas:      FacturaEmitida[]
  clientes:      Cliente[]
  proyectos:     Proyecto[]
  estudioConfig: EstudioConfig | null
  prefill?:      PrefillData | null
}) {
  const [facturas,       setFacturas]       = useState(initial)
  const [showCreate,     setShowCreate]     = useState(() => !!prefill)
  const [showBatchPDF,   setShowBatchPDF]   = useState(false)
  const [query,          setQuery]          = useState('')
  const [proyectoFilter, setProyectoFilter] = useState('')
  const [mesFilter,      setMesFilter]      = useState('')
  const [, startTransition] = useTransition()

  const proyectosEnLista = useMemo(() => {
    const seen = new Set<string>()
    facturas.forEach(f => { if (f.proyecto_nombre) seen.add(f.proyecto_nombre) })
    return Array.from(seen).sort()
  }, [facturas])

  const mesesEnLista = useMemo(() => {
    const seen = new Set<string>()
    facturas.forEach(f => { if (f.fecha_emision) seen.add(f.fecha_emision.slice(0, 7)) })
    return Array.from(seen).sort().reverse() // más reciente primero
  }, [facturas])

  const filtered = useMemo(() => {
    let result = facturas
    if (proyectoFilter) result = result.filter(f => f.proyecto_nombre === proyectoFilter)
    if (mesFilter)      result = result.filter(f => f.fecha_emision?.startsWith(mesFilter))
    const q = query.toLowerCase().trim()
    if (q) result = result.filter(f =>
      [f.numero_completo, f.cliente_nombre, f.proyecto_nombre]
        .some(v => v?.toLowerCase().includes(q))
    )
    return result
  }, [facturas, query, proyectoFilter, mesFilter])

  const handleEstadoUpdate = async (id: string, estado: string) => {
    setFacturas(prev => prev.map(f => f.id === id ? { ...f, estado } : f))
    await updateFacturaEmitidaEstado(id, estado)
  }

  const handleDelete = async (id: string, num: string) => {
    if (!confirm(`¿Eliminar la factura ${num}? Esta acción no se puede deshacer.`)) return
    const result = await deleteFacturaEmitida(id)
    if ('error' in result) { alert(`Error al eliminar: ${result.error}`); return }
    setFacturas(prev => prev.filter(f => f.id !== id))
  }

  const TD: React.CSSProperties = {
    padding: '12px 14px', fontSize: 12, color: '#1A1A1A',
    borderBottom: '1px solid #F0EEE8', verticalAlign: 'middle',
  }
  const TH: React.CSSProperties = {
    padding: '9px 14px', fontSize: 9, fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.08)',
    textAlign: 'left', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>
      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Facturación
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
            Facturas emitidas
          </h1>
          <span style={{ fontSize: 11, color: '#AAA', paddingBottom: 4 }}>
            {facturas.length} factura{facturas.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            placeholder="Buscar por número, cliente, proyecto…"
            value={query} onChange={e => setQuery(e.target.value)}
            style={{ flex: 1, height: 36, padding: '0 14px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 6, outline: 'none', fontFamily: 'inherit', color: '#1A1A1A', background: '#fff' }}
          />
          {facturas.length > 0 && (
            <button onClick={() => setShowBatchPDF(true)}
              style={{ height: 36, padding: '0 16px', background: 'transparent', color: '#555', border: '1px solid #E8E6E0', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1A1A1A'; (e.currentTarget as HTMLElement).style.color = '#1A1A1A' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0'; (e.currentTarget as HTMLElement).style.color = '#555' }}>
              ↓ Exportar PDF
            </button>
          )}
          <button onClick={() => setShowCreate(true)}
            style={{ height: 36, padding: '0 18px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#D85A30' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1A1A1A' }}>
            + Nueva factura
          </button>
        </div>
      </div>

      {/* Filters */}
      {(mesesEnLista.length > 0 || proyectosEnLista.length > 0) && (
        <div style={{ padding: '0 40px 0', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginRight: 4 }}>
              Filtrar por
            </span>
            {mesesEnLista.length > 0 && (
              <select
                value={mesFilter}
                onChange={e => setMesFilter(e.target.value)}
                style={{ height: 32, padding: '0 10px', fontSize: 11, border: `1px solid ${mesFilter ? '#1A1A1A' : '#E8E6E0'}`, borderRadius: 4, outline: 'none', fontFamily: 'inherit', color: mesFilter ? '#1A1A1A' : '#AAA', background: mesFilter ? '#F8F7F4' : '#fff', cursor: 'pointer' }}
              >
                <option value="">Mes</option>
                {mesesEnLista.map(m => {
                  const [año, mes] = m.split('-')
                  const label = new Date(Number(año), Number(mes) - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                  return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
                })}
              </select>
            )}
            {proyectosEnLista.length > 0 && (
              <select
                value={proyectoFilter}
                onChange={e => setProyectoFilter(e.target.value)}
                style={{ height: 32, padding: '0 10px', fontSize: 11, border: `1px solid ${proyectoFilter ? '#1A1A1A' : '#E8E6E0'}`, borderRadius: 4, outline: 'none', fontFamily: 'inherit', color: proyectoFilter ? '#1A1A1A' : '#AAA', background: proyectoFilter ? '#F8F7F4' : '#fff', cursor: 'pointer', maxWidth: 220 }}
              >
                <option value="">Proyecto</option>
                {proyectosEnLista.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
            {(mesFilter || proyectoFilter) && (
              <button
                onClick={() => { setMesFilter(''); setProyectoFilter('') }}
                style={{ height: 32, padding: '0 12px', fontSize: 11, border: '1px solid #E8E6E0', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: '#AAA', fontFamily: 'inherit' }}
              >
                Limpiar
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#AAA' }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ padding: '28px 40px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: '#CCC', fontSize: 13 }}>
            {query ? 'Sin resultados' : 'No hay facturas emitidas — pulsa "+ Nueva factura" para empezar'}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1A1A1A' }}>
                  <th style={{ ...TH, width: 140 }}>Número</th>
                  <th style={{ ...TH, width: 100 }}>Fecha</th>
                  <th style={TH}>Cliente</th>
                  <th style={TH}>Proyecto</th>
                  <th style={{ ...TH, textAlign: 'right', width: 110 }}>Base</th>
                  <th style={{ ...TH, textAlign: 'right', width: 110 }}>Total</th>
                  <th style={{ ...TH, width: 110 }}>Estado</th>
                  <th style={{ ...TH, textAlign: 'center', width: 80 }}>PDF</th>
                  <th style={{ ...TH, width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => (
                  <tr key={f.id}
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <td style={TD}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11, color: f.es_rectificativa ? '#DC2626' : '#1A1A1A' }}>
                        {f.numero_completo}
                      </span>
                      {f.es_rectificativa && (
                        <span style={{ fontSize: 8, color: '#DC2626', marginLeft: 6 }}>RECT</span>
                      )}
                    </td>
                    <td style={{ ...TD, color: '#888', fontSize: 11 }}>{fmtDate(f.fecha_emision)}</td>
                    <td style={TD}>
                      <span style={{ fontWeight: 500 }}>{f.cliente_nombre}</span>
                      {f.cliente_nif && <span style={{ fontSize: 10, color: '#AAA', marginLeft: 6 }}>{f.cliente_nif}</span>}
                    </td>
                    <td style={{ ...TD, color: '#888', fontSize: 11 }}>{f.proyecto_nombre ?? '—'}</td>
                    <td style={{ ...TD, textAlign: 'right', color: '#555' }}>{eur(f.base_imponible)}</td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{eur(f.total)}</td>
                    <td style={TD}>
                      <EstadoBadge estado={f.estado} id={f.id} onUpdate={handleEstadoUpdate} />
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <a
                        href={`/api/facturas-emitidas/${f.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#D85A30', textDecoration: 'none', letterSpacing: '0.04em', padding: '4px 8px', border: '1px solid #D85A30', borderRadius: 3 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FDF0EC' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        PDF ↗
                      </a>
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <button onClick={() => handleDelete(f.id, f.numero_completo)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#DDD', padding: '0 4px' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#DDD' }}
                        title="Eliminar">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch PDF modal */}
      {showBatchPDF && (
        <BatchPDFModal
          facturas={facturas}
          onClose={() => setShowBatchPDF(false)}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          clientes={clientes}
          proyectos={proyectos}
          estudioConfig={estudioConfig}
          prefill={prefill ?? null}
          onCreated={() => { setShowCreate(false); window.location.href = '/team/finanzas/facturacion/emitidas' }}
          onClose={() => { setShowCreate(false); window.history.replaceState({}, '', '/team/finanzas/facturacion/emitidas') }}
        />
      )}
    </div>
  )
}
