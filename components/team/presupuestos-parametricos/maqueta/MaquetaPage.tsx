'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { preparePlano } from '@/lib/repasos/upload'
import {
  aplicarOperaciones, medicionesDesdeModelo, dist, areaPoligono, normalizarModelo,
  type ModeloEstadoActual, type Operacion, type Duda, type TipoMuro, type TipoHueco, type UsoEstancia,
} from '@/lib/presupuestos-parametricos/maqueta/modelo'
import { svgDudas, svgModelo } from '@/lib/presupuestos-parametricos/maqueta/svg'
import { FICHA_DEMOLICIONES } from '@/lib/presupuestos-parametricos/fichas/demoliciones'
import { cantidadesFicha } from '@/lib/presupuestos-parametricos/fichas'
import { LEYENDA_ESTILO, type Visor3DHandle, type EstiloVista } from './Visor3D'
import { T, fmt, Rotulo, Boton, Segmentado, Seccion, Chip, Punto, Campo, input, Interruptor, Contador } from './ui'

const Visor3D = dynamic(() => import('./Visor3D'), { ssr: false })

const CLAVE = 'fp.pp.maqueta.v1'
const ALTO_TRABAJO = 'calc(100vh - 132px)'

type Fase = 'subir' | 'levantando' | 'revisar' | 'aprobado'
type Mensaje = { rol: 'usuario' | 'ia'; texto: string }
type DatosObra = { m2: string; comunes: boolean; altura: string; planta: string; ascensor: 'si' | 'no'; acceso: 'si' | 'no' }
type Guardado = { fase: Fase; imagen: string; modelo: ModeloEstadoActual; chat: Mensaje[]; datos: DatosObra; aprobado: ModeloEstadoActual | null }

const USOS: { value: UsoEstancia; label: string }[] = [
  { value: 'estancia', label: 'Estancia' }, { value: 'cocina', label: 'Cocina' }, { value: 'bano', label: 'Baño' },
  { value: 'aseo', label: 'Aseo' }, { value: 'paso', label: 'Paso' }, { value: 'exterior', label: 'Exterior' },
]


