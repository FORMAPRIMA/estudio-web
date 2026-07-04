'use client'

// Cabina de análisis del activo — tema oscuro "gemelo digital".
// El 3D orbitable es el protagonista; la información crítica (KPIs, veredicto,
// red flags) es visible de un vistazo y el resto vive en paneles laterales.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  getUrbanAssetFull, getUrbanAssetStatus, deleteUrbanAsset, updateUrbanAsset,
  createUrbanScenario, deleteUrbanScenario, createUrbanDocument, deleteUrbanDocument,
  clearUrbanChat,
} from '@/app/actions/urban-analyst'
import type { UrbanAssetFull } from '@/app/actions/urban-analyst'
import { createClient } from '@/lib/supabase/client'
import type {
  PipelineStep, UrbanChatMessage, Severidad, EdificabilidadResult,
} from '@/lib/urban-analyst/types'
import { TIPOS_ESCENARIO } from '@/lib/urban-analyst/types'
import type { VolumenCapazResult } from '@/lib/urban-analyst/volumenCapaz'
import { computeChecklist, type ChecklistItem, type ChecklistEstado } from '@/lib/urban-analyst/checklist'
import { resolveDocumentosOficiales } from '@/lib/urban-analyst/documentosOficiales'

const UrbanAssetMap = dynamic(() => import('./UrbanAssetMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', minHeight: 360, background: 'var(--ua-bg, #F6F5F2)' }} />,
})

// ── Tema (CSS variables — light por defecto, toggle a dark) ──────────────────
import {
  useUATheme, alpha,
  BG, PANEL, PANEL2, EDGE, EDGE2, TXT, BODY, SUB, FAINT, BRAND,
  OK, WARN, BAD, CRIT, GLASS, OVERLAY, SHADOW_LG,
} from './uaTheme'

const SEV: Record<Severidad, { color: string; label: string }> = {
  baja:    { color: FAINT, label: 'Baja' },
  media:   { color: WARN,  label: 'Media' },
  alta:    { color: BAD,   label: 'Alta' },
  critica: { color: CRIT,  label: 'Crítica' },
}

const TAG_COLOR: Record<string, string> = { oficial: OK, inferido: SUB, hipotesis: WARN }

const VEREDICTO: Record<string, { label: string; color: string }> = {
  avanzar:            { label: 'Avanzar',            color: OK },
  condicionar_oferta: { label: 'Condicionar oferta', color: WARN },
  renegociar:         { label: 'Renegociar',         color: WARN },
  descartar:          { label: 'Descartar',          color: BAD },
}

type Tab = 'ficha' | 'edificabilidad' | 'riesgos' | 'checklist' | 'escenarios' | 'chat' | 'documentos'

const GLOBAL_CSS = `
@keyframes uaFadeUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
@keyframes uaPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
@keyframes uaSweep { from { background-position: -200% 0 } to { background-position: 200% 0 } }
.ua-panel { animation: uaFadeUp .45s ease both }
.ua-scroll::-webkit-scrollbar { width: 8px; height: 8px }
.ua-scroll::-webkit-scrollbar-thumb { background: var(--ua-edge); border-radius: 4px }
.ua-scroll::-webkit-scrollbar-track { background: transparent }
.ua-popup .maplibregl-popup-content { background: var(--ua-panel); color: var(--ua-txt); border: 1px solid var(--ua-edge); border-radius: 6px; box-shadow: var(--ua-shadow); padding: 10px 12px }
.ua-popup .maplibregl-popup-tip { border-top-color: var(--ua-panel) !important; border-bottom-color: var(--ua-panel) !important }
.ua-kpi:hover { border-color: var(--ua-edge2) !important; transform: translateY(-1px) }
.ua-tabbtn:hover { color: var(--ua-txt) !important }
`

