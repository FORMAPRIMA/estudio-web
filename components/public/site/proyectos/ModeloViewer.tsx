'use client'

// Visor 3D interactivo de la maqueta (GLB) para la página de proyecto.
// Ligero y autocontenido: luces manuales (sin IBL de CDN) + Bounds para encuadrar
// el modelo automáticamente. Se importa con next/dynamic({ssr:false}) desde la
// página, así Three.js solo carga en cliente y no bloquea el render inicial.

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Bounds, Center, useGLTF } from '@react-three/drei'

function Modelo({ url }: { url: string }) {
  const { scene } = useGLTF(url, '/draco/')
  return <primitive object={scene} />
}

export default function ModeloViewer({ url }: { url: string }) {
  return (
    <Canvas camera={{ fov: 42, position: [3, 1.8, 4] }} dpr={[1, 2]} style={{ width: '100%', height: '100%' }}>
      <color attach="background" args={['#f4f3f0']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 8, 6]} intensity={1.15} />
      <directionalLight position={[-6, 4, -4]} intensity={0.4} />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.25}>
          <Center>
            <Modelo url={url} />
          </Center>
        </Bounds>
      </Suspense>
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.6} minDistance={1.5} maxDistance={12} />
    </Canvas>
  )
}