export default function MaquetaPage() {
  const [fase, setFase] = useState<Fase>('subir')
  const [datos, setDatos] = useState<DatosObra>({ m2: '', comunes: true, altura: '', planta: '', ascensor: 'si', acceso: 'si' })
  const [archivo, setArchivo] = useState<File | null>(null)
  const [imagen, setImagen] = useState<string | null>(null)
  const [modelo, setModelo] = useState<ModeloEstadoActual | null>(null)
  const [pila, setPila] = useState<ModeloEstadoActual[]>([])
  const [aprobado, setAprobado] = useState<ModeloEstadoActual | null>(null)
  const [chat, setChat] = useState<Mensaje[]>([])
  const [isEnviando, setIsEnviando] = useState(false)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [conGeometria, setConGeometria] = useState(false)
  const [dudaActiva, setDudaActiva] = useState<string | null>(null)
  const [etiquetas, setEtiquetas] = useState(false)
  const [estilo, setEstilo] = useState<EstiloVista>('maqueta')
  const [seccion, setSeccion] = useState(false)
  const [camara, setCamara] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [segundos, setSegundos] = useState(0)
  const visor = useRef<Visor3DHandle | null>(null)

  // Sesión de trabajo en este navegador (el guardado en BD llega con las estimaciones).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLAVE)
      if (!raw) return
      const g = JSON.parse(raw) as Guardado
      setFase(g.fase === 'levantando' ? 'subir' : g.fase); setImagen(g.imagen); setModelo(normalizarModelo(g.modelo))
      setChat(g.chat); setDatos(g.datos); setAprobado(g.aprobado ? normalizarModelo(g.aprobado) : null)
    } catch { /* sin almacenamiento: se empieza de cero */ }
  }, [])
  useEffect(() => {
    if (!modelo || !imagen) return
    try { localStorage.setItem(CLAVE, JSON.stringify({ fase, imagen, modelo, chat, datos, aprobado } satisfies Guardado)) } catch { /* lleno o bloqueado */ }
  }, [fase, imagen, modelo, chat, datos, aprobado])

  useEffect(() => {
    if (fase !== 'levantando') return
    setSegundos(0)
    const t = setInterval(() => setSegundos(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [fase])

  const levantar = async () => {
    if (!archivo) return setError('Sube el plano.')
    setError(null); setFase('levantando')
    const prep = await preparePlano(archivo)
    if ('error' in prep) { setError(prep.error); setFase('subir'); return }
    const fd = new FormData()
    fd.append('plano', prep.imgBlob, 'plano.jpg')
    fd.append('m2', datos.m2); fd.append('comunes', datos.comunes ? '1' : '0'); fd.append('altura', datos.altura)
    try {
      const res = await fetch('/api/presupuestos-parametricos/maqueta/levantar', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al leer el plano.')
      const m = normalizarModelo(json.modelo)
      setImagen(json.imagen); setModelo(m); setPila([]); setChat([]); setAprobado(null); setSeleccion(null)
      setDudaActiva(m.dudas.find(d => d.estado === 'pendiente')?.id ?? null)
      setFase('revisar')
    } catch (e) {
      setError((e as Error).message); setFase('subir')
    }
  }

  const aplicar = (ops: Operacion[]) => {
    if (!modelo) return
    const r = aplicarOperaciones(modelo, ops)
    if (r.errores.length) setError(r.errores.join(' · '))
    setPila(p => [...p.slice(-30), modelo]); setModelo(r.modelo)
    return r.modelo
  }
  const deshacer = () => {
    setPila(p => {
      if (!p.length) return p
      setModelo(p[p.length - 1]); return p.slice(0, -1)
    })
  }

  /** Corrección a la IA. Si viene de una duda, la marca resuelta al aplicarse. */
  const enviarTexto = async (texto: string, duda?: Duda) => {
    if (!texto || !modelo || !imagen) return
    setIsEnviando(true); setError(null)
    const historial = [...chat, { rol: 'usuario' as const, texto }]
    setChat(historial)
    try {
      const res = await fetch('/api/presupuestos-parametricos/maqueta/corregir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen, modelo, mensaje: texto, historial: chat }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No se pudo aplicar.')
      let nuevo: ModeloEstadoActual = json.operaciones?.length ? normalizarModelo(json.modelo) : modelo
      if (duda) nuevo = aplicarOperaciones(nuevo, [{ op: 'resolver_duda', id: duda.id, respuesta: texto }]).modelo
      if (nuevo !== modelo) { setPila(p => [...p.slice(-30), modelo]); setModelo(nuevo) }
      const extra = json.errores?.length ? ` (no se pudo: ${json.errores.join(', ')})` : ''
      setChat([...historial, { rol: 'ia', texto: json.respuesta + extra }])
    } catch (e) {
      setChat([...historial, { rol: 'ia', texto: `Error: ${(e as Error).message}` }])
    } finally {
      setIsEnviando(false)
    }
  }

  const descargarGLB = async () => {
    if (!visor.current) return
    // La sección corta los muros: el GLB se exporta siempre con la altura completa.
    if (seccion) { setSeccion(false); await new Promise(r => setTimeout(r, 150)) }
    if (!visor.current) return
    const blob = await visor.current.exportarGLB()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `maqueta-estado-actual-v${modelo?.version ?? 1}.glb`; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  const empezarDeNuevo = () => {
    try { localStorage.removeItem(CLAVE) } catch { /* nada */ }
    setFase('subir'); setModelo(null); setImagen(null); setChat([]); setAprobado(null); setPila([]); setArchivo(null); setDudaActiva(null); setError(null)
  }

  const abrirDuda = (id: string | null) => {
    setDudaActiva(id)
    const d = modelo?.dudas.find(x => x.id === id)
    if (d?.elementos[0]) setSeleccion(d.elementos[0])
  }

  const enTrabajo = (fase === 'revisar' || fase === 'aprobado') && modelo && imagen
  const vista = fase === 'aprobado' && aprobado ? aprobado : modelo

  return (
    <div style={{ padding: '18px 24px 20px', background: T.fondo, minHeight: '100vh' }}>
      <Cabecera fase={fase} modelo={modelo} puedeDeshacer={pila.length > 0 && fase === 'revisar'} onDeshacer={deshacer} onDescargar={enTrabajo ? descargarGLB : null} onNuevo={modelo ? empezarDeNuevo : null} />

      {error && (
        <div style={{ margin: '12px 0 0', padding: '10px 14px', borderRadius: 8, background: '#FDECEA', color: T.error, fontSize: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: T.error, cursor: 'pointer', fontSize: 14 }} aria-label="Cerrar">✕</button>
        </div>
      )}

      {(fase === 'subir' || fase === 'levantando') && (
        <Subida datos={datos} setDatos={setDatos} archivo={archivo} setArchivo={setArchivo} onLevantar={levantar} isLevantando={fase === 'levantando'} segundos={segundos} />
      )}

      {enTrabajo && vista && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 372px', gap: 16, marginTop: 14 }}>
          {/* Área de trabajo: maqueta y plano en un mismo marco */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', height: ALTO_TRABAJO, minHeight: 560, background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            <div style={{ position: 'relative', borderRight: `1px solid ${T.borde}` }}>
              <Visor3D key={camara} control={visor} modelo={vista} seleccion={seleccion} onSeleccionar={setSeleccion} etiquetas={etiquetas} estilo={estilo} seccion={seccion} onDuda={fase === 'revisar' ? abrirDuda : undefined} />
              <BarraPanel titulo="3D" oscuro={estilo === 'tecnica'}>
                <Segmentado<EstiloVista> valor={estilo} onCambio={setEstilo} opciones={[{ value: 'maqueta', label: 'Maqueta' }, { value: 'tecnica', label: 'Técnica' }]} />
                <Interruptor activo={seccion} onCambio={setSeccion} label="Sección" />
                <Interruptor activo={etiquetas} onCambio={setEtiquetas} label="Etiquetas" />
                <Boton variante="fantasma" onClick={() => setCamara(c => c + 1)} title="Volver a encuadrar" style={{ padding: '5px 8px', fontSize: 13 }}>⤢</Boton>
              </BarraPanel>
              <Leyenda oscuro={estilo === 'tecnica'} items={LEYENDA_ESTILO[estilo]} />
            </div>
            <div style={{ position: 'relative', background: '#fff' }}>
              <Vista2D imagen={imagen} modelo={vista} seleccion={seleccion} etiquetas={etiquetas} conGeometria={conGeometria} dudaActiva={dudaActiva} onDuda={fase === 'revisar' ? abrirDuda : undefined} />
              <BarraPanel titulo="Plano">
                <Segmentado valor={conGeometria ? 'con' : 'limpio'} onCambio={v => setConGeometria(v === 'con')} opciones={[{ value: 'limpio', label: 'Plano limpio' }, { value: 'con', label: 'Con la maqueta' }]} />
              </BarraPanel>
            </div>
          </div>

          {/* Panel lateral */}
          <aside style={{ height: ALTO_TRABAJO, minHeight: 560, background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
            {fase === 'revisar' && modelo ? (
              <LateralRevision
                modelo={modelo} seleccion={seleccion} setSeleccion={setSeleccion} aplicar={aplicar}
                dudaActiva={dudaActiva} abrirDuda={abrirDuda}
                chat={chat} enviarTexto={enviarTexto} isEnviando={isEnviando}
                onAprobar={() => { setAprobado(modelo); setFase('aprobado'); setSeleccion(null); setDudaActiva(null) }}
              />
            ) : (
              <LateralResultado modelo={vista} datos={datos} setDatos={setDatos} onReabrir={() => setFase('revisar')} />
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

// ── Cabecera ─────────────────────────────────────────────────────────────────

function Cabecera({ fase, modelo, puedeDeshacer, onDeshacer, onDescargar, onNuevo }: {
  fase: Fase; modelo: ModeloEstadoActual | null; puedeDeshacer: boolean; onDeshacer: () => void
  onDescargar: (() => void) | null; onNuevo: (() => void) | null
}) {
  const [confirmando, setConfirmando] = useState(false)
  const pasos = [
    { id: 'plano', label: 'Plano', hecho: fase !== 'subir' && fase !== 'levantando', actual: fase === 'subir' || fase === 'levantando' },
    { id: 'revision', label: 'Revisión', hecho: fase === 'aprobado', actual: fase === 'revisar' },
    { id: 'calculo', label: 'Cálculo', hecho: false, actual: fase === 'aprobado' },
  ]
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <Link href="/team/apps/presupuestos-parametricos" style={{ fontSize: 11, color: T.tinta3, textDecoration: 'none' }}>Presupuestos paramétricos</Link>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, color: T.tinta, letterSpacing: '-0.01em' }}>Maqueta del estado actual</h1>
          <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.acento, fontWeight: 600 }}>Demoliciones · prototipo</span>
        </div>
      </div>

      <ol style={{ display: 'flex', alignItems: 'center', gap: 6, listStyle: 'none', margin: '0 auto', padding: 0 }}>
        {pasos.map((p, i) => (
          <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ width: 28, height: 1, background: p.hecho || p.actual ? T.tinta4 : T.borde }} />}
            <span style={{
              width: 20, height: 20, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
              background: p.hecho ? T.ok : p.actual ? T.tinta : '#fff', color: p.hecho || p.actual ? '#fff' : T.tinta3, border: `1px solid ${p.hecho ? T.ok : p.actual ? T.tinta : T.borde}`,
            }}>{p.hecho ? '✓' : i + 1}</span>
            <span style={{ fontSize: 12, fontWeight: p.actual ? 600 : 400, color: p.actual ? T.tinta : T.tinta3 }}>{p.label}</span>
          </li>
        ))}
      </ol>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
        {fase === 'revisar' && <Boton variante="fantasma" onClick={onDeshacer} disabled={!puedeDeshacer} title="Deshacer el último cambio">↶ Deshacer</Boton>}
        {onDescargar && <Boton variante="secundario" onClick={onDescargar} title={modelo ? `Maqueta versión ${modelo.version}` : ''}>Descargar GLB</Boton>}
        {onNuevo && (confirmando ? (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: T.tinta2 }}>
            ¿Descartar esta maqueta?
            <Boton variante="primario" onClick={() => { setConfirmando(false); onNuevo() }} style={{ padding: '6px 10px' }}>Sí</Boton>
            <Boton variante="secundario" onClick={() => setConfirmando(false)} style={{ padding: '6px 10px' }}>No</Boton>
          </span>
        ) : (
          <Boton variante="secundario" onClick={() => setConfirmando(true)}>Otro plano</Boton>
        ))}
      </div>
    </header>
  )
}

// ── Paso 1: plano ────────────────────────────────────────────────────────────

function Subida({ datos, setDatos, archivo, setArchivo, onLevantar, isLevantando, segundos }: {
  datos: DatosObra; setDatos: (d: DatosObra) => void; archivo: File | null; setArchivo: (f: File | null) => void
  onLevantar: () => void; isLevantando: boolean; segundos: number
}) {
  const [encima, setEncima] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const vista = useMemo(() => (archivo && archivo.type.startsWith('image/') ? URL.createObjectURL(archivo) : null), [archivo])
  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista) }, [vista])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 1fr)', gap: 16, marginTop: 14 }}>
      <div
        onDragOver={e => { e.preventDefault(); if (!isLevantando) setEncima(true) }}
        onDragLeave={() => setEncima(false)}
        onDrop={e => { e.preventDefault(); setEncima(false); if (!isLevantando && e.dataTransfer.files[0]) setArchivo(e.dataTransfer.files[0]) }}
        onClick={() => { if (!isLevantando && !archivo) entrada.current?.click() }}
        style={{
          position: 'relative', height: ALTO_TRABAJO, minHeight: 520, borderRadius: 12, overflow: 'hidden',
          background: '#fff', border: `1.5px dashed ${encima ? T.acento : archivo ? T.borde : '#D5D1C7'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: archivo || isLevantando ? 'default' : 'pointer',
        }}
      >
        <input ref={entrada} type="file" accept="image/*,application/pdf" hidden onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
        {vista ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vista} alt="Plano" style={{ maxWidth: '92%', maxHeight: '92%', objectFit: 'contain', opacity: isLevantando ? 0.35 : 1, transition: 'opacity .3s' }} />
        ) : (
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: `${T.acento}14`, color: T.acento, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>⬆</div>
            <p style={{ fontSize: 15, color: T.tinta, fontWeight: 500 }}>{archivo ? archivo.name : 'Arrastra aquí el plano'}</p>
            <p style={{ fontSize: 12, color: T.tinta3, marginTop: 6, lineHeight: 1.5 }}>o haz clic para elegirlo. Imagen o PDF: el del anuncio, el de la compraventa o un croquis a mano con medidas.</p>
          </div>
        )}
        {isLevantando && <Escaneo segundos={segundos} />}
        {archivo && !isLevantando && (
          <Boton variante="secundario" onClick={e => { e.stopPropagation(); entrada.current?.click() }} style={{ position: 'absolute', top: 14, right: 14 }}>Cambiar plano</Boton>
        )}
      </div>

      <div style={{ background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 18, height: 'fit-content' }}>
        <div>
          <Rotulo>Datos de la vivienda</Rotulo>
          <p style={{ fontSize: 12, color: T.tinta3, marginTop: 6, lineHeight: 1.5 }}>Sirven para poner el plano a escala. Si el plano trae cotas legibles, mandan las cotas.</p>
        </div>
        <Campo label="Superficie construida (m²)">
          <input value={datos.m2} onChange={e => setDatos({ ...datos, m2: e.target.value })} inputMode="decimal" placeholder="p. ej. 114" style={input} disabled={isLevantando} />
        </Campo>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Interruptor activo={datos.comunes} onCambio={v => !isLevantando && setDatos({ ...datos, comunes: v })} />
          <span style={{ fontSize: 12, color: T.tinta2, lineHeight: 1.45 }}>
            Son los m² del Catastro o del anuncio
            <span style={{ display: 'block', fontSize: 11, color: T.tinta3 }}>Incluyen zonas comunes: se descuenta un 6 %.</span>
          </span>
        </div>
        <Campo label="Altura libre (m)" ayuda="Opcional. Se ajusta después en la maqueta.">
          <input value={datos.altura} onChange={e => setDatos({ ...datos, altura: e.target.value })} inputMode="decimal" placeholder="2,60" style={input} disabled={isLevantando} />
        </Campo>
        <Boton variante="primario" onClick={onLevantar} disabled={isLevantando || !archivo} style={{ padding: '12px 16px', fontSize: 13 }}>
          {isLevantando ? `Levantando la maqueta · ${segundos} s` : 'Levantar maqueta'}
        </Boton>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, borderTop: `1px solid ${T.suave}`, paddingTop: 16 }}>
          {[
            ['La IA lee el plano', 'muros, ventanas, puertas, estancias y lo que no tiene claro.'],
            ['Revisas la maqueta 3D', 'al lado del plano, y resuelves sus dudas con un clic.'],
            ['Das el visto bueno', 'y salen las mediciones de la demolición.'],
          ].map(([t, d], i) => (
            <li key={t} style={{ display: 'flex', gap: 10 }}>
              <span style={{ width: 18, height: 18, borderRadius: 9, background: T.suave, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.tinta2, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: T.tinta2, lineHeight: 1.45 }}><b style={{ fontWeight: 600, color: T.tinta }}>{t}</b> {d}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function Escaneo({ segundos }: { segundos: number }) {
  return (
    <>
      <style>{`@keyframes pp-escaneo { 0% { top: 4% } 50% { top: 92% } 100% { top: 4% } }`}</style>
      <div style={{ position: 'absolute', left: '4%', right: '4%', height: 2, background: T.acento, boxShadow: `0 0 18px 4px ${T.acento}55`, animation: 'pp-escaneo 3.2s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: T.tinta, color: '#fff', borderRadius: 999, padding: '9px 18px', fontSize: 12, display: 'flex', gap: 10, alignItems: 'center', whiteSpace: 'nowrap' }}>
        <span>La IA está leyendo el plano y ajustando cada muro</span>
        <span style={{ opacity: 0.6 }}>{segundos} s · suele tardar 1–3 min</span>
      </div>
    </>
  )
}

// ── Área de trabajo ──────────────────────────────────────────────────────────

function BarraPanel({ titulo, detalle, oscuro, children }: { titulo: string; detalle?: string; oscuro?: boolean; children?: ReactNode }) {
  const caja: CSSProperties = oscuro
    ? { background: 'rgba(14,22,30,.78)', border: '1px solid rgba(127,216,255,.18)', color: '#E6F4FF' }
    : { background: 'rgba(255,255,255,.92)', border: `1px solid ${T.borde}`, color: T.tinta }
  return (
    <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none', flexWrap: 'wrap' }}>
      <div style={{ ...caja, backdropFilter: 'blur(8px)', borderRadius: 8, padding: '6px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>{titulo}</span>
        {detalle && <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8 }}>{detalle}</span>}
      </div>
      <div style={{ ...caja, marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', pointerEvents: 'auto', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '3px 6px 3px 3px' }}
        className={oscuro ? 'pp-barra-oscura' : undefined}>
        {children}
      </div>
      {oscuro && <style>{`.pp-barra-oscura span { color: #CFE3F2 !important }`}</style>}
    </div>
  )
}

function Leyenda({ oscuro, items }: { oscuro?: boolean; items: { color: string; label: string }[] }) {
  return (
    <div style={{
      position: 'absolute', left: 12, bottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10, backdropFilter: 'blur(8px)', borderRadius: 8, padding: '6px 10px', maxWidth: 'calc(100% - 24px)',
      background: oscuro ? 'rgba(14,22,30,.78)' : 'rgba(255,255,255,.92)', border: oscuro ? '1px solid rgba(127,216,255,.18)' : `1px solid ${T.borde}`,
    }}>
      {items.map(l => (
        <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: oscuro ? '#CFE3F2' : T.tinta2 }}>
          <Punto color={l.color} /> {l.label}
        </span>
      ))}
    </div>
  )
}

