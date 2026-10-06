'use client'

// Alta / edición de un lead, y la pantalla de «listo» con el enlace personal y
// el PIN preparados para copiar por separado (WhatsApp o correo).

import { useEffect, useState, type ReactNode } from 'react'
import { actualizarLeadSala, crearLeadSala, type LeadInput } from '@/app/actions/salas'
import { S, btn, input } from './theme'

export const enlacePersonal = (slug: string) => `https://formaprima.es/propuesta/${slug}/acceso`

export function Modal({ titulo, onCerrar, children, ancho = 560 }: { titulo: string; onCerrar: () => void; children: ReactNode; ancho?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onCerrar])
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#1A1A1A55', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '6vh 16px' }}>
      <div style={{ background: S.panel, borderRadius: 10, width: '100%', maxWidth: ancho, boxShadow: '0 24px 64px #0000002e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${S.lineSoft}` }}>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: 'none', border: 0, fontSize: 22, lineHeight: 1, color: S.soft, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  )
}

function Campo({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.soft, marginBottom: 5 }}>
        <span>{label}</span>{hint && <span style={{ color: S.faint }}>{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function LeadForm({ slug, inicial, leadId, onHecho, onCerrar }: {
  slug: string
  inicial?: LeadInput
  leadId?: string
  onHecho: (r: { id: string; pin?: string; nombre: string }) => void
  onCerrar: () => void
}) {
  const [d, setD] = useState<LeadInput>(inicial ?? { nombre: '', empresa: '', email: '', telefono: '', canal: '', notas: '', caducaEn: '' })
  const [error, setError] = useState('')
  const [isGuardando, setIsGuardando] = useState(false)
  const set = (k: keyof LeadInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }))

  const guardar = async () => {
    setError(''); setIsGuardando(true)
    const r = leadId ? await actualizarLeadSala(leadId, d) : await crearLeadSala(slug, d)
    setIsGuardando(false)
    if (!r.ok) { setError(r.error); return }
    onHecho({ id: leadId ?? (r as unknown as { id: string }).id, pin: (r as unknown as { pin?: string }).pin, nombre: d.nombre.trim() })
  }

  return (
    <Modal titulo={leadId ? 'Editar lead' : 'Nuevo lead'} onCerrar={onCerrar}>
      <form onSubmit={(e) => { e.preventDefault(); guardar() }} style={{ display: 'grid', gap: 14 }}>
        <Campo label="Nombre"><input autoFocus value={d.nombre} onChange={set('nombre')} placeholder="Nombre y apellido" style={input} /></Campo>
        <div className="salas-2col" style={{ display: 'grid', gap: 12 }}>
          <Campo label="Empresa" hint="opcional"><input value={d.empresa ?? ''} onChange={set('empresa')} style={input} /></Campo>
          <Campo label="Canal" hint="opcional"><input value={d.canal ?? ''} onChange={set('canal')} placeholder="Agencia, red, evento…" list="salas-canales" style={input} /></Campo>
        </div>
        <datalist id="salas-canales">
          {['Agencia', 'Red personal', 'Evento', 'Inversor', 'Portal inmobiliario', 'Referido'].map((c) => <option key={c} value={c} />)}
        </datalist>
        <div className="salas-2col" style={{ display: 'grid', gap: 12 }}>
          <Campo label="Email" hint="opcional"><input type="email" value={d.email ?? ''} onChange={set('email')} style={input} /></Campo>
          <Campo label="Teléfono" hint="opcional"><input type="tel" value={d.telefono ?? ''} onChange={set('telefono')} style={input} /></Campo>
        </div>
        <Campo label="Caduca el" hint="opcional · sin fecha, no caduca"><input type="date" value={d.caducaEn ?? ''} onChange={set('caducaEn')} style={input} /></Campo>
        <Campo label="Notas" hint="opcional · solo las ve el equipo"><textarea rows={3} value={d.notas ?? ''} onChange={set('notas')} style={{ ...input, resize: 'vertical' }} /></Campo>
        {error && <p role="alert" style={{ color: S.red, fontSize: 13, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onCerrar} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={isGuardando} style={{ ...btn(), opacity: isGuardando ? 0.6 : 1 }}>
            {isGuardando ? 'Guardando…' : leadId ? 'Guardar' : 'Crear lead y PIN'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Copiable({ titulo, texto, grande }: { titulo: string; texto: string; grande?: boolean }) {
  const [ok, setOk] = useState(false)
  return (
    <div style={{ border: `1px solid ${S.line}`, borderRadius: 8, padding: '12px 14px', background: S.bg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: S.soft, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{titulo}</span>
        <button onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1600) } catch { /* sin permiso */ } }} style={{ ...btn('ghost'), padding: '5px 10px', fontSize: 11 }}>
          {ok ? 'Copiado ✓' : 'Copiar'}
        </button>
      </div>
      <div style={{ marginTop: 8, fontSize: grande ? 30 : 13.5, fontWeight: grande ? 300 : 400, letterSpacing: grande ? '0.18em' : 0, fontVariantNumeric: 'tabular-nums', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
        {texto}
      </div>
    </div>
  )
}

/** Tras crear el lead (o renovar su PIN): todo listo para enviar. */
export function PinListo({ slug, proyecto, nombre, pin, onCerrar }: { slug: string; proyecto: string; nombre: string; pin: string; onCerrar: () => void }) {
  const enlace = enlacePersonal(slug)
  const nombrePila = nombre.split(' ')[0]
  const mensaje = `Hola ${nombrePila}, te comparto el dossier de ${proyecto}: ${enlace}\n\nEn un mensaje aparte te paso tu código de acceso.`
  const mensajePin = `Tu código de acceso al dossier de ${proyecto}: ${pin}`
  return (
    <Modal titulo={`PIN de ${nombre}`} onCerrar={onCerrar}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Copiable titulo="PIN" texto={pin} grande />
        <Copiable titulo="Mensaje 1 · enlace" texto={mensaje} />
        <Copiable titulo="Mensaje 2 · PIN" texto={mensajePin} />
        <p style={{ fontSize: 12, color: S.soft, margin: '4px 0 0', lineHeight: 1.5 }}>
          Envía el enlace y el PIN en mensajes separados. Cuando lo abra con su PIN, sus visitas aparecerán con su nombre.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={onCerrar} style={btn()}>Hecho</button></div>
      </div>
    </Modal>
  )
}
