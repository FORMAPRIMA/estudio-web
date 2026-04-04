'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { updatePropuesta } from '@/app/actions/propuestas'
import { SERVICIOS_CONFIG, SERVICIO_IDS, calcPropuesta, fmtEur, PRECIO_HORA } from '@/lib/propuestas/config'
import type { ServicioId, ServicioEntry } from '@/lib/propuestas/config'
import type { PropuestaPDFData } from '@/components/pdfs/PropuestaPDF'

// ── Types ─────────────────────────────────────────────────────────────────────
type Lead = {
  id:        string
  nombre:    string
  apellidos: string
  empresa:   string | null
  email:     string | null
  telefono:  string | null
  direccion: string | null
}

type RatioFase = { id: string; label: string; seccion: string; ratio: number | null }

type Propuesta = {
  id:                   string
  numero:               string
  status:               string
  titulo:               string | null
  direccion:            string | null
  fecha_propuesta:      string | null
  m2_diseno:            number | null
  costo_m2_objetivo:    number | null
  porcentaje_pem:       number
  servicios:            ServicioId[]
  pct_junior:           number
  pct_senior:           number
  pct_partner:          number
  semanas:              Record<string, string>
  notas:                string | null
  lead_id:              string | null
  fecha_envio:          string | null
  honorarios_override:  Record<string, number> | null
}

const STATUS_LABEL: Record<string, string> = {
  borrador:  'Borrador',
  enviada:   'Enviada',
  aceptada:  'Aceptada',
  rechazada: 'Rechazada',
}

const STATUS_COLOR: Record<string, string> = {
  borrador:  '#AAA',
  enviada:   '#378ADD',
  aceptada:  '#4CAF50',
  rechazada: '#E57373',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function inputStyle(focused?: boolean): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '8px 10px', border: '1px solid',
    borderColor: focused ? '#1A1A1A' : '#E8E6E0',
    borderRadius: 4, fontSize: 13, outline: 'none',
    background: '#fff', color: '#1A1A1A',
    fontFamily: "'Inter', system-ui, sans-serif",
  }
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', display: 'block', marginBottom: 5 }}>
      {children}
    </label>
  )
}

