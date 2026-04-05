'use client'

import { useState, useMemo } from 'react'
import { enviarOferta } from '@/app/actions/fp-licitacion'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileRef { id: string; name: string; path?: string }
interface Zona { pdf: FileRef | null; dwg: FileRef | null; textFile: FileRef | null }
interface ScopeCapitulo {
  id: string; numero: number; nombre: string
  subcapitulos: { id: string; nombre: string }[]
  zonas: Zona[]
}
interface Scope {
  projectNombre: string; projectDireccion: string; projectDescripcion: string
  fechaLimite: string; textoInvitacion: string
  generalFiles: FileRef[]
  capitulos: ScopeCapitulo[]
}

interface Partida {
  id: string; descripcion: string; unidad: string; cantidad: number; precio_unitario: number
}
interface SubcapOferta {
  subcapId: string; subcapNombre: string; partidas: Partida[]
}
interface CapituloOferta {
  capituloId: string; capituloNombre: string; subcapitulos: SubcapOferta[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function subtotalSubcap(sub: SubcapOferta): number {
  return sub.partidas.reduce((s, p) => s + p.cantidad * p.precio_unitario, 0)
}
function totalCapitulo(cap: CapituloOferta): number {
  return cap.subcapitulos.reduce((s, sub) => s + subtotalSubcap(sub), 0)
}
function grandTotal(lineas: CapituloOferta[]): number {
  return lineas.reduce((s, c) => s + totalCapitulo(c), 0)
}
function fmt(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}
function newPartida(): Partida {
  return { id: crypto.randomUUID(), descripcion: '', unidad: 'ud', cantidad: 1, precio_unitario: 0 }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  border: '1px solid #E8E6E0', background: '#fff', padding: '7px 10px',
  fontSize: 12, color: '#1A1A1A', fontWeight: 300, outline: 'none',
  borderRadius: 3, boxSizing: 'border-box',
}

// ─── FileLink ─────────────────────────────────────────────────────────────────

function FileLink({ file, signedUrls }: { file: FileRef; signedUrls: Record<string, string> }) {
  const url = file.path ? signedUrls[file.path] : undefined
  const ext = file.name.split('.').pop()?.toUpperCase() ?? '?'
  return (
    <a
      href={url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
        border: '1px solid #E8E6E0', borderRadius: 4, textDecoration: 'none',
        background: url ? '#fff' : '#F8F7F4', cursor: url ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: 9, background: url ? '#1A1A1A' : '#CCC', color: '#fff', padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ext}</span>
      <span style={{ fontSize: 12, color: url ? '#1A1A1A' : '#BBB' }}>{file.name}</span>
    </a>
  )
}

// ─── PartidaRow ───────────────────────────────────────────────────────────────

function PartidaRow({ partida, onChange, onRemove }: {
  partida: Partida
  onChange: (p: Partida) => void
  onRemove: () => void
}) {
  const total = partida.cantidad * partida.precio_unitario
  const s = (field: keyof Partida) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = ['cantidad', 'precio_unitario'].includes(field) ? parseFloat(e.target.value) || 0 : e.target.value
    onChange({ ...partida, [field]: val })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 100px 90px 28px', gap: 6, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F8F7F4' }}>
      <input value={partida.descripcion} onChange={s('descripcion')} placeholder="Descripción de la partida" style={{ ...inputSt, width: '100%' }} />
      <input value={partida.unidad} onChange={s('unidad')} placeholder="ud" style={{ ...inputSt, width: '100%', textAlign: 'center' }} />
      <input type="number" value={partida.cantidad} onChange={s('cantidad')} min={0} style={{ ...inputSt, width: '100%', textAlign: 'right' }} />
      <input type="number" value={partida.precio_unitario} onChange={s('precio_unitario')} min={0} step="0.01" placeholder="0,00" style={{ ...inputSt, width: '100%', textAlign: 'right' }} />
      <span style={{ fontSize: 12, color: '#333', fontWeight: 400, textAlign: 'right' }}>{fmt(total)}</span>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, textAlign: 'center' }}>×</button>
    </div>
  )
}

// ─── SubcapSection ────────────────────────────────────────────────────────────

