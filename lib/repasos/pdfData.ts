// Prepara los datos del informe PDF de repasos. Server-only (descarga imágenes).
//
// El filtrado por audiencia lo hace la query de `loadProyectoData`; aquí se
// vuelve a aplicar como segunda barrera, porque colar un repaso interno en un
// informe de cliente no se puede deshacer.

import { fetchImage } from './imageSize'
import {
  ESTADOS,
  estadoColor,
  estadoLabel,
  esVisiblePara,
  fmtFecha,
  numeroDeCodigo,
  oficioColor,
  oficioLabel,
  prioridadLabel,
  visibilidadLabel,
} from './domain'
import type { RepasoAudiencia } from './domain'
import type { ProyectoData } from './data'
import type {
  RepasoPDFItem,
  RepasoPDFPlano,
  RepasosObraPDFData,
} from '@/components/pdfs/RepasosObraPDF'

/** Fotos por repaso que se incrustan en el PDF. El resto se indica en la ficha. */
const MAX_FOTOS_POR_REPASO = 2
/** Tope global de fotos incrustadas, para que el PDF no se vaya de tamaño. */
const MAX_FOTOS_TOTAL = 80
/** Descargas simultáneas de imágenes. */
const CONCURRENCIA = 6

/**
 * Helvetica (la fuente base de @react-pdf/renderer) no tiene glifos para varios
 * símbolos que la gente pega desde WhatsApp o el móvil: salen como comillas.
 */
export function pdfSafe(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .replace(/→/g, '->').replace(/←/g, '<-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≈/g, '~')
    .replace(/[✓✔]/g, 'OK').replace(/[✗✘]/g, 'NO')
    .replace(/[⚠️⚠]\s*/g, '').replace(/[★☆]/g, '*')
    .replace(/[•·]/g, '-')
    .replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'")
    .replace(/…/g, '...').replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    // Emojis: viven en el plano astral, así que se van por pares subrogados
    // (sin la bandera /u, que el target de TS no admite).
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    // Símbolos varios del BMP y selectores de variación que Helvetica no cubre
    .replace(/[\u2600-\u27bf\u2b00-\u2bff\ufe00-\ufe0f]/g, '')
    .trim()
}

async function mapLimit<T, R>(
  items: T[],
  limite: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}

const AUDIENCIA_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  constructora: 'Constructora',
  interno: 'Uso interno',
}

const NOTA: Record<string, string> = {
  cliente:
    'Este informe recoge los repasos de obra que Forma Prima comparte con la propiedad, con su ' +
    'situación en el plano y su estado a la fecha indicada. Los repasos marcados como resueltos ' +
    'han sido verificados por el equipo. Documento informativo: no sustituye al acta de recepción ' +
    'de la obra ni a la documentación contractual.',
  constructora:
    'Relación de repasos de obra pendientes de ejecución y ya resueltos, con su situación en el ' +
    'plano. El número del pin identifica cada repaso en las comunicaciones con Forma Prima. ' +
    'Cualquier duda sobre el alcance de un repaso debe resolverse con la dirección de obra antes ' +
    'de intervenir.',
  interno:
    'Documento interno de Forma Prima. Incluye TODOS los repasos, también los no compartidos con ' +
    'la constructora ni con el cliente. No enviar fuera del equipo: para eso están los informes ' +
    'por audiencia.',
}

