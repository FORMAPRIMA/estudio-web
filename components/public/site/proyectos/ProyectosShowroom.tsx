'use client'

// Grid de maquetas 3D de la página de Proyectos. Portado del Showroom 3D interno
// (components/team/showroom-3d/ScrollGallery.tsx): misma lógica de scroll/wheel/
// touch, transición entre páginas, cámara picada y sombras de contacto falsas.
// Adaptado al sitio público: sin subir/marca/controles (de eso va el nav), y al
// hacer clic en una maqueta se navega a la página del proyecto.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Environment, Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { DEFAULT_PRESET } from '@/lib/showroom'
import { site } from '../theme'
import { href } from '../SiteProvider'

export interface MaquetaItem {
  slug: string
  nombre: string
  eyebrow: string | null
  glb_url: string
}

const ACCENT = site.color.accent
const TARGET = 2

const FRAME = { FOV: 34, DIST: 9.0, SEP: 2.6, PITCH: 22, LOOK_Y: 1.55, VSCALE: 1.6 }
const RENDER_FOV = (2 * Math.atan(FRAME.VSCALE * Math.tan((FRAME.FOV * Math.PI) / 180 / 2)) * 180) / Math.PI
const TRANS = { DUR: 920, EXIT_UP: 5.5, EXIT_BACK: 1.1, ENTER_FROM: 5.5 }
const preset = DEFAULT_PRESET

const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

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
        o.receiveShadow = false
        if (o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals()
      }
    })
    return { object: root }
  }, [scene])
}

function Maqueta({ url }: { url: string }) {
  const { object } = useNormalized(url)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => { invalidate() }, [object, invalidate])
  return <primitive object={object} />
}

function SlotLoader() {
  return <Html center><div className="sr-slot-loader" /></Html>
}

let _shadowTex: THREE.CanvasTexture | null = null
function shadowTexture() {
  if (_shadowTex) return _shadowTex
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.85)')
  g.addColorStop(0.45, 'rgba(0,0,0,0.45)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  _shadowTex = new THREE.CanvasTexture(c)
  return _shadowTex
}

