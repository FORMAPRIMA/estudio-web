'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Partner {
  id: string
  nombre: string
  contacto_nombre: string | null
  email_contacto:  string | null
}

interface Project {
  id: string
  nombre: string
  descripcion: string | null
  direccion:   string | null
  ciudad:      string | null
}

interface Tender {
  id: string
  descripcion: string | null
  fecha_limite: string
  status: string
}

interface TemplatePhase {
  id: string
  nombre: string
  descripcion: string | null
  orden: number
  lead_time_days: number | null
}

interface BidPhaseDuration {
  id: string
  template_phase_id: string
  project_unit_id: string
  duracion_dias: number
}

interface TemplateLineItem {
  id: string
  nombre: string
  unidad_medida: string
}

interface ProjectLineItem {
  id: string
  cantidad: number
  notas: string | null
  template_line_item: TemplateLineItem | null
}

interface ProjectUnit {
  id: string
  template_unit_id: string
  notas: string | null
  template_unit: {
    id: string
    nombre: string
    descripcion: string | null
    phases: TemplatePhase[]
  } | null
  line_items: ProjectLineItem[]
}

interface PortalDoc {
  id: string
  nombre: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  discipline_tags: string[]
  created_at: string
  project_unit_id: string | null
}

interface BidLineItem {
  id: string
  project_line_item_id: string
  precio_unitario: number
  notas: string | null
}

interface ExistingBid {
  id: string
  notas: string | null
  status: string
  submitted_at: string | null
  line_items: BidLineItem[]
  phase_durations: BidPhaseDuration[]
}

interface PortalQuestion {
  id:               string
  partner_nombre:   string
  pregunta:         string
  respuesta:        string | null
  asked_at:         string
  answered_at:      string | null
  answered_by_name: string | null
}

type ActiveTab = 'overview' | 'docs' | 'bid' | 'qa'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function isVideo(mime: string | null, nombre: string): boolean {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
  return !!(mime?.startsWith('video/') || ['mp4','webm','mov','avi','wmv','mkv'].includes(ext))
}

function isImage(mime: string | null, nombre: string): boolean {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
  return !!(mime?.startsWith('image/') || ['jpg','jpeg','png','webp','svg','gif'].includes(ext))
}

function isPdf(mime: string | null, nombre: string): boolean {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
  return ext === 'pdf' || mime === 'application/pdf'
}

function countdown(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now()
  if (diff <= 0) return 'Plazo finalizado'
  const days  = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `${days}d ${hours}h restantes`
  return `${hours}h restantes`
}

async function getDocUrl(token: string, storage_path: string): Promise<string | null> {
  const res  = await fetch(`/api/execution-portal/document?token=${encodeURIComponent(token)}&storage_path=${encodeURIComponent(storage_path)}`)
  const json = await res.json()
  return res.ok && json.url ? (json.url as string) : null
}

// ── Mapbox map card ───────────────────────────────────────────────────────────

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

type GeoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; lat: number; lng: number }
  | { status: 'error'; reason: string }

