'use client'

import { useState } from 'react'
import { submitFormalizacion, type FormalizacionLead } from '@/app/actions/espacios'

export default function FormalizacionView({
  token,
  nombre,
  lead,
}: {
  token: string
  nombre: string
  lead: FormalizacionLead
}) {
  const [tipo, setTipo]   = useState<'fisica' | 'juridica'>(lead.tipo_facturacion === 'juridica' ? 'juridica' : 'fisica')
  const [f, setF]         = useState({
    nombre:                lead.nombre ?? '',
    apellidos:             lead.apellidos ?? '',
    documento_identidad:   lead.documento_identidad ?? '',
    fecha_nacimiento:      lead.fecha_nacimiento ?? '',
    telefono:              lead.telefono ?? '',
    empresa:               lead.empresa ?? '',
    nif_cif:               lead.nif_cif ?? '',
    direccion:             lead.direccion ?? '',
    ciudad:                lead.ciudad ?? '',
    codigo_postal:         lead.codigo_postal ?? '',
    pais:                  lead.pais ?? '',
    direccion_facturacion: lead.direccion_facturacion ?? '',
  })
  const [error, setError]     = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!f.nombre.trim()) { setError('Indícanos el nombre del firmante.'); return }
    if (!f.documento_identidad.trim()) { setError('Necesitamos el documento de identidad del firmante.'); return }
    if (tipo === 'juridica' && (!f.empresa.trim() || !f.nif_cif.trim())) {
      setError('Para persona jurídica necesitamos la razón social y el CIF.'); return
    }
    setSaving(true)
    const res = await submitFormalizacion(token, { ...f, tipo_facturacion: tipo })
    if ('error' in res) { setError(res.error); setSaving(false); return }
    window.location.reload()
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/FORMA_PRIMA_NEGRO.png" alt="Forma Prima" style={{ height: 22, opacity: 0.85 }} />
      </div>

      <section style={{ maxWidth: 640, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px) 24px' }}>
        <span className="fp-section-label">Formalización</span>
        <h1 style={{ fontSize: 'clamp(24px, 5vw, 34px)', fontWeight: 300, lineHeight: 1.2 }}>
          Un último paso, {nombre}.
        </h1>
        <p style={{ fontSize: 15, color: '#666', lineHeight: 1.7, marginTop: 12, marginBottom: 32 }}>
          Gracias por confiar en nosotros. Para preparar tu contrato necesitamos los datos del
          firmante. Tus datos son confidenciales y solo se usan para la formalización.
        </p>

        {/* Tipo de firmante */}
        <p className="fp-field-label">¿Cómo firmarás el contrato?</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
          {(['fisica', 'juridica'] as const).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setTipo(opt)}
              style={{
                flex: 1, padding: '14px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 500,
                border: `1px solid ${tipo === opt ? '#D85A30' : '#E5E2DA'}`,
                background: tipo === opt ? '#FDF3EE' : '#fff',
                color: tipo === opt ? '#D85A30' : '#555',
              }}
            >
              {opt === 'fisica' ? 'Persona física' : 'Persona jurídica'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {tipo === 'juridica' && (
            <>
              <p className="fp-field-label" style={{ marginBottom: -4, color: '#D85A30' }}>Datos de la empresa</p>
              <div className="fp-grid-2">
                <Field label="Razón social *" value={f.empresa} onChange={set('empresa')} placeholder="Nombre de la sociedad" />
                <Field label="CIF *" value={f.nif_cif} onChange={set('nif_cif')} placeholder="B12345678" />
              </div>
              <Field label="Domicilio fiscal" value={f.direccion_facturacion} onChange={set('direccion_facturacion')} placeholder="Dirección fiscal de la sociedad" />
              <p className="fp-field-label" style={{ marginBottom: -4, marginTop: 8, color: '#D85A30' }}>Datos del firmante (representante)</p>
            </>
          )}

          <div className="fp-grid-2">
            <Field label="Nombre *" value={f.nombre} onChange={set('nombre')} placeholder="Nombre" />
            <Field label="Apellidos" value={f.apellidos} onChange={set('apellidos')} placeholder="Apellidos" />
          </div>
          <div className="fp-grid-2">
            <Field label="DNI / NIE *" value={f.documento_identidad} onChange={set('documento_identidad')} placeholder="12345678A" />
            <Field label="Teléfono" value={f.telefono} onChange={set('telefono')} placeholder="+34 600 000 000" />
          </div>

          {tipo === 'fisica' && (
            <>
              <Field label="Dirección" value={f.direccion} onChange={set('direccion')} placeholder="Calle, número, piso" />
              <div className="fp-grid-2">
                <Field label="Ciudad" value={f.ciudad} onChange={set('ciudad')} placeholder="Madrid" />
                <Field label="Código postal" value={f.codigo_postal} onChange={set('codigo_postal')} placeholder="28006" />
              </div>
              <div className="fp-grid-2">
                <Field label="País" value={f.pais} onChange={set('pais')} placeholder="España" />
                <Field label="Fecha de nacimiento" value={f.fecha_nacimiento} onChange={set('fecha_nacimiento')} placeholder="" type="date" />
              </div>
            </>
          )}

          {error && (
            <p style={{ fontSize: 13, color: '#E53E3E', background: '#FFF5F5', border: '1px solid #FCA5A5', borderRadius: 4, padding: '8px 12px' }}>
              {error}
            </p>
          )}
          <button type="submit" className="fp-btn-primary" disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar datos'}
          </button>
        </form>
      </section>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="fp-field-label">{label}</label>
      <input className="fp-input" type={type} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  )
}
