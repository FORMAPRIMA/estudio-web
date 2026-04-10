'use client'

import { useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface FormState {
  nombre_proyecto:        string
  superficie:             string
  tarifa_m2:              string
  fee_base:               string
  fecha:                  string
  ciudad:                 string
  cuestiones_especificas: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #E8E6E0',
  borderRadius: 6, fontSize: 13, color: '#1A1A1A', background: '#fff',
  outline: 'none', boxSizing: 'border-box',
}
const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase' as const, color: '#AAA', marginBottom: 5, display: 'block',
}
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, padding: '20px 24px',
}
const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: '#AAA', margin: '0 0 16px',
}

// ── Email multi-input component ────────────────────────────────────────────────

function EmailList({
  label: lbl,
  required,
  emails,
  onChange,
}: {
  label:    string
  required?: boolean
  emails:   string[]
  onChange: (emails: string[]) => void
}) {
  const update = (i: number, val: string) => {
    const next = [...emails]; next[i] = val; onChange(next)
  }
  const add    = () => onChange([...emails, ''])
  const remove = (i: number) => onChange(emails.filter((_, idx) => idx !== i))

  return (
    <div>
      <label style={label}>{lbl}{required ? ' *' : ''}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {emails.map((email, i) => (
          <div key={i} style={{ display: 'flex', gap: 6 }}>
            <input
              type="email"
              value={email}
              onChange={e => update(i, e.target.value)}
              placeholder="email@ejemplo.com"
              style={{ ...input, flex: 1 }}
            />
            {emails.length > (required ? 1 : 0) && (
              <button
                type="button"
                onClick={() => remove(i)}
                style={{
                  padding: '0 10px', background: 'none', border: '1px solid #FECACA',
                  borderRadius: 6, cursor: 'pointer', color: '#DC2626', fontSize: 14, flexShrink: 0,
                }}
              >×</button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          style={{
            alignSelf: 'flex-start', padding: '6px 12px', background: 'none',
            border: '1px dashed #D0CEC8', borderRadius: 6, cursor: 'pointer',
            fontSize: 11, color: '#888',
          }}
        >+ Añadir destinatario</button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DueDiligenciaPage() {
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<FormState>({
    nombre_proyecto:        'Sierra Bullones',
    superficie:             '531',
    tarifa_m2:              '8',
    fee_base:               '1500',
    fecha:                  today,
    ciudad:                 'Madrid, España',
    cuestiones_especificas: '',
  })

  const [emailTo, setEmailTo]   = useState<string[]>([''])
  const [emailCc, setEmailCc]   = useState<string[]>([])
  const [sending, setSending]   = useState(false)
  const [sendMsg, setSendMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const sup              = parseFloat(form.superficie) || 0
  const tar              = parseFloat(form.tarifa_m2)  || 0
  const feeBase          = parseFloat(form.fee_base)   || 0
  const honorariosVar    = sup * tar
  const honorarios       = honorariosVar + feeBase
  const hito             = honorarios / 2

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const buildPayload = () => ({
    nombre_proyecto:        form.nombre_proyecto.trim() || 'Sin nombre',
    superficie:             sup,
    tarifa_m2:              tar,
    fee_base:               feeBase,
    fecha:                  form.fecha || today,
    ciudad:                 form.ciudad.trim() || 'Madrid',
    cuestiones_especificas: form.cuestiones_especificas.trim() || null,
  })

  const handlePreview = async () => {
    setPreviewing(true)
    try {
      const res = await fetch('/api/due-diligencia/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Error al generar PDF.')
        return
      }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } catch {
      alert('Error de red al previsualizar.')
    } finally {
      setPreviewing(false)
    }
  }

  const handleSend = async () => {
    const validTo = emailTo.map(e => e.trim()).filter(Boolean)
    const validCc = emailCc.map(e => e.trim()).filter(Boolean)
    if (validTo.length === 0) { alert('Introduce al menos un destinatario.'); return }
    if (!confirm(`Enviar propuesta a: ${validTo.join(', ')}?`)) return

    setSending(true)
    setSendMsg(null)
    try {
      const res = await fetch('/api/due-diligencia/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildPayload(), email_to: validTo, email_cc: validCc }),
      })
      const j = await res.json()
      if (j.ok) {
        setSendMsg({ ok: true, text: `Propuesta enviada correctamente a ${validTo.join(', ')}.` })
      } else {
        setSendMsg({ ok: false, text: j.error ?? 'Error al enviar.' })
      }
    } catch {
      setSendMsg({ ok: false, text: 'Error de red.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 16px', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>
          Captación
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 300, color: '#1A1A1A', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          Due Diligence Técnica
        </h1>
        <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
          Genera y envía propuestas de DD Técnica No Invasiva en formato PDF.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>

        {/* ── Datos del activo ───────────────────────────────────────────────── */}
        <div style={card}>
          <p style={sectionTitle}>Datos del activo</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>Nombre del proyecto / activo *</label>
              <input style={input} value={form.nombre_proyecto} onChange={set('nombre_proyecto')} placeholder="Sierra Bullones" />
            </div>

            <div>
              <label style={label}>Ciudad / ubicación</label>
              <input style={input} value={form.ciudad} onChange={set('ciudad')} placeholder="Madrid, España" />
            </div>

            <div>
              <label style={label}>Fecha de propuesta</label>
              <input style={input} type="date" value={form.fecha} onChange={set('fecha')} />
            </div>

            <div>
              <label style={label}>Superficie a analizar (m²) *</label>
              <input style={input} type="number" min="1" value={form.superficie} onChange={set('superficie')} placeholder="531" />
            </div>

            <div>
              <label style={label}>Tarifa variable (€/m²)</label>
              <input style={input} type="number" min="1" step="0.5" value={form.tarifa_m2} onChange={set('tarifa_m2')} placeholder="8" />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>
                Fee base — Movilización, Coordinación Técnica y Estructuración de Informe (€)
              </label>
              <input style={input} type="number" min="0" step="100" value={form.fee_base} onChange={set('fee_base')} placeholder="1500" />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label}>Cuestiones específicas del proyecto <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 9 }}>(opcional — aparece en el PDF como caja destacada)</span></label>
              <textarea
                style={{ ...input, height: 90, resize: 'vertical', lineHeight: '1.5' } as React.CSSProperties}
                value={form.cuestiones_especificas}
                onChange={set('cuestiones_especificas')}
                placeholder="Ej: El activo se destina a régimen de hold/renta. Se requiere especial atención a instalaciones de climatización y estado de fachadas."
              />
            </div>

          </div>
        </div>

        {/* ── Resumen de honorarios ──────────────────────────────────────────── */}
        <div style={{ ...card, background: '#F8F7F4' }}>
          <p style={sectionTitle}>Resumen de honorarios</p>
          <div style={{ display: 'flex', gap: 0 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: '#AAA', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fee variable</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>{sup > 0 && tar > 0 ? fmtEur(honorariosVar) : '—'}</p>
              <p style={{ fontSize: 10, color: '#CCC', margin: '2px 0 0' }}>{sup > 0 && tar > 0 ? `${sup} m² × ${fmtEur(tar)}` : ''}</p>
            </div>
            <div style={{ flex: 1, borderLeft: '1px solid #E8E6E0', paddingLeft: 20 }}>
              <p style={{ fontSize: 10, color: '#AAA', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fee base</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>{feeBase > 0 ? fmtEur(feeBase) : '—'}</p>
              <p style={{ fontSize: 10, color: '#CCC', margin: '2px 0 0' }}>Movilización + coord.</p>
            </div>
            <div style={{ flex: 1.3, borderLeft: '1px solid #E8E6E0', paddingLeft: 20 }}>
              <p style={{ fontSize: 10, color: '#AAA', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total honorarios</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#D85A30', margin: 0 }}>{honorarios > 0 ? fmtEur(honorarios) : '—'}</p>
            </div>
          </div>
          {honorarios > 0 && (
            <p style={{ fontSize: 11, color: '#AAA', marginTop: 10, marginBottom: 0 }}>
              Pago en 2 hitos: {fmtEur(hito)} a la aceptación + {fmtEur(hito)} a la entrega del informe. IVA no incluido.
            </p>
          )}
        </div>

        {/* ── Envío ─────────────────────────────────────────────────────────── */}
        <div style={card}>
          <p style={sectionTitle}>Destinatarios y envío</p>
          <div style={{ display: 'grid', gap: 16 }}>

            <EmailList
              label="Para (destinatarios principales)"
              required
              emails={emailTo}
              onChange={setEmailTo}
            />

            <EmailList
              label="CC (con copia)"
              emails={emailCc}
              onChange={setEmailCc}
            />

          </div>
        </div>

        {/* ── Acciones ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handlePreview}
            disabled={previewing}
            style={{
              padding: '11px 20px', background: '#fff', color: '#1A1A1A',
              border: '1px solid #E8E6E0', borderRadius: 8, cursor: previewing ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 600, opacity: previewing ? 0.6 : 1,
            }}
          >
            {previewing ? 'Generando PDF…' : '👁 Previsualizar PDF'}
          </button>

          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              padding: '11px 24px', background: '#D85A30', color: '#fff',
              border: 'none', borderRadius: 8, cursor: sending ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.03em', opacity: sending ? 0.6 : 1,
            }}
          >
            {sending ? 'Enviando…' : '✉ Enviar propuesta'}
          </button>

          {sendMsg && (
            <span style={{
              fontSize: 12, padding: '8px 14px', borderRadius: 6,
              background: sendMsg.ok ? '#D1FAE5' : '#FEE2E2',
              color:      sendMsg.ok ? '#065F46' : '#B91C1C',
            }}>
              {sendMsg.text}
            </span>
          )}
        </div>

      </div>
    </div>
  )
}
