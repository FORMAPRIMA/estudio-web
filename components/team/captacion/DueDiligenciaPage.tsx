'use client'

import { useState } from 'react'
import { getDefaultTextSections } from '@/lib/pdfs/dueDiligenciaDefaults'
import type { DueDiligenciaTextSections } from '@/lib/pdfs/dueDiligenciaDefaults'

// ── Types ──────────────────────────────────────────────────────────────────────

interface FormState {
  nombre_proyecto:        string
  superficie:             string
  tarifa_m2:              string
  fee_base:               string
  fecha:                  string
  ciudad:                 string
  cuestiones_especificas: string
  modo_honorarios:        'por_m2' | 'importe_fijo'
  importe_fijo:           string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #E8E6E0',
  borderRadius: 6, fontSize: 13, color: '#1A1A1A', background: '#fff',
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase' as const, color: '#AAA', marginBottom: 5, display: 'block',
}
const cardStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, padding: '20px 24px',
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase' as const, color: '#AAA', margin: '0 0 16px',
}

// ── Email multi-input ─────────────────────────────────────────────────────────

function EmailList({
  label: lbl, required, emails, onChange,
}: { label: string; required?: boolean; emails: string[]; onChange: (e: string[]) => void }) {
  const update = (i: number, val: string) => { const n = [...emails]; n[i] = val; onChange(n) }
  const add    = () => onChange([...emails, ''])
  const remove = (i: number) => onChange(emails.filter((_, idx) => idx !== i))
  return (
    <div>
      <label style={labelStyle}>{lbl}{required ? ' *' : ''}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {emails.map((email, i) => (
          <div key={i} style={{ display: 'flex', gap: 6 }}>
            <input type="email" value={email} onChange={e => update(i, e.target.value)}
              placeholder="email@ejemplo.com" style={{ ...inputStyle, flex: 1 }} />
            {emails.length > (required ? 1 : 0) && (
              <button type="button" onClick={() => remove(i)} style={{
                padding: '0 10px', background: 'none', border: '1px solid #FECACA',
                borderRadius: 6, cursor: 'pointer', color: '#DC2626', fontSize: 14, flexShrink: 0,
              }}>×</button>
            )}
          </div>
        ))}
        <button type="button" onClick={add} style={{
          alignSelf: 'flex-start', padding: '6px 12px', background: 'none',
          border: '1px dashed #D0CEC8', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#888',
        }}>+ Añadir destinatario</button>
      </div>
    </div>
  )
}

// ── Step 2 text editor helpers ────────────────────────────────────────────────

function TF({
  label: lbl, value, onChange, rows = 3, hint,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <div>
      <label style={{ ...labelStyle, marginBottom: hint ? 2 : 5 }}>{lbl}</label>
      {hint && <p style={{ fontSize: 9, color: '#BBB', margin: '0 0 5px', fontStyle: 'italic' }}>{hint}</p>}
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' } as React.CSSProperties} />
    </div>
  )
}

function EditorCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <p style={sectionTitleStyle}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  )
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle({
  value, onChange,
}: { value: 'por_m2' | 'importe_fijo'; onChange: (v: 'por_m2' | 'importe_fijo') => void }) {
  const btn = (mode: 'por_m2' | 'importe_fijo', label: string) => {
    const active = value === mode
    return (
      <button
        type="button"
        onClick={() => onChange(mode)}
        style={{
          flex: 1, padding: '9px 12px', fontSize: 12, fontWeight: active ? 700 : 400,
          border: active ? '1.5px solid #D85A30' : '1px solid #E8E6E0',
          borderRadius: 6, cursor: 'pointer',
          background: active ? '#FEF3EE' : '#fff',
          color: active ? '#D85A30' : '#888',
          transition: 'all 0.15s',
        }}
      >{label}</button>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {btn('por_m2',       'Por m² + fee base')}
      {btn('importe_fijo', 'Importe fijo total')}
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
    modo_honorarios:        'por_m2',
    importe_fijo:           '',
  })

  const [emailTo, setEmailTo]         = useState<string[]>([''])
  const [emailCc, setEmailCc]         = useState<string[]>([])
  const [sending, setSending]         = useState(false)
  const [sendMsg, setSendMsg]         = useState<{ ok: boolean; text: string } | null>(null)
  const [previewing, setPreviewing]   = useState(false)
  const [step, setStep]               = useState<1 | 2>(1)
  const [textSections, setTextSections] = useState<DueDiligenciaTextSections | null>(null)

  const sup      = parseFloat(form.superficie) || 0
  const tar      = parseFloat(form.tarifa_m2)  || 0
  const feeBase  = parseFloat(form.fee_base)   || 0
  const impFijo  = parseFloat(form.importe_fijo) || 0
  const esFijo   = form.modo_honorarios === 'importe_fijo'

  const honorariosVar  = sup * tar
  const totalHonorarios = esFijo ? impFijo : (honorariosVar + feeBase)
  const hito           = totalHonorarios / 2

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))

  const setModo = (modo: 'por_m2' | 'importe_fijo') => {
    setForm(prev => ({ ...prev, modo_honorarios: modo }))
    setTextSections(null) // reset so defaults are recomputed from new mode
  }

  const buildPdfData = () => ({
    nombre_proyecto:        form.nombre_proyecto.trim() || 'Sin nombre',
    superficie:             sup,
    tarifa_m2:              tar,
    fee_base:               feeBase,
    fecha:                  form.fecha || today,
    ciudad:                 form.ciudad.trim() || 'Madrid',
    cuestiones_especificas: form.cuestiones_especificas.trim() || null,
    modo_honorarios:        form.modo_honorarios,
    importe_fijo:           esFijo ? impFijo : null,
  })

  const buildPayload = () => ({
    ...buildPdfData(),
    ...(textSections ? { textSections } : {}),
  })

  const handleContinue = () => {
    const pdfData = buildPdfData()
    setTextSections(ts => ts ?? getDefaultTextSections(pdfData))
    setStep(2)
  }

  const setTs = (key: keyof DueDiligenciaTextSections) => (val: string) =>
    setTextSections(prev => prev ? { ...prev, [key]: val } : prev)

  const handlePreview = async () => {
    setPreviewing(true)
    try {
      const res = await fetch('/api/due-diligencia/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? 'Error al generar PDF.'); return }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } catch { alert('Error de red al previsualizar.') }
    finally { setPreviewing(false) }
  }

  const handleSend = async () => {
    const validTo = emailTo.map(e => e.trim()).filter(Boolean)
    const validCc = emailCc.map(e => e.trim()).filter(Boolean)
    if (validTo.length === 0) { alert('Introduce al menos un destinatario.'); return }
    if (!confirm(`Enviar propuesta a: ${validTo.join(', ')}?`)) return
    setSending(true); setSendMsg(null)
    try {
      const res = await fetch('/api/due-diligencia/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildPayload(), email_to: validTo, email_cc: validCc }),
      })
      const j = await res.json()
      setSendMsg(j.ok
        ? { ok: true,  text: `Propuesta enviada correctamente a ${validTo.join(', ')}.` }
        : { ok: false, text: j.error ?? 'Error al enviar.' })
    } catch { setSendMsg({ ok: false, text: 'Error de red.' }) }
    finally { setSending(false) }
  }

  // ── Step 1 — Datos ────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 16px', fontFamily: 'inherit' }}>

        <div style={{ marginBottom: 24 }}>
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

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#D85A30', background: '#FEF3EE', borderRadius: 20, padding: '3px 10px' }}>
            Paso 1 — Datos
          </span>
          <span style={{ fontSize: 11, color: '#CCC' }}>→</span>
          <span style={{ fontSize: 11, color: '#CCC', background: '#F8F7F4', borderRadius: 20, padding: '3px 10px' }}>
            Paso 2 — Texto del documento
          </span>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>

          {/* Datos del activo */}
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Datos del activo</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nombre del proyecto / activo *</label>
                <input style={inputStyle} value={form.nombre_proyecto} onChange={set('nombre_proyecto')} placeholder="Sierra Bullones" />
              </div>

              <div>
                <label style={labelStyle}>Ciudad / ubicación</label>
                <input style={inputStyle} value={form.ciudad} onChange={set('ciudad')} placeholder="Madrid, España" />
              </div>

              <div>
                <label style={labelStyle}>Fecha de propuesta</label>
                <input style={inputStyle} type="date" value={form.fecha} onChange={set('fecha')} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Superficie estimada (m²) *</label>
                <input style={inputStyle} type="number" min="1" value={form.superficie} onChange={set('superficie')} placeholder="531" />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Cuestiones específicas <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 9 }}>(opcional — aparece en el PDF como caja destacada)</span></label>
                <textarea
                  style={{ ...inputStyle, height: 80, resize: 'vertical', lineHeight: '1.5' } as React.CSSProperties}
                  value={form.cuestiones_especificas}
                  onChange={set('cuestiones_especificas')}
                  placeholder="Ej: El activo se destina a régimen de hold/renta. Se requiere especial atención a instalaciones de climatización y estado de fachadas."
                />
              </div>

            </div>
          </div>

          {/* Honorarios */}
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Honorarios profesionales</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ ...labelStyle, marginBottom: 8 }}>Método de cálculo</label>
              <ModeToggle value={form.modo_honorarios} onChange={setModo} />
            </div>

            {esFijo ? (
              /* Importe fijo */
              <div>
                <label style={labelStyle}>Importe total (€) *</label>
                <input
                  style={inputStyle} type="number" min="0" step="100"
                  value={form.importe_fijo} onChange={set('importe_fijo')}
                  placeholder="5000"
                />
                {impFijo > 0 && (
                  <p style={{ fontSize: 11, color: '#AAA', marginTop: 8, marginBottom: 0 }}>
                    Pago en 2 hitos: {fmtEur(hito)} a la aceptación + {fmtEur(hito)} a la entrega del informe. IVA no incluido.
                  </p>
                )}
              </div>
            ) : (
              /* Por m² */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Tarifa variable (€/m²)</label>
                  <input style={inputStyle} type="number" min="1" step="0.5" value={form.tarifa_m2} onChange={set('tarifa_m2')} placeholder="8" />
                </div>
                <div>
                  <label style={labelStyle}>Fee base — Movilización (€)</label>
                  <input style={inputStyle} type="number" min="0" step="100" value={form.fee_base} onChange={set('fee_base')} placeholder="1500" />
                </div>
              </div>
            )}
          </div>

          {/* Resumen honorarios */}
          <div style={{ ...cardStyle, background: '#F8F7F4' }}>
            <p style={sectionTitleStyle}>Resumen</p>
            <div style={{ display: 'flex', gap: 0 }}>
              {!esFijo && (
                <>
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
                </>
              )}
              <div style={{ flex: 1.5, borderLeft: esFijo ? 'none' : '1px solid #E8E6E0', paddingLeft: esFijo ? 0 : 20 }}>
                <p style={{ fontSize: 10, color: '#AAA', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total honorarios</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#D85A30', margin: 0 }}>{totalHonorarios > 0 ? fmtEur(totalHonorarios) : '—'}</p>
                <p style={{ fontSize: 10, color: '#CCC', margin: '2px 0 0' }}>+ IVA si aplica</p>
              </div>
            </div>
            {totalHonorarios > 0 && (
              <p style={{ fontSize: 11, color: '#AAA', marginTop: 10, marginBottom: 0 }}>
                Pago en 2 hitos: {fmtEur(hito)} a la aceptación + {fmtEur(hito)} a la entrega del informe.
              </p>
            )}
          </div>

          {/* Continuar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleContinue}
              style={{
                padding: '12px 28px', background: '#D85A30', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 700, letterSpacing: '0.03em',
              }}
            >
              Continuar — editar texto del documento →
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ── Step 2 — Editor de texto ──────────────────────────────────────────────

  const ts = textSections!

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 16px', fontFamily: 'inherit' }}>

      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', margin: '0 0 4px' }}>
          Captación · Due Diligence Técnica
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 300, color: '#1A1A1A', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          Editar texto del documento
        </h1>
        <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
          {form.nombre_proyecto} · {sup} m² · {fmtEur(totalHonorarios)}
          {esFijo ? ' (importe fijo)' : ` (${fmtEur(tar)}/m² + ${fmtEur(feeBase)})`}
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24 }}>
        <span style={{ fontSize: 11, color: '#999', background: '#F8F7F4', borderRadius: 20, padding: '3px 10px' }}>
          Paso 1 — Datos ✓
        </span>
        <span style={{ fontSize: 11, color: '#CCC' }}>→</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#D85A30', background: '#FEF3EE', borderRadius: 20, padding: '3px 10px' }}>
          Paso 2 — Texto del documento
        </span>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>

        <EditorCard title="1. Objeto de la propuesta">
          <TF label="Primer párrafo" value={ts.objeto_p1} onChange={setTs('objeto_p1')} rows={4} />
          <TF label="Segundo párrafo" value={ts.objeto_p2} onChange={setTs('objeto_p2')} rows={3} />
        </EditorCard>

        <EditorCard title="2. Alcance de los servicios">
          <TF label="Introducción" value={ts.alcance_intro} onChange={setTs('alcance_intro')} rows={3} />
          <TF label="2.1 Revisión estado general — puntos" value={ts.alcance_21_bullets} onChange={setTs('alcance_21_bullets')} rows={4} hint="Una línea por punto" />
          <TF label="2.2 Instalaciones — introducción" value={ts.alcance_22_intro} onChange={setTs('alcance_22_intro')} rows={2} />
          <TF label="2.2 Instalaciones — puntos" value={ts.alcance_22_bullets} onChange={setTs('alcance_22_bullets')} rows={5} hint="Una línea por punto" />
          <TF label="2.2 Instalaciones — nota final" value={ts.alcance_22_footer} onChange={setTs('alcance_22_footer')} rows={2} />
          <TF label="2.3 Mantenimiento — puntos" value={ts.alcance_23_bullets} onChange={setTs('alcance_23_bullets')} rows={3} hint="Una línea por punto" />
          <TF label="2.4 CAPEX Forecast — puntos" value={ts.alcance_24_bullets} onChange={setTs('alcance_24_bullets')} rows={3} hint="Una línea por punto" />
        </EditorCard>

        <EditorCard title="3. Metodología de trabajo">
          <TF label="Introducción" value={ts.metodologia_intro} onChange={setTs('metodologia_intro')} rows={2} />
          <TF label="Fase 1 — Revisión Documental Previa" value={ts.metodologia_fase1} onChange={setTs('metodologia_fase1')} rows={2} />
          <TF label="Fase 2 — Inspección Técnica Presencial" value={ts.metodologia_fase2} onChange={setTs('metodologia_fase2')} rows={2} />
          <TF label="Fase 3 — Análisis y Consolidación Técnica" value={ts.metodologia_fase3} onChange={setTs('metodologia_fase3')} rows={2} />
          <TF label="Fase 4 — Emisión de Informe Ejecutivo" value={ts.metodologia_fase4} onChange={setTs('metodologia_fase4')} rows={2} />
        </EditorCard>

        <EditorCard title="4. Entregables">
          <TF label="Introducción" value={ts.entregables_intro} onChange={setTs('entregables_intro')} rows={2} />
          <TF label="Puntos del informe" value={ts.entregables_bullets} onChange={setTs('entregables_bullets')} rows={5} hint="Una línea por punto" />
          <TF
            label="Nota de cierre"
            value={ts.entregables_nota}
            onChange={setTs('entregables_nota')}
            rows={2}
            hint="Aparece en cursiva al final de la sección. Déjalo vacío para omitirla."
          />
        </EditorCard>

        <EditorCard title="5. Documentación requerida">
          <TF label="Texto" value={ts.documentacion_intro} onChange={setTs('documentacion_intro')} rows={2} />
          <TF label="Puntos" value={ts.documentacion_bullets} onChange={setTs('documentacion_bullets')} rows={5} hint="Una línea por punto" />
        </EditorCard>

        <EditorCard title="6. Exclusiones y limitaciones">
          <TF label="Texto introductorio" value={ts.exclusiones_intro} onChange={setTs('exclusiones_intro')} rows={3} />
          <TF label="Puntos" value={ts.exclusiones_bullets} onChange={setTs('exclusiones_bullets')} rows={9} hint="Una línea por punto" />
        </EditorCard>

        <EditorCard title="7. Condiciones de acceso">
          <TF label="Texto" value={ts.acceso_intro} onChange={setTs('acceso_intro')} rows={2} />
          <TF label="Puntos" value={ts.acceso_bullets} onChange={setTs('acceso_bullets')} rows={3} hint="Una línea por punto" />
        </EditorCard>

        <EditorCard title="8. Plazo de entrega">
          <TF label="Texto" value={ts.plazo} onChange={setTs('plazo')} rows={2} />
        </EditorCard>

        <EditorCard title="9. Honorarios — nota al pie">
          <TF
            label="Nota (IVA, condiciones, etc.)"
            value={ts.honorarios_nota}
            onChange={setTs('honorarios_nota')}
            rows={2}
            hint="Aparece en cursiva debajo de la tabla de honorarios. Déjalo vacío para omitirla."
          />
        </EditorCard>

        {/* Section 10 only shown in por_m2 mode, or always editable */}
        <EditorCard title="10. Ajuste de superficie">
          <TF
            label="Texto"
            value={ts.ajuste_p1}
            onChange={setTs('ajuste_p1')}
            rows={4}
            hint={esFijo ? 'Dejar vacío para omitir esta sección del PDF.' : undefined}
          />
        </EditorCard>

        <EditorCard title="11 – 13. Condiciones · Validez · Aceptación">
          <TF label="11. Condiciones de pago — introducción" value={ts.pago_intro} onChange={setTs('pago_intro')} rows={2} />
          <TF label="12. Validez de la propuesta" value={ts.validez} onChange={setTs('validez')} rows={2} />
          <TF label="13. Aceptación" value={ts.aceptacion} onChange={setTs('aceptacion')} rows={2} />
        </EditorCard>

        {/* Destinatarios */}
        <div style={cardStyle}>
          <p style={sectionTitleStyle}>Destinatarios y envío</p>
          <div style={{ display: 'grid', gap: 16 }}>
            <EmailList label="Para (destinatarios principales)" required emails={emailTo} onChange={setEmailTo} />
            <EmailList label="CC (con copia)" emails={emailCc} onChange={setEmailCc} />
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>

          <button
            onClick={() => setStep(1)}
            style={{
              padding: '11px 16px', background: '#fff', color: '#888',
              border: '1px solid #E8E6E0', borderRadius: 8, cursor: 'pointer', fontSize: 13,
            }}
          >
            ← Volver a datos
          </button>

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