function Vista2D({ imagen, modelo, seleccion, etiquetas, conGeometria, dudaActiva, onDuda }: {
  imagen: string; modelo: ModeloEstadoActual; seleccion: string | null; etiquetas: boolean; conGeometria: boolean
  dudaActiva: string | null; onDuda?: (id: string) => void
}) {
  // Las dudas se ven también con el plano limpio: sin ellas, el plano limpio no sirve para revisar.
  const marcas = useMemo(() => (onDuda ? svgDudas(modelo, dudaActiva) : ''), [modelo, dudaActiva, onDuda])
  const interior = useMemo(() => {
    if (!conGeometria) return ''
    const svg = svgModelo(modelo, { etiquetas, seleccion })
    return svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))
  }, [modelo, etiquetas, seleccion, conGeometria])
  const { ancho, alto } = modelo.imagen
  // Encuadre: la vivienda (contorno) con margen, no la captura entera del anuncio.
  const caja = useMemo(() => {
    const xs = modelo.contorno.map(p => p.x), ys = modelo.contorno.map(p => p.y)
    if (!xs.length) return `0 0 ${ancho} ${alto}`
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const m = Math.max(x1 - x0, y1 - y0) * 0.1
    const ax = Math.max(0, x0 - m), ay = Math.max(0, y0 - m * 1.4)
    return `${ax} ${ay} ${Math.min(ancho, x1 + m) - ax} ${Math.min(alto, y1 + m) - ay}`
  }, [modelo.contorno, ancho, alto])
  return (
    <svg viewBox={caja} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }}>
      <image href={imagen} x={0} y={0} width={ancho} height={alto} opacity={conGeometria ? 0.5 : 1} />
      {conGeometria && <g dangerouslySetInnerHTML={{ __html: interior }} />}
      {marcas && (
        <g
          dangerouslySetInnerHTML={{ __html: marcas }}
          onClick={e => { const id = (e.target as Element).closest('[data-duda]')?.getAttribute('data-duda'); if (id) onDuda?.(id) }}
        />
      )}
    </svg>
  )
}

