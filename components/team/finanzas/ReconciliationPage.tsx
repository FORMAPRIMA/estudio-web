'use client'

import { useState, useRef } from 'react'
import {
  linkTransaction,
  unlinkTransaction,
  updateTipoFiscal,
  deleteStatement,
  type BankStatement,
  type BankTransaction,
} from '@/app/actions/bank-statements'
import { type ExpenseScan } from '@/app/actions/expense-scans'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Proyecto { id: string; nombre: string; codigo: string | null }

interface Props {
  initialStatements:   BankStatement[]
  initialTransactions: BankTransaction[]
  initialScans:        ExpenseScan[]
  proyectos:           Proyecto[]
  initialYear:         number
  initialMonth:        number
  activeStatementId:   string | null
}

// ── Config ────────────────────────────────────────────────────────────────────

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const TIPOS_FISCALES = [
  { value: 'pendiente',      label: 'Pendiente' },
  { value: 'deducible',      label: 'Deducible' },
  { value: 'no deducible',   label: 'No deducible' },
  { value: 'gasto socio',    label: 'Gasto socio' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number | null, currency = 'EUR') {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n)
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })
}

function isPdfUrl(url: string | null) {
  if (!url) return false
  return url.toLowerCase().split('?')[0].endsWith('.pdf')
}

// ── ScanThumb ─────────────────────────────────────────────────────────────────

