'use client'

import { useState } from 'react'
import ClausulasEditor from '@/components/team/captacion/ClausulasEditor'
import { savePlantillaClausulas, restorePlantillaClausulasFabrica } from '@/app/actions/plantillaContratos'
import type { ContratoClausula } from '@/lib/contratos/clausulas'

export default function PlantillaContratosPage({
  clausulas: initial,
  readOnly,
}: {
  clausulas: ContratoClausula[]
  readOnly: boolean
}) {
  const [clausulas, setClausulas] = useState<ContratoClausula[]>(initial)
  const [dirty,  setDirty]  = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg,    setMsg]    = useState<string | null>(null)
  const [err,    setErr]    = useState<string | null>(null)

  const onChange = (next: ContratoClausula[]) => {
    setClausulas(next); setDirty(true); setMsg(null); setErr(null)
  }

  const save = async () => {
    setSaving(true); setErr(null); setMsg(null)
    const r = await savePlantillaClausulas(clausulas)
    setSaving(false)
    if ('error' in r) setErr(r.error)
    else { setDirty(false); setMsg('Plantilla guardada. Los contratos nuevos partirán de estas cláusulas.') }
  }

  const restore = async () => {
    if (!confirm('¿Restaurar la plantilla a la versión de fábrica? Sobrescribe la plantilla actual. No afecta a contratos ya creados.')) return
    setSaving(true); setErr(null); setMsg(null)
    const r = await restorePlantillaClausulasFabrica()
    setSaving(false)
    if ('error' in r) setErr(r.error)
    else window.location.reload()
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>
      {/* Header */}
      <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 200, color: '#1A1A1A', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              Plantilla de contratos
            </h1>
            <p style={{ fontSize: 12, color: '#888', margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
              Cláusulas legales de origen del contrato de servicios. Lo que edites aquí es el punto de partida de
              <strong> los contratos nuevos</strong>; los ya creados conservan su propia copia y no se ven afectados.
            </p>
          </div>
          {!readOnly && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" onClick={restore} disabled={saving}
                style={{ height: 36, padding: '0 14px', background: 'none', border: '1px dashed #D5D2CA', borderRadius: 4, cursor: saving ? 'default' : 'pointer', fontSize: 11, color: '#999' }}>
                Restaurar a fábrica
              </button>
              <button type="button" onClick={save} disabled={saving || !dirty}
                style={{
                  height: 36, padding: '0 20px', borderRadius: 4, border: 'none',
                  cursor: saving || !dirty ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  background: dirty && !saving ? '#1A1A1A' : '#CCC', color: '#fff',
                }}>
                {saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Guardado'}
              </button>
            </div>
          )}
        </div>

        {msg && (
          <div style={{ marginTop: 12, padding: '10px 16px', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 6, fontSize: 12, color: '#065F46' }}>{msg}</div>
        )}
        {err && (
          <div style={{ marginTop: 12, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 12, color: '#DC2626' }}>{err}</div>
        )}
        {readOnly && (
          <div style={{ marginTop: 12, padding: '10px 16px', background: '#F0EEE8', border: '1px solid #E8E6E0', borderRadius: 6, fontSize: 12, color: '#888' }}>
            Solo lectura. Únicamente un socio (fp_partner) puede editar la plantilla.
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '32px 40px' }}>
        <section style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '24px 28px' }}>
          <ClausulasEditor
            clausulas={clausulas}
            onChange={onChange}
            disabled={readOnly}
            baseLabel="versión de fábrica"
          />
        </section>
      </div>
    </div>
  )
}
