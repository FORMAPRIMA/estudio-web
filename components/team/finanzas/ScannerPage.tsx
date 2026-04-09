'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  saveExpenseScan,
  updateExpenseScan,
  deleteExpenseScan,
  type ExpenseType,
  type ExpenseScan,
} from '@/app/actions/expense-scans'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Proyecto { id: string; nombre: string; codigo: string | null }

interface Props {
  initialScans:  ExpenseScan[]
  proyectos:     Proyecto[]
  initialYear:   number
  initialMonth:  number
}

// ── Config ─────────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<ExpenseType, { label: string; color: string; bg: string; icon: string }> = {
  taxi_transporte:      { label: 'Taxi / Transporte',     color: '#1E40AF', bg: '#DBEAFE', icon: '🚕' },
  restaurante_comida:   { label: 'Restaurante / Comida',  color: '#065F46', bg: '#D1FAE5', icon: '🍽️' },
  alojamiento:          { label: 'Alojamiento',           color: '#5B21B6', bg: '#EDE9FE', icon: '🏨' },
  material_oficina:     { label: 'Material oficina',      color: '#92400E', bg: '#FEF3C7', icon: '📦' },
  software_suscripcion: { label: 'Software / Suscripción',color: '#1E3A5F', bg: '#DBEAFE', icon: '💻' },
  gasto_proyecto:       { label: 'Gasto de proyecto',     color: '#9A3412', bg: '#FEE2E2', icon: '🏗️' },
  factura_proveedor:    { label: 'Factura proveedor',     color: '#374151', bg: '#F3F4F6', icon: '🧾' },
  otro:                 { label: 'Otro',                  color: '#6B7280', bg: '#F9FAFB', icon: '📎' },
}

const TIPOS = Object.keys(TIPO_CONFIG) as ExpenseType[]

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtMoney(monto: number | null, moneda = 'EUR') {
  if (monto == null) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda }).format(monto)
}

function isPdfUrl(url: string | null) {
  if (!url) return false
  const lower = url.toLowerCase().split('?')[0]
  return lower.endsWith('.pdf')
}

