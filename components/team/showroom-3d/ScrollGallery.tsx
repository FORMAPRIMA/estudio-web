'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { View, PerspectiveCamera, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Modelo3D } from '@/lib/showroom'

const ACCENT = '#D85A30'
const TARGET = 2 // lado mayor del modelo normalizado (uds de mundo)

// ── Calibración del escorzo (afinar viendo en vivo) ──────────────────────────
const DESKTOP = {
  MAX_ELEV: (15 * Math.PI) / 180, // escorzo vertical según posición en el scroll
  MAX_AZIM: (16 * Math.PI) / 180, // escorzo lateral según columna
  DIST: 4.0,
  FOV: 32,
}
const MOBILE = {
  DUR: 720,   // ms de la transición entre maquetas
  UP: 3.4,    // cuánto sube la saliente hasta perderse por arriba
  BACK: 1.1,  // cuánto retrocede en Z al salir
  DOWN: 3.2,  // desde dónde entra la siguiente (por debajo)
  CAM_Y: 1.32,
  CAM_Z: 4.0,
  LOOK_Y: 0.6,
  FOV: 34,
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Normaliza la maqueta: lado mayor = TARGET, base apoyada en y=0, centrada en XZ.
function useNormalized(url: string) {
  const { scene } = useGLTF(url, '/draco/')
  return useMemo(() => {
    const root = scene.clone(true)
    let box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    root.scale.setScalar(TARGET / maxDim)

    box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    root.position.x -= center.x
    root.position.z -= center.z
    root.position.y -= box.min.y

    root.traverse((o: any) => {
      if (o.isMesh && o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals()
    })
    return { object: root, height: box.getSize(new THREE.Vector3()).y }
  }, [scene])
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#EDEAE2', 0.9]} />
      <directionalLight position={[4, 6, 4]} intensity={1.2} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} />
    </>
  )
}

// ── Escena de un thumbnail (desktop): cámara dirigida por scroll + columna ────

function ThumbScene({
  url, col, track,
}: {
  url: string
  col: number
  track: React.MutableRefObject<HTMLDivElement | null>
}) {
  const { object, height } = useNormalized(url)
  const targetY = height / 2
  const camRef = useRef<THREE.PerspectiveCamera>(null)

  useFrame(() => {
    const el = track.current
    const cam = camRef.current
    if (!el || !cam) return
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight || 1

    // Centro vertical de la tarjeta en el viewport: 0 = arriba, 1 = abajo.
    let cy = (r.top + r.height / 2) / vh
    cy = Math.max(0, Math.min(1, cy))

    // Abajo del viewport → cámara por encima (picado). Arriba → contrapicado.
    const elev = (cy - 0.5) * 2 * DESKTOP.MAX_ELEV
    // Columna izq. (col 0) se ve desde la derecha; der. (col 2) desde la izquierda.
    const az = (1 - col) * DESKTOP.MAX_AZIM

    const R = DESKTOP.DIST
    const cosE = Math.cos(elev)
    cam.position.set(R * cosE * Math.sin(az), targetY + R * Math.sin(elev), R * cosE * Math.cos(az))
    cam.lookAt(0, targetY, 0)
  })

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault fov={DESKTOP.FOV} />
      <Lights />
      <primitive object={object} />
    </>
  )
}

// ── Rejilla desktop: 3 columnas, un único Canvas compartido ───────────────────