function ShadowBlob({ opacity, matRef, size }: { opacity: number; matRef: (m: THREE.Material | null) => void; size: [number, number] }) {
  const tex = useMemo(() => shadowTexture(), [])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial ref={matRef} map={tex} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

type Trans = { fromStart: number; toStart: number; toPage: number; dir: number; start: number } | null

function slotScreenX(slotCount: number, w: number, h: number) {
  const center = (slotCount - 1) / 2
  const halfH = FRAME.DIST * Math.tan((FRAME.FOV * Math.PI) / 180 / 2)
  const halfW = halfH * (h > 0 ? w / h : 1.6)
  return Array.from({ length: slotCount }, (_, i) => {
    const ndc = ((i - center) * FRAME.SEP) / (halfW || 1)
    return ((ndc + 1) / 2) * 100
  })
}

function Scene({
  modelos, currentStart, slotCount, trans, onSettle, isMobile,
}: {
  modelos: MaquetaItem[]; currentStart: number; slotCount: number; trans: Trans; onSettle: () => void; isMobile: boolean
}) {
  const camRef = useRef<THREE.PerspectiveCamera>(null)
  const outRefs = useRef<(THREE.Group | null)[]>([])
  const inRefs = useRef<(THREE.Group | null)[]>([])
  const outMats = useRef<(THREE.Material | null)[]>([])
  const inMats = useRef<(THREE.Material | null)[]>([])
  const center = (slotCount - 1) / 2
  const xOf = (i: number) => (i - center) * FRAME.SEP
  const fromStart = trans ? trans.fromStart : currentStart

  const pitch = (FRAME.PITCH * Math.PI) / 180
  const camPos: [number, number, number] = [0, FRAME.LOOK_Y + FRAME.DIST * Math.sin(pitch), FRAME.DIST * Math.cos(pitch)]
  const blobSize: [number, number] = isMobile ? [4.6, 3.4] : [2.7, 2.4]
  const FADE = 1.8
  const fade = (y: number) => clamp01(1 - Math.abs(y) / FADE)

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
    for (let i = 0; i < slotCount; i++) {
      const oy = dir * p * TRANS.EXIT_UP
      outRefs.current[i]?.position.set(xOf(i), oy, -p * TRANS.EXIT_BACK)
      if (outMats.current[i]) outMats.current[i]!.opacity = base * fade(oy)
      const iy = -dir * (1 - p) * TRANS.ENTER_FROM
      inRefs.current[i]?.position.set(xOf(i), iy, 0)
      if (inMats.current[i]) inMats.current[i]!.opacity = base * fade(iy)
    }
    if (p >= 1) onSettle()
  })

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault fov={RENDER_FOV} position={camPos} />
      <hemisphereLight args={['#ffffff', '#EDEAE2', 0.55]} />
      <directionalLight position={[2.5, 6.5, -4]} intensity={1.0} />
      <directionalLight position={[5, 6, 4]} intensity={0.35} />
      <Environment files={preset.environmentImage} environmentIntensity={preset.envIntensity} />

      {Array.from({ length: slotCount }, (_, i) => {
        const proj = modelos[fromStart + i]
        return proj ? (
          <group key={`o${i}`} ref={(el) => { outRefs.current[i] = el }} position={[xOf(i), 0, 0]}>
            <Suspense fallback={<SlotLoader />}>
              <Maqueta url={proj.glb_url} />
              <ShadowBlob opacity={preset.shadowOpacity} matRef={(m) => { outMats.current[i] = m }} size={blobSize} />
            </Suspense>
          </group>
        ) : null
      })}
      {trans && Array.from({ length: slotCount }, (_, i) => {
        const proj = modelos[trans.toStart + i]
        return proj ? (
          <group key={`i${i}`} ref={(el) => { inRefs.current[i] = el }} position={[xOf(i), -trans.dir * TRANS.ENTER_FROM, 0]}>
            <Suspense fallback={<SlotLoader />}>
              <Maqueta url={proj.glb_url} />
              <ShadowBlob opacity={preset.shadowOpacity} matRef={(m) => { inMats.current[i] = m }} size={blobSize} />
            </Suspense>
          </group>
        ) : null
      })}
    </>
  )
}

function Caption({ proj, variant }: { proj?: MaquetaItem; variant: 'steady' | 'in' | 'out' }) {
  if (!proj) return null
  return (
    <div className={`sr-cap sr-cap-${variant}`}>
      {proj.eyebrow && <span className="sr-cap-eyebrow">{proj.eyebrow}</span>}
      <span className="sr-cap-title">{proj.nombre}</span>
    </div>
  )
}

function useVisibleCount() {
  const [n, setN] = useState(3)
  useEffect(() => {
    const calc = () => { const w = window.innerWidth; setN(w < 760 ? 1 : w < 1024 ? 2 : 3) }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])
  return n
}

