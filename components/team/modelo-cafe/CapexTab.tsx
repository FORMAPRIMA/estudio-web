'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { eur } from '@/lib/modelo-cafe/domain'
import {
  CAPEX_DEFAULT, CATEGORIAS, capexSubtotal, capexTotal, totalPorCategoria, type CapexItem,
} from '@/lib/modelo-cafe/capex'
import { C, panelStyle, h2Style } from './theme'

const CATS: string[] = [...CATEGORIAS]

const genId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `x${Date.now()}${Math.round(Math.random() * 1e6)}`

export default function CapexTab({ items, onChange, estado = 'idle', estadoError, onUsarEnModelo }: {
  items: CapexItem[]
  onChange: (items: CapexItem[]) => void
  estado?: 'idle' | 'saving' | 'saved' | 'error'
  estadoError?: string | null
  onUsarEnModelo?: (total: number) => void
}) {
  const [aplicado, setAplicado] = useState(false)

  const total = useMemo(() => capexTotal(items), [items])
  const porCat = useMemo(() => totalPorCategoria(items), [items])

  const update = (id: string, patch: Partial<CapexItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id))
  const add = (categoria: string) =>
    onChange([...items, {
      id: genId(), categoria, concepto: '', marca: '', estado: 'nuevo',
      cantidad: 1, precio: 0, link: '', nota: '',
    }])
  const reset = () => {
    if (confirm('¿Restablecer el equipamiento a la lista por defecto? Perderás tus cambios.')) onChange(CAPEX_DEFAULT)
  }

  const cats = [...CATS, ...Array.from(new Set(items.map((i) => i.categoria))).filter((c) => !CATS.includes(c))]
  const estadoTxt = estado === 'saving' ? 'Guardando…' : estado === 'saved' ? 'Guardado en la nube ✓'
    : estado === 'error' ? (estadoError || 'Error al guardar') : 'Compartido en la nube'

  return (
    <>
      {/* Hero con el total */}
      <section style={{ ...panelStyle, marginBottom: 16, background: C.ink, border: 'none', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>
              CAPEX · equipamiento de la cafetería
            </div>
            <div style={{ fontSize: 40, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.02em' }}>{eur(total)}</div>
            <div style={{ fontSize: 12, color: '#FFFFFF99', marginTop: 6 }}>
              {items.length} conceptos · precios de mercado orientativos (julio 2026), editables
            </div>
            <div style={{ fontSize: 11, marginTop: 6, color: estado === 'error' ? '#F0A090' : '#FFFFFF70' }}>
              {estado === 'saving' ? '● ' : estado === 'error' ? '⚠ ' : '☁ '}{estadoTxt}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
            {cats.map((c) => porCat[c] ? (
              <div key={c} style={{ background: '#FFFFFF14', borderRadius: 5, padding: '8px 12px', minWidth: 110 }}>
                <div style={{ fontSize: 9.5, color: '#FFFFFF80', marginBottom: 3 }}>{c}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{eur(porCat[c])}</div>
              </div>
            ) : null)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18, paddingTop: 14, borderTop: '1px solid #FFFFFF20' }}>
          {onUsarEnModelo && (
            <button
              type="button"
              onClick={() => { onUsarEnModelo(Math.round(total)); setAplicado(true); setTimeout(() => setAplicado(false), 2500) }}
              style={{
                padding: '9px 16px', borderRadius: 5, border: 'none', cursor: 'pointer',
                background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600,
              }}
            >
              {aplicado ? 'Aplicado ✓ (recuerda guardar el escenario)' : 'Usar total como «equipamiento» del modelo'}
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '9px 16px', borderRadius: 5, cursor: 'pointer',
              border: '1px solid #FFFFFF35', background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 500,
            }}
          >
            Restablecer valores por defecto
          </button>
        </div>
      </section>

      {/* Tablas por categoría */}
      {cats.map((cat) => {
        const rows = items.filter((i) => i.categoria === cat)
        if (rows.length === 0 && CATS.includes(cat)) {
          // categoría base vacía: mostrar cabecera con botón añadir
        }
        return (
          <section key={cat} style={{ ...panelStyle, marginBottom: 16, overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, minWidth: 860 }}>
              <h2 style={{ ...h2Style, margin: 0 }}>{cat}</h2>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.coffee }}>{eur(porCat[cat] ?? 0)}</span>
            </div>

            <div style={{ minWidth: 860 }}>
              {/* Cabecera de columnas */}
              <div style={{ ...gridRow, padding: '0 0 6px', borderBottom: `1.5px solid ${C.ink}` }}>
                <span style={colHead}>Concepto</span>
                <span style={colHead}>Marca / modelo</span>
                <span style={{ ...colHead, textAlign: 'center' }}>Estado</span>
                <span style={{ ...colHead, textAlign: 'center' }}>Cant.</span>
                <span style={{ ...colHead, textAlign: 'right' }}>€/ud</span>
                <span style={{ ...colHead, textAlign: 'right' }}>Subtotal</span>
                <span />
              </div>

              {rows.map((i) => (
                <div key={i.id} style={{ borderBottom: `1px solid ${C.line}`, padding: '10px 0' }}>
                  <div style={gridRow}>
                    <CellText value={i.concepto} onChange={(v) => update(i.id, { concepto: v })} placeholder="Concepto" bold />
                    <CellText value={i.marca} onChange={(v) => update(i.id, { marca: v })} placeholder="Marca / modelo" muted />
                    <select
                      value={i.estado}
                      onChange={(e) => update(i.id, { estado: e.target.value as CapexItem['estado'] })}
                      style={{ ...cellInput, textAlign: 'center', cursor: 'pointer' }}
                    >
                      <option value="nuevo">Nuevo</option>
                      <option value="usado">2ª mano</option>
                    </select>
                    <CellNum value={i.cantidad} onChange={(n) => update(i.id, { cantidad: n })} align="center" />
                    <CellNum value={i.precio} onChange={(n) => update(i.id, { precio: n })} align="right" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, textAlign: 'right', alignSelf: 'center' }}>
                      {eur(capexSubtotal(i))}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(i.id)}
                      title="Eliminar"
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        color: C.faint, fontSize: 16, lineHeight: 1, alignSelf: 'center',
                      }}
                    >×</button>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: C.faint }}>🔗</span>
                    <input
                      value={i.link}
                      onChange={(e) => update(i.id, { link: e.target.value })}
                      placeholder="Link de compra"
                      style={{ ...cellInput, flex: 1, fontSize: 11, color: C.blue }}
                    />
                    {i.link && (
                      <a href={i.link} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: C.accent, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        abrir ↗
                      </a>
                    )}
                    <input
                      value={i.nota}
                      onChange={(e) => update(i.id, { nota: e.target.value })}
                      placeholder="Nota"
                      style={{ ...cellInput, flex: 2, fontSize: 11, color: C.soft }}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => add(cat)}
                style={{
                  marginTop: 10, padding: '7px 14px', borderRadius: 4, cursor: 'pointer',
                  border: `1px dashed ${C.line}`, background: C.bg, color: C.soft, fontSize: 12, fontWeight: 500,
                }}
              >+ Añadir línea</button>
            </div>
          </section>
        )
      })}

      <p style={{ fontSize: 11, color: C.faint, marginTop: 4, lineHeight: 1.6, maxWidth: 900 }}>
        Precios de mercado orientativos (visita de campo y búsqueda, julio 2026; IVA aparte salvo indicación). Contrasta
        cada partida con el proveedor: los equipos de 2ª mano y los packs varían mucho. Los cambios se guardan en este
        navegador. El total puedes trasladarlo al campo «equipamiento» del modelo con el botón de arriba.
      </p>
    </>
  )
}

