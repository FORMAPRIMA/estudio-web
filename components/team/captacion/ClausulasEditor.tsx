'use client'

import { useState } from 'react'
import {
  seedClausulas, esClausulaCustom, clausulaModificada, clausulasEliminadas,
  CLAUSULAS_DEFAULT, ordinal,
} from '@/lib/contratos/clausulas'
import type { ContratoClausula, ClausulaBloque } from '@/lib/contratos/clausulas'

const INP: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 10px', fontSize: 12,
  border: '1px solid #E8E6E0', borderRadius: 4, background: '#fff',
  fontFamily: 'inherit', color: '#1A1A1A', outline: 'none',
}
const LBL: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#AAA', marginBottom: 4, display: 'block',
}

/**
 * Editor de cláusulas reutilizable.
 * - En un contrato: `baseline` = plantilla viva, `baseLabel` = "plantilla".
 * - En la plantilla de origen: `baseline` = seed de fábrica, `baseLabel` = "versión de fábrica".
 */
export default function ClausulasEditor({
  clausulas,
  onChange,
  disabled,
  baseline = CLAUSULAS_DEFAULT,
  baseLabel = 'plantilla',
}: {
  clausulas: ContratoClausula[]
  onChange: (c: ContratoClausula[]) => void
  disabled: boolean
  baseline?: ContratoClausula[]
  baseLabel?: string
}) {
  const [editLang, setEditLang] = useState<'es' | 'en'>('es')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const tituloKey  = editLang === 'en' ? 'titulo_en'  : 'titulo_es'
  const bloquesKey = editLang === 'en' ? 'bloques_en' : 'bloques_es'

  const toggleExpand = (key: string) =>
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key); else n.add(key)
      return n
    })

  const mutate = (idx: number, fn: (c: ContratoClausula) => ContratoClausula) =>
    onChange(clausulas.map((c, i) => (i === idx ? fn(c) : c)))

  const getBloques = (c: ContratoClausula) => (c[bloquesKey] as ClausulaBloque[]) ?? []
  const withBloques = (c: ContratoClausula, bloques: ClausulaBloque[]): ContratoClausula => ({ ...c, [bloquesKey]: bloques })

  // Ordinal mostrado (Primera = Contenido, Segunda = Honorarios; ambas fijas y no editables)
  const ordinalFor = (idx: number) => {
    let n = 2
    for (let i = 0; i <= idx; i++) if (clausulas[i].nivel === 'clausula') n++
    return n
  }

  const setTitulo = (idx: number, v: string) => mutate(idx, c => ({ ...c, [tituloKey]: v }))
  const setBloqueTexto = (idx: number, bi: number, v: string) =>
    mutate(idx, c => {
      const b = [...getBloques(c)]; b[bi] = { ...b[bi], texto: v }; return withBloques(c, b)
    })
  const setListaItem = (idx: number, bi: number, ii: number, v: string) =>
    mutate(idx, c => {
      const b = [...getBloques(c)]; const items = [...(b[bi].items ?? [])]; items[ii] = v
      b[bi] = { ...b[bi], items }; return withBloques(c, b)
    })
  const addListaItem = (idx: number, bi: number) =>
    mutate(idx, c => {
      const b = [...getBloques(c)]; b[bi] = { ...b[bi], items: [...(b[bi].items ?? []), ''] }
      return withBloques(c, b)
    })
  const removeListaItem = (idx: number, bi: number, ii: number) =>
    mutate(idx, c => {
      const b = [...getBloques(c)]; b[bi] = { ...b[bi], items: (b[bi].items ?? []).filter((_, i) => i !== ii) }
      return withBloques(c, b)
    })
  const addBloque = (idx: number, tipo: 'parrafo' | 'lista') =>
    mutate(idx, c => withBloques(c, [...getBloques(c), tipo === 'lista' ? { tipo: 'lista', items: [''] } : { tipo: 'parrafo', texto: '' }]))
  const removeBloque = (idx: number, bi: number) =>
    mutate(idx, c => withBloques(c, getBloques(c).filter((_, i) => i !== bi)))

  const moveClausula = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= clausulas.length) return
    const next = [...clausulas]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange(next)
  }
  const removeClausula = (idx: number) => {
    const c = clausulas[idx]
    if (c.es_nucleo && !confirm(`"${c.titulo_es}" es una cláusula núcleo (protege al estudio). ¿Seguro que quieres eliminarla?`)) return
    onChange(clausulas.filter((_, i) => i !== idx))
  }
  const restoreClausula = (idx: number) =>
    mutate(idx, c => {
      const base = baseline.find(d => d.key === c.key)
      return base ? (JSON.parse(JSON.stringify(base)) as ContratoClausula) : c
    })
  const addCustom = () => {
    const key = `custom-${Date.now()}`
    onChange([...clausulas, {
      key, nivel: 'clausula',
      titulo_es: 'Nueva cláusula', titulo_en: 'New clause',
      bloques_es: [{ tipo: 'parrafo', texto: '' }],
      bloques_en: [{ tipo: 'parrafo', texto: '' }],
    }])
    setExpanded(prev => new Set(prev).add(key))
  }
  const readd = (key: string) => {
    const base = baseline.find(d => d.key === key)
    if (base) onChange([...clausulas, JSON.parse(JSON.stringify(base)) as ContratoClausula])
  }
  const restoreAll = () => {
    if (confirm(`¿Restaurar todas las cláusulas a la ${baseLabel}? Se perderán los cambios actuales.`)) {
      onChange(baseline === CLAUSULAS_DEFAULT ? seedClausulas() : (JSON.parse(JSON.stringify(baseline)) as ContratoClausula[]))
      setExpanded(new Set())
    }
  }

  const eliminadas = clausulasEliminadas(clausulas, baseline)

  const taInp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: '1px solid #E8E6E0', borderRadius: 5, fontSize: 12, lineHeight: 1.6,
    fontFamily: "'Inter', system-ui, sans-serif", color: '#1A1A1A', background: '#fff',
    resize: 'vertical', outline: 'none',
  }
  const miniBtn: React.CSSProperties = {
    background: 'none', border: '1px solid #E8E6E0', borderRadius: 4,
    fontSize: 10, color: '#888', padding: '3px 8px', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['es', 'en'] as const).map(l => (
            <button key={l} type="button" onClick={() => setEditLang(l)}
              style={{
                padding: '5px 12px', border: '1px solid', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                borderColor: editLang === l ? '#1A1A1A' : '#E8E6E0',
                background: editLang === l ? '#1A1A1A' : '#fff',
                color: editLang === l ? '#fff' : '#888',
              }}>
              {l === 'es' ? 'Español' : 'English'}
            </button>
          ))}
        </div>
        {!disabled && (
          <button type="button" onClick={restoreAll}
            style={{ fontSize: 11, color: '#AAA', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Restaurar todas a {baseLabel}
          </button>
        )}
      </div>

      {/* Cláusulas */}
      {clausulas.map((c, idx) => {
        const isOpen     = expanded.has(c.key)
        const modificada = clausulaModificada(c, baseline)
        const isCustom   = esClausulaCustom(c, baseline)
        const titulo     = (c[tituloKey] as string) ?? ''
        const numeroTxt  = c.nivel === 'clausula' ? `${ordinal(ordinalFor(idx), editLang)}.` : '·'
        return (
          <div key={c.key} style={{ border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isOpen ? '#FAFAF8' : '#fff' }}>
              {!disabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <button type="button" onClick={() => moveClausula(idx, -1)} disabled={idx === 0}
                    style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#DDD' : '#999', fontSize: 9, lineHeight: 1, padding: 0 }}>▲</button>
                  <button type="button" onClick={() => moveClausula(idx, 1)} disabled={idx === clausulas.length - 1}
                    style={{ background: 'none', border: 'none', cursor: idx === clausulas.length - 1 ? 'default' : 'pointer', color: idx === clausulas.length - 1 ? '#DDD' : '#999', fontSize: 9, lineHeight: 1, padding: 0 }}>▼</button>
                </div>
              )}
              <button type="button" onClick={() => toggleExpand(c.key)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                <span style={{ fontSize: 10, color: '#BBB', fontVariantNumeric: 'tabular-nums', minWidth: 56 }}>{numeroTxt}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{titulo || '(sin título)'}</span>
                {c.nivel === 'subclausula' && <span style={{ fontSize: 9, color: '#BBB' }}>(apartado de Honorarios)</span>}
                {c.es_nucleo && <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#B45309', background: '#FFF8ED', border: '1px solid #FCD34D', borderRadius: 3, padding: '1px 6px' }}>Núcleo</span>}
                {isCustom && <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#1D9E75', background: '#EEF8F4', border: '1px solid #86EFAC', borderRadius: 3, padding: '1px 6px' }}>Añadida</span>}
                {!isCustom && modificada && <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9B59B6', background: '#F5EEFB', border: '1px solid #D8B4E8', borderRadius: 3, padding: '1px 6px' }}>Modificada</span>}
              </button>
              <span style={{ fontSize: 11, color: '#CCC' }}>{isOpen ? '▾' : '▸'}</span>
            </div>

            {/* Body */}
            {isOpen && (
              <div style={{ padding: '4px 14px 16px', borderTop: '1px solid #F0EEE8' }}>
                {c.es_nucleo && !disabled && (
                  <p style={{ fontSize: 10.5, color: '#B45309', background: '#FFF8ED', border: '1px solid #FCD34D', borderRadius: 5, padding: '7px 10px', margin: '10px 0' }}>
                    Cláusula núcleo: protege al estudio (responsabilidad, propiedad intelectual o confidencialidad). Edítala con cuidado.
                  </p>
                )}

                {/* Título */}
                <div style={{ margin: '10px 0' }}>
                  <span style={LBL}>Título ({editLang.toUpperCase()})</span>
                  <input value={titulo} disabled={disabled}
                    onChange={e => setTitulo(idx, e.target.value)}
                    style={{ ...INP, background: disabled ? '#F8F7F4' : '#fff' }} />
                </div>

                {/* Bloques */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {getBloques(c).map((b, bi) => (
                    <div key={bi} style={{ position: 'relative', border: '1px solid #F0EEE8', borderRadius: 6, padding: '10px', background: '#FCFCFB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#BBB' }}>
                          {b.tipo === 'lista' ? 'Lista (a, b, c…)' : 'Párrafo'}
                        </span>
                        {!disabled && (
                          <button type="button" onClick={() => removeBloque(idx, bi)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DDD', fontSize: 14, padding: 0 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#DDD' }}>×</button>
                        )}
                      </div>
                      {b.tipo === 'parrafo' ? (
                        <textarea value={b.texto ?? ''} disabled={disabled} rows={3}
                          onChange={e => setBloqueTexto(idx, bi, e.target.value)}
                          style={{ ...taInp, background: disabled ? '#F8F7F4' : '#fff' }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(b.items ?? []).map((it, ii) => (
                            <div key={ii} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                              <span style={{ fontSize: 11, color: '#BBB', marginTop: 8, minWidth: 16 }}>{String.fromCharCode(97 + ii)}.</span>
                              <textarea value={it} disabled={disabled} rows={2}
                                onChange={e => setListaItem(idx, bi, ii, e.target.value)}
                                style={{ ...taInp, background: disabled ? '#F8F7F4' : '#fff' }} />
                              {!disabled && (
                                <button type="button" onClick={() => removeListaItem(idx, bi, ii)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DDD', fontSize: 14, padding: '6px 2px' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#DDD' }}>×</button>
                              )}
                            </div>
                          ))}
                          {!disabled && (
                            <button type="button" onClick={() => addListaItem(idx, bi)} style={{ ...miniBtn, alignSelf: 'flex-start' }}>+ apartado</button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Acciones de la cláusula */}
                {!disabled && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => addBloque(idx, 'parrafo')} style={miniBtn}>+ Párrafo</button>
                    <button type="button" onClick={() => addBloque(idx, 'lista')} style={miniBtn}>+ Lista</button>
                    {!isCustom && modificada && (
                      <button type="button" onClick={() => restoreClausula(idx)} style={{ ...miniBtn, color: '#9B59B6', borderColor: '#D8B4E8' }}>↺ Restaurar a {baseLabel}</button>
                    )}
                    <button type="button" onClick={() => removeClausula(idx)} style={{ ...miniBtn, color: '#E53E3E', borderColor: '#FCA5A5', marginLeft: 'auto' }}>Eliminar cláusula</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Añadir + re-añadir eliminadas */}
      {!disabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={addCustom}
            style={{ alignSelf: 'flex-start', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, padding: '8px 16px', cursor: 'pointer' }}>
            + Añadir cláusula
          </button>
          {eliminadas.length > 0 && (
            <div style={{ fontSize: 11, color: '#888', background: '#F8F7F4', border: '1px solid #E8E6E0', borderRadius: 6, padding: '10px 12px' }}>
              <span style={{ color: '#AAA' }}>Cláusulas de {baseLabel} eliminadas: </span>
              {eliminadas.map((d, i) => (
                <span key={d.key}>
                  {i > 0 && ', '}
                  <button type="button" onClick={() => readd(d.key)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D85A30', fontSize: 11, padding: 0, textDecoration: 'underline' }}>
                    + {d.titulo_es}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