export default function ProyectosShowroom({ modelos }: { modelos: MaquetaItem[] }) {
  const router = useRouter()
  const N = modelos.length
  const visible = useVisibleCount()
  const isMobile = visible === 1
  const slotCount = Math.min(visible, N)
  const maxStart = Math.max(0, N - slotCount)
  const pageCount = Math.max(1, Math.ceil(N / slotCount))
  const startForPage = (p: number) => Math.min(p * slotCount, maxStart)

  const [page, setPage] = useState(0)
  const [trans, setTrans] = useState<Trans>(null)
  const [slotX, setSlotX] = useState<number[]>(() => Array.from({ length: slotCount }, (_, i) => ((i + 0.5) / slotCount) * 100))
  const busy = useRef(false)
  const touchY = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const recalc = () => { const r = el.getBoundingClientRect(); if (r.width) setSlotX(slotScreenX(slotCount, r.width, r.height)) }
    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [slotCount])

  useEffect(() => { setPage((p) => Math.min(p, pageCount - 1)) }, [pageCount])

  const currentStart = startForPage(page)

  useEffect(() => {
    const t = setTimeout(() => {
      const warm = (p: number) => {
        if (p < 0 || p >= pageCount) return
        const s = startForPage(p)
        for (let i = 0; i < slotCount; i++) {
          const u = modelos[s + i]?.glb_url
          if (u) useGLTF.preload(u, '/draco/')
        }
      }
      warm(page + 1); warm(page - 1)
    }, 1500)
    return () => clearTimeout(t)
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
    setPage(trans.toPage); setTrans(null); busy.current = false
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') navigate(1)
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') navigate(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const open = (m: MaquetaItem) => router.push(href(`/proyectos/${m.slug}`))
  const widthPct = 100 / slotCount

  return (
    <div
      ref={stageRef}
      className="sr-stage"
      style={{ fontFamily: site.font }}
      onWheel={(e) => { if (Math.abs(e.deltaY) > 8) navigate(e.deltaY > 0 ? 1 : -1) }}
      onTouchStart={(e) => { touchY.current = e.touches[0].clientY }}
      onTouchEnd={(e) => {
        const dy = touchY.current - e.changedTouches[0].clientY
        if (dy > 45) navigate(1); else if (dy < -45) navigate(-1)
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {!trans && Array.from({ length: slotCount }, (_, i) => {
        const cur = modelos[currentStart + i]
        if (!cur) return null
        return (
          <div key={`hit${i}`} className="sr-hit" data-cursor={cur.eyebrow ? 'Ver proyecto' : 'Ver'}
            style={{ left: `${slotX[i] ?? ((i + 0.5) / slotCount) * 100}%`, width: `${widthPct}%` }}
            onClick={() => open(cur)} />
        )
      })}

      <Canvas
        shadows={false}
        frameloop={trans ? 'always' : 'demand'}
        dpr={isMobile ? [1, 1.4] : [1, 1.85]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: preset.exposure }}
        style={{ position: 'absolute', left: 0, width: '100%', height: `${FRAME.VSCALE * 100}%`, top: `${-((FRAME.VSCALE - 1) / 2) * 100}%`, pointerEvents: 'none', zIndex: 1 }}
      >
        <Scene modelos={modelos} currentStart={currentStart} slotCount={slotCount} trans={trans} onSettle={onSettle} isMobile={isMobile} />
      </Canvas>

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
  background: radial-gradient(120% 100% at 50% 0%, #FFFFFF 0%, #FFFFFF 55%, #F4F5F6 100%);
}
.sr-stage::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 2;
  box-shadow: inset 0 0 240px 40px rgba(26,26,26,0.035);
}
.sr-hit { position: absolute; top: 0; bottom: 0; transform: translateX(-50%); z-index: 4; cursor: pointer; }
.sr-slot-loader { width: 28px; height: 28px; border-radius: 50%; border: 2px solid rgba(26,26,26,.12); border-top-color: ${ACCENT}; animation: sr-spin .8s linear infinite; }
@keyframes sr-spin { to { transform: rotate(360deg); } }
.sr-cap-wrap { position: absolute; top: 15%; transform: translateX(-50%); display: flex; justify-content: center; pointer-events: none; z-index: 3; }
.sr-cap { position: absolute; text-align: center; white-space: nowrap; display: flex; flex-direction: column; align-items: center; gap: 7px; }
.sr-cap-eyebrow { font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: ${ACCENT}; font-weight: 600; }
.sr-cap-title { font-size: 21px; font-weight: 300; color: #1A1A1A; letter-spacing: -0.02em; line-height: 1.15; }
@media (max-width: 760px) { .sr-cap-title { font-size: 26px; } }
.sr-cap-steady { opacity: 1; }
.sr-cap-in  { animation: sr-cap-in 880ms cubic-bezier(.2,.7,.2,1) both; }
.sr-cap-out { animation: sr-cap-out 880ms cubic-bezier(.4,0,.2,1) both; }
@keyframes sr-cap-in  { 0%,40% { opacity: 0; transform: translateY(14px); } 100% { opacity: 1; transform: none; } }
@keyframes sr-cap-out { 0% { opacity: 1; } 60%,100% { opacity: 0; transform: translateY(-10px); } }
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
