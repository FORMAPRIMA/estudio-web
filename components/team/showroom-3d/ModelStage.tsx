'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls, Environment, SoftShadows, PerspectiveCamera, useGLTF, Html,
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
      <PerspectiveCamera makeDefault fov={34} position={[5.2, targetY + 3.4, 6.2]} />

      {/* Penumbra suave tipo PCSS: size alto = borde muy difuminado (más feather) */}
      <SoftShadows size={70} samples={26} focus={0} />

      <primitive object={object} />

      {/* Luz clave en ángulo bajo: proyecta la sombra hacia un lado, como un sol bajo */}
      <directionalLight
        castShadow
        position={[-6, 4.5, -2.5]}
        intensity={1.15}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
      >
        <orthographicCamera attach="shadow-camera" args={[-3.2, 3.2, 3.2, -3.2, 0.1, 30]} />
      </directionalLight>
      {/* Relleno suave desde el lado opuesto para que la sombra no quede negra */}
      <directionalLight position={[5, 6, 4]} intensity={0.3} />

      <Environment files={preset.environmentImage} environmentIntensity={preset.envIntensity} />

      {/* Suelo invisible que SOLO recibe la sombra → plano blanco continuo con sombra proyectada */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial transparent opacity={preset.shadowOpacity} color="#000000" />
      </mesh>

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
        maxPolarAngle={(85 * Math.PI) / 180}
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
      shadows
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