// ── Lateral: revisión ────────────────────────────────────────────────────────

function LateralRevision(p: {
  modelo: ModeloEstadoActual; seleccion: string | null; setSeleccion: (id: string | null) => void
  aplicar: (ops: Operacion[]) => ModeloEstadoActual | undefined
  dudaActiva: string | null; abrirDuda: (id: string | null) => void
  chat: Mensaje[]; enviarTexto: (t: string, d?: Duda) => Promise<void>; isEnviando: boolean
  onAprobar: () => void
}) {
  const m = p.modelo
  const ppm = m.escala.pxPorMetro
  const pendientes = m.dudas.filter(d => d.estado === 'pendiente')
  const total = m.dudas.length
  const activa = m.dudas.find(d => d.id === p.dudaActiva && d.estado === 'pendiente') ?? null
  const estructurales = m.muros.filter(w => w.tipo === 'estructural')
  const cuerpo = useRef<HTMLDivElement>(null)
  useEffect(() => { if (activa) cuerpo.current?.scrollTo({ top: 0, behavior: 'smooth' }) }, [activa?.id])

  const resolver = (d: Duda, o: Duda['opciones'][number]) => {
    p.aplicar([...o.operaciones, { op: 'resolver_duda', id: d.id, respuesta: o.etiqueta }])
    const siguiente = pendientes.find(x => x.id !== d.id)
    p.abrirDuda(siguiente?.id ?? null)
  }

  return (
    <>
      {/* Progreso */}
      <div style={{ padding: '18px 20px 16px', borderBottom: `1px solid ${T.suave}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Rotulo>Revisión</Rotulo>
          <span style={{ fontSize: 12, color: pendientes.length ? T.tinta2 : T.ok, fontWeight: 600 }}>
            {total === 0 ? 'Sin dudas' : pendientes.length ? `${total - pendientes.length} de ${total} dudas resueltas` : 'Todas las dudas resueltas'}
          </span>
        </div>
        {total > 0 && (
          <div style={{ height: 4, borderRadius: 2, background: T.suave, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((total - pendientes.length) / total) * 100}%`, background: pendientes.length ? T.duda : T.ok, transition: 'width .3s' }} />
          </div>
        )}
      </div>

      <div ref={cuerpo} style={{ flex: 1, overflowY: 'auto' }}>
        {activa ? (
          <TarjetaDuda
            key={activa.id} duda={activa} indice={pendientes.findIndex(d => d.id === activa.id) + 1} pendientes={pendientes.length}
            isEnviando={p.isEnviando}
            onElemento={id => p.setSeleccion(id)}
            onResolver={o => resolver(activa, o)}
            onOtra={texto => { void p.enviarTexto(`Sobre ${activa.id}${activa.elementos.length ? ` (${activa.elementos.join(', ')})` : ''} — «${activa.pregunta}»: ${texto}`, activa); p.abrirDuda(pendientes.find(x => x.id !== activa.id)?.id ?? null) }}
            onNavegar={dir => { const i = pendientes.findIndex(d => d.id === activa.id); const n = pendientes[(i + dir + pendientes.length) % pendientes.length]; p.abrirDuda(n.id) }}
            onCerrar={() => p.abrirDuda(null)}
          />
        ) : pendientes.length > 0 ? (
          <div style={{ padding: '14px 20px 16px' }}>
            <p style={{ fontSize: 12, color: T.tinta2, lineHeight: 1.5, marginBottom: 10 }}>
              La IA tiene <b>{pendientes.length} duda{pendientes.length === 1 ? '' : 's'}</b>. Están marcadas con <Chip color={T.duda}>?</Chip> en la maqueta y en el plano.
            </p>
            {pendientes.map(d => (
              <button key={d.id} onClick={() => p.abrirDuda(d.id)} style={filaBoton}>
                <Punto color={T.duda} />
                <span style={{ flex: 1, fontSize: 12, color: T.tinta, lineHeight: 1.45, textAlign: 'left' }}>{d.pregunta}</span>
                <span style={{ color: T.tinta4, fontSize: 12 }}>›</span>
              </button>
            ))}
          </div>
        ) : null}

        {p.seleccion && <Seleccionado modelo={m} id={p.seleccion} aplicar={p.aplicar} cerrar={() => p.setSeleccion(null)} />}

        <Seccion titulo="Vivienda" extra={`${fmt(areaPoligono(m.contorno) / ppm ** 2)} m²`}>
          <SliderAltura valor={m.alturaLibre} onConfirmar={v => p.aplicar([{ op: 'altura', valor: v }])} />
          <p style={{ fontSize: 11, color: T.tinta3, marginTop: 10, lineHeight: 1.5 }}>Escala: {m.escala.detalle}.</p>
          {m.avisos.length > 0 && (
            <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {m.avisos.map((a, i) => <li key={i} style={{ fontSize: 11, color: T.tinta2, lineHeight: 1.45, paddingLeft: 12, borderLeft: `2px solid ${T.borde}` }}>{a}</li>)}
            </ul>
          )}
        </Seccion>

        <Seccion titulo="Estancias" extra={`${m.estancias.length}`}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '8px 10px', alignItems: 'center' }}>
            <span style={cabTabla}>Estancia</span><span style={cabTabla}>Uso</span><span style={cabTabla} title="Falso techo">F. techo</span><span style={cabTabla}>Armarios</span>
            {m.estancias.map(e => (
              <FilaEstancia key={e.id} e={e} ppm={ppm} activa={p.seleccion === e.id} onSeleccionar={() => p.setSeleccion(e.id)} aplicar={p.aplicar} />
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Muros estructurales" extra={`${estructurales.length}`} abierta={false}>
          <p style={{ fontSize: 11, color: T.tinta3, lineHeight: 1.5, marginBottom: 8 }}>No se demuelen nunca. Selecciona cualquier muro en la maqueta para cambiar su tipo.</p>
          {estructurales.length === 0 && <p style={{ fontSize: 12, color: T.tinta3 }}>Ninguno.</p>}
          {estructurales.map(w => (
            <button key={w.id} onClick={() => p.setSeleccion(w.id)} style={filaBoton}>
              <Punto color={T.morado} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.morado, minWidth: 30 }}>{w.id}</span>
              <span style={{ flex: 1, fontSize: 11, color: T.tinta2, textAlign: 'left' }}>{fmt(dist(w.a, w.b) / ppm, 2)} m{w.estructuralProbable ? ' · por confirmar' : ' · confirmado'}</span>
            </button>
          ))}
        </Seccion>

        <Seccion titulo="Asistente" extra={p.chat.length ? `${p.chat.length} mensajes` : 'corrige la maqueta'} abierta={false}>
          <Chat chat={p.chat} isEnviando={p.isEnviando} onEnviar={t => p.enviarTexto(t)} />
        </Seccion>
      </div>

      {/* Visto bueno, siempre a la vista */}
      <div style={{ padding: 16, borderTop: `1px solid ${T.borde}`, background: T.crema }}>
        {pendientes.length === 0 ? (
          <Boton variante="acento" onClick={p.onAprobar} style={{ width: '100%', padding: '12px 16px', fontSize: 13 }}>Visto bueno · se parece a la vivienda</Boton>
        ) : (
          <>
            <Boton variante="duda" onClick={() => p.abrirDuda(pendientes[0].id)} style={{ width: '100%', padding: '12px 16px', fontSize: 13 }}>
              Resolver {pendientes.length} duda{pendientes.length === 1 ? '' : 's'} pendiente{pendientes.length === 1 ? '' : 's'}
            </Boton>
            <button onClick={p.onAprobar} style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', fontSize: 11, color: T.tinta3, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>
              Dar el visto bueno igualmente
            </button>
          </>
        )}
      </div>
    </>
  )
}

