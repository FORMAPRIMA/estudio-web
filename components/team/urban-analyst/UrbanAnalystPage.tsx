'use client'

// Dashboard de Urban Analyst — tema oscuro "gemelo digital".

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createUrbanAsset, updateNormaZonal } from '@/app/actions/urban-analyst'
import type { UrbanAsset, NormaZonal, UrbanAssetStatus } from '@/lib/urban-analyst/types'

import {
  useUATheme,
  BG, PANEL, PANEL2, EDGE, EDGE2, TXT, BODY, SUB, FAINT, BRAND,
  OK, BAD, OVERLAY, SHADOW_LG,
} from './uaTheme'

const STATUS_META: Record<UrbanAssetStatus, { label: string; color: string }> = {
  pendiente:  { label: 'Sin analizar', color: FAINT },
  analizando: { label: 'Analizando…', color: BRAND },
  completado: { label: 'Analizado',   color: OK },
  error:      { label: 'Error',       color: BAD },
}

const TIPOS_OPERACION = ['Compra + reforma', 'Cambio de uso', 'Remonte / ampliación', 'Obra nueva', 'Due diligence de compra', 'Otro']

const CSS = `
@keyframes uaFadeUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
@keyframes uaGlow { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
.ua-card { transition: all .18s ease; animation: uaFadeUp .4s ease both }
.ua-card:hover { border-color: var(--ua-edge2) !important; transform: translateY(-2px); box-shadow: var(--ua-shadow) }
`

interface Props {
  initialAssets: UrbanAsset[]
  normasZonales: NormaZonal[]
}