function SubcapSection({ subcap, onChange }: {
  subcap: SubcapOferta; onChange: (s: SubcapOferta) => void
}) {
  const [open, setOpen] = useState(true)
  const subtotal = subtotalSubcap(subcap)

  const updatePartida = (id: string, updated: Partida) =>
    onChange({ ...subcap, partidas: subcap.partidas.map(p => p.id === id ? updated : p) })
  const removePartida = (id: string) =>
    onChange({ ...subcap, partidas: subcap.partidas.filter(p => p.id !== id) })
  const addPartida = () =>
    onChange({ ...subcap, partidas: [...subcap.partidas, newPartida()] })

  return (
    <div style={{ border: '1px solid #F0EEE8', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FAFAF8', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>{subcap.subcapNombre}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: subtotal > 0 ? '#1A1A1A' : '#CCC', fontWeight: subtotal > 0 ? 500 : 300 }}>
            {fmt(subtotal)}
          </span>
          <span style={{ fontSize: 10, color: '#BBB' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '12px 14px' }}>
          {subcap.partidas.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 100px 90px 28px', gap: 6, marginBottom: 4 }}>
                {['Descripción', 'Unidad', 'Cantidad', 'P. unitario', 'Total', ''].map(h => (
                  <span key={h} style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#CCC', fontWeight: 600 }}>{h}</span>
                ))}
              </div>
              {subcap.partidas.map(p => (
                <PartidaRow key={p.id} partida={p} onChange={u => updatePartida(p.id, u)} onRemove={() => removePartida(p.id)} />
              ))}
            </div>
          )}
          <button
            onClick={addPartida}
            style={{ fontSize: 11, color: '#888', background: 'none', border: '1px dashed #D4D0C8', padding: '5px 12px', borderRadius: 3, cursor: 'pointer', width: '100%' }}
          >
            + Añadir partida
          </button>
        </div>
      )}
    </div>
  )
}

// ─── CapituloSection ──────────────────────────────────────────────────────────