function DesktopGrid({ modelos, onOpen }: { modelos: Modelo3D[]; onOpen: (m: Modelo3D) => void }) {
  const refs = useMemo(
    () => Array.from({ length: modelos.length }, () => ({ current: null as HTMLDivElement | null })),
    [modelos.length]
  )
  const [visible, setVisible] = useState<boolean[]>(() => modelos.map(() => false))

  // Monta el contenido 3D de cada tarjeta solo cuando se acerca al viewport.
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => {
        setVisible(prev => {
          let next = prev
          for (const e of entries) {
            if (!e.isIntersecting) continue
            const idx = Number((e.target as HTMLElement).dataset.idx)
            if (!next[idx]) { next = next === prev ? [...prev] : next; next[idx] = true }
          }
          return next
        })
      },
      { rootMargin: '300px' }
    )
    refs.forEach(r => r.current && io.observe(r.current))
    return () => io.disconnect()
  }, [refs])

  return (
    <>
      <div className="sr-grid-3">
        {modelos.map((m, i) => (
          <div key={m.id} className="sr-card" onClick={() => onOpen(m)}>
            <div className="sr-card-stage">
              <div
                className="sr-stage-view"
                data-idx={i}
                ref={el => { refs[i].current = el }}
              />
              <div className="sr-card-hint">Ver maqueta →</div>
            </div>
            <div style={{ padding: '16px 18px 18px' }}>
              {m.proyecto && (
                <p style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT, fontWeight: 600, marginBottom: 6 }}>
                  {m.proyecto}
                </p>
              )}
              <p style={{ fontSize: 15, fontWeight: 400, color: '#1A1A1A', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{m.nombre}</p>
              {m.descripcion && (
                <p style={{ fontSize: 12, color: '#1A1A1A70', fontWeight: 300, lineHeight: 1.5, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {m.descripcion}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Canvas único, fijo y transparente, sobre la rejilla. Cada View recorta su
          región siguiendo a la tarjeta (getBoundingClientRect cada frame). */}
      <Canvas
        shadows={false}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1 }}
      >
        {modelos.map((m, i) =>
          visible[i] ? (
            <View key={m.id} track={refs[i] as any}>
              <Suspense fallback={null}>
                <ThumbScene url={m.glb_url} col={i % 3} track={refs[i]} />
              </Suspense>
            </View>
          ) : null
        )}
      </Canvas>
    </>
  )
}

// ── Móvil: una maqueta a pantalla, swipe paginado (estilo Stories) ────────────

function StoryModel({ url }: { url: string }) {
  const { object } = useNormalized(url)
  return <primitive object={object} />
}

function StoriesStage({
  modelos, index, animRef, onSettle,
}: {
  modelos: Modelo3D[]
  index: number
  animRef: React.MutableRefObject<{ active: boolean; from: number; to: number; start: number }>
  onSettle: (to: number) => void
}) {
  const camRef = useRef<THREE.PerspectiveCamera>(null)
  const fromG = useRef<THREE.Group>(null)
  const toG = useRef<THREE.Group>(null)

  const anim = animRef.current
  const fromIdx = anim.active ? anim.from : index
  const toIdx = anim.active ? anim.to : null

  useFrame(() => {
    camRef.current?.lookAt(0, MOBILE.LOOK_Y, 0)
    const a = animRef.current
    if (!a.active) {
      if (fromG.current) fromG.current.position.set(0, 0, 0)
      return
    }
    const p = easeInOut(Math.min(1, (performance.now() - a.start) / MOBILE.DUR))
    const dir = a.to > a.from ? 1 : -1
    if (fromG.current) {
      // Saliente: se va por arriba (next) o por abajo (prev) y retrocede en Z.
      fromG.current.position.set(0, dir * p * MOBILE.UP, -p * MOBILE.BACK)
    }
    if (toG.current) {
      // Entrante: aparece desde el borde opuesto y frena en el encuadre fijo.
      toG.current.position.set(0, dir * (1 - p) * -MOBILE.DOWN, 0)
    }
    if (p >= 1) onSettle(a.to)
  })

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault fov={MOBILE.FOV} position={[0, MOBILE.CAM_Y, MOBILE.CAM_Z]} />
      <Lights />
      <group ref={fromG}>
        <Suspense fallback={null}>
          <StoryModel url={modelos[fromIdx].glb_url} />
        </Suspense>
      </group>
      {toIdx != null && (
        <group ref={toG}>
          <Suspense fallback={null}>
            <StoryModel url={modelos[toIdx].glb_url} />
          </Suspense>
        </group>
      )}
    </>
  )
}

function MobileStories({ modelos, onOpen }: { modelos: Modelo3D[]; onOpen: (m: Modelo3D) => void }) {
  const [index, setIndex] = useState(0)
  const animRef = useRef({ active: false, from: 0, to: 0, start: 0 })
  const touchY = useRef(0)

  function go(dir: number) {
    if (animRef.current.active) return
    const to = index + dir
    if (to < 0 || to >= modelos.length) return
    animRef.current = { active: true, from: index, to, start: performance.now() }
  }

  function onSettle(to: number) {
    animRef.current.active = false
    setIndex(to)
  }

  const m = modelos[index]

  return (
    <div
      className="sr-stories"
      onTouchStart={e => { touchY.current = e.touches[0].clientY }}
      onTouchEnd={e => {
        const dy = touchY.current - e.changedTouches[0].clientY
        if (dy > 45) go(1)
        else if (dy < -45) go(-1)
      }}
      onWheel={e => { if (Math.abs(e.deltaY) > 12) go(e.deltaY > 0 ? 1 : -1) }}
    >
      <Canvas
        shadows={false}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
      >
        <StoriesStage modelos={modelos} index={index} animRef={animRef} onSettle={onSettle} />
      </Canvas>

      {/* Indicador de progreso */}
      <div className="sr-dots">
        {modelos.map((mm, i) => (
          <span key={mm.id} className={`sr-dot ${i === index ? 'is-on' : ''}`} />
        ))}
      </div>

      {/* Info + abrir */}
      <div className="sr-story-info">
        {m.proyecto && (
          <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 600 }}>{m.proyecto}</span>
        )}
        <div style={{ fontSize: 19, fontWeight: 400, color: '#1A1A1A', letterSpacing: '-0.01em', marginTop: 3 }}>{m.nombre}</div>
        <button className="sr-story-open" onClick={() => onOpen(m)}>Ver en detalle →</button>
      </div>

      <div className="sr-story-hint">Desliza ↑</div>
    </div>
  )
}

