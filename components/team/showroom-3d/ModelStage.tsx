'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls, Environment, ContactShadows, PerspectiveCamera, useGLTF, Html,
} from '@react-three/drei'
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { LIGHTING_PRESETS, DEFAULT_PRESET } from '@/lib/showroom'
import type { LightingPreset } from '@/lib/showroom'

// El lado mayor de la maqueta se normaliza a este tamaño (unidades de mundo).
// Así la cámara, las sombras y el radio de AO funcionan igual con cualquier modelo.
const TARGET = 2

function useNormalizedModel(url: string) {
  const { scene } = useGLTF(url, '/draco/')
  return useMemo(() => {
    const root = scene.clone(true)

    // Escalar para que el lado mayor mida TARGET
    let box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    root.scale.setScalar(TARGET / maxDim)

    // Recentrar en XZ y apoyar la base en y=0
    box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    root.position.x -= center.x
    root.position.z -= center.z
    root.position.y -= box.min.y

    const finalSize = box.getSize(new THREE.Vector3())

    root.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        if (o.material) {
          o.material.envMapIntensity = 1
          if (o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals()
        }
      }
    })

    return { object: root, height: finalSize.y }
  }, [scene])
}

function Scene({
  url, preset, autoRotate, controlsRef,
}: {
  url: string
  preset: LightingPreset
  autoRotate: boolean
  controlsRef: React.MutableRefObject<any>
}) {
  const { object, height } = useNormalizedModel(url)
  const targetY = height / 2

  return (
    <>
      <PerspectiveCamera makeDefault fov={34} position={[2.6, targetY + 1.7, 3.1]} />

      <primitive object={object} />

      {/* Luz de definición sutil; el grueso lo aporta el HDRI */}
      <directionalLight position={[4, 7, 4]} intensity={0.45} />

      <Environment files={preset.environmentImage} environmentIntensity={preset.envIntensity} />

      <ContactShadows
        position={[0, 0.001, 0]}
        scale={TARGET * 2.2}
        far={Math.max(height * 1.1, 1.5)}
        blur={2.7}
        opacity={preset.shadowOpacity}
        resolution={1024}
        color="#1A1A1A"
        frames={autoRotate ? Infinity : 1}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={0.7}
        minDistance={1.6}
        maxDistance={14}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 1.92}
        target={[0, targetY, 0]}
      />
    </>
  )
}

function Loader() {
  return (
    <Html center>
      <div className="sr-progress">
        <div className="sr-progress-track"><div className="sr-progress-bar" /></div>
        <span>Cargando maqueta…</span>
      </div>
    </Html>
  )
}

export default function ModelStage({
  url, presetId, autoRotate, resetKey,
}: {
  url: string
  presetId: string
  autoRotate: boolean
  resetKey: number
}) {
  const controlsRef = useRef<any>(null)
  const preset = LIGHTING_PRESETS.find(p => p.id === presetId) ?? DEFAULT_PRESET

  useEffect(() => {
    controlsRef.current?.reset?.()
  }, [resetKey])

  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      gl={{ antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: false }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    >
      <color attach="background" args={['#FFFFFF']} />
      <Suspense fallback={<Loader />}>
        <Scene url={url} preset={preset} autoRotate={autoRotate} controlsRef={controlsRef} />
        <EffectComposer multisampling={4} enableNormalPass>
          <N8AO
            color="#1A1A1A"
            aoRadius={0.45}
            intensity={2.6}
            distanceFalloff={1}
            aoSamples={16}
            denoiseSamples={8}
            halfRes
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
