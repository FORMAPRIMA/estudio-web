'use client'

// Maqueta 3D low-poly generada desde el modelo del estado actual.
// No hay geometría propia: todo sale del modelo (muros extruidos con sus huecos
// recortados, suelos por estancia y falsos techos), así que la maqueta y los
// cálculos nunca pueden contar cosas distintas.
//
// Dos estilos de vista (solo cambian materiales y ambiente, nunca la geometría):
// - maqueta: blanca y arquitectónica, con sombra de contacto y oclusión ambiental.
// - técnica: fondo oscuro, aristas de neón por tipo de muro y resplandor.
// «Sección» corta los muros a 1,2 m para leer la distribución como un plano.

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html, Edges, Grid, ContactShadows } from '@react-three/drei'
import { EffectComposer, N8AO, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import {
  ALTURAS_HUECO, COLOR_DUDA, COLORES_HUECO, COLORES_MURO, anclaDuda, dudasPorElemento, COLORES_USO, areaPoligono, centroide, dist, huecosDeMuro,
  type ModeloEstadoActual, type Muro, type TipoMuro, type UsoEstancia,
} from '@/lib/presupuestos-parametricos/maqueta/modelo'

export type Visor3DHandle = { exportarGLB: () => Promise<Blob> }
export type EstiloVista = 'maqueta' | 'tecnica'

/** Colores de la leyenda en cada estilo (los de la técnica son los neones de las aristas). */
export const LEYENDA_ESTILO: Record<EstiloVista, { color: string; label: string }[]> = {
  maqueta: [
    { color: COLORES_MURO.exterior, label: 'Fachada' }, { color: COLORES_MURO.tabique, label: 'Tabique' }, { color: COLORES_MURO.estructural, label: 'Estructural' },
    { color: COLORES_HUECO.ventana, label: 'Ventana' }, { color: COLORES_HUECO.balconera, label: 'Balconera' }, { color: COLORES_HUECO.puerta, label: 'Puerta' }, { color: COLOR_DUDA, label: 'Duda' },
  ],
  tecnica: [
    { color: '#7FD8FF', label: 'Fachada' }, { color: '#FF8A50', label: 'Tabique' }, { color: '#C58BFF', label: 'Estructural' },
    { color: '#5FE0FF', label: 'Ventana' }, { color: '#2E9BFF', label: 'Balconera' }, { color: '#3BE39B', label: 'Puerta' }, { color: COLOR_DUDA, label: 'Duda' },
  ],
}

type Props = {
  modelo: ModeloEstadoActual
  seleccion: string | null
  onSeleccionar: (id: string | null) => void
  /** true = todas las etiquetas; false = solo dudas, estructurales, seleccionado y lo que hay bajo el ratón. */
  etiquetas: boolean
  estilo?: EstiloVista
  seccion?: boolean
  /** next/dynamic no reenvía refs: el control se publica en esta prop. */
  control?: MutableRefObject<Visor3DHandle | null>
  /** Abre una duda pendiente. */
  onDuda?: (id: string) => void
}

const ALTURA_SECCION = 1.2
const SELECCION = '#FFC400'

// ── Temas ────────────────────────────────────────────────────────────────────

type Tema = {
  fondo: string
  losa: string
  suelo: (u: UsoEstancia) => string
  sueloOpacidad: number
  muro: (t: TipoMuro) => { color: string; opacidad: number; arista: string }
  vidrio: (balconera: boolean) => string
  puerta: (entrada: boolean) => string
  rejilla: { celda: string; seccion: string }
  etiqueta: { fondo: string; texto: string; sombra: string }
}

const TEMAS: Record<EstiloVista, Tema> = {
  maqueta: {
    fondo: 'radial-gradient(120% 90% at 50% 20%, #FBFAF7 0%, #EEEAE2 70%, #E6E1D6 100%)',
    losa: '#D8D3C8',
    suelo: u => COLORES_USO[u],
    sueloOpacidad: 1,
    muro: t => t === 'tabique'
      ? { color: '#FBFAF7', opacidad: 1, arista: '#D85A30' }
      : t === 'estructural'
        ? { color: '#8A55C2', opacidad: 1, arista: '#4B2378' }
        : { color: '#3B3B3B', opacidad: 1, arista: '#1A1A1A' },
    vidrio: b => (b ? '#3D86B5' : '#8CCFEA'),
    puerta: e => (e ? '#C8A000' : '#1E9650'),
    rejilla: { celda: '#E2DED5', seccion: '#D3CEC3' },
    etiqueta: { fondo: 'rgba(255,255,255,.94)', texto: '#1A1A1A', sombra: '0 1px 3px rgba(0,0,0,.12)' },
  },
  tecnica: {
    fondo: 'radial-gradient(120% 90% at 50% 15%, #16212C 0%, #0B1117 65%, #070B0F 100%)',
    losa: '#0E151C',
    suelo: u => ({ bano: '#123247', aseo: '#123247', cocina: '#3A2A12', estancia: '#151E27', paso: '#121A22', exterior: '#13261A' }[u]),
    sueloOpacidad: 0.95,
    muro: t => t === 'tabique'
      ? { color: '#1A2430', opacidad: 0.78, arista: '#FF8A50' }
      : t === 'estructural'
        ? { color: '#2A1840', opacidad: 0.9, arista: '#C58BFF' }
        : { color: '#16202B', opacidad: 0.92, arista: '#7FD8FF' },
    vidrio: b => (b ? '#2E9BFF' : '#5FE0FF'),
    puerta: e => (e ? '#FFD34D' : '#3BE39B'),
    rejilla: { celda: '#16303F', seccion: '#1F5A78' },
    etiqueta: { fondo: 'rgba(12,20,28,.88)', texto: '#E6F4FF', sombra: '0 0 0 1px rgba(127,216,255,.25)' },
  },
}

// ── Geometría ────────────────────────────────────────────────────────────────

type Pieza = { key: string; muro: Muro; pos: [number, number, number]; size: [number, number, number]; rotY: number }
type Vidrio = { key: string; id: string; balconera: boolean; pos: [number, number, number]; size: [number, number, number]; rotY: number }
type Umbral = { key: string; id: string; tipo: string; pos: [number, number, number]; size: [number, number, number]; rotY: number }

function grosor(m: Muro, ppm: number): number {
  const g = m.grosorPx / ppm
  if (m.tipo === 'exterior') return Math.min(0.5, Math.max(0.22, g))
  if (m.tipo === 'estructural') return Math.min(0.5, Math.max(0.2, g))
  return Math.min(0.14, Math.max(0.07, g))
}

function construir(m: ModeloEstadoActual, corte: number | null) {
  const ppm = m.escala.pxPorMetro
  const H = m.alturaLibre
  const Hm = corte != null ? Math.min(corte, H) : H         // altura a la que se dibujan los muros
  // Centro de la caja de la vivienda (no la media de vértices: en plantas en L se desplaza).
  const xs = m.contorno.map(p => p.x), ys = m.contorno.map(p => p.y)
  const c = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
  const P = (p: { x: number; y: number }) => ({ x: (p.x - c.x) / ppm, z: (p.y - c.y) / ppm })

  const piezas: Pieza[] = []
  const vidrios: Vidrio[] = []
  const umbrales: Umbral[] = []
  for (const w of m.muros) {
    const A = P(w.a), B = P(w.b)
    const L = Math.hypot(B.x - A.x, B.z - A.z)
    if (L < 0.05) continue
    const d = { x: (B.x - A.x) / L, z: (B.z - A.z) / L }
    const rotY = -Math.atan2(d.z, d.x)
    const t = grosor(w, ppm)
    const ext = t / 2                                     // se alarga medio grosor para cerrar esquinas
    const huecos = huecosDeMuro(m, w).map(h => ({ ...h, desde: Math.max(0, h.desde / ppm), hasta: Math.min(L, h.hasta / ppm) }))
    const caja = (s0: number, s1: number, y0: number, y1: number, k: string) => {
      y1 = Math.min(y1, Hm)
      if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return
      const s = (s0 + s1) / 2
      piezas.push({ key: `${w.id}-${k}`, muro: w, pos: [A.x + d.x * s, (y0 + y1) / 2, A.z + d.z * s], size: [s1 - s0, y1 - y0, t], rotY })
    }
    let cursor = -ext
    huecos.forEach((h, i) => {
      caja(cursor, h.desde, 0, H, `s${i}`)
      const { antepecho, alto } = ALTURAS_HUECO[h.hueco.tipo]
      const techo = Math.min(H, antepecho + alto)
      caja(h.desde, h.hasta, 0, antepecho, `b${i}`)
      caja(h.desde, h.hasta, techo, H, `a${i}`)
      const s = (h.desde + h.hasta) / 2
      if (h.hueco.tipo === 'ventana' || h.hueco.tipo === 'balconera') {
        const arriba = Math.min(techo, Hm)
        if (arriba - antepecho > 0.02) {
          vidrios.push({ key: `${h.hueco.id}-v`, id: h.hueco.id, balconera: h.hueco.tipo === 'balconera', pos: [A.x + d.x * s, antepecho + (arriba - antepecho) / 2, A.z + d.z * s], size: [h.hasta - h.desde, arriba - antepecho, 0.03], rotY })
        }
      } else {
        umbrales.push({ key: `${h.hueco.id}-u`, id: h.hueco.id, tipo: h.hueco.tipo, pos: [A.x + d.x * s, 0.02, A.z + d.z * s], size: [h.hasta - h.desde, 0.04, t + 0.04], rotY })
      }
      cursor = h.hasta
    })
    caja(cursor, L + ext, 0, H, 'fin')
  }

  const forma = (poly: { x: number; y: number }[]) => {
    const s = new THREE.Shape()
    poly.forEach((p, i) => {
      const q = P(p)
      if (i === 0) s.moveTo(q.x, -q.z)
      else s.lineTo(q.x, -q.z)
    })
    return new THREE.ShapeGeometry(s)
  }
  const suelos = m.estancias
    .filter(e => e.poligono.length >= 3 && areaPoligono(e.poligono) > 10)
    .map(e => ({ estancia: e, geo: forma(e.poligono), centro: P(centroide(e.poligono)) }))
  const losa = forma(m.contorno)

  const ancho = (Math.max(...xs) - Math.min(...xs)) / ppm, fondo = (Math.max(...ys) - Math.min(...ys)) / ppm
  const radio = Math.hypot(ancho, fondo, H) / 2
  return { piezas, vidrios, umbrales, suelos, losa, H, Hm, radio, ancho, fondo, P }
}

// ── Visor ────────────────────────────────────────────────────────────────────

export default function Visor3D({ modelo, seleccion, onSeleccionar, etiquetas, estilo = 'maqueta', seccion = false, control, onDuda }: Props) {
  const grupo = useRef<THREE.Group>(null)
  const g = useMemo(() => construir(modelo, seccion ? ALTURA_SECCION : null), [modelo, seccion])
  const tema = TEMAS[estilo]
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    if (!control) return
    control.current = {
      async exportarGLB() {
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
        const exp = new GLTFExporter()
        const buf = await exp.parseAsync(grupo.current!, { binary: true }) as ArrayBuffer
        return new Blob([buf], { type: 'model/gltf-binary' })
      },
    }
    return () => { control.current = null }
  }, [control])

  useEffect(() => { document.body.style.cursor = hover ? 'pointer' : '' }, [hover])
  useEffect(() => () => { document.body.style.cursor = '' }, [])

  const conDuda = useMemo(() => dudasPorElemento(modelo), [modelo])
  const interaccion = (id: string) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      onSeleccionar(id)
      const d = conDuda.get(id)
      if (d && onDuda) onDuda(d)
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(id) },
    onPointerOut: () => setHover(h => (h === id ? null : h)),
  })
  // Seleccionado > con duda pendiente > bajo el ratón (aclarado) > el suyo.
  const color = (id: string, propio: string) => {
    if (seleccion === id) return SELECCION
    if (conDuda.has(id)) return COLOR_DUDA
    if (hover === id) return new THREE.Color(propio).lerp(new THREE.Color(estilo === 'tecnica' ? '#7FD8FF' : '#FFFFFF'), 0.35).getStyle()
    return propio
  }
  const brillo = (id: string) => (estilo === 'tecnica' && (seleccion === id || hover === id || conDuda.has(id)) ? 0.6 : 0)
  const ppm = modelo.escala.pxPorMetro
  const visibles = (id: string) => etiquetas || seleccion === id || hover === id || conDuda.has(id)

  return (
    <div style={{ position: 'absolute', inset: 0, background: tema.fondo, transition: 'background .4s' }}>
      <style>{`@keyframes pp-latido { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 ${COLOR_DUDA}88 } 50% { transform: scale(1.08); box-shadow: 0 0 0 8px ${COLOR_DUDA}00 } }`}</style>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        camera={{ position: [10, 16, 14], fov: 38, near: 0.1, far: 500 }}
        onPointerMissed={() => onSeleccionar(null)}
      >
        <hemisphereLight args={[estilo === 'tecnica' ? '#9FD8FF' : '#ffffff', estilo === 'tecnica' ? '#0B1117' : '#d9d4c7', estilo === 'tecnica' ? 0.55 : 0.95]} />
        <directionalLight position={[8, 14, 6]} intensity={estilo === 'tecnica' ? 0.7 : 1.35} />
        <directionalLight position={[-6, 8, -10]} intensity={0.4} />

        <Grid
          position={[0, -0.035, 0]} infiniteGrid cellSize={0.5} sectionSize={2.5} fadeDistance={g.radio * (estilo === 'tecnica' ? 4 : 2.6)} fadeStrength={estilo === 'tecnica' ? 1.6 : 2.2}
          cellColor={tema.rejilla.celda} sectionColor={tema.rejilla.seccion} cellThickness={0.6} sectionThickness={1}
        />
        {estilo === 'maqueta' && (
          <ContactShadows position={[0, -0.03, 0]} scale={g.radio * 3.2} blur={2.4} far={g.H * 1.2} opacity={0.42} resolution={512} />
        )}

        {/* Suelos: quietos */}
        <group name="suelos">
          <mesh geometry={g.losa} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} name="losa">
            <meshStandardMaterial color={tema.losa} />
          </mesh>
          {g.suelos.map(({ estancia, geo }) => (
            <mesh key={estancia.id} geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} {...interaccion(estancia.id)} name={`suelo-${estancia.id}`}>
              <meshStandardMaterial color={color(estancia.id, tema.suelo(estancia.uso))} transparent={tema.sueloOpacidad < 1} opacity={tema.sueloOpacidad} />
            </mesh>
          ))}
        </group>

        {/* Lo construido: crece desde el suelo al cargar */}
        <Crecer clave={`${modelo.imagen.ancho}-${estilo}`}>
          <group ref={grupo} name={`maqueta-v${modelo.version}`}>
            {!seccion && g.suelos.filter(s => s.estancia.falsoTecho).map(({ estancia, geo }) => (
              <mesh key={`ft-${estancia.id}`} geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, g.H - 0.25, 0]} name={`falso-techo-${estancia.id}`}>
                <meshStandardMaterial color={estilo === 'tecnica' ? '#7FD8FF' : '#ffffff'} transparent opacity={estilo === 'tecnica' ? 0.12 : 0.32} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            ))}

            {g.piezas.map(p => {
              const t = tema.muro(p.muro.tipo)
              return (
                <mesh key={p.key} position={p.pos} rotation={[0, p.rotY, 0]} {...interaccion(p.muro.id)} name={`muro-${p.muro.id}`}>
                  <boxGeometry args={p.size} />
                  <meshStandardMaterial color={color(p.muro.id, t.color)} transparent={t.opacidad < 1} opacity={t.opacidad} emissive={estilo === 'tecnica' ? t.arista : '#000000'} emissiveIntensity={brillo(p.muro.id)} roughness={0.85} />
                  <Edges color={seleccion === p.muro.id ? SELECCION : t.arista} threshold={15}>
                    <lineBasicMaterial color={seleccion === p.muro.id ? SELECCION : t.arista} toneMapped={estilo !== 'tecnica'} transparent opacity={estilo === 'tecnica' ? 1 : 0.55} />
                  </Edges>
                </mesh>
              )
            })}

            {g.vidrios.map(v => (
              <mesh key={v.key} position={v.pos} rotation={[0, v.rotY, 0]} {...interaccion(v.id)} name={`vidrio-${v.id}`}>
                <boxGeometry args={v.size} />
                <meshStandardMaterial color={color(v.id, tema.vidrio(v.balconera))} transparent opacity={estilo === 'tecnica' ? 0.45 : 0.55}
                  emissive={estilo === 'tecnica' ? tema.vidrio(v.balconera) : '#000000'} emissiveIntensity={estilo === 'tecnica' ? 0.5 + brillo(v.id) : 0} toneMapped={estilo !== 'tecnica'} />
              </mesh>
            ))}

            {g.umbrales.map(u => (
              <mesh key={u.key} position={u.pos} rotation={[0, u.rotY, 0]} {...interaccion(u.id)} name={`puerta-${u.id}`}>
                <boxGeometry args={u.size} />
                <meshStandardMaterial color={color(u.id, tema.puerta(u.tipo === 'entrada'))}
                  emissive={estilo === 'tecnica' ? tema.puerta(u.tipo === 'entrada') : '#000000'} emissiveIntensity={estilo === 'tecnica' ? 0.8 : 0} toneMapped={estilo !== 'tecnica'} />
              </mesh>
            ))}
          </group>
        </Crecer>

        {/* Etiquetas: todas, o solo lo que importa */}
        {modelo.huecos.filter(h => visibles(h.id)).map(h => {
          const q = g.P({ x: (h.a.x + h.b.x) / 2, y: (h.a.y + h.b.y) / 2 })
          const { antepecho, alto } = ALTURAS_HUECO[h.tipo]
          return (
            <Html key={`l-${h.id}`} position={[q.x, Math.min(g.Hm, antepecho + alto) + 0.25, q.z]} center zIndexRange={[10, 0]}>
              <span onClick={() => onSeleccionar(h.id)} style={chip(tema, COLORES_HUECO[h.tipo], seleccion === h.id)}>
                <i style={punto(COLORES_HUECO[h.tipo])} />{h.id}{h.tipo === 'balconera' ? ' · balconera' : ''} · {(dist(h.a, h.b) / ppm).toFixed(2).replace('.', ',')} m
              </span>
            </Html>
          )
        })}
        {modelo.muros.filter(w => w.tipo === 'estructural' || (visibles(w.id) && (seleccion === w.id || hover === w.id))).map(w => {
          const q = g.P({ x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 })
          const col = COLORES_MURO[w.tipo]
          return (
            <Html key={`l-${w.id}`} position={[q.x, g.Hm + 0.35, q.z]} center zIndexRange={[10, 0]}>
              <span onClick={() => onSeleccionar(w.id)} style={chip(tema, col, seleccion === w.id)}>
                <i style={punto(col)} />{w.id} · {w.tipo === 'estructural' ? `estructural${w.estructuralProbable ? ' ?' : ''}` : `${(dist(w.a, w.b) / ppm).toFixed(2).replace('.', ',')} m`}
              </span>
            </Html>
          )
        })}
        {g.suelos.filter(({ estancia }) => etiquetas || seleccion === estancia.id || hover === estancia.id).map(({ estancia, centro }) => (
          <Html key={`n-${estancia.id}`} position={[centro.x, 0.05, centro.z]} center zIndexRange={[5, 0]}>
            <span onClick={() => onSeleccionar(estancia.id)} style={{
              fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', letterSpacing: '0.01em',
              color: estilo === 'tecnica' ? '#CFE9FF' : '#1A1A1A',
              textShadow: estilo === 'tecnica' ? '0 0 6px rgba(0,0,0,.9)' : '0 0 3px #fff, 0 0 3px #fff',
            }}>
              {estancia.nombre}
            </span>
          </Html>
        ))}

        {(modelo.dudas ?? []).filter(d => d.estado === 'pendiente').map(d => {
          const p = anclaDuda(modelo, d)
          if (!p) return null
          const q = g.P(p)
          return (
            <Html key={`duda-${d.id}`} position={[q.x, g.Hm + 0.9, q.z]} center zIndexRange={[20, 0]}>
              <button onClick={() => onDuda?.(d.id)} title={d.pregunta} style={{
                width: 26, height: 26, borderRadius: 13, border: '2px solid #fff', background: COLOR_DUDA, color: '#fff',
                fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, animation: 'pp-latido 1.8s ease-in-out infinite',
              }}>?</button>
            </Html>
          )
        })}

        {estilo === 'maqueta' ? (
          <EffectComposer multisampling={4}>
            <N8AO aoRadius={0.6} intensity={2.2} distanceFalloff={0.6} />
          </EffectComposer>
        ) : (
          <EffectComposer multisampling={4}>
            <Bloom intensity={0.9} luminanceThreshold={0.35} luminanceSmoothing={0.3} mipmapBlur />
          </EffectComposer>
        )}

        <Encuadre radio={g.radio} altura={g.H} />
        <OrbitControls makeDefault target={[0, g.Hm / 3, 0]} maxPolarAngle={Math.PI / 2.05} enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  )
}