export default function UrbanAssetDetalle({ initial }: { initial: UrbanAssetFull }) {
  const router = useRouter()
  const [data, setData] = useState<UrbanAssetFull>(initial)
  const [tab, setTab] = useState<Tab>('ficha')
  const [isDeleting, setIsDeleting] = useState(false)
  const [showTesis, setShowTesis] = useState(false)
  const { mode, toggle, vars } = useUATheme()

  const { asset } = data
  const memo = data.analysis.find((a) => a.kind === 'memo')?.content as Record<string, unknown> | undefined
  const edificabilidad = data.analysis.find((a) => a.kind === 'edificabilidad')?.content as unknown as EdificabilidadResult | undefined
  const volumenCapaz = data.analysis.find((a) => a.kind === 'volumen_capaz')?.content as unknown as VolumenCapazResult | undefined

  const refreshFull = useCallback(async () => {
    const full = await getUrbanAssetFull(asset.id)
    if (full) setData(full)
  }, [asset.id])

  useEffect(() => {
    if (asset.status !== 'analizando') return
    const interval = setInterval(async () => {
      const st = await getUrbanAssetStatus(asset.id)
      if (!st) return
      if (st.status !== 'analizando') {
        clearInterval(interval)
        await refreshFull()
      } else {
        setData((d) => ({ ...d, asset: { ...d.asset, pipeline: st.pipeline, status: st.status } }))
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [asset.status, asset.id, refreshFull])

  const handleAnalyze = async () => {
    setData((d) => ({
      ...d,
      asset: { ...d.asset, status: 'analizando', pipeline: [], error_msg: null },
    }))
    fetch(`/api/urban-analyst/${asset.id}/analyze`, { method: 'POST' })
      .then(() => refreshFull())
      .catch(() => refreshFull())
  }

  const handleAddParcela = useCallback(async (rc: string) => {
    const actuales = [...(asset.refcats || [])]
    if (rc === asset.refcat || actuales.includes(rc)) return
    await updateUrbanAsset(asset.id, { refcats: [...actuales, rc] })
    // Re-analizar con el conjunto de parcelas actualizado
    setData((d) => ({
      ...d,
      asset: { ...d.asset, refcats: [...actuales, rc], status: 'analizando', pipeline: [], error_msg: null },
    }))
    fetch(`/api/urban-analyst/${asset.id}/analyze`, { method: 'POST' })
      .then(() => refreshFull())
      .catch(() => refreshFull())
  }, [asset.id, asset.refcat, asset.refcats, refreshFull])

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el activo "${asset.nombre}" y todo su análisis?`)) return
    setIsDeleting(true)
    await deleteUrbanAsset(asset.id)
    router.push('/team/apps/urban-analyst')
  }

  const recomendacion = memo?.recomendacion as { veredicto?: string; justificacion?: string } | undefined
  const ver = recomendacion?.veredicto ? VEREDICTO[recomendacion.veredicto] : null
  const flagsAltas = data.redFlags.filter((f) => f.severidad === 'alta' || f.severidad === 'critica').length

  const fmtK = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('es-ES').format(Math.round(n)))

  const kpis: { label: string; value: string; unit?: string; color?: string; sub?: string }[] = [
    { label: 'Norma zonal', value: asset.norma_zonal || '—', sub: asset.norma_zonal_denominacion || undefined },
    { label: 'Parcela', value: fmtK(asset.parcel_area), unit: 'm²', sub: 'oficial Catastro' },
    { label: 'Construido', value: fmtK(asset.built_area), unit: 'm²c', sub: 'Catastro' },
    { label: 'Volumen capaz', value: fmtK(volumenCapaz?.capaz_total_m2c), unit: 'm²c', sub: 'bandas COEF_Z' },
    {
      label: 'Remanente', value: fmtK(volumenCapaz?.remanente_materializable_m2c), unit: 'm²c',
      color: (volumenCapaz?.remanente_materializable_m2c ?? 0) > 0 ? OK : SUB, sub: 'materializable teórico',
    },
    {
      label: 'Red flags', value: String(data.redFlags.length || 0),
      color: flagsAltas > 0 ? BAD : data.redFlags.length > 0 ? WARN : OK,
      sub: flagsAltas > 0 ? `${flagsAltas} altas/críticas` : 'ninguna crítica',
    },
  ]

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'ficha', label: 'Ficha' },
    { key: 'edificabilidad', label: 'Edificabilidad' },
    { key: 'riesgos', label: 'Riesgos', badge: data.redFlags.length || undefined },
    { key: 'checklist', label: 'Checklist' },
    { key: 'escenarios', label: 'Escenarios', badge: data.scenarios.length || undefined },
    { key: 'chat', label: 'Chat' },
    { key: 'documentos', label: 'Docs', badge: data.documents.length || undefined },
  ]

  const analizando = asset.status === 'analizando'

  return (
    <div style={{ ...vars, minHeight: '100vh', background: BG, padding: '22px 26px 30px', color: TXT }}>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />

      {/* ── Topbar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, minWidth: 0, flexWrap: 'wrap' }}>
          <Link href="/team/apps/urban-analyst" style={{ fontSize: 10, color: FAINT, textDecoration: 'none', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            ← Urban Analyst
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', color: TXT }}>
            {asset.nombre}
          </h1>
          <span style={{ fontSize: 11.5, color: SUB, fontWeight: 300 }}>
            {[asset.direccion, asset.refcat ? `RC ${asset.refcat}` : null].filter(Boolean).join('  ·  ')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggle} style={{ ...btnGhost, padding: '9px 12px' }} title={mode === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>
            {mode === 'light' ? '☾' : '☀'}
          </button>
          <button onClick={() => setShowTesis(true)} style={btnGhost}>Tesis</button>
          {asset.status === 'completado' && (
            <a href={`/api/urban-analyst/${asset.id}/informe`} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>
              Informe PDF
            </a>
          )}
          <button onClick={handleAnalyze} disabled={analizando} style={{ ...btnPrimary, opacity: analizando ? 0.5 : 1 }}>
            {analizando ? 'Analizando…' : asset.status === 'completado' ? 'Re-analizar' : 'Analizar'}
          </button>
          <button onClick={handleDelete} disabled={isDeleting} style={{ ...btnGhost, color: BAD, borderColor: alpha(BAD, 30) }}>
            {isDeleting ? '…' : 'Eliminar'}
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} className="ua-kpi" style={{
            background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 8, padding: '12px 16px',
            transition: 'all .2s ease',
          }}>
            <p style={{ fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 21, fontWeight: 200, color: k.color || TXT, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {k.value}{k.unit && <span style={{ fontSize: 10.5, color: FAINT, marginLeft: 4, fontWeight: 300 }}>{k.unit}</span>}
            </p>
            {k.sub && <p style={{ fontSize: 9, color: FAINT, marginTop: 5, fontWeight: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Veredicto ── */}
      {ver && !analizando && (
        <div className="ua-panel" style={{
          display: 'flex', alignItems: 'center', gap: 14, background: `linear-gradient(90deg, ${alpha(ver.color, 9)}, transparent 60%)`,
          border: `1px solid ${EDGE}`, borderLeft: `3px solid ${ver.color}`, borderRadius: 8,
          padding: '12px 18px', marginBottom: 14,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ver.color, whiteSpace: 'nowrap' }}>
            {ver.label}
          </span>
          <span style={{ fontSize: 12, color: SUB, fontWeight: 300, lineHeight: 1.5 }}>
            {recomendacion?.justificacion}
          </span>
        </div>
      )}

      {/* ── Split principal: gemelo 3D protagonista + panel de datos ── */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* Visor (héroe) */}
        <div style={{ flex: '1 1 560px', minWidth: 340, position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${EDGE}`, height: 'calc(100vh - 300px)', minHeight: 440 }}>
          <UrbanAssetMap
            geometry={asset.parcel_geometry}
            lat={asset.lat}
            lng={asset.lng}
            volumen={volumenCapaz ? { bandas: volumenCapaz.bandas, partes: volumenCapaz.partes } : null}
            auto3D={asset.status === 'completado'}
            mode={mode}
            currentRefcats={[asset.refcat, ...(asset.refcats || [])].filter(Boolean) as string[]}
            onAddParcela={handleAddParcela}
          />
          {/* Overlay del pipeline durante el análisis */}
          {(analizando || asset.status === 'error') && (
            <PipelineOverlay steps={asset.pipeline || []} errorMsg={asset.error_msg} analizando={analizando} />
          )}
        </div>

        {/* Panel de información */}
        <div className="ua-scroll" style={{ flex: '0 1 430px', minWidth: 320, height: 'calc(100vh - 300px)', minHeight: 440, overflowY: 'auto', paddingRight: 2 }}>
          {/* Tabs pill */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap', position: 'sticky', top: 0, background: BG, paddingBottom: 6, zIndex: 3 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                className="ua-tabbtn"
                onClick={() => setTab(t.key)}
                style={{
                  padding: '7px 12px', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                  background: tab === t.key ? PANEL2 : 'transparent',
                  border: `1px solid ${tab === t.key ? EDGE2 : 'transparent'}`,
                  borderRadius: 20, cursor: 'pointer',
                  color: tab === t.key ? TXT : FAINT,
                  fontWeight: tab === t.key ? 600 : 400,
                  transition: 'color .15s ease',
                }}
              >
                {t.label}{t.badge ? ` · ${t.badge}` : ''}
              </button>
            ))}
          </div>

          <div key={tab} className="ua-panel">
            {tab === 'ficha' && <FichaTab data={data} memo={memo} />}
            {tab === 'edificabilidad' && <EdificabilidadTab edificabilidad={edificabilidad} volumen={volumenCapaz} />}
            {tab === 'riesgos' && <RiesgosTab data={data} />}
            {tab === 'checklist' && <ChecklistTab data={data} />}
            {tab === 'escenarios' && <EscenariosTab data={data} onChanged={refreshFull} />}
            {tab === 'chat' && <ChatTab assetId={asset.id} initialMessages={data.chat} disabled={asset.status !== 'completado'} />}
            {tab === 'documentos' && <DocumentosTab data={data} onChanged={refreshFull} />}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 9, color: FAINT, marginTop: 10, fontWeight: 300 }}>
        Fuentes: Catastro INSPIRE · Geoportal Ayto. Madrid (sin valor jurídico) · IGN/PNOA · Cartografía base municipal.
        El volumen capaz es una envolvente teórica; las conclusiones [HIPÓTESIS] requieren verificación oficial.
        Tip: en modo 2D (con la capa Catastro), clic sobre una parcela vecina para añadirla al activo si el edificio ocupa varias.
      </p>

      {showTesis && (
        <TesisModal
          asset={asset}
          onClose={() => setShowTesis(false)}
          onSaved={async () => { setShowTesis(false); await refreshFull() }}
        />
      )}
    </div>
  )
}

