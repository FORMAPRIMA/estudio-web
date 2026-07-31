// Monta los datos de los PDFs de memorias. Solo servidor (API routes).
//
// Las imágenes se descargan aquí y se pasan al renderer como data URI: si una
// falla, ese item sale sin foto en lugar de tumbar el PDF entero a mitad de render.

import { createAdminClient } from '@/lib/supabase/admin'
import {
  ceilCent,
  conIva,
  importeCoste,
  importePvp,
  IVA_DEFAULT,
  nivelMeta,
  nivelesLabel,
  type EstadoCompra,
  type NivelCalidad,
} from './domain'

const MAX_IMAGEN_BYTES = 6_000_000
const CONCURRENCIA = 8

async function descargarImagen(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const tipo = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!tipo.startsWith('image/')) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGEN_BYTES) return null
    return `data:${tipo};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

/** Descarga en paralelo con tope, deduplicando URLs repetidas. */
async function inlineImagenes(urls: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unicas = Array.from(new Set(urls.filter((u): u is string => !!u)))
  const resultado = new Map<string, string>()
  for (let i = 0; i < unicas.length; i += CONCURRENCIA) {
    const lote = unicas.slice(i, i + CONCURRENCIA)
    const datos = await Promise.all(lote.map(descargarImagen))
    lote.forEach((url, j) => {
      const dato = datos[j]
      if (dato) resultado.set(url, dato)
    })
  }
  return resultado
}

// ── Tipos de datos de PDF ─────────────────────────────────────────────────────

export interface ProyectoPdf {
  nombre: string
  codigo: string | null
  direccion: string | null
}

export interface ItemAnteproyecto {
  subcapitulo: string
  nombre: string
  marca: string | null
  modelo: string | null
  referencia: string | null
  descripcion: string | null
  acabados: string[]
  imagen: string | null
  precio_pvp: number | null
  precio_pvp_con_iva: number | null
}

export interface CapituloAnteproyecto {
  numero: number
  nombre: string
  items: ItemAnteproyecto[]
}

export interface AnteproyectoData {
  proyecto: ProyectoPdf
  nivelLabel: string
  nivelColor: string
  fecha: string
  incluirPrecios: boolean
  capitulos: CapituloAnteproyecto[]
  huecos: string[]
  totalPvp: number | null
  totalPvpConIva: number | null
}

export interface ItemEjecutivo {
  nombre: string
  marca: string | null
  modelo: string | null
  referencia: string | null
  descripcion: string | null
  acabado: string | null
  subcapitulo: string
  capitulo: string
  nivelLabel: string | null
  cantidad: number
  proveedor: string | null
  precio_pvp: number | null
  precio_coste: number | null
  importe_pvp: number
  importe_coste: number
  estado_compra: EstadoCompra
  url_producto: string | null
  notas: string | null
  imagen: string | null
  estancia: string
}

export interface EstanciaEjecutivo {
  nombre: string
  items: ItemEjecutivo[]
  totalPvp: number
  totalCoste: number
}

export interface EjecutivoData {
  proyecto: ProyectoPdf
  fecha: string
  modo: 'completo' | 'proveedor'
  proveedorNombre: string | null
  incluirCostes: boolean
  estancias: EstanciaEjecutivo[]
  totalPvp: number
  totalCoste: number
  totalMargen: number
  totalUnidades: number
}

// ── Anteproyecto: favoritos FP del nivel elegido ──────────────────────────────

export async function cargarAnteproyecto(
  proyectoId: string,
  nivel: NivelCalidad,
  incluirPrecios: boolean
): Promise<AnteproyectoData | null> {
  const admin = createAdminClient()
  const [{ data: proyecto }, { data: capitulos }, { data: subcapitulos }, { data: filas }] = await Promise.all([
    admin.from('proyectos').select('nombre, codigo, direccion').eq('id', proyectoId).single(),
    admin.from('presupuesto_capitulos').select('id, numero, nombre, orden').eq('activo', true).order('orden'),
    admin.from('presupuesto_subcapitulos').select('id, capitulo_id, nombre, orden').eq('activo', true).order('orden'),
    admin
      .from('warehouse_favoritos')
      .select(`
        subcapitulo_id,
        item:warehouse_items (
          nombre, marca, modelo, referencia, descripcion, acabados,
          imagen_lifestyle_url, imagen_principal_url, precio_pvp, precio_pvp_con_iva, iva_pct, activo
        )
      `)
      .eq('nivel_calidad', nivel),
  ])

  if (!proyecto) return null

  type FavoritoConItem = {
    subcapitulo_id: string
    item: {
      nombre: string
      marca: string | null
      modelo: string | null
      referencia: string | null
      descripcion: string | null
      acabados: string[] | null
      imagen_lifestyle_url: string | null
      imagen_principal_url: string | null
      precio_pvp: number | null
      precio_pvp_con_iva: number | null
      iva_pct: number | null
      activo: boolean
    } | null
  }

  const favoritos = ((filas ?? []) as unknown as FavoritoConItem[])
    .filter(f => f.item && f.item.activo)
    .map(f => ({ subcapitulo_id: f.subcapitulo_id, ...f.item! }))

  const imagenes = await inlineImagenes(
    favoritos.map(f => f.imagen_lifestyle_url ?? f.imagen_principal_url)
  )

  const huecos: string[] = []
  const capitulosData: CapituloAnteproyecto[] = []

  for (const capitulo of capitulos ?? []) {
    const subs = (subcapitulos ?? []).filter(s => s.capitulo_id === capitulo.id)
    const items: ItemAnteproyecto[] = []
    for (const sub of subs) {
      const fav = favoritos.find(f => f.subcapitulo_id === sub.id)
      if (!fav) {
        huecos.push(`${capitulo.nombre} › ${sub.nombre}`)
        continue
      }
      const urlImagen = fav.imagen_lifestyle_url ?? fav.imagen_principal_url
      items.push({
        subcapitulo: sub.nombre,
        nombre: fav.nombre,
        marca: fav.marca,
        modelo: fav.modelo,
        referencia: fav.referencia,
        descripcion: fav.descripcion,
        acabados: fav.acabados ?? [],
        imagen: urlImagen ? imagenes.get(urlImagen) ?? null : null,
        precio_pvp: fav.precio_pvp,
        precio_pvp_con_iva: fav.precio_pvp_con_iva ?? conIva(fav.precio_pvp, fav.iva_pct ?? IVA_DEFAULT),
      })
    }
    if (items.length > 0) {
      capitulosData.push({ numero: capitulo.numero, nombre: capitulo.nombre, items })
    }
  }

  const meta = nivelMeta(nivel)
  const planos = capitulosData.flatMap(c => c.items)
  const totalPvp = incluirPrecios
    ? ceilCent(planos.reduce((acc, i) => acc + (i.precio_pvp ?? 0), 0))
    : null
  const totalPvpConIva = incluirPrecios
    ? ceilCent(planos.reduce((acc, i) => acc + (i.precio_pvp_con_iva ?? 0), 0))
    : null

  return {
    proyecto: { nombre: proyecto.nombre, codigo: proyecto.codigo, direccion: proyecto.direccion ?? null },
    nivelLabel: meta.label,
    nivelColor: meta.color,
    fecha: new Date().toISOString(),
    incluirPrecios,
    capitulos: capitulosData,
    huecos,
    totalPvp,
    totalPvpConIva,
  }
}

// ── Ejecutivo: estancias del proyecto ─────────────────────────────────────────

export async function cargarEjecutivo(
  proyectoId: string,
  opciones: { proveedorId?: string | null; incluirCostes: boolean }
): Promise<EjecutivoData | null> {
  const admin = createAdminClient()
  const { data: proyecto } = await admin
    .from('proyectos')
    .select('nombre, codigo, direccion')
    .eq('id', proyectoId)
    .single()
  if (!proyecto) return null

  const { data: estancias } = await admin
    .from('memoria_estancias')
    .select('id, nombre, orden')
    .eq('proyecto_id', proyectoId)
    .order('orden', { ascending: true })

  const estanciaIds = (estancias ?? []).map(e => e.id)
  const [{ data: items }, { data: capitulos }, { data: subcapitulos }, { data: proveedores }] = await Promise.all([
    estanciaIds.length > 0
      ? admin
          .from('memoria_estancia_items')
          .select('*')
          .in('estancia_id', estanciaIds)
          .order('orden', { ascending: true })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    admin.from('presupuesto_capitulos').select('id, nombre').eq('activo', true),
    admin.from('presupuesto_subcapitulos').select('id, capitulo_id, nombre').eq('activo', true),
    admin.from('proveedores').select('id, nombre'),
  ])

  type ItemRow = {
    estancia_id: string
    subcapitulo_id: string
    nombre: string
    marca: string | null
    modelo: string | null
    referencia: string | null
    descripcion: string | null
    acabado_seleccionado: string | null
    niveles_calidad: NivelCalidad[] | null
    nivel_calidad?: NivelCalidad | null
    cantidad: number
    proveedor_id: string | null
    precio_pvp: number | null
    precio_coste: number | null
    estado_compra: EstadoCompra
    url_producto: string | null
    notas: string | null
    imagen_principal_url: string | null
    imagen_lifestyle_url: string | null
  }

  let filas = (items ?? []) as unknown as ItemRow[]
  const proveedorNombre = opciones.proveedorId
    ? (proveedores ?? []).find(p => p.id === opciones.proveedorId)?.nombre ?? null
    : null
  if (opciones.proveedorId) filas = filas.filter(f => f.proveedor_id === opciones.proveedorId)

  const imagenes = await inlineImagenes(filas.map(f => f.imagen_principal_url ?? f.imagen_lifestyle_url))

  const capPorId = new Map((capitulos ?? []).map(c => [c.id, c.nombre]))
  const subPorId = new Map((subcapitulos ?? []).map(s => [s.id, s]))
  const provPorId = new Map((proveedores ?? []).map(p => [p.id, p.nombre]))

  const estanciasData: EstanciaEjecutivo[] = []
  for (const estancia of estancias ?? []) {
    const propias = filas.filter(f => f.estancia_id === estancia.id)
    if (propias.length === 0) continue

    const itemsData: ItemEjecutivo[] = propias.map(f => {
      const sub = subPorId.get(f.subcapitulo_id)
      const urlImagen = f.imagen_principal_url ?? f.imagen_lifestyle_url
      return {
        nombre: f.nombre,
        marca: f.marca,
        modelo: f.modelo,
        referencia: f.referencia,
        descripcion: f.descripcion,
        acabado: f.acabado_seleccionado,
        subcapitulo: sub?.nombre ?? '—',
        capitulo: sub ? capPorId.get(sub.capitulo_id) ?? '—' : '—',
        nivelLabel: f.niveles_calidad?.length
          ? nivelesLabel(f.niveles_calidad)
          : f.nivel_calidad
            ? nivelesLabel([f.nivel_calidad])
            : null,
        cantidad: f.cantidad,
        proveedor: f.proveedor_id ? provPorId.get(f.proveedor_id) ?? null : null,
        precio_pvp: f.precio_pvp,
        precio_coste: f.precio_coste,
        importe_pvp: importePvp(f),
        importe_coste: importeCoste(f),
        estado_compra: f.estado_compra,
        url_producto: f.url_producto,
        notas: f.notas,
        imagen: urlImagen ? imagenes.get(urlImagen) ?? null : null,
        estancia: estancia.nombre,
      }
    })

    estanciasData.push({
      nombre: estancia.nombre,
      items: itemsData,
      totalPvp: ceilCent(itemsData.reduce((acc, i) => acc + i.importe_pvp, 0)),
      totalCoste: ceilCent(itemsData.reduce((acc, i) => acc + i.importe_coste, 0)),
    })
  }

  const totalPvp = ceilCent(estanciasData.reduce((acc, e) => acc + e.totalPvp, 0))
  const totalCoste = ceilCent(estanciasData.reduce((acc, e) => acc + e.totalCoste, 0))

  return {
    proyecto: { nombre: proyecto.nombre, codigo: proyecto.codigo, direccion: proyecto.direccion ?? null },
    fecha: new Date().toISOString(),
    modo: opciones.proveedorId ? 'proveedor' : 'completo',
    proveedorNombre,
    incluirCostes: opciones.incluirCostes,
    estancias: estanciasData,
    totalPvp,
    totalCoste,
    totalMargen: ceilCent(totalPvp - totalCoste),
    totalUnidades: estanciasData.reduce((acc, e) => acc + e.items.reduce((n, i) => n + i.cantidad, 0), 0),
  }
}