function Field({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ marginBottom: 18, ...style }}>{children}</div>
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PropuestaDetalle({
  propuesta: initial,
  leads,
  ratiosFases,
  serviciosPlantilla,
  pipelineHoras,
  pipelineDetalle,
  teamCount,
}: {
  propuesta:          Propuesta
  leads:              Lead[]
  ratiosFases:        RatioFase[]
  serviciosPlantilla: ServicioEntry[]
  pipelineHoras:      Record<string, number>
  pipelineDetalle:    { proyectoNombre: string; faseLabel: string; seccionId: string; horasTotal: number; horasRestantes: number; tasksPendientes: number; tasksTotal: number }[]
  teamCount:          number
}) {
  const router = useRouter()
  const [isSaving, startSave] = useTransition()
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendOk, setSendOk] = useState(false)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [leadSearch, setLeadSearch] = useState('')
  const [personasPorProyecto, setPersonasPorProyecto] = useState<Record<string, string>>({})
  const [personasPorServicio, setPersonasPorServicio] = useState<Record<string, string>>({})

  // Local state — mirrors DB
  const [status, setStatus]                       = useState(initial.status)
  const [titulo, setTitulo]                       = useState(initial.titulo ?? '')
  const [direccion, setDireccion]                 = useState(initial.direccion ?? '')
  const [fecha, setFecha]                         = useState(initial.fecha_propuesta ?? new Date().toISOString().split('T')[0])
  const [m2, setM2]                               = useState(String(initial.m2_diseno ?? ''))
  const [costoM2, setCostoM2]                     = useState(String(initial.costo_m2_objetivo ?? ''))
  const [pctPem, setPctPem]                       = useState(String(initial.porcentaje_pem ?? 10))
  const [servicios, setServicios]                 = useState<ServicioId[]>(initial.servicios ?? [])
  const [pctJunior, setPctJunior]                 = useState(String(initial.pct_junior ?? 70))
  const [pctSenior, setPctSenior]                 = useState(String(initial.pct_senior ?? 0))
  const [pctPartner, setPctPartner]               = useState(String(initial.pct_partner ?? 30))
  const [semanas, setSemanas]                     = useState<Record<string, string>>(initial.semanas ?? {})
  const [notas, setNotas]                         = useState(initial.notas ?? '')
  const [leadId, setLeadId]                       = useState(initial.lead_id ?? null)
  // Manual honorarios overrides for ratio-based services (keyed by ServicioId)
  const [honorariosOverride, setHonorariosOverride] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(initial.honorarios_override ?? {}).map(([k, v]) => [k, String(v)])
    )
  )

  const currentLead = leads.find(l => l.id === leadId) ?? null

  // ── Live calculation ──────────────────────────────────────────────────────
  // Solo fases de Interiorismo para calcPropuesta (ratio-based honorario)
  const ratios = ratiosFases
    .filter(r => (r.seccion ?? '').toLowerCase().includes('interiorismo'))
    .map(r => ({
      label:    r.label,
      servicio: 'interiorismo' as ServicioId,
      ratio:    r.ratio ?? 0,
    }))

  // Horas estimadas por servicio: suma de ratios h/m² de sus fases × m²
  const horasEstimadas = useMemo(() => {
    const m2n = parseFloat(m2) || 0
    const result: Record<string, { horas: number; ratio: number }> = {}
    const flt = (fases: RatioFase[]) => {
      const ratio = fases.reduce((s, r) => s + (r.ratio ?? 0), 0)
      if (ratio > 0) return { horas: Math.round(ratio * m2n), ratio: Math.round(ratio * 100) / 100 }
      return null
    }
    const sec = (r: RatioFase) => (r.seccion ?? '').toLowerCase()
    const lbl = (r: RatioFase) => (r.label   ?? '').toLowerCase()

    const r = flt(ratiosFases.filter(r => sec(r).includes('anteproyecto')))
    if (r) result['anteproyecto'] = r

    const re = flt(ratiosFases.filter(r => sec(r).includes('ejecutivo') || sec(r).includes('ejecuci')))
    if (re) result['proyecto_ejecucion'] = re

    const ro = flt(ratiosFases.filter(r => sec(r).includes('obra') && !sec(r).includes('interiorismo')))
    if (ro) result['direccion_obra'] = ro

    const ri = flt(ratiosFases.filter(r =>
      sec(r).includes('interiorismo') && !lbl(r).includes('gesti')
    ))
    if (ri) result['interiorismo'] = ri

    const rg = flt(ratiosFases.filter(r =>
      sec(r).includes('interiorismo') && lbl(r).includes('gesti')
    ))
    if (rg) result['gestion_interiorismo'] = rg

    return result
  }, [m2, ratiosFases])

  // Calculated working days per service (mirrors the inline diasCalc logic in the service cards)
  const diasCalcPorServicio = useMemo(() => {
    const result: Record<string, string> = {}
    const m2n = parseFloat(m2) || 0
    if (m2n <= 0) return result
    for (const sid of servicios) {
      const hEst = horasEstimadas[sid]
      if (!hEst || sid === 'direccion_obra' || sid === 'gestion_interiorismo') continue
      const pers = parseInt(personasPorServicio[sid] ?? '2') || 1
      if (sid === 'anteproyecto') {
        const horasPipeline = Math.round(
          (pipelineHoras['anteproyecto'] ?? 0) +
          (pipelineHoras['proyecto_ejecucion'] ?? 0) +
          (pipelineHoras['interiorismo'] ?? 0) +
          (pipelineHoras['gestion_interiorismo'] ?? 0)
        )
        const horasTeorico = Math.round(horasPipeline * 1.25)
        const total = horasTeorico + hEst.horas
        result[sid] = String(Math.round(total / (pers * 8)))
      } else {
        result[sid] = String(Math.round(hEst.horas * 1.25 / (pers * 8)))
      }
    }
    return result
  }, [m2, servicios, horasEstimadas, personasPorServicio, pipelineHoras])

  // Weighted hourly rate
  const rateWeighted = useMemo(() => {
    const j = parseFloat(pctJunior) || 0
    const s = parseFloat(pctSenior) || 0
    const p = parseFloat(pctPartner) || 0
    return (j * PRECIO_HORA.junior + s * PRECIO_HORA.senior + p * PRECIO_HORA.socio) / 100
  }, [pctJunior, pctSenior, pctPartner])

  // Per-fase breakdown for interiorismo only (used for honorario calculation)
  const fasesCalc = useMemo(() => {
    const m2n = parseFloat(m2) || 0
    return ratiosFases
      .filter(r => (r.seccion ?? '').toLowerCase().includes('interiorismo'))
      .map(r => {
        const horas   = m2n * (r.ratio ?? 0)
        const importe = horas * rateWeighted
        return { id: r.id, label: r.label, ratio: r.ratio ?? 0, horas, importe }
      })
  }, [m2, ratiosFases, rateWeighted])

  const totalHorasFases = fasesCalc.reduce((s, f) => s + f.horas, 0)

  // Distribution by seniority: total hours split by team %, then × commercial rate
  const equipoDistribucion = useMemo(() => {
    const j = parseFloat(pctJunior)  || 0
    const s = parseFloat(pctSenior)  || 0
    const p = parseFloat(pctPartner) || 0
    return [
      { label: 'Junior',  pct: j, horas: totalHorasFases * j / 100, rate: PRECIO_HORA.junior },
      { label: 'Senior',  pct: s, horas: totalHorasFases * s / 100, rate: PRECIO_HORA.senior },
      { label: 'Socio',   pct: p, horas: totalHorasFases * p / 100, rate: PRECIO_HORA.socio  },
    ]
  }, [totalHorasFases, pctJunior, pctSenior, pctPartner])

  const totalImporteFases = equipoDistribucion.reduce((s, r) => s + r.horas * r.rate, 0)

  const equipoSumaOk = (parseFloat(pctJunior) || 0) + (parseFloat(pctSenior) || 0) + (parseFloat(pctPartner) || 0) === 100

  const calc = useMemo(() => {
    const m2n  = parseFloat(m2) || 0
    const c2n  = parseFloat(costoM2) || 0
    const pemN = parseFloat(pctPem) || 0
    const jN   = parseFloat(pctJunior) || 0
    const sN   = parseFloat(pctSenior) || 0
    const pN   = parseFloat(pctPartner) || 0
    const baseServs = servicios.filter(sid => sid in SERVICIOS_CONFIG) as ServicioId[]
    if (m2n === 0 || c2n === 0 || baseServs.length === 0) return null
    return calcPropuesta({
      m2: m2n, costoM2: c2n, porcentajePem: pemN,
      servicios: baseServs, pctJunior: jN, pctSenior: sN, pctPartner: pN,
      ratios,
    })
  }, [m2, costoM2, pctPem, servicios, pctJunior, pctSenior, pctPartner, ratiosFases])

  // Effective amount per service: override if set, else auto-calc (0 for custom/manual)
  function effectiveAmount(sid: string): number {
    const ov = honorariosOverride[sid]
    if (ov !== undefined && ov !== '') return parseFloat(ov) || 0
    return calc?.breakdown[sid as ServicioId] ?? 0
  }

  const effectiveTotal = servicios.reduce((s, sid) => s + effectiveAmount(sid), 0)

  // ── Save ──────────────────────────────────────────────────────────────────
  function handleSave() {
    startSave(async () => {
      // Convert override strings to numbers, drop empty entries
      const overrideNums: Record<string, number> = {}
      for (const [k, v] of Object.entries(honorariosOverride)) {
        if (v !== '') overrideNums[k] = parseFloat(v) || 0
      }
      await updatePropuesta(initial.id, {
        lead_id:             leadId,
        titulo:              titulo || null,
        direccion:           direccion || null,
        fecha_propuesta:     fecha || undefined,
        m2_diseno:           parseFloat(m2) || null,
        costo_m2_objetivo:   parseFloat(costoM2) || null,
        porcentaje_pem:      parseFloat(pctPem) || 10,
        servicios,
        pct_junior:          parseFloat(pctJunior) || 70,
        pct_senior:          parseFloat(pctSenior) || 0,
        pct_partner:         parseFloat(pctPartner) || 30,
        semanas,
        notas:               notas || null,
        status,
        honorarios_override: overrideNums,
      })
      router.refresh()
    })
  }

  // ── Preview PDF ───────────────────────────────────────────────────────────
  async function handlePreviewPDF() {
    const pdfData: PropuestaPDFData = buildPDFData()
    const res = await fetch('/api/propuestas/preview-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pdfData),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  // ── Send to lead ──────────────────────────────────────────────────────────
  async function handleSend() {
    if (!currentLead?.email) {
      setSendError('El lead no tiene email registrado.')
      return
    }
    if (!confirm(`¿Enviar propuesta ${initial.numero} a ${currentLead.email}?`)) return
    setSendError(null)
    setSendOk(false)
    setIsSending(true)
    try {
      const res = await fetch(`/api/propuestas/${initial.id}/enviar`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json.error) {
        setSendError(json.error ?? 'Error al enviar.')
      } else {
        setSendOk(true)
        setStatus('enviada')
        router.refresh()
      }
    } catch {
      setSendError('Error de red.')
    } finally {
      setIsSending(false)
    }
  }

  function buildPDFData(): PropuestaPDFData {
    const overrideNums: Record<string, number> = {}
    for (const [k, v] of Object.entries(honorariosOverride)) {
      if (v !== '') overrideNums[k] = parseFloat(v) || 0
    }
    // Merge manual semanas with auto-calculated days for services not manually set
    const semanasForPdf: Record<string, string> = { ...semanas }
    for (const sid of servicios) {
      if (semanasForPdf[sid] === undefined && diasCalcPorServicio[sid]) {
        semanasForPdf[sid] = `${diasCalcPorServicio[sid]} días hábiles`
      }
    }
    return {
      numero:              initial.numero,
      titulo:              titulo || null,
      fecha_propuesta:     fecha || null,
      direccion:           direccion || null,
      notas:               notas || null,
      servicios,
      m2:                  parseFloat(m2) || 0,
      costo_m2:            parseFloat(costoM2) || 0,
      porcentaje_pem:      parseFloat(pctPem) || 10,
      pct_junior:          parseFloat(pctJunior) || 0,
      pct_senior:          parseFloat(pctSenior) || 70,
      pct_partner:         parseFloat(pctPartner) || 30,
      semanas: semanasForPdf,
      honorarios_override: overrideNums,
      serviciosPlantilla,
      ratios,
      lead: currentLead ? {
        nombre:    currentLead.nombre,
        apellidos: currentLead.apellidos,
        empresa:   currentLead.empresa,
        email:     currentLead.email,
        telefono:  currentLead.telefono,
        direccion: currentLead.direccion,
      } : null,
    }
  }

  function toggleServicio(sid: ServicioId) {
    setServicios(prev =>
      prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]
    )
  }

  const filteredLeads = leads.filter(l => {
    const q = leadSearch.toLowerCase()
    return (
      l.nombre.toLowerCase().includes(q) ||
      l.apellidos.toLowerCase().includes(q) ||
      (l.empresa ?? '').toLowerCase().includes(q)
    )
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>
      {/* ── Header ── */}
      <div style={{
        padding: '32px 40px 24px', background: '#fff',
        borderBottom: '1px solid #E8E6E0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <button
              onClick={() => router.push('/team/captacion/propuestas')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AAA', fontSize: 13, padding: 0 }}
            >
              ← Propuestas
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>
              {titulo || 'Sin título'}
            </h1>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: initial.numero === 'BORRADOR' ? '#CCC' : '#AAA', fontStyle: initial.numero === 'BORRADOR' ? 'italic' : 'normal' }}>
              {initial.numero === 'BORRADOR' ? 'Sin número · se asignará al guardar' : initial.numero}
            </span>
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: `${STATUS_COLOR[status]}18`,
              color: STATUS_COLOR[status],
            }}>
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {sendOk && <span style={{ fontSize: 12, color: '#4CAF50' }}>Enviada correctamente</span>}
          {sendError && <span style={{ fontSize: 12, color: '#E57373' }}>{sendError}</span>}
          <button
            onClick={handlePreviewPDF}
            style={{
              padding: '8px 16px', background: '#fff', color: '#1A1A1A',
              border: '1px solid #E8E6E0', borderRadius: 4, fontSize: 13, cursor: 'pointer',
            }}
          >
            Vista previa PDF
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !currentLead?.email}
            title={!currentLead?.email ? 'El lead no tiene email' : ''}
            style={{
              padding: '8px 16px', background: '#378ADD', color: '#fff',
              border: 'none', borderRadius: 4, fontSize: 13,
              cursor: isSending || !currentLead?.email ? 'not-allowed' : 'pointer',
              opacity: !currentLead?.email ? 0.4 : 1,
            }}
          >
            {isSending ? 'Enviando…' : 'Enviar al lead'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '8px 20px', background: '#1A1A1A', color: '#fff',
              border: 'none', borderRadius: 4, fontSize: 13,
              cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* ── Body: two-column ── */}
      <div className="pd-body-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Left: form ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Sección: Datos generales */}
          <Section title="Datos generales">
            {/* Lead */}
            <Field>
              <Label>Cliente / Lead</Label>
              <button
                onClick={() => setShowLeadModal(true)}
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid #E8E6E0',
                  borderRadius: 4, fontSize: 13, background: '#fff', cursor: 'pointer',
                  textAlign: 'left', color: currentLead ? '#1A1A1A' : '#CCC',
                }}
              >
                {currentLead
                  ? [currentLead.nombre, currentLead.apellidos].filter(Boolean).join(' ') + (currentLead.empresa ? ` · ${currentLead.empresa}` : '')
                  : 'Seleccionar lead…'}
              </button>
              {currentLead?.email && (
                <div style={{ fontSize: 11, color: '#AAA', marginTop: 4 }}>{currentLead.email}</div>
              )}
            </Field>

            <div className="pd-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field>
                <Label>Título del proyecto</Label>
                <input style={inputStyle()} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej. Reforma Calle Mayor…" />
              </Field>
              <Field>
                <Label>Fecha propuesta</Label>
                <input type="date" style={inputStyle()} value={fecha} onChange={e => setFecha(e.target.value)} />
              </Field>
            </div>

            <Field>
              <Label>Dirección del proyecto</Label>
              <input style={inputStyle()} value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, ciudad…" />
            </Field>

            <Field>
              <Label>Estado</Label>
              <select
                style={{ ...inputStyle(), appearance: 'none' as const }}
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </Section>

          {/* Sección: Parámetros económicos */}
          <Section title="Parámetros económicos">
            <div className="pd-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field>
                <Label>Superficie (m²)</Label>
                <input
                  type="number" style={inputStyle()} value={m2}
                  onChange={e => setM2(e.target.value)}
                  placeholder="0" min={0}
                />
              </Field>
              <Field>
                <Label>Coste objetivo €/m²</Label>
                <input
                  type="number" style={inputStyle()} value={costoM2}
                  onChange={e => setCostoM2(e.target.value)}
                  placeholder="0" min={0}
                />
              </Field>
              <Field>
                <Label>% honorarios PEM</Label>
                <input
                  type="number" style={inputStyle()} value={pctPem}
                  onChange={e => setPctPem(e.target.value)}
                  placeholder="10" min={0} max={100} step={0.5}
                />
              </Field>
            </div>
          </Section>

          {/* Sección: Honorarios de interiorismo */}
          <Section title="Honorarios de interiorismo">

            {/* 1. Composición del equipo */}
            <div style={{ marginBottom: 24 }}>
              <Label>Composición del equipo</Label>
              <div className="pd-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
                {[
                  { label: 'Junior', rate: PRECIO_HORA.junior, val: pctJunior, set: setPctJunior },
                  { label: 'Senior', rate: PRECIO_HORA.senior, val: pctSenior, set: setPctSenior },
                  { label: 'Socio',  rate: PRECIO_HORA.socio,  val: pctPartner, set: setPctPartner },
                ].map(({ label: lbl, rate, val, set }) => (
                  <div key={lbl}>
                    <Label>{lbl} · {rate}€/h</Label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        style={{ ...inputStyle(), flex: 1 }}
                        value={val}
                        onChange={e => set(e.target.value)}
                        min={0} max={100}
                      />
                      <span style={{ fontSize: 12, color: '#AAA', flexShrink: 0 }}>%</span>
                    </div>
                  </div>
                ))}
              </div>
              {!equipoSumaOk && (
                <div style={{ fontSize: 11, color: '#E57373', marginTop: 8 }}>
                  La suma debe ser 100% (actual: {(parseFloat(pctJunior||'0')+parseFloat(pctSenior||'0')+parseFloat(pctPartner||'0'))}%)
                </div>
              )}
            </div>

            {/* 2. Horas por fase */}
            {ratiosFases.length === 0 ? (
              <div style={{ fontSize: 12, color: '#CCC', fontStyle: 'italic', marginBottom: 20 }}>
                No hay fases de interiorismo configuradas en la plantilla de proyectos.
              </div>
            ) : (
              <div className="fp-table-wrap" style={{ marginBottom: 20 }}>
                <Label>Horas objetivo por fase</Label>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E8E6E0' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left',  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#CCC' }}>Fase</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#CCC' }}>h/m²</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#CCC' }}>Horas ({parseFloat(m2)||0} m²)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fasesCalc.map(f => (
                      <tr key={f.id} style={{ borderBottom: '1px solid #F8F7F4' }}>
                        <td style={{ padding: '7px 8px', color: '#555' }}>{f.label}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888', fontFamily: 'monospace' }}>{f.ratio.toFixed(3)}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', color: '#555', fontFamily: 'monospace' }}>
                          {f.horas > 0 ? `${f.horas.toFixed(1)} h` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #E8E6E0', background: '#F8F7F4' }}>
                      <td style={{ padding: '8px 8px', fontSize: 11, fontWeight: 700, color: '#1A1A1A' }}>Total horas</td>
                      <td />
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#1A1A1A' }}>
                        {totalHorasFases > 0 ? `${totalHorasFases.toFixed(1)} h` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* 3. Distribución por seniority */}
            {totalHorasFases > 0 && (
              <div className="fp-table-wrap" style={{ marginBottom: 24 }}>
                <Label>Distribución del coste por perfil</Label>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E8E6E0' }}>
                      {['Perfil', '%', 'Horas', '€/h', 'Importe'].map((h, i) => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: i === 0 ? 'left' : 'right', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#CCC' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {equipoDistribucion.map(row => (
                      <tr key={row.label} style={{ borderBottom: '1px solid #F8F7F4' }}>
                        <td style={{ padding: '7px 8px', color: '#555' }}>{row.label}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888' }}>{row.pct}%</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', color: '#555', fontFamily: 'monospace' }}>
                          {row.horas > 0 ? `${row.horas.toFixed(1)} h` : '—'}
                        </td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', color: '#888' }}>{row.rate}€</td>
                        <td style={{ padding: '7px 8px', textAlign: 'right', color: '#1A1A1A', fontWeight: 500 }}>
                          {row.horas > 0 ? fmtEur(row.horas * row.rate) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #E8E6E0', background: '#F8F7F4' }}>
                      <td style={{ padding: '8px 8px', fontSize: 11, fontWeight: 700, color: '#1A1A1A' }}>Total calculado</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontSize: 11, color: equipoSumaOk ? '#AAA' : '#E57373' }}>
                        {(parseFloat(pctJunior||'0')+parseFloat(pctSenior||'0')+parseFloat(pctPartner||'0'))}%
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#1A1A1A' }}>
                        {totalHorasFases.toFixed(1)} h
                      </td>
                      <td />
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: '#D85A30', fontSize: 13 }}>
                        {totalImporteFases > 0 ? fmtEur(totalImporteFases) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* 4. Ajuste manual por servicio */}
            <div style={{ borderTop: '1px solid #F0EEE8', paddingTop: 20 }}>
              <Label>Honorario propuesto</Label>
              <p style={{ fontSize: 11, color: '#AAA', margin: '4px 0 14px', lineHeight: 1.5 }}>
                El importe calculado se pre-rellena. Puedes ajustarlo para aplicar descuentos o modificar la propuesta final.
              </p>
              {(() => {
                const ratioInter  = ratiosFases.filter(r => (r.seccion ?? '').toLowerCase().includes('interiorismo') && !(r.label ?? '').toLowerCase().includes('gesti')).reduce((s, r) => s + (r.ratio ?? 0), 0)
                const ratioGesti  = ratiosFases.filter(r => (r.seccion ?? '').toLowerCase().includes('interiorismo') &&  (r.label ?? '').toLowerCase().includes('gesti')).reduce((s, r) => s + (r.ratio ?? 0), 0)
                const ratioTotal  = ratioInter + ratioGesti
                const pctInter    = ratioTotal > 0 ? ratioInter / ratioTotal : 1
                const pctGesti    = ratioTotal > 0 ? ratioGesti / ratioTotal : 0
                const autoByServ: Record<string, number> = {
                  interiorismo:        totalImporteFases * pctInter,
                  gestion_interiorismo: totalImporteFases * pctGesti,
                }
                return (['interiorismo', 'gestion_interiorismo'] as ServicioId[]).map(sid => {
                const ptilla    = serviciosPlantilla.find(s => s.id === sid)
                const autoCalc  = autoByServ[sid] ?? 0
                const ov        = honorariosOverride[sid] ?? ''
                const displayed = ov !== '' ? parseFloat(ov) : autoCalc
                const isModified = ov !== '' && Math.round(parseFloat(ov)) !== Math.round(autoCalc)
                const diff = displayed - autoCalc
                return (
                  <div key={sid} className="pd-honorario-row" style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16, alignItems: 'start', marginBottom: 16, padding: '14px 16px', background: '#F8F7F4', borderRadius: 6, border: `1px solid ${isModified ? '#D85A30' : '#E8E6E0'}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 3 }}>{ptilla?.label ?? sid}</div>
                      {autoCalc > 0
                        ? <div style={{ fontSize: 11, color: '#AAA' }}>Cálculo automático: <strong>{fmtEur(autoCalc)}</strong></div>
                        : <div style={{ fontSize: 11, color: '#CCC', fontStyle: 'italic' }}>Sin ratios — introduce el importe manualmente</div>
                      }
                      {isModified && (
                        <div style={{ fontSize: 11, marginTop: 4, color: diff < 0 ? '#4CAF50' : '#E57373' }}>
                          {diff < 0 ? `Descuento de ${fmtEur(Math.abs(diff))}` : `Incremento de ${fmtEur(diff)}`}
                          {' · '}
                          <button
                            onClick={() => setHonorariosOverride(prev => { const n = {...prev}; delete n[sid]; return n })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#D85A30', padding: 0, textDecoration: 'underline' }}
                          >
                            Restablecer
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number"
                          style={{ ...inputStyle(), flex: 1, fontWeight: isModified ? 600 : 400, borderColor: isModified ? '#D85A30' : '#E8E6E0' }}
                          value={ov !== '' ? ov : (autoCalc > 0 ? String(Math.round(autoCalc)) : '')}
                          placeholder={autoCalc > 0 ? String(Math.round(autoCalc)) : '0'}
                          min={0}
                          onChange={e => {
                            const val = e.target.value
                            if (val === '' || (autoCalc > 0 && Math.round(parseFloat(val)) === Math.round(autoCalc))) {
                              setHonorariosOverride(prev => { const n = {...prev}; delete n[sid]; return n })
                            } else {
                              setHonorariosOverride(prev => ({ ...prev, [sid]: val }))
                            }
                          }}
                        />
                        <span style={{ fontSize: 12, color: '#AAA', flexShrink: 0 }}>€</span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#D85A30', textAlign: 'right', marginTop: 4 }}>
                        {fmtEur(displayed)}
                      </div>
                    </div>
                  </div>
                )
              })
              })()}
            </div>
          </Section>

          {/* Sección: Servicios */}
          <Section title="Servicios contratados">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {serviciosPlantilla.map(entry => {
                const sid     = entry.id
                const checked = servicios.includes(sid as any)
                const isManual = entry.tipo === 'manual'
                const tipoBadge = entry.tipo === 'pem'
                  ? `${(entry.pem_split * 100).toFixed(0)}% PEM`
                  : entry.tipo === 'ratio' ? 'Ratio' : 'Manual'
                return (
                  <div key={sid} style={{
                    border: '1px solid', borderColor: checked ? '#1A1A1A' : '#E8E6E0',
                    borderRadius: 6, padding: '12px 16px', cursor: 'pointer',
                    background: checked ? '#F8F7F4' : '#fff', transition: 'all 0.15s',
                  }}
                    onClick={() => toggleServicio(sid as any)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: 3,
                          border: '1.5px solid', borderColor: checked ? '#1A1A1A' : '#CCC',
                          background: checked ? '#1A1A1A' : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {checked && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>{entry.label}</span>
                        <span style={{ fontSize: 10, color: '#AAA', background: '#F0EEE8', padding: '2px 8px', borderRadius: 20 }}>
                          {tipoBadge}
                        </span>
                      </div>
                      {checked && !isManual && (calc || honorariosOverride[sid]) && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#D85A30' }}>
                          {fmtEur(effectiveAmount(sid))}
                        </span>
                      )}
                    </div>

                    {/* Horas estimadas + pipeline (pipeline solo en anteproyecto) */}
                    {(horasEstimadas[sid] && (parseFloat(m2) || 0) > 0) || sid === 'anteproyecto' ? (
                      <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {horasEstimadas[sid] && (parseFloat(m2) || 0) > 0 && sid !== 'direccion_obra' && sid !== 'gestion_interiorismo' && (() => {
                          const personas = parseInt(personasPorServicio[sid] ?? '2') || 1
                          const dias     = Math.round(horasEstimadas[sid].horas * 1.25 / (personas * 8))
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                              onClick={e => e.stopPropagation()}
                            >
                              <span style={{ fontSize: 11, color: '#888' }}>~{horasEstimadas[sid].horas} hh</span>
                              <span style={{ fontSize: 11, color: '#BBB' }}>·</span>
                              <span style={{ fontSize: 11, color: '#AAA' }}>{horasEstimadas[sid].ratio} h/m²</span>
                              <span style={{ fontSize: 11, color: '#BBB' }}>·</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <input
                                  type="number" min={1}
                                  value={personasPorServicio[sid] ?? '2'}
                                  onChange={e => setPersonasPorServicio(prev => ({ ...prev, [sid]: e.target.value }))}
                                  style={{ width: 32, fontSize: 10, border: '1px solid #E0DDD6', borderRadius: 3, padding: '1px 4px', textAlign: 'center' }}
                                />
                                <span style={{ fontSize: 9, color: '#BBB' }}>pers.</span>
                              </div>
                              <span style={{ fontSize: 11, color: '#BBB' }}>·</span>
                              <span style={{ fontSize: 11, color: '#1A1A1A', fontWeight: 500 }}>~{dias} días</span>
                            </div>
                          )
                        })()}
                        {sid === 'anteproyecto' && (() => {
                          const horasPipeline = Math.round(
                            (pipelineHoras['anteproyecto'] ?? 0) +
                            (pipelineHoras['proyecto_ejecucion'] ?? 0) +
                            (pipelineHoras['interiorismo'] ?? 0) +
                            (pipelineHoras['gestion_interiorismo'] ?? 0)
                          )
                          if (horasPipeline === 0) return null
                          const byProyecto: Record<string, number> = {}
                          for (const item of pipelineDetalle) {
                            byProyecto[item.proyectoNombre] = (byProyecto[item.proyectoNombre] ?? 0) + item.horasRestantes
                          }
                          const horasTeorico    = Math.round(horasPipeline * 1.25)
                          const horasAnte       = horasEstimadas['anteproyecto']?.horas ?? 0
                          const personasNuevo   = parseInt(personasPorServicio['anteproyecto'] ?? '2') || 1
                          const totalFinal      = horasTeorico + horasAnte
                          const diasFinales     = Math.round(totalFinal / (personasNuevo * 8))

                          return (
                            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}
                              onClick={e => e.stopPropagation()}
                            >
                              {/* ── Proyectos activos ── */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>
                                  Pipeline activo — {horasPipeline} hh
                                </span>
                                <div style={{ paddingLeft: 8, borderLeft: '2px solid #F0EEE8', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {Object.entries(byProyecto).map(([nombre, horas]) => {
                                    const personas = parseInt(personasPorProyecto[nombre] ?? '2') || 1
                                    return (
                                      <div key={nombre} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 10, color: '#888', fontWeight: 500 }}>{nombre}</span>
                                        <span style={{ fontSize: 10, color: '#D85A30' }}>{horas} hh</span>
                                        <span style={{ fontSize: 10, color: '#BBB' }}>·</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                          <input
                                            type="number" min={1}
                                            value={personasPorProyecto[nombre] ?? '2'}
                                            onChange={e => setPersonasPorProyecto(prev => ({ ...prev, [nombre]: e.target.value }))}
                                            style={{ width: 32, fontSize: 10, border: '1px solid #E0DDD6', borderRadius: 3, padding: '1px 4px', textAlign: 'center' }}
                                          />
                                          <span style={{ fontSize: 9, color: '#BBB' }}>pers.</span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* ── Coef. minoración ── */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 1, background: '#F0EEE8' }} />
                                <span style={{ fontSize: 9, color: '#BBB', letterSpacing: '0.06em' }}>× 1.25 coef. minoración</span>
                                <div style={{ flex: 1, height: 1, background: '#F0EEE8' }} />
                              </div>

                              {/* ── Pipeline teórico ── */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ background: '#FFF4F0', border: '1px solid #F5C4B0', borderRadius: 4, padding: '4px 10px' }}>
                                  <span style={{ fontSize: 11, color: '#D85A30', fontWeight: 600 }}>{horasTeorico} hh</span>
                                </div>
                                <span style={{ fontSize: 10, color: '#AAA' }}>pipeline teórico</span>
                              </div>

                              {/* ── + Este anteproyecto ── */}
                              {horasAnte > 0 && (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ flex: 1, height: 1, background: '#F0EEE8' }} />
                                    <span style={{ fontSize: 9, color: '#BBB', letterSpacing: '0.06em' }}>+ este anteproyecto</span>
                                    <div style={{ flex: 1, height: 1, background: '#F0EEE8' }} />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={{ background: '#F8F7F4', border: '1px solid #E8E6E0', borderRadius: 4, padding: '4px 10px' }}>
                                      <span style={{ fontSize: 11, color: '#888' }}>{horasAnte} hh</span>
                                    </div>
                                    <span style={{ fontSize: 10, color: '#AAA' }}>estimadas · {(parseFloat(m2) || 0) > 0 && `${horasEstimadas['anteproyecto']?.ratio} h/m²`}</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginLeft: 4 }}>
                                      <span style={{ fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#AAA' }}>Equipo en este proyecto</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <input
                                          type="number" min={1}
                                          value={personasPorServicio['anteproyecto'] ?? '2'}
                                          onChange={e => setPersonasPorServicio(prev => ({ ...prev, anteproyecto: e.target.value }))}
                                          style={{ width: 44, fontSize: 13, fontWeight: 600, border: '1.5px solid #D0CEC8', borderRadius: 4, padding: '3px 6px', textAlign: 'center', color: '#1A1A1A' }}
                                        />
                                        <span style={{ fontSize: 10, color: '#888' }}>personas</span>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}

                              {/* ── Total → días ── */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 1, background: '#1A1A1A', opacity: 0.12 }} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ background: '#1A1A1A', borderRadius: 4, padding: '6px 14px' }}>
                                  <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>~{diasFinales} días</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  <span style={{ fontSize: 10, color: '#888' }}>{totalFinal} hh totales · {personasNuevo} pers. · 8 h/día</span>
                                  <span style={{ fontSize: 9, color: '#BBB' }}>{horasTeorico} hh teórico + {horasAnte} hh proyecto</span>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    ) : null}

                    {/* Custom/manual service: inline price input */}
                    {checked && isManual && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0EEE8' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <Label>Honorario (€)</Label>
                            <input
                              type="number"
                              style={{ ...inputStyle(), maxWidth: 180 }}
                              value={honorariosOverride[sid] ?? ''}
                              onChange={e => {
                                const v = e.target.value
                                setHonorariosOverride(prev =>
                                  v === '' ? (({ [sid]: _, ...rest }) => rest)(prev) : { ...prev, [sid]: v }
                                )
                              }}
                              placeholder="0"
                              min={0}
                            />
                          </div>
                          {effectiveAmount(sid) > 0 && (
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#D85A30', alignSelf: 'flex-end', paddingBottom: 2 }}>
                              {fmtEur(effectiveAmount(sid))}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Plazo por servicio */}
                    {checked && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0EEE8' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <Label>Plazo estimado (días hábiles)</Label>
                        {(() => {
                          const hEst = horasEstimadas[sid]
                          const m2n  = parseFloat(m2) || 0
                          const pers = parseInt(personasPorServicio[sid] ?? '2') || 1
                          let diasCalc: string | null = null
                          if (hEst && m2n > 0 && sid !== 'direccion_obra' && sid !== 'gestion_interiorismo') {
                            if (sid === 'anteproyecto') {
                              const horasPipeline = Math.round(
                                (pipelineHoras['anteproyecto'] ?? 0) +
                                (pipelineHoras['proyecto_ejecucion'] ?? 0) +
                                (pipelineHoras['interiorismo'] ?? 0) +
                                (pipelineHoras['gestion_interiorismo'] ?? 0)
                              )
                              const horasTeorico = Math.round(horasPipeline * 1.25)
                              const total = horasTeorico + hEst.horas
                              diasCalc = String(Math.round(total / (pers * 8)))
                            } else {
                              diasCalc = String(Math.round(hEst.horas * 1.25 / (pers * 8)))
                            }
                          }
                          return (
                            <input
                              style={{ ...inputStyle(), width: 'auto', minWidth: 200 }}
                              value={semanas[sid] !== undefined ? semanas[sid] : (diasCalc ?? entry.semanas_default ?? '')}
                              onChange={e => setSemanas(prev => ({ ...prev, [sid]: e.target.value }))}
                              placeholder={diasCalc ?? entry.semanas_default ?? 'Ej. 15–20 días hábiles'}
                            />
                          )
                        })()}
                      </div>
                    )}

                    {/* Hitos de pago */}
                    {checked && entry.pago && entry.pago.length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0EEE8' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', display: 'block', marginBottom: 6 }}>
                          Estructura de facturación · {entry.pago.length} hitos
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {entry.pago.map((p: { label: string; pct: number }, i: number) => {
                            const importeHito = effectiveAmount(sid) > 0
                              ? Math.round(effectiveAmount(sid) * p.pct / 100 * 100) / 100
                              : null
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 10, color: '#AAA', minWidth: 32, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                  {p.pct}%
                                </span>
                                <span style={{ fontSize: 11, color: '#555', flex: 1 }}>{p.label}</span>
                                {importeHito !== null && (
                                  <span style={{ fontSize: 11, color: '#D85A30', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                    {fmtEur(importeHito)}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Sección: Notas */}
          <Section title="Notas internas">
            <textarea
              style={{
                ...inputStyle(), resize: 'vertical' as const,
                minHeight: 80, fontFamily: "'Inter', system-ui, sans-serif",
              }}
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones, condiciones especiales…"
            />
          </Section>
        </div>

        {/* ── Right: resumen económico ── */}
        <div className="pd-sidebar" style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: '#1A1A1A' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>
                Resumen económico
              </div>
              <div style={{ fontSize: 22, fontWeight: 200, color: '#F0EDE8' }}>
                {servicios.length > 0 && (calc || Object.keys(honorariosOverride).length > 0) ? fmtEur(effectiveTotal) : '—'}
              </div>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {/* PEM */}
              {calc && (
                <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #F0EEE8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#AAA' }}>PEM estimado</span>
                    <span style={{ fontSize: 11, color: '#555', fontWeight: 500 }}>{fmtEur(calc.pem)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#AAA' }}>Honorarios PEM base ({pctPem}%)</span>
                    <span style={{ fontSize: 11, color: '#555', fontWeight: 500 }}>{fmtEur(calc.honorariosPemBase)}</span>
                  </div>
                </div>
              )}

              {/* Por servicio */}
              {servicios.length === 0 && (
                <div style={{ fontSize: 12, color: '#CCC', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
                  Selecciona servicios
                </div>
              )}
              {[...servicios].sort((a, b) => {
                const ia = SERVICIO_IDS.indexOf(a as ServicioId)
                const ib = SERVICIO_IDS.indexOf(b as ServicioId)
                const ra = ia === -1 ? 999 : ia
                const rb = ib === -1 ? 999 : ib
                return ra - rb
              }).map(sid => {
                const auto      = calc?.breakdown[sid as ServicioId] ?? 0
                const effective = effectiveAmount(sid)
                const hasOverride = honorariosOverride[sid] !== undefined && honorariosOverride[sid] !== ''
                const ptilla    = serviciosPlantilla.find(s => s.id === sid)
                return (
                  <div key={sid} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#1A1A1A' }}>{ptilla?.label ?? sid}</div>
                      <div style={{ fontSize: 10, color: '#AAA' }}>{semanas[sid] !== undefined ? semanas[sid] : (diasCalcPorServicio[sid] ? `${diasCalcPorServicio[sid]} días hábiles` : ptilla?.semanas_default)}</div>
                      {hasOverride && (
                        <div style={{ fontSize: 10, color: '#D85A30' }}>modificado · auto: {fmtEur(auto)}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: hasOverride ? '#D85A30' : '#1A1A1A', textAlign: 'right' }}>
                      {fmtEur(effective)}
                    </div>
                  </div>
                )
              })}

              {/* Total line */}
              {servicios.length > 0 && (calc || true) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #E8E6E0', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Total</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#D85A30' }}>{fmtEur(effectiveTotal)}</span>
                </div>
              )}
            </div>

            {/* Info box */}
            {(!parseFloat(m2) || !parseFloat(costoM2)) && (
              <div style={{ padding: '12px 20px', background: '#FFF8F0', borderTop: '1px solid #FFE0CC' }}>
                <div style={{ fontSize: 11, color: '#D85A30', lineHeight: 1.5 }}>
                  Introduce m² y coste objetivo para ver el cálculo en tiempo real.
                </div>
              </div>
            )}
          </div>

          {/* Datos del lead */}
          {currentLead && (
            <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '16px 20px', marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 12 }}>
                Datos del cliente
              </div>
              {[
                { label: 'Nombre', value: `${currentLead.nombre} ${currentLead.apellidos}` },
                { label: 'Empresa', value: currentLead.empresa },
                { label: 'Email', value: currentLead.email },
                { label: 'Teléfono', value: currentLead.telefono },
                { label: 'Dirección', value: currentLead.direccion },
              ].filter(r => r.value).map(r => (
                <div key={r.label} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#AAA', marginBottom: 2 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: '#1A1A1A' }}>{r.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Lead modal ── */}
      {showLeadModal && (
        <div
          className="captacion-modal-overlay"
          onClick={() => setShowLeadModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            className="captacion-modal-box"
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: 'min(440px, 92vw)', maxHeight: '65vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
          >
            <div style={{ padding: '20px 20px 0' }}>
              <h3 style={{ fontSize: 15, fontWeight: 400, margin: '0 0 12px', color: '#1A1A1A' }}>Seleccionar lead</h3>
              <input
                autoFocus
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                placeholder="Buscar…"
                style={{ ...inputStyle(), marginBottom: 8 }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <button
                onClick={() => { setLeadId(null); setShowLeadModal(false) }}
                style={{ width: '100%', padding: '10px 20px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #F0EEE8', cursor: 'pointer', fontSize: 12, color: '#AAA', fontStyle: 'italic' }}
              >
                Sin cliente
              </button>
              {filteredLeads.map(l => (
                <button
                  key={l.id}
                  onClick={() => { setLeadId(l.id); setShowLeadModal(false) }}
                  style={{ width: '100%', padding: '10px 20px', textAlign: 'left', background: leadId === l.id ? '#F8F7F4' : 'none', border: 'none', borderBottom: '1px solid #F0EEE8', cursor: 'pointer', fontSize: 13 }}
                >
                  <span style={{ color: '#1A1A1A' }}>{l.nombre} {l.apellidos}</span>
                  {l.empresa && <span style={{ color: '#AAA', marginLeft: 8 }}>· {l.empresa}</span>}
                  {l.email && <div style={{ fontSize: 11, color: '#CCC', marginTop: 2 }}>{l.email}</div>}
                </button>
              ))}
            </div>
            <div style={{ padding: '10px 20px', borderTop: '1px solid #E8E6E0' }}>
              <button onClick={() => setShowLeadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#AAA' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '24px', marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #F0EEE8' }}>
        {title}
      </div>
      {children}
    </div>
  )
}