/** Anima la escala vertical de 0 a 1 (los muros «crecen») cada vez que cambia `clave`. */
function Crecer({ clave, children }: { clave: string; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const t0 = useRef<number | null>(null)
  useEffect(() => { t0.current = null; if (ref.current) ref.current.scale.y = 0.001 }, [clave])
  useFrame(({ clock }) => {
    if (!ref.current) return
    if (t0.current == null) t0.current = clock.elapsedTime
    const t = Math.min(1, (clock.elapsedTime - t0.current) / 1.1)
    const e = 1 - Math.pow(1 - t, 3)               // ease-out
    ref.current.scale.y = Math.max(0.001, e)
  })
  return <group ref={ref}>{children}</group>
}

function chip(tema: Tema, color: string, activo: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap', cursor: 'pointer',
    background: activo ? SELECCION : tema.etiqueta.fondo, color: activo ? '#1A1A1A' : tema.etiqueta.texto,
    boxShadow: activo ? 'none' : tema.etiqueta.sombra, border: `1px solid ${activo ? SELECCION : `${color}66`}`, backdropFilter: 'blur(4px)',
  }
}

function punto(color: string): React.CSSProperties {
  return { display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: color }
}

/**
 * Coloca la cámara para que la vivienda entera quepa en el panel, sea cual sea su
 * forma y la proporción del panel. Solo al montar (y al pulsar «Centrar», que remonta):
 * después, la cámara es de quien la mueve.
 */
function Encuadre({ radio, altura }: { radio: number; altura: number }) {
  const { camera, size } = useThree()
  const listo = size.width > 0 && size.height > 0
  // El panel puede cambiar de tamaño justo después de montar (fuentes, layout):
  // se reencuadra durante el primer segundo y medio; después, la cámara es de quien la mueve.
  const montado = useRef(performance.now())
  useEffect(() => { montado.current = performance.now() }, [radio])
  useEffect(() => {
    if (!listo || performance.now() - montado.current > 1500) return
    const cam = camera as THREE.PerspectiveCamera
    const vfov = (cam.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / Math.max(1, size.height)))
    const d = (radio * 1.08) / Math.sin(Math.min(vfov, hfov) / 2)
    const dir = new THREE.Vector3(0.55, 0.95, 0.85).normalize()
    cam.position.copy(dir.multiplyScalar(d))
    cam.near = Math.max(0.05, d / 200)
    cam.far = d * 10
    cam.lookAt(0, altura / 3, 0)
    cam.updateProjectionMatrix()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radio, listo, size.width, size.height])
  return null
}