export default function UrbanAnalystPage({ initialAssets, normasZonales }: Props) {
  const router = useRouter()
  const [assets] = useState(initialAssets)
  const { mode, toggle, vars } = useUATheme()
  const [showNuevo, setShowNuevo] = useState(false)
  const [showNormas, setShowNormas] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Alta con un solo campo: detecta si es referencia catastral o dirección
  const [entrada, setEntrada] = useState('')
  const [showTesis, setShowTesis] = useState(false)
  const [form, setForm] = useState({
    tipo_operacion: '', uso_objetivo: '', superficie_comercial: '',
    precio_compra: '', capex_estimado: '', notas: '',
  })

  const esRefcat = (s: string) => /^[0-9]{7}[A-Z]{2}[0-9]{4}[A-Z]([0-9]{4}[A-Z]{2})?$/i.test(s)

  // Tokens de la entrada: si TODOS son referencias catastrales (14 o 20 chars),
  // se normalizan a parcela (primeros 14) y se deduplican — las referencias por
  // piso de una división horizontal colapsan a su parcela (el edificio entero);
  // varias parcelas distintas = activo multi-parcela (esquinas, manzanas).
  const parseRefcats = (raw: string): string[] | null => {
    const tokens = raw.split(/[\s,;\n]+/).filter(Boolean)
    if (tokens.length === 0 || !tokens.every((t) => esRefcat(t))) return null
    return Array.from(new Set(tokens.map((t) => t.toUpperCase().slice(0, 14))))
  }
  const parcelas = parseRefcats(entrada.trim())

  const handleCreate = async () => {
    const valor = entrada.trim()
    if (!valor) return
    setCreateError('')
    setIsCreating(true)
    try {
      const { id } = await createUrbanAsset({
        ...(parcelas
          ? { refcat: parcelas[0], refcats: parcelas.slice(1) }
          : { direccion: valor }),
        tipo_operacion: form.tipo_operacion || undefined,
        uso_objetivo: form.uso_objetivo || undefined,
        superficie_comercial: form.superficie_comercial ? parseFloat(form.superficie_comercial) : null,
        precio_compra: form.precio_compra ? parseFloat(form.precio_compra) : null,
        capex_estimado: form.capex_estimado ? parseFloat(form.capex_estimado) : null,
        notas: form.notas || undefined,
      })
      fetch(`/api/urban-analyst/${id}/analyze`, { method: 'POST' }).catch(() => {})
      router.push(`/team/apps/urban-analyst/${id}`)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Error al crear el activo')
      setIsCreating(false)
    }
  }

  const input = (v: string, set: (s: string) => void, placeholder: string, span2 = false) => (
    <input
      value={v}
      onChange={(e) => set(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, gridColumn: span2 ? 'span 2' : undefined }}
    />
  )

  const analizados = assets.filter((a) => a.status === 'completado').length

  return (
    <div style={{ ...vars, minHeight: '100vh', background: BG, padding: '36px 40px', color: TXT }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Hero */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: BRAND, marginBottom: 10, fontWeight: 600 }}>
            Forma Prima · Madrid
          </p>
          <h1 style={{ fontSize: 34, fontWeight: 200, color: TXT, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            Urban Analyst
          </h1>
          <p style={{ fontSize: 13, color: SUB, marginTop: 8, fontWeight: 300, maxWidth: 560, lineHeight: 1.5 }}>
            Análisis urbanístico preliminar con gemelo 3D: Catastro, PGOUM, volumen capaz, red flags y escenarios —
            para decidir ofertas en minutos, no en días.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={toggle} style={{ ...btnGhost, padding: '10px 13px' }} title={mode === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>
            {mode === 'light' ? '☾' : '☀'}
          </button>
          <button onClick={() => setShowNormas(true)} style={btnGhost}>Normas zonales</button>
          <button onClick={() => setShowNuevo(true)} style={{ ...btnPrimary, padding: '12px 22px', fontSize: 11 }}>
            + Nuevo activo
          </button>
        </div>
      </div>

      {/* Mini stats */}
      <div style={{ display: 'flex', gap: 22, margin: '22px 0 26px', flexWrap: 'wrap' }}>
        {[
          [String(assets.length), 'activos en cartera'],
          [String(analizados), 'analizados'],
          [String(assets.filter((a) => a.status === 'analizando').length), 'en análisis'],
        ].map(([n, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 200, color: TXT }}>{n}</span>
            <span style={{ fontSize: 10, color: FAINT, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Grid de activos */}
      {assets.length === 0 ? (
        <div style={{ background: PANEL, borderRadius: 10, padding: '64px 32px', textAlign: 'center', border: `1px dashed ${EDGE}` }}>
          <p style={{ fontSize: 15, color: TXT, marginBottom: 8, fontWeight: 300 }}>Todavía no hay activos</p>
          <p style={{ fontSize: 12, color: FAINT, fontWeight: 300, marginBottom: 22 }}>
            Crea el primero con una dirección o referencia catastral: el análisis y el gemelo 3D arrancan solos.
          </p>
          <button onClick={() => setShowNuevo(true)} style={btnPrimary}>+ Nuevo activo</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 12 }}>
          {assets.map((a, i) => {
            const st = STATUS_META[a.status]
            return (
              <Link key={a.id} href={`/team/apps/urban-analyst/${a.id}`} style={{ textDecoration: 'none' }}>
                <div className="ua-card" style={{
                  background: PANEL, borderRadius: 10, padding: '20px 22px',
                  border: `1px solid ${EDGE}`, cursor: 'pointer',
                  animationDelay: `${Math.min(i * 0.05, 0.4)}s`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <p style={{ fontSize: 15, fontWeight: 500, color: TXT, letterSpacing: '-0.01em' }}>{a.nombre}</p>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: st.color, whiteSpace: 'nowrap' }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: 3, background: st.color,
                        animation: a.status === 'analizando' ? 'uaGlow 1.2s ease infinite' : undefined,
                      }} />
                      {st.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 11.5, color: SUB, fontWeight: 300, marginBottom: 12 }}>
                    {a.direccion || 'Sin dirección'}
                  </p>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {[
                      a.norma_zonal ? ['NZ', a.norma_zonal] : null,
                      a.parcel_area ? ['Parcela', `${Math.round(a.parcel_area)} m²`] : null,
                      a.built_area ? ['Construido', `${Math.round(a.built_area)} m²`] : null,
                    ].filter(Boolean).map((pair) => (
                      <div key={(pair as string[])[0]}>
                        <p style={{ fontSize: 7.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, marginBottom: 1 }}>{(pair as string[])[0]}</p>
                        <p style={{ fontSize: 12, color: BODY, fontWeight: 400 }}>{(pair as string[])[1]}</p>
                      </div>
                    ))}
                    {!a.norma_zonal && !a.parcel_area && (
                      <p style={{ fontSize: 10.5, color: FAINT, fontWeight: 300 }}>{a.refcat ? `RC ${a.refcat}` : 'Pendiente de análisis'}</p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <p style={{ fontSize: 9, color: FAINT, marginTop: 26, fontWeight: 300 }}>
        Fuentes oficiales: Catastro INSPIRE · Geoportal Ayto. Madrid (sin valor jurídico) · IGN/PNOA · Cartografía base municipal.
      </p>

      {/* Modal: nuevo activo — un solo campo, tesis opcional */}
      {showNuevo && (
        <div style={overlayStyle} onClick={() => !isCreating && setShowNuevo(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: BRAND, marginBottom: 6, fontWeight: 600 }}>Nuevo activo</p>
            <h2 style={{ fontSize: 20, fontWeight: 300, color: TXT, marginBottom: 6 }}>Pega una dirección o una referencia catastral</h2>
            <p style={{ fontSize: 11, color: FAINT, fontWeight: 300, marginBottom: 16, lineHeight: 1.5 }}>
              Con eso basta: nombre, superficies y uso actual salen de Catastro. La tesis de inversión puedes
              añadirla ahora o editarla después desde la ficha.
            </p>

            <input
              autoFocus
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && entrada.trim() && !isCreating) handleCreate() }}
              placeholder="Calle Hermosilla 46 · una refcat · o varias refs (pisos o parcelas) separadas por comas"
              style={{ ...inputStyle, padding: '14px 16px', fontSize: 15, borderColor: entrada.trim() ? EDGE2 : EDGE }}
            />
            {entrada.trim() && (
              <p style={{ fontSize: 10, color: parcelas ? OK : SUB, marginTop: 6, fontWeight: 300 }}>
                {parcelas
                  ? parcelas.length === 1
                    ? '● Referencia catastral detectada — se analiza la parcela completa (todos los pisos del edificio)'
                    : `● ${parcelas.length} parcelas detectadas — se analizará el conjunto como un solo activo`
                  : '● Se interpretará como dirección — incluye el municipio si no es Madrid capital (fuera de la capital el análisis PGOUM no aplica)'}
              </p>
            )}

            <button
              onClick={() => setShowTesis(!showTesis)}
              style={{ background: 'none', border: 'none', color: SUB, fontSize: 10.5, cursor: 'pointer', padding: 0, marginTop: 16, letterSpacing: '0.06em' }}
            >
              {showTesis ? '− Ocultar tesis de inversión' : '+ Añadir tesis de inversión (opcional)'}
            </button>

            {showTesis && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <select
                  value={form.tipo_operacion}
                  onChange={(e) => setForm({ ...form, tipo_operacion: e.target.value })}
                  style={{ ...inputStyle, color: form.tipo_operacion ? TXT : FAINT }}
                >
                  <option value="">Tipo de operación…</option>
                  {TIPOS_OPERACION.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {input(form.uso_objetivo, (v) => setForm({ ...form, uso_objetivo: v }), 'Uso objetivo (ej. hotelero)')}
                {input(form.superficie_comercial, (v) => setForm({ ...form, superficie_comercial: v }), 'Superficie dossier m²')}
                {input(form.precio_compra, (v) => setForm({ ...form, precio_compra: v }), 'Precio compra €')}
                {input(form.capex_estimado, (v) => setForm({ ...form, capex_estimado: v }), 'CAPEX estimado €')}
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Hipótesis / notas"
                  rows={2}
                  style={{ ...inputStyle, gridColumn: 'span 2', resize: 'vertical' }}
                />
              </div>
            )}

            {createError && <p style={{ fontSize: 12, color: BAD, marginTop: 12 }}>{createError}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowNuevo(false)} disabled={isCreating} style={btnGhost}>Cancelar</button>
              <button
                onClick={handleCreate}
                disabled={isCreating || !entrada.trim()}
                style={{ ...btnPrimary, opacity: isCreating || !entrada.trim() ? 0.5 : 1 }}
              >
                {isCreating ? 'Creando…' : 'Analizar →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNormas && (
        <NormasZonalesModal normas={normasZonales} onClose={() => setShowNormas(false)} />
      )}
    </div>
  )
}

// ── Editor de la tabla de normas zonales ─────────────────────────────────────

function NormasZonalesModal({ normas, onClose }: { normas: NormaZonal[]; onClose: () => void }) {
  const router = useRouter()
  const [rows, setRows] = useState(normas)
  const [savingCodigo, setSavingCodigo] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const setField = (codigo: string, field: keyof NormaZonal, value: unknown) => {
    setRows((rs) => rs.map((x) => (x.codigo === codigo ? { ...x, [field]: value } : x)))
  }

  const save = async (row: NormaZonal) => {
    setSavingCodigo(row.codigo)
    try {
      await updateNormaZonal(row.codigo, {
        coef_edificabilidad: row.coef_edificabilidad,
        formula_c: row.formula_c,
        altura_max_plantas: row.altura_max_plantas,
        ocupacion_pct: row.ocupacion_pct,
        plantas_bajo_rasante: row.plantas_bajo_rasante,
        altura_cornisa_m: row.altura_cornisa_m,
        altura_max_m: row.altura_max_m,
        retranqueo_frente_m: row.retranqueo_frente_m,
        retranqueo_lateral_m: row.retranqueo_lateral_m,
        retranqueo_testero_m: row.retranqueo_testero_m,
        altura_piso_m: row.altura_piso_m,
        altura_piso_pb_m: row.altura_piso_pb_m,
        altura_libre_min_m: row.altura_libre_min_m,
        parcela_minima_m2: row.parcela_minima_m2,
        frente_minimo_m: row.frente_minimo_m,
        regimen_usos: row.regimen_usos as Record<string, string> | null,
        fuente_articulo: row.fuente_articulo,
        uso_cualificado: row.uso_cualificado,
        verificado: row.verificado,
      })
      router.refresh()
    } finally {
      setSavingCodigo(null)
    }
  }

  // Campos numéricos de la matriz (label corto, clave, decimales)
  const camposMatriz: { key: keyof NormaZonal; label: string; step?: string }[] = [
    { key: 'coef_edificabilidad', label: 'Edificab. (m²c/m²s)', step: '0.01' },
    { key: 'formula_c',           label: 'C fórmula S×Z×C',     step: '0.001' },
    { key: 'ocupacion_pct',       label: 'Ocupación (%)',       step: '0.1' },
    { key: 'altura_max_plantas',  label: 'Plantas s/rasante' },
    { key: 'plantas_bajo_rasante',label: 'Plantas b/rasante' },
    { key: 'altura_cornisa_m',    label: 'Alt. cornisa (m)',    step: '0.1' },
    { key: 'altura_max_m',        label: 'Alt. máxima (m)',     step: '0.1' },
    { key: 'retranqueo_frente_m', label: 'Retranq. frente (m)', step: '0.1' },
    { key: 'retranqueo_lateral_m',label: 'Retranq. lateral (m)',step: '0.1' },
    { key: 'retranqueo_testero_m',label: 'Retranq. testero (m)',step: '0.1' },
    { key: 'altura_piso_m',       label: 'Alt. piso (m)',       step: '0.05' },
    { key: 'altura_piso_pb_m',    label: 'Alt. piso PB (m)',    step: '0.05' },
    { key: 'altura_libre_min_m',  label: 'Alt. libre mín. (m)', step: '0.05' },
    { key: 'parcela_minima_m2',   label: 'Parcela mín. (m²)' },
    { key: 'frente_minimo_m',     label: 'Frente mín. (m)',     step: '0.1' },
  ]

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: BRAND, marginBottom: 6, fontWeight: 600 }}>Tabla curada · PGOUM 1997</p>
        <h2 style={{ fontSize: 20, fontWeight: 300, color: TXT, marginBottom: 8 }}>Normas zonales — matriz de parámetros</h2>
        <p style={{ fontSize: 11.5, color: SUB, fontWeight: 300, marginBottom: 18, lineHeight: 1.5 }}>
          Una fila por norma / grado / nivel (ej. 8.1.a). El cuadro urbanístico usa estos valores y solo
          los trata como fiables si están marcados como verificados contra las NNUU. Despliega una fila
          para editar la matriz completa (ocupación, alturas, retranqueos, usos).
        </p>
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          {rows.map((r) => (
            <div key={r.codigo} style={{ borderBottom: `1px solid ${EDGE}` }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === r.codigo ? null : r.codigo)}
              >
                <span style={{ width: 52, fontSize: 13, fontWeight: 600, color: BRAND }}>{r.codigo}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, color: TXT }}>{r.nombre}</p>
                  <p style={{ fontSize: 9.5, color: FAINT, fontWeight: 300, marginTop: 2 }}>
                    {[
                      r.coef_edificabilidad != null ? `${r.coef_edificabilidad} m²c/m²s` : null,
                      r.formula_c != null ? `E = S×Z×C (C ${r.formula_c})` : null,
                      r.ocupacion_pct != null ? `ocup. ${r.ocupacion_pct}%` : null,
                      r.altura_max_plantas != null ? `${r.altura_max_plantas} pl` : null,
                      r.fuente_articulo,
                    ].filter(Boolean).join(' · ') || 'sin parámetros — pendiente de rellenar'}
                  </p>
                </div>
                <span style={{
                  fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
                  color: r.verificado ? '#3E7A4E' : '#B8860B',
                }}>
                  {r.verificado ? 'verificada' : 'hipótesis'}
                </span>
                <span style={{ fontSize: 11, color: FAINT }}>{expanded === r.codigo ? '▾' : '▸'}</span>
              </div>

              {expanded === r.codigo && (
                <div style={{ padding: '4px 0 14px 52px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {camposMatriz.map((c) => (
                      <label key={String(c.key)} style={{ display: 'block' }}>
                        <span style={{ display: 'block', fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT, marginBottom: 3 }}>{c.label}</span>
                        <input
                          type="number" step={c.step || '1'}
                          value={(r[c.key] as number | null) ?? ''}
                          onChange={(e) => setField(r.codigo, c.key, e.target.value === '' ? null : parseFloat(e.target.value))}
                          style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }}
                        />
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <label style={{ display: 'block' }}>
                      <span style={{ display: 'block', fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT, marginBottom: 3 }}>Uso cualificado</span>
                      <input
                        value={r.uso_cualificado ?? ''}
                        onChange={(e) => setField(r.codigo, 'uso_cualificado', e.target.value || null)}
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }}
                      />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span style={{ display: 'block', fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT, marginBottom: 3 }}>Fuente (artículos NNUU)</span>
                      <input
                        value={r.fuente_articulo ?? ''} placeholder="ej. arts. 8.8.5-8.8.9 NNUU"
                        onChange={(e) => setField(r.codigo, 'fuente_articulo', e.target.value || null)}
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }}
                      />
                    </label>
                  </div>
                  <label style={{ display: 'block', marginTop: 8 }}>
                    <span style={{ display: 'block', fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT, marginBottom: 3 }}>Régimen de usos (compatibles / autorizables / prohibidos)</span>
                    <textarea
                      value={r.regimen_usos?.texto ?? ''}
                      onChange={(e) => setField(r.codigo, 'regimen_usos', e.target.value ? { ...(r.regimen_usos || {}), texto: e.target.value } : null)}
                      rows={2}
                      style={{ ...inputStyle, padding: '6px 8px', fontSize: 12, resize: 'vertical' }}
                    />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: SUB, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={r.verificado}
                        onChange={(e) => setField(r.codigo, 'verificado', e.target.checked)}
                      />
                      Verificada contra NNUU
                    </label>
                    <button onClick={() => save(r)} disabled={savingCodigo === r.codigo} style={{ ...btnGhost, padding: '6px 14px', fontSize: 9 }}>
                      {savingCodigo === r.codigo ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnPrimary}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ── Estilos compartidos ──────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: OVERLAY, zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  backdropFilter: 'blur(6px)',
}
const modalStyle: React.CSSProperties = {
  background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 12, padding: '28px 30px',
  width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: SHADOW_LG, color: TXT,
}
const btnPrimary: React.CSSProperties = {
  padding: '10px 18px', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  background: BRAND, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600,
}
const btnGhost: React.CSSProperties = {
  padding: '10px 16px', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  background: 'transparent', color: TXT, border: `1px solid ${EDGE}`, borderRadius: 5, cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13, background: PANEL2, color: TXT,
  border: `1px solid ${EDGE}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit',
}
