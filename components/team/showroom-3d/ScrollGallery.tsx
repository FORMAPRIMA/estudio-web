'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera, Environment, SoftShadows, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { LIGHTING_PRESETS, DEFAULT_PRESET } from '@/lib/showroom'
import type { LightingPreset, Modelo3D } from '@/lib/showroom'

const ACCENT = '#D85A30'
const TARGET = 2 // lado mayor del modelo normalizado (uds de mundo)

// ── Calibración (afinar viendo en vivo) ──────────────────────────────────────
// Una sola cámara frontal al centro mira las maquetas puestas en fila (mismo
// plano). La del centro se ve frontal; las laterales, "un poco de lado" por estar
// desplazadas respecto a ese único punto de vista (perspectiva, no giro).
const FRAME = {
  FOV: 34,          // FOV de la VENTANA VISIBLE (no del canvas completo)
  DIST: 9.0,        // distancia de la cámara (lejana → no recorta)
  SEP: 2.6,         // separación entre maquetas (controla cuánto "de lado" se ven las laterales)
  PITCH: 22,        // grados que la cámara mira hacia abajo → ES el escorzo (la maqueta queda PLANA;
                    //   el efecto inclinado viene del punto de vista, no del objeto)
  LOOK_Y: 1.55,     // altura a la que mira; más alto → la maqueta reposa más abajo (tercio inferior)
  VSCALE: 1.6,      // canvas más alto que la ventana → maquetas entran/salen fuera de cuadro (sin verse el corte)
}
// FOV del canvas completo (más alto): mantiene idéntico lo visible, solo añade margen arriba/abajo.
const RENDER_FOV = (2 * Math.atan(FRAME.VSCALE * Math.tan((FRAME.FOV * Math.PI) / 180 / 2)) * 180) / Math.PI

const TRANS = {
  DUR: 920,         // ms de la transición entre páginas
  EXIT_UP: 5.5,     // cuánto sube la saliente hasta perderse (fuera de cuadro)
  EXIT_BACK: 1.1,   // cuánto retrocede en Z al salir
  ENTER_FROM: 5.5,  // desde dónde entra la siguiente
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// Normaliza: lado mayor = TARGET, base en y=0, centrada en XZ.
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
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = false // el modelo no se auto-sombrea (evita el doble sobre sí mismo)
        if (o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals()
      }
    })
    return { object: root, height: box.getSize(new THREE.Vector3()).y }
  }, [scene])
}

// Maqueta PLANA, apoyada en y=0 (el efecto inclinado lo da el picado de la cámara).
function Maqueta({ url }: { url: string }) {
  const { object } = useNormalized(url)
  return <primitive object={object} />
}

// Suelo horizontal (como en el visor) a ras de la base, que SOLO recibe la sombra.
// La opacidad se controla por frame (Scene) según la distancia al reposo → el plano
// está transparente mientras su maqueta entra/sale, así no recibe la mancha de la otra.
function ShadowFloor({ opacity, matRef, size }: { opacity: number; matRef: (m: THREE.ShadowMaterial | null) => void; size: [number, number] }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <shadowMaterial ref={matRef} transparent opacity={opacity} color="#000000" />
    </mesh>
  )
}

type Trans = { fromStart: number; toStart: number; toPage: number; dir: number; start: number } | null

// Posición X en pantalla (%) de cada maqueta, según la proyección de la cámara.
function slotScreenX(slotCount: number, w: number, h: number) {
  const center = (slotCount - 1) / 2
  const halfH = FRAME.DIST * Math.tan((FRAME.FOV * Math.PI) / 180 / 2)
  const halfW = halfH * (h > 0 ? w / h : 1.6)
  return Array.from({ length: slotCount }, (_, i) => {
    const ndc = ((i - center) * FRAME.SEP) / (halfW || 1)
    return ((ndc + 1) / 2) * 100
  })
}

// ── Escena única: una cámara, las maquetas en fila ────────────────────────────