function CapituloSection({ cap, zonas, signedUrls, onChange }: {
  cap: CapituloOferta; zonas: Zona[]; signedUrls: Record<string, string>
  onChange: (c: CapituloOferta) => void
}) {
  const [open, setOpen] = useState(true)
  const total = totalCapitulo(cap)

  const updateSubcap = (id: string, updated: SubcapOferta) =>
    onChange({ ...cap, subcapitulos: cap.subcapitulos.map(s => s.subcapId === id ? updated : s) })

  const docs = zonas.flatMap(z => [z.pdf, z.dwg, z.textFile].filter(Boolean) as FileRef[])

  return (
    <div style={{ border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#1A1A1A', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 14, fontWeight: 400, color: '#fff' }}>{cap.capituloNombre}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: total > 0 ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: total > 0 ? 500 : 300 }}>
            {fmt(total)}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: 16 }}>
          {docs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', fontWeight: 600, marginBottom: 8 }}>Documentación</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {docs.map(f => <FileLink key={f.id} file={f} signedUrls={signedUrls} />)}
              </div>
            </div>
          )}
          {cap.subcapitulos.map(sub => (
            <SubcapSection key={sub.subcapId} subcap={sub} onChange={u => updateSubcap(sub.subcapId, u)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main portal ──────────────────────────────────────────────────────────────

interface PortalOfertaProps {
  paqueteId: string
  token: string
  status: string
  scope: Scope
  signedUrls: Record<string, string>
  partner: { id: string; nombre: string; contacto_nombre?: string }
  project: { id: string; nombre: string; cliente?: string; direccion?: string }
  fechaLimite: string | null
  ofertaExistente: { lineas: any[]; total_amount: number; notas?: string } | null
}

export default function PortalOferta({
  paqueteId, token, status, scope, signedUrls, partner, project, fechaLimite, ofertaExistente,
}: PortalOfertaProps) {
  const [section, setSection] = useState<'invitacion' | 'documentos' | 'oferta'>('invitacion')
  const [notas, setNotas] = useState(ofertaExistente?.notas ?? '')
  const [submitted, setSubmitted] = useState(status === 'oferta_recibida')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Init bid lines from scope
  const [lineas, setLineas] = useState<CapituloOferta[]>(() => {
    if (ofertaExistente?.lineas?.length) return ofertaExistente.lineas as CapituloOferta[]
    return scope.capitulos.map(c => ({
      capituloId: c.id,
      capituloNombre: `${c.numero}. ${c.nombre}`,
      subcapitulos: c.subcapitulos.map(s => ({
        subcapId: s.id,
        subcapNombre: s.nombre,
        partidas: [newPartida()],
      })),
    }))
  })

  const total = grandTotal(lineas)
  const updateCap = (id: string, updated: CapituloOferta) =>
    setLineas(prev => prev.map(c => c.capituloId === id ? updated : c))

  const fechaStr = fechaLimite
    ? new Date(fechaLimite).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const handleSubmit = async () => {
    setSaving(true); setSaveError('')
    const result = await enviarOferta({ paqueteId, lineas, totalAmount: total, notas })
    setSaving(false)
    if ('error' in result && result.error) { setSaveError(result.error); return }
    setSubmitted(true)
  }

  const navItem = (key: typeof section, label: string) => (
    <button onClick={() => setSection(key)} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: '10px 20px',
      fontSize: 13, fontWeight: section === key ? 500 : 300,
      color: section === key ? '#1A1A1A' : '#888',
      borderBottom: `2px solid ${section === key ? '#1A1A1A' : 'transparent'}`,
      marginBottom: -1,
    }}>{label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1A1A1A', padding: '0 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: 0, fontWeight: 600 }}>Forma Prima · Proceso de licitación</p>
            <p style={{ fontSize: 16, fontWeight: 300, color: '#fff', margin: '4px 0 0' }}>{scope.projectNombre}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{partner.nombre}</p>
            {fechaStr && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>Fecha límite: {fechaStr}</p>}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8E6E0', padding: '0 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex' }}>
          {navItem('invitacion', 'Invitación')}
          {navItem('documentos', 'Documentación')}
          {navItem('oferta', submitted ? 'Oferta enviada ✓' : 'Tu oferta')}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 40px' }}>

        {/* ── Invitación ─────────────────────────────────────────────────── */}
        {section === 'invitacion' && (
          <div>
            <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6, padding: '36px 40px', marginBottom: 24 }}>
              <p style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', fontWeight: 600, marginBottom: 20 }}>Carta de invitación</p>
              <pre style={{ fontSize: 14, fontWeight: 300, color: '#333', lineHeight: 1.9, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                {scope.textoInvitacion}
              </pre>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setSection('documentos')} style={{ fontSize: 13, padding: '10px 24px', border: '1px solid #E8E6E0', background: '#fff', color: '#555', cursor: 'pointer', borderRadius: 4 }}>
                Ver documentación →
              </button>
              <button onClick={() => setSection('oferta')} style={{ fontSize: 13, padding: '10px 24px', border: 'none', background: '#1A1A1A', color: '#fff', cursor: 'pointer', borderRadius: 4 }}>
                Presentar oferta →
              </button>
            </div>
          </div>
        )}

        {/* ── Documentación ──────────────────────────────────────────────── */}
        {section === 'documentos' && (
          <div>
            {scope.generalFiles.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <p style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', fontWeight: 600, marginBottom: 16 }}>Documentación general del proyecto</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {scope.generalFiles.map(f => <FileLink key={f.id} file={f} signedUrls={signedUrls} />)}
                </div>
              </div>
            )}
            <p style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', fontWeight: 600, marginBottom: 16 }}>Documentación por capítulo</p>
            {scope.capitulos.map(c => {
              const docs = (c.zonas ?? []).flatMap(z => [z.pdf, z.dwg, z.textFile].filter(Boolean) as FileRef[])
              if (docs.length === 0) return null
              return (
                <div key={c.id} style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>{c.numero}. {c.nombre}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 16 }}>
                    {docs.map(f => <FileLink key={f.id} file={f} signedUrls={signedUrls} />)}
                  </div>
                  <div style={{ paddingLeft: 16, marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {c.subcapitulos.map(s => (
                      <span key={s.id} style={{ fontSize: 10, background: '#F0EEE8', color: '#666', padding: '2px 8px', borderRadius: 10 }}>{s.nombre}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Oferta ─────────────────────────────────────────────────────── */}
        {section === 'oferta' && (
          <div>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>✓</div>
                <p style={{ fontSize: 18, fontWeight: 300, color: '#1A1A1A', marginBottom: 8 }}>Oferta enviada correctamente</p>
                <p style={{ fontSize: 13, color: '#888', fontWeight: 300 }}>Nos pondremos en contacto con usted próximamente.</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginTop: 16 }}>Total ofertado: {fmt(total)}</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 200, color: '#1A1A1A', margin: 0 }}>Su oferta económica</h2>
                    <p style={{ fontSize: 12, color: '#AAA', margin: '4px 0 0', fontWeight: 300 }}>
                      Añada las partidas por subcapítulo. Puede añadir tantas como necesite.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: '#AAA', margin: 0 }}>Total</p>
                    <p style={{ fontSize: 22, fontWeight: 300, color: '#1A1A1A', margin: '2px 0 0' }}>{fmt(total)}</p>
                  </div>
                </div>

                {lineas.map(cap => {
                  const scopeCap = scope.capitulos.find(c => c.id === cap.capituloId)
                  return (
                    <CapituloSection
                      key={cap.capituloId}
                      cap={cap}
                      zonas={scopeCap?.zonas ?? []}
                      signedUrls={signedUrls}
                      onChange={u => updateCap(cap.capituloId, u)}
                    />
                  )
                })}

                <div style={{ marginTop: 24, marginBottom: 20 }}>
                  <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', fontWeight: 600, marginBottom: 8, display: 'block' }}>
                    Notas o condiciones adicionales (opcional)
                  </label>
                  <textarea
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    placeholder="Plazos de ejecución, condiciones especiales, observaciones…"
                    style={{ ...inputSt, width: '100%', minHeight: 80, resize: 'vertical' }}
                  />
                </div>

                {saveError && <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 12 }}>{saveError}</p>}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6 }}>
                  <div>
                    <p style={{ fontSize: 12, color: '#AAA', margin: 0 }}>Total de la oferta</p>
                    <p style={{ fontSize: 20, fontWeight: 300, color: '#1A1A1A', margin: '2px 0 0' }}>{fmt(total)}</p>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    style={{
                      fontSize: 13, fontWeight: 500, padding: '12px 28px',
                      border: 'none', background: saving ? '#E8E6E0' : '#1A1A1A',
                      color: saving ? '#AAA' : '#fff', cursor: saving ? 'default' : 'pointer', borderRadius: 4,
                    }}
                  >
                    {saving ? 'Enviando…' : 'Enviar oferta →'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