// ── Modal: editar tesis de inversión ─────────────────────────────────────────

const TIPOS_OPERACION = ['Compra + reforma', 'Cambio de uso', 'Remonte / ampliación', 'Obra nueva', 'Due diligence de compra', 'Otro']

function TesisModal({ asset, onClose, onSaved }: {
  asset: UrbanAssetFull['asset']
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [f, setF] = useState({
    nombre: asset.nombre || '',
    refcatsStr: [asset.refcat, ...(asset.refcats || [])].filter(Boolean).join(', '),
    tipo_operacion: asset.tipo_operacion || '',
    uso_actual: asset.uso_actual || '',
    uso_objetivo: asset.uso_objetivo || '',
    superficie_comercial: asset.superficie_comercial != null ? String(asset.superficie_comercial) : '',
    precio_compra: asset.precio_compra != null ? String(asset.precio_compra) : '',
    capex_estimado: asset.capex_estimado != null ? String(asset.capex_estimado) : '',
    notas: asset.notas || '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    setIsSaving(true)
    try {
      // Referencias: tokens normalizados a parcela (14 chars) y deduplicados
      const refs = Array.from(new Set(
        f.refcatsStr.split(/[\s,;\n]+/).filter(Boolean).map((r) => r.toUpperCase().slice(0, 14))
      )).filter((r) => /^[0-9]{7}[A-Z]{2}[0-9]{4}[A-Z]$/.test(r))
      await updateUrbanAsset(asset.id, {
        nombre: f.nombre.trim() || undefined,
        ...(refs.length > 0 ? { refcat: refs[0], refcats: refs.slice(1) } : {}),
        tipo_operacion: f.tipo_operacion || undefined,
        uso_actual: f.uso_actual || undefined,
        uso_objetivo: f.uso_objetivo || undefined,
        superficie_comercial: f.superficie_comercial ? parseFloat(f.superficie_comercial) : null,
        precio_compra: f.precio_compra ? parseFloat(f.precio_compra) : null,
        capex_estimado: f.capex_estimado ? parseFloat(f.capex_estimado) : null,
        notas: f.notas || undefined,
      })
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando la tesis')
      setIsSaving(false)
    }
  }

  const inp = (key: keyof typeof f, placeholder: string, span2 = false) => (
    <input
      value={f[key]}
      onChange={(e) => setF({ ...f, [key]: e.target.value })}
      placeholder={placeholder}
      style={{ ...inputStyle, gridColumn: span2 ? 'span 2' : undefined }}
    />
  )

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: OVERLAY, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(6px)',
      }}
      onClick={() => !isSaving && onClose()}
    >
      <div
        style={{
          background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 12, padding: '26px 28px',
          width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: SHADOW_LG,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: BRAND, marginBottom: 6, fontWeight: 600 }}>Tesis de inversión</p>
        <h2 style={{ fontSize: 18, fontWeight: 300, color: TXT, marginBottom: 16 }}>{asset.nombre}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {inp('nombre', 'Nombre del activo', true)}
          <textarea
            value={f.refcatsStr}
            onChange={(e) => setF({ ...f, refcatsStr: e.target.value })}
            placeholder="Referencias catastrales (una o varias, separadas por comas — las de piso colapsan a su parcela)"
            rows={2}
            style={{ ...inputStyle, gridColumn: 'span 2', resize: 'vertical', fontSize: 11.5 }}
          />
          <select
            value={f.tipo_operacion}
            onChange={(e) => setF({ ...f, tipo_operacion: e.target.value })}
            style={{ ...inputStyle, gridColumn: 'span 2', color: f.tipo_operacion ? TXT : FAINT }}
          >
            <option value="">Tipo de operación…</option>
            {TIPOS_OPERACION.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {inp('uso_actual', 'Uso actual (si difiere de Catastro)')}
          {inp('uso_objetivo', 'Uso objetivo (ej. hotelero)')}
          {inp('superficie_comercial', 'Superficie dossier m²')}
          {inp('precio_compra', 'Precio compra €')}
          {inp('capex_estimado', 'CAPEX estimado €')}
          <textarea
            value={f.notas}
            onChange={(e) => setF({ ...f, notas: e.target.value })}
            placeholder="Hipótesis / notas"
            rows={3}
            style={{ ...inputStyle, gridColumn: 'span 2', resize: 'vertical' }}
          />
        </div>
        <p style={{ fontSize: 10, color: FAINT, marginTop: 12, fontWeight: 300, lineHeight: 1.5 }}>
          Al cambiar el uso objetivo o la superficie del dossier, re-analiza el activo para recalcular las red flags
          (cambio de uso, discrepancia de superficies) y la ficha del analista con la nueva tesis.
        </p>
        {error && <p style={{ fontSize: 12, color: BAD, marginTop: 10 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} disabled={isSaving} style={btnGhost}>Cancelar</button>
          <button onClick={save} disabled={isSaving} style={{ ...btnPrimary, opacity: isSaving ? 0.5 : 1 }}>
            {isSaving ? 'Guardando…' : 'Guardar tesis'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Overlay del pipeline (sobre el visor) ────────────────────────────────────

function PipelineOverlay({ steps, errorMsg, analizando }: { steps: PipelineStep[]; errorMsg: string | null; analizando: boolean }) {
  const color = (s: PipelineStep['status']) =>
    s === 'ok' ? OK : s === 'aviso' ? WARN : s === 'error' ? BAD : s === 'en_curso' ? BRAND : EDGE2
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: GLASS, backdropFilter: 'blur(6px)',
    }}>
      <div style={{ width: 'min(460px, 88%)', background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 12, padding: '26px 30px', boxShadow: SHADOW_LG }}>
        <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: BRAND, marginBottom: 4, fontWeight: 600 }}>
          {analizando ? 'Analizando activo' : 'Análisis interrumpido'}
        </p>
        <p style={{ fontSize: 11, color: FAINT, fontWeight: 300, marginBottom: 18 }}>
          Catastro · PGOUM · volumen capaz · red flags · analista IA
        </p>
        {analizando && (
          <div style={{
            height: 2, borderRadius: 1, marginBottom: 18,
            background: `linear-gradient(90deg, transparent, ${BRAND}, transparent)`,
            backgroundSize: '200% 100%', animation: 'uaSweep 1.6s linear infinite',
          }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {steps.map((s) => (
            <div key={s.key} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4, background: color(s.status), flexShrink: 0,
                alignSelf: 'center',
                animation: s.status === 'en_curso' ? 'uaPulse 1.1s ease infinite' : undefined,
              }} />
              <span style={{ fontSize: 12, color: s.status === 'pendiente' ? FAINT : TXT, minWidth: 190 }}>{s.label}</span>
              {s.detail && <span style={{ fontSize: 10, color: FAINT, fontWeight: 300, lineHeight: 1.4 }}>{s.detail}</span>}
            </div>
          ))}
        </div>
        {errorMsg && <p style={{ fontSize: 11.5, color: BAD, marginTop: 14 }}>{errorMsg}</p>}
      </div>
    </div>
  )
}

// ── Tab: Ficha ───────────────────────────────────────────────────────────────

function FichaTab({ data, memo }: { data: UrbanAssetFull; memo?: Record<string, unknown> }) {
  const { asset } = data
  const [showCapas, setShowCapas] = useState(false)
  const confianza = memo?.nivel_confianza as { nivel?: string; motivo?: string } | undefined

  const datoRow = (label: string, valor: string | number | null | undefined, tipo?: string) =>
    valor == null || valor === '' ? null : (
      <div key={label} style={{ display: 'flex', padding: '7px 0', borderBottom: `1px solid ${EDGE}`, gap: 8 }}>
        <span style={{ width: '42%', fontSize: 11.5, color: SUB, fontWeight: 300 }}>{label}</span>
        <span style={{ flex: 1, fontSize: 12, color: TXT }}>{valor}</span>
        {tipo && <span style={{ fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', color: TAG_COLOR[tipo] || FAINT, alignSelf: 'center' }}>{tipo}</span>}
      </div>
    )

  const fmtNum = (n: number | null) => (n == null ? null : new Intl.NumberFormat('es-ES').format(n))

  const secciones: { titulo: string; texto?: unknown }[] = [
    { titulo: 'Situación urbanística', texto: memo?.situacion_urbanistica },
    { titulo: 'Protección patrimonial', texto: memo?.patrimonio },
    { titulo: 'Usos', texto: memo?.usos },
    { titulo: 'Potencial', texto: memo?.potencial },
  ]

  return (
    <div>
      {memo ? (
        <>
          {typeof memo.resumen_ejecutivo === 'string' && (
            <Card titulo="Resumen ejecutivo">
              <p style={pStyle}>{memo.resumen_ejecutivo}</p>
              {confianza?.nivel && (
                <p style={{ fontSize: 10, color: FAINT, marginTop: 10, fontWeight: 300 }}>
                  Confianza: {confianza.nivel}{confianza.motivo ? ` — ${confianza.motivo}` : ''}
                </p>
              )}
            </Card>
          )}
        </>
      ) : (
        <Card titulo="Ficha del analista">
          <p style={pStyle}>Aún no hay análisis. Pulsa «Analizar» para lanzar el pipeline completo.</p>
        </Card>
      )}

      <Card titulo="Datos del activo">
        {datoRow('Referencias catastrales', asset.refcats && asset.refcats.length > 0 ? `${asset.refcat} + ${asset.refcats.length} parcela(s) más` : asset.refcat, 'oficial')}
        {datoRow('Norma zonal', asset.norma_zonal ? `${asset.norma_zonal}${asset.norma_zonal_denominacion ? ` — ${asset.norma_zonal_denominacion}` : ''}` : null, 'inferido')}
        {datoRow('Superficie de parcela', fmtNum(asset.parcel_area) ? `${fmtNum(asset.parcel_area)} m²` : null, 'oficial')}
        {datoRow('Superficie construida', fmtNum(asset.built_area) ? `${fmtNum(asset.built_area)} m²` : null, 'inferido')}
        {datoRow('Uso catastral', asset.cadastral_use, 'oficial')}
        {datoRow('Año construcción', asset.year_built, 'oficial')}
        {datoRow('Inmuebles / viviendas', asset.num_inmuebles != null ? `${asset.num_inmuebles}${asset.num_viviendas != null ? ` / ${asset.num_viviendas}` : ''}` : null, 'oficial')}
        {datoRow('Operación', asset.tipo_operacion)}
        {datoRow('Uso actual → objetivo', asset.uso_actual || asset.uso_objetivo ? `${asset.uso_actual || '—'} → ${asset.uso_objetivo || '—'}` : null)}
        {datoRow('Precio compra', fmtNum(asset.precio_compra) ? `${fmtNum(asset.precio_compra)} €` : null)}
        {datoRow('CAPEX estimado', fmtNum(asset.capex_estimado) ? `${fmtNum(asset.capex_estimado)} €` : null)}
        {datoRow('Superficie comercial (dossier)', fmtNum(asset.superficie_comercial) ? `${fmtNum(asset.superficie_comercial)} m²` : null, 'hipotesis')}
      </Card>

      {secciones.filter((s) => typeof s.texto === 'string' && s.texto).map((s) => (
        <Card key={s.titulo} titulo={s.titulo}>
          <p style={pStyle}>{s.texto as string}</p>
        </Card>
      ))}

      {Array.isArray(memo?.riesgos_clave) && (memo!.riesgos_clave as string[]).length > 0 && (
        <Card titulo="Riesgos clave">
          {(memo!.riesgos_clave as string[]).map((r, i) => (
            <p key={i} style={{ ...pStyle, marginBottom: 5 }}>—  {r}</p>
          ))}
        </Card>
      )}
      {Array.isArray(memo?.proximos_pasos) && (memo!.proximos_pasos as string[]).length > 0 && (
        <Card titulo="Próximos pasos">
          {(memo!.proximos_pasos as string[]).map((p, i) => (
            <p key={i} style={{ ...pStyle, marginBottom: 5 }}>{i + 1}.  {p}</p>
          ))}
        </Card>
      )}

      {data.hits.length > 0 && (
        <Card titulo={`Afecciones en capas oficiales (${data.hits.length})`}>
          <button onClick={() => setShowCapas(!showCapas)} style={{ ...btnGhost, padding: '6px 12px', fontSize: 9.5, marginBottom: showCapas ? 12 : 0 }}>
            {showCapas ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
          {showCapas && data.hits.map((h) => (
            <div key={h.id} style={{ padding: '8px 0', borderBottom: `1px solid ${EDGE}` }}>
              <p style={{ fontSize: 11, color: TXT, marginBottom: 2 }}>
                {h.layer_name} <span style={{ color: FAINT, fontWeight: 300 }}>· {h.service}</span>
              </p>
              <p style={{ fontSize: 10, color: SUB, fontWeight: 300, wordBreak: 'break-word' }}>
                {Object.entries(h.attributes).slice(0, 6).map(([k, v]) => `${k}: ${String(v)}`).join('  ·  ') || 'sin atributos'}
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ── Tab: Edificabilidad ──────────────────────────────────────────────────────

function EdificabilidadTab({ edificabilidad, volumen }: { edificabilidad?: EdificabilidadResult; volumen?: VolumenCapazResult }) {
  if (!edificabilidad) {
    return <Card titulo="Edificabilidad"><p style={pStyle}>Lanza el análisis para calcular la edificabilidad.</p></Card>
  }
  const fmtM = (n: number | null | undefined) => (n == null ? 's/d' : new Intl.NumberFormat('es-ES').format(n))
  const e = edificabilidad
  const tituloMetodo =
    e.metodo === 'volumetrico' ? 'Método volumétrico (huella × plantas)' :
    e.metodo === 'coeficiente' ? 'Método por coeficiente' :
    'Cálculo pendiente — faltan datos'
  return (
    <div>
      <Card titulo={tituloMetodo}>
        {e.etiquetas.map((et, i) => (
          <div key={i} style={{ display: 'flex', padding: '8px 0', borderBottom: `1px solid ${EDGE}`, gap: 8 }}>
            <span style={{ width: '42%', fontSize: 11.5, color: SUB, fontWeight: 300 }}>{et.campo}</span>
            <span style={{ flex: 1, fontSize: 12, color: TXT }}>{et.valor}</span>
            <span style={{ fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', color: TAG_COLOR[et.tipo] || FAINT, alignSelf: 'center' }}>{et.tipo}</span>
          </div>
        ))}
        {e.coef_utilizado != null && (
          <p style={{ fontSize: 10, color: FAINT, marginTop: 10, fontWeight: 300 }}>
            Coeficiente: {e.coef_utilizado} m²c/m²s {e.coef_verificado ? '(verificado)' : '(NO verificado — hipótesis)'}
          </p>
        )}
        {e.metodo === 'volumetrico' && (
          <p style={{ fontSize: 10, color: FAINT, marginTop: 10, fontWeight: 300, lineHeight: 1.5 }}>
            En esta norma zonal la edificabilidad no se determina por coeficiente: horquilla por envolvente [HIPÓTESIS], no un derecho.
          </p>
        )}
      </Card>

      {Array.isArray(e.inputs_faltantes) && e.inputs_faltantes.length > 0 && (
        <Card titulo="Datos que faltan para afinar el cálculo">
          {e.inputs_faltantes.map((f, i) => (
            <p key={i} style={{ ...pStyle, marginBottom: 5 }}>—  {f}</p>
          ))}
        </Card>
      )}

      {volumen && volumen.bandas.length > 0 && (
        <Card titulo="Volumen capaz por bandas — visible en el gemelo 3D">
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              ['Capaz total', volumen.capaz_total_m2c, TXT],
              ['Existente', volumen.existente_total_m2c, TXT],
              ['Remanente', volumen.remanente_materializable_m2c, (volumen.remanente_materializable_m2c ?? 0) > 0 ? OK : SUB],
            ].map(([label, v, c]) => (
              <div key={String(label)}>
                <p style={{ fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: FAINT, marginBottom: 2 }}>{String(label)}</p>
                <p style={{ fontSize: 17, fontWeight: 200, color: c as string }}>{fmtM(v as number | null)} <span style={{ fontSize: 9.5, color: FAINT }}>m²c</span></p>
              </div>
            ))}
          </div>
          {volumen.bandas.map((b, i) => (
            <div key={i} style={{ display: 'flex', padding: '7px 0', borderBottom: `1px solid ${EDGE}`, gap: 8, fontSize: 11 }}>
              <span style={{ width: '30%', color: SUB, fontWeight: 300 }}>COEF_Z «{b.coef_z || 's/d'}»</span>
              <span style={{ flex: 1, color: TXT }}>
                {fmtM(b.area_banda_m2)} m² × {b.plantas ?? '?'} pl → {fmtM(b.capaz_m2c)} m²c
                <span style={{ color: FAINT, fontWeight: 300 }}> · exist. {fmtM(b.existente_m2c)} · reman. {fmtM(b.remanente_m2c)}</span>
              </span>
            </div>
          ))}
          {volumen.cobertura_bandas_pct != null && (
            <p style={{ fontSize: 10, color: FAINT, marginTop: 8, fontWeight: 300 }}>
              Cobertura de bandas sobre parcela: {volumen.cobertura_bandas_pct}%
            </p>
          )}
          {volumen.advertencias.map((a, i) => (
            <p key={i} style={{ fontSize: 10, color: WARN, marginTop: 6, fontWeight: 300, lineHeight: 1.5, opacity: 0.85 }}>⚠  {a}</p>
          ))}
        </Card>
      )}

      {(e.advertencias.length > 0) && (
        <Card titulo="Advertencias">
          {e.advertencias.map((a, i) => (
            <p key={i} style={{ ...pStyle, marginBottom: 8, color: WARN, opacity: 0.9 }}>⚠  {a}</p>
          ))}
        </Card>
      )}
      {e.recomendaciones.length > 0 && (
        <Card titulo="Cómo verificarlo">
          {e.recomendaciones.map((r, i) => (
            <p key={i} style={{ ...pStyle, marginBottom: 6 }}>—  {r}</p>
          ))}
        </Card>
      )}
    </div>
  )
}

// ── Tab: Riesgos ─────────────────────────────────────────────────────────────

function RiesgosTab({ data }: { data: UrbanAssetFull }) {
  if (data.redFlags.length === 0) {
    return <Card titulo="Red flags"><p style={pStyle}>Sin red flags detectadas{data.asset.status !== 'completado' ? ' (análisis pendiente)' : ''}.</p></Card>
  }
  const orden: Severidad[] = ['critica', 'alta', 'media', 'baja']
  const sorted = [...data.redFlags].sort((a, b) => orden.indexOf(a.severidad) - orden.indexOf(b.severidad))
  return (
    <div>
      {sorted.map((f) => {
        const sev = SEV[f.severidad]
        return (
          <div key={f.id} style={{
            background: PANEL, border: `1px solid ${EDGE}`, borderLeft: `3px solid ${sev.color}`,
            borderRadius: 8, padding: '13px 16px', marginBottom: 9,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
              <p style={{ fontSize: 12.5, fontWeight: 500, color: TXT }}>{f.titulo}</p>
              <span style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: sev.color, whiteSpace: 'nowrap' }}>{sev.label}</span>
            </div>
            {f.descripcion && <p style={{ ...pStyle, marginBottom: 6 }}>{f.descripcion}</p>}
            {f.recomendacion && <p style={{ fontSize: 11, color: SUB, fontWeight: 300 }}>→ {f.recomendacion}</p>}
            {f.fuente && <p style={{ fontSize: 9, color: FAINT, marginTop: 6, fontWeight: 300 }}>Fuente: {f.fuente}</p>}
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Checklist ───────────────────────────────────────────────────────────

const ESTADO_META: Record<ChecklistEstado, { icon: string; color: string; label: string }> = {
  ok:        { icon: '●', color: OK,    label: 'OK' },
  atencion:  { icon: '●', color: WARN,  label: 'Atención' },
  pendiente: { icon: '○', color: FAINT, label: 'Pendiente' },
  manual:    { icon: '◐', color: BRAND, label: 'Manual' },
}

function ChecklistTab({ data }: { data: UrbanAssetFull }) {
  const items: ChecklistItem[] = computeChecklist(data)
  const [matices, setMatices] = useState('')
  const [isGenerando, setIsGenerando] = useState(false)
  const [errorBorrador, setErrorBorrador] = useState('')

  const generarBorrador = async () => {
    setErrorBorrador('')
    setIsGenerando(true)
    try {
      const res = await fetch(`/api/urban-analyst/${data.asset.id}/consulta-borrador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matices: matices || undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error generando el borrador')
      }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (e) {
      setErrorBorrador(e instanceof Error ? e.message : 'Error')
    } finally {
      setIsGenerando(false)
    }
  }

  return (
    <div>
      <Card titulo="Due diligence urbanística">
        {items.map((item) => {
          const meta = ESTADO_META[item.estado]
          return (
            <div key={item.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: `1px solid ${EDGE}`, alignItems: 'flex-start' }}>
              <span style={{ color: meta.color, fontSize: 11, width: 14, paddingTop: 1 }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: TXT }}>{item.titulo}</p>
                  <span style={{ fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: meta.color, whiteSpace: 'nowrap' }}>{meta.label}</span>
                </div>
                <p style={{ fontSize: 11, color: SUB, fontWeight: 300, lineHeight: 1.5, marginTop: 3 }}>{item.detalle}</p>
                {item.enlace && (
                  <a href={item.enlace.url} target="_blank" rel="noreferrer" style={{ fontSize: 9.5, color: BRAND, textDecoration: 'none', letterSpacing: '0.04em' }}>
                    {item.enlace.label} ↗
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </Card>

      <Card titulo="Borrador de consulta urbanística especial">
        <p style={{ ...pStyle, marginBottom: 10 }}>
          Borrador formal (Ordenanza 6/2022) con antecedentes trazados a fuentes oficiales y las cuestiones que
          desbloquean la oferta. Para revisión del técnico antes de presentar por sede.
        </p>
        <textarea
          value={matices}
          onChange={(e) => setMatices(e.target.value)}
          placeholder="Matices opcionales: cuestiones concretas que quieres incluir…"
          rows={2}
          style={inputStyle}
        />
        <div style={{ marginTop: 10 }}>
          <button
            onClick={generarBorrador}
            disabled={isGenerando || data.asset.status !== 'completado'}
            style={{ ...btnPrimary, opacity: isGenerando || data.asset.status !== 'completado' ? 0.5 : 1 }}
          >
            {isGenerando ? 'Redactando…' : 'Generar borrador PDF'}
          </button>
        </div>
        {errorBorrador && <p style={{ fontSize: 11.5, color: BAD, marginTop: 8 }}>{errorBorrador}</p>}
      </Card>
    </div>
  )
}

// ── Tab: Escenarios ──────────────────────────────────────────────────────────

function EscenariosTab({ data, onChanged }: { data: UrbanAssetFull; onChanged: () => Promise<void> }) {
  const [tipo, setTipo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!tipo) return
    setError('')
    setIsGenerating(true)
    try {
      const label = TIPOS_ESCENARIO.find((t) => t.value === tipo)?.label || tipo
      const { id } = await createUrbanScenario({
        asset_id: data.asset.id, nombre: label, tipo, descripcion: descripcion || undefined,
      })
      const res = await fetch(`/api/urban-analyst/${data.asset.id}/escenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Error generando el escenario')
      }
      setTipo(''); setDescripcion('')
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setIsGenerating(false)
    }
  }

  const nivel = (v: unknown): { label: string; color: string } => {
    const s = String(v || '')
    if (['alta', 'bajo'].includes(s)) return { label: s, color: OK }
    if (['media', 'medio'].includes(s)) return { label: s, color: WARN }
    if (['baja', 'alto'].includes(s)) return { label: s, color: BAD }
    return { label: s || '—', color: FAINT }
  }

  return (
    <div>
      <Card titulo="Nuevo escenario de inversión">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            style={{ ...inputStyle, flex: '1 1 200px', color: tipo ? TXT : FAINT }}
          >
            <option value="">Tipo de escenario…</option>
            {TIPOS_ESCENARIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Matices: nº unidades, presupuesto…"
            style={{ ...inputStyle, flex: '2 1 220px' }}
          />
          <button onClick={handleCreate} disabled={!tipo || isGenerating || data.asset.status !== 'completado'} style={{ ...btnPrimary, opacity: !tipo || isGenerating || data.asset.status !== 'completado' ? 0.5 : 1 }}>
            {isGenerating ? 'Generando…' : 'Generar'}
          </button>
        </div>
        {data.asset.status !== 'completado' && (
          <p style={{ fontSize: 10, color: FAINT, marginTop: 8, fontWeight: 300 }}>Completa primero el análisis del activo.</p>
        )}
        {error && <p style={{ fontSize: 11.5, color: BAD, marginTop: 8 }}>{error}</p>}
      </Card>

      {data.scenarios.map((sc) => {
        const r = sc.resultado as Record<string, unknown> | null
        return (
          <div key={sc.id} style={{ background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 8, padding: '15px 18px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: TXT, marginBottom: 8 }}>{sc.nombre}</p>
              <button
                onClick={async () => { await deleteUrbanScenario(sc.id, data.asset.id); await onChanged() }}
                style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', fontSize: 14 }}
                title="Eliminar escenario"
              >×</button>
            </div>
            {sc.status === 'generando' && <p style={pStyle}>Generando análisis…</p>}
            {sc.status === 'error' && <p style={{ ...pStyle, color: BAD }}>Error al generar. Elimina y reinténtalo.</p>}
            {r && (
              <>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  {[
                    ['Viabilidad urb.', r.viabilidad_urbanistica],
                    ['R. patrimonial', r.riesgo_patrimonial],
                    ['R. administrativo', r.riesgo_administrativo],
                  ].map(([label, v]) => {
                    const n = nivel(v)
                    return (
                      <div key={String(label)}>
                        <p style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT, marginBottom: 2 }}>{String(label)}</p>
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: n.color, textTransform: 'capitalize' }}>{n.label}</p>
                      </div>
                    )
                  })}
                  {r.superficie_potencial_m2 != null && (
                    <div>
                      <p style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT, marginBottom: 2 }}>Sup. potencial</p>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: TXT }}>{String(r.superficie_potencial_m2)} m²</p>
                    </div>
                  )}
                </div>
                {typeof r.analisis === 'string' && <p style={{ ...pStyle, marginBottom: 8 }}>{r.analisis}</p>}
                {typeof r.procedimiento_probable === 'string' && (
                  <p style={{ fontSize: 11, color: SUB, fontWeight: 300, marginBottom: 6 }}>
                    <strong style={{ fontWeight: 600, color: TXT }}>Procedimiento:</strong> {r.procedimiento_probable}
                  </p>
                )}
                {Array.isArray(r.proximos_pasos) && (r.proximos_pasos as string[]).length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {(r.proximos_pasos as string[]).map((p, i) => (
                      <p key={i} style={{ fontSize: 11, color: SUB, fontWeight: 300, marginBottom: 3 }}>{i + 1}. {p}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Chat ────────────────────────────────────────────────────────────────

function ChatTab({ assetId, initialMessages, disabled }: { assetId: string; initialMessages: UrbanChatMessage[]; disabled: boolean }) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  const send = async () => {
    const text = input.trim()
    if (!text || isSending) return
    setInput('')
    setIsSending(true)
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, asset_id: assetId, role: 'user', content: text, created_at: new Date().toISOString() }])
    try {
      const res = await fetch(`/api/urban-analyst/${assetId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const j = await res.json()
      const reply = res.ok ? j.texto : `⚠ ${j.error || 'Error en el chat'}`
      setMessages((m) => [...m, { id: `tmp-a-${Date.now()}`, asset_id: assetId, role: 'assistant', content: reply, created_at: new Date().toISOString() }])
    } catch {
      setMessages((m) => [...m, { id: `tmp-e-${Date.now()}`, asset_id: assetId, role: 'assistant', content: '⚠ Error de red', created_at: new Date().toISOString() }])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div style={{ background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 8, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 380px)', minHeight: 380 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: `1px solid ${EDGE}` }}>
        <p style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT }}>
          Analista del activo
        </p>
        {messages.length > 0 && (
          <button
            onClick={async () => { if (confirm('¿Vaciar el historial del chat?')) { await clearUrbanChat(assetId); setMessages([]) } }}
            style={{ background: 'none', border: 'none', fontSize: 9, color: FAINT, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            Vaciar
          </button>
        )}
      </div>
      <div className="ua-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 11.5, color: FAINT, fontWeight: 300, lineHeight: 1.6 }}>
            Pregunta lo que quieras sobre este activo: «¿puedo convertir el local en vivienda?», «¿qué riesgo tiene el
            remonte?», «¿qué documentación pido antes de ofertar?». Responde solo con los datos recopilados y te dirá
            qué falta por verificar.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{
              maxWidth: '88%', padding: '9px 13px', borderRadius: 10, fontSize: 12, lineHeight: 1.55,
              background: m.role === 'user' ? BRAND : PANEL2,
              color: m.role === 'user' ? '#fff' : TXT,
              border: m.role === 'user' ? 'none' : `1px solid ${EDGE}`,
              whiteSpace: 'pre-wrap', fontWeight: 300,
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {isSending && <p style={{ fontSize: 10.5, color: FAINT, fontWeight: 300, animation: 'uaPulse 1.2s ease infinite' }}>El analista está escribiendo…</p>}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '11px 13px', borderTop: `1px solid ${EDGE}` }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={disabled ? 'Completa el análisis para chatear' : 'Pregunta al analista…'}
          disabled={disabled || isSending}
          rows={1}
          style={{ ...inputStyle, flex: 1, resize: 'none' }}
        />
        <button onClick={send} disabled={disabled || isSending || !input.trim()} style={{ ...btnPrimary, opacity: disabled || isSending || !input.trim() ? 0.5 : 1 }}>
          Enviar
        </button>
      </div>
    </div>
  )
}

// ── Tab: Documentos ──────────────────────────────────────────────────────────

const TIPOS_DOC = [
  { value: 'nota_simple', label: 'Nota simple' },
  { value: 'ficha_catastral', label: 'Ficha catastral' },
  { value: 'dossier', label: 'Dossier comercial' },
  { value: 'plano', label: 'Plano' },
  { value: 'tasacion', label: 'Tasación' },
  { value: 'otro', label: 'Otro' },
]

function DocumentosTab({ data, onChanged }: { data: UrbanAssetFull; onChanged: () => Promise<void> }) {
  const [isUploading, setIsUploading] = useState(false)
  const [tipoDoc, setTipoDoc] = useState('otro')
  const [error, setError] = useState('')
  const [isLeyendo, setIsLeyendo] = useState(false)
  const [errorLectura, setErrorLectura] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const oficiales = resolveDocumentosOficiales(data.hits)
  const lectura = data.analysis.find((a) => a.kind === 'documentos_oficiales')?.content as {
    documentos?: { nombre: string; legible?: boolean; hallazgos?: string[]; advertencias?: string[]; contradicciones_con_datos_previos?: string[] }[]
    sintesis?: string
    impacto_en_analisis?: string[]
    leido_en?: string
  } | undefined

  const leerDocumentos = async () => {
    setErrorLectura('')
    setIsLeyendo(true)
    try {
      const res = await fetch(`/api/urban-analyst/${data.asset.id}/leer-documentos`, { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error en la lectura')
      }
      await onChanged()
    } catch (e) {
      setErrorLectura(e instanceof Error ? e.message : 'Error')
    } finally {
      setIsLeyendo(false)
    }
  }

  const handleUpload = async (file: File) => {
    setError('')
    setIsUploading(true)
    try {
      const supabase = createClient()
      const path = `${data.asset.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('urban-analyst').upload(path, file)
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from('urban-analyst').getPublicUrl(path)
      await createUrbanDocument({
        asset_id: data.asset.id,
        nombre: file.name,
        tipo: tipoDoc,
        file_url: pub.publicUrl,
      })
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error subiendo el documento')
    } finally {
      setIsUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <Card titulo={`Documentos oficiales detectados (${oficiales.length})`}>
        {oficiales.length === 0 ? (
          <p style={pStyle}>Ninguno detectado en las capas (se detectan tras el análisis: plano CE, ficha de catálogo…).</p>
        ) : (
          oficiales.map((d, i) => (
            <div key={i} style={{ padding: '7px 0', borderBottom: `1px solid ${EDGE}` }}>
              <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: TXT, textDecoration: 'none', fontWeight: 500 }}>
                {d.nombre} <span style={{ color: BRAND }}>↗</span>
              </a>
              <p style={{ fontSize: 9.5, color: FAINT, fontWeight: 300, marginTop: 2 }}>{d.fuente}</p>
            </div>
          ))
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button
            onClick={leerDocumentos}
            disabled={isLeyendo || (oficiales.length === 0 && data.documents.filter((d) => /\.pdf/i.test(d.file_url)).length === 0)}
            style={{ ...btnPrimary, opacity: isLeyendo ? 0.5 : 1 }}
          >
            {isLeyendo ? 'Leyendo con IA…' : lectura ? 'Releer documentos (IA)' : 'Leer documentos con IA'}
          </button>
          <span style={{ fontSize: 9.5, color: FAINT, fontWeight: 300 }}>
            Plano CE, ficha de catálogo y tus PDFs (máx. 3 por lectura), con visión.
          </span>
        </div>
        {errorLectura && <p style={{ fontSize: 11.5, color: BAD, marginTop: 8 }}>{errorLectura}</p>}
      </Card>

      {lectura && (
        <Card titulo={`Lectura IA de documentos${lectura.leido_en ? ` · ${new Date(lectura.leido_en).toLocaleDateString('es-ES')}` : ''}`}>
          {lectura.sintesis && <p style={{ ...pStyle, marginBottom: 10 }}>{lectura.sintesis}</p>}
          {(lectura.documentos || []).map((d, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${EDGE}` }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: TXT, marginBottom: 4 }}>
                {d.nombre} {d.legible === false && <span style={{ color: WARN, fontSize: 9.5 }}>(ilegible/parcial)</span>}
              </p>
              {(d.hallazgos || []).map((h, j) => (
                <p key={j} style={{ ...pStyle, marginBottom: 3 }}>—  {h}</p>
              ))}
              {(d.contradicciones_con_datos_previos || []).map((c, j) => (
                <p key={j} style={{ fontSize: 11, color: BAD, fontWeight: 300, marginBottom: 3 }}>⚠ Contradicción: {c}</p>
              ))}
              {(d.advertencias || []).map((a, j) => (
                <p key={j} style={{ fontSize: 10, color: WARN, fontWeight: 300, marginBottom: 2, opacity: 0.85 }}>⚠ {a}</p>
              ))}
            </div>
          ))}
          {Array.isArray(lectura.impacto_en_analisis) && lectura.impacto_en_analisis.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: FAINT, marginBottom: 4 }}>Impacto en el análisis</p>
              {lectura.impacto_en_analisis.map((x, i) => (
                <p key={i} style={{ ...pStyle, marginBottom: 3 }}>→  {x}</p>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card titulo="Subir documento">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={tipoDoc}
            onChange={(e) => setTipoDoc(e.target.value)}
            style={{ ...inputStyle, width: 'auto' }}
          >
            {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            disabled={isUploading}
            style={{ fontSize: 11, color: SUB }}
          />
          {isUploading && <span style={{ fontSize: 10.5, color: FAINT }}>Subiendo…</span>}
        </div>
        {error && <p style={{ fontSize: 11.5, color: BAD, marginTop: 8 }}>{error}</p>}
        <p style={{ fontSize: 9.5, color: FAINT, marginTop: 10, fontWeight: 300 }}>
          Nota simple, ficha catastral, dossier, planos, tasación… Los PDFs subidos entran en la lectura IA.
        </p>
      </Card>

      {data.documents.map((d) => (
        <div key={d.id} style={{ background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 8, padding: '11px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <a href={d.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: TXT, textDecoration: 'none', fontWeight: 500 }}>
              {d.nombre}
            </a>
            <p style={{ fontSize: 9.5, color: FAINT, fontWeight: 300, marginTop: 2 }}>
              {TIPOS_DOC.find((t) => t.value === d.tipo)?.label || d.tipo} · {new Date(d.created_at).toLocaleDateString('es-ES')}
            </p>
          </div>
          <button
            onClick={async () => { if (confirm('¿Eliminar documento?')) { await deleteUrbanDocument(d.id, data.asset.id); await onChanged() } }}
            style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', fontSize: 15 }}
          >×</button>
        </div>
      ))}
    </div>
  )
}

// ── Bloques compartidos ──────────────────────────────────────────────────────

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 8, padding: '15px 18px', marginBottom: 12 }}>
      <p style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT, marginBottom: 10 }}>
        {titulo}
      </p>
      {children}
    </div>
  )
}

const pStyle: React.CSSProperties = { fontSize: 12, color: BODY, lineHeight: 1.6, fontWeight: 300, whiteSpace: 'pre-wrap' }
const btnPrimary: React.CSSProperties = {
  padding: '9px 18px', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  background: BRAND, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600,
}
const btnGhost: React.CSSProperties = {
  padding: '9px 16px', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  background: 'transparent', color: TXT, border: `1px solid ${EDGE}`, borderRadius: 5, cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 12.5, background: PANEL2, color: TXT,
  border: `1px solid ${EDGE}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit',
}
