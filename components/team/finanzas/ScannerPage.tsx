'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  saveExpenseScan,
  updateExpenseScan,
  deleteExpenseScan,
  getAllExpenseScans,
  findOrphanScanFiles,
  deleteOrphanScanFile,
  type ExpenseType,
  type ExpenseScan,
  type OrphanScanFile,
} from '@/app/actions/expense-scans'
import { autocropImage } from '@/lib/gastos/autocrop'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Proyecto { id: string; nombre: string; codigo: string | null }

interface Props {
  initialScans:   ExpenseScan[]
  proyectos:      Proyecto[]
  initialYear:    number
  initialMonth:   number
  /** Si viene, la vista está en modo trimestre (1-4); si no, modo mes. */
  initialQuarter?: number | null
  /** 'partner' = vista completa · 'personal' = drop-off, solo gastos propios */
  mode:           'partner' | 'personal'
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

// Fecha efectiva de un gasto: la de emisión del documento; si falta, la de subida
function scanDate(s: ExpenseScan) {
  return s.fecha_ticket ?? s.created_at.slice(0, 10)
}

// Orden cronológico por fecha de emisión (desc), con fecha de subida como desempate
function sortScans(list: ExpenseScan[]) {
  return [...list].sort((a, b) =>
    scanDate(b).localeCompare(scanDate(a)) || b.created_at.localeCompare(a.created_at)
  )
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

export default function ScannerPage({ initialScans, proyectos, initialYear, initialMonth, initialQuarter, mode }: Props) {
  // inject spin keyframe once
  if (typeof document !== 'undefined' && !document.getElementById('scanner-spin-style')) {
    const s = document.createElement('style')
    s.id = 'scanner-spin-style'
    s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }'
    document.head.appendChild(s)
  }
  const isPartner = mode === 'partner'
  const router = useRouter()
  const [isNavigating, startNavigation] = useTransition()

  const [scans, setScans]     = useState<ExpenseScan[]>(() => sortScans(initialScans))
  const year  = initialYear
  const month = initialMonth

  // ── Período: mes o trimestre ────────────────────────────────────────────────
  const periodMode: 'mes' | 'trimestre' = initialQuarter ? 'trimestre' : 'mes'
  const currentQuarter = initialQuarter ?? Math.floor((month - 1) / 3) + 1

  // ── Selección de gastos para descarga ───────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)

  const [activeTab, setActiveTab]       = useState<'mes' | 'recientes'>('mes')
  const [recentScans, setRecentScans]   = useState<ExpenseScan[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [savedNotice, setSavedNotice]   = useState<string | null>(null)

  const [showCapture, setShowCapture]   = useState(false)
  const [showBatch, setShowBatch]       = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [editingScan, setEditingScan]   = useState<ExpenseScan | null>(null)
  const [lightbox, setLightbox]         = useState<string | null>(null)

  // ── Tab switch ─────────────────────────────────────────────────────────────
  const handleTabSwitch = async (tab: 'mes' | 'recientes') => {
    setActiveTab(tab)
    if (tab === 'recientes' && recentScans.length === 0) {
      setLoadingRecent(true)
      const res = await getAllExpenseScans()
      if (!('error' in res)) setRecentScans(res)
      setLoadingRecent(false)
    }
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filterTipo, setFilterTipo] = useState<ExpenseType | null>(null)

  const activeScans = activeTab === 'recientes' ? recentScans : scans
  const filteredScans = filterTipo ? activeScans.filter(s => s.tipo === filterTipo) : activeScans

  // ── Exchange rates ─────────────────────────────────────────────────────────
  const [rates, setRates]           = useState<Record<string, number>>({ EUR: 1 })
  const [ratesDate, setRatesDate]   = useState<string | null>(null)
  const [ratesUpdating, setRatesUpdating] = useState(false)

  useEffect(() => {
    if (!isPartner) return   // el resumen multi-divisa solo se muestra al partner
    fetch('/api/exchange-rates').then(r => r.json()).then(d => {
      if (d.rates) { setRates(d.rates); setRatesDate(d.updated_at) }
    }).catch(() => {})
  }, [isPartner])

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
  // Navegación ligera: re-render del server component vía router, sin recarga
  // completa (antes generaba un ZIP entero del mes en cada cambio).

  const loadMonth = (y: number, m: number) => {
    startNavigation(() => {
      router.push(`/team/gastos?year=${y}&month=${m}`)
    })
  }
  const loadQuarter = (y: number, q: number) => {
    startNavigation(() => {
      router.push(`/team/gastos?year=${y}&quarter=${q}`)
    })
  }

  // Toggle mes ↔ trimestre (ancla el mes al 1er mes del trimestre y viceversa)
  const switchToMes       = () => loadMonth(year, periodMode === 'trimestre' ? (currentQuarter - 1) * 3 + 1 : month)
  const switchToTrimestre = () => loadQuarter(year, currentQuarter)

  const prevPeriod = () => {
    if (periodMode === 'trimestre') {
      let q = currentQuarter - 1, y = year
      if (q < 1) { q = 4; y -= 1 }
      loadQuarter(y, q)
    } else {
      const d = new Date(year, month - 2, 1)
      loadMonth(d.getFullYear(), d.getMonth() + 1)
    }
  }
  const nextPeriod = () => {
    if (periodMode === 'trimestre') {
      let q = currentQuarter + 1, y = year
      if (q > 4) { q = 1; y += 1 }
      loadQuarter(y, q)
    } else {
      const d = new Date(year, month, 1)
      if (d > new Date()) return
      loadMonth(d.getFullYear(), d.getMonth() + 1)
    }
  }

  // ── Optimistic delete ──────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return
    setScans(prev => prev.filter(s => s.id !== id))
    setRecentScans(prev => prev.filter(s => s.id !== id))
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    const res = await deleteExpenseScan(id)
    if ('error' in res) {
      alert(res.error)
      window.location.reload()
    }
  }

  // ── After save ─────────────────────────────────────────────────────────────

  const upsertInList = (prev: ExpenseScan[], scan: ExpenseScan) => {
    const idx = prev.findIndex(s => s.id === scan.id)
    if (idx >= 0) { const next = [...prev]; next[idx] = scan; return next }
    return [scan, ...prev]
  }

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showNotice = (msg: string) => {
    setSavedNotice(msg)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setSavedNotice(null), 7000)
  }

