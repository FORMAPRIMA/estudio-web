'use client'

import { useState } from 'react'
import { updateEstudioConfig, type EstudioConfig } from '@/app/actions/facturasEmitidas'

type Field = { key: keyof EstudioConfig; label: string; placeholder?: string; mono?: boolean }

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: 'Datos de empresa',
    fields: [
      { key: 'nombre',        label: 'Razón social',      placeholder: 'GEINEX GROUP, S.L.' },
      { key: 'nif',           label: 'NIF / CIF',          placeholder: 'B44873552', mono: true },
      { key: 'direccion',     label: 'Dirección',          placeholder: 'CL/ Ppe de Vergara 56 6 2' },
      { key: 'ciudad',        label: 'Ciudad',             placeholder: 'Madrid' },
      { key: 'codigo_postal', label: 'Código postal',      placeholder: '28006', mono: true },
      { key: 'pais',          label: 'País',               placeholder: 'España' },
    ],
  },
  {
    title: 'Contacto',
    fields: [
      { key: 'email',    label: 'Email principal', placeholder: 'contacto@formaprima.es' },
      { key: 'email_cc', label: 'Email secundario', placeholder: 'ghidalgo@formaprima.es' },
      { key: 'telefono', label: 'Teléfono',         placeholder: '+34 000 000 000' },
    ],
  },
  {
    title: 'Datos bancarios',
    fields: [
      { key: 'iban',        label: 'IBAN',        placeholder: 'ES61 0049 5103 71 2516693256', mono: true },
      { key: 'banco_nombre', label: 'Banco',      placeholder: 'Banco Santander' },
      { key: 'banco_swift', label: 'SWIFT / BIC', placeholder: 'BSCHESMMXXX', mono: true },
    ],
  },
]

function formatNumPreview(n: number) {
  return `F-${n + 1}`
}

export default function InfoEmpresaPage({ config }: { config: EstudioConfig | null }) {
  const [draft, setDraft] = useState<Partial<EstudioConfig>>(config ?? {})
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaveState('saving')
    setSaveError(null)
    const result = await updateEstudioConfig(draft)
    if ('error' in result) {
      setSaveState('error')
      setSaveError(result.error)
      return
    }
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 2500)
  }

  const set = (key: keyof EstudioConfig, val: string) =>
    setDraft(prev => ({ ...prev, [key]: val || null }))

  const inp: React.CSSProperties = {
    width: '100%', height: 36, padding: '0 12px', fontSize: 13,
    border: '1px solid #E8E6E0', outline: 'none', background: '#fff',
    fontFamily: 'inherit', color: '#1A1A1A', borderRadius: 4, boxSizing: 'border-box',
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ padding: '40px 40px 28px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Facturación
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
            Información empresa
          </h1>
          <p style={{ fontSize: 11, color: '#AAA', paddingBottom: 4 }}>
            Datos que aparecen en todas las facturas emitidas
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 760 }}>

        {SECTIONS.map(section => (
          <div key={section.title} style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '14px 24px', borderBottom: '1px solid #F0EEE8', background: '#FAFAF8' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D85A30', margin: 0 }}>
                {section.title}
              </p>
            </div>
            <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
              {section.fields.map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', display: 'block', marginBottom: 6 }}>
                    {f.label}
                  </label>
                  <input
                    value={(draft[f.key] as string) ?? ''}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    style={{ ...inp, fontFamily: f.mono ? 'monospace' : 'inherit', fontSize: f.mono ? 12 : 13 }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Numeración de facturas */}
        <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '14px 24px', borderBottom: '1px solid #F0EEE8', background: '#FAFAF8' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D85A30', margin: 0 }}>
              Numeración de facturas
            </p>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
              Si ya tenías facturas emitidas antes de usar este sistema, indica aquí el último número utilizado.
              El sistema continuará la numeración desde ese punto.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', display: 'block', marginBottom: 6 }}>
                  Último número emitido
                </label>
                <input
                  type="number"
                  min={0}
                  value={draft.factura_numero_inicio ?? ''}
                  onChange={e => setDraft(prev => ({ ...prev, factura_numero_inicio: e.target.value ? parseInt(e.target.value, 10) : null }))}
                  placeholder="0"
                  style={{ ...inp, fontFamily: 'monospace', fontSize: 13, width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', display: 'block', marginBottom: 6 }}>
                  Próxima factura
                </label>
                <div style={{ height: 36, padding: '0 12px', fontSize: 13, border: '1px solid #E8E6E0', borderRadius: 4, background: '#F8F7F4', display: 'flex', alignItems: 'center', fontFamily: 'monospace', color: '#1D9E75', fontWeight: 600 }}>
                  {formatNumPreview(draft.factura_numero_inicio ?? 0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, padding: '16px 0' }}>
          {saveState === 'error' && (
            <span style={{ fontSize: 12, color: '#DC2626' }}>Error: {saveError}</span>
          )}
          {saveState === 'saved' && (
            <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500 }}>Cambios guardados</span>
          )}
          <button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            style={{
              height: 38, padding: '0 28px',
              background: saveState === 'saving' ? '#888' : saveState === 'saved' ? '#1D9E75' : '#1A1A1A',
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              opacity: saveState === 'saving' ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (saveState === 'idle') (e.currentTarget as HTMLElement).style.background = '#D85A30' }}
            onMouseLeave={e => { if (saveState === 'idle') (e.currentTarget as HTMLElement).style.background = '#1A1A1A' }}
          >
            {saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? 'Guardado' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
