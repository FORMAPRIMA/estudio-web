'use client'

// Ventana a ventana: planta con las ventanas numeradas y un alzado acotado de cada
// una para decidir si se cambia, si lleva persiana y corregir alto y antepecho.

import { useEffect, useMemo, useRef, useState } from 'react'
import { type ModeloEstadoActual } from '@/lib/presupuestos-parametricos/maqueta/modelo'
import { ventanasFachada, medicionesVentanas, ELECCION_DEFECTO, type Elecciones, type EleccionVentana, type VentanaFachada } from '@/lib/presupuestos-parametricos/maqueta/ventanas'
import { T, fmt, Rotulo, Boton, Interruptor, input } from './ui'

const VERDE = '#1D9E75'
const GRIS = '#B9B4AA'

export default function EditorVentanas({ modelo, imagen, elecciones, onCambio, onCerrar }: {
  modelo: ModeloEstadoActual; imagen: string; elecciones: Elecciones
  onCambio: (e: Elecciones) => void; onCerrar: () => void
}) {
  const vs = useMemo(() => ventanasFachada(modelo, elecciones), [modelo, elecciones])
  const med = useMemo(() => medicionesVentanas(modelo, elecciones), [modelo, elecciones])
  const [activa, setActiva] = useState<string | null>(null)
  const tarjetas = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCerrar])

  const set = (id: string, cambios: Partial<EleccionVentana>) =>
    onCambio({ ...elecciones, [id]: { ...(elecciones[id] ?? ELECCION_DEFECTO), ...cambios } })
  const todas = (cambios: Partial<EleccionVentana>) =>
    onCambio(Object.fromEntries(vs.map(v => [v.hueco.id, { ...(elecciones[v.hueco.id] ?? ELECCION_DEFECTO), ...cambios }])))
  const enfocar = (id: string) => { setActiva(id); tarjetas.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,18,15,.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(1400px, 96vw)', height: 'min(860px, 92vh)', background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px', borderBottom: `1px solid ${T.borde}`, flexWrap: 'wrap' }}>
          <div>
            <Rotulo>Carpintería exterior</Rotulo>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: T.tinta, marginTop: 2 }}>Ventanas y balconeras</h2>
          </div>
          <div style={{ display: 'flex', gap: 18, marginLeft: 24 }}>
            <Cifra valor={`${med.n_ventanas_cambiar} de ${med.total}`} etiqueta="se cambian" />
            <Cifra valor={`${fmt(med.m2_ventanas_cambiar, 2)} m²`} etiqueta="de carpintería" />
            <Cifra valor={`${med.n_persianas}`} etiqueta="persianas" />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Boton variante="secundario" onClick={() => todas({ cambiar: true })}>Cambiar todas</Boton>
            <Boton variante="secundario" onClick={() => todas({ cambiar: false })}>Ninguna</Boton>
            <Boton variante="secundario" onClick={() => todas({ persiana: true })}>Persiana en todas</Boton>
            <Boton variante="primario" onClick={onCerrar}>Hecho</Boton>
          </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)' }}>
          <div style={{ borderRight: `1px solid ${T.borde}`, background: T.crema, position: 'relative' }}>
            <Planta modelo={modelo} imagen={imagen} ventanas={vs} activa={activa} onElegir={enfocar} />
            <p style={{ position: 'absolute', left: 14, bottom: 12, fontSize: 11, color: T.tinta3, background: 'rgba(255,255,255,.9)', padding: '5px 9px', borderRadius: 6 }}>
              <span style={{ color: VERDE, fontWeight: 700 }}>●</span> se cambia &nbsp; <span style={{ color: GRIS, fontWeight: 700 }}>●</span> se queda · clic para ir a su alzado
            </p>
          </div>
          <div style={{ overflowY: 'auto', padding: 18 }}>
            {vs.length === 0 && <p style={{ fontSize: 13, color: T.tinta3 }}>La maqueta no tiene ventanas en fachada.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
              {vs.map(v => (
                <div key={v.hueco.id} ref={el => { tarjetas.current[v.hueco.id] = el }} onMouseEnter={() => setActiva(v.hueco.id)}>
                  <Tarjeta v={v} H={modelo.alturaLibre} activa={activa === v.hueco.id} onCambio={c => set(v.hueco.id, c)} />
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: T.tinta3, marginTop: 16, lineHeight: 1.5 }}>
              El ancho sale medido de la maqueta. El alto y el antepecho son los habituales según el tipo; corrígelos si los conoces.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Cifra({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div>
      <p style={{ fontSize: 16, fontWeight: 600, color: T.tinta }}>{valor}</p>
      <p style={{ fontSize: 11, color: T.tinta3 }}>{etiqueta}</p>
    </div>
  )
}

function Planta({ modelo, imagen, ventanas, activa, onElegir }: {
  modelo: ModeloEstadoActual; imagen: string; ventanas: VentanaFachada[]; activa: string | null; onElegir: (id: string) => void
}) {
  const { ancho, alto } = modelo.imagen
  const caja = useMemo(() => {
    const xs = modelo.contorno.map(p => p.x), ys = modelo.contorno.map(p => p.y)
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const m = Math.max(x1 - x0, y1 - y0) * 0.08
    return `${x0 - m} ${y0 - m} ${x1 - x0 + 2 * m} ${y1 - y0 + 2 * m}`
  }, [modelo.contorno])
  const f = Math.max(1, ancho / 1600)
  return (
    <svg viewBox={caja} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }}>
      <image href={imagen} x={0} y={0} width={ancho} height={alto} opacity={0.45} />
      {ventanas.map(v => {
        const { a, b, id } = v.hueco
        const color = v.eleccion.cambiar ? VERDE : GRIS
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        const act = activa === id
        return (
          <g key={id} onClick={() => onElegir(id)} style={{ cursor: 'pointer' }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={(act ? 18 : 12) * f} strokeLinecap="round" />
            <circle cx={mx} cy={my} r={(act ? 17 : 14) * f} fill={act ? T.tinta : color} stroke="#fff" strokeWidth={2 * f} />
            <text x={mx} y={my + 4 * f} fontSize={11 * f} fontWeight={700} fill="#fff" textAnchor="middle" fontFamily="Inter, Arial, sans-serif">{id}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Tarjeta({ v, H, activa, onCambio }: { v: VentanaFachada; H: number; activa: boolean; onCambio: (c: Partial<EleccionVentana>) => void }) {
  const e = v.eleccion
  return (
    <div style={{
      border: `1.5px solid ${activa ? T.tinta : e.cambiar ? `${VERDE}55` : T.borde}`, borderRadius: 10, padding: 12, background: e.cambiar ? '#fff' : T.crema,
      transition: 'border-color .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.tinta }}>{v.hueco.id}</span>
        <span style={{ fontSize: 11, color: T.tinta3 }}>{v.hueco.tipo === 'balconera' ? 'Balconera' : 'Ventana'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.tinta2 }}>{fmt(v.ancho * v.alto, 2)} m²</span>
      </div>
      <Alzado v={v} H={H} />
      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
        <Interruptor activo={e.cambiar} onCambio={c => onCambio({ cambiar: c })} label="Se cambia" />
        <Interruptor activo={e.persiana} onCambio={p => onCambio({ persiana: p })} label="Persiana" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <CampoCm label="Alto" valor={v.alto} onCambio={x => onCambio({ alto: x })} />
        <CampoCm label="Antepecho" valor={v.antepecho} onCambio={x => onCambio({ antepecho: x })} />
      </div>
    </div>
  )
}

function CampoCm({ label, valor, onCambio }: { label: string; valor: number; onCambio: (m: number) => void }) {
  const [texto, setTexto] = useState(String(Math.round(valor * 100)))
  useEffect(() => setTexto(String(Math.round(valor * 100))), [valor])
  const confirmar = () => { const n = Number(texto.replace(',', '.')); if (Number.isFinite(n) && n >= 0 && n <= 500) onCambio(n / 100); else setTexto(String(Math.round(valor * 100))) }
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 10, color: T.tinta3 }}>{label} (cm)</span>
      <input value={texto} onChange={ev => setTexto(ev.target.value)} onBlur={confirmar} onKeyDown={ev => { if (ev.key === 'Enter') confirmar() }} inputMode="numeric" style={{ ...input, padding: '5px 8px', fontSize: 12, marginTop: 2 }} />
    </label>
  )
}

/** Alzado acotado: paño de muro de suelo a techo, hueco, persiana y cotas. Unidades en metros. */
function Alzado({ v, H }: { v: VentanaFachada; H: number }) {
  const m = 0.7
  const W = v.ancho + 2 * m
  const fs = Math.max(W, H) * 0.085
  const top = 0.35, bot = 0.25 + fs * 1.5
  const yTecho = top, ySuelo = top + H
  const yAlto = ySuelo - v.antepecho - v.alto, yBajo = ySuelo - v.antepecho
  const x0 = m, x1 = m + v.ancho
  const cajon = v.eleccion.persiana ? 0.2 : 0
  const cambia = v.eleccion.cambiar
  const vidrio = cambia ? '#CFE9F5' : '#E4E1DA'
  const marco = cambia ? '#1A1A1A' : '#9A958B'
  return (
    <svg viewBox={`0 0 ${W + 0.6} ${top + H + bot}`} style={{ width: '100%', height: 200, display: 'block', background: '#FBFAF7', borderRadius: 6 }}>
      <rect x={0} y={yTecho} width={W} height={H} fill="#F1EEE7" />
      <line x1={0} y1={ySuelo} x2={W} y2={ySuelo} stroke="#1A1A1A" strokeWidth={0.02} />
      <line x1={0} y1={yTecho} x2={W} y2={yTecho} stroke="#1A1A1A55" strokeWidth={0.012} strokeDasharray="0.06 0.04" />
      {cajon > 0 && <rect x={x0 - 0.04} y={yAlto - cajon} width={v.ancho + 0.08} height={cajon} fill="#5B5750" />}
      <rect x={x0} y={yAlto} width={v.ancho} height={v.alto} fill={vidrio} stroke={marco} strokeWidth={0.035} />
      <line x1={(x0 + x1) / 2} y1={yAlto} x2={(x0 + x1) / 2} y2={yBajo} stroke={marco} strokeWidth={0.025} />
      {cajon > 0 && Array.from({ length: Math.max(2, Math.round(v.alto * 4)) }).map((_, i, arr) => (
        <line key={i} x1={x0} y1={yAlto + (i + 1) * v.alto / (arr.length + 1)} x2={x1} y2={yAlto + (i + 1) * v.alto / (arr.length + 1)} stroke="#5B575033" strokeWidth={0.01} />
      ))}
      {!cambia && <text x={(x0 + x1) / 2} y={(yAlto + yBajo) / 2 + fs / 3} fontSize={fs} textAnchor="middle" fill="#7A756C" fontFamily="Inter, Arial">se queda</text>}
      {/* Cotas */}
      <Cota x1={x0} y1={ySuelo + 0.2} x2={x1} y2={ySuelo + 0.2} texto={fmt(v.ancho, 2)} fs={fs} />
      <Cota x1={x1 + 0.3} y1={yAlto} x2={x1 + 0.22} y2={yBajo} texto={fmt(v.alto, 2)} fs={fs} vertical />
      {v.antepecho > 0.02 && <Cota x1={x0 - 0.3} y1={yBajo} x2={x0 - 0.22} y2={ySuelo} texto={fmt(v.antepecho, 2)} fs={fs} vertical />}
    </svg>
  )
}

function Cota({ x1, y1, x2, y2, texto, fs, vertical }: { x1: number; y1: number; x2: number; y2: number; texto: string; fs: number; vertical?: boolean }) {
  const t = 0.05
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  return (
    <g stroke="#D85A30" strokeWidth={0.018} fill="#C2481F" fontWeight={600}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? <>
        <line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} /><line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} />
        <text x={mx + fs * 0.95} y={my} fontSize={fs} stroke="none" fontFamily="Inter, Arial" transform={`rotate(-90 ${mx + fs * 0.95} ${my})`} textAnchor="middle">{texto}</text>
      </> : <>
        <line x1={x1} y1={y1 - t} x2={x1} y2={y1 + t} /><line x1={x2} y1={y2 - t} x2={x2} y2={y2 + t} />
        <text x={mx} y={my + fs * 1.05} fontSize={fs} stroke="none" fontFamily="Inter, Arial" textAnchor="middle">{texto}</text>
      </>}
    </g>
  )
}