  const handleSaved = (scan: ExpenseScan, conciliado?: boolean) => {
    setRecentScans(prev => sortByCreated(upsertInList(prev, scan)))

    const d = scanDate(scan)
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
    const inViewedMonth = d.startsWith(monthPrefix)

    if (mode === 'personal') {
      // En modo personal la lista no es mensual: siempre se añade
      setScans(prev => sortScans(upsertInList(prev, scan)))
      showNotice('✓ Gasto registrado correctamente.')
      return
    }

    const conciliadoMsg = conciliado ? ' · Conciliado con un movimiento bancario.' : ''
    if (inViewedMonth) {
      setScans(prev => sortScans(upsertInList(prev, scan)))
      if (conciliadoMsg) showNotice(`✓ Gasto guardado.${conciliadoMsg}`)
    } else {
      // El documento pertenece a otro mes: no se muestra en la vista actual
      setScans(prev => prev.filter(s => s.id !== scan.id))
      const [yy, mm] = d.split('-')
      showNotice(`✓ Gasto guardado en ${MESES_ES[parseInt(mm, 10) - 1]} ${yy} (fecha del documento).${conciliadoMsg}`)
    }
  }

  const sortByCreated = (list: ExpenseScan[]) =>
    [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))

  // ── Export ─────────────────────────────────────────────────────────────────

  // Descarga del período visible completo (mes o trimestre)
  const handleExport = () => {
    const q = periodMode === 'trimestre'
      ? `year=${year}&quarter=${currentQuarter}`
      : `year=${year}&month=${month}`
    window.open(`/api/expense-scans/export?${q}`, '_blank')
  }

  // Descarga solo los gastos seleccionados (POST porque los ids pueden ser muchos)
  const handleExportSelection = async () => {
    if (selectedIds.size === 0) return
    setIsExporting(true)
    try {
      const res = await fetch('/api/expense-scans/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!res.ok) { alert('No se pudo generar el ZIP.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'gastos_seleccion.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Error de red al generar el ZIP.')
    } finally {
      setIsExporting(false)
    }
  }

  // Selección
  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const allVisibleSelected = filteredScans.length > 0 && filteredScans.every(s => selectedIds.has(s.id))
  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) filteredScans.forEach(s => next.delete(s.id))
      else                    filteredScans.forEach(s => next.add(s.id))
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

  // ── Backfill hora_ticket ───────────────────────────────────────────────────
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null)

  const handleBackfillHora = async () => {
    setBackfilling(true)
    setBackfillMsg('Procesando...')
    let totalUpdated = 0
    let totalFailed  = 0

    // Keep running batches until no more remain
    while (true) {
      let res: { updated: number; failed: number; remaining: number } | { error: string }
      try {
        const r = await fetch('/api/expense-scans/backfill-hora', { method: 'POST' })
        res = await r.json()
      } catch {
        res = { error: 'Error de red.' }
      }
      if ('error' in res) {
        setBackfillMsg(`Error: ${res.error}`)
        break
      }
      totalUpdated += res.updated
      totalFailed  += res.failed
      if (res.remaining > 0) {
        setBackfillMsg(`Procesando… ${totalUpdated} hora(s) encontradas (quedan ~${res.remaining})`)
      } else {
        setBackfillMsg(`Listo: ${totalUpdated} hora(s) extraídas, ${totalFailed} sin hora visible.`)
        break
      }
    }
    setBackfilling(false)
  }

  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const nowQuarter = Math.floor(now.getMonth() / 3) + 1
  const isCurrentQuarter = year === now.getFullYear() && currentQuarter === nowQuarter
  const isCurrentPeriod = periodMode === 'trimestre' ? isCurrentQuarter : isCurrentMonth
  const periodLabel = periodMode === 'trimestre'
    ? `${currentQuarter}º trimestre ${year}`
    : `${MESES_ES[month - 1]} ${year}`

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px', fontFamily: 'inherit' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>
            {isPartner ? 'Finanzas' : 'Equipo'}
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 300, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>Gastos y facturas</h1>
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

      {/* ── Saved notice ────────────────────────────────────────────────────── */}
      {savedNotice && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '10px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0',
          borderRadius: 8, marginBottom: 16,
        }}>
          <span style={{ fontSize: 12, color: '#065F46', fontWeight: 500 }}>{savedNotice}</span>
          <button onClick={() => setSavedNotice(null)} style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      {/* ── Drop-off hint (modo personal) ───────────────────────────────────── */}
      {!isPartner && scans.length === 0 && (
        <div
          onClick={() => setShowCapture(true)}
          style={{ textAlign: 'center', padding: '48px 20px', border: '2px dashed #E8E6E0', borderRadius: 12, marginBottom: 20, cursor: 'pointer', background: '#FAFAF8' }}
        >
          <p style={{ fontSize: 32, margin: '0 0 12px' }}>🧾</p>
          <p style={{ fontSize: 13, color: '#1A1A1A', margin: '0 0 6px', fontWeight: 500 }}>Escanea un ticket o sube una factura</p>
          <p style={{ fontSize: 11, color: '#888', margin: 0 }}>La IA lee los datos, tú los confirmas y el gasto queda registrado.</p>
        </div>
      )}

      {/* ── Tabs (solo partner) ─────────────────────────────────────────────── */}
      {isPartner && (
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #E8E6E0' }}>
        {([['mes', 'Por mes'], ['recientes', 'Añadidos recientemente']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => handleTabSwitch(tab)}
            style={{
              padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid #D85A30' : '2px solid transparent',
              cursor: 'pointer', fontSize: 12, fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? '#D85A30' : '#888', marginBottom: -1,
            }}
          >{label}</button>
        ))}
      </div>
      )}

      {/* ── Period navigation ───────────────────────────────────────────────── */}
      {isPartner && activeTab === 'mes' && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Toggle mes / trimestre */}
        <div style={{ display: 'flex', border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden' }}>
          {([['mes', 'Mes'], ['trimestre', 'Trimestre']] as const).map(([m, label]) => {
            const active = periodMode === m
            return (
              <button
                key={m}
                onClick={() => { if (!active) (m === 'mes' ? switchToMes() : switchToTrimestre()) }}
                disabled={isNavigating}
                style={{ padding: '6px 12px', background: active ? '#1A1A1A' : '#fff', color: active ? '#fff' : '#555', border: 'none', cursor: active ? 'default' : 'pointer', fontSize: 12, fontWeight: active ? 700 : 500 }}
              >{label}</button>
            )
          })}
        </div>
        <button onClick={prevPeriod} disabled={isNavigating} style={{ background: 'none', border: '1px solid #E8E6E0', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 14, color: '#555', opacity: isNavigating ? 0.5 : 1 }}>←</button>
        <span style={{ fontSize: 14, fontWeight: 500, color: isNavigating ? '#AAA' : '#1A1A1A', minWidth: 150, textAlign: 'center' }}>
          {isNavigating ? 'Cargando…' : periodLabel}
        </span>
        <button
          onClick={nextPeriod}
          disabled={isCurrentPeriod}
          style={{ background: 'none', border: '1px solid #E8E6E0', borderRadius: 6, padding: '6px 12px', cursor: isCurrentPeriod ? 'default' : 'pointer', fontSize: 14, color: isCurrentPeriod ? '#CCC' : '#555' }}
        >→</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {backfillMsg && (
            <span style={{ fontSize: 11, color: backfilling ? '#888' : '#1A1A1A' }}>{backfillMsg}</span>
          )}
          <button
            onClick={handleBackfillHora}
            disabled={backfilling}
            title="Volver a analizar todos los tickets para extraer la hora"
            style={{ padding: '7px 12px', background: '#fff', color: '#555', border: '1px solid #E8E6E0', borderRadius: 6, cursor: backfilling ? 'default' : 'pointer', fontSize: 11, fontWeight: 600, opacity: backfilling ? 0.6 : 1 }}
          >
            {backfilling ? '⏳ Extrayendo horas…' : '🕐 Extraer horas'}
          </button>
          <button
            onClick={() => setShowRecovery(true)}
            title="Buscar fotos subidas cuyo gasto nunca llegó a registrarse"
            style={{ padding: '7px 12px', background: '#fff', color: '#555', border: '1px solid #E8E6E0', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
          >
            🛟 Recuperar
          </button>
          <button
            onClick={handleExport}
            title={periodMode === 'trimestre' ? 'Descarga el trimestre completo (una carpeta por mes)' : 'Descarga el mes completo'}
            style={{ padding: '7px 14px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}
          >
            ↓ Exportar {periodMode === 'trimestre' ? 'trimestre' : 'mes'}
          </button>
        </div>
      </div>
      )}

      {/* ── Recientes header ────────────────────────────────────────────────── */}
      {activeTab === 'recientes' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: '#888' }}>
            {loadingRecent ? 'Cargando…' : `${recentScans.length} gastos en total`}
          </span>
        </div>
      )}

      {/* ── Summary (solo partner) ──────────────────────────────────────────── */}
      {isPartner && activeScans.length > 0 && (
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

      {/* ── Filter by tipo (solo partner) ───────────────────────────────────── */}
      {isPartner && scans.length > 0 && (
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

      {/* ── Selection toolbar (solo partner) ────────────────────────────────── */}
      {isPartner && filteredScans.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#555', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              style={{ width: 16, height: 16, accentColor: '#D85A30', cursor: 'pointer' }}
            />
            Seleccionar todo ({filteredScans.length})
          </label>
          {selectedIds.size > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#888' }}>{selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
              <button
                onClick={clearSelection}
                style={{ padding: '6px 10px', background: 'none', color: '#888', border: '1px solid #E8E6E0', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
              >Limpiar</button>
              <button
                onClick={handleExportSelection}
                disabled={isExporting}
                style={{ padding: '7px 14px', background: '#D85A30', color: '#fff', border: 'none', borderRadius: 6, cursor: isExporting ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', opacity: isExporting ? 0.6 : 1 }}
              >
                {isExporting ? '⏳ Generando…' : `↓ Descargar selección (${selectedIds.size})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {!isPartner && scans.length > 0 && (
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 10px' }}>
          Tus gastos registrados ({scans.length})
        </p>
      )}
      {filteredScans.length === 0 ? (
        isPartner ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #E8E6E0', borderRadius: 12 }}>
          <p style={{ fontSize: 32, margin: '0 0 12px' }}>🧾</p>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 6px', fontWeight: 500 }}>
            {filterTipo ? `Sin gastos de tipo "${TIPO_CONFIG[filterTipo].label}"` : activeTab === 'recientes' ? 'Sin gastos registrados' : 'Sin gastos este mes'}
          </p>
          <p style={{ fontSize: 11, color: '#BBB', margin: 0 }}>Usa el botón "Escanear" para añadir</p>
        </div>
        ) : null
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: isNavigating ? 0.5 : 1, transition: 'opacity 0.15s' }}>
          {filteredScans.map(scan => {
            const cfg = TIPO_CONFIG[scan.tipo] ?? TIPO_CONFIG.otro
            return (
              <div key={scan.id} style={{ display: 'flex', gap: 12, padding: '14px 16px', background: selectedIds.has(scan.id) ? '#FFF7ED' : '#fff', border: `1px solid ${selectedIds.has(scan.id) ? '#FED7AA' : '#E8E6E0'}`, borderRadius: 10 }}>
                {/* Checkbox de selección (solo partner) */}
                {isPartner && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(scan.id)}
                    onChange={() => toggleSelected(scan.id)}
                    style={{ width: 16, height: 16, accentColor: '#D85A30', cursor: 'pointer', alignSelf: 'center', flexShrink: 0 }}
                  />
                )}
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
                    {activeTab === 'recientes' && (
                      <span style={{ fontSize: 10, color: '#BBB' }}>
                        · añadido {new Date(scan.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
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
          onSaved={results => { results.forEach(r => handleSaved(r.scan, r.conciliado)) }}
        />
      )}

      {/* ── Recovery modal (solo partner) ───────────────────────────────────── */}
      {showRecovery && isPartner && (
        <RecoveryModal
          proyectos={proyectos}
          onClose={() => setShowRecovery(false)}
          onSaved={results => { results.forEach(r => handleSaved(r.scan, r.conciliado)) }}
        />
      )}

      {/* ── Capture modal ────────────────────────────────────────────────────── */}
      {showCapture && (
        <CaptureModal
          proyectos={proyectos}
          onClose={() => setShowCapture(false)}
          onSaved={(scan, conciliado) => { handleSaved(scan, conciliado); setShowCapture(false) }}
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
  file:        File | null      // null cuando el archivo ya está en Storage (recuperación)
  name:        string
  preview:     string | null   // object URL for images
  isPdf:       boolean
  status:      'idle' | 'uploading' | 'analyzing' | 'done' | 'error' | 'saved'
  photoUrl:    string | null
  error:       string | null
  skip:        boolean
  croppedFile: File | null     // recorte automático (jscanify), si se consiguió
  useOriginal: boolean
  // form fields
  tipo:        ExpenseType
  monto:       string
  moneda:      string
  proveedor:   string
  descripcion: string
  fechaTicket:   string
  horaTicket:    string
  ultimos4:      string
  nifProveedor:  string
  proyectoId:    string
  notas:         string
}

interface SavedResult { scan: ExpenseScan; conciliado: boolean }

function BatchUploadModal({ proyectos, onClose, onSaved, preloaded, title }: {
  proyectos: Proyecto[]
  onClose: () => void
  onSaved: (results: SavedResult[]) => void
  /** Archivos ya existentes en Storage (recuperación de huérfanos): se salta la subida */
  preloaded?: { url: string; name: string }[]
  title?: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<BatchItem[]>(() =>
    (preloaded ?? []).map(p => ({
      id:          `pre-${p.url}`,
      file:        null,
      name:        p.name,
      preview:     isPdfUrl(p.url) ? null : p.url,
      isPdf:       isPdfUrl(p.url),
      status:      'idle' as const,
      photoUrl:    p.url,
      error:       null,
      skip:        false,
      croppedFile: null,
      useOriginal: false,
      tipo:        'otro' as ExpenseType,
      monto:       '',
      moneda:      'EUR',
      proveedor:   '',
      descripcion: '',
      fechaTicket:  '',
      horaTicket:   '',
      ultimos4:     '',
      nifProveedor: '',
      proyectoId:   '',
      notas:        '',
    }))
  )
  const [stage, setStage] = useState<'select' | 'processing' | 'review'>('select')
  const [saving, setSaving] = useState(false)
  const [saveSummary, setSaveSummary] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const isRecovery = Boolean(preloaded)

  const makeItem = (file: File): BatchItem => ({
    id:          `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
    file,
    name:        file.name,
    preview:     file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    isPdf:       file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf'),
    status:      'idle',
    photoUrl:    null,
    error:       null,
    skip:        false,
    croppedFile: null,
    useOriginal: false,
    tipo:        'otro',
    monto:       '',
    moneda:      'EUR',
    proveedor:   '',
    descripcion: '',
    fechaTicket:  '',
    horaTicket:   '',
    ultimos4:     '',
    nifProveedor: '',
    proyectoId:   '',
    notas:        '',
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const newItems = files.map(makeItem)
    setItems(prev => [...prev, ...newItems])
    e.target.value = ''

    // Recorte automático en segundo plano (solo imágenes)
    for (const item of newItems) {
      if (!item.file || !item.file.type.startsWith('image/')) continue
      const file = item.file
      autocropImage(file).then(cropped => {
        if (!cropped) return
        setItems(prev => prev.map(i =>
          i.id === item.id && i.status === 'idle'
            ? { ...i, croppedFile: cropped, preview: i.useOriginal ? i.preview : URL.createObjectURL(cropped) }
            : i
        ))
      }).catch(() => {})
    }
  }

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

  const updateItem = (id: string, patch: Partial<BatchItem>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

  const toggleOriginal = (item: BatchItem) => {
    if (!item.croppedFile || !item.file) return
    const useOriginal = !item.useOriginal
    updateItem(item.id, {
      useOriginal,
      preview: URL.createObjectURL(useOriginal ? item.file : item.croppedFile),
    })
  }

  const processAll = async () => {
    if (items.length === 0) return
    setStage('processing')

    for (const item of items) {
      let uploadedUrl = item.photoUrl

      // 1. Upload (se salta si el archivo ya está en Storage — recuperación)
      if (!uploadedUrl) {
        updateItem(item.id, { status: 'uploading' })
        const fileToUpload = (!item.useOriginal && item.croppedFile) ? item.croppedFile : item.file!
        const fd = new FormData()
        fd.append('photo', fileToUpload)
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
        uploadedUrl = upRes.url
      }

      updateItem(item.id, { photoUrl: uploadedUrl, status: 'analyzing' })

      // 2. AI analysis
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
              status:       'done',
              tipo:         TIPOS.includes(d.tipo) ? d.tipo : 'otro',
              monto:        d.monto != null ? String(d.monto) : '',
              moneda:       d.moneda ?? 'EUR',
              proveedor:    d.proveedor ?? '',
              descripcion:  d.descripcion ?? '',
              fechaTicket:  d.fecha_ticket ?? '',
              horaTicket:   d.hora_ticket ?? '',
              ultimos4:     d.ultimos_4 ?? '',
              nifProveedor: d.nif_proveedor ?? '',
            })
          } else {
            // PDF contained multiple documents — expand into individual items
            const finalUrl = uploadedUrl
            setItems(prev => {
              const without = prev.filter(i => i.id !== item.id)
              const expanded: BatchItem[] = json.items!.map((d, idx) => ({
                id:          `${item.id}-split-${idx}`,
                file:        item.file,
                name:        item.name,
                preview:     item.preview,
                isPdf:       item.isPdf,
                status:      'done' as const,
                photoUrl:    finalUrl,
                error:       null,
                skip:        false,
                croppedFile: null,
                useOriginal: false,
                tipo:        (TIPOS.includes(d.tipo) ? d.tipo : 'otro') as ExpenseType,
                monto:        d.monto != null ? String(d.monto) : '',
                moneda:       d.moneda ?? 'EUR',
                proveedor:    d.proveedor ?? '',
                descripcion:  d.descripcion ?? '',
                fechaTicket:  d.fecha_ticket ?? '',
                horaTicket:   d.hora_ticket ?? '',
                ultimos4:     d.ultimos_4 ?? '',
                nifProveedor: d.nif_proveedor ?? '',
                proyectoId:   '',
                notas:        `Doc ${idx + 1}/${json.items!.length} — ${item.name}`,
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
    const toSave = items.filter(i => !i.skip && i.photoUrl && i.status !== 'error' && i.status !== 'saved')
    if (toSave.length === 0) { onClose(); return }
    setSaving(true)
    setSaveSummary(null)

    const saved: SavedResult[] = []
    let failed = 0
    for (const item of toSave) {
      const res = await saveExpenseScan({
        foto_url:      item.photoUrl!,
        fecha_ticket:  item.fechaTicket || null,
        hora_ticket:   item.horaTicket || null,
        ultimos_4:     item.ultimos4 || null,
        nif_proveedor: item.nifProveedor || null,
        monto:         item.monto ? parseFloat(item.monto) : null,
        moneda:        item.moneda,
        tipo:          item.tipo,
        proveedor:     item.proveedor || null,
        descripcion:   item.descripcion || null,
        proyecto_id:   item.proyectoId || null,
        notas:         item.notas || null,
      })
      if ('error' in res) {
        // El error queda visible en el item — nunca se descarta en silencio
        failed++
        updateItem(item.id, { status: 'error', error: res.error })
        continue
      }
      updateItem(item.id, { status: 'saved' })
      saved.push({
        conciliado: res.conciliado,
        scan: {
          id:            res.id,
          user_id:       '',
          foto_url:      item.photoUrl!,
          fecha_ticket:  item.fechaTicket || null,
          hora_ticket:   item.horaTicket || null,
          ultimos_4:     item.ultimos4 || null,
          nif_proveedor: item.nifProveedor || null,
          monto:         item.monto ? parseFloat(item.monto) : null,
          moneda:        item.moneda,
          tipo:          item.tipo,
          proveedor:     item.proveedor || null,
          descripcion:   item.descripcion || null,
          proyecto_id:   item.proyectoId || null,
          notas:         item.notas || null,
          created_at:    new Date().toISOString(),
          autor:         null,
        },
      })
    }

    setSaving(false)
    if (saved.length > 0) onSaved(saved)

    if (failed > 0) {
      setSaveSummary(`${saved.length} guardado${saved.length !== 1 ? 's' : ''}, ${failed} con error. Corrige los marcados en rojo y vuelve a guardar.`)
    } else {
      onClose()
    }
  }

  const activeItems  = items.filter(i => !i.skip && i.status !== 'saved' && i.status !== 'error')
  const pendingCount = items.filter(i => i.status === 'uploading' || i.status === 'analyzing').length
  const doneCount    = items.filter(i => i.status === 'done' || i.status === 'error').length

  return (
    <ModalShell title={title ?? 'Subida manual de archivos'} onClose={onClose}>

      {/* Drop / select zone */}
      {stage === 'select' && !isRecovery && (
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
              JPG, PNG, WEBP, PDF · Múltiples archivos permitidos · Las fotos se recortan automáticamente
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
                border: `1px solid ${item.status === 'error' ? '#FECACA' : item.status === 'saved' ? '#A7F3D0' : item.skip ? '#F3F4F6' : '#E8E6E0'}`,
                borderRadius: 8, overflow: 'hidden',
                opacity: item.skip || item.status === 'saved' ? 0.55 : 1,
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
                      {item.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {item.status === 'idle' && <span style={{ fontSize: 10, color: '#AAA' }}>En cola{item.croppedFile && !item.useOriginal ? ' · ✂ recortado' : ''}</span>}
                      {item.status === 'uploading' && <><Spinner size={10} /><span style={{ fontSize: 10, color: '#888' }}>Subiendo…</span></>}
                      {item.status === 'analyzing' && <><Spinner size={10} /><span style={{ fontSize: 10, color: '#92400E' }}>Analizando con IA…</span></>}
                      {(item.status === 'done' || item.status === 'saved') && <span style={{ fontSize: 10, color: cfg.color, background: cfg.bg, padding: '1px 6px', borderRadius: 4 }}>{cfg.icon} {cfg.label}</span>}
                      {item.status === 'error' && <span style={{ fontSize: 10, color: '#DC2626' }}>Error: {item.error}</span>}
                      {(item.status === 'done' || item.status === 'saved') && item.monto && <span style={{ fontSize: 10, color: '#555', fontWeight: 600 }}>{fmtMoney(parseFloat(item.monto), item.moneda)}</span>}
                      {item.status === 'saved' && <span style={{ fontSize: 10, color: '#065F46', fontWeight: 700 }}>✓ guardado</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {stage === 'select' && item.croppedFile && (
                      <button
                        onClick={() => toggleOriginal(item)}
                        title={item.useOriginal ? 'Usar la versión recortada' : 'Usar la foto original sin recortar'}
                        style={{ fontSize: 10, padding: '3px 8px', background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, cursor: 'pointer', color: '#555' }}
                      >{item.useOriginal ? '✂ Recortar' : '↩ Original'}</button>
                    )}
                    {stage === 'review' && (item.status === 'done' || item.status === 'error') && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        style={{ fontSize: 10, padding: '3px 8px', background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, cursor: 'pointer', color: '#555' }}
                      >{isExpanded ? 'Cerrar' : 'Editar'}</button>
                    )}
                    {stage === 'review' && item.status === 'done' && (
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
                    {item.status === 'error' && (
                      <button
                        onClick={() => updateItem(item.id, { status: 'done', error: null })}
                        style={{ ...btnGhost, marginTop: 10, fontSize: 11 }}
                      >Marcar como corregido para reintentar</button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add more button in select stage */}
      {stage === 'select' && items.length > 0 && !isRecovery && (
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

      {/* Save summary (errores visibles) */}
      {saveSummary && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: '#991B1B', margin: 0, fontWeight: 500 }}>{saveSummary}</p>
        </div>
      )}

      {/* Footer buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>{saveSummary ? 'Cerrar' : 'Cancelar'}</button>
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

// ── RecoveryModal ──────────────────────────────────────────────────────────────
// Fotos que se subieron al bucket pero cuyo gasto nunca se registró en BD
// (guardados fallidos en silencio). Permite re-analizarlas o borrarlas.

function RecoveryModal({ proyectos, onClose, onSaved }: {
  proyectos: Proyecto[]
  onClose: () => void
  onSaved: (results: SavedResult[]) => void
}) {
  const [orphans, setOrphans]   = useState<OrphanScanFile[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState<{ url: string; name: string }[] | null>(null)

  const loadOrphans = async () => {
    setLoading(true)
    setError(null)
    const res = await findOrphanScanFiles()
    if ('error' in res) setError(res.error)
    else {
      setOrphans(res)
      setSelected(new Set(res.map(o => o.path)))
    }
    setLoading(false)
  }

  useEffect(() => { loadOrphans() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelected = (path: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleDeleteOrphan = async (orphan: OrphanScanFile) => {
    if (!confirm(`¿Borrar definitivamente el archivo "${orphan.name}"?`)) return
    const res = await deleteOrphanScanFile(orphan.path)
    if ('error' in res) { alert(res.error); return }
    setOrphans(prev => prev.filter(o => o.path !== orphan.path))
    setSelected(prev => { const next = new Set(prev); next.delete(orphan.path); return next })
  }

  if (importing) {
    return (
      <BatchUploadModal
        proyectos={proyectos}
        preloaded={importing}
        title={`Recuperar ${importing.length} archivo${importing.length !== 1 ? 's' : ''}`}
        onSaved={onSaved}
        onClose={() => { setImporting(null); loadOrphans() }}
      />
    )
  }

  const selectedOrphans = orphans.filter(o => selected.has(o.path))

  return (
    <ModalShell title="Recuperar tickets perdidos" onClose={onClose}>
      <p style={{ fontSize: 11, color: '#888', margin: '0 0 14px', lineHeight: 1.5 }}>
        Estos archivos se subieron al escanear pero su gasto nunca llegó a registrarse.
        Selecciona los que quieras re-analizar con la IA y registrar.
      </p>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0', justifyContent: 'center' }}>
          <Spinner /> <span style={{ fontSize: 12, color: '#888' }}>Buscando archivos huérfanos…</span>
        </div>
      )}

      {error && <p style={{ fontSize: 12, color: '#DC2626', margin: '0 0 12px' }}>{error}</p>}

      {!loading && !error && orphans.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 16px', border: '2px dashed #E8E6E0', borderRadius: 10, marginBottom: 16 }}>
          <p style={{ fontSize: 24, margin: '0 0 8px' }}>✅</p>
          <p style={{ fontSize: 12, color: '#555', margin: 0, fontWeight: 500 }}>No hay archivos perdidos: todo lo subido está registrado.</p>
        </div>
      )}

      {!loading && orphans.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
          {orphans.map(orphan => (
            <div key={orphan.path} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #E8E6E0', borderRadius: 8 }}>
              <input
                type="checkbox"
                checked={selected.has(orphan.path)}
                onChange={() => toggleSelected(orphan.path)}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              />
              <ScanThumb url={orphan.url} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: '#1A1A1A', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{orphan.name}</p>
                <p style={{ fontSize: 10, color: '#AAA', margin: 0 }}>
                  {orphan.created_at ? `Subido ${new Date(orphan.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Fecha desconocida'}
                  {orphan.size ? ` · ${(orphan.size / 1024).toFixed(0)} KB` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDeleteOrphan(orphan)}
                title="Borrar archivo definitivamente"
                style={{ fontSize: 11, padding: '4px 8px', background: 'none', border: '1px solid #FECACA', borderRadius: 5, cursor: 'pointer', color: '#DC2626', flexShrink: 0 }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cerrar</button>
        {orphans.length > 0 && (
          <button
            onClick={() => setImporting(selectedOrphans.map(o => ({ url: o.url, name: o.name })))}
            disabled={selectedOrphans.length === 0}
            style={{ ...btnDark, flex: 2, opacity: selectedOrphans.length === 0 ? 0.4 : 1 }}
          >
            Re-analizar {selectedOrphans.length} archivo{selectedOrphans.length !== 1 ? 's' : ''}
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
  onSaved: (scan: ExpenseScan, conciliado: boolean) => void
}) {
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const cameraInputRef  = useRef<HTMLInputElement>(null)

  const [preview, setPreview]   = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [cropping, setCropping]   = useState(false)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [croppedFile, setCroppedFile]   = useState<File | null>(null)
  const [usingOriginal, setUsingOriginal] = useState(false)
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
  const [fechaTicket,  setFechaTicket]  = useState('')
  const [horaTicket,   setHoraTicket]   = useState('')
  const [ultimos4,     setUltimos4]     = useState('')
  const [nifProveedor, setNifProveedor] = useState('')
  const [proyectoId,   setProyectoId]   = useState('')
  const [notas,        setNotas]        = useState('')

  const uploadFile = async (file: File): Promise<string | null> => {
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
    if ('error' in upRes) { setError(upRes.error); return null }
    return upRes.url
  }

  const handleFile = async (file: File) => {
    setError(null)
    setOriginalFile(file)
    setPreview(URL.createObjectURL(file))

    // 1. Recorte automático del documento (solo imágenes)
    let fileToUpload = file
    if (file.type.startsWith('image/')) {
      setCropping(true)
      const cropped = await autocropImage(file).catch(() => null)
      setCropping(false)
      if (cropped) {
        setCroppedFile(cropped)
        setPreview(URL.createObjectURL(cropped))
        fileToUpload = cropped
      }
    }

    // 2. Upload photo
    const url = await uploadFile(fileToUpload)
    if (!url) return
    setPhotoUrl(url)

    // 3. Run AI scan
    setScanning(true)
    try {
      const scanRes = await fetch('/api/scan-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
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
        if (d.hora_ticket)                     setHoraTicket(d.hora_ticket)
        if (d.ultimos_4)                       setUltimos4(d.ultimos_4)
        if (d.nif_proveedor)                   setNifProveedor(d.nif_proveedor)
      }
    } catch {
      // AI failed silently — user can fill in manually
    }
    setScanning(false)
  }

  // Alternar entre la foto original y el recorte automático (re-sube la elegida,
  // los datos ya extraídos se conservan)
  const handleToggleOriginal = async () => {
    if (!originalFile || !croppedFile) return
    const useOriginal = !usingOriginal
    const file = useOriginal ? originalFile : croppedFile
    setUsingOriginal(useOriginal)
    setPreview(URL.createObjectURL(file))
    const url = await uploadFile(file)
    if (url) setPhotoUrl(url)
  }

  const handleSave = async () => {
    if (!photoUrl) return
    setSaving(true)
    setError(null)
    const res = await saveExpenseScan({
      foto_url:      photoUrl,
      fecha_ticket:  fechaTicket || null,
      hora_ticket:   horaTicket || null,
      ultimos_4:     ultimos4 || null,
      nif_proveedor: nifProveedor || null,
      monto:         monto ? parseFloat(monto) : null,
      moneda,
      tipo,
      proveedor:     proveedor || null,
      descripcion:   descripcion || null,
      proyecto_id:   proyectoId || null,
      notas:         notas || null,
    })
    setSaving(false)
    if ('error' in res) { setError(res.error); return }

    const scan: ExpenseScan = {
      id:            res.id,
      user_id:       '',
      foto_url:      photoUrl,
      fecha_ticket:  fechaTicket || null,
      hora_ticket:   horaTicket || null,
      ultimos_4:     ultimos4 || null,
      nif_proveedor: nifProveedor || null,
      monto:         monto ? parseFloat(monto) : null,
      moneda,
      tipo,
      proveedor:     proveedor || null,
      descripcion:   descripcion || null,
      proyecto_id:   proyectoId || null,
      notas:         notas || null,
      created_at:    new Date().toISOString(),
      autor:         null,
    }
    onSaved(scan, res.conciliado)
  }

  return (
    <ModalShell title="Escanear ticket o factura" onClose={onClose}>
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
        <div style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #E8E6E0', maxHeight: 220 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', background: '#F8F7F4' }} />
            {(cropping || uploading || scanning) && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Spinner />
                <p style={{ fontSize: 12, color: '#555', margin: 0 }}>
                  {cropping ? 'Recortando documento…' : uploading ? 'Subiendo foto…' : 'Leyendo con IA…'}
                </p>
              </div>
            )}
          </div>
          {croppedFile && !cropping && !uploading && (
            <button
              onClick={handleToggleOriginal}
              style={{ marginTop: 6, fontSize: 10, padding: '3px 10px', background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, cursor: 'pointer', color: '#888' }}
            >
              {usingOriginal ? '✂ Usar recorte automático' : '↩ Usar foto original'}
            </button>
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
  const [fechaTicket,  setFechaTicket]  = useState(scan.fecha_ticket  ?? '')
  const [horaTicket,   setHoraTicket]   = useState(scan.hora_ticket   ?? '')
  const [ultimos4,     setUltimos4]     = useState(scan.ultimos_4     ?? '')
  const [nifProveedor, setNifProveedor] = useState(scan.nif_proveedor ?? '')
  const [proyectoId,   setProyectoId]   = useState(scan.proyecto_id   ?? '')
  const [notas,      setNotas]       = useState(scan.notas ?? '')
  const [saving, setSaving]          = useState(false)
  const [error, setError]            = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const res = await updateExpenseScan(scan.id, {
      fecha_ticket:  fechaTicket || null,
      hora_ticket:   horaTicket || null,
      ultimos_4:     ultimos4 || null,
      nif_proveedor: nifProveedor || null,
      monto:         monto ? parseFloat(monto) : null,
      moneda,
      tipo,
      proveedor:     proveedor || null,
      descripcion:   descripcion || null,
      proyecto_id:   proyectoId || null,
      notas:         notas || null,
    })
    setSaving(false)
    if ('error' in res) { setError(res.error); return }
    onSaved({ ...scan, tipo, monto: monto ? parseFloat(monto) : null, moneda, proveedor: proveedor || null, descripcion: descripcion || null, fecha_ticket: fechaTicket || null, hora_ticket: horaTicket || null, ultimos_4: ultimos4 || null, nif_proveedor: nifProveedor || null, proyecto_id: proyectoId || null, notas: notas || null })
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
