'use client'

import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// Miniatura ligera para la rejilla: sin HDRI ni post-proceso (rápida, sin descargar
// los 6 MB del HDRI por tarjeta). Solo renderiza bajo demanda; gira al pasar el ratón.

const TARGET = 2

function normalize(scene: THREE.Object3D) {
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
  return { object: root, height: box.getSize(new THREE.Vector3()).y }
}

function Thumb({ url, spin }: { url: string; spin: boolean }) {
  const { scene } = useGLTF(url, '/draco/')
  const { object, height } = useMemo(() => normalize(scene), [scene])
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (spin && ref.current) ref.current.rotation.y += delta * 0.5
  })
  return (
    <>
      <PerspectiveCamera makeDefault fov={32} position={[2.2, height / 2 + 1.4, 2.7]} />
      <group ref={ref}>
        <primitive object={object} />
      </group>
      <hemisphereLight args={['#ffffff', '#EDEAE2', 0.85]} />
      <directionalLight position={[4, 6, 4]} intensity={1.25} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} />
    </>
  )
}

export default function ModelThumb({ url, spin }: { url: string; spin: boolean }) {
  return (
    <Canvas
      frameloop={spin ? 'always' : 'demand'}
      dpr={[1, 1.75]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      camera={{ position: [2.2, 1.6, 2.7], fov: 32 }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <Thumb url={url} spin={spin} />
      </Suspense>
    </Canvas>
  )
}