function ScanThumb({ url, size = 48 }: { url: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const pdf = isPdfUrl(url)
  const showFallback = pdf || imgError || !url
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: 6, overflow: 'hidden',
        background: pdf ? '#EEF2FF' : '#F8F7F4',
        border: `1px solid ${pdf ? '#C7D2FE' : '#E8E6E0'}`,
        position: 'relative',
      }}
    >
      {showFallback ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: size * 0.4 }}>📄</span>
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReconciliationPage({
  initialStatements,
  initialTransactions,
  initialScans,
  initialYear,
  initialMonth,
  activeStatementId,
}: Props) {
  // inject spin keyframe once
  if (typeof document !== 'undefined' && !document.getElementById('recon-spin-style')) {
    const s = document.createElement('style')
    s.id = 'recon-spin-style'
    s.textContent = '@keyframes reconSpin { to { transform: rotate(360deg); } }'
    document.head.appendChild(s)
  }

  const [year, setYear]           = useState(initialYear)
  const [month, setMonth]         = useState(initialMonth)
  const [transactions, setTx]     = useState<BankTransaction[]>(initialTransactions)
  const [scans]                   = useState<ExpenseScan[]>(initialScans)
  const [statements]              = useState<BankStatement[]>(initialStatements)
  const [statementId]             = useState<string | null>(activeStatementId)

  // Upload modal
  const [showUpload, setShowUpload]   = useState(false)
  const [uploadFile, setUploadFile]   = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [uploadResult, setUploadResult] = useState<{ total: number; matched: number; unmatched: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Link modal
  const [linkingTxId, setLinkingTxId]   = useState<string | null>(null)
  const [linkingTxDate, setLinkingTxDate] = useState<string | null>(null)

  // Computed stats
  const total      = transactions.length
  const linked     = transactions.filter(t => t.expense_scan_id != null).length
  const noTicket   = total - linked
  const pendFiscal = transactions.filter(t => t.tipo_fiscal === 'pendiente' || !t.tipo_fiscal).length

  const activeStatement = statements.find(s => s.id === statementId) ?? null

  // ── Month navigation ────────────────────────────────────────────────────────

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1)
    const y = d.getFullYear(); const m = d.getMonth() + 1
    setYear(y); setMonth(m)
    window.location.href = `/team/finanzas/conciliacion?year=${y}&month=${m}`
  }
  const nextMonth = () => {
    const d = new Date(year, month, 1)
    const now = new Date()
    if (d > now) return
    const y = d.getFullYear(); const m = d.getMonth() + 1
    setYear(y); setMonth(m)
    window.location.href = `/team/finanzas/conciliacion?year=${y}&month=${m}`
  }

  const isCurrentMonth = year === initialYear && month === initialMonth

  // ── Upload handler ──────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadError(null)
    setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('year', String(year))
      fd.append('month', String(month))
      const res = await fetch('/api/bank-statement', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || json.error) {
        setUploadError(json.error ?? 'Error al procesar el extracto.')
      } else {
        setUploadResult({ total: json.total, matched: json.matched, unmatched: json.unmatched })
        // Reload to show new data
        setTimeout(() => {
          window.location.href = `/team/finanzas/conciliacion?year=${year}&month=${month}`
        }, 1500)
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Error inesperado.')
    } finally {
      setUploading(false)
    }
  }

  // ── Delete statement ────────────────────────────────────────────────────────

  const handleDeleteStatement = async () => {
    if (!statementId) return
    if (!confirm('¿Eliminar este extracto y todas sus transacciones?')) return
    const res = await deleteStatement(statementId)
    if ('error' in res) { alert(res.error); return }
    window.location.href = `/team/finanzas/conciliacion?year=${year}&month=${month}`
  }

  // ── Link / unlink ───────────────────────────────────────────────────────────

  const handleLink = async (txId: string, scanId: string) => {
    const res = await linkTransaction(txId, scanId)
    if ('error' in res) { alert(res.error); return }
    setTx(prev => prev.map(t => {
      if (t.id !== txId) return t
      const scan = scans.find(s => s.id === scanId)
      return {
        ...t,
        expense_scan_id:  scanId,
        match_confidence: 'manual',
        linked_scan: scan ? {
          foto_url:     scan.foto_url,
          tipo:         scan.tipo,
          monto:        scan.monto,
          fecha_ticket: scan.fecha_ticket,
          proveedor:    scan.proveedor,
        } : null,
      }
    }))
    setLinkingTxId(null)
  }

  const handleUnlink = async (txId: string) => {
    const res = await unlinkTransaction(txId)
    if ('error' in res) { alert(res.error); return }
    setTx(prev => prev.map(t =>
      t.id !== txId ? t : { ...t, expense_scan_id: null, match_confidence: null, linked_scan: null }
    ))
  }

  const handleTipoFiscal = async (txId: string, value: string) => {
    setTx(prev => prev.map(t => t.id !== txId ? t : { ...t, tipo_fiscal: value }))
    await updateTipoFiscal(txId, value)
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = () => {
    if (!statementId) return
    window.open(`/api/bank-statement/export?statement_id=${statementId}`, '_blank')
  }

  // ── Link modal: sort scans by proximity to transaction date ─────────────────

  const scansSortedByProximity = linkingTxDate
    ? [...scans]
        .filter(s => !transactions.find(t => t.expense_scan_id === s.id))
        .sort((a, b) => {
          const dateA = a.fecha_ticket ? Math.abs(new Date(a.fecha_ticket).getTime() - new Date(linkingTxDate).getTime()) : Infinity
          const dateB = b.fecha_ticket ? Math.abs(new Date(b.fecha_ticket).getTime() - new Date(linkingTxDate).getTime()) : Infinity
          return dateA - dateB
        })
    : scans.filter(s => !transactions.find(t => t.expense_scan_id === s.id))

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 16px', fontFamily: 'inherit' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>Finanzas</p>
          <h1 style={{ fontSize: 20, fontWeight: 300, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>Conciliación bancaria</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => { setShowUpload(true); setUploadResult(null); setUploadError(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', background: '#D85A30', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
            }}
          >
            <span style={{ fontSize: 14 }}>↑</span> Subir extracto
          </button>
          <button
            onClick={handleExport}
            disabled={!statementId}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', background: statementId ? '#1A1A1A' : '#E8E6E0',
              color: statementId ? '#fff' : '#AAA',
              border: 'none', borderRadius: 8,
              cursor: statementId ? 'pointer' : 'default',
              fontSize: 12, fontWeight: 600,
            }}
          >
            ↓ Exportar ZIP
          </button>
        </div>
      </div>

      {/* ── Month navigation ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={prevMonth}
          style={{ background: 'none', border: '1px solid #E8E6E0', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 14, color: '#555' }}
        >←</button>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', minWidth: 140, textAlign: 'center' }}>
          {MESES_ES[month - 1]} {year}
        </span>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          style={{
            background: 'none', border: '1px solid #E8E6E0', borderRadius: 6,
            padding: '6px 12px',
            cursor: isCurrentMonth ? 'default' : 'pointer',
            fontSize: 14, color: isCurrentMonth ? '#CCC' : '#555',
          }}
        >→</button>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          <div style={{ padding: '14px 16px', background: '#F8F7F4', border: '1px solid #E8E6E0', borderRadius: 8 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>Total</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>{total}</p>
            <p style={{ fontSize: 10, color: '#888', margin: '2px 0 0' }}>transacciones</p>
          </div>
          <div style={{ padding: '14px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#166534', margin: '0 0 4px' }}>Vinculadas</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#16A34A', margin: 0 }}>{linked}</p>
            <p style={{ fontSize: 10, color: '#166534', margin: '2px 0 0' }}>con ticket</p>
          </div>
          <div style={{ padding: '14px 16px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9A3412', margin: '0 0 4px' }}>Sin ticket</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#D85A30', margin: 0 }}>{noTicket}</p>
            <p style={{ fontSize: 10, color: '#9A3412', margin: '2px 0 0' }}>sin vincular</p>
          </div>
          <div style={{ padding: '14px 16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', margin: '0 0 4px' }}>Pend. fiscal</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#6B7280', margin: 0 }}>{pendFiscal}</p>
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '2px 0 0' }}>sin clasificar</p>
          </div>
        </div>
      )}

      {/* ── Statement info bar ───────────────────────────────────────────────── */}
      {activeStatement && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: '#F8F7F4', border: '1px solid #E8E6E0',
          borderRadius: 8, marginBottom: 16, gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
                {activeStatement.filename ?? 'Extracto bancario'}
              </p>
              <p style={{ fontSize: 10, color: '#888', margin: 0 }}>
                Subido el {new Date(activeStatement.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                {' · '}{activeStatement.row_count ?? 0} filas
              </p>
            </div>
          </div>
          <button
            onClick={handleDeleteStatement}
            style={{
              fontSize: 11, padding: '5px 10px', background: 'none',
              border: '1px solid #FECACA', borderRadius: 5,
              cursor: 'pointer', color: '#DC2626', flexShrink: 0,
            }}
          >
            Eliminar extracto
          </button>
        </div>
      )}

      {/* ── Transaction list / empty state ──────────────────────────────────── */}
      {transactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #E8E6E0', borderRadius: 12 }}>
          <p style={{ fontSize: 32, margin: '0 0 12px' }}>🏦</p>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 6px', fontWeight: 500 }}>Sin extracto para este mes</p>
          <p style={{ fontSize: 11, color: '#BBB', margin: '0 0 20px' }}>Sube el extracto bancario para comenzar la conciliación</p>
          <button
            onClick={() => { setShowUpload(true); setUploadResult(null); setUploadError(null) }}
            style={{
              padding: '10px 20px', background: '#D85A30', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
            }}
          >
            ↑ Subir extracto
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {transactions.map(tx => {
            const isExpense = (tx.importe ?? 0) < 0
            const isLinked  = tx.expense_scan_id != null
            return (
              <div
                key={tx.id}
                style={{
                  display: 'flex', gap: 12, padding: '12px 14px',
                  background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10,
                  alignItems: 'flex-start',
                }}
              >
                {/* Left: date + concepto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, color: '#AAA', margin: '0 0 2px' }}>{fmtDate(tx.fecha)}</p>
                  <p style={{
                    fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {tx.concepto ?? '—'}
                  </p>
                  {/* Linked scan info */}
                  {isLinked && tx.linked_scan && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <ScanThumb url={tx.linked_scan.foto_url} size={36} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 10, fontWeight: 600, color: '#166534', margin: 0 }}>
                          {tx.linked_scan.proveedor ?? '—'}
                        </p>
                        <p style={{ fontSize: 10, color: '#888', margin: 0 }}>
                          {fmtDate(tx.linked_scan.fecha_ticket)} · {fmtMoney(tx.linked_scan.monto)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUnlink(tx.id)}
                        style={{
                          fontSize: 10, padding: '2px 7px', background: 'none',
                          border: '1px solid #FECACA', borderRadius: 4,
                          cursor: 'pointer', color: '#DC2626', marginLeft: 'auto', flexShrink: 0,
                        }}
                      >
                        × desvincular
                      </button>
                    </div>
                  )}
                </div>

                {/* Center: importe + badges */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 16, fontWeight: 600,
                    color: isExpense ? '#DC2626' : '#16A34A',
                  }}>
                    {fmtMoney(tx.importe, tx.moneda)}
                  </span>

                  {/* Match badge */}
                  {isLinked ? (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px',
                      background: '#DCFCE7', color: '#166534',
                      borderRadius: 20, letterSpacing: '0.03em',
                    }}>
                      ✓ Vinculado
                    </span>
                  ) : (
                    <button
                      onClick={() => { setLinkingTxId(tx.id); setLinkingTxDate(tx.fecha) }}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px',
                        background: '#FFF7ED', color: '#D85A30',
                        border: '1px solid #FED7AA', borderRadius: 20,
                        cursor: 'pointer', letterSpacing: '0.03em',
                      }}
                    >
                      ○ Sin ticket
                    </button>
                  )}

                  {/* Fiscal type selector */}
                  <select
                    value={tx.tipo_fiscal ?? 'pendiente'}
                    onChange={e => handleTipoFiscal(tx.id, e.target.value)}
                    style={{
                      fontSize: 10, padding: '3px 6px',
                      border: '1px solid #E8E6E0', borderRadius: 5,
                      background: '#F8F7F4', color: '#555',
                      cursor: 'pointer', maxWidth: 120,
                    }}
                  >
                    {TIPOS_FISCALES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Upload modal ─────────────────────────────────────────────────────── */}
      {showUpload && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowUpload(false) }}
        >
          <div style={{
            background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 420,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>Subir extracto bancario</h2>
              <button
                onClick={() => setShowUpload(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888', lineHeight: 1 }}
              >×</button>
            </div>

            {/* File picker */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #E8E6E0', borderRadius: 8, padding: '24px 16px',
                textAlign: 'center', cursor: 'pointer', marginBottom: 16,
                background: uploadFile ? '#F0FDF4' : '#F8F7F4',
                borderColor: uploadFile ? '#86EFAC' : '#E8E6E0',
              }}
            >
              <p style={{ fontSize: 24, margin: '0 0 6px' }}>{uploadFile ? '✅' : '📂'}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: uploadFile ? '#166534' : '#555', margin: '0 0 3px' }}>
                {uploadFile ? uploadFile.name : 'Haz clic para seleccionar archivo'}
              </p>
              <p style={{ fontSize: 10, color: '#AAA', margin: 0 }}>
                {uploadFile ? `${(uploadFile.size / 1024).toFixed(0)} KB` : 'Formatos: .xlsx, .xls, .csv'}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={e => {
                const f = e.target.files?.[0] ?? null
                setUploadFile(f)
                setUploadError(null)
                setUploadResult(null)
              }}
              style={{ display: 'none' }}
            />

            {/* Month display */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, padding: '10px 12px', background: '#F8F7F4', border: '1px solid #E8E6E0', borderRadius: 6 }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 2px' }}>Mes</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>{MESES_ES[month - 1]} {year}</p>
              </div>
            </div>

            {/* Error */}
            {uploadError && (
              <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{uploadError}</p>
              </div>
            )}

            {/* Success */}
            {uploadResult && (
              <div style={{ padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: '#166534', margin: 0, fontWeight: 600 }}>
                  ✓ Extracto procesado: {uploadResult.total} transacciones · {uploadResult.matched} vinculadas automáticamente
                </p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              style={{
                width: '100%', padding: '12px 0',
                background: !uploadFile || uploading ? '#E8E6E0' : '#D85A30',
                color: !uploadFile || uploading ? '#AAA' : '#fff',
                border: 'none', borderRadius: 8, cursor: !uploadFile || uploading ? 'default' : 'pointer',
                fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {uploading ? (
                <>
                  <span style={{
                    display: 'inline-block', width: 14, height: 14,
                    border: '2px solid #AAA', borderTopColor: 'transparent',
                    borderRadius: '50%', animation: 'reconSpin 0.8s linear infinite',
                  }} />
                  Procesando…
                </>
              ) : 'Procesar extracto'}
            </button>
          </div>
        </div>
      )}

      {/* ── Link modal ───────────────────────────────────────────────────────── */}
      {linkingTxId && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setLinkingTxId(null) }}
        >
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>Vincular ticket</h2>
              <button
                onClick={() => setLinkingTxId(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888', lineHeight: 1 }}
              >×</button>
            </div>

            {scansSortedByProximity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', flex: 1 }}>
                <p style={{ fontSize: 32, margin: '0 0 10px' }}>🧾</p>
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>No hay tickets sin vincular este mes</p>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scansSortedByProximity.map(scan => (
                  <button
                    key={scan.id}
                    onClick={() => handleLink(linkingTxId, scan.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', background: '#F8F7F4',
                      border: '1px solid #E8E6E0', borderRadius: 8,
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                  >
                    <ScanThumb url={scan.foto_url} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {scan.proveedor ?? scan.descripcion ?? '—'}
                      </p>
                      <p style={{ fontSize: 10, color: '#888', margin: 0 }}>
                        {fmtDate(scan.fecha_ticket)}
                      </p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', flexShrink: 0 }}>
                      {fmtMoney(scan.monto, scan.moneda)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