export async function buildRepasosPdfData(
  data: ProyectoData,
  audiencia?: RepasoAudiencia
): Promise<RepasosObraPDFData> {
  const clave = audiencia ?? 'interno'
  const esInterno = !audiencia

  // Doble cinturón: la query de `loadProyectoData` ya filtra por audiencia, pero
  // un informe de cliente con un repaso interno dentro sería un daño difícil de
  // reparar. Se vuelve a filtrar aquí para que ninguna llamada futura pueda
  // saltárselo por descuido.
  const permitidos = audiencia
    ? data.repasos.filter((r) => esVisiblePara(r.visibilidad, audiencia))
    : data.repasos

  const repasos = [...permitidos].sort(
    (a, b) => numeroDeCodigo(a.codigo) - numeroDeCodigo(b.codigo)
  )

  // ── Planos: solo los que tienen repasos (y al menos uno siempre) ────────────
  const conRepasos = data.planos.filter((p) => repasos.some((r) => r.plano_id === p.id))
  const planosIncluidos = conRepasos.length ? conRepasos : data.planos.slice(0, 1)

  const planos: RepasoPDFPlano[] = await mapLimit(planosIncluidos, CONCURRENCIA, async (plano) => {
    const img = await fetchImage(plano.img_url)
    // La proporción real de la imagen manda; las dimensiones de BD son el respaldo.
    const aspect =
      img?.size && img.size.height > 0
        ? img.size.width / img.size.height
        : plano.width && plano.height
          ? plano.width / plano.height
          : 4 / 3

    return {
      nombre: pdfSafe(plano.nombre) || 'Plano',
      imgSrc: img?.dataUri ?? null,
      aspect,
      pins: repasos
        .filter((r) => r.plano_id === plano.id)
        .map((r) => ({
          numero: numeroDeCodigo(r.codigo),
          x: r.x,
          y: r.y,
          color: estadoColor(r.estado),
        })),
    }
  })

  // ── Fotos ──────────────────────────────────────────────────────────────────
  let presupuestoFotos = MAX_FOTOS_TOTAL
  const planoNombre = (id: string) =>
    pdfSafe(data.planos.find((p) => p.id === id)?.nombre ?? '') || 'Plano'

  const items: RepasoPDFItem[] = await mapLimit(repasos, CONCURRENCIA, async (r) => {
    const candidatas = r.fotos.slice(0, MAX_FOTOS_POR_REPASO)
    const permitidas = Math.max(0, Math.min(candidatas.length, presupuestoFotos))
    presupuestoFotos -= permitidas

    const descargadas = await mapLimit(candidatas.slice(0, permitidas), 2, async (f) => {
      const img = await fetchImage(f.url)
      return img ? { src: img.dataUri, tipo: f.tipo === 'despues' ? 'Resuelto' : 'Incidencia' } : null
    })
    const fotos = descargadas.filter((f): f is { src: string; tipo: string } => f !== null)

    return {
      codigo: r.codigo,
      numero: numeroDeCodigo(r.codigo),
      oficio: pdfSafe(oficioLabel(r.oficio)),
      oficioColor: oficioColor(r.oficio),
      estado: estadoLabel(r.estado),
      estadoColor: estadoColor(r.estado),
      visibilidad: esInterno ? visibilidadLabel(r.visibilidad) : null,
      prioridad: prioridadLabel(r.prioridad),
      descripcion: pdfSafe(r.descripcion),
      responsable: pdfSafe(r.responsable) || null,
      fechaObjetivo: r.fecha_objetivo ? fmtFecha(r.fecha_objetivo) : null,
      creado: fmtFecha(r.created_at),
      resuelto: r.resuelto_at ? fmtFecha(r.resuelto_at) : null,
      plano: planoNombre(r.plano_id),
      fotos,
      fotosOmitidas: r.fotos.length - fotos.length,
    }
  })

  // ── Resumen por oficio ─────────────────────────────────────────────────────
  const oficios = new Map<string, { n: number; resueltos: number }>()
  repasos.forEach((r) => {
    const prev = oficios.get(r.oficio) ?? { n: 0, resueltos: 0 }
    oficios.set(r.oficio, {
      n: prev.n + 1,
      resueltos: prev.resueltos + (r.estado === 'resuelto' ? 1 : 0),
    })
  })

  return {
    proyecto: {
      nombre: pdfSafe(data.proyecto.nombre) || 'Proyecto',
      direccion: pdfSafe(data.proyecto.direccion) || null,
      cliente: pdfSafe(data.proyecto.cliente) || null,
      // Cliente y constructora se identifican en los tres informes: se conocen
      // entre ellos y además la constructora ya sale como responsable de las
      // fichas. Lo único que no cruza la frontera es lo interno de FP: la
      // referencia del proyecto y la visibilidad de cada repaso.
      constructora: pdfSafe(data.proyecto.constructora) || null,
      referencia: esInterno ? pdfSafe(data.proyecto.referencia) || null : null,
    },
    audiencia: AUDIENCIA_LABEL[clave] ?? 'Informe',
    nota: NOTA[clave],
    fecha: fmtFecha(new Date().toISOString()),
    contadores: ESTADOS.map((e) => ({
      label: e.label,
      n: repasos.filter((r) => r.estado === e.id).length,
      color: e.color,
    })),
    porOficio: Array.from(oficios.entries())
      .map(([id, v]) => ({
        label: pdfSafe(oficioLabel(id)),
        n: v.n,
        resueltos: v.resueltos,
        color: oficioColor(id),
      }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'es')),
    planos,
    repasos: items,
  }
}

/** Nombre del archivo que se descarga. */
export function pdfFilename(nombreProyecto: string, audiencia?: RepasoAudiencia): string {
  const slug = (nombreProyecto || 'proyecto')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  const fecha = new Date().toISOString().slice(0, 10)
  return `repasos-${slug}-${audiencia ?? 'interno'}-${fecha}.pdf`
}
