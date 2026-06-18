'use client'

// Recorte automático de documentos (tickets/facturas) en el navegador.
// Usa jscanify (MIT) sobre OpenCV.js: detecta el papel en la foto y corrige
// la perspectiva. Ambas librerías se cargan bajo demanda la primera vez
// (~8 MB de OpenCV, cacheado por el navegador). Si algo falla, se devuelve
// null y se usa la foto original — el recorte nunca bloquea el flujo.

const OPENCV_URL   = 'https://docs.opencv.org/4.7.0/opencv.js'
const JSCANIFY_URL = 'https://cdn.jsdelivr.net/gh/ColonelParrot/jscanify@master/src/jscanify.min.js'

const MAX_OUTPUT_PX = 2200          // lado máximo del recorte resultante
const MIN_AREA_RATIO = 0.08         // recorte < 8% de la foto → probable falsa detección

let loadPromise: Promise<boolean> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(s)
  })
}

function waitForOpenCv(timeoutMs = 15000): Promise<boolean> {
  return new Promise(resolve => {
    const cv = (window as any).cv
    if (cv?.Mat) { resolve(true); return }
    const started = Date.now()
    const timer = setInterval(() => {
      if ((window as any).cv?.Mat) { clearInterval(timer); resolve(true) }
      else if (Date.now() - started > timeoutMs) { clearInterval(timer); resolve(false) }
    }, 100)
  })
}

async function ensureLibsLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if ((window as any).cv?.Mat && (window as any).jscanify) return true
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        await loadScript(OPENCV_URL)
        const cvReady = await waitForOpenCv()
        if (!cvReady) return false
        await loadScript(JSCANIFY_URL)
        return Boolean((window as any).jscanify)
      } catch {
        return false
      }
    })()
  }
  return loadPromise
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')) }
    img.src = url
  })
}

interface Point { x: number; y: number }
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Intenta recortar el documento de la foto. Devuelve un File JPEG con la
 * perspectiva corregida, o null si no se detecta papel con confianza.
 */
export async function autocropImage(file: File): Promise<File | null> {
  try {
    if (!file.type.startsWith('image/')) return null
    const ok = await ensureLibsLoaded()
    if (!ok) return null

    const cv = (window as any).cv
    const JScanify = (window as any).jscanify
    const img = await loadImageFromFile(file)

    const scanner = new JScanify()
    const mat = cv.imread(img)
    let corners: Record<string, Point> | null = null
    try {
      const contour = scanner.findPaperContour(mat)
      if (contour) corners = scanner.getCornerPoints(contour)
    } finally {
      mat.delete()
    }
    if (!corners) return null

    const { topLeftCorner: tl, topRightCorner: tr, bottomLeftCorner: bl, bottomRightCorner: br } = corners as any
    if (!tl || !tr || !bl || !br) return null

    let outW = Math.max(dist(tl, tr), dist(bl, br))
    let outH = Math.max(dist(tl, bl), dist(tr, br))
    if (outW < 50 || outH < 50) return null

    // Falsa detección probable: el "papel" detectado es minúsculo
    const areaRatio = (outW * outH) / (img.naturalWidth * img.naturalHeight)
    if (areaRatio < MIN_AREA_RATIO) return null

    // El recorte cubre prácticamente toda la foto → no aporta nada
    if (areaRatio > 0.97) return null

    const scale = Math.min(1, MAX_OUTPUT_PX / Math.max(outW, outH))
    outW = Math.round(outW * scale)
    outH = Math.round(outH * scale)

    const canvas: HTMLCanvasElement = scanner.extractPaper(img, outW, outH)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) return null

    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}_recorte.jpg`, { type: 'image/jpeg' })
  } catch {
    return null
  }
}
