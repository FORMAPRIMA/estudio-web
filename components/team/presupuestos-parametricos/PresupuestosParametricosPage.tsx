'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PanelData } from '@/app/actions/presupuestos-parametricos'
import { createObra, deleteObra, updateObraEstado } from '@/app/actions/presupuestos-parametricos'
import {
  ESTADOS_OBRA,
  ajusteINE,
  eur,
  estadoMeta,
  fechaCorta,
  importeCoste,
  necesitaAjusteINE,
  pesoObra,
  type EstadoObra,
  type TipoReforma,
} from '@/lib/presupuestos-parametricos/domain'

const C = {
  ink: '#1A1A1A',
  cream: '#F8F7F4',
  accent: '#D85A30',
  borde: '#E8E6E0',
  bordeSuave: '#F0EEE8',
}

type Tab = 'obras' | 'ratios' | 'estimaciones'

const TABS: { value: Tab; label: string }[] = [
  { value: 'obras', label: 'Obras de referencia' },
  { value: 'ratios', label: 'Ratios' },
  { value: 'estimaciones', label: 'Estimaciones' },
]

export default function PresupuestosParametricosPage({ data }: { data: PanelData }) {
  const [tab, setTab] = useState<Tab>('obras')

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1200 }}>
      <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 8 }}>
        Apps
      </p>
      <h1 style={{ fontSize: 26, fontWeight: 300, color: C.ink, letterSpacing: '-0.01em' }}>
        Presupuestos paramétricos
      </h1>
      <p style={{ fontSize: 13, color: '#1A1A1A80', fontWeight: 300, marginTop: 8, maxWidth: 680, lineHeight: 1.6 }}>
        Presupuestos reales de constructor convertidos en ratios por capítulo y nivel de calidad, para estimar
        el coste de una reforma antes de tener proyecto.
      </p>

      <div style={{ display: 'flex', gap: 28, borderBottom: `1px solid ${C.borde}`, marginTop: 32, marginBottom: 28 }}>
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px',
              fontSize: 12, letterSpacing: '0.02em',
              color: tab === t.value ? C.ink : '#1A1A1A60',
              fontWeight: tab === t.value ? 500 : 400,
              borderBottom: tab === t.value ? `2px solid ${C.accent}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'obras' && <ObrasTab data={data} />}
      {tab === 'ratios' && (
        <Vacio
          titulo="Aún no hay ratios"
          texto="Los ratios por capítulo y nivel se calculan con las obras publicadas. Cada ratio dirá cuántas obras lo respaldan, cuánto pesa cada una y si alguna viene ajustada con índice INE."
        />
      )}
      {tab === 'estimaciones' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          <Link href="/team/apps/presupuestos-parametricos/maqueta" style={{ textDecoration: 'none' }}>
            <div className="apps-card" style={{ background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 4, padding: '24px 28px' }}>
              <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.accent, fontWeight: 500, marginBottom: 8 }}>Prototipo</p>
              <p style={{ fontSize: 14, color: C.ink, fontWeight: 500, marginBottom: 6 }}>Maqueta del estado actual →</p>
              <p style={{ fontSize: 12, color: '#1A1A1A80', fontWeight: 300, lineHeight: 1.6 }}>
                Sube el plano, la IA levanta una maqueta 3D de lo que hay, la revisas y corriges, y con tu visto bueno salen las mediciones de demolición.
              </p>
            </div>
          </Link>
          <Vacio
            titulo="Estimaciones"
            texto="Aquí vivirá el cuestionario (express o técnico) que genera el presupuesto paramétrico con su horquilla, el paso de márgenes y el documento para el cliente."
          />
        </div>
      )}
    </div>
  )
}

// ── Obras de referencia ──────────────────────────────────────────────────────

function ObrasTab({ data }: { data: PanelData }) {
  const router = useRouter()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const cambiarEstado = (id: string, estado: EstadoObra) =>
    startTransition(async () => {
      const r = await updateObraEstado(id, estado)
      if ('error' in r) setError(r.error)
      else router.refresh()
    })

  const eliminar = (id: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar «${nombre}» y todas sus partidas? No se puede deshacer.`)) return
    startTransition(async () => {
      const r = await deleteObra(id)
      if ('error' in r) setError(r.error)
      else router.refresh()
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: '#1A1A1A80' }}>
          {data.obras.length === 0
            ? 'La base está vacía.'
            : `${data.obras.length} obra${data.obras.length === 1 ? '' : 's'} · ${data.obras.filter(o => o.estado === 'publicada').length} publicada${data.obras.filter(o => o.estado === 'publicada').length === 1 ? '' : 's'}`}
        </p>
        {!isFormOpen && (
          <button onClick={() => setIsFormOpen(true)} style={btnPrimario}>
            + Nueva obra
          </button>
        )}
      </div>

      {error && <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 12 }}>{error}</p>}

      {isFormOpen && (
        <NuevaObraForm
          onCancel={() => setIsFormOpen(false)}
          onCreated={() => { setIsFormOpen(false); router.refresh() }}
        />
      )}

      {data.obras.length === 0 && !isFormOpen && (
        <Vacio
          titulo="Ninguna obra de referencia todavía"
          texto="Cada obra es un presupuesto real de constructor. Al darla de alta se guarda su coste sin márgenes, sus mediciones y el nivel de calidad de cada capítulo. Si el presupuesto tiene más de 12 meses, se actualiza con el índice del INE y pesa menos que las obras recientes."
        />
      )}

      {data.obras.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 4 }}>
          <div style={{ ...fila, borderTop: 'none', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60' }}>
            <span>Obra</span>
            <span>Presupuesto</span>
            <span style={{ textAlign: 'right' }}>Coste</span>
            <span style={{ textAlign: 'right' }}>Peso</span>
            <span>Estado</span>
            <span />
          </div>
          {data.obras.map(o => {
            const ajuste = ajusteINE(o.fecha_presupuesto, data.indice)
            const base = o.importe_partidas || (o.importe_documento != null ? importeCoste(o.importe_documento, o.descuento_margen_pct) : null)
            const meta = estadoMeta(o.estado)
            return (
              <div key={o.id} style={fila}>
                <div>
                  <Link href={`/team/apps/presupuestos-parametricos/obras/${o.id}`} style={{ fontSize: 13, color: C.ink, fontWeight: 500, textDecoration: 'none' }}>{o.nombre} →</Link>
                  <p style={{ fontSize: 11, color: '#1A1A1A70', marginTop: 2 }}>
                    {[o.constructor, o.tipo_reforma === 'parcial' ? 'Reforma parcial' : 'Reforma integral', `${o.partidas} partidas`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: C.ink }}>{fechaCorta(o.fecha_presupuesto)}</p>
                  {necesitaAjusteINE(o.fecha_presupuesto) && (
                    <span style={{ ...chip, color: '#B7791F', background: '#FDF6E7', marginTop: 4 }}>
                      {ajuste.sinIndice ? 'Pendiente de índice INE' : 'Ajustado con índice INE'}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 13, color: C.ink }}>{eur(base != null ? base * ajuste.factor : null)}</p>
                  {ajuste.ajustada && base != null && (
                    <p style={{ fontSize: 10, color: '#1A1A1A60', marginTop: 2 }}>
                      {eur(base)} × {ajuste.factor.toFixed(3)}
                    </p>
                  )}
                </div>
                <p style={{ fontSize: 12, color: C.ink, textAlign: 'right' }}>
                  {Math.round(pesoObra(o.fecha_presupuesto) * 100)} %
                </p>
                <div>
                  <select
                    value={o.estado}
                    disabled={isPending}
                    onChange={e => cambiarEstado(o.id, e.target.value as EstadoObra)}
                    style={{ ...chip, color: meta.color, background: meta.bg, border: 'none', cursor: 'pointer' }}
                  >
                    {ESTADOS_OBRA.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => eliminar(o.id, o.nombre)}
                  disabled={isPending}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1A1A1A50' }}
                >
                  Eliminar
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NuevaObraForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    direccion: '',
    constructor: '',
    fecha_presupuesto: '',
    tipo_reforma: 'integral' as TipoReforma,
    importe_documento: '',
    margen_pct: '',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = () =>
    startTransition(async () => {
      setError(null)
      const r = await createObra({
        nombre: form.nombre,
        direccion: form.direccion,
        constructor: form.constructor,
        fecha_presupuesto: form.fecha_presupuesto,
        tipo_reforma: form.tipo_reforma,
        importe_documento: form.importe_documento ? Number(form.importe_documento.replace(',', '.')) : null,
        descuento_margen_pct: form.margen_pct ? Number(form.margen_pct.replace(',', '.')) / 100 : 0,
      })
      if ('error' in r) setError(r.error)
      else onCreated()
    })

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 4, padding: 24, marginBottom: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 16 }}>Nueva obra de referencia</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        <Campo label="Nombre"><input value={form.nombre} onChange={set('nombre')} placeholder="Lagasca 68" style={input} /></Campo>
        <Campo label="Dirección"><input value={form.direccion} onChange={set('direccion')} style={input} /></Campo>
        <Campo label="Constructor"><input value={form.constructor} onChange={set('constructor')} style={input} /></Campo>
        <Campo label="Fecha del presupuesto"><input type="date" value={form.fecha_presupuesto} onChange={set('fecha_presupuesto')} style={input} /></Campo>
        <Campo label="Tipo de reforma">
          <select value={form.tipo_reforma} onChange={set('tipo_reforma')} style={input}>
            <option value="integral">Integral</option>
            <option value="parcial">Parcial</option>
          </select>
        </Campo>
        <Campo label="Total del documento (sin IVA)"><input inputMode="decimal" value={form.importe_documento} onChange={set('importe_documento')} placeholder="€" style={input} /></Campo>
        <Campo label="Margen o fee incluido (%)" ayuda="Si el documento ya trae un margen o referral fee prorrateado, se descuenta para guardar solo coste.">
          <input inputMode="decimal" value={form.margen_pct} onChange={set('margen_pct')} placeholder="0" style={input} />
        </Campo>
      </div>
      {form.fecha_presupuesto && necesitaAjusteINE(form.fecha_presupuesto) && (
        <p style={{ fontSize: 11, color: '#B7791F', marginTop: 14 }}>
          Este presupuesto tiene más de 12 meses: se actualizará con el índice del INE y pesará menos que las obras recientes.
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: '#C0392B', marginTop: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={guardar} disabled={isPending} style={btnPrimario}>{isPending ? 'Guardando…' : 'Crear obra'}</button>
        <button onClick={onCancel} disabled={isPending} style={btnSecundario}>Cancelar</button>
      </div>
    </div>
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Campo({ label, ayuda, children }: { label: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A70', marginBottom: 6 }}>
        {label}
      </span>
      {children}
      {ayuda && <span style={{ display: 'block', fontSize: 10, color: '#1A1A1A60', marginTop: 4, lineHeight: 1.4 }}>{ayuda}</span>}
    </label>
  )
}

function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={{ background: '#fff', border: `1px dashed ${C.borde}`, borderRadius: 4, padding: '40px 32px', maxWidth: 720 }}>
      <p style={{ fontSize: 14, color: C.ink, fontWeight: 500, marginBottom: 8 }}>{titulo}</p>
      <p style={{ fontSize: 12, color: '#1A1A1A80', fontWeight: 300, lineHeight: 1.6 }}>{texto}</p>
    </div>
  )
}

const fila: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 2fr) 1.2fr 1fr 70px 130px 70px',
  gap: 16,
  alignItems: 'center',
  padding: '14px 20px',
  borderTop: `1px solid ${C.bordeSuave}`,
}

const chip: React.CSSProperties = {
  display: 'inline-block', fontSize: 10, padding: '3px 8px', borderRadius: 3, fontWeight: 500,
}

const input: React.CSSProperties = {
  width: '100%', fontSize: 13, padding: '9px 10px', border: `1px solid ${C.borde}`, borderRadius: 3,
  background: C.cream, color: C.ink, outline: 'none', fontFamily: 'inherit',
}

const btnPrimario: React.CSSProperties = {
  background: C.ink, color: '#fff', border: 'none', borderRadius: 3, padding: '9px 16px',
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
}

const btnSecundario: React.CSSProperties = {
  background: 'none', color: C.ink, border: `1px solid ${C.borde}`, borderRadius: 3, padding: '9px 16px',
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
}
