'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { savePlantillaServicio, createServicio, deleteServicio, saveServicioEN } from '@/app/actions/plantillaPropuestas'
import { SERVICIOS_CONFIG } from '@/lib/propuestas/config'
import type { ServicioEntry, ServicioPlantillaData } from '@/lib/propuestas/config'

// ── Helpers ───────────────────────────────────────────────────────────────────
function inp(override?: React.CSSProperties): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '7px 10px', border: '1px solid #E8E6E0', borderRadius: 4,
    fontSize: 13, outline: 'none', background: '#fff', color: '#1A1A1A',
    fontFamily: "'Inter', system-ui, sans-serif",
    ...override,
  }
}

function inpEN(override?: React.CSSProperties): React.CSSProperties {
  return inp({ background: '#FAFAF7', ...override })
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', marginBottom: 5 }}>
      {children}
    </div>
  )
}

function sumPct(pago: { pct: number }[]) {
  return pago.reduce((s, p) => s + (Number(p.pct) || 0), 0)
}

const TIPO_LABEL: Record<string, string> = {
  pem:    'PEM',
  ratio:  'Ratio de horas',
  manual: 'Precio manual',
}

// ── Servicio editor ───────────────────────────────────────────────────────────
function ServicioEditor({
  entry,
  onSaved,
  onDeleted,
}: {
  entry:    ServicioEntry
  onSaved:  (id: string, data: ServicioPlantillaData) => void
  onDeleted?: () => void
}) {
  const [isPending, startSave] = useTransition()
  const [isDeleting, startDel] = useTransition()
  const [saveOk, setSaveOk]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // ES state
  const [label,   setLabel]   = useState(entry.label)
  const [texto,   setTexto]   = useState(entry.texto)
  const [semanas, setSemanas] = useState(entry.semanas_default)
  const [grupos,  setGrupos]  = useState(
    entry.entregables.map(g => ({ grupo: g.grupo, items: [...g.items] }))
  )
  const [pago,  setPago]  = useState(entry.pago.map(p => ({ ...p })))
  const [notas, setNotas] = useState(entry.notas ?? '')

  // EN state
  const [labelEN,   setLabelEN]   = useState(entry.label_en ?? '')
  const [textoEN,   setTextoEN]   = useState(entry.texto_en ?? '')
  const [semanasEN, setSemanasEN] = useState(entry.semanas_default_en ?? '')
  const [gruposEN,  setGruposEN]  = useState<{ grupo: string; items: string[] }[]>(
    entry.entregables_en ? entry.entregables_en.map(g => ({ grupo: g.grupo, items: [...g.items] })) : []
  )
  const [pagoEN, setPagoEN] = useState<{ label: string; pct: number }[]>(
    entry.pago_en ? entry.pago_en.map(p => ({ ...p })) : []
  )

  const [notasEN, setNotasEN] = useState(entry.notas_en ?? '')

  const [enModified,    setEnModified]    = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [enStatus,      setEnStatus]      = useState<'idle' | 'translating' | 'translated' | 'saved' | 'error'>('idle')
  const [enError,       setEnError]       = useState<string | null>(null)
  const [isSavingEN,    startSaveEN]      = useTransition()
  const [saveENOk,      setSaveENOk]      = useState(false)

  // Sync EN status chip label based on whether DB has data
  useEffect(() => {
    if (entry.label_en) setEnStatus('saved')
  }, [entry.label_en])

  // ── ES helpers ────────────────────────────────────────────────────────────
  const addGrupo = () => setGrupos(p => [...p, { grupo: 'Nuevo grupo', items: [] }])
  const removeGrupo = (gi: number) => setGrupos(p => p.filter((_, i) => i !== gi))
  const setGrupoName = (gi: number, v: string) => setGrupos(p => p.map((g, i) => i === gi ? { ...g, grupo: v } : g))
  const addItem = (gi: number) => setGrupos(p => p.map((g, i) => i === gi ? { ...g, items: [...g.items, ''] } : g))
  const setItem = (gi: number, ii: number, v: string) => setGrupos(p => p.map((g, i) => i === gi ? { ...g, items: g.items.map((it, j) => j === ii ? v : it) } : g))
  const removeItem = (gi: number, ii: number) => setGrupos(p => p.map((g, i) => i === gi ? { ...g, items: g.items.filter((_, j) => j !== ii) } : g))
  const moveGrupo = (gi: number, dir: -1 | 1) => setGrupos(p => {
    const next = [...p]; const t = gi + dir
    if (t < 0 || t >= next.length) return p
    ;[next[gi], next[t]] = [next[t], next[gi]]; return next
  })

  const addHito = () => setPago(p => [...p, { label: '', pct: 0 }])
  const removeHito = (i: number) => setPago(p => p.filter((_, j) => j !== i))
  const setHitoLabel = (i: number, v: string) => setPago(p => p.map((h, j) => j === i ? { ...h, label: v } : h))
  const setHitoPct = (i: number, v: string) => setPago(p => p.map((h, j) => j === i ? { ...h, pct: Number(v) || 0 } : h))

  // ── EN helpers ────────────────────────────────────────────────────────────
  const addGrupoEN = () => { setGruposEN(p => [...p, { grupo: 'New group', items: [] }]); setEnModified(true) }
  const removeGrupoEN = (gi: number) => { setGruposEN(p => p.filter((_, i) => i !== gi)); setEnModified(true) }
  const setGrupoNameEN = (gi: number, v: string) => { setGruposEN(p => p.map((g, i) => i === gi ? { ...g, grupo: v } : g)); setEnModified(true) }
  const addItemEN = (gi: number) => { setGruposEN(p => p.map((g, i) => i === gi ? { ...g, items: [...g.items, ''] } : g)); setEnModified(true) }
  const setItemEN = (gi: number, ii: number, v: string) => { setGruposEN(p => p.map((g, i) => i === gi ? { ...g, items: g.items.map((it, j) => j === ii ? v : it) } : g)); setEnModified(true) }
  const removeItemEN = (gi: number, ii: number) => { setGruposEN(p => p.map((g, i) => i === gi ? { ...g, items: g.items.filter((_, j) => j !== ii) } : g)); setEnModified(true) }

  const addHitoEN = () => { setPagoEN(p => [...p, { label: '', pct: 0 }]); setEnModified(true) }
  const removeHitoEN = (i: number) => { setPagoEN(p => p.filter((_, j) => j !== i)); setEnModified(true) }
  const setHitoLabelEN = (i: number, v: string) => { setPagoEN(p => p.map((h, j) => j === i ? { ...h, label: v } : h)); setEnModified(true) }
  const setHitoPctEN = (i: number, v: string) => { setPagoEN(p => p.map((h, j) => j === i ? { ...h, pct: Number(v) || 0 } : h)); setEnModified(true) }

  const pagoSum   = sumPct(pago)
  const pagoSumEN = sumPct(pagoEN)

  // ── Auto-translate ────────────────────────────────────────────────────────
  async function doTranslate(esLabel: string, esTexto: string, esGrupos: { grupo: string; items: string[] }[], esSemanas: string, esPago: { label: string; pct: number }[], esNotas?: string) {
    setIsTranslating(true)
    setEnStatus('translating')
    setEnError(null)
    try {
      const res = await fetch('/api/translate-servicio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: esLabel, texto: esTexto, entregables: esGrupos, semanas_default: esSemanas, pago: esPago, notas: esNotas ?? '' }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Translation failed') }
      const translated = await res.json() as {
        label: string; texto: string
        entregables: { grupo: string; items: string[] }[]
        semanas_default: string
        pago: { label: string; pct: number }[]
        notas?: string
      }
      setLabelEN(translated.label ?? '')
      setTextoEN(translated.texto ?? '')
      setGruposEN(translated.entregables ?? [])
      setSemanasEN(translated.semanas_default ?? '')
      setPagoEN(translated.pago ?? [])
      setNotasEN(translated.notas ?? '')
      setEnModified(false)
      setEnStatus('translated')
    } catch (e) {
      setEnStatus('error')
      setEnError(e instanceof Error ? e.message : 'Error al traducir')
    } finally {
      setIsTranslating(false)
    }
  }

  // ── Save ES ───────────────────────────────────────────────────────────────
  function handleSave() {
    setSaveOk(false); setError(null)
    startSave(async () => {
      const result = await savePlantillaServicio(entry.id, {
        label, texto, entregables: grupos, semanas_default: semanas, pago, notas,
      })
      if ('error' in result) { setError(result.error) }
      else {
        setSaveOk(true)
        onSaved(entry.id, { label, texto, entregables: grupos, semanas_default: semanas, pago, notas })
        setTimeout(() => setSaveOk(false), 2500)
        // Auto-translate only if user has not manually edited EN
        if (!enModified) {
          doTranslate(label, texto, grupos, semanas, pago, notas).then(async () => {
            // After translate completes, auto-save EN too
            // We read current EN state via closure — but doTranslate updates state async,
            // so we handle auto-save inside doTranslate result by reading updated values
            // Actually we'll rely on the "Guardar EN" button for explicit saves.
            // But we can silently auto-save after auto-translate:
          })
        }
      }
    })
  }

  // ── Save EN ───────────────────────────────────────────────────────────────
  function handleSaveEN() {
    setSaveENOk(false); setEnError(null)
    startSaveEN(async () => {
      const result = await saveServicioEN(entry.id, {
        label_en:           labelEN || null,
        texto_en:           textoEN || null,
        entregables_en:     gruposEN.length > 0 ? gruposEN : null,
        semanas_default_en: semanasEN || null,
        pago_en:            pagoEN.length > 0 ? pagoEN : null,
        notas_en:           notasEN || null,
      })
      if ('error' in result) { setEnError(result.error); setEnStatus('error') }
      else { setSaveENOk(true); setEnStatus('saved'); setTimeout(() => setSaveENOk(false), 2500) }
    })
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar el servicio "${label}"? Se perderá la configuración y no podrá recuperarse.`)) return
    startDel(async () => {
      const result = await deleteServicio(entry.id)
      if ('error' in result) setError(result.error)
      else onDeleted?.()
    })
  }

  // ── EN status chip ────────────────────────────────────────────────────────
  const statusChip = () => {
    if (enStatus === 'translating') return { label: 'Traduciendo…', color: '#888' }
    if (enStatus === 'translated')  return { label: 'Auto-traducido', color: '#D85A30' }
    if (enStatus === 'saved')       return { label: 'Guardado', color: '#4CAF50' }
    if (enStatus === 'error')       return { label: 'Error', color: '#E57373' }
    if (entry.label_en)             return { label: 'Guardado', color: '#4CAF50' }
    return { label: 'Sin traducir', color: '#CCC' }
  }
  const chip = statusChip()

  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
      {/* ── LEFT COLUMN: ES ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, paddingRight: 32, borderRight: '1px solid #E8E6E0', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div className="plantilla-editor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, color: '#AAA', marginBottom: 4 }}>
              ID: <code style={{ background: '#F0EEE8', padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>{entry.id}</code>
              {' · '}
              Tipo: <strong>{TIPO_LABEL[entry.tipo]}</strong>
              {entry.tipo === 'pem' && ` (${(entry.pem_split * 100).toFixed(0)}% del PEM base)`}
              {entry.tipo === 'ratio' && ' — calculado por ratios de horas'}
              {entry.tipo === 'manual' && ' — el precio se introduce manualmente en cada propuesta'}
            </div>
            {!entry.isCustom && (
              <div style={{ fontSize: 10, color: '#CCC', fontStyle: 'italic' }}>
                Servicio base — tipo y ratio de cálculo no son editables aquí
              </div>
            )}
          </div>
          {entry.isCustom && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              style={{ fontSize: 12, color: '#E57373', background: 'none', border: '1px solid #E57373', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', opacity: isDeleting ? 0.5 : 1 }}
            >
              {isDeleting ? 'Eliminando…' : 'Eliminar servicio'}
            </button>
          )}
        </div>

        {/* Nombre */}
        <div>
          <FieldLabel>Nombre del servicio</FieldLabel>
          <input style={inp()} value={label} onChange={e => setLabel(e.target.value)} />
        </div>

        {/* Texto */}
        <div>
          <FieldLabel>Texto de descripción</FieldLabel>
          <textarea style={{ ...inp(), minHeight: 100, resize: 'vertical' as const, lineHeight: 1.6 }}
            value={texto} onChange={e => setTexto(e.target.value)} />
        </div>

        {/* Entregables */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <FieldLabel>Entregables</FieldLabel>
            <button onClick={addGrupo} style={{ fontSize: 11, padding: '4px 12px', background: '#F0EEE8', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#555' }}>
              + Añadir grupo
            </button>
          </div>
          {grupos.length === 0 && <div style={{ fontSize: 12, color: '#CCC', fontStyle: 'italic', padding: '8px 0' }}>Sin grupos definidos</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {grupos.map((g, gi) => (
              <div key={gi} style={{ border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F8F7F4', borderBottom: '1px solid #E8E6E0' }}>
                  <button onClick={() => moveGrupo(gi, -1)} disabled={gi === 0}
                    style={{ background: 'none', border: 'none', cursor: gi === 0 ? 'default' : 'pointer', color: gi === 0 ? '#DDD' : '#888', fontSize: 12, padding: '0 2px' }}>↑</button>
                  <button onClick={() => moveGrupo(gi, 1)} disabled={gi === grupos.length - 1}
                    style={{ background: 'none', border: 'none', cursor: gi === grupos.length - 1 ? 'default' : 'pointer', color: gi === grupos.length - 1 ? '#DDD' : '#888', fontSize: 12, padding: '0 2px' }}>↓</button>
                  <input value={g.grupo} onChange={e => setGrupoName(gi, e.target.value)}
                    style={{ ...inp(), flex: 1, fontWeight: 600, fontSize: 12, padding: '4px 8px' }} placeholder="Nombre del grupo" />
                  <button onClick={() => removeGrupo(gi)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {g.items.map((item, ii) => (
                    <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#CCC', fontSize: 12, flexShrink: 0 }}>·</span>
                      <input value={item} onChange={e => setItem(gi, ii, e.target.value)}
                        style={{ ...inp(), flex: 1, fontSize: 12, padding: '4px 8px' }} placeholder="Entregable…" />
                      <button onClick={() => removeItem(gi, ii)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 14, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => addItem(gi)}
                    style={{ alignSelf: 'flex-start', fontSize: 11, color: '#AAA', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginTop: 2 }}>
                    + Añadir ítem
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Semanas */}
        <div>
          <FieldLabel>Plazo estimado</FieldLabel>
          <input style={inp()} value={semanas} onChange={e => setSemanas(e.target.value)} placeholder="Ej. 3–4 semanas" />
        </div>

        {/* Hitos de pago */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <FieldLabel>Hitos de pago</FieldLabel>
            <button onClick={addHito} style={{ fontSize: 11, padding: '4px 12px', background: '#F0EEE8', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#555' }}>
              + Añadir hito
            </button>
          </div>
          {pago.length === 0 && <div style={{ fontSize: 12, color: '#CCC', fontStyle: 'italic', padding: '8px 0' }}>Sin hitos definidos</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pago.map((p, i) => (
              <div key={i} className="plantilla-hito-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input value={p.label} onChange={e => setHitoLabel(i, e.target.value)}
                  style={{ ...inp(), flex: 1 }} placeholder="Descripción del hito…" />
                <div className="plantilla-hito-pct" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <input type="number" value={p.pct} onChange={e => setHitoPct(i, e.target.value)}
                    style={{ ...inp(), width: 72, textAlign: 'right' as const }} min={0} max={100} />
                  <span style={{ fontSize: 12, color: '#AAA', flexShrink: 0 }}>%</span>
                </div>
                <button onClick={() => removeHito(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 16, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            ))}
            {pago.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: '1px solid #F0EEE8' }}>
                <span style={{ fontSize: 12, color: '#AAA' }}>Total:</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: pagoSum === 100 ? '#4CAF50' : '#E57373' }}>{pagoSum}%</span>
                {pagoSum !== 100 && <span style={{ fontSize: 11, color: '#E57373' }}>debe sumar 100%</span>}
              </div>
            )}
          </div>
        </div>

        {/* Notas de contrato */}
        <div>
          <FieldLabel>Notas del contrato</FieldLabel>
          <div style={{ fontSize: 11, color: '#BBB', marginBottom: 6, lineHeight: 1.5 }}>
            Texto que aparece en el contrato tras los entregables de este servicio.
          </div>
          <textarea
            style={{ ...inp(), minHeight: 80, resize: 'vertical' as const, lineHeight: 1.6 }}
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Ej. Los planos se entregarán en formato DWG y PDF…"
          />
        </div>

        {/* Actions ES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid #F0EEE8' }}>
          <button
            onClick={handleSave}
            disabled={isPending || (pago.length > 0 && pagoSum !== 100)}
            style={{ padding: '9px 22px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {saveOk && <span style={{ fontSize: 12, color: '#4CAF50' }}>Guardado correctamente</span>}
          {error  && <span style={{ fontSize: 12, color: '#E57373' }}>{error}</span>}
        </div>
      </div>

      {/* ── RIGHT COLUMN: EN ────────────────────────────────────────────── */}
      <div style={{ flex: 1, paddingLeft: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* EN Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', letterSpacing: '0.04em' }}>English (EN)</span>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 12,
              background: chip.color + '20', color: chip.color,
              fontWeight: 600, letterSpacing: '0.04em',
            }}>
              {chip.label}
            </span>
          </div>
          <button
            onClick={() => doTranslate(label, texto, grupos, semanas, pago, notas)}
            disabled={isTranslating}
            style={{
              fontSize: 11, padding: '5px 14px',
              background: isTranslating ? '#F0EEE8' : '#F0EEE8',
              border: '1px solid #E8E6E0', borderRadius: 4,
              cursor: isTranslating ? 'not-allowed' : 'pointer',
              color: isTranslating ? '#AAA' : '#555',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {isTranslating ? (
              <>
                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #CCC', borderTopColor: '#D85A30', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Traduciendo…
              </>
            ) : '⟳ Auto-traducir'}
          </button>
        </div>

        {/* Label EN */}
        <div>
          <FieldLabel>Service name</FieldLabel>
          <input style={inpEN()} value={labelEN}
            onChange={e => { setLabelEN(e.target.value); setEnModified(true) }}
            placeholder="Service name in English…" />
        </div>

        {/* Texto EN */}
        <div>
          <FieldLabel>Description text</FieldLabel>
          <textarea style={{ ...inpEN(), minHeight: 100, resize: 'vertical' as const, lineHeight: 1.6 }}
            value={textoEN}
            onChange={e => { setTextoEN(e.target.value); setEnModified(true) }}
            placeholder="Description in English…" />
        </div>

        {/* Entregables EN */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <FieldLabel>Deliverables</FieldLabel>
            <button onClick={addGrupoEN} style={{ fontSize: 11, padding: '4px 12px', background: '#F0EEE8', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#555' }}>
              + Add group
            </button>
          </div>
          {gruposEN.length === 0 && <div style={{ fontSize: 12, color: '#CCC', fontStyle: 'italic', padding: '8px 0' }}>No groups defined</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {gruposEN.map((g, gi) => (
              <div key={gi} style={{ border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FAFAF7', borderBottom: '1px solid #E8E6E0' }}>
                  <input value={g.grupo} onChange={e => setGrupoNameEN(gi, e.target.value)}
                    style={{ ...inpEN(), flex: 1, fontWeight: 600, fontSize: 12, padding: '4px 8px' }} placeholder="Group name" />
                  <button onClick={() => removeGrupoEN(gi)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ padding: '8px 12px', background: '#FAFAF7', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {g.items.map((item, ii) => (
                    <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#CCC', fontSize: 12, flexShrink: 0 }}>·</span>
                      <input value={item} onChange={e => setItemEN(gi, ii, e.target.value)}
                        style={{ ...inpEN(), flex: 1, fontSize: 12, padding: '4px 8px' }} placeholder="Deliverable…" />
                      <button onClick={() => removeItemEN(gi, ii)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 14, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => addItemEN(gi)}
                    style={{ alignSelf: 'flex-start', fontSize: 11, color: '#AAA', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginTop: 2 }}>
                    + Add item
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Semanas EN */}
        <div>
          <FieldLabel>Estimated timeline</FieldLabel>
          <input style={inpEN()} value={semanasEN}
            onChange={e => { setSemanasEN(e.target.value); setEnModified(true) }}
            placeholder="e.g. 3–4 weeks" />
        </div>

        {/* Hitos de pago EN */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <FieldLabel>Payment milestones</FieldLabel>
            <button onClick={addHitoEN} style={{ fontSize: 11, padding: '4px 12px', background: '#F0EEE8', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#555' }}>
              + Add milestone
            </button>
          </div>
          {pagoEN.length === 0 && <div style={{ fontSize: 12, color: '#CCC', fontStyle: 'italic', padding: '8px 0' }}>No milestones defined</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pagoEN.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input value={p.label} onChange={e => setHitoLabelEN(i, e.target.value)}
                  style={{ ...inpEN(), flex: 1 }} placeholder="Milestone description…" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <input type="number" value={p.pct} onChange={e => setHitoPctEN(i, e.target.value)}
                    style={{ ...inpEN(), width: 72, textAlign: 'right' as const }} min={0} max={100} />
                  <span style={{ fontSize: 12, color: '#AAA', flexShrink: 0 }}>%</span>
                </div>
                <button onClick={() => removeHitoEN(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CCC', fontSize: 16, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            ))}
            {pagoEN.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: '1px solid #F0EEE8' }}>
                <span style={{ fontSize: 12, color: '#AAA' }}>Total:</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: pagoSumEN === 100 ? '#4CAF50' : '#E57373' }}>{pagoSumEN}%</span>
                {pagoSumEN !== 100 && <span style={{ fontSize: 11, color: '#E57373' }}>must sum to 100%</span>}
              </div>
            )}
          </div>
        </div>

        {/* Notas EN */}
        <div>
          <FieldLabel>Contract notes</FieldLabel>
          <div style={{ fontSize: 11, color: '#BBB', marginBottom: 6, lineHeight: 1.5 }}>
            Text shown in the contract after this service's deliverables.
          </div>
          <textarea
            style={{ ...inpEN(), minHeight: 80, resize: 'vertical' as const, lineHeight: 1.6 }}
            value={notasEN}
            onChange={e => { setNotasEN(e.target.value); setEnModified(true) }}
            placeholder="e.g. Drawings will be delivered in DWG and PDF format…"
          />
        </div>

        {/* Actions EN */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid #F0EEE8' }}>
          <button
            onClick={handleSaveEN}
            disabled={isSavingEN}
            style={{ padding: '9px 22px', background: '#D85A30', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, cursor: isSavingEN ? 'not-allowed' : 'pointer', opacity: isSavingEN ? 0.6 : 1 }}
          >
            {isSavingEN ? 'Saving…' : 'Save EN'}
          </button>
          {saveENOk && <span style={{ fontSize: 12, color: '#4CAF50' }}>Saved successfully</span>}
          {enError  && <span style={{ fontSize: 12, color: '#E57373' }}>{enError}</span>}
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}

// ── New service modal ─────────────────────────────────────────────────────────
function NuevoServicioModal({
  onClose,
  onCreate,
}: {
  onClose:  () => void
  onCreate: (id: string) => void
}) {
  const [label, setLabel] = useState('')
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCreate() {
    if (!label.trim()) return
    setError(null)
    start(async () => {
      const result = await createServicio(label.trim())
      if ('error' in result) { setError(result.error) }
      else { onCreate(result.id) }
    })
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 8, width: 'min(420px, 92vw)', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 400, margin: '0 0 6px', color: '#1A1A1A' }}>Nuevo servicio contratable</h3>
        <p style={{ fontSize: 12, color: '#AAA', margin: '0 0 20px', lineHeight: 1.5 }}>
          El precio de este servicio se introducirá manualmente en cada propuesta. Podrás definir el texto, entregables y hitos de pago aquí.
        </p>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', marginBottom: 5 }}>
            Nombre del servicio
          </div>
          <input
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{
              width: '100%', boxSizing: 'border-box' as const,
              padding: '8px 10px', border: '1px solid #E8E6E0', borderRadius: 4,
              fontSize: 16, outline: 'none', fontFamily: "'Inter', system-ui, sans-serif",
            }}
            placeholder="Ej. Consultoría, Fotografía de obra…"
          />
          {error && <div style={{ fontSize: 11, color: '#E57373', marginTop: 6 }}>{error}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, fontSize: 13, cursor: 'pointer', color: '#666' }}>
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={isPending || !label.trim()}
            style={{ padding: '8px 20px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, cursor: isPending || !label.trim() ? 'not-allowed' : 'pointer', opacity: isPending || !label.trim() ? 0.5 : 1 }}
          >
            {isPending ? 'Creando…' : 'Crear servicio'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PlantillaPropuestasPage({
  servicios: initialServicios,
}: {
  servicios: ServicioEntry[]
}) {
  const router = useRouter()
  const [servicios, setServicios] = useState(initialServicios)
  const [selected, setSelected]  = useState(initialServicios[0]?.id ?? '')
  const [showModal, setShowModal] = useState(false)

  // Sync server-refreshed data back into local state
  useEffect(() => { setServicios(initialServicios) }, [initialServicios])

  const currentEntry = servicios.find(s => s.id === selected)

  function handleSaved(id: string, data: ServicioPlantillaData) {
    setServicios(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
    router.refresh()
  }

  function handleDeleted() {
    const remaining = servicios.filter(s => s.id !== selected)
    setServicios(remaining)
    setSelected(remaining[0]?.id ?? '')
    router.refresh()
  }

  function handleCreated(newId: string) {
    setShowModal(false)
    router.refresh()
    setSelected(newId)
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>
      {/* Header */}
      <div className="captacion-header" style={{ padding: '40px 40px 32px', borderBottom: '1px solid #E8E6E0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: 10, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Captación</p>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>Plantilla de propuestas</h1>
          <p style={{ fontSize: 13, color: '#AAA', margin: '8px 0 0', maxWidth: 560, lineHeight: 1.6 }}>
            Define el contenido de cada servicio contratable: nombre, texto de presentación, entregables, plazo y hitos de pago.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ padding: '10px 20px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          + Nuevo servicio
        </button>
      </div>

      {/* Body */}
      <div className="plantilla-layout" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: 'calc(100vh - 160px)' }}>
        {/* Left tabs */}
        <div className="plantilla-sidebar" style={{ borderRight: '1px solid #E8E6E0', background: '#fff', paddingTop: 20 }}>
          {/* Base services */}
          <div className="plantilla-sidebar-label" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#CCC', padding: '0 20px 8px' }}>
            Servicios base
          </div>
          {servicios.filter(s => !s.isCustom).map(s => (
            <TabButton key={s.id} entry={s} active={s.id === selected} onClick={() => setSelected(s.id)} />
          ))}

          {/* Custom services */}
          {servicios.some(s => s.isCustom) && (
            <>
              <div className="plantilla-sidebar-label" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#CCC', padding: '16px 20px 8px', borderTop: '1px solid #F0EEE8', marginTop: 8 }}>
                Servicios personalizados
              </div>
              {servicios.filter(s => s.isCustom).map(s => (
                <TabButton key={s.id} entry={s} active={s.id === selected} onClick={() => setSelected(s.id)} isCustom />
              ))}
            </>
          )}
        </div>

        {/* Editor — no maxWidth so two-column layout can breathe */}
        <div className="plantilla-editor" style={{ padding: '32px 40px' }}>
          {currentEntry ? (
            <ServicioEditor
              key={selected}
              entry={currentEntry}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ) : (
            <div style={{ color: '#CCC', fontStyle: 'italic', fontSize: 13, paddingTop: 40 }}>Selecciona un servicio</div>
          )}
        </div>
      </div>

      {showModal && (
        <NuevoServicioModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreated}
        />
      )}
    </div>
  )
}

function TabButton({ entry, active, onClick, isCustom }: { entry: ServicioEntry; active: boolean; onClick: () => void; isCustom?: boolean }) {
  const cfg = !entry.isCustom ? SERVICIOS_CONFIG[entry.id as keyof typeof SERVICIOS_CONFIG] : null
  return (
    <button
      onClick={onClick}
      data-active={active ? 'true' : 'false'}
      className="plantilla-tab-btn"
      style={{
        width: '100%', textAlign: 'left', background: active ? '#F8F7F4' : 'none',
        border: 'none', borderLeft: `3px solid ${active ? '#D85A30' : 'transparent'}`,
        padding: '11px 20px', cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#1A1A1A' : '#666' }}>
        {entry.label}
      </div>
      <div style={{ fontSize: 10, color: '#CCC', marginTop: 2 }}>
        {isCustom ? 'Precio manual' : cfg ? `${cfg.tipo === 'pem' ? `${(cfg.pem_split * 100).toFixed(0)}% PEM` : 'Ratio'}` : ''}
      </div>
    </button>
  )
}
