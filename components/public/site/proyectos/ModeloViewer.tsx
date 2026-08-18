'use client'

// Visor 3D interactivo de la maqueta (GLB) para la página de proyecto.
// Ligero y autocontenido: luces manuales (sin IBL de CDN) + Bounds para encuadrar
// el modelo automáticamente. Se importa con next/dynamic({ssr:false}) desde la
// página, así Three.js solo carga en cliente y no bloquea el render inicial.
//
// La maqueta NO vive en una caja: no hay borde ni contenedor y el fondo del canvas
// es el mismo crema de la página, así que se apoya sobre la hoja. Eso obliga a que
// el zoom no pueda desbordar nunca el lienzo — un modelo cortado por un canto que
// ya no se ve es peor que el canto. De ahí `useEncuadre` de más abajo.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Center, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { site } from '../theme'

const FOV = 42
/** Fracción del lienzo que la maqueta puede llegar a ocupar con el zoom al máximo.
 *  El resto es el aire que la hace flotar: con 0,62 queda casi una quinta parte de
 *  lienzo libre a cada lado, medido contra el peor ángulo de la órbita. Subirlo a
 *  0,9 llena más pero deja un margen de un 5% que el ojo lee como «está tocando el
 *  borde», que es justo lo que había que quitar. */
const OCUPACION_MAX = 0.62
/** Cuánto se puede alejar, en múltiplos de la distancia mínima. */
const ALEJAR_MAX = 3.2
/** Ángulo polar de partida: 65° desde el cenit ≈ 25° de elevación. La vista con la
 *  que se mira una maqueta encima de una mesa. */
const POLAR_INICIAL = (65 * Math.PI) / 180

/** Sombra de contacto: un degradado radial pintado en canvas. Sin caja ni borde,
 *  lo que hace que un objeto flote es su sombra, no su marco. Mismo recurso que
 *  usa la parrilla de maquetas (ProyectosShowroom), aquí para un solo modelo. */
let _texSombra: THREE.CanvasTexture | null = null
function texturaSombra() {
  if (_texSombra) return _texSombra
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.42)')
  g.addColorStop(0.45, 'rgba(0,0,0,0.20)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  _texSombra = new THREE.CanvasTexture(c)
  return _texSombra
}

interface Medidas {
  /** Semialtura de la caja envolvente. */
  hy: number
  /** Media diagonal de la HUELLA en planta: el semiancho en pantalla que puede
   *  llegar a presentar el modelo, sea cual sea el azimut desde el que se mire. */
  hd: number
}

function Modelo({ url, onMedir }: { url: string; onMedir: (m: Medidas) => void }) {
  const { scene } = useGLTF(url, '/draco/')

  // Se mide el clon, no la escena original: `useGLTF` cachea por URL y dos visores
  // de la misma maqueta compartirían el mismo objeto.
  const objeto = useMemo(() => scene.clone(true), [scene])

  const medidas = useMemo<Medidas>(() => {
    const caja = new THREE.Box3().setFromObject(objeto)
    const t = caja.getSize(new THREE.Vector3())
    return {
      hy: (t.y || 1) / 2,
      hd: Math.hypot(t.x, t.z) / 2 || 1,
    }
  }, [objeto])

  useEffect(() => { onMedir(medidas) }, [medidas, onMedir])

  return <primitive object={objeto} />
}

/** Coloca la cámara y ACOTA el zoom a partir del tamaño real del modelo.
 *
 *  El visor tenía aquí un `minDistance={1.5}` — una constante absoluta aplicada a
 *  modelos que cada GLB normaliza a su manera. En una maqueta grande 1.5 ya está
 *  dentro del edificio; en una pequeña se queda a media distancia. No había
 *  ninguna relación entre ese número y la geometría.
 *
 *  Ahora el tope sale de la caja envolvente y se recalcula EN CADA FOTOGRAMA con
 *  el ángulo real de la órbita. La primera versión lo calculaba una sola vez con
 *  la esfera envolvente, que es el único volumen que no cambia al girar y por
 *  tanto la garantía más sencilla — pero para una maqueta PLANA (una planta con su
 *  zócalo) la esfera mide el doble que la silueta, y sobraba media pantalla de
 *  aire. Con el ángulo vivo, la maqueta llena el lienzo desde la vista normal y
 *  la cámara se retira sola si giras hasta el cenital, donde la huella pasa a
 *  ocupar también el alto. La garantía es la misma —nunca toca el borde— y el
 *  encuadre es el doble de grande.
 *
 *  Los dos semiángulos importan: el campo de visión está fijado en VERTICAL, así
 *  que en una ventana estrecha la restricción que manda es la horizontal. */
