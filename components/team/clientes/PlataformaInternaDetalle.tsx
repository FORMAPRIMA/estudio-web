'use client'

import React, { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  upsertPortal, addRender, deleteRender,
  addVisita, updateVisita, deleteVisita,
  addPartida, updatePartida, deletePartida,
  upsertContratos,
  addPagoConstructora, updatePagoConstructora, deletePagoConstructora,
} from '@/app/actions/clientes'
import RegistrarVisitaModal from '@/components/team/clientes/RegistrarVisitaModal'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProyectoInfo {
  id: string; nombre: string; codigo: string | null
  imagen_url: string | null; status: string; cliente: string | null
  direccion: string | null
  constructor: { id: string; nombre: string } | null
}

interface PortalData {
  floorfy_url: string | null; pdf_proyecto_url: string | null; portal_cliente_ids?: string[] | null
}

interface TitularInfo {
  cliente_id: string; rol: string; nombre: string; empresa: string | null
}

interface Render {
  id: string; url: string; nombre: string | null; orden: number
}

interface Visita {
  id: string; fecha: string; titulo: string | null; asistentes: string | null
  notas: string | null; acta_url: string | null; acta_constructor_url: string | null; floorfy_url: string | null; visible_cliente: boolean
}

interface Partida {
  id: string; nombre: string; fecha_inicio: string | null; fecha_fin: string | null
  color: string; orden: number; completado: boolean
}

interface Contratos {
  contrato_arquitectura_url: string | null
  contrato_obra_url: string | null
  pdf_presupuesto_url?: string | null
  notas: string | null
}

interface Factura {
  id: string; seccion: string; concepto: string; monto: number
  status: string; fecha_pago_acordada: string | null; numero_factura: string | null
}

interface PagoConstructora {
  id: string; concepto: string; importe_estimado: number | null
  fecha_estimada: string; orden: number; notas: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  activo:    { label: 'Activo',    color: '#D85A30' },
  on_hold:   { label: 'On Hold',   color: '#378ADD' },
  terminado: { label: 'Terminado', color: '#1D9E75' },
  archivado: { label: 'Archivado', color: '#999' },
}

const FACTURA_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  acordada_contrato: { label: 'Acordada',  color: '#888',    bg: '#F4F4F4' },
  cobrable:          { label: 'Cobrable',  color: '#C9A227', bg: '#FDF8EE' },
  enviada:           { label: 'Enviada',   color: '#378ADD', bg: '#EEF4FD' },
  pagada:            { label: 'Pagada',    color: '#1D9E75', bg: '#EEF8F4' },
  impagada:          { label: 'Impagada',  color: '#E53E3E', bg: '#FEF2F2' },
}

const PARTIDA_COLORS = [
  '#D85A30', '#378ADD', '#1D9E75', '#C9A227', '#9B59B6', '#E67E22', '#1ABC9C', '#E91E63',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function fmtMoney(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const S = {
  label: { fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#AAA', display: 'block' as const, marginBottom: 4 },
  input: { width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', boxSizing: 'border-box' as const },
  textarea: { width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', resize: 'vertical' as const, boxSizing: 'border-box' as const },
  btnPrimary: { padding: '8px 18px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  btnGhost: { padding: '7px 14px', background: 'none', color: '#888', border: '1px solid #E8E6E0', borderRadius: 5, cursor: 'pointer', fontSize: 11 },
  sectionTitle: { fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#1A1A1A', margin: '0 0 16px' },
  card: { background: '#fff', borderRadius: 10, border: '1px solid #E8E6E0', padding: '20px 24px' },
}

// ── File upload helper ─────────────────────────────────────────────────────────

async function uploadToStorage(
  file: File,
  path: string
): Promise<{ url: string } | { error: string }> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('portal')
    .upload(path, file, { upsert: true })
  if (error) return { error: error.message }
  const { data: { publicUrl } } = supabase.storage.from('portal').getPublicUrl(data.path)
  return { url: publicUrl }
}

function UploadButton({
  accept, label, onUploaded, path, multiple = false,
}: {
  accept: string; label: string; path: string; multiple?: boolean
  onUploaded: (url: string, name: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    setUploadError(null)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (files.length > 1) setProgress(`${i + 1} / ${files.length}`)
      const filePath = `${path}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const res = await uploadToStorage(file, filePath)
      if ('url' in res) {
        onUploaded(res.url, file.name)
      } else {
        setUploadError(`${file.name}: ${res.error}`)
        break
      }
    }

    setUploading(false)
    setProgress(null)
    if (e.target) e.target.value = ''
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <input ref={ref} type="file" accept={accept} multiple={multiple} style={{ display: 'none' }} onChange={handleChange} />
      <button
        style={{ ...S.btnGhost, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        onClick={() => { setUploadError(null); ref.current?.click() }}
        disabled={uploading}
      >
        {uploading ? `⏳ Subiendo${progress ? ` ${progress}` : '…'}` : label}
      </button>
      {uploadError && (
        <span style={{ fontSize: 10, color: '#E53E3E', maxWidth: 220 }}>{uploadError}</span>
      )}
    </div>
  )
}

// ── Copy portal link ──────────────────────────────────────────────────────────

function CopyPortalLink({ proyectoId }: { proyectoId: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    const url = `${window.location.origin}/portal/${proyectoId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={copy}
      style={{ padding: '8px 14px', background: copied ? '#EEF8F4' : 'none', border: `1px solid ${copied ? '#1D9E75' : '#E8E6E0'}`, borderRadius: 6, cursor: 'pointer', fontSize: 10, color: copied ? '#1D9E75' : '#888', transition: 'all 0.2s' }}
    >
      {copied ? '✓ Enlace copiado' : '🔗 Copiar enlace cliente'}
    </button>
  )
}

// ── Tab nav ───────────────────────────────────────────────────────────────────

function TabNav({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="pid-tab-nav" style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E8E6E0', background: '#fff', padding: '0 40px' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: active === t.id ? '#D85A30' : '#888',
            borderBottom: active === t.id ? '2px solid #D85A30' : '2px solid transparent',
            marginBottom: -1,
            transition: 'all 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Portal client access ──────────────────────────────────────────────────────

function PortalClientAccess({ proyectoId, titulares, initialIds }: {
  proyectoId: string
  titulares: TitularInfo[]
  initialIds: string[]
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialIds))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    await upsertPortal(proyectoId, { portal_cliente_ids: Array.from(selected) })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={S.card}>
      <p style={S.sectionTitle}>Acceso al portal de cliente</p>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
        Selecciona qué clientes del proyecto pueden ver el portal. Solo las facturas asignadas a estos clientes serán visibles.
      </p>
      {titulares.length === 0 ? (
        <p style={{ fontSize: 12, color: '#BBB', fontStyle: 'italic' }}>Sin clientes asignados al proyecto.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {titulares.map(t => {
            const isOn = selected.has(t.cliente_id)
            return (
              <label key={t.cliente_id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(t.cliente_id)}
                  style={{ width: 14, height: 14, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: '#1A1A1A' }}>
                  {t.nombre}
                  {t.empresa && <span style={{ fontSize: 11, color: '#AAA', marginLeft: 6 }}>{t.empresa}</span>}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', marginLeft: 'auto' }}>
                  {t.rol}
                </span>
              </label>
            )
          })}
        </div>
      )}
      <button
        onClick={save}
        disabled={saving || titulares.length === 0}
        style={{ ...S.btnPrimary, opacity: saving || titulares.length === 0 ? 0.5 : 1, background: saved ? '#1D9E75' : '#1A1A1A' }}
      >
        {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar accesos'}
      </button>
    </div>
  )
}

// ── PORTAL TAB ────────────────────────────────────────────────────────────────

function FlooryfSection({ proyectoId, initialUrl }: { proyectoId: string; initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [savedUrl, setSavedUrl] = useState(initialUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [showEmbed, setShowEmbed] = useState(!!initialUrl)

  const save = async () => {
    setSaving(true)
    const res = await upsertPortal(proyectoId, { floorfy_url: url.trim() || null })
    setSaving(false)
    if ('success' in res) { setSavedUrl(url.trim()); setShowEmbed(!!url.trim()) }
  }

  return (
    <div style={S.card}>
      <p style={S.sectionTitle}>Tour virtual · Floorfy</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: savedUrl ? 16 : 0 }}>
        <input
          placeholder="https://my.floorfy.com/tour/..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          style={{ ...S.input, flex: 1 }}
        />
        <button onClick={save} disabled={saving || url === savedUrl} style={{ ...S.btnPrimary, opacity: saving || url === savedUrl ? 0.5 : 1, flexShrink: 0 }}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {savedUrl && (
          <button onClick={() => setShowEmbed(v => !v)} style={{ ...S.btnGhost, flexShrink: 0 }}>
            {showEmbed ? 'Ocultar' : 'Ver tour'}
          </button>
        )}
      </div>
      {savedUrl && showEmbed && (
        <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #E8E6E0' }}>
          <iframe src={savedUrl} style={{ width: '100%', height: 480, border: 'none', display: 'block' }} allowFullScreen />
        </div>
      )}
    </div>
  )
}

function PDFThumbnail({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
        const pdf = await pdfjsLib.getDocument(url).promise
        const page = await pdf.getPage(1)
        if (cancelled || !canvasRef.current) return
        const viewport = page.getViewport({ scale: 1 })
        const canvas = canvasRef.current
        const scale = canvas.parentElement
          ? canvas.parentElement.clientWidth / viewport.width
          : 1
        const scaledViewport = page.getViewport({ scale: Math.max(scale, 0.5) })
        canvas.width = scaledViewport.width
        canvas.height = scaledViewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (page.render as any)({ canvasContext: ctx, viewport: scaledViewport }).promise
      } catch {
        if (!cancelled) setError(true)
      }
    }
    render()
    return () => { cancelled = true }
  }, [url])

  if (error) return <div style={{ fontSize: 28 }}>📄</div>

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 4 }}
    />
  )
}

function PDFSection({ proyectoId, initialUrl }: { proyectoId: string; initialUrl: string | null }) {
  const [pdfUrl, setPdfUrl] = useState(initialUrl)
  const [saving, setSaving] = useState(false)

  const handleUploaded = async (url: string) => {
    setSaving(true)
    await upsertPortal(proyectoId, { pdf_proyecto_url: url })
    setSaving(false)
    setPdfUrl(url)
  }

  const handleRemove = async () => {
    if (!confirm('¿Eliminar el PDF del proyecto?')) return
    await upsertPortal(proyectoId, { pdf_proyecto_url: null })
    setPdfUrl(null)
  }

  return (
    <div style={S.card}>
      <p style={S.sectionTitle}>Proyecto Arquitectónico / Interiorismo</p>
      {pdfUrl ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 72, background: '#F8F7F4', borderRadius: 6, border: '1px solid #E8E6E0', flexShrink: 0, overflow: 'hidden' }}>
            <PDFThumbnail url={pdfUrl} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: '#D85A30', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Ver / Descargar PDF del proyecto →
            </a>
            <p style={{ fontSize: 10, color: '#AAA', margin: '2px 0 0' }}>PDF cargado</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <UploadButton accept=".pdf" label="Reemplazar" path={`${proyectoId}/pdf-proyecto`} onUploaded={handleUploaded} />
            <button onClick={handleRemove} style={{ ...S.btnGhost, color: '#E53E3E', borderColor: '#E53E3E' }}>Eliminar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', border: '2px dashed #E8E6E0', borderRadius: 8, gap: 10 }}>
          <div style={{ fontSize: 28 }}>📄</div>
          <p style={{ fontSize: 12, color: '#AAA', margin: 0 }}>Sin PDF de proyecto</p>
          {saving && <p style={{ fontSize: 11, color: '#AAA', margin: 0 }}>Subiendo…</p>}
          <UploadButton accept=".pdf" label="↑ Subir PDF" path={`${proyectoId}/pdf-proyecto`} onUploaded={handleUploaded} />
        </div>
      )}
    </div>
  )
}