function TarjetaDuda({ duda, indice, pendientes, isEnviando, onElemento, onResolver, onOtra, onNavegar, onCerrar }: {
  duda: Duda; indice: number; pendientes: number; isEnviando: boolean
  onElemento: (id: string) => void
  onResolver: (o: Duda['opciones'][number]) => void
  onOtra: (texto: string) => void
  onNavegar: (dir: 1 | -1) => void
  onCerrar: () => void
}) {
  const [otra, setOtra] = useState('')
  const [isOtraAbierta, setIsOtraAbierta] = useState(false)
  return (
    <div style={{ margin: 14, borderRadius: 10, border: `1.5px solid ${T.duda}`, background: '#FFFBF2', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: `${T.duda}1F` }}>
        <span style={{ width: 20, height: 20, borderRadius: 10, background: T.duda, color: '#fff', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>?</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.tinta2 }}>Duda {indice} de {pendientes}</span>
        <span style={{ fontSize: 10, color: T.tinta3 }}>{duda.origen === 'sistema' ? 'comprobación' : 'de la IA'}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 2 }}>
          {pendientes > 1 && <>
            <button onClick={() => onNavegar(-1)} style={navBtn} aria-label="Anterior">‹</button>
            <button onClick={() => onNavegar(1)} style={navBtn} aria-label="Siguiente">›</button>
          </>}
          <button onClick={onCerrar} style={navBtn} aria-label="Cerrar">✕</button>
        </span>
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: T.tinta }}>{duda.pregunta}</p>
        {duda.elementos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {duda.elementos.map(id => <Chip key={id} color={T.duda} onClick={() => onElemento(id)}>{id}</Chip>)}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
          {duda.opciones.map((o, i) => (
            <button key={i} onClick={() => onResolver(o)} style={{
              textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
              background: i === 0 ? T.tinta : '#fff', color: i === 0 ? '#fff' : T.tinta, border: `1px solid ${i === 0 ? T.tinta : T.borde}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ flex: 1, fontWeight: 500 }}>{o.etiqueta}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>{o.operaciones.length === 0 ? 'se queda así' : `${o.operaciones.length} cambio${o.operaciones.length === 1 ? '' : 's'}`}</span>
            </button>
          ))}
        </div>
        {isOtraAbierta ? (
          <div style={{ marginTop: 10 }}>
            <textarea autoFocus value={otra} onChange={e => setOtra(e.target.value)} rows={2} placeholder="Explícale a la IA lo que hay…" style={{ ...input, fontSize: 12, resize: 'vertical' }} />
            <Boton variante="secundario" onClick={() => onOtra(otra.trim())} disabled={!otra.trim() || isEnviando} style={{ marginTop: 6 }}>Enviar a la IA</Boton>
          </div>
        ) : (
          <button onClick={() => setIsOtraAbierta(true)} style={{ marginTop: 10, background: 'none', border: 'none', fontSize: 11, color: T.tinta3, cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>Otra respuesta…</button>
        )}
      </div>
    </div>
  )
}

function FilaEstancia({ e, ppm, activa, onSeleccionar, aplicar }: {
  e: ModeloEstadoActual['estancias'][number]; ppm: number; activa: boolean; onSeleccionar: () => void
  aplicar: (ops: Operacion[]) => void
}) {
  return (
    <>
      <button onClick={onSeleccionar} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: activa ? 600 : 500, color: T.tinta, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.nombre}</span>
        <span style={{ fontSize: 10, color: T.tinta3 }}>{fmt(areaPoligono(e.poligono) / ppm ** 2)} m²</span>
      </button>
      <select value={e.uso} onChange={ev => aplicar([{ op: 'actualizar_estancia', id: e.id, uso: ev.target.value as UsoEstancia }])} style={{ ...input, width: 86, padding: '4px 6px', fontSize: 11 }}>
        {USOS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
      </select>
      <span style={{ justifySelf: 'center' }}><Interruptor activo={e.falsoTecho} onCambio={v => aplicar([{ op: 'actualizar_estancia', id: e.id, falsoTecho: v }])} /></span>
      <Contador valor={e.armarios ?? 0} onCambio={v => aplicar([{ op: 'actualizar_estancia', id: e.id, armarios: v }])} />
    </>
  )
}

function Seleccionado({ modelo, id, aplicar, cerrar }: { modelo: ModeloEstadoActual; id: string; aplicar: (ops: Operacion[]) => void; cerrar: () => void }) {
  const ppm = modelo.escala.pxPorMetro
  const muro = modelo.muros.find(w => w.id === id)
  const hueco = modelo.huecos.find(h => h.id === id)
  const estancia = modelo.estancias.find(e => e.id === id)
  if (!muro && !hueco && !estancia) return null
  const titulo = muro ? `Muro ${id}` : hueco ? `${hueco.tipo[0].toUpperCase()}${hueco.tipo.slice(1)} ${id}` : `${estancia!.nombre}`
  const detalle = muro
    ? `${fmt(dist(muro.a, muro.b) / ppm, 2)} m de largo · ${fmt(muro.grosorPx / ppm * 100, 0)} cm de grosor`
    : hueco ? `${fmt(dist(hueco.a, hueco.b) / ppm, 2)} m de ancho · en ${hueco.muro}`
    : `${fmt(areaPoligono(estancia!.poligono) / ppm ** 2)} m²`
  return (
    <div style={{ margin: '0 14px 14px', borderRadius: 10, border: `1.5px solid #FFC400`, background: '#FFFDF2', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.tinta }}>{titulo}</span>
        <span style={{ fontSize: 11, color: T.tinta3 }}>{detalle}</span>
        <button onClick={cerrar} style={{ ...navBtn, marginLeft: 'auto' }} aria-label="Quitar selección">✕</button>
      </div>
      {muro && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmentado<TipoMuro> valor={muro.tipo} onCambio={t => aplicar([t === 'estructural' ? { op: 'confirmar_estructural', id } : { op: 'actualizar_muro', id, tipo: t }])}
            opciones={[{ value: 'tabique', label: 'Tabique' }, { value: 'estructural', label: 'Estructural' }, { value: 'exterior', label: 'Fachada' }]} />
          <Boton variante="fantasma" onClick={() => { aplicar([{ op: 'eliminar_muro', id }]); cerrar() }} style={{ color: T.error, padding: '5px 8px', fontSize: 11 }}>Eliminar</Boton>
        </div>
      )}
      {hueco && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmentado<TipoHueco> valor={hueco.tipo} onCambio={t => aplicar([{ op: 'actualizar_hueco', id, tipo: t }])}
            opciones={[{ value: 'ventana', label: 'Ventana' }, { value: 'balconera', label: 'Balconera' }, { value: 'puerta', label: 'Puerta' }, { value: 'entrada', label: 'Entrada' }]} />
          <Boton variante="fantasma" onClick={() => { aplicar([{ op: 'eliminar_hueco', id }]); cerrar() }} style={{ color: T.error, padding: '5px 8px', fontSize: 11 }}>Eliminar</Boton>
        </div>
      )}
      {estancia && <p style={{ fontSize: 11, color: T.tinta3, marginTop: 6 }}>Uso, falso techo y armarios, en la lista de estancias.</p>}
    </div>
  )
}

function Chat({ chat, isEnviando, onEnviar }: { chat: Mensaje[]; isEnviando: boolean; onEnviar: (t: string) => void }) {
  const [texto, setTexto] = useState('')
  const fin = useRef<HTMLDivElement>(null)
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }) }, [chat.length, isEnviando])
  const enviar = () => { const t = texto.trim(); if (t && !isEnviando) { setTexto(''); onEnviar(t) } }
  return (
    <div>
      <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {chat.length === 0 && <p style={{ fontSize: 11, color: T.tinta3, lineHeight: 1.5 }}>Por ejemplo: «la V3 no es tan ancha», «el balcón no es una ventana grande», «entre el salón y la cocina no hay tabique».</p>}
        {chat.map((c, i) => (
          <div key={i} style={{ alignSelf: c.rol === 'usuario' ? 'flex-end' : 'flex-start', maxWidth: '88%', background: c.rol === 'usuario' ? T.tinta : T.crema, color: c.rol === 'usuario' ? '#fff' : T.tinta, fontSize: 12, lineHeight: 1.5, padding: '8px 11px', borderRadius: 10 }}>{c.texto}</div>
        ))}
        {isEnviando && <p style={{ fontSize: 11, color: T.tinta3 }}>La IA está mirando el plano…</p>}
        <div ref={fin} />
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} disabled={isEnviando} rows={2}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
          placeholder="Escribe una corrección…" style={{ ...input, resize: 'none', fontSize: 12 }} />
        <Boton variante="primario" onClick={enviar} disabled={isEnviando || !texto.trim()} style={{ padding: '9px 12px' }}>↑</Boton>
      </div>
    </div>
  )
}

