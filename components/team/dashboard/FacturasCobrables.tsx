'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { aplazarFactura } from '@/app/actions/facturacion'

export interface FacturaCobrable {
  id:              string
  concepto:        string
  monto:           number
  proyecto_id:     string
  proyecto_nombre: string
  proyecto_codigo: string | null
}

const eur = (n: number) =>
  `€ ${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`

export default function FacturasCobrables({ facturas }: { facturas: FacturaCobrable[] }) {
  if (facturas.length === 0) return null

  return (
    <div style={{ background: '#EFF6FF', borderBottom: '1px solid #BFDBFE', padding: '14px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>

        {/* Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, flexShrink: 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#2563EB',
            display: 'inline-block', boxShadow: '0 0 0 3px #BFDBFE', flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1D4ED8', whiteSpace: 'nowrap' }}>
            {facturas.length === 1 ? '1 factura lista para emitir' : `${facturas.length} facturas listas para emitir`}
          </span>
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
          {facturas.map(f => <FacturaPill key={f.id} factura={f} />)}
        </div>

      </div>
    </div>
  )
}

// ── Pill individual ────────────────────────────────────────────────────────────

function FacturaPill({ factura }: { factura: FacturaCobrable }) {
  const router = useRouter()
  const [aplazando, setAplazando] = useState(false)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  const handleAplazar = () => {
    if (!nuevaFecha) return
    setSaving(true)
    startTransition(async () => {
      await aplazarFactura(factura.id, factura.proyecto_id, nuevaFecha)
      setSaving(false)
      setAplazando(false)
      router.refresh()
    })
  }

  const handleRevision = () => {
    router.push(`/team/finanzas/facturacion/emitidas?from=${factura.id}`)
  }

  return (
    <>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '6px 6px 6px 14px',
        background: '#fff', border: '1px solid #93C5FD', borderRadius: 24,
      }}>
        {/* Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 10, color: '#64748B' }}>
            {factura.proyecto_codigo ? `${factura.proyecto_codigo} · ` : ''}{factura.proyecto_nombre}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1E40AF' }}>{factura.concepto}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#D85A30', fontVariantNumeric: 'tabular-nums' }}>
              {eur(factura.monto)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button
            onClick={() => setAplazando(true)}
            style={{
              height: 28, padding: '0 10px', background: 'none',
              border: '1px solid #93C5FD', borderRadius: 14,
              cursor: 'pointer', fontSize: 11, color: '#3B82F6', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#EFF6FF' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
          >
            Aplazar cobro
          </button>
          <button
            onClick={handleRevision}
            style={{
              height: 28, padding: '0 12px', background: '#1D4ED8',
              border: 'none', borderRadius: 14,
              cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#D85A30' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1D4ED8' }}
          >
            Revisión final →
          </button>
        </div>
      </div>

      {/* Modal aplazar */}
      {aplazando && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setAplazando(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 12, padding: '32px 36px',
            width: 360, boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 6px' }}>
                Aplazar cobro
              </p>
              <h3 style={{ fontSize: 18, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>
                {factura.concepto}
              </h3>
              <p style={{ fontSize: 13, color: '#D85A30', fontWeight: 600, margin: '4px 0 0' }}>
                {eur(factura.monto)}
              </p>
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 8 }}>
                Nueva fecha estimada de cobro
              </label>
              <input
                type="date"
                value={nuevaFecha}
                onChange={e => setNuevaFecha(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                autoFocus
                style={{
                  width: '100%', height: 40, padding: '0 12px', fontSize: 14,
                  border: '1px solid #E8E6E0', borderRadius: 6, outline: 'none',
                  fontFamily: 'inherit', color: '#1A1A1A', boxSizing: 'border-box',
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleAplazar() }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAplazando(false)}
                style={{ height: 36, padding: '0 16px', background: 'none', border: '1px solid #E8E6E0', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#888' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAplazar}
                disabled={!nuevaFecha || saving}
                style={{
                  height: 36, padding: '0 20px',
                  background: !nuevaFecha || saving ? '#CCC' : '#1A1A1A',
                  color: '#fff', border: 'none', borderRadius: 6,
                  cursor: !nuevaFecha || saving ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {saving ? 'Guardando…' : 'Guardar nueva fecha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