function Scene({
  modelos, currentStart, slotCount, trans, preset, onSettle, isMobile,
}: {
  modelos: Modelo3D[]
  currentStart: number
  slotCount: number
  trans: Trans
  preset: LightingPreset
  onSettle: () => void
  isMobile: boolean
}) {
  const camRef = useRef<THREE.PerspectiveCamera>(null)
  const outRefs = useRef<(THREE.Group | null)[]>([])
  const inRefs = useRef<(THREE.Group | null)[]>([])
  const outMats = useRef<(THREE.ShadowMaterial | null)[]>([])
  const inMats = useRef<(THREE.ShadowMaterial | null)[]>([])
  const center = (slotCount - 1) / 2
  const xOf = (i: number) => (i - center) * FRAME.SEP

  const fromStart = trans ? trans.fromStart : currentStart

  // Cámara con picado: por encima de LOOK_Y y mirando hacia abajo.
  const pitch = (FRAME.PITCH * Math.PI) / 180
  const camPos: [number, number, number] = [0, FRAME.LOOK_Y + FRAME.DIST * Math.sin(pitch), FRAME.DIST * Math.cos(pitch)]

  // En móvil no hay maquetas vecinas → plano grande (sombra completa, sin recorte).
  // En desktop, estrecho para no invadir el plano de las vecinas.
  const floorSize: [number, number] = isMobile ? [16, 16] : [2.6, 6]

  useFrame(() => {
    camRef.current?.lookAt(0, FRAME.LOOK_Y, 0)
    const base = preset.shadowOpacity
    if (!trans) {
      for (let i = 0; i < slotCount; i++) {
        outRefs.current[i]?.position.set(xOf(i), 0, 0)
        if (outMats.current[i]) outMats.current[i]!.opacity = base
      }
      return
    }
    const p = easeInOut(clamp01((performance.now() - trans.start) / TRANS.DUR))
    const dir = trans.dir
    // Sombra APAGADA durante el vuelo: se desvanece rápido al despegar (primer ~22%)
    // y solo reaparece al aterrizar (último ~22%). En el grueso del scroll = 0 sombra,
    // así NO puede aparecer la banda/mancha de contaminación entre planos.
    const outOp = base * clamp01(1 - p / 0.22)
    const inOp = base * clamp01((p - 0.78) / 0.22)
    for (let i = 0; i < slotCount; i++) {
      outRefs.current[i]?.position.set(xOf(i), dir * p * TRANS.EXIT_UP, -p * TRANS.EXIT_BACK)
      if (outMats.current[i]) outMats.current[i]!.opacity = outOp
      inRefs.current[i]?.position.set(xOf(i), -dir * (1 - p) * TRANS.ENTER_FROM, 0)
      if (inMats.current[i]) inMats.current[i]!.opacity = inOp
    }
    if (p >= 1) onSettle()
  })

  const shadowSize = isMobile ? 1024 : 2048

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault fov={RENDER_FOV} position={camPos} />

      {/* Penumbra suave (PCSS) — menos samples en móvil para más FPS */}
      <SoftShadows size={70} samples={isMobile ? 16 : 26} focus={0} />
      <hemisphereLight args={['#ffffff', '#EDEAE2', 0.5]} />
      {/* Luz clave desde arriba-derecha-atrás → sombra suave en diagonal abajo-izquierda */}
      <directionalLight
        castShadow
        position={[2.5, 6.5, -4]}
        intensity={1.1}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
      >
        <orthographicCamera attach="shadow-camera" args={[-5, 5, 5, -5, 0.1, 40]} />
      </directionalLight>
      <directionalLight position={[5, 6, 4]} intensity={0.3} />
      <Environment files={preset.environmentImage} environmentIntensity={preset.envIntensity} />

      {/* Cada maqueta lleva su sombra dentro de su grupo → se desplaza con ella. */}
      {Array.from({ length: slotCount }, (_, i) => {
        const proj = modelos[fromStart + i]
        return proj ? (
          <group key={`o${i}`} ref={el => { outRefs.current[i] = el }} position={[xOf(i), 0, 0]}>
            <Suspense fallback={null}><Maqueta url={proj.glb_url} /></Suspense>
            <ShadowFloor opacity={preset.shadowOpacity} matRef={m => { outMats.current[i] = m }} size={floorSize} />
          </group>
        ) : null
      })}
      {trans && Array.from({ length: slotCount }, (_, i) => {
        const proj = modelos[trans.toStart + i]
        return proj ? (
          <group key={`i${i}`} ref={el => { inRefs.current[i] = el }} position={[xOf(i), -trans.dir * TRANS.ENTER_FROM, 0]}>
            <Suspense fallback={null}><Maqueta url={proj.glb_url} /></Suspense>
            <ShadowFloor opacity={preset.shadowOpacity} matRef={m => { inMats.current[i] = m }} size={floorSize} />
          </group>
        ) : null
      })}
    </>
  )
}