// ── Celdas editables (a nivel de módulo: conservan el foco) ──────────

function CellText({ value, onChange, placeholder, bold, muted }: {
  value: string; onChange: (v: string) => void; placeholder?: string; bold?: boolean; muted?: boolean
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...cellInput, alignSelf: 'center',
        fontWeight: bold ? 600 : 400,
        color: muted ? C.soft : C.ink,
      }}
    />
  )
}

function CellNum({ value, onChange, align = 'right' }: {
  value: number; onChange: (n: number) => void; align?: 'right' | 'center'
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft !== null ? draft : String(value)
  return (
    <input
      type="number"
      value={shown}
      onChange={(e) => { setDraft(e.target.value); const n = e.target.value === '' ? 0 : Number(e.target.value); if (Number.isFinite(n)) onChange(n) }}
      onFocus={() => setDraft(String(value))}
      onBlur={() => setDraft(null)}
      style={{ ...cellInput, textAlign: align, alignSelf: 'center' }}
    />
  )
}

// ── Estilos ──────────────────────────────────────────────────────────

const gridRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0,2.1fr) minmax(0,1.9fr) 84px 56px 92px 96px 26px',
  gap: 10,
  alignItems: 'center',
}

const colHead: CSSProperties = {
  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.faint,
}

const cellInput: CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 4, boxSizing: 'border-box',
  border: `1px solid ${C.line}`, background: C.bg, color: C.ink,
  fontSize: 12.5, outline: 'none', fontFamily: 'inherit',
}