function MapCard({ address, height = 220 }: { address: string; height?: number }) {
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' })

  useEffect(() => {
    if (!MAPBOX_TOKEN || !address) return
    setGeo({ status: 'loading' })
    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?limit=1&language=es&access_token=${MAPBOX_TOKEN}`
    )
      .then(r => r.json())
      .then((data: { features: { geometry: { coordinates: [number, number] } }[] }) => {
        const coords = data.features?.[0]?.geometry?.coordinates
        if (coords) setGeo({ status: 'ok', lng: coords[0], lat: coords[1] })
        else        setGeo({ status: 'error', reason: 'Dirección no encontrada' })
      })
      .catch(() => setGeo({ status: 'error', reason: 'Error de conexión' }))
  }, [address])

  const googleUrl = `https://www.google.com/maps/search/${encodeURIComponent(address)}`
  const cardBase: React.CSSProperties = { height, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden', background: '#111' }

  if (!MAPBOX_TOKEN) {
    return (
      <div style={{ ...cardBase, flexDirection: 'column', gap: 10, padding: 24, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Mapa no configurado</p>
        {address && <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#D85A30', textDecoration: 'none' }}>Ver en Google Maps →</a>}
      </div>
    )
  }

  if (geo.status === 'idle' || geo.status === 'loading') {
    return (
      <div style={cardBase}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>
          {geo.status === 'loading' ? 'Localizando…' : ''}
        </span>
      </div>
    )
  }

  if (geo.status === 'error') {
    return (
      <div style={{ ...cardBase, flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{geo.reason}</p>
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#D85A30', textDecoration: 'none' }}>Ver en Google Maps →</a>
      </div>
    )
  }

  const { lat, lng } = geo
  const marker = `pin-l+D85A30(${lng},${lat})`
  const mapSrc = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${marker}/${lng},${lat},14.5,0/700x420@2x?access_token=${MAPBOX_TOKEN}`

  return (
    <div style={{ position: 'relative', height, borderRadius: 12, overflow: 'hidden', background: '#111' }}>
      <img src={mapSrc} alt={`Mapa — ${address}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)', padding: '20px 16px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{address}</span>
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', flexShrink: 0, marginLeft: 8, letterSpacing: '0.05em' }}>Ver mapa →</a>
      </div>
    </div>
  )
}

// ── Hero Section ──────────────────────────────────────────────────────────────

// ── Countdown helpers ─────────────────────────────────────────────────────────

function calcTimeLeft(isoDate: string) {
  const diff = Math.max(0, new Date(isoDate).getTime() - Date.now())
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    expired: diff === 0,
  }
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 54, height: 54, borderRadius: 10,
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'monospace', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <p style={{ margin: '5px 0 0', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
        {label}
      </p>
    </div>
  )
}

// ── Hero Section ──────────────────────────────────────────────────────────────

function HeroSection({
  renderUrls, partner, project, tender, onGoToTab, tabSectionRef,
}: {
  renderUrls: string[]
  partner: Partner
  project: Project
  tender: Tender
  onGoToTab: (tab: ActiveTab) => void
  tabSectionRef: React.RefObject<HTMLDivElement>
}) {
  const [active, setActive] = useState(0)
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(tender.fecha_limite))

  // Auto-cycle renders
  useEffect(() => {
    if (renderUrls.length <= 1) return
    const t = setInterval(() => setActive(i => (i + 1) % renderUrls.length), 4500)
    return () => clearInterval(t)
  }, [renderUrls.length])

  // Live countdown tick
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(calcTimeLeft(tender.fecha_limite)), 1000)
    return () => clearInterval(t)
  }, [tender.fecha_limite])

  const goTo = (tab: ActiveTab) => {
    onGoToTab(tab)
    setTimeout(() => tabSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const deadlineLabel = new Date(tender.fecha_limite).toLocaleDateString('es-ES', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ position: 'relative', height: '100dvh', minHeight: 620, overflow: 'hidden', background: '#111' }}>
      {/* Cycling background images */}
      {renderUrls.map((url, i) => (
        <div key={url} style={{ position: 'absolute', inset: 0, opacity: i === active ? 1 : 0, transition: 'opacity 1.4s ease' }}>
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      ))}
      {renderUrls.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(145deg, #1A1A1A 0%, #252525 60%, #1A1A1A 100%)' }} />
      )}

      {/* Gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.9) 100%)' }} />

      {/* Top brand label */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '28px 24px' }}>
        <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
          Portal de Licitación · Forma Prima
        </p>
      </div>

      {/* Bottom content */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 32px' }}>

        {/* Greeting */}
        <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>
          Bienvenido a tu portal de licitación
        </p>
        <h1 style={{ margin: '0 0 0', fontSize: 36, fontWeight: 700, color: '#fff', letterSpacing: '-0.025em', lineHeight: 1.05 }}>
          Hola, {partner.nombre}
        </h1>

        {/* Accent line */}
        <div style={{ width: 44, height: 3, background: '#D85A30', borderRadius: 2, margin: '14px 0' }} />

        {/* Project name + address */}
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
          {project.nombre}
        </h2>
        {(project.direccion || project.ciudad) && (
          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            {[project.direccion, project.ciudad].filter(Boolean).join(', ')}
          </p>
        )}
        {tender.descripcion && (
          <p style={{ margin: '0 0 0', fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
            {tender.descripcion}
          </p>
        )}

        {/* Countdown */}
        <div style={{ margin: '18px 0 20px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>
            Fecha límite de oferta
          </p>
          {timeLeft.expired ? (
            <div style={{ display: 'inline-block', padding: '10px 18px', background: 'rgba(220,38,38,0.25)', borderRadius: 10, border: '1px solid rgba(220,38,38,0.3)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#FCA5A5' }}>Plazo finalizado</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <CountdownUnit value={timeLeft.days}    label="días"    />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 22, fontWeight: 300, paddingTop: 12, lineHeight: 1 }}>:</span>
              <CountdownUnit value={timeLeft.hours}   label="horas"   />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 22, fontWeight: 300, paddingTop: 12, lineHeight: 1 }}>:</span>
              <CountdownUnit value={timeLeft.minutes} label="min"     />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 22, fontWeight: 300, paddingTop: 12, lineHeight: 1 }}>:</span>
              <CountdownUnit value={timeLeft.seconds} label="seg"     />
            </div>
          )}
          <p style={{ margin: '8px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'capitalize' }}>
            {deadlineLabel}
          </p>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <button onClick={() => goTo('docs')} style={{ padding: '11px 22px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#D85A30', color: '#fff', fontFamily: 'inherit' }}>
            Ver documentación
          </button>
          <button onClick={() => goTo('bid')} style={{ padding: '11px 22px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', background: 'rgba(255,255,255,0.07)', color: '#fff', fontFamily: 'inherit' }}>
            Mi oferta
          </button>
        </div>

        {/* Image dots */}
        {renderUrls.length > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {renderUrls.map((_, i) => (
              <button key={i} onClick={() => setActive(i)} style={{ width: i === active ? 22 : 7, height: 7, borderRadius: 4, border: 'none', cursor: 'pointer', padding: 0, background: i === active ? '#fff' : 'rgba(255,255,255,0.3)', transition: 'all 0.25s' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab intro text ────────────────────────────────────────────────────────────

function TabIntro({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 18px', background: '#F8F7F4', borderRadius: 10, border: '1px solid #E8E6E0', marginBottom: 24, borderLeft: '3px solid #D85A30' }}>
      <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.65 }}>{children}</p>
    </div>
  )
}

// ── PDF Thumbnail Card ────────────────────────────────────────────────────────
// Renders page 1 of a PDF to a <canvas> thumbnail via pdfjs-dist

function PdfCard({ doc, token }: { doc: PortalDoc; token: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let dead = false
    ;(async () => {
      setPhase('loading')
      try {
        // Get signed URL for the PDF
        const url = await getDocUrl(token, doc.storage_path)
        if (!url || dead) { setPhase('error'); return }

        // Dynamically import pdfjs-dist
        const pdfjs = await import('pdfjs-dist')
        if (dead) return

        // Set worker source — unpkg serves the exact installed version
        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

        // Load PDF
        const pdf = await pdfjs.getDocument({ url, withCredentials: false }).promise
        if (dead) return

        // Get page 1
        const page = await pdf.getPage(1)
        if (dead) return

        const canvas = canvasRef.current
        if (!canvas) return

        // Scale to 280px wide (thumbnail quality)
        const base = page.getViewport({ scale: 1 })
        const scale = 280 / base.width
        const vp = page.getViewport({ scale })

        canvas.width  = vp.width
        canvas.height = vp.height

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (page.render as any)({ canvasContext: ctx, viewport: vp }).promise
        if (!dead) setPhase('done')
      } catch {
        if (!dead) setPhase('error')
      }
    })()
    return () => { dead = true }
  }, [doc.storage_path, token])

  const handleDownload = async () => {
    setDownloading(true)
    const url = await getDocUrl(token, doc.storage_path)
    setDownloading(false)
    if (url) window.open(url, '_blank')
  }

  const displayName = doc.nombre.replace(/\.pdf$/i, '')

  return (
    <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #E8E6E0', display: 'flex', flexDirection: 'column' }}>
      {/* Thumbnail area */}
      <div style={{ position: 'relative', background: '#F5F4F0', minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {phase === 'loading' && (
          <span style={{ position: 'absolute', fontSize: 9, letterSpacing: '0.12em', color: '#CCC', fontWeight: 700 }}>CARGANDO…</span>
        )}
        {phase === 'error' && (
          <div style={{ position: 'absolute', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#C00', letterSpacing: '0.05em', marginBottom: 4 }}>PDF</div>
            <div style={{ fontSize: 9, color: '#CCC', letterSpacing: '0.06em' }}>SIN VISTA PREVIA</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 'auto', display: 'block', opacity: phase === 'done' ? 1 : 0, transition: 'opacity 0.3s' }}
        />
      </div>
      {/* Info + button */}
      <div style={{ padding: '12px 14px 14px' }}>
        <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayName}>
          {displayName}
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 10, color: '#BBB' }}>PDF · {formatBytes(doc.size_bytes)}</p>
        <button onClick={handleDownload} disabled={downloading} style={{ width: '100%', padding: '8px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#1A1A1A', color: '#fff', fontFamily: 'inherit' }}>
          {downloading ? '…' : 'Descargar'}
        </button>
      </div>
    </div>
  )
}

// ── Photo Carousel ────────────────────────────────────────────────────────────

function PhotoCarousel({ photos, token }: { photos: PortalDoc[]; token: string }) {
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (photos.length === 0) return
    Promise.all(
      photos.map(async d => {
        const url = await getDocUrl(token, d.storage_path)
        return [d.id, url ?? ''] as const
      })
    ).then(entries => setUrls(Object.fromEntries(entries.filter(([, u]) => u))))
  }, [photos, token])

  if (photos.length === 0) return null

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>Fotografías</p>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
        {photos.map(d => (
          <div key={d.id} style={{ flexShrink: 0, width: 'min(85vw, 340px)', height: 230, borderRadius: 10, overflow: 'hidden', scrollSnapAlign: 'start', background: '#F0EEE8', position: 'relative' }}>
            {urls[d.id] ? (
              <img src={urls[d.id]} alt={d.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, color: '#CCC', letterSpacing: '0.1em' }}>CARGANDO…</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Featured Video ────────────────────────────────────────────────────────────

function VideoFeatured({ doc, token }: { doc: PortalDoc; token: string }) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const handleLoad = async () => {
    setPhase('loading')
    const url = await getDocUrl(token, doc.storage_path)
    if (!url) { setPhase('error'); return }
    setVideoUrl(url)
    setPhase('ready')
  }

  if (phase === 'idle') {
    return (
      <div
        onClick={handleLoad}
        style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#111', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}
      >
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {/* Play button */}
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '17px solid rgba(255,255,255,0.85)', marginLeft: 4 }} />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Reproducir vídeo</p>
          <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{doc.nombre}</p>
        </div>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div style={{ width: '100%', paddingTop: '56.25%', background: '#111', borderRadius: 12, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>Cargando vídeo…</span>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={{ padding: '20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#DC2626' }}>Error al cargar el vídeo</p>
      </div>
    )
  }

  return (
    <video
      src={videoUrl!}
      controls
      autoPlay
      style={{ width: '100%', borderRadius: 12, background: '#000', display: 'block', maxHeight: 480 }}
    />
  )
}

// ── Floorfy / Virtual Tour Embed ──────────────────────────────────────────────

function FloorfyEmbed({ url }: { url: string }) {
  return (
    <div>
      <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
        Recorrido virtual 360°
      </p>
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E8E6E0', background: '#111', position: 'relative', paddingTop: '56.25%' }}>
        <iframe
          src={url}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"
          allowFullScreen
          title="Recorrido virtual 360°"
        />
      </div>
    </div>
  )
}

// ── Generic Doc Row (for non-image, non-pdf, non-video docs) ──────────────────

function DocRow({ doc, token }: { doc: PortalDoc; token: string }) {
  const [downloading, setDownloading] = useState(false)
  const ext = doc.nombre.split('.').pop()?.toUpperCase() ?? 'FILE'

  const handleDownload = async () => {
    setDownloading(true)
    const url = await getDocUrl(token, doc.storage_path)
    setDownloading(false)
    if (url) window.open(url, '_blank')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid #E8E6E0', background: '#fff' }}>
      <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '3px 7px', borderRadius: 4, background: '#EDE9FE', color: '#5B21B6' }}>{ext}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nombre}</p>
        <p style={{ margin: 0, fontSize: 10, color: '#BBB', marginTop: 1 }}>{formatBytes(doc.size_bytes)}</p>
      </div>
      <button onClick={handleDownload} disabled={downloading} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 5, border: 'none', cursor: 'pointer', background: '#1A1A1A', color: '#fff', fontFamily: 'inherit', flexShrink: 0 }}>
        {downloading ? '…' : 'Descargar'}
      </button>
    </div>
  )
}

// ── Main Portal ───────────────────────────────────────────────────────────────

export default function PortalPage({
  token,
  partner,
  project,
  tender,
  projectUnits,
  documents,
  existingBid,
  isReadOnly,
  initialQuestions,
  renderUrls = [],
  tourVirtualUrl = null,
  phaseStartDates = {},
}: {
  token: string
  partner: Partner
  project: Project
  tender: Tender
  projectUnits: ProjectUnit[]
  documents: PortalDoc[]
  existingBid: ExistingBid | null
  isReadOnly: boolean
  initialQuestions: PortalQuestion[]
  renderUrls?: string[]
  tourVirtualUrl?: string | null
  phaseStartDates?: Record<string, string>   // phaseId → ISO date string
}) {
  // ── Tab + scroll ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const tabSectionRef = useRef<HTMLDivElement>(null)

  const goToTab = (tab: ActiveTab) => {
    setActiveTab(tab)
    setTimeout(() => {
      tabSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  // ── Bid state ─────────────────────────────────────────────────────────────
  const initPrices = (): Record<string, number> => {
    const m: Record<string, number> = {}
    for (const unit of projectUnits) {
      for (const li of unit.line_items) {
        const existing = existingBid?.line_items.find(b => b.project_line_item_id === li.id)
        m[li.id] = existing?.precio_unitario ?? 0
      }
    }
    return m
  }

  const initPhaseDays = (): Record<string, number> => {
    const m: Record<string, number> = {}
    for (const unit of projectUnits) {
      for (const phase of unit.template_unit?.phases ?? []) {
        const key = `${unit.id}_${phase.id}`
        const existing = existingBid?.phase_durations?.find(
          pd => pd.project_unit_id === unit.id && pd.template_phase_id === phase.id
        )
        m[key] = existing?.duracion_dias ?? 0
      }
    }
    return m
  }

  const [prices, setPrices]           = useState<Record<string, number>>(initPrices)
  const [phaseDays, setPhaseDays]     = useState<Record<string, number>>(initPhaseDays)
  const [bidNotas, setBidNotas]       = useState(existingBid?.notas ?? '')
  const [submitting, setSubmitting]   = useState(false)
  const [submitted, setSubmitted]     = useState(existingBid?.status === 'submitted' || existingBid?.status === 'accepted')
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Q&A state ─────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<PortalQuestion[]>(initialQuestions)
  const [newQuestion, setNewQ]    = useState('')
  const [askingQ, setAskingQ]     = useState(false)
  const [askError, setAskError]   = useState<string | null>(null)

  // ── Computed ──────────────────────────────────────────────────────────────
  const total = useMemo(() => {
    let sum = 0
    for (const unit of projectUnits)
      for (const li of unit.line_items)
        sum += (prices[li.id] ?? 0) * li.cantidad
    return sum
  }, [prices, projectUnits])

  const generalDocs = documents.filter(d => !d.project_unit_id)
  const unitDocs    = documents.filter(d => !!d.project_unit_id)

  // Partition general docs by type
  const videoDocs = generalDocs.filter(d => isVideo(d.mime_type, d.nombre))
  const photoDocs = generalDocs.filter(d => isImage(d.mime_type, d.nombre))
  const pdfDocs   = generalDocs.filter(d => isPdf(d.mime_type, d.nombre))
  const otherDocs = generalDocs.filter(d => !isVideo(d.mime_type, d.nombre) && !isImage(d.mime_type, d.nombre) && !isPdf(d.mime_type, d.nombre))

  const deadline      = tender.fecha_limite
  const deadlinePassed = new Date(deadline) < new Date()

  // ── Submit bid ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true); setSubmitError(null)

    const line_items = projectUnits
      .flatMap(u => u.line_items)
      .filter(li => (prices[li.id] ?? 0) > 0)
      .map(li => ({ project_line_item_id: li.id, precio_unitario: prices[li.id], notas: null }))

    if (line_items.length === 0) {
      setSubmitError('Introduce al menos un precio antes de enviar la oferta.')
      setSubmitting(false)
      return
    }

    const phase_durations = projectUnits.flatMap(u =>
      (u.template_unit?.phases ?? [])
        .map(ph => ({ template_phase_id: ph.id, project_unit_id: u.id, duracion_dias: phaseDays[`${u.id}_${ph.id}`] ?? 0 }))
        .filter(pd => pd.duracion_dias > 0)
    )

    const res  = await fetch('/api/fpe-portal/bid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, notas: bidNotas || null, line_items, phase_durations }) })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok || json.error) { setSubmitError(json.error ?? 'Error enviando la oferta.'); return }
    setSubmitted(true)
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const sectionLabel: React.CSSProperties = { margin: '0 0 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#AAA' }
  const inputStyle:   React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #E8E6E0', borderRadius: 5, fontFamily: 'inherit', color: '#1A1A1A', background: '#fff', outline: 'none', boxSizing: 'border-box' }
  const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical' }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#F8F7F4', minHeight: '100vh' }}>

      {/* ── Hero ── */}
      <HeroSection
        renderUrls={renderUrls}
        partner={partner}
        project={project}
        tender={tender}
        onGoToTab={goToTab}
        tabSectionRef={tabSectionRef}
      />

      {/* ── Sticky tab bar ── */}
      <div
        ref={tabSectionRef}
        style={{ position: 'sticky', top: 0, zIndex: 100, background: '#1A1A1A', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {([
            ['overview', 'Proyecto'],
            ['docs',     `Documentación${documents.length > 0 ? ` (${documents.length})` : ''}`],
            ['bid',      submitted ? 'Oferta enviada' : 'Mi Oferta'],
            ['qa',       `Preguntas${questions.length > 0 ? ` (${questions.length})` : ''}`],
          ] as [ActiveTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '14px 18px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                borderBottom: activeTab === tab ? '2px solid #D85A30' : '2px solid transparent',
                color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.38)',
                letterSpacing: '0.01em',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* ── Partner info bar ── */}
      <div style={{ background: '#F0EEE8', borderBottom: '1px solid #E8E6E0', padding: '8px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#666' }}>Invitado como: <strong>{partner.nombre}</strong></span>
          <span style={{ color: '#D0CECA' }}>·</span>
          <span style={{ fontSize: 11, color: '#666' }}>
            Fecha límite: <strong>{new Date(deadline).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
          </span>
          {(isReadOnly || submitted) && (
            <>
              <span style={{ color: '#D0CECA' }}>·</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#D1FAE5', color: '#065F46' }}>Oferta enviada</span>
            </>
          )}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* ───────────────────────── PROYECTO TAB ─────────────────────────── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <TabIntro>
              Aquí tienes toda la información sobre la obra y las unidades de ejecución incluidas en tu licitación.
              Revísalas con calma — son la base sobre la que construirás tu oferta.
              Si algo no queda claro, puedes hacernos una consulta desde la pestaña de Preguntas.
            </TabIntro>

            {/* Map */}
            {(project.direccion || project.ciudad) && (
              <MapCard address={[project.direccion, project.ciudad].filter(Boolean).join(', ')} height={240} />
            )}

            {/* Project info */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E6E0', padding: '20px 22px' }}>
              <p style={sectionLabel}>Información del proyecto</p>
              <dl style={{ margin: 0, display: 'grid', gap: '12px 0' }}>
                {[
                  ['Proyecto',   project.nombre],
                  project.ciudad       ? ['Ciudad',     project.ciudad]       : null,
                  project.direccion    ? ['Dirección',  project.direccion]    : null,
                  project.descripcion  ? ['Descripción', project.descripcion] : null,
                  tender.descripcion   ? ['Licitación', tender.descripcion]   : null,
                  ['Fecha límite', new Date(deadline).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })],
                ].filter((item): item is string[] => Boolean(item)).map(([label, val]) => (
                  <div key={label as string} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                    <dt style={{ flexShrink: 0, width: 90, color: '#AAA', fontWeight: 500 }}>{label}</dt>
                    <dd style={{ margin: 0, color: '#1A1A1A', lineHeight: 1.5 }}>{val}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Execution units */}
            <div>
              <p style={sectionLabel}>Unidades de ejecución en el scope</p>
              {projectUnits.length === 0 ? (
                <p style={{ fontSize: 13, color: '#AAA' }}>No hay unidades definidas.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {projectUnits.map(unit => (
                    <div key={unit.id} style={{ borderRadius: 10, border: '1px solid #E8E6E0', overflow: 'hidden', background: '#fff' }}>
                      <div style={{ background: '#1A1A1A', padding: '12px 16px' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>{unit.template_unit?.nombre ?? 'Unidad'}</p>
                        {unit.template_unit?.descripcion && (
                          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{unit.template_unit.descripcion}</p>
                        )}
                      </div>
                      {unit.line_items.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #F0EEE8' }}>
                              <th style={{ padding: '7px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'left' }}>Partida</th>
                              <th style={{ padding: '7px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right', width: 80 }}>Cant.</th>
                              <th style={{ padding: '7px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', width: 50 }}>Ud.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {unit.line_items.map((li, i) => (
                              <tr key={li.id} style={{ borderBottom: '1px solid #F0EEE8', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                                <td style={{ padding: '9px 14px', fontSize: 12, color: '#333' }}>{li.template_line_item?.nombre ?? '—'}</td>
                                <td style={{ padding: '9px 14px', fontSize: 12, color: '#555', textAlign: 'right', fontFamily: 'monospace' }}>{li.cantidad}</td>
                                <td style={{ padding: '9px 14px', fontSize: 11, color: '#888', fontWeight: 600 }}>{li.template_line_item?.unidad_medida ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Phase start dates */}
                      {(() => {
                        const phases = unit.template_unit?.phases ?? []
                        const phasesWithDates = phases
                          .filter(ph => phaseStartDates[ph.id])
                          .sort((a, b) => a.orden - b.orden)
                        if (phasesWithDates.length === 0) return null
                        return (
                          <div style={{ borderTop: '1px solid #F0EEE8', padding: '12px 16px', background: '#FAFAF8' }}>
                            <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA' }}>
                              Fechas estimadas de inicio
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {phasesWithDates.map(ph => (
                                <div key={ph.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                  <span style={{ fontSize: 12, color: '#555' }}>{ph.nombre}</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#D85A30', fontFamily: 'monospace', flexShrink: 0 }}>
                                    {new Date(phaseStartDates[ph.id]).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CTA to docs */}
            {documents.length > 0 && (
              <div style={{ background: '#1A1A1A', borderRadius: 12, padding: '24px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#fff' }}>Documentación disponible</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{documents.length} {documents.length === 1 ? 'archivo' : 'archivos'} — renders, planos y más</p>
                </div>
                <button
                  onClick={() => goToTab('docs')}
                  style={{ padding: '11px 22px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#D85A30', color: '#fff', fontFamily: 'inherit', flexShrink: 0 }}
                >
                  Ver documentación
                </button>
              </div>
            )}

            {/* Virtual tour embed */}
            {tourVirtualUrl && <FloorfyEmbed url={tourVirtualUrl} />}
          </div>
        )}

        {/* ─────────────────────── DOCUMENTACIÓN TAB ──────────────────────── */}
        {activeTab === 'docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <TabIntro>
              Hemos preparado toda la documentación del proyecto para que puedas valorarlo en detalle: vídeos del estado actual, fotografías, planos y renders.
              Si necesitas algo adicional o algo no está claro, consúltanos en la sección de Preguntas.
            </TabIntro>
            {documents.length === 0 && !tourVirtualUrl && (
              <p style={{ fontSize: 13, color: '#AAA', textAlign: 'center', padding: '48px 0' }}>No hay documentación disponible por el momento.</p>
            )}

            {/* Virtual tour embed */}
            {tourVirtualUrl && <FloorfyEmbed url={tourVirtualUrl} />}

            {/* Featured video */}
            {videoDocs.length > 0 && (
              <div>
                <p style={sectionLabel}>Vídeo del proyecto</p>
                <VideoFeatured doc={videoDocs[0]} token={token} />
                {videoDocs.slice(1).map(d => (
                  <div key={d.id} style={{ marginTop: 10 }}>
                    <VideoFeatured doc={d} token={token} />
                  </div>
                ))}
              </div>
            )}

            {/* Photo carousel */}
            {photoDocs.length > 0 && (
              <PhotoCarousel photos={photoDocs} token={token} />
            )}

            {/* PDF grid */}
            {pdfDocs.length > 0 && (
              <div>
                <p style={sectionLabel}>Planos y documentos PDF</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
                  {pdfDocs.map(d => <PdfCard key={d.id} doc={d} token={token} />)}
                </div>
              </div>
            )}

            {/* Other docs */}
            {otherDocs.length > 0 && (
              <div>
                <p style={sectionLabel}>Otros archivos</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {otherDocs.map(d => <DocRow key={d.id} doc={d} token={token} />)}
                </div>
              </div>
            )}

            {/* Unit docs */}
            {unitDocs.length > 0 && (
              <div>
                <p style={sectionLabel}>Documentación por unidad</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {unitDocs.map(d => <DocRow key={d.id} doc={d} token={token} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────── MI OFERTA TAB ─────────────────────────── */}
        {activeTab === 'bid' && (
          <div>
            <TabIntro>
              Introduce el precio unitario para cada partida — el total se calcula automáticamente.
              Puedes guardar un borrador y volver a ajustarlo cuando quieras antes de la fecha límite.
              Solo cuenta la versión que envíes definitivamente, así que tómate el tiempo que necesites.
            </TabIntro>
            {submitted || isReadOnly ? (
              <div>
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#065F46' }}>Oferta enviada</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#059669' }}>
                    {existingBid?.submitted_at
                      ? `Enviada el ${new Date(existingBid.submitted_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : 'Oferta registrada.'}
                  </p>
                </div>
                <p style={sectionLabel}>Detalle de la oferta</p>
                {projectUnits.map(unit => {
                  const unitPhaseDurations = (existingBid?.phase_durations ?? []).filter(pd => pd.project_unit_id === unit.id)
                  return (
                    <div key={unit.id} style={{ marginBottom: 20 }}>
                      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#555' }}>{unit.template_unit?.nombre}</p>
                      <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: 8, overflow: 'hidden', border: '1px solid #E8E6E0' }}>
                        <thead>
                          <tr style={{ background: '#F8F7F4' }}>
                            <th style={{ padding: '7px 12px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'left' }}>Partida</th>
                            <th style={{ padding: '7px 12px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right' }}>Ud.</th>
                            <th style={{ padding: '7px 12px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right' }}>P/Ud</th>
                            <th style={{ padding: '7px 12px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unit.line_items.map((li, i) => {
                            const p = prices[li.id] ?? 0
                            return (
                              <tr key={li.id} style={{ borderBottom: '1px solid #F0EEE8', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                                <td style={{ padding: '9px 12px', fontSize: 12, color: '#333' }}>{li.template_line_item?.nombre}</td>
                                <td style={{ padding: '9px 12px', fontSize: 12, color: '#888', textAlign: 'right' }}>{li.cantidad} {li.template_line_item?.unidad_medida}</td>
                                <td style={{ padding: '9px 12px', fontSize: 12, textAlign: 'right', fontFamily: 'monospace' }}>{formatEur(p)}</td>
                                <td style={{ padding: '9px 12px', fontSize: 12, textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>{formatEur(p * li.cantidad)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {unitPhaseDurations.length > 0 && (
                        <div style={{ marginTop: 8, padding: '10px 14px', background: '#F0F7FF', borderRadius: 6, border: '1px solid #BAD7F2' }}>
                          <p style={{ margin: '0 0 7px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4A90C0' }}>Plazos propuestos</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {[...(unit.template_unit?.phases ?? [])].sort((a, b) => a.orden - b.orden).map(ph => {
                              const pd = unitPhaseDurations.find(d => d.template_phase_id === ph.id)
                              if (!pd) return null
                              return (
                                <span key={ph.id} style={{ fontSize: 11, padding: '3px 9px', background: '#fff', borderRadius: 20, color: '#1A1A1A', border: '1px solid #BAD7F2' }}>
                                  {ph.nombre}: <strong style={{ color: '#0369A1' }}>{pd.duracion_dias}d</strong>
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ textAlign: 'right', padding: '14px 0', borderTop: '2px solid #1A1A1A', marginTop: 8 }}>
                  <span style={{ fontSize: 13, color: '#AAA', marginRight: 16 }}>Total oferta</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', fontFamily: 'monospace' }}>{formatEur(total)}</span>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                  Introduce el precio unitario para cada partida. El total se calcula automáticamente.
                </p>
                {projectUnits.map(unit => (
                  <div key={unit.id} style={{ marginBottom: 24 }}>
                    <div style={{ background: '#1A1A1A', padding: '10px 16px', borderRadius: '8px 8px 0 0' }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>{unit.template_unit?.nombre}</p>
                    </div>
                    <div style={{ border: '1px solid #E8E6E0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#F8F7F4', borderBottom: '1px solid #E8E6E0' }}>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'left' }}>Partida</th>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right', width: 70 }}>Cant.</th>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', width: 40 }}>Ud.</th>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right', width: 130 }}>Precio/ud (€)</th>
                            <th style={{ padding: '8px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', textAlign: 'right', width: 110 }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unit.line_items.map((li, i) => {
                            const p = prices[li.id] ?? 0
                            return (
                              <tr key={li.id} style={{ borderBottom: '1px solid #F0EEE8', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                                <td style={{ padding: '10px 14px', fontSize: 12, color: '#333' }}>{li.template_line_item?.nombre}</td>
                                <td style={{ padding: '10px 14px', fontSize: 12, color: '#555', textAlign: 'right', fontFamily: 'monospace' }}>{li.cantidad}</td>
                                <td style={{ padding: '10px 14px', fontSize: 11, color: '#888', fontWeight: 600 }}>{li.template_line_item?.unidad_medida}</td>
                                <td style={{ padding: '6px 14px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                                    <input
                                      type="number" min={0} step="0.01" value={p || ''} placeholder="0,00"
                                      onChange={e => setPrices(prev => ({ ...prev, [li.id]: parseFloat(e.target.value) || 0 }))}
                                      style={{ width: 100, padding: '6px 8px', fontSize: 13, border: `1px solid ${p > 0 ? '#378ADD' : '#E8E6E0'}`, borderRadius: 5, fontFamily: 'monospace', color: '#1A1A1A', background: p > 0 ? '#F0F7FF' : '#fff', outline: 'none', textAlign: 'right' }}
                                    />
                                    <span style={{ fontSize: 11, color: '#AAA' }}>€</span>
                                  </div>
                                </td>
                                <td style={{ padding: '10px 14px', fontSize: 12, textAlign: 'right', fontWeight: 600, color: p > 0 ? '#1A1A1A' : '#DDD', fontFamily: 'monospace' }}>
                                  {p > 0 ? formatEur(p * li.cantidad) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {(unit.template_unit?.phases?.length ?? 0) > 0 && (
                        <div style={{ padding: '14px 16px', borderTop: '1px solid #E8E6E0', background: '#F8F7F4' }}>
                          <p style={{ margin: '0 0 10px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888' }}>Plazos de ejecución (días laborales)</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {[...(unit.template_unit?.phases ?? [])].sort((a, b) => a.orden - b.orden).map(phase => {
                              const key  = `${unit.id}_${phase.id}`
                              const days = phaseDays[key] ?? 0
                              return (
                                <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ flex: 1, fontSize: 12, color: '#444' }}>{phase.nombre}</span>
                                  {phase.lead_time_days != null && <span style={{ fontSize: 10, color: '#BBB', flexShrink: 0 }}>Ref: {phase.lead_time_days}d</span>}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                    <input type="number" min={1} value={days || ''} placeholder="0" onChange={e => setPhaseDays(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} style={{ width: 60, padding: '5px 8px', fontSize: 13, border: `1px solid ${days > 0 ? '#378ADD' : '#E8E6E0'}`, borderRadius: 5, fontFamily: 'monospace', color: '#1A1A1A', background: days > 0 ? '#F0F7FF' : '#fff', outline: 'none', textAlign: 'right' }} />
                                    <span style={{ fontSize: 11, color: '#AAA' }}>días</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, padding: '20px 22px', marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>Total estimado</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: total > 0 ? '#1A1A1A' : '#DDD', fontFamily: 'monospace' }}>{formatEur(total)}</span>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', display: 'block', marginBottom: 6 }}>Notas o condicionantes</label>
                    <textarea rows={3} value={bidNotas} onChange={e => setBidNotas(e.target.value)} placeholder="Condicionantes, exclusiones, plazos especiales…" style={textareaStyle} />
                  </div>
                  {submitError && (
                    <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{submitError}</div>
                  )}
                  <button onClick={handleSubmit} disabled={submitting || deadlinePassed} style={{ width: '100%', padding: '13px', fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 7, cursor: submitting || deadlinePassed ? 'default' : 'pointer', background: '#1A1A1A', color: '#fff', fontFamily: 'inherit', opacity: deadlinePassed ? 0.5 : 1 }}>
                    {submitting ? 'Enviando oferta…' : deadlinePassed ? 'Plazo finalizado' : 'Enviar oferta'}
                  </button>
                  <p style={{ margin: '10px 0 0', fontSize: 11, color: '#AAA', textAlign: 'center' }}>Podrás actualizar tu oferta hasta la fecha límite.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────── PREGUNTAS TAB ───────────────────────── */}
        {activeTab === 'qa' && (
          <div>
            <TabIntro>
              ¿Tienes dudas sobre el alcance, los planos o cualquier aspecto de la licitación? Mándanos tu consulta y nuestro equipo te responderá
              lo antes posible. Las respuestas son visibles para todos los participantes, así que también puedes revisar si alguien ya ha preguntado algo similar.
            </TabIntro>
            {questions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {questions.map(q => (
                  <div key={q.id} style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', background: '#F8F7F4' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>Participante</span>
                        <span style={{ fontSize: 10, color: '#BBB' }}>{new Date(q.asked_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#1A1A1A', lineHeight: 1.5 }}>{q.pregunta}</p>
                    </div>
                    {q.respuesta ? (
                      <div style={{ padding: '12px 16px', borderTop: '1px solid #E8E6E0' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#AAA' }}>Respuesta · Forma Prima</p>
                        <p style={{ margin: 0, fontSize: 13, color: '#333', lineHeight: 1.5 }}>{q.respuesta}</p>
                      </div>
                    ) : (
                      <div style={{ padding: '10px 16px', background: '#FFFBEB', borderTop: '1px solid #FDE68A' }}>
                        <span style={{ fontSize: 11, color: '#92400E' }}>Pendiente de respuesta…</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!isReadOnly && (
              <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, padding: '20px 22px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Enviar una consulta</p>
                <textarea rows={3} value={newQuestion} onChange={e => setNewQ(e.target.value)} placeholder="Escribe tu pregunta sobre el proyecto o la licitación…" style={{ ...textareaStyle, marginBottom: 12 }} />
                {askError && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#DC2626' }}>{askError}</p>}
                <button
                  onClick={async () => {
                    const text = newQuestion.trim()
                    if (!text) return
                    setAskingQ(true); setAskError(null)
                    const res  = await fetch('/api/fpe-portal/question', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, pregunta: text }) })
                    const json = await res.json()
                    setAskingQ(false)
                    if (!res.ok || json.error) { setAskError(json.error ?? 'Error enviando la pregunta.'); return }
                    setQuestions(prev => [...prev, json.question])
                    setNewQ('')
                  }}
                  disabled={!newQuestion.trim() || askingQ}
                  style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#1A1A1A', color: '#fff', fontFamily: 'inherit', opacity: !newQuestion.trim() ? 0.4 : 1 }}
                >
                  {askingQ ? 'Enviando…' : 'Enviar consulta'}
                </button>
              </div>
            )}
            {questions.length === 0 && isReadOnly && (
              <p style={{ fontSize: 13, color: '#AAA', textAlign: 'center', padding: '48px 0' }}>No hay preguntas en esta licitación.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