// ── Selector responsive ───────────────────────────────────────────────────────

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)')
    const on = () => setMobile(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

export default function ScrollGallery({ modelos, onOpen }: { modelos: Modelo3D[]; onOpen: (m: Modelo3D) => void }) {
  const isMobile = useIsMobile()
  return (
    <>
      <style>{styles}</style>
      {isMobile ? <MobileStories modelos={modelos} onOpen={onOpen} /> : <DesktopGrid modelos={modelos} onOpen={onOpen} />}
    </>
  )
}

const styles = `
.sr-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
@media (max-width: 980px) { .sr-grid-3 { grid-template-columns: repeat(2, 1fr); } }

.sr-card-stage { position: relative; }
.sr-stage-view { position: absolute; inset: 0; }
.sr-card-hint { z-index: 2; }

.sr-stories {
  position: relative; width: 100%; height: calc(100vh - 220px); min-height: 460px;
  border-radius: 14px; overflow: hidden;
  background: radial-gradient(120% 100% at 50% 12%, #FFFFFF 0%, #F1EFE8 100%);
  border: 1px solid #ECEAE3; touch-action: none; user-select: none;
}
.sr-dots { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; }
.sr-dot { width: 6px; height: 6px; border-radius: 50%; background: #1A1A1A25; transition: all .3s ease; }
.sr-dot.is-on { background: ${ACCENT}; width: 18px; border-radius: 4px; }
.sr-story-info { position: absolute; left: 24px; bottom: 26px; max-width: 80%; }
.sr-story-open {
  margin-top: 12px; background: #1A1A1A; color: #fff; border: none; border-radius: 100px;
  padding: 9px 18px; font-size: 12px; cursor: pointer; font-family: inherit;
}
.sr-story-hint {
  position: absolute; right: 22px; bottom: 30px; font-size: 10px; letter-spacing: .14em;
  text-transform: uppercase; color: #1A1A1A55; animation: sr-bob 1.8s ease-in-out infinite;
}
@keyframes sr-bob { 0%,100% { transform: translateY(0); opacity: .55; } 50% { transform: translateY(-5px); opacity: 1; } }
`