// Mientras se arrastra solo cambia la etiqueta; el modelo (y su versión) cambia al soltar.
function SliderAltura({ valor, onConfirmar }: { valor: number; onConfirmar: (v: number) => void }) {
  const [local, setLocal] = useState(valor)
  useEffect(() => setLocal(valor), [valor])
  const confirmar = () => { if (Math.abs(local - valor) > 0.001) onConfirmar(local) }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: T.tinta2 }}>Altura libre</span>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.tinta }}>{fmt(local, 2)} m</span>
      </div>
      <input type="range" min={2.2} max={4.5} step={0.05} value={local}
        onChange={e => setLocal(Number(e.target.value))} onPointerUp={confirmar} onKeyUp={confirmar} onBlur={confirmar}
        style={{ width: '100%', marginTop: 6, accentColor: T.tinta }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.tinta4 }}><span>2,20 m</span><span>4,50 m</span></div>
      <p style={{ fontSize: 11, color: T.tinta3, marginTop: 4 }}>De suelo acabado a techo. En edificios anteriores a 1940 suele pasar de 3 m.</p>
    </div>
  )
}

// ── Lateral: resultado ───────────────────────────────────────────────────────

function LateralResultado({ modelo, datos, setDatos, onReabrir }: { modelo: ModeloEstadoActual; datos: DatosObra; setDatos: (d: DatosObra) => void; onReabrir: () => void }) {
  const med = useMemo(() => medicionesDesdeModelo(modelo), [modelo])
  const valores = useMemo(() => ({
    ...med.valores,
    planta: datos.planta === '' ? null : Number(datos.planta),
    ascensor_obra: datos.ascensor === 'si',
    acceso_facil: datos.acceso === 'si',
  }), [med, datos])
  const partes = useMemo(() => cantidadesFicha(FICHA_DEMOLICIONES, valores), [valores])
  const v = med.valores
  const cifras: [string, string][] = [
    [`${fmt(v.sup_construida)} m²`, 'construidos'],
    [`${fmt(v.sup_util)} m²`, 'útiles'],
    [`${fmt(v.ml_tabique_demoler)} ml`, 'de tabique'],
    [`${fmt(v.altura_libre, 2)} m`, 'de altura'],
  ]
  return (
    <>
      <div style={{ padding: '18px 20px 16px', borderBottom: `1px solid ${T.suave}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 20, height: 20, borderRadius: 10, background: T.ok, color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.tinta }}>Visto bueno · versión {modelo.version}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          {cifras.map(([n, l]) => (
            <div key={l} style={{ background: T.crema, borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: 17, fontWeight: 600, color: T.tinta, letterSpacing: '-0.01em' }}>{n}</p>
              <p style={{ fontSize: 11, color: T.tinta3 }}>{l}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Seccion titulo="Demolición · cantidades" extra={`${partes.length} partes`}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {partes.map((c, i) => (
              <div key={c.parte} style={{ padding: '9px 0', borderTop: i ? `1px solid ${T.suave}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: T.tinta }}>{c.nombre}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.fuente === 'sin_dato' ? T.tinta4 : T.tinta, fontVariantNumeric: 'tabular-nums' }}>
                    {c.fuente === 'sin_dato' ? '—' : `${fmt(c.cantidad, Number.isInteger(Math.round(c.cantidad * 10) / 10) ? 0 : 1)} ${c.unidad}`}
                  </span>
                </div>
                <p style={{ fontSize: 10, color: T.tinta3, marginTop: 3, lineHeight: 1.45 }}>
                  {c.formula}{c.factor !== 1 ? ` · × ${fmt(c.factor, 2)} (${c.formulaFactor})` : ''}
                </p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: T.tinta3, marginTop: 12, lineHeight: 1.5, padding: '10px 12px', background: T.crema, borderRadius: 8 }}>
            Cada cantidad se multiplicará por su ratio €/unidad cuando haya obras de referencia publicadas.
          </p>
        </Seccion>

        <Seccion titulo="Logística de la obra">
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 12, alignItems: 'end' }}>
            <Campo label="Planta"><input value={datos.planta} onChange={e => setDatos({ ...datos, planta: e.target.value })} inputMode="numeric" placeholder="0" style={input} /></Campo>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Interruptor activo={datos.ascensor === 'si'} onCambio={b => setDatos({ ...datos, ascensor: b ? 'si' : 'no' })} label="Ascensor utilizable en obra" />
              <Interruptor activo={datos.acceso === 'si'} onCambio={b => setDatos({ ...datos, acceso: b ? 'si' : 'no' })} label="Carga y descarga fácil desde la calle" />
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Cómo se ha medido" abierta={false}>
          {med.detalle.map(d => (
            <div key={d.variable} style={{ display: 'flex', gap: 8, padding: '5px 0', borderTop: `1px solid ${T.suave}`, fontSize: 11 }}>
              <span style={{ flex: 1, color: T.tinta2 }}>{d.formula}</span>
              <span style={{ fontWeight: 600, color: T.tinta, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(d.valor, Number.isInteger(d.valor) ? 0 : 2)} {d.unidad}</span>
            </div>
          ))}
        </Seccion>
      </div>

      <div style={{ padding: 16, borderTop: `1px solid ${T.borde}`, background: T.crema }}>
        <Boton variante="secundario" onClick={onReabrir} style={{ width: '100%' }}>Volver a revisar la maqueta</Boton>
      </div>
    </>
  )
}

const filaBoton: CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', background: 'none', border: 'none',
  borderTop: `1px solid ${T.suave}`, cursor: 'pointer', fontFamily: 'inherit',
}
const navBtn: CSSProperties = { width: 22, height: 22, border: 'none', background: 'transparent', borderRadius: 5, cursor: 'pointer', fontSize: 13, color: T.tinta2, padding: 0, fontFamily: 'inherit' }
const cabTabla: CSSProperties = { fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.tinta3 }
