'use client'

import { useMemo, useState } from 'react'
import { eur, num, pct, type Escenario } from '@/lib/modelo-cafe/domain'
import { derivarEscenarios, type EscenarioClave } from '@/lib/modelo-cafe/dossier'
import { capexTotal, totalPorCategoria, type CapexItem } from '@/lib/modelo-cafe/capex'
import { C, panelStyle, h2Style } from './theme'

const dscrFmt = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`
const mesesFmt = (m: number) => (m > 0 ? `${Math.round(m)} meses` : '—')

export default function DossierTab({ escenarios, capex }: { escenarios: Escenario[]; capex: CapexItem[] }) {
  const [conservadorId, setConservadorId] = useState<string>(escenarios[0].id)
  const [pesimistaPct, setPesimistaPct] = useState(-30)  // % sobre cafés/día
  const [optimistaPct, setOptimistaPct] = useState(40)
  const [incluirCapex, setIncluirCapex] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const conservador = escenarios.find((e) => e.id === conservadorId) ?? escenarios[0]

  const capexTot = useMemo(() => Math.round(capexTotal(capex)), [capex])
  // Inputs efectivos: si se incluye el CAPEX, sustituye el equipamiento del escenario.
  const inputs = useMemo(
    () => (incluirCapex ? { ...conservador.inputs, equipo: capexTot } : conservador.inputs),
    [conservador, incluirCapex, capexTot]
  )

  const tres = useMemo(
    () => derivarEscenarios(inputs, pesimistaPct / 100, optimistaPct / 100),
    [inputs, pesimistaPct, optimistaPct]
  )

  const generar = async () => {
    setError(null)
    setIsGenerating(true)
    try {
      const res = await fetch('/api/modelo-cafe/dossier-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs,
          escenarioNombre: conservador.nombre,
          pesimistaPct: pesimistaPct / 100,
          optimistaPct: optimistaPct / 100,
          capexDetalle: incluirCapex
            ? Object.entries(totalPorCategoria(capex)).map(([categoria, importe]) => ({ categoria, importe }))
            : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudo generar el dossier.')
      }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
    } finally {
      setIsGenerating(false)
    }
  }

  const cols: EscenarioClave[] = ['pesimista', 'conservador', 'optimista']
  const filas: [string, (i: number) => string][] = [
    ['Cafés/día', (i) => num(tres[i].cafesDia)],
    ['Facturación anual', (i) => eur(tres[i].facturacionAnual)],
    ['Margen bruto', (i) => pct(tres[i].margenBrutoPct)],
    ['EBITDA anual', (i) => eur(tres[i].ebitdaAnual)],
    ['Beneficio neto anual', (i) => eur(tres[i].netoAnual)],
    ['Margen neto', (i) => pct(tres[i].margenNeto)],
    ['Caja/mes arranque (años 1-2)', (i) => eur(tres[i].cajaArranque)],
    ['Caja/mes fase estable', (i) => eur(tres[i].cajaEstable)],
    ['Cobertura deuda (DSCR) arranque', (i) => dscrFmt(tres[i].dscrArranque)],
    ['Recuperación capital propio', (i) => mesesFmt(tres[i].paybackMeses)],
  ]

  return (
    <>
      <section style={{ ...panelStyle, marginBottom: 16 }}>
        <h2 style={h2Style}>Escenario conservador del dossier</h2>
        <p style={{ fontSize: 12.5, color: C.soft, lineHeight: 1.6, marginBottom: 14 }}>
          Elige qué escenario guardado se usa como <b>caso conservador</b> (base de planificación del dossier).
          El pesimista y el optimista se calculan automáticamente variando los cafés/día; ajusta los porcentajes
          antes de generar el PDF.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
          {escenarios.map((e) => {
            const active = e.id === conservadorId
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setConservadorId(e.id)}
                style={{
                  padding: '6px 13px', borderRadius: 99, fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
                  border: `1px solid ${active ? C.ink : C.line}`,
                  background: active ? C.ink : '#fff', color: active ? '#fff' : C.soft,
                }}
              >
                {e.nombre}{e.es_base ? ' ·' : ''}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Slider
            label="Pesimista" color={C.red}
            value={pesimistaPct} min={-60} max={-5} step={5}
            onChange={setPesimistaPct}
            hint={`${num(tres[0].cafesDia)} cafés/día`}
          />
          <Slider
            label="Optimista" color={C.green}
            value={optimistaPct} min={5} max={80} step={5}
            onChange={setOptimistaPct}
            hint={`${num(tres[2].cafesDia)} cafés/día`}
          />
        </div>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 20, padding: '12px 14px',
          background: C.bg, border: `1px solid ${C.line}`, borderRadius: 6, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={incluirCapex} onChange={(e) => setIncluirCapex(e.target.checked)}
            style={{ marginTop: 2, accentColor: C.accent }} />
          <span style={{ fontSize: 12.5, color: C.soft, lineHeight: 1.55 }}>
            <b style={{ color: C.ink }}>Usar el equipamiento del CAPEX ({eur(capexTot)})</b> en la inversión del dossier,
            en lugar del importe de equipamiento del escenario ({eur(conservador.inputs.equipo)}).
            Recalcula desembolso, préstamo, amortización y capital propio, y añade el detalle por categorías al PDF.
          </span>
        </label>
      </section>

      {/* Preview de los tres escenarios */}
      <section style={{ ...panelStyle, marginBottom: 16, overflowX: 'auto' }}>
        <h2 style={h2Style}>Vista previa · tres escenarios del dossier</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Métrica</th>
              {cols.map((c, i) => (
                <th key={c} style={{ ...th, color: c === 'conservador' ? C.accent : C.faint }}>
                  {tres[i].nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(([label, fn], ri) => (
              <tr key={ri}>
                <td style={{ ...td, textAlign: 'left', color: C.soft }}>{label}</td>
                {cols.map((c, i) => (
                  <td key={c} style={{
                    ...td,
                    fontWeight: c === 'conservador' ? 700 : 500,
                    color: c === 'conservador' ? C.ink : C.soft,
                    background: c === 'conservador' ? '#F8F7F4' : 'transparent',
                  }}>
                    {fn(i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ ...panelStyle, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Dossier de financiación para el banco</div>
          <div style={{ fontSize: 12, color: C.soft, marginTop: 3 }}>
            Genera el PDF completo: negocio, inversión, P&L conservador, los tres escenarios, servicio de deuda,
            mitigantes y análisis de mercado del entorno.
          </div>
          {error && <div style={{ fontSize: 12, color: C.red, marginTop: 6 }}>⚠ {error}</div>}
        </div>
        <button
          type="button"
          onClick={generar}
          disabled={isGenerating}
          style={{
            padding: '11px 22px', borderRadius: 5, border: 'none',
            background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: isGenerating ? 'default' : 'pointer', opacity: isGenerating ? 0.6 : 1,
          }}
        >
          {isGenerating ? 'Generando…' : 'Generar dossier PDF'}
        </button>
      </section>
    </>
  )
}

function Slider({ label, color, value, min, max, step, onChange, hint }: {
  label: string; color: string; value: number; min: number; max: number; step: number
  onChange: (n: number) => void; hint: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
          {value > 0 ? '+' : ''}{value} % <span style={{ fontSize: 11, color: C.faint, fontWeight: 400 }}>· {hint}</span>
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color }}
      />
    </div>
  )
}

const th: React.CSSProperties = {
  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.faint,
  textAlign: 'right', padding: '8px 10px', borderBottom: `1.5px solid ${C.ink}`, whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  fontSize: 12.5, textAlign: 'right', padding: '9px 10px',
  borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap',
}
