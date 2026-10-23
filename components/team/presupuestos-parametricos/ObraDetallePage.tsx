'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ObraDetalle } from '@/app/actions/presupuestos-parametricos'
import { updateNivelCapitulo, updateObraEstado } from '@/app/actions/presupuestos-parametricos'
import { ESTADOS_OBRA, eur, estadoMeta, fechaCorta, pesoObra, type EstadoObra, type NivelCalidad } from '@/lib/presupuestos-parametricos/domain'
import { NIVELES } from '@/lib/memorias/domain'
import { FICHAS, VARIABLES } from '@/lib/presupuestos-parametricos/fichas'

const C = { ink: '#1A1A1A', cream: '#F8F7F4', accent: '#D85A30', borde: '#E8E6E0', bordeSuave: '#F0EEE8', ambar: '#B7791F', ambarBg: '#FDF6E7', verde: '#1D9E75' }

const num = (n: number, d = 1) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' } as Intl.NumberFormatOptions)
const eur2 = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions)} €`

type Seccion = 'ratios' | 'programa' | 'partidas'

export default function ObraDetallePage({ d }: { d: ObraDetalle }) {
  const router = useRouter()
  const [seccion, setSeccion] = useState<Seccion>('ratios')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { obra, ratios, inversion } = d
  const meta = estadoMeta(obra.estado)
  const conRatio = ratios.partes.filter(p => p.ratio != null).length
  const propiedad = inversion.propiedad.reduce((s, l) => s + l.base, 0)

  const accion = (f: () => Promise<{ success: true } | { error: string }>) =>
    startTransition(async () => {
      setError(null)
      const r = await f()
      if ('error' in r) setError(r.error)
      else router.refresh()
    })

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1200 }}>
      <Link href="/team/apps/presupuestos-parametricos" style={{ fontSize: 11, color: '#1A1A1A70', textDecoration: 'none' }}>
        ← Obras de referencia
      </Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 300, color: C.ink, letterSpacing: '-0.01em' }}>{obra.nombre}</h1>
          <p style={{ fontSize: 12, color: '#1A1A1A80', marginTop: 6 }}>
            {[obra.direccion, obra.tipo_reforma === 'parcial' ? 'Reforma parcial' : 'Reforma integral', `presupuesto de ${fechaCorta(obra.fecha_presupuesto)}`, `pesa ${Math.round(pesoObra(obra.fecha_presupuesto) * 100)} %`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <select
          value={obra.estado}
          disabled={isPending}
          onChange={e => accion(() => updateObraEstado(obra.id, e.target.value as EstadoObra))}
          style={{ ...chip, color: meta.color, background: meta.bg, border: 'none', cursor: 'pointer', fontSize: 11, padding: '6px 10px' }}
        >
          {ESTADOS_OBRA.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>
      {obra.notas && <p style={{ fontSize: 12, color: '#1A1A1A90', marginTop: 12, maxWidth: 760, lineHeight: 1.6 }}>{obra.notas}</p>}
      {error && <p style={{ fontSize: 12, color: '#C0392B', marginTop: 12 }}>{error}</p>}

      {/* Cifras */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 28 }}>
        <Cifra label="Obra (coste, sin IVA)" valor={eur(ratios.totales.obra)} nota={`${ratios.partes.filter(p => p.importe > 0).length} partes con importe`} />
        <Cifra label="Costes de la propiedad" valor={eur(propiedad)} nota="ICIO, honorarios, SyS… sin IVA" />
        <Cifra label="Inversión total" valor={eur(inversion.total)} nota={`con IVA · obra al ${inversion.obra.base ? Math.round(inversion.obra.iva / inversion.obra.base * 100) : 21} %`} fuerte />
        <Cifra label="Ratios" valor={`${conRatio} de ${ratios.partes.length}`} nota="partes con € por unidad" />
      </div>

      {/* Documentos */}
      <h2 style={h2}>Documentos</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {d.documentos.map((doc, i) => {
          const cuadra = doc.control.every(c => c.cuadra)
          return (
            <div key={i} style={tarjeta}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{doc.etiqueta}</p>
                {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.accent, textDecoration: 'none' }}>PDF ↗</a>}
              </div>
              <p style={{ fontSize: 11, color: '#1A1A1A80', marginTop: 4 }}>{[doc.constructor, fechaCorta(doc.fecha), `${doc.paginas} págs.`].filter(Boolean).join(' · ')}</p>
              <p style={{ fontSize: 18, fontWeight: 300, color: C.ink, marginTop: 10 }}>{doc.total_sin_iva != null ? eur2(doc.total_sin_iva) : '—'} <span style={{ fontSize: 10, color: '#1A1A1A60' }}>sin IVA</span></p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                <span style={{ ...chip, color: cuadra ? C.verde : '#C0392B', background: cuadra ? '#E8F7F2' : '#FBEAEA' }}>{cuadra ? 'Sumas cuadran' : 'Sumas no cuadran'}</span>
                {doc.ajuste.ajustada && <span style={{ ...chip, color: C.ambar, background: C.ambarBg }}>Ajustado con índice INE ×{doc.ajuste.factor.toFixed(3).replace('.', ',')}</span>}
                {doc.ajuste.sinIndice && <span style={{ ...chip, color: C.ambar, background: C.ambarBg }}>Pendiente de índice INE</span>}
                {doc.provisional && <span style={{ ...chip, color: C.ambar, background: C.ambarBg }}>Provisional</span>}
              </div>
              {doc.nota && <p style={{ fontSize: 11, color: '#1A1A1A80', marginTop: 10, lineHeight: 1.5 }}>{doc.nota}</p>}
            </div>
          )
        })}
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 28, borderBottom: `1px solid ${C.borde}`, marginTop: 40, marginBottom: 20 }}>
        {([['ratios', 'Ratios por capítulo'], ['programa', 'Programa y mediciones'], ['partidas', 'Partidas']] as [Seccion, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setSeccion(v)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', fontSize: 12,
            color: seccion === v ? C.ink : '#1A1A1A60', fontWeight: seccion === v ? 500 : 400,
            borderBottom: seccion === v ? `2px solid ${C.accent}` : '2px solid transparent', marginBottom: -1,
          }}>{l}</button>
        ))}
      </div>

      {seccion === 'ratios' && (
        <Ratios d={d} isPending={isPending} onNivel={(capId, n) => accion(() => updateNivelCapitulo(obra.id, capId, n))} />
      )}
      {seccion === 'programa' && <Programa d={d} />}
      {seccion === 'partidas' && <Partidas d={d} />}

      {ratios.avisos.length > 0 && (
        <div style={{ ...tarjeta, borderColor: '#F0D9A8', background: C.ambarBg, marginTop: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: C.ambar, marginBottom: 6 }}>Avisos del cálculo</p>
          {ratios.avisos.map((a, i) => <p key={i} style={{ fontSize: 11, color: '#1A1A1A90', lineHeight: 1.6 }}>· {a}</p>)}
        </div>
      )}

      <p style={{ fontSize: 10, color: '#1A1A1A50', marginTop: 32 }}>
        Fichas versión {obra.version_fichas ?? '—'}. Los ratios se recalculan al abrir la obra con las fórmulas vigentes.
      </p>
    </div>
  )
}

// ── Ratios ───────────────────────────────────────────────────────────────────

function Ratios({ d, isPending, onNivel }: { d: ObraDetalle; isPending: boolean; onNivel: (capituloId: string, n: NivelCalidad | null) => void }) {
  const { ratios, inversion } = d
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {FICHAS.map(f => {
        const partes = ratios.partes.filter(p => p.capitulo === f.capitulo)
        const total = partes.reduce((s, p) => s + p.importe, 0) + (ratios.restoCapitulo.find(r => r.capitulo === f.capitulo)?.importe ?? 0)
        const cap = d.capitulos.find(c => c.numero === f.capitulo)
        const visibles = partes.filter(p => p.importe > 0 || p.cantidad > 0)
        if (!visibles.length && total === 0) return null
        return (
          <div key={f.capitulo} style={{ background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: `1px solid ${C.bordeSuave}`, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#1A1A1A50' }}>{String(f.capitulo).padStart(2, '0')}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{f.nombre}</span>
                <span style={{ fontSize: 12, color: '#1A1A1A80' }}>{eur(total)}</span>
              </div>
              {f.dependeDelNivel && cap ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={cap.justificacion ?? undefined}>
                  {cap.nivel_ia && cap.nivel === cap.nivel_ia && <span style={{ fontSize: 10, color: '#1A1A1A50' }}>propuesto por la IA</span>}
                  <select
                    value={cap.nivel ?? ''}
                    disabled={isPending}
                    onChange={e => onNivel(cap.id, (e.target.value || null) as NivelCalidad | null)}
                    style={{ ...chip, fontSize: 11, padding: '5px 8px', border: `1px solid ${C.borde}`, background: C.cream, color: C.ink, cursor: 'pointer' }}
                  >
                    <option value="">Sin nivel</option>
                    {NIVELES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                </div>
              ) : (
                <span style={{ fontSize: 10, color: '#1A1A1A50' }}>No depende del nivel</span>
              )}
            </div>
            <div style={{ ...filaRatio, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1A1A1A50', borderTop: 'none' }}>
              <span>Parte</span><span style={{ textAlign: 'right' }}>Cantidad (ficha)</span><span style={{ textAlign: 'right' }}>Constructor</span><span style={{ textAlign: 'right' }}>Importe</span><span style={{ textAlign: 'right' }}>Ratio</span>
            </div>
            {visibles.map(p => (
              <div key={p.parte} style={{ ...filaRatio, opacity: p.importe > 0 ? 1 : 0.45 }}>
                <div>
                  <p style={{ fontSize: 12, color: C.ink }}>{p.nombre}</p>
                  <p style={{ fontSize: 10, color: '#1A1A1A60', marginTop: 2 }}>{p.formula}</p>
                </div>
                <p style={celdaNum}>{num(p.cantidad)} {p.unidad}{p.factor !== 1 && <span style={{ color: '#1A1A1A60' }}> ×{num(p.factor, 2)}</span>}</p>
                <p style={{ ...celdaNum, color: '#1A1A1A70' }}>{p.medicionConstructor != null ? `${num(p.medicionConstructor)} ${p.unidad}` : '—'}</p>
                <p style={celdaNum}>
                  {p.importe > 0 ? eur(p.importe) : 'sin importe'}
                  {!p.desglosada && <span title={`Incluye ${eur(p.importeReparto)} de partidas sin desglosar del capítulo`} style={{ color: C.ambar }}> *</span>}
                </p>
                <p style={{ ...celdaNum, fontWeight: 500, color: p.aviso ? C.ambar : C.ink }} title={p.aviso ?? undefined}>
                  {p.ratio != null ? `${num(p.ratio, p.ratio < 100 ? 2 : 0)} €/${p.unidad}` : p.aviso ? '⚠' : '—'}
                </p>
              </div>
            ))}
          </div>
        )
      })}

      {/* Fuera de la obra */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <div style={tarjeta}>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4 }}>Inversión del propietario</p>
          <p style={{ fontSize: 11, color: '#1A1A1A70', marginBottom: 12 }}>Obra + lo que paga la propiedad aunque no sea obra. Honorarios al 10 % y ICIO al 4 % del PEM.</p>
          {[inversion.obra, ...inversion.propiedad].map(l => (
            <div key={l.concepto} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderTop: `1px solid ${C.bordeSuave}` }}>
              <span style={{ color: C.ink }}>{l.concepto}</span>
              <span style={{ color: '#1A1A1A80' }}>{eur(l.base)} {l.iva > 0 && <span style={{ fontSize: 10 }}>+ IVA {eur(l.iva)}</span>}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, padding: '10px 0 0', borderTop: `1px solid ${C.borde}` }}>
            <span>Total con IVA</span><span>{eur(inversion.total)}</span>
          </div>
        </div>
        <div style={tarjeta}>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4 }}>No entra en los ratios</p>
          <p style={{ fontSize: 11, color: '#1A1A1A70', marginBottom: 12 }}>Lo que trajeron los documentos y no es coste de la reforma.</p>
          {ratios.propiedad.map(p => (
            <div key={p.codigo} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '6px 0', borderTop: `1px solid ${C.bordeSuave}` }}>
              <span style={{ color: C.ink }}>{p.nombre.split(' (')[0]} <span style={{ fontSize: 10, color: '#1A1A1A60' }}>· propiedad</span></span><span style={{ color: '#1A1A1A80', whiteSpace: 'nowrap' }}>{eur(p.importe)}</span>
            </div>
          ))}
          {ratios.fueraFicha.map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '6px 0', borderTop: `1px solid ${C.bordeSuave}` }}>
              <span style={{ color: C.ink }}>{f.descripcion.slice(0, 70)} <span style={{ fontSize: 10, color: '#1A1A1A60' }}>· {f.documento}</span></span><span style={{ color: '#1A1A1A80', whiteSpace: 'nowrap' }}>{eur(f.importe)}</span>
            </div>
          ))}
          {!ratios.propiedad.length && !ratios.fueraFicha.length && <p style={{ fontSize: 12, color: '#1A1A1A60' }}>Nada.</p>}
        </div>
      </div>
    </div>
  )
}

// ── Programa y mediciones ────────────────────────────────────────────────────

const FUENTE: Record<string, string> = { derivada: 'Maqueta', manual: 'Revisión', ia: 'IA' }

function Programa({ d }: { d: ObraDetalle }) {
  const porCodigo = new Map(d.mediciones.map(m => [m.variable, m]))
  const grupos: [string, typeof VARIABLES][] = [
    ['Estado actual (maqueta y alzados)', VARIABLES.filter(v => v.nivel === 'tecnico' && porCodigo.has(v.codigo))],
    ['Programa reformado y respuestas', VARIABLES.filter(v => v.nivel === 'express' && porCodigo.has(v.codigo))],
  ]
  const opcion = (codigo: string, valor: string) => VARIABLES.find(v => v.codigo === codigo)?.opciones?.find(o => o.value === valor)?.label ?? (valor === 'si' ? 'Sí' : valor === 'no' ? 'No' : valor)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: d.planoUrl ? 'minmax(0, 1.3fr) minmax(0, 1fr)' : '1fr', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 16 }}>
        {grupos.map(([titulo, vars]) => (
          <div key={titulo} style={{ background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 4 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.ink, padding: '12px 18px', borderBottom: `1px solid ${C.bordeSuave}` }}>{titulo}</p>
            {vars.map(v => {
              const m = porCodigo.get(v.codigo)!
              const valor = m.valor_num != null ? `${num(Number(m.valor_num), Number.isInteger(Number(m.valor_num)) ? 0 : 2)} ${v.unidad}` : opcion(v.codigo, m.valor_texto ?? '')
              return (
                <div key={v.codigo} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(90px, 0.6fr) 70px', gap: 12, padding: '8px 18px', borderTop: `1px solid ${C.bordeSuave}`, alignItems: 'baseline' }}>
                  <div>
                    <p style={{ fontSize: 12, color: C.ink }}>{v.nombre}</p>
                    {m.nota && <p style={{ fontSize: 10, color: m.nota.startsWith('ESTIMADO') ? C.ambar : '#1A1A1A60', marginTop: 2, lineHeight: 1.4 }}>{m.nota}</p>}
                  </div>
                  <p style={{ fontSize: 12, color: C.ink, textAlign: 'right' }}>{valor}</p>
                  <span style={{ ...chip, justifySelf: 'end', color: m.fuente === 'manual' ? C.ambar : '#1A1A1A70', background: m.fuente === 'manual' ? C.ambarBg : C.bordeSuave }}>{FUENTE[m.fuente] ?? m.fuente}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {d.planoUrl && (
        <div style={{ ...tarjeta, position: 'sticky', top: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: C.ink, marginBottom: 10 }}>Plano del estado actual</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.planoUrl} alt="Plano del estado actual" style={{ width: '100%', borderRadius: 3, background: C.cream }} />
        </div>
      )}
    </div>
  )
}

// ── Partidas ─────────────────────────────────────────────────────────────────

function Partidas({ d }: { d: ObraDetalle }) {
  const nombreParte = new Map(FICHAS.flatMap(f => f.partes.map(p => [p.codigo, p.nombre])))
  const etiqueta = (parte: string) =>
    nombreParte.get(parte) ?? (parte.startsWith('sin_desglosar:') ? `Sin desglosar (cap. ${parte.split(':')[1]})` : parte === 'fuera_ficha' ? 'Fuera de ficha' : parte.startsWith('prop_') ? 'Propiedad' : parte)
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {(d.documentos.length ? d.documentos : [{ etiqueta: d.obra.nombre }]).map((doc, di) => {
        const propias = d.partidas.filter(p => p.documento === di)
        return (
          <div key={di} style={{ background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 4 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.ink, padding: '12px 18px', borderBottom: `1px solid ${C.bordeSuave}` }}>
              {doc.etiqueta} <span style={{ fontWeight: 400, color: '#1A1A1A60' }}>· {propias.length} partidas</span>
            </p>
            {propias.map((p, i) => {
              const dudosa = p.reparto.some(r => (r.confianza ?? 1) < 0.7)
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px minmax(0, 2fr) 110px minmax(0, 1.2fr)', gap: 12, padding: '8px 18px', borderTop: `1px solid ${C.bordeSuave}`, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 10, color: '#1A1A1A60' }}>{p.codigo ?? ''}</span>
                  <div>
                    <p style={{ fontSize: 12, color: C.ink, lineHeight: 1.4 }}>{p.descripcion}</p>
                    <p style={{ fontSize: 10, color: '#1A1A1A60', marginTop: 2 }}>{p.medicion != null ? `${num(p.medicion, 2)} ${p.unidad ?? ''}` : ''}{p.precio != null ? ` × ${eur2(p.precio)}` : ''}</p>
                  </div>
                  <p style={{ fontSize: 12, color: C.ink, textAlign: 'right' }}>{eur2(p.importe)}</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} title={p.reparto.map(r => r.motivo).filter(Boolean).join(' · ') || undefined}>
                    {p.reparto.map(r => (
                      <span key={r.parte} style={{ ...chip, fontWeight: 400, color: r.origen === 'manual' ? C.ambar : dudosa ? '#C0392B' : C.ink, background: r.origen === 'manual' ? C.ambarBg : dudosa ? '#FBEAEA' : C.bordeSuave }}>
                        {etiqueta(r.parte)}{r.pct < 100 ? ` ${num(r.pct, 0)} %` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Cifra({ label, valor, nota, fuerte }: { label: string; valor: string; nota?: string; fuerte?: boolean }) {
  return (
    <div style={{ background: fuerte ? C.ink : '#fff', border: `1px solid ${fuerte ? C.ink : C.borde}`, borderRadius: 4, padding: '16px 18px' }}>
      <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: fuerte ? '#FFFFFF90' : '#1A1A1A60' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 300, color: fuerte ? '#fff' : C.ink, marginTop: 6 }}>{valor}</p>
      {nota && <p style={{ fontSize: 10, color: fuerte ? '#FFFFFF80' : '#1A1A1A60', marginTop: 4 }}>{nota}</p>}
    </div>
  )
}

const h2: React.CSSProperties = { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1A1A1A70', fontWeight: 500, marginTop: 36, marginBottom: 12 }
const tarjeta: React.CSSProperties = { background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 4, padding: '16px 18px' }
const chip: React.CSSProperties = { display: 'inline-block', fontSize: 10, padding: '3px 8px', borderRadius: 3, fontWeight: 500 }
const filaRatio: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) 120px 110px 110px 110px', gap: 12, alignItems: 'baseline',
  padding: '9px 20px', borderTop: `1px solid ${C.bordeSuave}`,
}
const celdaNum: React.CSSProperties = { fontSize: 12, color: C.ink, textAlign: 'right', whiteSpace: 'nowrap' }