function RendersSection({ proyectoId, initialRenders }: { proyectoId: string; initialRenders: Render[] }) {
  const [renders, setRenders] = useState(initialRenders)
  const [, startTransition] = useTransition()
  const [lightbox, setLightbox] = useState<{ url: string; nombre: string | null } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Pending upload state (file selected, waiting for title)
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null)
  const [titulo, setTitulo] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPending({ file, preview: URL.createObjectURL(file) })
    setTitulo('')
    setUploadError(null)
    if (e.target) e.target.value = ''
  }

  const handleCancel = () => {
    if (pending) URL.revokeObjectURL(pending.preview)
    setPending(null)
    setTitulo('')
    setUploadError(null)
  }

  const handleSubmit = async () => {
    if (!pending) return
    setUploading(true)
    setUploadError(null)
    const filePath = `${proyectoId}/renders/${Date.now()}-${pending.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const res = await uploadToStorage(pending.file, filePath)
    setUploading(false)
    if ('error' in res) { setUploadError(res.error); return }
    const nombre = titulo.trim() || null
    startTransition(async () => {
      const r = await addRender(proyectoId, res.url, nombre)
      if ('id' in r) setRenders(prev => [...prev, { id: r.id, url: res.url, nombre, orden: prev.length }])
    })
    URL.revokeObjectURL(pending.preview)
    setPending(null)
    setTitulo('')
  }

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este render?')) return
    setRenders(prev => prev.filter(r => r.id !== id))
    startTransition(async () => { await deleteRender(id, proyectoId) })
  }

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ ...S.sectionTitle, margin: 0 }}>Renders de proyecto</p>
        {!pending && (
          <>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelected} />
            <button style={S.btnGhost} onClick={() => fileRef.current?.click()}>+ Añadir render</button>
          </>
        )}
      </div>

      {/* Pending upload — title form */}
      {pending && (
        <div className="pid-render-pending" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '16px', background: '#F8F7F4', borderRadius: 8, border: '2px solid #D85A30', marginBottom: 16 }}>
          <img src={pending.preview} style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <label style={S.label}>Título del render (habitación, espacio, descripción…)</label>
            <input
              autoFocus
              placeholder="Ej: Salón principal, Cocina, Fachada norte…"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              style={{ ...S.input, marginBottom: 10 }}
            />
            {uploadError && <p style={{ fontSize: 10, color: '#E53E3E', margin: '0 0 8px' }}>{uploadError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSubmit} disabled={uploading} style={{ ...S.btnPrimary, opacity: uploading ? 0.5 : 1 }}>
                {uploading ? '⏳ Subiendo…' : '↑ Subir render'}
              </button>
              <button onClick={handleCancel} style={S.btnGhost}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {renders.length === 0 && !pending ? (
        <div style={{ textAlign: 'center', padding: '32px', border: '2px dashed #E8E6E0', borderRadius: 8, color: '#CCC', fontSize: 12 }}>
          Sin renders — añade imágenes con su descripción para mostrarlas al cliente
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {renders.map(r => (
            <div key={r.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #E8E6E0', aspectRatio: '16/10', background: '#F8F7F4', cursor: 'pointer' }}
              onClick={() => setLightbox({ url: r.url, nombre: r.nombre })}>
              <img src={r.url} alt={r.nombre ?? 'Render'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={e => { e.stopPropagation(); handleDelete(r.id) }}
                style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
              {r.nombre && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 8px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.65))', fontSize: 10, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.nombre}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightbox.url} style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }} />
          {lightbox.nombre && <p style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{lightbox.nombre}</p>}
        </div>
      )}
    </div>
  )
}

function VisitasSection({
  proyectoId, initialVisitas,
  proyectoNombre, proyectoCodigo, proyectoDireccion, proyectoConstructor,
}: {
  proyectoId: string
  initialVisitas: Visita[]
  proyectoNombre: string
  proyectoCodigo: string | null
  proyectoDireccion: string | null
  proyectoConstructor: { id: string; nombre: string } | null
}) {
  const [visitas, setVisitas] = useState(initialVisitas)
  const [showForm, setShowForm] = useState(false)
  const [showActaModal, setShowActaModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // New visita form state
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [titulo, setTitulo] = useState('')
  const [asistentes, setAsistentes] = useState('')
  const [notas, setNotas] = useState('')
  const [floorfy, setFloorfy] = useState('')
  const [visibleCliente, setVisibleCliente] = useState(false)

  const submit = () => {
    if (!fecha) return
    startTransition(async () => {
      const res = await addVisita({
        proyecto_id: proyectoId, fecha,
        titulo: titulo.trim() || null, asistentes: asistentes.trim() || null,
        notas: notas.trim() || null, floorfy_url: floorfy.trim() || null,
        visible_cliente: visibleCliente,
      })
      if ('id' in res) {
        setVisitas(prev => [{
          id: res.id, fecha, titulo: titulo.trim() || null,
          asistentes: asistentes.trim() || null, notas: notas.trim() || null,
          acta_url: null, acta_constructor_url: null, floorfy_url: floorfy.trim() || null, visible_cliente: visibleCliente,
        }, ...prev])
        setFecha(new Date().toISOString().split('T')[0]); setTitulo('')
        setAsistentes(''); setNotas(''); setFloorfy(''); setVisibleCliente(false); setShowForm(false)
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar esta visita?')) return
    setVisitas(prev => prev.filter(v => v.id !== id))
    startTransition(async () => { await deleteVisita(id, proyectoId) })
  }

  const handleActaUploaded = (visitaId: string, url: string) => {
    setVisitas(prev => prev.map(v => v.id === visitaId ? { ...v, acta_url: url } : v))
    startTransition(async () => { await updateVisita(visitaId, proyectoId, { acta_url: url }) })
  }

  const handleFloorfy = (visitaId: string, url: string) => {
    setVisitas(prev => prev.map(v => v.id === visitaId ? { ...v, floorfy_url: url || null } : v))
    startTransition(async () => { await updateVisita(visitaId, proyectoId, { floorfy_url: url || null }) })
  }

  const toggleVisible = (v: Visita) => {
    const next = !v.visible_cliente
    setVisitas(prev => prev.map(x => x.id === v.id ? { ...x, visible_cliente: next } : x))
    startTransition(async () => { await updateVisita(v.id, proyectoId, { visible_cliente: next }) })
  }

  const renderVisitaRow = (v: Visita) => (
    <React.Fragment key={v.id}>
      <tr
        style={{ cursor: v.notas ? 'pointer' : 'default' }}
        onClick={() => v.notas && setExpandedId(expandedId === v.id ? null : v.id)}
      >
        <td style={{ padding: '10px 12px 10px 0', fontSize: 12, color: '#1A1A1A', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>{fmtShort(v.fecha)}</td>
        <td style={{ padding: '10px 12px 10px 0', fontSize: 12, color: '#1A1A1A', borderBottom: '1px solid #F0EEE8' }}>
          {v.titulo ?? <span style={{ color: '#CCC' }}>—</span>}
          {v.notas && <span style={{ fontSize: 9, color: '#AAA', marginLeft: 6 }}>{expandedId === v.id ? '▲' : '▼'}</span>}
        </td>
        <td style={{ padding: '10px 12px 10px 0', fontSize: 11, color: '#888', borderBottom: '1px solid #F0EEE8' }}>{v.asistentes ?? '—'}</td>
        {/* Acta cliente */}
        <td style={{ padding: '10px 12px 10px 0', borderBottom: '1px solid #F0EEE8' }} onClick={e => e.stopPropagation()}>
          {v.acta_url ? (
            <a href={v.acta_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#1D9E75', textDecoration: 'none', fontWeight: 600 }}>📄 Cliente</a>
          ) : (
            <UploadButton accept=".pdf" label="↑ Subir" path={`${proyectoId}/visitas`} onUploaded={(url) => handleActaUploaded(v.id, url)} />
          )}
        </td>
        {/* Acta constructor */}
        <td style={{ padding: '10px 12px 10px 0', borderBottom: '1px solid #F0EEE8' }} onClick={e => e.stopPropagation()}>
          {v.acta_constructor_url ? (
            <a href={v.acta_constructor_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#C9A227', textDecoration: 'none', fontWeight: 600 }}>📄 Constructor</a>
          ) : (
            <span style={{ fontSize: 10, color: '#DDD' }}>—</span>
          )}
        </td>
        {/* Portal visibility toggle */}
        <td style={{ padding: '10px 12px 10px 0', borderBottom: '1px solid #F0EEE8' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => toggleVisible(v)} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 3, border: 'none', cursor: 'pointer', background: v.visible_cliente ? '#EEF8F4' : '#F4F4F4', color: v.visible_cliente ? '#1D9E75' : '#AAA' }}>
            {v.visible_cliente ? '● Portal' : '○ Interna'}
          </button>
        </td>
        <td style={{ padding: '10px 0', borderBottom: '1px solid #F0EEE8' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => handleDelete(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#CCC' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}>×</button>
        </td>
      </tr>
      {expandedId === v.id && v.notas && (
        <tr>
          <td colSpan={7} style={{ padding: '0 0 12px', borderBottom: '1px solid #F0EEE8' }}>
            <div style={{ background: '#F8F7F4', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{v.notas}</div>
          </td>
        </tr>
      )}
    </React.Fragment>
  )

  const thStyle: React.CSSProperties = { textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', padding: '0 12px 10px 0', borderBottom: '1px solid #E8E6E0', whiteSpace: 'nowrap' }

  return (
    <>
    {showActaModal && (
      <RegistrarVisitaModal
        proyecto={{ id: proyectoId, nombre: proyectoNombre, codigo: proyectoCodigo, direccion: proyectoDireccion }}
        constructor={proyectoConstructor}
        onClose={() => setShowActaModal(false)}
        onCreated={newVisita => setVisitas(prev => [newVisita, ...prev])}
      />
    )}

    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <p style={{ ...S.sectionTitle, margin: 0 }}>Visitas de obra</p>
          <p style={{ fontSize: 10, color: '#AAA', margin: '4px 0 0' }}>Historial completo · las marcadas como Portal son visibles para el cliente</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setShowActaModal(true); setShowForm(false) }}
            style={{ ...S.btnPrimary, background: '#D85A30' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#C24E28' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#D85A30' }}
          >
            Registrar nueva visita
          </button>
          <button onClick={() => setShowForm(v => !v)} style={S.btnGhost}>
            {showForm ? 'Cancelar' : '↑ Entrada manual'}
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#F8F7F4', borderRadius: 8, padding: '16px', marginBottom: 16, border: '1px solid #E8E6E0' }}>
          <div className="pid-visita-form-grid" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={S.label}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...S.input, width: 'auto' }} />
            </div>
            <div>
              <label style={S.label}>Título</label>
              <input placeholder="Ej: Visita de control de obra nº1" value={titulo} onChange={e => setTitulo(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Asistentes</label>
              <input placeholder="Ej: Jose, Antonio (constructor)…" value={asistentes} onChange={e => setAsistentes(e.target.value)} style={S.input} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Notas / observaciones</label>
            <textarea rows={3} placeholder="Descripción de lo observado en la visita…" value={notas} onChange={e => setNotas(e.target.value)} style={S.textarea} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>URL Tour Floorfy (recorrido virtual de esta visita)</label>
            <input placeholder="https://my.floorfy.com/tour/..." value={floorfy} onChange={e => setFloorfy(e.target.value)} style={S.input} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#666', cursor: 'pointer' }}>
              <input type="checkbox" checked={visibleCliente} onChange={e => setVisibleCliente(e.target.checked)} style={{ accentColor: '#1D9E75' }} />
              Visible para el cliente (Portal)
            </label>
            <button onClick={submit} style={S.btnPrimary}>Guardar visita</button>
          </div>
        </div>
      )}

      {visitas.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#CCC', fontSize: 12, border: '1px dashed #DDD', borderRadius: 8 }}>
          Sin visitas registradas
        </div>
      ) : visitas.length > 0 ? (
        <div className="fp-table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Fecha', 'Título', 'Asistentes', 'Acta cliente', 'Acta constructor', 'Visibilidad', ''].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{visitas.map(renderVisitaRow)}</tbody>
          </table>
        </div>
      ) : null}
    </div>
    </>
  )
}

// ── GANTT ─────────────────────────────────────────────────────────────────────

type GanttTooltipInfo = { fase: string; subfase: string | null; duracion: string; x: number; y: number }

function duracionSemanas(fi: string | null, ff: string | null): string {
  if (!fi || !ff) return '—'
  const days = (new Date(ff + 'T00:00:00').getTime() - new Date(fi + 'T00:00:00').getTime()) / 86_400_000
  const w = Math.round(days / 7)
  return w <= 0 ? '< 1 semana' : w === 1 ? '1 semana' : `${w} semanas`
}

function GanttTooltip({ info }: { info: GanttTooltipInfo | null }) {
  if (!info) return null
  return (
    <div style={{
      position: 'fixed', left: info.x, top: info.y - 10,
      transform: 'translateX(-50%) translateY(-100%)',
      background: '#1A1A1A', color: '#fff', borderRadius: 7,
      padding: '8px 11px', fontSize: 11, pointerEvents: 'none',
      zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: info.subfase ? 2 : 0 }}>{info.fase}</div>
      {info.subfase && <div style={{ color: '#BBBBBB', marginBottom: 4 }}>{info.subfase}</div>}
      <div style={{ color: '#D85A30', fontWeight: 600 }}>{info.duracion}</div>
    </div>
  )
}

// grupo = Gantt row label; subfase = DB row name (stored in cronograma_partidas.nombre)
// Grouping is detected at render time by splitting on ' — '
const FASES_PARAMETRICAS = [
  { grupo: 'Demoliciones',            subfase: 'Demoliciones — trabajos previos',            start:  0, end: 10, color: '#D85A30' },
  { grupo: 'Soleras y rellenos',      subfase: 'Soleras y rellenos',                         start:  8, end: 18, color: '#E67E22' },
  { grupo: 'Tabiquería de pladur',    subfase: 'Tabiquería de pladur — estructura inicial',  start: 15, end: 25, color: '#C9A227' },
  { grupo: 'Tabiquería de pladur',    subfase: 'Tabiquería de pladur — cierre final',        start: 38, end: 48, color: '#C9A227' },
  { grupo: 'Carpintería metálica',    subfase: 'Carpintería metálica — medición y pedido',   start: 10, end: 15, color: '#1D9E75' },
  { grupo: 'Carpintería metálica',    subfase: 'Carpintería metálica — instalación',         start: 35, end: 45, color: '#1D9E75' },
  { grupo: 'Fontanería',              subfase: 'Fontanería — preinstalación',                start: 18, end: 35, color: '#378ADD' },
  { grupo: 'Fontanería',              subfase: 'Fontanería — remates',                       start: 70, end: 85, color: '#378ADD' },
  { grupo: 'Electricidad',            subfase: 'Electricidad — preinstalación',              start: 18, end: 35, color: '#9B59B6' },
  { grupo: 'Electricidad',            subfase: 'Electricidad — cableado y mecanismos',       start: 55, end: 75, color: '#9B59B6' },
  { grupo: 'Electricidad',            subfase: 'Electricidad — remates finales',             start: 85, end: 95, color: '#9B59B6' },
  { grupo: 'Gas',                     subfase: 'Gas — instalación',                          start: 20, end: 30, color: '#E91E63' },
  { grupo: 'Calefacción',             subfase: 'Calefacción — instalación',                  start: 20, end: 35, color: '#1ABC9C' },
  { grupo: 'Aire acondicionado',      subfase: 'Aire acondicionado — instalación',           start: 20, end: 35, color: '#D85A30' },
  { grupo: 'Ventilación',             subfase: 'Ventilación — instalación',                  start: 20, end: 35, color: '#E67E22' },
  { grupo: 'Agua caliente sanitaria', subfase: 'Agua caliente sanitaria — instalación',      start: 22, end: 35, color: '#C9A227' },
  { grupo: 'Falsos techos',           subfase: 'Falsos techos',                              start: 45, end: 60, color: '#1D9E75' },
  { grupo: 'Pavimentos',              subfase: 'Pavimentos — fase base',                     start: 55, end: 75, color: '#378ADD' },
  { grupo: 'Pavimentos',              subfase: 'Pavimentos — remates',                       start: 80, end: 90, color: '#378ADD' },
  { grupo: 'Carpintería de madera',   subfase: 'Carpintería de madera — fabricación',        start: 50, end: 70, color: '#9B59B6' },
  { grupo: 'Carpintería de madera',   subfase: 'Carpintería de madera — instalación',        start: 75, end: 90, color: '#9B59B6' },
  { grupo: 'Vidriería',               subfase: 'Vidriería',                                  start: 80, end: 92, color: '#E91E63' },
  { grupo: 'Equipamiento',            subfase: 'Equipamiento',                               start: 85, end: 95, color: '#1ABC9C' },
  { grupo: 'Cocina',                  subfase: 'Cocina — fabricación',                       start: 55, end: 75, color: '#D85A30' },
  { grupo: 'Cocina',                  subfase: 'Cocina — instalación',                       start: 85, end: 95, color: '#D85A30' },
  { grupo: 'Pinturas',                subfase: 'Pinturas — primera mano',                    start: 70, end: 80, color: '#E67E22' },
  { grupo: 'Pinturas',                subfase: 'Pinturas — acabados finales',                start: 90, end: 100, color: '#E67E22' },
]

// Groups partidas for Gantt: rows named "Grupo — subfase" share one visual row with multiple bars
function groupPartidasForGantt(partidas: Partida[]): { label: string; color: string; items: Partida[] }[] {
  const result: { label: string; color: string; items: Partida[] }[] = []
  const indexMap = new Map<string, number>()
  for (const p of partidas) {
    const sep = p.nombre.indexOf(' — ')
    if (sep >= 0) {
      const label = p.nombre.slice(0, sep)
      if (indexMap.has(label)) {
        result[indexMap.get(label)!].items.push(p)
      } else {
        indexMap.set(label, result.length)
        result.push({ label, color: p.color, items: [p] })
      }
    } else {
      result.push({ label: p.nombre, color: p.color, items: [p] })
    }
  }
  return result
}

function addDaysToDate(base: Date, days: number): string {
  const d = new Date(base.getTime() + days * 86_400_000)
  return d.toISOString().split('T')[0]
}

function computePreviewPartidas(fechaInicio: string, semanas: number): Partida[] {
  const base = new Date(fechaInicio + 'T00:00:00')
  const totalDays = semanas * 7
  return FASES_PARAMETRICAS.map((f, i) => ({
    id: `preview-${i}`,
    nombre: f.subfase,
    fecha_inicio: addDaysToDate(base, Math.round(f.start / 100 * totalDays)),
    fecha_fin:    addDaysToDate(base, Math.round(f.end   / 100 * totalDays)),
    color: f.color,
    orden: i,
    completado: false,
  }))
}

function GanttPreview({ partidas }: { partidas: Partida[] }) {
  const [tooltip, setTooltip] = useState<GanttTooltipInfo | null>(null)
  const dates = partidas.flatMap(p => [p.fecha_inicio, p.fecha_fin].filter(Boolean) as string[])
  if (!dates.length) return null
  const minDate = dates.reduce((a, b) => a < b ? a : b)
  const rawMax  = dates.reduce((a, b) => a > b ? a : b)
  const rangeStart = new Date(minDate + 'T00:00:00'); rangeStart.setDate(1)
  const rangeEnd   = new Date(rawMax  + 'T00:00:00'); rangeEnd.setMonth(rangeEnd.getMonth() + 1, 0)
  const totalMs = rangeEnd.getTime() - rangeStart.getTime() || 1
  const pct = (d: string) => (new Date(d + 'T00:00:00').getTime() - rangeStart.getTime()) / totalMs * 100

  const today = new Date().toISOString().split('T')[0]
  const todayPct  = pct(today)
  const showToday = todayPct >= 0 && todayPct <= 100

  const months: { label: string; left: number; width: number }[] = []
  const cur = new Date(rangeStart)
  while (cur <= rangeEnd) {
    const mStart = new Date(cur)
    const mEnd   = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
    const left  = (mStart.getTime() - rangeStart.getTime()) / totalMs * 100
    const width = Math.min(100 - left, (mEnd.getTime() - mStart.getTime()) / totalMs * 100)
    months.push({ label: mStart.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }), left, width })
    cur.setMonth(cur.getMonth() + 1); cur.setDate(1)
  }

  const groups = groupPartidasForGantt(partidas)

  return (
    <>
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <div style={{ minWidth: 500, position: 'relative' }}>
        {/* Month headers */}
        <div style={{ position: 'relative', height: 20, marginLeft: 180, marginBottom: 4 }}>
          {months.map((m, i) => (
            <div key={i} style={{ position: 'absolute', left: `${m.left}%`, width: `${m.width}%`, fontSize: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#AAA', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {m.label}
            </div>
          ))}
          {showToday && (
            <div style={{ position: 'absolute', left: `${todayPct}%`, top: 3, transform: 'translateX(-50%)', fontSize: 7, fontWeight: 700, color: '#E53E3E', whiteSpace: 'nowrap' }}>
              HOY
            </div>
          )}
        </div>
        {/* Grouped rows */}
        {groups.map((g, gi) => (
          <div key={gi} style={{ display: 'flex', alignItems: 'center', height: 20, marginBottom: 3 }}>
            <div style={{ width: 180, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, paddingRight: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
            </div>
            <div style={{ flex: 1, height: '100%', position: 'relative', background: '#F0EEE8', borderRadius: 3 }}>
              {g.items.map(p => {
                const left  = p.fecha_inicio ? Math.max(0, pct(p.fecha_inicio)) : 0
                const right = p.fecha_fin    ? Math.min(100, pct(p.fecha_fin))  : left + 3
                const width = Math.max(0.8, right - left)
                const subfaseLabel = p.nombre.includes(' — ') ? p.nombre.split(' — ')[1] : null
                return (
                  <div
                    key={p.id}
                    style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 3, bottom: 3, borderRadius: 2, background: p.color, opacity: 0.85, cursor: 'default' }}
                    onMouseEnter={e => { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ fase: g.label, subfase: subfaseLabel, duracion: duracionSemanas(p.fecha_inicio, p.fecha_fin), x: r.left + r.width / 2, y: r.top }) }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
              {showToday && <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1.5, background: '#E53E3E', zIndex: 2, opacity: 0.85 }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
    <GanttTooltip info={tooltip} />
    </>
  )
}

function CronogramaSection({ proyectoId, initialPartidas }: { proyectoId: string; initialPartidas: Partida[] }) {
  const [partidas, setPartidas] = useState(initialPartidas)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Gantt tooltip
  const [ganttTooltip, setGanttTooltip] = useState<GanttTooltipInfo | null>(null)

  // Parametric generator state
  const [showGenerator, setShowGenerator]   = useState(false)
  const [genFecha, setGenFecha]             = useState('')
  const [genSemanas, setGenSemanas]         = useState(16)
  const [genSaving, setGenSaving]           = useState(false)
  const [genError, setGenError]             = useState<string | null>(null)

  const previewPartidas = genFecha && genSemanas >= 12
    ? computePreviewPartidas(genFecha, genSemanas)
    : []

  const saveGenerated = () => {
    if (!genFecha || genSemanas < 12) return
    setGenSaving(true); setGenError(null)
    startTransition(async () => {
      // Delete all existing partidas first
      for (const p of partidas) {
        await deletePartida(p.id, proyectoId)
      }
      const created: Partida[] = []
      for (let i = 0; i < FASES_PARAMETRICAS.length; i++) {
        const f = FASES_PARAMETRICAS[i]
        const base = new Date(genFecha + 'T00:00:00')
        const totalDays = genSemanas * 7
        const fi = addDaysToDate(base, Math.round(f.start / 100 * totalDays))
        const ff = addDaysToDate(base, Math.round(f.end   / 100 * totalDays))
        const res = await addPartida({ proyecto_id: proyectoId, nombre: f.subfase, fecha_inicio: fi, fecha_fin: ff, color: f.color, orden: i })
        if ('id' in res) {
          created.push({ id: res.id, nombre: f.subfase, fecha_inicio: fi, fecha_fin: ff, color: f.color, orden: i, completado: false })
        } else {
          setGenError(`Error al guardar "${f.subfase}": ${res.error}`)
          setGenSaving(false)
          return
        }
      }
      setPartidas(created)
      setShowGenerator(false)
      setGenSaving(false)
    })
  }

  // New form state
  const [nombre, setNombre] = useState('')
  const [fi, setFi] = useState('')
  const [ff, setFf] = useState('')
  const [color, setColor] = useState(PARTIDA_COLORS[0])

  // Edit state
  const [editData, setEditData] = useState<{ nombre: string; fi: string; ff: string; color: string } | null>(null)

  const submit = () => {
    if (!nombre.trim()) return
    startTransition(async () => {
      const res = await addPartida({
        proyecto_id: proyectoId, nombre: nombre.trim(),
        fecha_inicio: fi || null, fecha_fin: ff || null, color, orden: partidas.length,
      })
      if ('id' in res) {
        setPartidas(prev => [...prev, { id: res.id, nombre: nombre.trim(), fecha_inicio: fi || null, fecha_fin: ff || null, color, orden: prev.length, completado: false }])
        setNombre(''); setFi(''); setFf(''); setColor(PARTIDA_COLORS[0]); setShowForm(false)
      }
    })
  }

  const handleDelete = (id: string) => {
    setPartidas(prev => prev.filter(p => p.id !== id))
    startTransition(async () => { await deletePartida(id, proyectoId) })
  }

  const toggleCompletado = (p: Partida) => {
    const next = !p.completado
    setPartidas(prev => prev.map(x => x.id === p.id ? { ...x, completado: next } : x))
    startTransition(async () => { await updatePartida(p.id, proyectoId, { completado: next }) })
  }

  const saveEdit = (id: string) => {
    if (!editData) return
    setPartidas(prev => prev.map(p => p.id === id ? { ...p, nombre: editData.nombre, fecha_inicio: editData.fi || null, fecha_fin: editData.ff || null, color: editData.color } : p))
    startTransition(async () => {
      await updatePartida(id, proyectoId, { nombre: editData.nombre, fecha_inicio: editData.fi || null, fecha_fin: editData.ff || null, color: editData.color })
    })
    setEditing(null); setEditData(null)
  }

  // Calculate Gantt range
  const dates = partidas.flatMap(p => [p.fecha_inicio, p.fecha_fin].filter(Boolean) as string[])
  const today = new Date().toISOString().split('T')[0]
  const minDate = dates.length ? dates.reduce((a, b) => a < b ? a : b) : today
  const rawMax = dates.length ? dates.reduce((a, b) => a > b ? a : b) : today
  // Pad to month boundaries
  const rangeStart = new Date(minDate + 'T00:00:00')
  rangeStart.setDate(1)
  const rangeEnd = new Date(rawMax + 'T00:00:00')
  rangeEnd.setMonth(rangeEnd.getMonth() + 1, 0)

  const totalMs = rangeEnd.getTime() - rangeStart.getTime() || 1
  const pct = (d: string) => (new Date(d + 'T00:00:00').getTime() - rangeStart.getTime()) / totalMs * 100

  // Month headers
  const months: { label: string; left: number; width: number }[] = []
  const cur = new Date(rangeStart)
  while (cur <= rangeEnd) {
    const mStart = new Date(cur)
    const mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
    const left = (mStart.getTime() - rangeStart.getTime()) / totalMs * 100
    const width = Math.min(100 - left, (mEnd.getTime() - mStart.getTime()) / totalMs * 100)
    months.push({
      label: mStart.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
      left, width,
    })
    cur.setMonth(cur.getMonth() + 1)
    cur.setDate(1)
  }

  const hasDates = partidas.some(p => p.fecha_inicio || p.fecha_fin)
  const todayPct  = pct(today)
  const showToday = todayPct >= 0 && todayPct <= 100

  return (
    <>
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ ...S.sectionTitle, margin: 0 }}>Cronograma de obra</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowGenerator(v => !v); setShowForm(false) }} style={{ ...S.btnGhost, fontSize: 11 }}>
            {showGenerator ? 'Cancelar plantilla' : '⊞ Plantilla paramétrica'}
          </button>
          <button onClick={() => { setShowForm(v => !v); setShowGenerator(false) }} style={S.btnGhost}>
            {showForm ? 'Cancelar' : '+ Nueva partida'}
          </button>
        </div>
      </div>

      {showGenerator && (
        <div style={{ background: '#F8F7F4', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid #E8E6E0' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', margin: '0 0 4px' }}>Generar cronograma desde plantilla paramétrica</p>
          <p style={{ fontSize: 11, color: '#888', margin: '0 0 14px' }}>
            Define la fecha de inicio y la duración total. Las 18 fases se escalarán automáticamente según sus rangos porcentuales.
            {partidas.length > 0 && <span style={{ color: '#D85A30', fontWeight: 600 }}> Esto reemplazará las {partidas.length} partidas existentes.</span>}
          </p>
          <div className="pid-cron-gen-grid" style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 16, alignItems: 'end' }}>
            <div>
              <label style={S.label}>Fecha de inicio</label>
              <input type="date" value={genFecha} onChange={e => setGenFecha(e.target.value)} style={{ ...S.input, width: 'auto' }} />
            </div>
            <div>
              <label style={S.label}>Duración total (semanas, mín. 12)</label>
              <input type="number" min={12} max={104} value={genSemanas} onChange={e => setGenSemanas(Math.max(12, parseInt(e.target.value) || 12))} style={{ ...S.input, width: 90 }} />
            </div>
            <div />
          </div>

          {previewPartidas.length > 0 && (
            <div style={{ marginTop: 16, border: '1px solid #E8E6E0', borderRadius: 8, padding: '12px 14px', background: '#fff' }}>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 8px' }}>Previsualización — {genSemanas} semanas</p>
              <GanttPreview partidas={previewPartidas} />
            </div>
          )}

          {genError && <p style={{ fontSize: 11, color: '#E53E3E', marginTop: 8 }}>{genError}</p>}

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={saveGenerated}
              disabled={!genFecha || genSemanas < 12 || genSaving}
              style={{ ...S.btnPrimary, opacity: (!genFecha || genSemanas < 12 || genSaving) ? 0.4 : 1 }}
            >
              {genSaving ? 'Guardando…' : 'Guardar cronograma'}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ background: '#F8F7F4', borderRadius: 8, padding: '16px', marginBottom: 16, border: '1px solid #E8E6E0' }}>
          <div className="pid-cron-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={S.label}>Partida</label>
              <input placeholder="Ej: Cimentación, Estructura…" value={nombre} onChange={e => setNombre(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Inicio</label>
              <input type="date" value={fi} onChange={e => setFi(e.target.value)} style={{ ...S.input, width: 'auto' }} />
            </div>
            <div>
              <label style={S.label}>Fin</label>
              <input type="date" value={ff} onChange={e => setFf(e.target.value)} style={{ ...S.input, width: 'auto' }} />
            </div>
            <div>
              <label style={S.label}>Color</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {PARTIDA_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: color === c ? '2px solid #1A1A1A' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={submit} disabled={!nombre.trim()} style={{ ...S.btnPrimary, opacity: nombre.trim() ? 1 : 0.4 }}>Añadir partida</button>
          </div>
        </div>
      )}

      {partidas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#CCC', fontSize: 12, border: '1px dashed #DDD', borderRadius: 8 }}>
          Sin partidas — añade las fases del proyecto para visualizar el cronograma
        </div>
      ) : (
        <div>
          {/* Gantt chart */}
          {hasDates && (
            <div style={{ marginBottom: 16, overflowX: 'auto' }}>
              <div style={{ minWidth: 500, position: 'relative' }}>
                {/* Month headers */}
                <div style={{ position: 'relative', height: 24, marginLeft: 200, marginBottom: 4 }}>
                  {months.map((m, i) => (
                    <div key={i} style={{
                      position: 'absolute', left: `${m.left}%`, width: `${m.width}%`,
                      fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: '#AAA', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
                    }}>{m.label}</div>
                  ))}
                  {showToday && (
                    <div style={{ position: 'absolute', left: `${todayPct}%`, top: 4, transform: 'translateX(-50%)', fontSize: 8, fontWeight: 700, color: '#E53E3E', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                      HOY
                    </div>
                  )}
                </div>
                {/* Grouped bars */}
                <div style={{ position: 'relative' }}>
                  {groupPartidasForGantt(partidas).map((g, gi) => {
                    const allDone = g.items.every(p => p.completado)
                    return (
                      <div key={gi} style={{ display: 'flex', alignItems: 'center', height: 30, marginBottom: 4 }}>
                        {/* Label */}
                        <div style={{ width: 200, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, paddingRight: 12 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: allDone ? '#CCC' : g.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: allDone ? '#AAA' : '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: allDone ? 'line-through' : 'none' }}>
                            {g.label}
                          </span>
                        </div>
                        {/* Bar track — multiple segments */}
                        <div style={{ flex: 1, height: '100%', position: 'relative', background: '#F0EEE8', borderRadius: 4 }}>
                          {g.items.map(p => {
                            if (!p.fecha_inicio && !p.fecha_fin) return null
                            const l = p.fecha_inicio ? Math.max(0, pct(p.fecha_inicio)) : 0
                            const r = p.fecha_fin   ? Math.min(100, pct(p.fecha_fin))  : l + 4
                            const w = Math.max(0.8, r - l)
                            const subfaseLabel = p.nombre.includes(' — ') ? p.nombre.split(' — ')[1] : null
                            return (
                              <div
                                key={p.id}
                                style={{ position: 'absolute', left: `${l}%`, width: `${w}%`, top: 4, bottom: 4, borderRadius: 3, background: p.completado ? '#CCC' : p.color, opacity: p.completado ? 0.55 : 1, cursor: 'default' }}
                                onMouseEnter={e => { const rect = e.currentTarget.getBoundingClientRect(); setGanttTooltip({ fase: g.label, subfase: subfaseLabel, duracion: duracionSemanas(p.fecha_inicio, p.fecha_fin), x: rect.left + rect.width / 2, y: rect.top }) }}
                                onMouseLeave={() => setGanttTooltip(null)}
                              />
                            )
                          })}
                          {showToday && (
                            <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1.5, background: '#E53E3E', zIndex: 2, opacity: 0.85 }} />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Partida list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {partidas.map(p => (
              <div key={p.id}>
                {editing === p.id && editData ? (
                  <div style={{ background: '#F8F7F4', borderRadius: 6, padding: '10px 12px', border: '1px solid #E8E6E0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 10, alignItems: 'center' }}>
                      <input value={editData.nombre} onChange={e => setEditData({ ...editData, nombre: e.target.value })} style={{ ...S.input }} />
                      <input type="date" value={editData.fi} onChange={e => setEditData({ ...editData, fi: e.target.value })} style={{ ...S.input, width: 'auto' }} />
                      <input type="date" value={editData.ff} onChange={e => setEditData({ ...editData, ff: e.target.value })} style={{ ...S.input, width: 'auto' }} />
                      <div style={{ display: 'flex', gap: 3 }}>
                        {PARTIDA_COLORS.map(c => (
                          <button key={c} onClick={() => setEditData({ ...editData, color: c })} style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: editData.color === c ? '2px solid #1A1A1A' : '2px solid transparent', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => saveEdit(p.id)} style={{ ...S.btnPrimary, padding: '5px 12px' }}>✓</button>
                        <button onClick={() => { setEditing(null); setEditData(null) }} style={{ ...S.btnGhost, padding: '5px 10px' }}>✕</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F8F7F4' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.completado ? '#CCC' : p.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 12, color: p.completado ? '#AAA' : '#1A1A1A', textDecoration: p.completado ? 'line-through' : 'none' }}>{p.nombre}</div>
                    {(p.fecha_inicio || p.fecha_fin) && (
                      <div style={{ fontSize: 10, color: '#AAA' }}>
                        {p.fecha_inicio && fmtShort(p.fecha_inicio)}
                        {p.fecha_inicio && p.fecha_fin && ' → '}
                        {p.fecha_fin && fmtShort(p.fecha_fin)}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => toggleCompletado(p)} title={p.completado ? 'Marcar pendiente' : 'Marcar completado'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: p.completado ? '#1D9E75' : '#CCC' }}>
                        {p.completado ? '✓' : '○'}
                      </button>
                      <button onClick={() => { setEditing(p.id); setEditData({ nombre: p.nombre, fi: p.fecha_inicio ?? '', ff: p.fecha_fin ?? '', color: p.color }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#AAA' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#555' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}>✎</button>
                      <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#CCC' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CCC' }}>×</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    <GanttTooltip info={ganttTooltip} />
    </>
  )
}

// ── CONSTRUCTOR SECTION (read-only) ──────────────────────────────────────────

function ConstructorSection({ constructor }: {
  constructor: { id: string; nombre: string } | null
}) {
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ ...S.sectionTitle, margin: 0 }}>Constructor</p>
        <span style={{ fontSize: 10, color: '#CCC' }}>Se asigna desde el proyecto →</span>
      </div>
      {constructor ? (
        <p style={{ fontSize: 12, color: '#1A1A1A', fontWeight: 500, marginTop: 10, marginBottom: 0 }}>{constructor.nombre}</p>
      ) : (
        <p style={{ fontSize: 12, color: '#AAA', marginTop: 8, marginBottom: 0 }}>Sin constructor asignado</p>
      )}
    </div>
  )
}

function PortalTab({ proyecto, portal, titulares, isPrivileged, renders, visitas, partidas }: {
  proyecto: ProyectoInfo
  portal: PortalData | null
  titulares: TitularInfo[]
  isPrivileged: boolean
  renders: Render[]
  visitas: Visita[]
  partidas: Partida[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isPrivileged && (
        <PortalClientAccess
          proyectoId={proyecto.id}
          titulares={titulares}
          initialIds={portal?.portal_cliente_ids ?? []}
        />
      )}
      <ConstructorSection constructor={proyecto.constructor} />
      <FlooryfSection proyectoId={proyecto.id} initialUrl={portal?.floorfy_url ?? null} />
      <PDFSection proyectoId={proyecto.id} initialUrl={portal?.pdf_proyecto_url ?? null} />
      <RendersSection proyectoId={proyecto.id} initialRenders={renders} />
      <VisitasSection
        proyectoId={proyecto.id}
        initialVisitas={visitas}
        proyectoNombre={proyecto.nombre}
        proyectoCodigo={proyecto.codigo}
        proyectoDireccion={proyecto.direccion ?? null}
        proyectoConstructor={proyecto.constructor}
      />
      <CronogramaSection proyectoId={proyecto.id} initialPartidas={partidas} />
    </div>
  )
}

// ── CONTRATOS TAB ─────────────────────────────────────────────────────────────

function ContratoFile({ label, url, onUploaded, storagePath }: {
  label: string; url: string | null
  onUploaded: (url: string) => void
  storagePath: string
}) {
  return (
    <div>
      <p style={{ ...S.sectionTitle, marginBottom: 10 }}>{label}</p>
      {url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#F8F7F4', borderRadius: 8, border: '1px solid #E8E6E0' }}>
          <div style={{ width: 48, height: 60, background: '#fff', borderRadius: 4, border: '1px solid #E8E6E0', flexShrink: 0, overflow: 'hidden' }}>
            <PDFThumbnail url={url} />
          </div>
          <a href={url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#D85A30', textDecoration: 'none' }}>
            Ver contrato →
          </a>
          <UploadButton accept=".pdf" label="Reemplazar" path={storagePath} onUploaded={onUploaded} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', border: '2px dashed #E8E6E0', borderRadius: 8, gap: 10 }}>
          <div style={{ fontSize: 24 }}>📋</div>
          <p style={{ fontSize: 11, color: '#AAA', margin: 0 }}>Sin contrato cargado</p>
          <UploadButton accept=".pdf" label="↑ Subir contrato" path={storagePath} onUploaded={onUploaded} />
        </div>
      )}
    </div>
  )
}

function ContratosTab({ proyectoId, initialContratos }: { proyectoId: string; initialContratos: Contratos | null }) {
  const [arqUrl, setArqUrl] = useState(initialContratos?.contrato_arquitectura_url ?? null)
  const [obraUrl, setObraUrl] = useState(initialContratos?.contrato_obra_url ?? null)
  const [presupuestoUrl, setPresupuestoUrl] = useState(initialContratos?.pdf_presupuesto_url ?? null)
  const [notas, setNotas] = useState(initialContratos?.notas ?? '')
  const [saving, setSaving] = useState(false)

  const handleArqUploaded = async (url: string) => {
    setArqUrl(url)
    await upsertContratos(proyectoId, { contrato_arquitectura_url: url })
  }

  const handleObraUploaded = async (url: string) => {
    setObraUrl(url)
    await upsertContratos(proyectoId, { contrato_obra_url: url })
  }

  const handlePresupuestoUploaded = async (url: string) => {
    setPresupuestoUrl(url)
    await upsertContratos(proyectoId, { pdf_presupuesto_url: url })
  }

  const saveNotas = async () => {
    setSaving(true)
    await upsertContratos(proyectoId, { notas: notas.trim() || null })
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...S.card }}>
        <div className="pid-contratos-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          <ContratoFile label="Contrato de Arquitectura / Interiorismo" url={arqUrl} onUploaded={handleArqUploaded} storagePath={`${proyectoId}/contratos`} />
          <ContratoFile label="Contrato de Obra / Construcción" url={obraUrl} onUploaded={handleObraUploaded} storagePath={`${proyectoId}/contratos`} />
          <ContratoFile label="Presupuesto de Obra" url={presupuestoUrl} onUploaded={handlePresupuestoUploaded} storagePath={`${proyectoId}/contratos`} />
        </div>
      </div>
      <div style={S.card}>
        <p style={S.sectionTitle}>Notas de contratos</p>
        <textarea
          rows={4} value={notas} onChange={e => setNotas(e.target.value)}
          placeholder="Observaciones, cláusulas relevantes, honorarios acordados…"
          style={{ ...S.textarea, marginBottom: 12 }}
        />
        <button onClick={saveNotas} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Guardando…' : 'Guardar notas'}
        </button>
      </div>
    </div>
  )
}

// ── FACTURACIÓN TAB ───────────────────────────────────────────────────────────

function FacturacionTab({ facturas }: { facturas: Factura[] }) {
  if (facturas.length === 0) {
    return (
      <div style={{ ...S.card, textAlign: 'center', padding: '40px', color: '#CCC' }}>
        Sin facturas vinculadas a este proyecto
      </div>
    )
  }

  const grouped = facturas.reduce<Record<string, Factura[]>>((acc, f) => {
    if (!acc[f.seccion]) acc[f.seccion] = []
    acc[f.seccion].push(f)
    return acc
  }, {})

  const totalTotal = facturas.reduce((s, f) => s + f.monto, 0)
  const totalPagado = facturas.filter(f => f.status === 'pagada').reduce((s, f) => s + f.monto, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div className="pid-facturacion-summary" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { label: 'Total facturado', value: fmtMoney(totalTotal), color: '#1A1A1A' },
          { label: 'Cobrado', value: fmtMoney(totalPagado), color: '#1D9E75' },
          { label: 'Pendiente', value: fmtMoney(totalTotal - totalPagado), color: '#C9A227' },
        ].map(card => (
          <div key={card.label} style={{ ...S.card, textAlign: 'center' }}>
            <p style={{ ...S.label, textAlign: 'center', marginBottom: 8 }}>{card.label}</p>
            <p style={{ fontSize: 20, fontWeight: 300, color: card.color, margin: 0, letterSpacing: '-0.01em' }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* By section */}
      {Object.entries(grouped).map(([seccion, facts]) => (
        <div key={seccion} style={S.card}>
          <p style={S.sectionTitle}>{seccion}</p>
          <div className="fp-table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Concepto', 'Importe', 'Estado', 'F. acordada', 'Nº factura'].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', padding: '0 12px 10px 0', borderBottom: '1px solid #E8E6E0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facts.map(f => {
                const st = FACTURA_STATUS[f.status] ?? { label: f.status, color: '#888', bg: '#F4F4F4' }
                return (
                  <tr key={f.id}>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: 12, color: '#1A1A1A', borderBottom: '1px solid #F0EEE8' }}>{f.concepto}</td>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: 12, fontWeight: 600, color: '#1A1A1A', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>{fmtMoney(f.monto)}</td>
                    <td style={{ padding: '10px 12px 10px 0', borderBottom: '1px solid #F0EEE8' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 3, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px 10px 0', fontSize: 11, color: '#888', borderBottom: '1px solid #F0EEE8' }}>{f.fecha_pago_acordada ? fmtShort(f.fecha_pago_acordada) : '—'}</td>
                    <td style={{ padding: '10px 0', fontSize: 11, color: '#AAA', borderBottom: '1px solid #F0EEE8', fontFamily: 'monospace' }}>{f.numero_factura ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          <div style={{ marginTop: 10, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>
            Total sección: {fmtMoney(facts.reduce((s, f) => s + f.monto, 0))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── CONSTRUCTORA TAB ──────────────────────────────────────────────────────────

const EMPTY_PAGO = { concepto: '', importe_estimado: '', fecha_estimada: '', notas: '' }

function ConstructoraTab({ proyectoId, initialPagos }: { proyectoId: string; initialPagos: PagoConstructora[] }) {
  const [pagos, setPagos]         = useState<PagoConstructora[]>(initialPagos)
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState(EMPTY_PAGO)
  const [editId, setEditId]       = useState<string | null>(null)
  const [editForm, setEditForm]   = useState(EMPTY_PAGO)
  const [isPending, startTransition] = useTransition()
  const [err, setErr]             = useState<string | null>(null)

  const totalConstructora = pagos.reduce((s, p) => s + (p.importe_estimado ?? 0), 0)

  function handleAdd() {
    if (!form.concepto.trim() || !form.fecha_estimada) return
    const importe = form.importe_estimado ? parseFloat(form.importe_estimado) : null
    const optimistic: PagoConstructora = {
      id: 'tmp-' + Date.now(),
      concepto: form.concepto.trim(),
      importe_estimado: importe,
      fecha_estimada: form.fecha_estimada,
      orden: pagos.length,
      notas: form.notas || null,
    }
    setPagos(prev => [...prev, optimistic].sort((a, b) => a.fecha_estimada.localeCompare(b.fecha_estimada)))
    setForm(EMPTY_PAGO)
    setShowAdd(false)
    startTransition(async () => {
      const res = await addPagoConstructora({
        proyecto_id: proyectoId,
        concepto: optimistic.concepto,
        importe_estimado: optimistic.importe_estimado,
        fecha_estimada: optimistic.fecha_estimada,
        notas: optimistic.notas,
        orden: optimistic.orden,
      })
      if ('error' in res) { setErr(res.error); setPagos(prev => prev.filter(p => p.id !== optimistic.id)) }
      else setPagos(prev => prev.map(p => p.id === optimistic.id ? { ...p, id: res.id } : p))
    })
  }

  function startEdit(p: PagoConstructora) {
    setEditId(p.id)
    setEditForm({ concepto: p.concepto, importe_estimado: p.importe_estimado?.toString() ?? '', fecha_estimada: p.fecha_estimada, notas: p.notas ?? '' })
  }

  function handleSaveEdit() {
    if (!editId || !editForm.concepto.trim() || !editForm.fecha_estimada) return
    const importe = editForm.importe_estimado ? parseFloat(editForm.importe_estimado) : null
    setPagos(prev => prev.map(p => p.id === editId
      ? { ...p, concepto: editForm.concepto.trim(), importe_estimado: importe, fecha_estimada: editForm.fecha_estimada, notas: editForm.notas || null }
      : p
    ).sort((a, b) => a.fecha_estimada.localeCompare(b.fecha_estimada)))
    const id = editId
    setEditId(null)
    startTransition(async () => {
      const res = await updatePagoConstructora(id, proyectoId, {
        concepto: editForm.concepto.trim(),
        importe_estimado: importe,
        fecha_estimada: editForm.fecha_estimada,
        notas: editForm.notas || null,
      })
      if ('error' in res) setErr(res.error)
    })
  }

  function handleDelete(id: string) {
    setPagos(prev => prev.filter(p => p.id !== id))
    startTransition(async () => {
      const res = await deletePagoConstructora(id, proyectoId)
      if ('error' in res) setErr(res.error)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {err && <div style={{ background: '#FEF2F2', color: '#E53E3E', borderRadius: 6, padding: '10px 14px', fontSize: 12 }}>{err}</div>}

      {/* Summary */}
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <p style={{ ...S.label, marginBottom: 4 }}>Total constructora</p>
          <p style={{ fontSize: 22, fontWeight: 300, color: '#1D4ED8', margin: 0, letterSpacing: '-0.01em' }}>{fmtMoney(totalConstructora)}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ ...S.label, marginBottom: 4 }}>Hitos</p>
          <p style={{ fontSize: 22, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>{pagos.length}</p>
        </div>
      </div>

      {/* Table */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={S.sectionTitle}>Programa de pagos</p>
          <button
            style={{ ...S.btnPrimary, opacity: isPending ? 0.6 : 1 }}
            onClick={() => { setShowAdd(true); setEditId(null) }}
          >
            + Añadir hito
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div style={{ background: '#F8F7F4', borderRadius: 8, padding: '16px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 120px 140px', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={S.label}>Concepto</label>
              <input style={S.input} placeholder="Ej: Certificación 1" value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Importe (€)</label>
              <input style={S.input} type="number" placeholder="0.00" value={form.importe_estimado} onChange={e => setForm(f => ({ ...f, importe_estimado: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Fecha estimada</label>
              <input style={S.input} type="date" value={form.fecha_estimada} onChange={e => setForm(f => ({ ...f, fecha_estimada: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={S.label}>Notas (opcional)</label>
              <input style={S.input} placeholder="Notas..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setShowAdd(false)}>Cancelar</button>
              <button style={S.btnPrimary} onClick={handleAdd} disabled={!form.concepto.trim() || !form.fecha_estimada}>Guardar</button>
            </div>
          </div>
        )}

        {pagos.length === 0 && !showAdd ? (
          <p style={{ textAlign: 'center', color: '#CCC', fontSize: 13, padding: '32px 0' }}>Sin hitos de pago. Añade el primero.</p>
        ) : (
          <div className="fp-table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Concepto', 'Importe estimado', 'Fecha estimada', 'Notas', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', padding: '0 12px 10px 0', borderBottom: '1px solid #E8E6E0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagos.map(p => editId === p.id ? (
                <tr key={p.id}>
                  <td style={{ padding: '8px 12px 8px 0', borderBottom: '1px solid #F0EEE8' }}>
                    <input style={{ ...S.input, minWidth: 160 }} value={editForm.concepto} onChange={e => setEditForm(f => ({ ...f, concepto: e.target.value }))} />
                  </td>
                  <td style={{ padding: '8px 12px 8px 0', borderBottom: '1px solid #F0EEE8' }}>
                    <input style={{ ...S.input, width: 110 }} type="number" value={editForm.importe_estimado} onChange={e => setEditForm(f => ({ ...f, importe_estimado: e.target.value }))} />
                  </td>
                  <td style={{ padding: '8px 12px 8px 0', borderBottom: '1px solid #F0EEE8' }}>
                    <input style={{ ...S.input, width: 130 }} type="date" value={editForm.fecha_estimada} onChange={e => setEditForm(f => ({ ...f, fecha_estimada: e.target.value }))} />
                  </td>
                  <td style={{ padding: '8px 12px 8px 0', borderBottom: '1px solid #F0EEE8' }}>
                    <input style={{ ...S.input, minWidth: 120 }} value={editForm.notas} onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))} />
                  </td>
                  <td style={{ padding: '8px 0', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>
                    <button style={{ ...S.btnPrimary, padding: '5px 10px', marginRight: 6 }} onClick={handleSaveEdit}>OK</button>
                    <button style={{ ...S.btnGhost, padding: '4px 8px' }} onClick={() => setEditId(null)}>✕</button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id}>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: 12, color: '#1A1A1A', borderBottom: '1px solid #F0EEE8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1D4ED8', flexShrink: 0 }} />
                      {p.concepto}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: 12, fontWeight: 600, color: '#1D4ED8', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>
                    {p.importe_estimado !== null ? fmtMoney(p.importe_estimado) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: 12, color: '#1A1A1A', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>
                    {fmtShort(p.fecha_estimada)}
                  </td>
                  <td style={{ padding: '10px 12px 10px 0', fontSize: 11, color: '#888', borderBottom: '1px solid #F0EEE8', maxWidth: 180 }}>
                    {p.notas ?? '—'}
                  </td>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #F0EEE8', whiteSpace: 'nowrap' }}>
                    <button style={{ ...S.btnGhost, padding: '4px 10px', marginRight: 4 }} onClick={() => startEdit(p)}>Editar</button>
                    <button
                      style={{ padding: '4px 8px', background: 'none', color: '#E53E3E', border: '1px solid #FECACA', borderRadius: 5, cursor: 'pointer', fontSize: 11 }}
                      onClick={() => handleDelete(p.id)}
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {totalConstructora > 0 && (
          <div style={{ marginTop: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#1D4ED8' }}>
            Total: {fmtMoney(totalConstructora)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export default function PlataformaInternaDetalle({
  proyecto, userRol, titulares,
  portal, renders, visitas, partidas, contratos, facturas, pagosConstructora,
}: {
  proyecto: ProyectoInfo
  userRol: string
  titulares: TitularInfo[]
  portal: PortalData | null
  renders: Render[]
  visitas: Visita[]
  partidas: Partida[]
  contratos: Contratos | null
  facturas: Factura[]
  pagosConstructora: PagoConstructora[]
}) {
  const router = useRouter()
  const isPrivileged = ['fp_partner', 'fp_manager'].includes(userRol)
  const meta = STATUS_META[proyecto.status] ?? { label: proyecto.status, color: '#999' }

  const allTabs = [
    { id: 'portal', label: 'Portal' },
    ...(isPrivileged ? [
      { id: 'contratos',    label: 'Contratos' },
      { id: 'facturacion',  label: 'Facturación' },
      { id: 'constructora', label: 'Constructora' },
    ] : []),
  ]
  const [tab, setTab] = useState('portal')

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div className="pid-header" style={{ padding: '40px 40px 0', background: '#fff' }}>
        <button
          onClick={() => router.push('/team/clientes/plataforma/interna')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#AAA', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#555' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
        >
          ← Plataforma interna
        </button>
        <div className="pid-title-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, paddingBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>{proyecto.nombre}</h1>
              {proyecto.codigo && (
                <span style={{ fontSize: 11, color: '#AAA', background: '#F0EEE8', padding: '3px 8px', borderRadius: 4, fontFamily: 'monospace' }}>{proyecto.codigo}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: meta.color, background: `${meta.color}18`, padding: '3px 8px', borderRadius: 3 }}>{meta.label}</span>
              {proyecto.cliente && <span style={{ fontSize: 12, color: '#888' }}>{proyecto.cliente}</span>}
            </div>
          </div>
          <div className="pid-header-actions" style={{ display: 'flex', gap: 8, flexShrink: 0, marginTop: 4 }}>
            <CopyPortalLink proyectoId={proyecto.id} />
            <button
              onClick={() => router.push('/team/clientes/plataforma/externa')}
              style={{ padding: '8px 16px', background: 'none', border: '1px solid #E8E6E0', borderRadius: 6, cursor: 'pointer', fontSize: 10, color: '#888' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1D9E75'; (e.currentTarget as HTMLElement).style.color = '#1D9E75' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0'; (e.currentTarget as HTMLElement).style.color = '#888' }}
            >
              Vista del cliente →
            </button>
          </div>
        </div>
      </div>

      <TabNav tabs={allTabs} active={tab} onChange={setTab} />

      {/* Content */}
      <div className="pid-content" style={{ padding: '32px 40px', maxWidth: 1000 }}>
        {tab === 'portal'       && <PortalTab       proyecto={proyecto} portal={portal} titulares={titulares} isPrivileged={isPrivileged} renders={renders} visitas={visitas} partidas={partidas} />}
        {tab === 'contratos'    && isPrivileged && <ContratosTab    proyectoId={proyecto.id} initialContratos={contratos} />}
        {tab === 'facturacion'  && isPrivileged && <FacturacionTab  facturas={facturas} />}
        {tab === 'constructora' && isPrivileged && <ConstructoraTab proyectoId={proyecto.id} initialPagos={pagosConstructora} />}
      </div>
    </div>
  )
}