function Encuadre({ medidas, controls }: { medidas: Medidas | null; controls: React.MutableRefObject<any> }) {
  const { camera, size } = useThree()
  const arrancado = useRef(false)

  const semiV = (FOV * Math.PI) / 360
  const semiH = Math.atan(Math.tan(semiV) * (size.width / Math.max(size.height, 1)))

  /** Distancia mínima para un ángulo polar dado (0 = cenital, π/2 = a ras). */
  const distanciaMinima = (m: Medidas, polar: number) => {
    // Al inclinarse, la huella en planta se proyecta sobre el eje vertical de la
    // pantalla y la altura del modelo se acorta: el semialto en pantalla es la
    // suma de las dos aportaciones.
    const semiAlto = m.hy * Math.sin(polar) + m.hd * Math.cos(polar)
    const semiAncho = m.hd
    return Math.max(semiAlto / Math.tan(semiV), semiAncho / Math.tan(semiH)) / OCUPACION_MAX
  }

  // Encuadre inicial y recálculo al redimensionar.
  useEffect(() => {
    if (!medidas) return
    const cam = camera as THREE.PerspectiveCamera
    const c = controls.current
    const polar = c ? c.getPolarAngle() : POLAR_INICIAL
    const d = distanciaMinima(medidas, polar)

    cam.near = Math.max(d / 200, 0.01)
    cam.far = d * ALEJAR_MAX * 8
    cam.updateProjectionMatrix()

    if (!arrancado.current) {
      // Se arranca en la distancia mínima del ángulo de partida: el encuadre más
      // apretado que garantiza no tocar el borde.
      cam.position.set(Math.sin(POLAR_INICIAL) * 0.5, Math.cos(POLAR_INICIAL), Math.sin(POLAR_INICIAL) * 0.87).setLength(d)
      cam.lookAt(0, 0, 0)
      arrancado.current = true
    } else if (c && cam.position.distanceTo(c.target) < d) {
      cam.position.setLength(d)
      c.update()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medidas, camera, size.width, size.height])

  // El tope vivo. Cuesta cuatro multiplicaciones por fotograma y el lienzo ya se
  // repinta en todos (la maqueta gira sola).
  useFrame(() => {
    const c = controls.current
    if (!medidas || !c) return
    const d = distanciaMinima(medidas, c.getPolarAngle())
    c.minDistance = d
    c.maxDistance = d * ALEJAR_MAX
    // Si girar hacia el cenital ha dejado la cámara por dentro del nuevo mínimo,
    // se la retira. El margen del 0,5% evita pelearse con la amortiguación.
    const actual = camera.position.distanceTo(c.target)
    if (actual < d * 0.995) camera.position.setLength(d)

  })

  return null
}

function Sombra({ medidas }: { medidas: Medidas | null }) {
  const tex = useMemo(() => texturaSombra(), [])
  if (!medidas) return null
  // 2,6 medias diagonales de lado: el degradado muere pasado el canto de la
  // maqueta, así que no se lee como un disco debajo.
  const lado = medidas.hd * 2.6
  return (
    // `<Center>` deja la caja centrada en el origen, así que la base del modelo
    // queda en -hy. Poner la sombra en y=0 la dejaría flotando a media altura.
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -medidas.hy - medidas.hd * 0.004, 0]}>
      <planeGeometry args={[lado, lado]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export default function ModeloViewer({ url }: { url: string }) {
  const [medidas, setMedidas] = useState<Medidas | null>(null)
  const controls = useRef<any>(null)
  const onMedir = useCallback((m: Medidas) => setMedidas(m), [])

  return (
    <Canvas camera={{ fov: FOV, position: [3, 1.8, 4] }} dpr={[1, 2]} style={{ width: '100%', height: '100%' }}>
      <color attach="background" args={[site.color.cream]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 8, 6]} intensity={1.15} />
      <directionalLight position={[-6, 4, -4]} intensity={0.4} />
      <Suspense fallback={null}>
        {/* <Center> deja el modelo centrado en el origen, que es lo que da por
            supuesto el cálculo de la esfera envolvente. */}
        <Center>
          <Modelo url={url} onMedir={onMedir} />
        </Center>
        <Sombra medidas={medidas} />
      </Suspense>
      <Encuadre medidas={medidas} controls={controls} />
      <OrbitControls ref={controls} enablePan={false} autoRotate autoRotateSpeed={0.6}
        // Suelo de la órbita: mirar una maqueta desde debajo del terreno no
        // enseña nada y rompe la sombra de contacto.
        maxPolarAngle={Math.PI / 2 - 0.04}
        minPolarAngle={0.12} />
    </Canvas>
  )
}
