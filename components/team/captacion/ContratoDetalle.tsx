'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { updateContrato, firmarContrato } from '@/app/actions/contratos'
import type { Honorario } from '@/app/actions/contratos'
import { SERVICIO_IDS, SERVICIOS_CONFIG } from '@/lib/propuestas/config'
import type { ServicioId } from '@/lib/propuestas/config'
import type { ServicioContrato } from '@/components/pdfs/ContratoPDF'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: string; nombre: string; apellidos: string | null; empresa: string | null
  nif_cif: string | null; email: string | null; email_cc: string | null
  telefono: string | null; telefono_alt: string | null; direccion: string | null
  ciudad: string | null; codigo_postal: string | null; pais: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Contrato = Record<string, any>

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  borrador:    { label: 'Borrador',    color: '#888',    bg: '#F0EEE8' },
  enviado:     { label: 'Enviado',     color: '#378ADD', bg: '#EEF4FD' },
  negociacion: { label: 'Negociación', color: '#9B59B6', bg: '#F5EEFB' },
  firmado:     { label: 'Firmado',     color: '#1D9E75', bg: '#EEF8F4' },
  cancelado:   { label: 'Cancelado',   color: '#E53E3E', bg: '#FEF2F2' },
}

const STATUS_ORDER = ['borrador', 'enviado', 'negociacion', 'firmado', 'cancelado']

const DEFAULT_CUERPO_TEXTO = `CONDICIONES GENERALES DEL CONTRATO DE SERVICIOS PROFESIONALES

PRIMERA. OBJETO DEL CONTRATO
El presente contrato tiene por objeto la prestación de los servicios profesionales de arquitectura e interiorismo detallados en el apartado de honorarios y facturación, conforme a las condiciones acordadas entre las partes.

SEGUNDA. OBLIGACIONES DEL ESTUDIO
El estudio se compromete a ejecutar los servicios contratados con la diligencia y competencia profesional exigibles, manteniendo informado al cliente de cualquier circunstancia relevante que afecte al desarrollo del proyecto, y respetando los plazos acordados salvo causa de fuerza mayor o modificaciones solicitadas por el cliente.

TERCERA. OBLIGACIONES DEL CLIENTE
El cliente facilitará al estudio toda la documentación, accesos e información necesarios para el correcto desarrollo de los servicios. Asimismo, tomará las decisiones requeridas en los plazos acordados, siendo responsable de los retrasos derivados de una demora en dichas decisiones.

CUARTA. HONORARIOS Y FORMA DE PAGO
Los honorarios y el calendario de pagos acordados se detallan en el apartado de estructura de honorarios y facturación del presente contrato. Las facturas serán abonadas en el plazo máximo de 30 días naturales desde su emisión. El impago de cualquier factura en su fecha de vencimiento faculta al estudio a paralizar los trabajos hasta la regularización de la deuda, sin que ello genere responsabilidad alguna frente al cliente.

QUINTA. PROPIEDAD INTELECTUAL
Todos los proyectos, planos, diseños, renders, memorias y documentos elaborados por el estudio son de su exclusiva propiedad intelectual hasta el abono íntegro de los honorarios acordados. Una vez satisfechos la totalidad de los honorarios, el cliente adquiere el derecho de uso de la documentación para el proyecto objeto del presente contrato, sin posibilidad de cesión a terceros sin consentimiento expreso del estudio.

SEXTA. CONFIDENCIALIDAD
Ambas partes se comprometen a mantener la más estricta confidencialidad sobre la información intercambiada en el marco del presente contrato, y a no divulgarla a terceros sin consentimiento previo y por escrito de la otra parte. Esta obligación se mantendrá vigente durante la ejecución del contrato y durante los tres años siguientes a su finalización.

SÉPTIMA. MODIFICACIONES DEL ALCANCE
Cualquier modificación del alcance de los servicios respecto a lo inicialmente acordado deberá formalizarse por escrito entre las partes, mediante adenda al presente contrato. Dichas modificaciones podrán dar lugar a una revisión de los honorarios y plazos pactados.

OCTAVA. RESOLUCIÓN DEL CONTRATO
Cualquiera de las partes podrá resolver el presente contrato mediante comunicación escrita con un preaviso mínimo de 15 días naturales. En caso de resolución por iniciativa del cliente, éste abonará los honorarios proporcionales a los trabajos realizados hasta la fecha efectiva de resolución. En caso de resolución por causa imputable al estudio, éste reintegrará los honorarios percibidos por trabajos no realizados.

NOVENA. PROTECCIÓN DE DATOS
Los datos personales facilitados por las partes serán tratados conforme al Reglamento (UE) 2016/679 (RGPD) y la normativa española de protección de datos vigente, utilizándose exclusivamente para la gestión y ejecución del presente contrato.

DÉCIMA. JURISDICCIÓN Y LEY APLICABLE
El presente contrato se rige por la legislación española. Las partes, con renuncia expresa a cualquier otro fuero que pudiera corresponderles, se someten a los Juzgados y Tribunales de la ciudad donde radique el domicilio del estudio para resolver cualquier controversia derivada de la interpretación o ejecución del presente contrato.`