// ── Tipografía flotante (crossfade en transición) ─────────────────────────────

function Caption({ proj, variant }: { proj?: Modelo3D; variant: 'steady' | 'in' | 'out' }) {
  if (!proj) return null
  return (
    <div className={`sr-cap sr-cap-${variant}`}>
      {proj.proyecto && <span className="sr-cap-eyebrow">{proj.proyecto}</span>}
      <span className="sr-cap-title">{proj.nombre}</span>
    </div>
  )
}

function useVisibleCount() {
  const [n, setN] = useState(3)
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      setN(w < 760 ? 1 : w < 1024 ? 2 : 3)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])
  return n
}

export default function ScrollGallery({
  modelos, onOpen, onUpload, paused = false,
}: {
  modelos: Modelo3D[]
  onOpen: (m: Modelo3D) => void
  onUpload: () => void
  paused?: boolean
}) {
  const N = modelos.length
  const visible = useVisibleCount()
  const isMobile = visible === 1
  const slotCount = Math.min(visible, N)
  const maxStart = Math.max(0, N - slotCount)
  const pageCount = Math.max(1, Math.ceil(N / slotCount))
  const startForPage = (p: number) => Math.min(p * slotCount, maxStart)

  const [page, setPage] = useState(0)
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id)
  const [trans, setTrans] = useState<Trans>(null)
  const [slotX, setSlotX] = useState<number[]>(() => Array.from({ length: slotCount }, (_, i) => ((i + 0.5) / slotCount) * 100))
  const busy = useRef(false)
  const touchY = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)

  const preset = LIGHTING_PRESETS.find(p => p.id === presetId) ?? DEFAULT_PRESET

  // Posiciones X de las maquetas en pantalla (para textos y zonas de clic).
  // ResizeObserver: realinea ante cualquier cambio de tamaño (incl. al volver del visor).
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const recalc = () => {
      const r = el.getBoundingClientRect()
      if (r.width) setSlotX(slotScreenX(slotCount, r.width, r.height))
    }
    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [slotCount])

  useEffect(() => { setPage(p => Math.min(p, pageCount - 1)) }, [pageCount])

  const currentStart = startForPage(page)

  // Precarga (en segundo plano) los GLB de las páginas vecinas → al hacer scroll
  // la maqueta ya está en caché y no se traba. useGLTF cachea por URL.
  useEffect(() => {
    const warm = (p: number) => {
      if (p < 0 || p >= pageCount) return
      const s = startForPage(p)
      for (let i = 0; i < slotCount; i++) {
        const u = modelos[s + i]?.glb_url
        if (u) useGLTF.preload(u, '/draco/')
      }
    }
    warm(page + 1)
    warm(page - 1)
  }, [page, slotCount, pageCount, modelos])

  function navigate(dir: number) {
    if (busy.current || trans) return
    const to = page + dir
    if (to < 0 || to >= pageCount) return
    busy.current = true
    setTrans({ fromStart: currentStart, toStart: startForPage(to), toPage: to, dir, start: performance.now() })
  }

  function onSettle() {
    if (!trans) return
    setPage(trans.toPage)
    setTrans(null)
    busy.current = false
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') navigate(1)
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') navigate(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const widthPct = 100 / slotCount

  return (
    <div
      ref={stageRef}
      className="sr-stage"
      onWheel={e => { if (Math.abs(e.deltaY) > 8) navigate(e.deltaY > 0 ? 1 : -1) }}
      onTouchStart={e => { touchY.current = e.touches[0].clientY }}
      onTouchEnd={e => {
        const dy = touchY.current - e.changedTouches[0].clientY
        if (dy > 45) navigate(1)
        else if (dy < -45) navigate(-1)
      }}
    >
      <style>{styles}</style>

      {/* Zonas de clic, centradas en cada maqueta */}
      {!trans && Array.from({ length: slotCount }, (_, i) => {
        const cur = modelos[currentStart + i]
        if (!cur) return null
        return (
          <div
            key={`hit${i}`}
            className="sr-hit"
            style={{ left: `${slotX[i] ?? ((i + 0.5) / slotCount) * 100}%`, width: `${widthPct}%` }}
            onClick={() => onOpen(cur)}
          />
        )
      })}

      {/* Canvas único, transparente */}
      <Canvas
        shadows
        frameloop={paused ? 'never' : trans ? 'always' : 'demand'}
        dpr={isMobile ? [1, 1.4] : [1, 1.85]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: preset.exposure }}
        style={{
          position: 'absolute', left: 0, width: '100%',
          height: `${FRAME.VSCALE * 100}%`, top: `${-((FRAME.VSCALE - 1) / 2) * 100}%`,
          pointerEvents: 'none', zIndex: 1,
        }}
      >
        <Scene modelos={modelos} currentStart={currentStart} slotCount={slotCount} trans={trans} preset={preset} onSettle={onSettle} isMobile={isMobile} />
      </Canvas>

      {/* Tipografía flotante, sobre cada maqueta */}
      {Array.from({ length: slotCount }, (_, i) => (
        <div key={`cap${i}`} className="sr-cap-wrap" style={{ left: `${slotX[i] ?? ((i + 0.5) / slotCount) * 100}%` }}>
          {trans ? (
            <>
              <Caption proj={modelos[trans.fromStart + i]} variant="out" />
              <Caption proj={modelos[trans.toStart + i]} variant="in" />
            </>
          ) : (
            <Caption proj={modelos[currentStart + i]} variant="steady" />
          )}
        </div>
      ))}

      {/* Controles flotantes — arriba */}
      <div className="sr-top">
        <div className="sr-brand">
          <span className="sr-brand-eyebrow">Forma Prima</span>
          <span className="sr-brand-title">Proyectos</span>
        </div>
        <div className="sr-top-right">
          <div className="sr-seg">
            {LIGHTING_PRESETS.map(p => (
              <button key={p.id} onClick={() => setPresetId(p.id)} className={`sr-seg-btn ${p.id === presetId ? 'is-active' : ''}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={onUpload} className="sr-upload">+ Subir</button>
        </div>
      </div>

      {/* Indicador de navegación — abajo */}
      {pageCount > 1 && (
        <div className="sr-nav">
          <button className="sr-nav-arrow" disabled={page === 0} onClick={() => navigate(-1)} aria-label="Anterior">↑</button>
          <div className="sr-nav-count">
            <span className="sr-nav-cur">{String(page + 1).padStart(2, '0')}</span>
            <span className="sr-nav-sep">/</span>
            <span>{String(pageCount).padStart(2, '0')}</span>
          </div>
          <button className="sr-nav-arrow" disabled={page === pageCount - 1} onClick={() => navigate(1)} aria-label="Siguiente">↓</button>
        </div>
      )}
      <div className="sr-explore-hint">Desliza para explorar</div>
    </div>
  )
}

const styles = `
.sr-stage {
  position: relative; width: 100%; height: 100vh; overflow: hidden; user-select: none;
  touch-action: none; overscroll-behavior: none;
  background: radial-gradient(90% 70% at 50% 6%, #FFFFFF 0%, #F6F4EF 46%, #ECE9E1 100%);
}
@media (max-width: 1023px) { .sr-stage { height: calc(100dvh - 56px); } }
.sr-stage::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 2;
  box-shadow: inset 0 0 220px 30px rgba(26,26,26,0.07);
}

.sr-hit { position: absolute; top: 0; bottom: 0; transform: translateX(-50%); z-index: 4; cursor: pointer; }

.sr-cap-wrap { position: absolute; top: 13%; transform: translateX(-50%); display: flex; justify-content: center; pointer-events: none; z-index: 3; }
.sr-cap { position: absolute; text-align: center; white-space: nowrap; display: flex; flex-direction: column; align-items: center; gap: 7px; }
.sr-cap-eyebrow { font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: ${ACCENT}; font-weight: 600; }
.sr-cap-title { font-size: 21px; font-weight: 300; color: #1A1A1A; letter-spacing: -0.02em; line-height: 1.15; }
@media (max-width: 760px) { .sr-cap-title { font-size: 26px; } }
.sr-cap-steady { opacity: 1; }
.sr-cap-in  { animation: sr-cap-in 880ms cubic-bezier(.2,.7,.2,1) both; }
.sr-cap-out { animation: sr-cap-out 880ms cubic-bezier(.4,0,.2,1) both; }
@keyframes sr-cap-in  { 0%,40% { opacity: 0; transform: translateY(14px); } 100% { opacity: 1; transform: none; } }
@keyframes sr-cap-out { 0% { opacity: 1; } 60%,100% { opacity: 0; transform: translateY(-10px); } }

.sr-top { position: absolute; top: 0; left: 0; right: 0; z-index: 5; display: flex; justify-content: space-between; align-items: flex-start; padding: 24px 30px; pointer-events: none; }
.sr-top > * { pointer-events: auto; }
.sr-brand { display: flex; flex-direction: column; gap: 3px; }
.sr-brand-eyebrow { font-size: 9.5px; letter-spacing: 0.22em; text-transform: uppercase; color: #1A1A1A70; font-weight: 600; }
.sr-brand-title { font-size: 16px; font-weight: 400; color: #1A1A1A; letter-spacing: -0.01em; }
.sr-top-right { display: flex; align-items: center; gap: 10px; }

.sr-seg { display: flex; gap: 2px; padding: 5px; border-radius: 100px; background: rgba(255,255,255,.6); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.8); box-shadow: 0 10px 30px -16px rgba(26,26,26,.5); }
.sr-seg-btn { border: none; background: transparent; color: #1A1A1A80; font-size: 11.5px; padding: 7px 14px; border-radius: 100px; cursor: pointer; transition: all .2s ease; white-space: nowrap; font-family: inherit; }
.sr-seg-btn:hover { color: #1A1A1A; }
.sr-seg-btn.is-active { background: #1A1A1A; color: #fff; }
.sr-upload { background: ${ACCENT}; color: #fff; border: none; border-radius: 100px; padding: 10px 18px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; box-shadow: 0 10px 26px -12px ${ACCENT}; transition: filter .2s, transform .2s; }
.sr-upload:hover { filter: brightness(1.06); transform: translateY(-1px); }

.sr-nav { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 5; display: flex; align-items: center; gap: 16px; padding: 8px 10px; border-radius: 100px; background: rgba(255,255,255,.6); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.8); box-shadow: 0 14px 36px -18px rgba(26,26,26,.5); }
.sr-nav-arrow { width: 34px; height: 34px; border-radius: 50%; border: none; background: transparent; color: #1A1A1A; font-size: 15px; cursor: pointer; transition: all .2s; line-height: 1; }
.sr-nav-arrow:hover:not(:disabled) { background: #1A1A1A; color: #fff; }
.sr-nav-arrow:disabled { opacity: .25; cursor: default; }
.sr-nav-count { font-size: 12px; letter-spacing: .1em; color: #1A1A1A80; font-variant-numeric: tabular-nums; }
.sr-nav-cur { color: #1A1A1A; font-weight: 600; }
.sr-nav-sep { margin: 0 5px; color: #1A1A1A40; }

.sr-explore-hint { position: absolute; bottom: 34px; right: 30px; z-index: 5; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #1A1A1A45; animation: sr-bob 2s ease-in-out infinite; }
@media (max-width: 760px) { .sr-explore-hint { display: none; } }
@keyframes sr-bob { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
`
