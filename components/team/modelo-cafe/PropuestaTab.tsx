'use client'

import { useState } from 'react'
import { eur } from '@/lib/modelo-cafe/domain'
import { C, panelStyle, h2Style } from './theme'
import { NumField } from './Field'

type Form = {
  destinatarios: string
  firmantes: string
  direccion: string
  opcion1Monto: number
  opcion1Irpf: number
  opcion1Neto: number
  opcion2Total: number
  opcion2Entrada: number
  opcion2Meses: number
  opcion2IrpfPrimer: number
  opcion2IrpfResto: number
  opcion2Neto: number
  senal: number
  compensacion: number
  reservaDias: number
}

const DEFAULTS: Form = {
  destinatarios: 'Ángel y Mari',
  firmantes: 'José y Gaby',
  direccion: 'Calle Goya, 63 · Madrid',
  opcion1Monto: 58000,
  opcion1Irpf: 12200,
  opcion1Neto: 45800,
  opcion2Total: 75000,
  opcion2Entrada: 10000,
  opcion2Meses: 60,
  opcion2IrpfPrimer: 4700,
  opcion2IrpfResto: 2600,
  opcion2Neto: 59900,
  senal: 3000,
  compensacion: 3000,
  reservaDias: 60,
}

export default function PropuestaTab() {
  const [f, setF] = useState<Form>(DEFAULTS)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof Form) => (n: number) => setF((p) => ({ ...p, [k]: n }))
  const setTxt = (k: keyof Form) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  const mensualidad = f.opcion2Meses > 0 ? Math.round((f.opcion2Total - f.opcion2Entrada) / f.opcion2Meses) : 0
  const diferencia = f.opcion2Neto - f.opcion1Neto
  const extra = f.opcion2Total - f.opcion1Monto

  const generar = async () => {
    setError(null)
    setIsGenerating(true)
    try {
      const res = await fetch('/api/modelo-cafe/propuesta-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, opcion2Mensualidad: mensualidad }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudo generar la propuesta.')
      }
      const blob = await res.blob()
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16 }}>
      <section style={panelStyle}>
        <h2 style={h2Style}>Ajusta los números de la propuesta</h2>

        <Group title="Encabezado">
          <TextField label="Destinatarios" value={f.destinatarios} onChange={setTxt('destinatarios')} />
          <TextField label="Firmantes" value={f.firmantes} onChange={setTxt('firmantes')} />
          <TextField label="Dirección del quiosco" value={f.direccion} onChange={setTxt('direccion')} full />
        </Group>

        <Group title="Opción 1 · pago único">
          <NumField label="Monto total" unit="€" value={f.opcion1Monto} onChange={set('opcion1Monto')} />
          <NumField label="IRPF estimado" unit="€" value={f.opcion1Irpf} onChange={set('opcion1Irpf')} />
          <NumField label="Neto tras impuestos" unit="€" value={f.opcion1Neto} onChange={set('opcion1Neto')} />
          <div />
        </Group>

        <Group title="Opción 2 · aplazado">
          <NumField label="Total a cobrar" unit="€" value={f.opcion2Total} onChange={set('opcion2Total')} />
          <NumField label="Entrada el día de la firma" unit="€" value={f.opcion2Entrada} onChange={set('opcion2Entrada')} />
          <NumField label="Plazo" unit="meses" value={f.opcion2Meses} onChange={set('opcion2Meses')} />
          <NumField label="IRPF primer año" unit="€" value={f.opcion2IrpfPrimer} onChange={set('opcion2IrpfPrimer')} />
          <NumField label="IRPF años siguientes" unit="€" value={f.opcion2IrpfResto} onChange={set('opcion2IrpfResto')} />
          <NumField label="Neto tras impuestos" unit="€" value={f.opcion2Neto} onChange={set('opcion2Neto')} />
        </Group>

        <Group title="Acuerdo de reserva">
          <NumField label="Señal de reserva" unit="€" value={f.senal} onChange={set('senal')} />
          <NumField label="Compensación si se retiran" unit="€" value={f.compensacion} onChange={set('compensacion')} />
          <NumField label="Días de reserva" unit="días" value={f.reservaDias} onChange={set('reservaDias')} />
          <div />
        </Group>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={panelStyle}>
          <h2 style={h2Style}>Resumen de la oferta</h2>
          <Stat label="Opción 2 · mensualidad" value={`${eur(mensualidad)}/mes`} />
          <Stat label="Opción 2 · durante" value={`${Math.round(f.opcion2Meses / 12)} años`} />
          <Stat label="Cobran de más vs opción 1" value={eur(extra)} tone="g" />
          <Stat label="Les queda de más (neto)" value={eur(diferencia)} tone="g" last />
        </div>

        <div style={{ ...panelStyle, background: C.ink, border: 'none', color: '#fff' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Propuesta para los vendedores</div>
          <div style={{ fontSize: 12, color: '#FFFFFFB0', lineHeight: 1.55, marginBottom: 14 }}>
            Genera la carta (dos opciones de pago + impuestos explicados + acuerdo de reserva) con estos números.
          </div>
          {error && <div style={{ fontSize: 12, color: '#F0A090', marginBottom: 10 }}>⚠ {error}</div>}
          <button
            type="button"
            onClick={generar}
            disabled={isGenerating}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 5, border: 'none',
              background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: isGenerating ? 'default' : 'pointer', opacity: isGenerating ? 0.6 : 1,
            }}
          >
            {isGenerating ? 'Generando…' : 'Generar propuesta PDF'}
          </button>
        </div>
      </section>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.coffee }}>{title}</span>
        <span style={{ flex: 1, height: 1, background: C.line }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 14px' }}>{children}</div>
    </div>
  )
}

function TextField({ label, value, onChange, full }: { label: string; value: string; onChange: (v: string) => void; full?: boolean }) {
  return (
    <label style={{ display: 'block', marginBottom: 10, gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ display: 'block', fontSize: 10.5, color: C.soft, marginBottom: 4 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '7px 9px', borderRadius: 4, boxSizing: 'border-box',
          border: `1px solid ${C.line}`, background: C.bg, color: C.ink, fontSize: 13, outline: 'none',
        }}
      />
    </label>
  )
}

function Stat({ label, value, tone, last }: { label: string; value: string; tone?: 'g'; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '9px 0', borderBottom: last ? 'none' : `1px solid ${C.line}`,
    }}>
      <span style={{ fontSize: 12, color: C.soft }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: tone === 'g' ? C.green : C.ink }}>{value}</span>
    </div>
  )
}