function ScanThumb({ url, size = 56 }: { url: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const pdf = isPdfUrl(url)
  const showFallback = pdf || imgError || !url

  const handleClick = (e: React.MouseEvent) => {
    if (pdf && url) {
      e.stopPropagation()
      window.open(url, '_blank')
    }
  }

  return (
    <div
      onClick={handleClick}
      title={pdf ? 'Ver PDF' : undefined}
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: 6, overflow: 'hidden',
        background: pdf ? '#EEF2FF' : '#F8F7F4',
        border: `1px solid ${pdf ? '#C7D2FE' : '#E8E6E0'}`,
        position: 'relative',
        cursor: pdf ? 'pointer' : undefined,
      }}
    >
      {showFallback ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <span style={{ fontSize: size * 0.38 }}>📄</span>
          {pdf && size >= 48 && <span style={{ fontSize: 8, fontWeight: 700, color: '#6366F1', letterSpacing: '0.05em' }}>PDF</span>}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url!}
          alt=""
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ScannerPage({ initialScans, proyectos, initialYear, initialMonth }: Props) {
  // inject spin keyframe once
  if (typeof document !== 'undefined' && !document.getElementById('scanner-spin-style')) {
    const s = document.createElement('style')
    s.id = 'scanner-spin-style'
    s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }'
    document.head.appendChild(s)
  }
  const [scans, setScans]     = useState<ExpenseScan[]>(initialScans)
  const [year, setYear]       = useState(initialYear)
  const [month, setMonth]     = useState(initialMonth)
  const [loadingMonth, setLoadingMonth] = useState(false)

  const [showCapture, setShowCapture]   = useState(false)
  const [showBatch, setShowBatch]       = useState(false)
  const [editingScan, setEditingScan]   = useState<ExpenseScan | null>(null)
  const [lightbox, setLightbox]         = useState<string | null>(null)

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterTipo, setFilterTipo] = useState<ExpenseType | null>(null)

  const filteredScans = filterTipo ? scans.filter(s => s.tipo === filterTipo) : scans

  // ── Exchange rates ─────────────────────────────────────────────────────────
  const [rates, setRates]           = useState<Record<string, number>>({ EUR: 1 })
  const [ratesDate, setRatesDate]   = useState<string | null>(null)
  const [ratesUpdating, setRatesUpdating] = useState(false)

  useEffect(() => {
    fetch('/api/exchange-rates').then(r => r.json()).then(d => {
      if (d.rates) { setRates(d.rates); setRatesDate(d.updated_at) }
    }).catch(() => {})
  }, [])

  const handleRefreshRates = async () => {
    setRatesUpdating(true)
    try {
      const res = await fetch('/api/exchange-rates', { method: 'POST' })
      const d = await res.json()
      if (d.rates) { setRates(d.rates); setRatesDate(d.updated_at) }
    } catch {}
    setRatesUpdating(false)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  // Group by currency
  const byCurrency = Object.entries(
    filteredScans.reduce((acc, s) => {
      const c = s.moneda ?? 'EUR'
      acc[c] = (acc[c] ?? 0) + (s.monto ?? 0)
      return acc
    }, {} as Record<string, number>)
  ).filter(([, v]) => v !== 0)

  const totalEur = byCurrency.reduce((sum, [c, v]) => sum + v * (rates[c] ?? 1), 0)
  const hasMultiCurrency = byCurrency.some(([c]) => c !== 'EUR') && byCurrency.length > 1

  // byTipo: totals always in EUR-equivalent so they're comparable
  const byTipo = TIPOS.map(t => {
    const ts = filteredScans.filter(s => s.tipo === t)
    return {
      tipo: t,
      count: ts.length,
      totalEur: ts.reduce((sum, s) => sum + (s.monto ?? 0) * (rates[s.moneda ?? 'EUR'] ?? 1), 0),
    }
  }).filter(x => x.count > 0)

  // ── Month navigation ───────────────────────────────────────────────────────

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoadingMonth(true)
    const res = await fetch(`/api/expense-scans/export?year=${y}&month=${m}&meta=1`).catch(() => null)
    // Actually just reload the page with new params — simpler and uses server component
    window.location.href = `/team/finanzas/scanner?year=${y}&month=${m}`
  }, [])

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1)
    loadMonth(d.getFullYear(), d.getMonth() + 1)
  }
  const nextMonth = () => {
    const d = new Date(year, month, 1)
    const now = new Date()
    if (d > now) return
    loadMonth(d.getFullYear(), d.getMonth() + 1)
  }

  // ── Optimistic delete ──────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return
    setScans(prev => prev.filter(s => s.id !== id))
    const res = await deleteExpenseScan(id)
    if ('error' in res) {
      alert(res.error)
      window.location.reload()
    }
  }

  // ── After save ─────────────────────────────────────────────────────────────

  const handleSaved = (scan: ExpenseScan) => {
    setScans(prev => {
      const idx = prev.findIndex(s => s.id === scan.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = scan
        return next
      }
      return [scan, ...prev]
    })
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = () => {
    window.open(`/api/expense-scans/export?year=${year}&month=${month}`, '_blank')
  }

  const isCurrentMonth = year === initialYear && month === initialMonth

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px', fontFamily: 'inherit' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>Finanzas</p>
          <h1 style={{ fontSize: 20, fontWeight: 300, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>Scanner de gastos</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setShowBatch(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', background: '#fff', color: '#1A1A1A',
              border: '1px solid #E8E6E0', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 15 }}>📂</span> Subir archivos
          </button>
          <button
            onClick={() => setShowCapture(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', background: '#D85A30', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
            }}
          >
            <span style={{ fontSize: 15 }}>📷</span> Escanear
          </button>
        </div>
      </div>

      {/* ── Month navigation ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: '1px solid #E8E6E0', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 14, color: '#555' }}>←</button>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', minWidth: 140, textAlign: 'center' }}>
          {MESES_ES[month - 1]} {year}
        </span>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          style={{ background: 'none', border: '1px solid #E8E6E0', borderRadius: 6, padding: '6px 12px', cursor: isCurrentMonth ? 'default' : 'pointer', fontSize: 14, color: isCurrentMonth ? '#CCC' : '#555' }}
        >→</button>
        <button
          onClick={handleExport}
          style={{ marginLeft: 'auto', padding: '7px 14px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}
        >
          ↓ Exportar ZIP
        </button>
      </div>

      {/* ── Summary ─────────────────────────────────────────────────────────── */}
      {scans.length > 0 && (
        <>
          {/* Block 1: totales por divisa */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
            {byCurrency.map(([currency, total]) => {
              const n = filteredScans.filter(s => (s.moneda ?? 'EUR') === currency).length
              return (
                <div key={currency} style={{ padding: '12px 16px', background: '#F8F7F4', border: '1px solid #E8E6E0', borderRadius: 8, minWidth: 130 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>Total {currency}</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: '#D85A30', margin: 0 }}>{fmtMoney(total, currency)}</p>
                  <p style={{ fontSize: 10, color: '#888', margin: '2px 0 0' }}>{n} ticket{n !== 1 ? 's' : ''}</p>
                </div>
              )
            })}
            {hasMultiCurrency && (
              <div style={{ padding: '12px 16px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, minWidth: 130 }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C2410C', margin: '0 0 4px' }}>≈ Total EUR</p>
                <p style={{ fontSize: 20, fontWeight: 600, color: '#C2410C', margin: 0 }}>{fmtMoney(totalEur, 'EUR')}</p>
                <p style={{ fontSize: 10, color: '#C2410C99', margin: '2px 0 0' }}>conversión aprox.</p>
              </div>
            )}
          </div>

          {/* Exchange rate bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 10, color: '#BBB' }}>
              {ratesDate ? `Cambio actualizado: ${new Date(ratesDate).toLocaleDateString('es-ES')}` : 'Tipos de cambio pendientes'}
            </span>
            <button
              onClick={handleRefreshRates}
              disabled={ratesUpdating}
              style={{ fontSize: 10, padding: '2px 8px', background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, cursor: 'pointer', color: '#888', opacity: ratesUpdating ? 0.5 : 1 }}
            >
              {ratesUpdating ? '…' : '↻ Actualizar'}
            </button>
          </div>

          {/* Block 2: desglose por tipo (siempre en EUR equivalente) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 16 }}>
            {byTipo.map(({ tipo, count, totalEur: tipoEur }) => {
              const cfg = TIPO_CONFIG[tipo]
              return (
                <div key={tipo} style={{ padding: '12px 14px', background: cfg.bg, border: `1px solid ${cfg.color}25`, borderRadius: 8 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: cfg.color, margin: '0 0 4px' }}>{cfg.icon} {cfg.label}</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: cfg.color, margin: 0 }}>{fmtMoney(tipoEur)}</p>
                  {hasMultiCurrency && <p style={{ fontSize: 9, color: cfg.color + '99', margin: '1px 0 0' }}>≈ EUR</p>}
                  <p style={{ fontSize: 10, color: cfg.color + 'AA', margin: '2px 0 0' }}>{count} ticket{count !== 1 ? 's' : ''}</p>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Filter by tipo ──────────────────────────────────────────────────── */}
      {scans.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          <button
            onClick={() => setFilterTipo(null)}
            style={{ flexShrink: 0, fontSize: 11, padding: '5px 12px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontWeight: filterTipo === null ? 700 : 400, background: filterTipo === null ? '#1A1A1A' : 'none', color: filterTipo === null ? '#fff' : '#555', borderColor: filterTipo === null ? '#1A1A1A' : '#E8E6E0' }}
          >
            Todos ({scans.length})
          </button>
          {TIPOS.filter(t => scans.some(s => s.tipo === t)).map(t => {
            const cfg = TIPO_CONFIG[t]
            const active = filterTipo === t
            return (
              <button
                key={t}
                onClick={() => setFilterTipo(active ? null : t)}
                style={{ flexShrink: 0, fontSize: 11, padding: '5px 12px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontWeight: active ? 700 : 400, background: active ? cfg.color : 'none', color: active ? '#fff' : cfg.color, borderColor: active ? cfg.color : cfg.color + '60' }}
              >
                {cfg.icon} {cfg.label} ({scans.filter(s => s.tipo === t).length})
              </button>
            )
          })}
        </div>
      )}

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {filteredScans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #E8E6E0', borderRadius: 12 }}>
          <p style={{ fontSize: 32, margin: '0 0 12px' }}>🧾</p>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 6px', fontWeight: 500 }}>
            {filterTipo ? `Sin gastos de tipo "${TIPO_CONFIG[filterTipo].label}"` : 'Sin gastos este mes'}
          </p>
          <p style={{ fontSize: 11, color: '#BBB', margin: 0 }}>Usa el botón "Escanear ticket" para añadir</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredScans.map(scan => {
            const cfg = TIPO_CONFIG[scan.tipo] ?? TIPO_CONFIG.otro
            return (
              <div key={scan.id} style={{ display: 'flex', gap: 12, padding: '14px 16px', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10 }}>
                {/* Thumbnail */}
                <div
                  onClick={() => { if (!isPdfUrl(scan.foto_url)) setLightbox(scan.foto_url) }}
                  style={{ cursor: isPdfUrl(scan.foto_url) ? 'pointer' : 'zoom-in' }}
                >
                  <ScanThumb url={scan.foto_url} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: cfg.color, background: cfg.bg, padding: '2px 7px', borderRadius: 4 }}>
                      {cfg.icon} {cfg.label}
                    </span>
                    {scan.fecha_ticket && (
                      <span style={{ fontSize: 10, color: '#888' }}>{scan.fecha_ticket}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {scan.proveedor ?? scan.descripcion ?? '—'}
                  </p>
                  {scan.proveedor && scan.descripcion && (
                    <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.descripcion}</p>
                  )}
                  <p style={{ fontSize: 10, color: '#BBB', margin: 0 }}>
                    {scan.autor?.nombre ?? '—'} · {new Date(scan.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Monto + actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A' }}>{fmtMoney(scan.monto, scan.moneda)}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setEditingScan(scan)}
                      style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: '1px solid #E8E6E0', borderRadius: 5, cursor: 'pointer', color: '#555' }}
                    >Editar</button>
                    <button
                      onClick={() => handleDelete(scan.id)}
                      style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: '1px solid #FECACA', borderRadius: 5, cursor: 'pointer', color: '#DC2626' }}
                    >×</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Batch upload modal ──────────────────────────────────────────────── */}
      {showBatch && (
        <BatchUploadModal
          proyectos={proyectos}
          onClose={() => setShowBatch(false)}
          onSaved={scans => { scans.forEach(handleSaved); setShowBatch(false) }}
        />
      )}

      {/* ── Capture modal ────────────────────────────────────────────────────── */}
      {showCapture && (
        <CaptureModal
          proyectos={proyectos}
          onClose={() => setShowCapture(false)}
          onSaved={scan => { handleSaved(scan); setShowCapture(false) }}
        />
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────────── */}
      {editingScan && (
        <EditModal
          scan={editingScan}
          proyectos={proyectos}
          onClose={() => setEditingScan(null)}
          onSaved={scan => { handleSaved(scan); setEditingScan(null) }}
        />
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightbox && !isPdfUrl(lightbox) && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 20, width: 36, height: 36, borderRadius: '50%', cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  )
}

// ── BatchUploadModal ───────────────────────────────────────────────────────────

interface BatchItem {
  id:          string
  file:        File
  preview:     string | null   // object URL for images
  isPdf:       boolean
  status:      'idle' | 'uploading' | 'analyzing' | 'done' | 'error'
  photoUrl:    string | null
  error:       string | null
  skip:        boolean
  // form fields
  tipo:        ExpenseType
  monto:       string
  moneda:      string
  proveedor:   string
  descripcion: string
  fechaTicket: string
  proyectoId:  string
  notas:       string
}

function BatchUploadModal({ proyectos, onClose, onSaved }: {
  proyectos: Proyecto[]
  onClose: () => void
  onSaved: (scans: ExpenseScan[]) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<BatchItem[]>([])
  const [stage, setStage] = useState<'select' | 'processing' | 'review'>('select')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const makeItem = (file: File): BatchItem => ({
    id:          `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
    file,
    preview:     file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    isPdf:       file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf'),
    status:      'idle',
    photoUrl:    null,
    error:       null,
    skip:        false,
    tipo:        'otro',
    monto:       '',
    moneda:      'EUR',
    proveedor:   '',
    descripcion: '',
    fechaTicket: '',
    proyectoId:  '',
    notas:       '',
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setItems(prev => [...prev, ...files.map(makeItem)])
    e.target.value = ''
  }

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

  const updateItem = (id: string, patch: Partial<BatchItem>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

  const processAll = async () => {
    if (items.length === 0) return
    setStage('processing')

    for (const item of items) {
      // 1. Upload
      updateItem(item.id, { status: 'uploading' })
      const fd = new FormData()
      fd.append('photo', item.file)
      let upRes: { url: string } | { error: string }
      try {
        const upFetch = await fetch('/api/expense-scans/upload', { method: 'POST', body: fd })
        upRes = await upFetch.json()
      } catch {
        upRes = { error: 'Error al subir el archivo.' }
      }

      if ('error' in upRes) {
        updateItem(item.id, { status: 'error', error: upRes.error })
        continue
      }

      updateItem(item.id, { photoUrl: upRes.url, status: 'analyzing' })

      // 2. AI analysis
      const uploadedUrl = upRes.url
      try {
        const res = await fetch('/api/scan-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: uploadedUrl }),
        })
        const json = await res.json() as { items?: any[]; error?: string }
        if (json.items && json.items.length > 0) {
          if (json.items.length === 1) {
            // Single document — update the existing item
            const d = json.items[0]
            updateItem(item.id, {
              status:      'done',
              tipo:        TIPOS.includes(d.tipo) ? d.tipo : 'otro',
              monto:       d.monto != null ? String(d.monto) : '',
              moneda:      d.moneda ?? 'EUR',
              proveedor:   d.proveedor ?? '',
              descripcion: d.descripcion ?? '',
              fechaTicket: d.fecha_ticket ?? '',
            })
          } else {
            // PDF contained multiple documents — expand into individual items
            setItems(prev => {
              const without = prev.filter(i => i.id !== item.id)
              const expanded: BatchItem[] = json.items!.map((d, idx) => ({
                id:          `${item.id}-split-${idx}`,
                file:        item.file,
                preview:     item.preview,
                isPdf:       item.isPdf,
                status:      'done' as const,
                photoUrl:    uploadedUrl,
                error:       null,
                skip:        false,
                tipo:        (TIPOS.includes(d.tipo) ? d.tipo : 'otro') as ExpenseType,
                monto:       d.monto != null ? String(d.monto) : '',
                moneda:      d.moneda ?? 'EUR',
                proveedor:   d.proveedor ?? '',
                descripcion: d.descripcion ?? '',
                fechaTicket: d.fecha_ticket ?? '',
                proyectoId:  '',
                notas:       `Doc ${idx + 1}/${json.items!.length} — ${item.file.name}`,
              }))
              return [...without, ...expanded]
            })
          }
        } else {
          updateItem(item.id, { status: 'done' })
        }
      } catch {
        updateItem(item.id, { status: 'done' })
      }
    }

    setStage('review')
  }

  const handleSaveAll = async () => {
    const toSave = items.filter(i => !i.skip && i.photoUrl && i.status !== 'error')
    if (toSave.length === 0) { onClose(); return }
    setSaving(true)

    const saved: ExpenseScan[] = []
    for (const item of toSave) {
      const res = await saveExpenseScan({
        foto_url:     item.photoUrl!,
        fecha_ticket: item.fechaTicket || null,
        monto:        item.monto ? parseFloat(item.monto) : null,
        moneda:       item.moneda,
        tipo:         item.tipo,
        proveedor:    item.proveedor || null,
        descripcion:  item.descripcion || null,
        proyecto_id:  item.proyectoId || null,
        notas:        item.notas || null,
      })
      if ('id' in res) {
        saved.push({
          id:           res.id,
          user_id:      '',
          foto_url:     item.photoUrl!,
          fecha_ticket: item.fechaTicket || null,
          monto:        item.monto ? parseFloat(item.monto) : null,
          moneda:       item.moneda,
          tipo:         item.tipo,
          proveedor:    item.proveedor || null,
          descripcion:  item.descripcion || null,
          proyecto_id:  item.proyectoId || null,
          notas:        item.notas || null,
          created_at:   new Date().toISOString(),
          autor:        null,
        })
      }
    }

    setSaving(false)
    onSaved(saved)
  }

  const activeItems  = items.filter(i => !i.skip)
  const pendingCount = items.filter(i => i.status === 'uploading' || i.status === 'analyzing').length
  const doneCount    = items.filter(i => i.status === 'done' || i.status === 'error').length

  return (
    <ModalShell title="Subida manual de archivos" onClose={onClose}>

      {/* Drop / select zone */}
      {stage === 'select' && (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #E8E6E0', borderRadius: 10, padding: '28px 16px',
              textAlign: 'center', cursor: 'pointer', marginBottom: 16,
              background: '#FAFAF8',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D85A30' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0' }}
          >
            <p style={{ fontSize: 28, margin: '0 0 8px' }}>📂</p>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', margin: '0 0 4px' }}>
              Selecciona fotos o PDFs
            </p>
            <p style={{ fontSize: 11, color: '#AAA', margin: 0 }}>
              JPG, PNG, WEBP, PDF · Múltiples archivos permitidos
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </>
      )}

      {/* File queue */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 260, overflowY: 'auto' }}>
          {items.map(item => {
            const cfg  = TIPO_CONFIG[item.tipo]
            const isExpanded = expandedId === item.id && stage === 'review'

            return (
              <div key={item.id} style={{
                border: `1px solid ${item.status === 'error' ? '#FECACA' : item.skip ? '#F3F4F6' : '#E8E6E0'}`,
                borderRadius: 8, overflow: 'hidden',
                opacity: item.skip ? 0.45 : 1,
                transition: 'opacity 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                  {/* Thumb */}
                  <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 5, overflow: 'hidden', background: '#F8F7F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.preview
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={item.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 20 }}>📄</span>
                    }
                  </div>

                  {/* Name + status */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 500, color: '#1A1A1A', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.file.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.status === 'idle' && <span style={{ fontSize: 10, color: '#AAA' }}>En cola</span>}
                      {item.status === 'uploading' && <><Spinner size={10} /><span style={{ fontSize: 10, color: '#888' }}>Subiendo…</span></>}
                      {item.status === 'analyzing' && <><Spinner size={10} /><span style={{ fontSize: 10, color: '#92400E' }}>Analizando con IA…</span></>}
                      {item.status === 'done' && <span style={{ fontSize: 10, color: cfg.color, background: cfg.bg, padding: '1px 6px', borderRadius: 4 }}>{cfg.icon} {cfg.label}</span>}
                      {item.status === 'error' && <span style={{ fontSize: 10, color: '#DC2626' }}>Error: {item.error}</span>}
                      {item.status === 'done' && item.monto && <span style={{ fontSize: 10, color: '#555', fontWeight: 600 }}>{fmtMoney(parseFloat(item.monto), item.moneda)}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {stage === 'review' && item.status === 'done' && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        style={{ fontSize: 10, padding: '3px 8px', background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, cursor: 'pointer', color: '#555' }}
                      >{isExpanded ? 'Cerrar' : 'Editar'}</button>
                    )}
                    {stage === 'review' && item.status !== 'error' && (
                      <button
                        onClick={() => updateItem(item.id, { skip: !item.skip })}
                        style={{ fontSize: 10, padding: '3px 8px', background: 'none', border: `1px solid ${item.skip ? '#D85A30' : '#E8E6E0'}`, borderRadius: 4, cursor: 'pointer', color: item.skip ? '#D85A30' : '#888' }}
                      >{item.skip ? 'Incluir' : 'Omitir'}</button>
                    )}
                    {stage === 'select' && (
                      <button onClick={() => removeItem(item.id)} style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#AAA', padding: '0 2px' }}>×</button>
                    )}
                  </div>
                </div>

                {/* Inline edit form for review stage */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #F0EEE8', padding: '12px' }}>
                    <ExpenseForm
                      tipo={item.tipo}        setTipo={v => updateItem(item.id, { tipo: v })}
                      monto={item.monto}       setMonto={v => updateItem(item.id, { monto: v })}
                      moneda={item.moneda}     setMoneda={v => updateItem(item.id, { moneda: v })}
                      proveedor={item.proveedor} setProveedor={v => updateItem(item.id, { proveedor: v })}
                      descripcion={item.descripcion} setDescripcion={v => updateItem(item.id, { descripcion: v })}
                      fechaTicket={item.fechaTicket} setFechaTicket={v => updateItem(item.id, { fechaTicket: v })}
                      proyectoId={item.proyectoId} setProyectoId={v => updateItem(item.id, { proyectoId: v })}
                      notas={item.notas}       setNotas={v => updateItem(item.id, { notas: v })}
                      proyectos={proyectos}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add more button in select stage */}
      {stage === 'select' && items.length > 0 && (
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ ...btnGhost, marginBottom: 16, fontSize: 11 }}
        >+ Añadir más archivos</button>
      )}

      {/* Progress bar in processing stage */}
      {stage === 'processing' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 4, background: '#F0EEE8', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#D85A30', borderRadius: 2, width: `${items.length > 0 ? (doneCount / items.length) * 100 : 0}%`, transition: 'width 0.3s' }} />
          </div>
          <p style={{ fontSize: 11, color: '#888', margin: '6px 0 0', textAlign: 'center' }}>
            {pendingCount > 0 ? `Procesando ${doneCount + 1} de ${items.length}…` : 'Análisis completado'}
          </p>
        </div>
      )}

      {/* Footer buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        {stage === 'select' && (
          <button
            onClick={processAll}
            disabled={items.length === 0}
            style={{ ...btnDark, flex: 2, opacity: items.length === 0 ? 0.4 : 1 }}
          >
            Analizar {items.length > 0 ? `${items.length} archivo${items.length !== 1 ? 's' : ''}` : ''}
          </button>
        )}
        {stage === 'processing' && (
          <button disabled style={{ ...btnDark, flex: 2, opacity: 0.5 }}>
            <Spinner size={12} /> &nbsp;Procesando…
          </button>
        )}
        {stage === 'review' && (
          <button
            onClick={handleSaveAll}
            disabled={saving || activeItems.length === 0}
            style={{ ...btnDark, flex: 2, opacity: saving || activeItems.length === 0 ? 0.5 : 1 }}
          >
            {saving ? 'Guardando…' : `Guardar ${activeItems.length} gasto${activeItems.length !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </ModalShell>
  )
}

// ── CaptureModal ───────────────────────────────────────────────────────────────

function CaptureModal({ proyectos, onClose, onSaved }: {
  proyectos: Proyecto[]
  onClose: () => void
  onSaved: (scan: ExpenseScan) => void
}) {
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const cameraInputRef  = useRef<HTMLInputElement>(null)

  const [preview, setPreview]   = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Form state — pre-filled by AI
  const [tipo,       setTipo]       = useState<ExpenseType>('otro')
  const [monto,      setMonto]      = useState('')
  const [moneda,     setMoneda]     = useState('EUR')
  const [proveedor,  setProveedor]  = useState('')
  const [descripcion,setDescripcion]= useState('')
  const [fechaTicket,setFechaTicket]= useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [notas,      setNotas]      = useState('')

  const handleFile = async (file: File) => {
    setError(null)
    setPreview(URL.createObjectURL(file))

    // 1. Upload photo
    setUploading(true)
    const fd = new FormData()
    fd.append('photo', file)
    let upRes: { url: string } | { error: string }
    try {
      const upFetch = await fetch('/api/expense-scans/upload', { method: 'POST', body: fd })
      upRes = await upFetch.json()
    } catch {
      upRes = { error: 'Error al subir la foto.' }
    }
    setUploading(false)

    if ('error' in upRes) { setError(upRes.error); return }
    setPhotoUrl(upRes.url)

    // 2. Run AI scan
    setScanning(true)
    try {
      const scanRes = await fetch('/api/scan-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: upRes.url }),
      })
      const scanJson = await scanRes.json() as { items?: any[]; error?: string }
      if (scanJson.items && scanJson.items.length > 0) {
        const d = scanJson.items[0]
        if (d.tipo && TIPOS.includes(d.tipo))  setTipo(d.tipo)
        if (d.monto != null)                   setMonto(String(d.monto))
        if (d.moneda)                          setMoneda(d.moneda)
        if (d.proveedor)                       setProveedor(d.proveedor)
        if (d.descripcion)                     setDescripcion(d.descripcion)
        if (d.fecha_ticket)                    setFechaTicket(d.fecha_ticket)
      }
    } catch {
      // AI failed silently — user can fill in manually
    }
    setScanning(false)
  }

  const handleSave = async () => {
    if (!photoUrl) return
    setSaving(true)
    setError(null)
    const res = await saveExpenseScan({
      foto_url:     photoUrl,
      fecha_ticket: fechaTicket || null,
      monto:        monto ? parseFloat(monto) : null,
      moneda,
      tipo,
      proveedor:    proveedor || null,
      descripcion:  descripcion || null,
      proyecto_id:  proyectoId || null,
      notas:        notas || null,
    })
    setSaving(false)
    if ('error' in res) { setError(res.error); return }

    // Build a local scan object for optimistic update
    const scan: ExpenseScan = {
      id:           res.id,
      user_id:      '',
      foto_url:     photoUrl,
      fecha_ticket: fechaTicket || null,
      monto:        monto ? parseFloat(monto) : null,
      moneda,
      tipo,
      proveedor:    proveedor || null,
      descripcion:  descripcion || null,
      proyecto_id:  proyectoId || null,
      notas:        notas || null,
      created_at:   new Date().toISOString(),
      autor:        null,
    }
    onSaved(scan)
  }

  return (
    <ModalShell title="Escanear ticket" onClose={onClose}>
      {/* Photo capture */}
      {!preview ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => cameraInputRef.current?.click()}
            style={{ ...btnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px' }}
          >
            <span style={{ fontSize: 24 }}>📷</span>
            <span>Abrir cámara</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ ...btnGhost, padding: '12px' }}
          >
            Seleccionar desde galería
          </button>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      ) : (
        <div style={{ position: 'relative', marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: '1px solid #E8E6E0', maxHeight: 220 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', background: '#F8F7F4' }} />
          {(uploading || scanning) && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Spinner />
              <p style={{ fontSize: 12, color: '#555', margin: 0 }}>{uploading ? 'Subiendo foto…' : 'Leyendo con IA…'}</p>
            </div>
          )}
        </div>
      )}

      {/* Form — shown once photo is uploaded */}
      {photoUrl && !uploading && (
        <>
          {scanning && (
            <div style={{ padding: '10px 14px', background: '#FEF9C3', borderRadius: 6, fontSize: 11, color: '#92400E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Spinner size={12} /> Analizando con IA…
            </div>
          )}

          <ExpenseForm
            tipo={tipo} setTipo={setTipo}
            monto={monto} setMonto={setMonto}
            moneda={moneda} setMoneda={setMoneda}
            proveedor={proveedor} setProveedor={setProveedor}
            descripcion={descripcion} setDescripcion={setDescripcion}
            fechaTicket={fechaTicket} setFechaTicket={setFechaTicket}
            proyectoId={proyectoId} setProyectoId={setProyectoId}
            notas={notas} setNotas={setNotas}
            proyectos={proyectos}
          />

          {error && <p style={{ fontSize: 12, color: '#DC2626', margin: '8px 0 0' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ ...btnDark, flex: 2, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar gasto'}
            </button>
          </div>
        </>
      )}

      {!photoUrl && !uploading && error && (
        <p style={{ fontSize: 12, color: '#DC2626', margin: '0 0 12px' }}>{error}</p>
      )}
    </ModalShell>
  )
}

// ── EditModal ──────────────────────────────────────────────────────────────────

function EditModal({ scan, proyectos, onClose, onSaved }: {
  scan: ExpenseScan
  proyectos: Proyecto[]
  onClose: () => void
  onSaved: (scan: ExpenseScan) => void
}) {
  const [tipo,       setTipo]        = useState<ExpenseType>(scan.tipo)
  const [monto,      setMonto]       = useState(scan.monto != null ? String(scan.monto) : '')
  const [moneda,     setMoneda]      = useState(scan.moneda)
  const [proveedor,  setProveedor]   = useState(scan.proveedor ?? '')
  const [descripcion,setDescripcion] = useState(scan.descripcion ?? '')
  const [fechaTicket,setFechaTicket] = useState(scan.fecha_ticket ?? '')
  const [proyectoId, setProyectoId]  = useState(scan.proyecto_id ?? '')
  const [notas,      setNotas]       = useState(scan.notas ?? '')
  const [saving, setSaving]          = useState(false)
  const [error, setError]            = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const res = await updateExpenseScan(scan.id, {
      fecha_ticket: fechaTicket || null,
      monto:        monto ? parseFloat(monto) : null,
      moneda,
      tipo,
      proveedor:    proveedor || null,
      descripcion:  descripcion || null,
      proyecto_id:  proyectoId || null,
      notas:        notas || null,
    })
    setSaving(false)
    if ('error' in res) { setError(res.error); return }
    onSaved({ ...scan, tipo, monto: monto ? parseFloat(monto) : null, moneda, proveedor: proveedor || null, descripcion: descripcion || null, fecha_ticket: fechaTicket || null, proyecto_id: proyectoId || null, notas: notas || null })
  }

  return (
    <ModalShell title="Editar gasto" onClose={onClose}>
      <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: '1px solid #E8E6E0', maxHeight: 160 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={scan.foto_url} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', background: '#F8F7F4' }} />
      </div>
      <ExpenseForm
        tipo={tipo} setTipo={setTipo}
        monto={monto} setMonto={setMonto}
        moneda={moneda} setMoneda={setMoneda}
        proveedor={proveedor} setProveedor={setProveedor}
        descripcion={descripcion} setDescripcion={setDescripcion}
        fechaTicket={fechaTicket} setFechaTicket={setFechaTicket}
        proyectoId={proyectoId} setProyectoId={setProyectoId}
        notas={notas} setNotas={setNotas}
        proyectos={proyectos}
      />
      {error && <p style={{ fontSize: 12, color: '#DC2626', margin: '8px 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={handleSave} disabled={saving} style={{ ...btnDark, flex: 2, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </ModalShell>
  )
}

// ── ExpenseForm ────────────────────────────────────────────────────────────────

function ExpenseForm({
  tipo, setTipo, monto, setMonto, moneda, setMoneda,
  proveedor, setProveedor, descripcion, setDescripcion,
  fechaTicket, setFechaTicket, proyectoId, setProyectoId,
  notas, setNotas, proyectos,
}: {
  tipo: ExpenseType;       setTipo: (v: ExpenseType) => void
  monto: string;           setMonto: (v: string) => void
  moneda: string;          setMoneda: (v: string) => void
  proveedor: string;       setProveedor: (v: string) => void
  descripcion: string;     setDescripcion: (v: string) => void
  fechaTicket: string;     setFechaTicket: (v: string) => void
  proyectoId: string;      setProyectoId: (v: string) => void
  notas: string;           setNotas: (v: string) => void
  proyectos: Proyecto[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Tipo */}
      <div>
        <label style={lbl}>Tipo de gasto</label>
        <select value={tipo} onChange={e => setTipo(e.target.value as ExpenseType)} style={inputStyle}>
          {TIPOS.map(t => (
            <option key={t} value={t}>{TIPO_CONFIG[t].icon} {TIPO_CONFIG[t].label}</option>
          ))}
        </select>
      </div>

      {/* Monto + moneda */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
        <div>
          <label style={lbl}>Importe</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={lbl}>Moneda</label>
          <select value={moneda} onChange={e => setMoneda(e.target.value)} style={{ ...inputStyle, width: 72 }}>
            {['EUR','USD','GBP','CHF'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Proveedor */}
      <div>
        <label style={lbl}>Proveedor / Establecimiento</label>
        <input
          type="text"
          placeholder="Restaurante, empresa, app…"
          value={proveedor}
          onChange={e => setProveedor(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Descripción */}
      <div>
        <label style={lbl}>Descripción</label>
        <input
          type="text"
          placeholder="Concepto del gasto…"
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Fecha ticket */}
      <div>
        <label style={lbl}>Fecha del ticket</label>
        <input
          type="date"
          value={fechaTicket}
          onChange={e => setFechaTicket(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Proyecto */}
      <div>
        <label style={lbl}>Proyecto <span style={{ color: '#CCC', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
        <select value={proyectoId} onChange={e => setProyectoId(e.target.value)} style={inputStyle}>
          <option value="">Sin proyecto</option>
          {proyectos.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}{p.codigo ? ` — ${p.codigo}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Notas */}
      <div>
        <label style={lbl}>Notas <span style={{ color: '#CCC', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
        <textarea
          rows={2}
          placeholder="Observaciones adicionales…"
          value={notas}
          onChange={e => setNotas(e.target.value)}
          style={{ ...inputStyle, resize: 'vertical' as const }}
        />
      </div>
    </div>
  )
}

// ── ModalShell ─────────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 900 }} onClick={onClose} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 901, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 0)',
      }}>
        <div style={{
          background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520,
          maxHeight: '92vh', overflow: 'auto',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
          padding: '20px 20px 32px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', margin: 0 }}>{title}</p>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#CCC', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
          </div>
          {children}
        </div>
      </div>
    </>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────────

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `${Math.max(2, size / 6)}px solid #E8E6E0`,
      borderTopColor: '#D85A30',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 9, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#AAA', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #E8E6E0', borderRadius: 7,
  fontFamily: 'inherit', color: '#1A1A1A', background: '#fff',
  boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', background: '#D85A30', color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer',
  fontSize: 13, fontWeight: 600, width: '100%',
}

const btnGhost: React.CSSProperties = {
  padding: '10px 16px', background: 'none', color: '#555',
  border: '1px solid #E8E6E0', borderRadius: 8, cursor: 'pointer',
  fontSize: 12, width: '100%',
}

const btnDark: React.CSSProperties = {
  padding: '10px 20px', background: '#1A1A1A', color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer',
  fontSize: 13, fontWeight: 600, width: '100%',
}
