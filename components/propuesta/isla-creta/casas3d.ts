// Visor de las cuatro casas tipo de Isla Creta, fuera de la isla: maqueta sobre
// un plano de estudio, con la calidad de los modelos de Blender (en la isla van
// muy simplificadas). Se monta solo en su diapositiva; mientras tanto, la isla
// está en pausa, así que nunca hay dos escenas pintando a la vez.
//
// Son direcciones de partida (placeholders): las casas aún no se han diseñado.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { afinarMaterialCasa } from './escena'

export interface VisorCasas {
  mostrar: (i: number) => void
  destruir: () => void
}

export async function crearVisorCasas(o: { contenedor: HTMLElement; base: string; onListo?: () => void }): Promise<VisorCasas> {
  const { contenedor, base } = o
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;'
  contenedor.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = env.texture
  scene.environmentIntensity = 0.55
  pmrem.dispose()

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600)
  camera.position.set(34, 26, 38)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 22
  controls.maxDistance = 80
  controls.maxPolarAngle = Math.PI * 0.46
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.55
  controls.target.set(0, 2.5, 0)

  scene.add(new THREE.HemisphereLight('#f3f1ea', '#8a8778', 0.9))
  const sol = new THREE.DirectionalLight('#fff3e2', 2.4)
  sol.position.set(-26, 40, 22)
  sol.castShadow = true
  sol.shadow.mapSize.set(2048, 2048)
  Object.assign(sol.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 5, far: 120 })
  sol.shadow.bias = -0.0003
  sol.shadow.normalBias = 0.03
  scene.add(sol)

  // Suelo: solo recibe sombra, sobre el fondo de la diapositiva.
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(80, 64), new THREE.ShadowMaterial({ opacity: 0.22 }))
  suelo.rotation.x = -Math.PI / 2
  suelo.receiveShadow = true
  scene.add(suelo)

  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const casas: THREE.Group[] = []
  const archivos = [1, 2, 3, 4].map((n) => `${base}/casa-${n}.glb?v=1`)
  const gltfs = await Promise.all(archivos.map((a) => loader.loadAsync(a)))
  const afinados = new Set<THREE.Material>()
  for (const g of gltfs) {
    const raiz = g.scene
    raiz.traverse((n) => {
      const m = n as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = true
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        if (!afinados.has(mat)) { afinados.add(mat); afinarMaterialCasa(mat as THREE.MeshStandardMaterial) }
      }
    })
    // Cada casa, centrada y a la misma escala aparente (lado mayor ≈ 26 m).
    const caja = new THREE.Box3().setFromObject(raiz)
    const tam = caja.getSize(new THREE.Vector3()), centro = caja.getCenter(new THREE.Vector3())
    const k = 26 / Math.max(tam.x, tam.z)
    const grupo = new THREE.Group()
    raiz.position.set(-centro.x, -caja.min.y, -centro.z)
    grupo.add(raiz)
    grupo.scale.setScalar(k)
    grupo.visible = false
    scene.add(grupo)
    casas.push(grupo)
  }

  let actual = -1, entrada = 0, raf = 0, destruida = false
  function mostrar(i: number) {
    if (i === actual) return
    casas.forEach((c, k) => { c.visible = k === i })
    actual = i
    entrada = performance.now()
    renderer.shadowMap.needsUpdate = true
  }

  function resize() {
    const w = contenedor.clientWidth, h = contenedor.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(contenedor)
  resize()

  const ease = (x: number) => 1 - Math.pow(1 - x, 3)
  function loop(now: number) {
    raf = requestAnimationFrame(loop)
    if (destruida) return
    const c = casas[actual]
    if (c) {
      // Entrada: sube un poco y se asienta.
      const k = Math.min(1, (now - entrada) / 1100)
      c.position.y = (1 - ease(k)) * -2.2
      c.rotation.y = (1 - ease(k)) * -0.35
    }
    controls.update()
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(loop)
  mostrar(0)
  o.onListo?.()

  return {
    mostrar,
    destruir: () => {
      destruida = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      scene.traverse((n) => {
        const m = n as THREE.Mesh
        m.geometry?.dispose()
        for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) mat.dispose()
      })
      env.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