const TIPOS_PROYECTO = [
  'Vivienda unifamiliar',
  'Vivienda en bloque',
  'Reforma integral',
  'Reforma parcial',
  'Interiorismo',
  'Local comercial',
  'Oficina',
  'Otro',
]

// ── Styles ────────────────────────────────────────────────────────────────────

const INP: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 10px', fontSize: 12,
  border: '1px solid #E8E6E0', borderRadius: 4, background: '#fff',
  fontFamily: 'inherit', color: '#1A1A1A', outline: 'none',
}

const LBL: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#AAA', marginBottom: 4, display: 'block',
}

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: '#D85A30', marginBottom: 14,
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', disabled = false, mono = false,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; disabled?: boolean; mono?: boolean
}) {
  return (
    <div>
      <span style={LBL}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{ ...INP, fontFamily: mono ? 'monospace' : 'inherit', background: disabled ? '#F8F7F4' : '#fff', color: disabled ? '#888' : '#1A1A1A' }}
      />
    </div>
  )
}

// ── Working days helper ───────────────────────────────────────────────────────

function addWorkingDays(startDate: Date, days: number): Date {
  const date = new Date(startDate)
  let added = 0
  while (added < days) {
    date.setDate(date.getDate() + 1)
    const dow = date.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return date
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── Honorarios table ──────────────────────────────────────────────────────────

function HonorariosTable({
  honorarios,
  onChange,
  disabled,
}: {
  honorarios: Honorario[]
  onChange: (h: Honorario[]) => void
  disabled: boolean
}) {
  const total = honorarios.reduce((s, h) => s + (h.importe ?? 0), 0)

  const update = (i: number, field: keyof Honorario, value: unknown) => {
    onChange(honorarios.map((h, idx) => idx === i ? { ...h, [field]: value } : h))
  }

  const addLine = () => {
    onChange([...honorarios, { seccion: 'Anteproyecto', descripcion: '', importe: 0, fecha_pago_acordada: null }])
  }

  const removeLine = (i: number) => {
    onChange(honorarios.filter((_, idx) => idx !== i))
  }

  const TH: React.CSSProperties = {
    padding: '8px 12px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
    borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left',
  }

  const TD: React.CSSProperties = {
    padding: '8px 12px', fontSize: 12, verticalAlign: 'middle',
    borderBottom: '1px solid #F0EEE8',
  }

  const cellInp: React.CSSProperties = {
    background: 'transparent', border: '1px solid transparent', borderRadius: 3,
    padding: '2px 6px', fontSize: 12, fontFamily: 'inherit', outline: 'none',
    width: '100%', color: '#1A1A1A',
  }

  return (
    <div className="fp-table-wrap" style={{ border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#1A1A1A' }}>
            <th style={{ ...TH, width: 180 }}>Sección / Fase</th>
            <th style={TH}>Descripción de servicios</th>
            <th style={{ ...TH, width: 120, textAlign: 'right' }}>Honorarios (€)</th>
            <th style={{ ...TH, width: 140 }}>Fecha de pago acordada</th>
            {!disabled && <th style={{ ...TH, width: 36 }} />}
          </tr>
        </thead>
        <tbody>
          {honorarios.length === 0 && (
            <tr>
              <td colSpan={disabled ? 4 : 5} style={{ ...TD, textAlign: 'center', color: '#CCC', fontStyle: 'italic', padding: '24px 0', borderBottom: 'none' }}>
                Sin líneas de honorarios. Añade la primera.
              </td>
            </tr>
          )}
          {honorarios.map((h, i) => (
            <tr key={i}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <td style={TD}>
                <span style={{ fontWeight: 500 }}>{h.seccion}</span>
              </td>
              <td style={TD}>
                {disabled ? (
                  <span>{h.descripcion || '—'}</span>
                ) : (
                  <input
                    type="text"
                    value={h.descripcion}
                    onChange={e => update(i, 'descripcion', e.target.value)}
                    placeholder="Descripción detallada…"
                    style={cellInp}
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8913A' }}
                    onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
                  />
                )}
              </td>
              <td style={{ ...TD, textAlign: 'right' }}>
                {disabled ? (
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(h.importe)}
                  </span>
                ) : (
                  <input
                    type="number"
                    min={0}
                    value={h.importe}
                    onChange={e => update(i, 'importe', parseFloat(e.target.value) || 0)}
                    style={{ ...cellInp, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8913A' }}
                    onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
                  />
                )}
              </td>
              <td style={TD}>
                {disabled ? (
                  <span>{h.fecha_pago_acordada ? h.fecha_pago_acordada.split('-').reverse().join('/') : '—'}</span>
                ) : (
                  <input
                    type="date"
                    value={h.fecha_pago_acordada ?? ''}
                    onChange={e => update(i, 'fecha_pago_acordada', e.target.value || null)}
                    style={{ ...cellInp }}
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8913A' }}
                    onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
                  />
                )}
              </td>
              {!disabled && (
                <td style={{ ...TD, padding: '0 8px' }}>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DDD', fontSize: 15, padding: '2px 4px' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#DDD' }}
                  >×</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8F7F4', borderTop: '2px solid #E8E6E0' }}>
        {!disabled ? (
          <button
            type="button"
            onClick={addLine}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#AAA', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 5 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D85A30' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Añadir línea de honorarios
          </button>
        ) : <span />}
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginRight: 16 }}>
            Total honorarios
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
            € {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(total)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContratoDetalle({
  contrato: initial,
  leads,
}: {
  contrato: Contrato
  leads: Lead[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isFirmado = initial.status === 'firmado'
  const isCancelado = initial.status === 'cancelado'
  const isReadonly = isFirmado || isCancelado

  // ── Emisor ────────────────────────────────────────────────────────────────
  const [emisorNombre,    setEmisorNombre]    = useState(initial.emisor_nombre    ?? '')
  const [emisorNif,       setEmisorNif]       = useState(initial.emisor_nif       ?? '')
  const [emisorDireccion, setEmisorDireccion] = useState(initial.emisor_direccion ?? '')
  const [emisorCiudad,    setEmisorCiudad]    = useState(initial.emisor_ciudad    ?? '')
  const [emisorCp,        setEmisorCp]        = useState(initial.emisor_cp        ?? '')
  const [emisorEmail,     setEmisorEmail]     = useState(initial.emisor_email     ?? '')
  const [emisorTelefono,  setEmisorTelefono]  = useState(initial.emisor_telefono  ?? '')

  // ── Cliente ───────────────────────────────────────────────────────────────
  const [tipoCliente, setTipoCliente] = useState<'fisica' | 'juridica'>(
    (initial.contenido?.tipo_cliente as 'fisica' | 'juridica') ?? (initial.cliente_empresa ? 'juridica' : 'fisica')
  )
  const [selectedLeadId,   setSelectedLeadId]   = useState(initial.lead_id ?? '')
  const [clienteNombre,    setClienteNombre]    = useState(initial.cliente_nombre    ?? '')
  const [clienteApellidos, setClienteApellidos] = useState(initial.cliente_apellidos ?? '')
  const [clienteEmpresa,   setClienteEmpresa]   = useState(initial.cliente_empresa   ?? '')
  const [clienteNif,       setClienteNif]       = useState(initial.cliente_nif       ?? '')
  const [clienteEmail,     setClienteEmail]     = useState(initial.cliente_email     ?? '')
  const [clienteTelefono,  setClienteTelefono]  = useState(initial.cliente_telefono  ?? '')
  const [clienteDireccion, setClienteDireccion] = useState(initial.cliente_direccion ?? '')
  const [clienteCiudad,    setClienteCiudad]    = useState(initial.cliente_ciudad    ?? '')
  const [clienteCp,        setClienteCp]        = useState(initial.cliente_cp        ?? '')
  const [clientePais,      setClientePais]      = useState(initial.cliente_pais      ?? '')

  // ── Proyecto ──────────────────────────────────────────────────────────────
  const [proyectoNombre,     setProyectoNombre]     = useState(initial.proyecto_nombre     ?? '')
  const [proyectoCodigo,     setProyectoCodigo]     = useState(initial.proyecto_codigo     ?? '')
  const [proyectoDireccion,  setProyectoDireccion]  = useState(initial.proyecto_direccion  ?? '')
  const [proyectoTipo,       setProyectoTipo]       = useState(initial.proyecto_tipo       ?? '')
  const [proyectoSuperficie, setProyectoSuperficie] = useState(String(initial.proyecto_superficie ?? ''))

  // ── Contract state ────────────────────────────────────────────────────────
  const [status,      setStatus]     = useState(initial.status    ?? 'borrador')
  const [fechaEnvio,  setFechaEnvio]  = useState(initial.fecha_envio  ?? '')
  const [fechaFirma,  setFechaFirma]  = useState(initial.fecha_firma  ?? '')
  const [notas,       setNotas]       = useState(initial.notas         ?? '')
  const [honorarios,  setHonorarios]  = useState<Honorario[]>(initial.honorarios ?? [])
  const [cuerpoTexto, setCuerpoTexto] = useState<string>(
    (initial.contenido?.cuerpo_texto as string | undefined) ?? DEFAULT_CUERPO_TEXTO
  )
  const [serviciosEdit, setServiciosEdit] = useState<ServicioContrato[]>(
    (initial.contenido?.servicios ?? []) as ServicioContrato[]
  )
  const serviciosBase = useRef<ServicioContrato[]>((initial.contenido?.servicios ?? []) as ServicioContrato[])

  // ── Contenido JSONB — tracked via ref so partial saves don't clobber each other
  const contenidoRef = useRef<Record<string, unknown>>(initial.contenido ?? {})
  const saveContenido = (patch: Record<string, unknown>) => {
    contenidoRef.current = { ...contenidoRef.current, ...patch }
    scheduleAutoSave({ contenido: contenidoRef.current } as Parameters<typeof updateContrato>[1])
  }

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving,          setSaving]          = useState(false)
  const [firmandoLoading, setFirmandoLoading] = useState(false)
  const [firmandoError,   setFirmandoError]   = useState<string | null>(null)
  const [successMsg,      setSuccessMsg]      = useState<string | null>(null)

  // ── Auto-save on debounce ─────────────────────────────────────────────────
  const scheduleAutoSave = (patch: Parameters<typeof updateContrato>[1]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      await updateContrato(initial.id, patch)
      setSaving(false)
    }, 900)
  }

  // Helpers that update state + auto-save
  const set = <T,>(setter: (v: T) => void, field: string) => (v: T) => {
    setter(v)
    scheduleAutoSave({ [field]: v || null } as Parameters<typeof updateContrato>[1])
  }

  // Fill client fields from lead
  const handleLeadChange = (leadId: string) => {
    setSelectedLeadId(leadId)
    const lead = leads.find(l => l.id === leadId)
    if (lead) {
      setClienteNombre(lead.nombre)
      setClienteApellidos(lead.apellidos ?? '')
      setClienteEmpresa(lead.empresa ?? '')
      setClienteNif(lead.nif_cif ?? '')
      setClienteEmail(lead.email ?? '')
      setClienteTelefono(lead.telefono ?? '')
      setClienteDireccion(lead.direccion ?? '')
      setClienteCiudad(lead.ciudad ?? '')
      setClienteCp(lead.codigo_postal ?? '')
      setClientePais(lead.pais ?? '')
    }
    scheduleAutoSave({
      lead_id: leadId || null,
      cliente_nombre:    lead?.nombre    ?? null,
      cliente_apellidos: lead?.apellidos ?? null,
      cliente_empresa:   lead?.empresa   ?? null,
      cliente_nif:       lead?.nif_cif   ?? null,
      cliente_email:     lead?.email     ?? null,
      cliente_telefono:  lead?.telefono  ?? null,
      cliente_direccion: lead?.direccion ?? null,
      cliente_ciudad:    lead?.ciudad    ?? null,
      cliente_cp:        lead?.codigo_postal ?? null,
      cliente_pais:      lead?.pais      ?? null,
    } as Parameters<typeof updateContrato>[1])
  }

  const handleHonorariosChange = (h: Honorario[]) => {
    setHonorarios(h)
    scheduleAutoSave({ honorarios: h } as Parameters<typeof updateContrato>[1])
  }

  const handleRellenarDesdeContenido = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviciosContenido: { id: string; label: string; importe: number; semanas: string | number; pago: { label: string; pct: number }[] }[] =
      (initial.contenido?.servicios ?? []) as { id: string; label: string; importe: number; semanas: string | number; pago: { label: string; pct: number }[] }[]
    if (serviciosContenido.length === 0) return

    const sorted = [...serviciosContenido].sort((a, b) => {
      const ia = SERVICIO_IDS.indexOf(a.id as ServicioId)
      const ib = SERVICIO_IDS.indexOf(b.id as ServicioId)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })

    const lines: Honorario[] = []
    for (const svc of sorted) {
      const pagos = svc.pago ?? []
      if (pagos.length > 0) {
        for (const p of pagos) {
          lines.push({ seccion: svc.label, descripcion: p.label, importe: Math.round((svc.importe * p.pct / 100) * 100) / 100, fecha_pago_acordada: null })
        }
      } else {
        lines.push({ seccion: svc.label, descripcion: svc.label, importe: svc.importe ?? 0, fecha_pago_acordada: null })
      }
    }
    handleHonorariosChange(lines)
  }

  const handleSugerirFechas = () => {
    const baseStr = fechaFirma || fechaEnvio
    if (!baseStr) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviciosContenido: { id: string; label: string; semanas: string | number }[] =
      (initial.contenido?.servicios ?? []) as { id: string; label: string; semanas: string | number }[]
    if (serviciosContenido.length === 0) return

    const baseDate = new Date(baseStr + 'T12:00:00')
    let cumulativeDays = 0
    const dateByLabel: Record<string, string> = {}

    for (const svc of serviciosContenido) {
      const dias = parseInt(String(svc.semanas ?? '0'), 10) || 0
      cumulativeDays += dias
      if (dias > 0) {
        dateByLabel[svc.label] = toDateStr(addWorkingDays(baseDate, cumulativeDays))
      }
    }

    const updated = honorarios.map(h => ({
      ...h,
      fecha_pago_acordada: h.fecha_pago_acordada ?? (dateByLabel[h.seccion] ?? null),
    }))
    handleHonorariosChange(updated)
  }

  function toggleContratoDeliverable(srvId: string, grupoNombre: string, item: string) {
    setServiciosEdit(prev => {
      const updated = prev.map(srv => {
        if (srv.id !== srvId) return srv
        const updatedEntregs = srv.entregables.map(g => {
          if (g.grupo !== grupoNombre) return g
          const has = g.items.includes(item)
          return { ...g, items: has ? g.items.filter(i => i !== item) : [...g.items, item] }
        }).filter(g => g.items.length > 0)
        return { ...srv, entregables: updatedEntregs }
      })
      saveContenido({ servicios: updated })
      return updated
    })
  }

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    startTransition(async () => {
      await updateContrato(initial.id, { status: newStatus } as Parameters<typeof updateContrato>[1])
      router.refresh()
    })
  }

  const handlePreviewPDF = async (lang: 'es' | 'en' = 'es') => {
    const res = await fetch('/api/contratos/preview-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contratoId: initial.id, lang }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  const handleFirmar = async () => {
    if (!confirm('¿Firmar el contrato? Esto creará automáticamente el cliente, el proyecto y la estructura de facturación.')) return
    setFirmandoLoading(true)
    setFirmandoError(null)
    const result = await firmarContrato(initial.id)
    setFirmandoLoading(false)
    if ('error' in result) {
      setFirmandoError(result.error)
    } else {
      setStatus('firmado')
      setSuccessMsg(`✓ Contrato firmado. Proyecto y cliente creados correctamente.`)
      router.refresh()
    }
  }

  const meta = STATUS_META[status] ?? STATUS_META.borrador

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4' }}>

      {/* Header */}
      <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid #E8E6E0', background: '#fff' }}>
        <button
          onClick={() => router.push('/team/captacion/contratos')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#AAA', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#555' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
        >
          ← Contratos
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <h1 style={{ fontSize: 24, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em', fontFamily: 'monospace' }}>
                {initial.numero ?? 'Nuevo contrato'}
              </h1>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: meta.color, background: meta.bg, padding: '3px 10px', borderRadius: 3 }}>
                {meta.label}
              </span>
              {saving && <span style={{ fontSize: 10, color: '#CCC' }}>Guardando…</span>}
            </div>
            <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
              {proyectoNombre || 'Sin nombre de proyecto'} {clienteNombre ? `· ${clienteNombre}${clienteEmpresa ? ` — ${clienteEmpresa}` : ''}` : ''}
            </p>
          </div>

          {/* Status control */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {!isReadonly && (
              <select
                value={status}
                onChange={e => handleStatusChange(e.target.value)}
                style={{ height: 34, padding: '0 10px', fontSize: 11, border: '1px solid #E8E6E0', borderRadius: 4, background: '#fff', fontFamily: 'inherit', outline: 'none' }}
              >
                {STATUS_ORDER.filter(s => s !== 'firmado').map(s => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => handlePreviewPDF('es')}
              style={{ height: 36, padding: '0 16px', background: '#fff', color: '#1A1A1A', border: '1px solid #E8E6E0', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1A1A1A' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0' }}
            >
              PDF (ES)
            </button>
            <button
              onClick={() => handlePreviewPDF('en')}
              style={{ height: 36, padding: '0 16px', background: '#fff', color: '#1A1A1A', border: '1px solid #E8E6E0', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1A1A1A' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0' }}
            >
              PDF (EN)
            </button>

            {status !== 'firmado' && status !== 'cancelado' && (
              <button
                onClick={handleFirmar}
                disabled={firmandoLoading}
                style={{
                  height: 36, padding: '0 20px',
                  background: firmandoLoading ? '#888' : '#1D9E75',
                  color: '#fff', border: 'none', borderRadius: 4,
                  cursor: firmandoLoading ? 'not-allowed' : 'pointer',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                  opacity: firmandoLoading ? 0.7 : 1,
                }}
                onMouseEnter={e => { if (!firmandoLoading) (e.currentTarget as HTMLElement).style.background = '#15805E' }}
                onMouseLeave={e => { if (!firmandoLoading) (e.currentTarget as HTMLElement).style.background = '#1D9E75' }}
              >
                {firmandoLoading ? 'Procesando…' : '✓ Firmar contrato'}
              </button>
            )}

            {isFirmado && initial.proyecto_id && (
              <button
                onClick={() => router.push(`/team/proyectos/${initial.proyecto_id}`)}
                style={{ height: 36, padding: '0 16px', background: 'none', border: '1px solid #1D9E75', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: '#1D9E75', fontWeight: 500 }}
              >
                → Ver proyecto
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {firmandoError && (
          <div style={{ marginTop: 12, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{firmandoError}</span>
            <button onClick={() => setFirmandoError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16 }}>×</button>
          </div>
        )}
        {successMsg && (
          <div style={{ marginTop: 12, padding: '10px 16px', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 6, fontSize: 12, color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontSize: 16 }}>×</button>
          </div>
        )}
        {isFirmado && (
          <div style={{ marginTop: 12, padding: '10px 16px', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 6, fontSize: 12, color: '#065F46' }}>
            ✓ Contrato firmado el {initial.fecha_firma?.split('-').reverse().join('/')}. El proyecto y la estructura de facturación han sido creados.
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── Datos del contrato ──────────────────────────── */}
        <section style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '24px 28px' }}>
          <p style={SECTION_TITLE}>Datos del contrato</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 24px' }}>
            <div>
              <span style={LBL}>Número de contrato</span>
              <input value={initial.numero ?? ''} disabled style={{ ...INP, background: '#F8F7F4', color: '#888', fontFamily: 'monospace', fontWeight: 600 }} />
            </div>
            <div>
              <span style={LBL}>Fecha de envío</span>
              <input type="date" value={fechaEnvio} disabled={isReadonly}
                onChange={e => { setFechaEnvio(e.target.value); scheduleAutoSave({ fecha_envio: e.target.value || null } as Parameters<typeof updateContrato>[1]) }}
                style={{ ...INP, background: isReadonly ? '#F8F7F4' : '#fff', color: isReadonly ? '#888' : '#1A1A1A' }} />
            </div>
            <div>
              <span style={LBL}>Fecha de firma</span>
              <input type="date" value={fechaFirma} disabled={isReadonly}
                onChange={e => { setFechaFirma(e.target.value); scheduleAutoSave({ fecha_firma: e.target.value || null } as Parameters<typeof updateContrato>[1]) }}
                style={{ ...INP, background: isReadonly ? '#F8F7F4' : '#fff', color: isReadonly ? '#888' : '#1A1A1A' }} />
            </div>
          </div>
        </section>

        {/* ── Datos del estudio ───────────────────────────── */}
        <section style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ ...SECTION_TITLE, margin: 0 }}>Datos del estudio (emisor)</p>
            <a href="/team/finanzas/facturacion/empresa" target="_blank"
              style={{ fontSize: 10, color: '#AAA', textDecoration: 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D85A30' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAA' }}
            >
              Editar datos empresa →
            </a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 24px' }}>
            <Field label="Razón social" value={emisorNombre} onChange={set(setEmisorNombre, 'emisor_nombre')} disabled={isReadonly} />
            <Field label="NIF / CIF" value={emisorNif} onChange={set(setEmisorNif, 'emisor_nif')} disabled={isReadonly} mono />
            <Field label="Email" value={emisorEmail} onChange={set(setEmisorEmail, 'emisor_email')} disabled={isReadonly} type="email" />
            <Field label="Dirección" value={emisorDireccion} onChange={set(setEmisorDireccion, 'emisor_direccion')} disabled={isReadonly} />
            <Field label="Ciudad" value={emisorCiudad} onChange={set(setEmisorCiudad, 'emisor_ciudad')} disabled={isReadonly} />
            <Field label="Código postal" value={emisorCp} onChange={set(setEmisorCp, 'emisor_cp')} disabled={isReadonly} />
            <Field label="Teléfono" value={emisorTelefono} onChange={set(setEmisorTelefono, 'emisor_telefono')} disabled={isReadonly} />
          </div>
        </section>

        {/* ── Datos del cliente ───────────────────────────── */}
        <section style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ ...SECTION_TITLE, margin: 0 }}>Datos del cliente</p>
            {!isReadonly && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#AAA' }}>Autocompletar desde lead:</span>
                <select
                  value={selectedLeadId}
                  onChange={e => handleLeadChange(e.target.value)}
                  style={{ height: 28, padding: '0 8px', fontSize: 11, border: '1px solid #E8E6E0', borderRadius: 4, background: '#fff', fontFamily: 'inherit', outline: 'none', color: selectedLeadId ? '#1A1A1A' : '#AAA' }}
                >
                  <option value="">Seleccionar lead…</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>
                      {[l.nombre, l.apellidos].filter(Boolean).join(' ')}{l.empresa ? ` · ${l.empresa}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {/* Tipo de cliente */}
          {!isReadonly && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['fisica', 'juridica'] as const).map(tipo => (
                <button
                  key={tipo}
                  onClick={() => {
                    setTipoCliente(tipo)
                    saveContenido({ tipo_cliente: tipo })
                  }}
                  style={{
                    padding: '6px 16px', border: '1px solid', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                    borderColor: tipoCliente === tipo ? '#1A1A1A' : '#E8E6E0',
                    background: tipoCliente === tipo ? '#1A1A1A' : '#fff',
                    color: tipoCliente === tipo ? '#fff' : '#888',
                  }}
                >
                  {tipo === 'fisica' ? 'Persona física' : 'Persona jurídica'}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 24px' }}>
            <Field label="Nombre" value={clienteNombre} onChange={set(setClienteNombre, 'cliente_nombre')} disabled={isReadonly} />
            <Field label="Apellidos" value={clienteApellidos} onChange={set(setClienteApellidos, 'cliente_apellidos')} disabled={isReadonly} />
            <Field label="Empresa / Razón social" value={clienteEmpresa} onChange={set(setClienteEmpresa, 'cliente_empresa')} disabled={isReadonly} />
            <Field label="NIF / CIF" value={clienteNif} onChange={set(setClienteNif, 'cliente_nif')} disabled={isReadonly} mono />
            <Field label="Email" value={clienteEmail} onChange={set(setClienteEmail, 'cliente_email')} disabled={isReadonly} type="email" />
            <Field label="Teléfono" value={clienteTelefono} onChange={set(setClienteTelefono, 'cliente_telefono')} disabled={isReadonly} />
            <Field label="Dirección" value={clienteDireccion} onChange={set(setClienteDireccion, 'cliente_direccion')} disabled={isReadonly} />
            <Field label="Ciudad" value={clienteCiudad} onChange={set(setClienteCiudad, 'cliente_ciudad')} disabled={isReadonly} />
            <Field label="Código postal" value={clienteCp} onChange={set(setClienteCp, 'cliente_cp')} disabled={isReadonly} />
            <Field label="País" value={clientePais} onChange={set(setClientePais, 'cliente_pais')} disabled={isReadonly} />
          </div>
        </section>

        {/* ── Datos del proyecto ──────────────────────────── */}
        <section style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '24px 28px' }}>
          <p style={SECTION_TITLE}>Datos del proyecto</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 24px' }}>
            <div style={{ gridColumn: '1 / 3' }}>
              <Field label="Nombre del proyecto" value={proyectoNombre} onChange={set(setProyectoNombre, 'proyecto_nombre')} disabled={isReadonly} />
            </div>
            <Field label="Código de proyecto" value={proyectoCodigo} onChange={set(setProyectoCodigo, 'proyecto_codigo')} disabled={isReadonly} mono />
            <div style={{ gridColumn: '1 / 3' }}>
              <Field label="Dirección / Emplazamiento" value={proyectoDireccion} onChange={set(setProyectoDireccion, 'proyecto_direccion')} />
            </div>
            <div>
              <span style={LBL}>Tipo de proyecto</span>
              {isReadonly ? (
                <input value={proyectoTipo} disabled style={{ ...INP, background: '#F8F7F4', color: '#888' }} />
              ) : (
                <select
                  value={proyectoTipo}
                  onChange={e => { setProyectoTipo(e.target.value); scheduleAutoSave({ proyecto_tipo: e.target.value || null } as Parameters<typeof updateContrato>[1]) }}
                  style={{ ...INP, cursor: 'pointer' }}
                >
                  <option value="">—</option>
                  {TIPOS_PROYECTO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>
            <div>
              <span style={LBL}>Superficie (m²)</span>
              <input
                type="number"
                min={0}
                value={proyectoSuperficie}
                disabled={isReadonly}
                onChange={e => {
                  setProyectoSuperficie(e.target.value)
                  scheduleAutoSave({ proyecto_superficie: parseFloat(e.target.value) || null } as Parameters<typeof updateContrato>[1])
                }}
                style={{ ...INP, background: isReadonly ? '#F8F7F4' : '#fff', color: isReadonly ? '#888' : '#1A1A1A' }}
              />
            </div>
          </div>
        </section>

        {/* ── Alcance de servicios contratados ───────────── */}
        {serviciosEdit.length > 0 && (
          <section style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '24px 28px' }}>
            <p style={SECTION_TITLE}>Alcance de servicios contratados</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {serviciosEdit.map(srv => {
                const baseEntregs = serviciosBase.current.find(s => s.id === srv.id)?.entregables ?? []
                return (
                  <div key={srv.id} style={{ paddingBottom: 20, borderBottom: '1px solid #F0EEE8' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 10 }}>
                      {srv.label}
                    </div>
                    {baseEntregs.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {baseEntregs.map(grupo => {
                          const currentSrv = serviciosEdit.find(s => s.id === srv.id)
                          const currentGrupo = currentSrv?.entregables.find(g => g.grupo === grupo.grupo)
                          return (
                            <div key={grupo.grupo}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#AAA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
                                {grupo.grupo}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {grupo.items.map(item => {
                                  const selected = currentGrupo?.items.includes(item) ?? true
                                  return (
                                    <label key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: isReadonly ? 'default' : 'pointer', fontSize: 12 }}>
                                      <div
                                        onClick={isReadonly ? undefined : () => toggleContratoDeliverable(srv.id, grupo.grupo, item)}
                                        style={{
                                          width: 14, height: 14, borderRadius: 2, flexShrink: 0, marginTop: 1,
                                          border: '1.5px solid', borderColor: selected ? '#1A1A1A' : '#CCC',
                                          background: selected ? '#1A1A1A' : '#fff',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          cursor: isReadonly ? 'default' : 'pointer',
                                        }}
                                      >
                                        {selected && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                                      </div>
                                      <span style={{ color: selected ? '#1A1A1A' : '#CCC', lineHeight: 1.4, textDecoration: selected ? 'none' : 'line-through' }}>
                                        {item}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Honorarios ─────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ ...SECTION_TITLE, margin: 0 }}>Estructura de honorarios y facturación</p>
            {!isReadonly && (initial.contenido?.servicios as unknown[])?.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {honorarios.length === 0 && (
                  <button
                    type="button"
                    onClick={handleRellenarDesdeContenido}
                    style={{ fontSize: 10, color: '#fff', background: '#D85A30', border: '1px solid #D85A30', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', letterSpacing: '0.04em', fontWeight: 600 }}
                  >
                    Importar desde propuesta
                  </button>
                )}
                {honorarios.length > 0 && (fechaFirma || fechaEnvio) && (
                  <button
                    type="button"
                    onClick={handleSugerirFechas}
                    style={{ fontSize: 10, color: '#AAA', background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', letterSpacing: '0.04em' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D85A30'; (e.currentTarget as HTMLElement).style.color = '#D85A30' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0'; (e.currentTarget as HTMLElement).style.color = '#AAA' }}
                  >
                    Sugerir fechas de cobro
                  </button>
                )}
                {honorarios.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRellenarDesdeContenido}
                    style={{ fontSize: 10, color: '#AAA', background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', letterSpacing: '0.04em' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#888'; (e.currentTarget as HTMLElement).style.color = '#555' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E6E0'; (e.currentTarget as HTMLElement).style.color = '#AAA' }}
                  >
                    ↺ Reimportar
                  </button>
                )}
              </div>
            )}
          </div>
          <HonorariosTable
            honorarios={honorarios}
            onChange={handleHonorariosChange}
            disabled={isReadonly}
          />
          {!isReadonly && honorarios.length > 0 && (
            <p style={{ fontSize: 10, color: '#AAA', marginTop: 8 }}>
              Estas líneas se convertirán en facturas de contrato al firmar, asociadas a las secciones del proyecto.
            </p>
          )}
        </section>

        {/* ── Notas ──────────────────────────────────────── */}
        <section style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '24px 28px' }}>
          <p style={SECTION_TITLE}>Notas internas</p>
          <textarea
            value={notas}
            disabled={isReadonly}
            onChange={e => { setNotas(e.target.value); scheduleAutoSave({ notas: e.target.value || null } as Parameters<typeof updateContrato>[1]) }}
            rows={4}
            placeholder={isReadonly ? '' : 'Anotaciones internas sobre este contrato…'}
            style={{ ...INP, height: 'auto', padding: '10px', resize: 'vertical', background: isReadonly ? '#F8F7F4' : '#fff', color: isReadonly ? '#888' : '#1A1A1A' }}
          />
        </section>

        {/* ── Cuerpo del contrato ────────────────────────── */}
        <section style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', margin: 0 }}>
              Cuerpo del contrato
            </p>
            {!isReadonly && (
              <button
                onClick={() => { setCuerpoTexto(DEFAULT_CUERPO_TEXTO); saveContenido({ cuerpo_texto: DEFAULT_CUERPO_TEXTO }) }}
                style={{ fontSize: 11, color: '#AAA', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                Restaurar plantilla
              </button>
            )}
          </div>
          <textarea
            readOnly={isReadonly}
            value={cuerpoTexto}
            onChange={e => {
              setCuerpoTexto(e.target.value)
              saveContenido({ cuerpo_texto: e.target.value })
            }}
            style={{
              width: '100%', boxSizing: 'border-box',
              minHeight: 480, padding: '12px 14px',
              border: '1px solid #E8E6E0', borderRadius: 6,
              fontSize: 12, lineHeight: 1.8,
              fontFamily: "'Inter', system-ui, sans-serif",
              color: isReadonly ? '#888' : '#1A1A1A',
              background: isReadonly ? '#F8F7F4' : '#fff',
              resize: 'vertical', outline: 'none',
            }}
          />
          <p style={{ fontSize: 10, color: '#CCC', margin: '8px 0 0', lineHeight: 1.5 }}>
            Este texto forma el cuerpo legal del contrato. Puedes editarlo libremente para cada contrato. Los datos del cliente, proyecto y honorarios se recogen en las secciones anteriores.
          </p>
        </section>

      </div>
    </div>
  )
}
