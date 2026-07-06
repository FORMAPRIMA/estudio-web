import type { SupabaseClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { periodFilter, isQuarter, type Period } from './period'

export const TIPO_LABELS: Record<string, string> = {
  taxi_transporte:       'Taxi / Transporte',
  restaurante_comida:    'Restaurante / Comida',
  alojamiento:           'Alojamiento',
  material_oficina:      'Material de oficina',
  software_suscripcion:  'Software / Suscripción',
  gasto_proyecto:        'Gasto de proyecto',
  factura_proveedor:     'Factura proveedor',
  otro:                  'Otro',
}

/** Qué gastos meter en el ZIP: un mes, un trimestre o una selección de ids. */
export type GastosZipSelector = Period | { ids: string[] }

// Mes efectivo de un gasto (YYYY-MM): fecha del documento, o fecha de subida si falta.
function scanMonthKey(r: any): string {
  const d = r.fecha_ticket ?? (r.created_at ? String(r.created_at).slice(0, 10) : null)
  return d ? String(d).slice(0, 7) : 'sin_fecha'
}

// Anchos de columna del Excel (deben cuadrar con excelRows más abajo)
const COL_WIDTHS = [
  { wch: 4 }, { wch: 14 }, { wch: 6 }, { wch: 13 }, { wch: 18 },
  { wch: 22 }, { wch: 24 }, { wch: 13 }, { wch: 36 }, { wch: 10 },
  { wch: 7 }, { wch: 12 }, { wch: 28 }, { wch: 30 }, { wch: 60 },
]

/**
 * Escribe un grupo de gastos (Excel + carpeta `fotos/`) dentro de `target`,
 * que puede ser la raíz del ZIP o una subcarpeta de mes. La numeración de
 * filas y de fotos arranca en 1 dentro de cada grupo.
 */
async function writeGroup(target: JSZip, rows: any[], baseName: string, sheetName: string) {
  const excelRows = rows.map((r, i) => ({
    '#':               i + 1,
    'Fecha documento': r.fecha_ticket ?? '',
    'Hora':            r.hora_ticket ?? '',
    'Fecha subida':    r.created_at ? String(r.created_at).split('T')[0] : '',
    'Subido por':      (r.autor as any)?.nombre ?? '',
    'Tipo':            TIPO_LABELS[r.tipo] ?? r.tipo ?? '',
    'Proveedor':       r.proveedor ?? '',
    'NIF proveedor':   r.nif_proveedor ?? '',
    'Descripción':     r.descripcion ?? '',
    'Importe':         r.monto != null ? r.monto : '',
    'Moneda':          r.moneda ?? 'EUR',
    'Tarjeta (últ. 4)': r.ultimos_4 ?? '',
    'Proyecto':        (r.proyecto as any)?.nombre
                         ? `${(r.proyecto as any).nombre}${(r.proyecto as any).codigo ? ` (${(r.proyecto as any).codigo})` : ''}`
                         : '',
    'Notas':           r.notas ?? '',
    'URL foto':        r.foto_url ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(excelRows)
  ws['!cols'] = COL_WIDTHS
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  target.file(`${baseName}.xlsx`, excelBuffer)

  const fotosFolder = target.folder('fotos')!
  await Promise.all(rows.map(async (r, i) => {
    if (!r.foto_url) return
    try {
      const res = await fetch(r.foto_url)
      if (!res.ok) return
      const buf = await res.arrayBuffer()
      const ext   = r.foto_url.split('.').pop()?.split('?')[0] ?? 'jpg'
      const fecha = r.fecha_ticket ?? r.created_at?.split('T')[0] ?? 'sin_fecha'
      const tipo  = r.tipo ?? 'gasto'
      const name  = `${String(i + 1).padStart(3, '0')}_${fecha}_${tipo}.${ext}`
      fotosFolder.file(name, buf)
    } catch {
      // skip failed downloads silently
    }
  }))
}

function sheetNameForMonth(monthKey: string): string {
  if (monthKey === 'sin_fecha') return 'Sin fecha'
  const [yy, mm] = monthKey.split('-')
  return `Gastos ${mm}-${yy}`
}

/**
 * Genera el ZIP de gastos: Excel con todos los campos + carpeta de fotos.
 * - Un solo mes → estructura plana (Excel + `fotos/` en la raíz).
 * - Trimestre o selección que abarca varios meses → una subcarpeta por mes
 *   (`2026-04/`, `2026-05/`…), cada una con su propio Excel y sus fotos.
 * En todos los casos los gastos van ordenados cronológicamente por fecha de
 * documento. Compartido entre el export interno y el portal del gestor.
 */
export async function buildGastosZip(
  admin: SupabaseClient,
  selector: GastosZipSelector
): Promise<{ buffer: Buffer; filename: string } | { error: string }> {
  let query = admin
    .from('expense_scans')
    .select('*, autor:profiles!user_id(nombre), proyecto:proyectos!proyecto_id(nombre, codigo)')

  let baseFilename: string
  let forceGroup = false

  if ('ids' in selector) {
    if (selector.ids.length === 0) return { error: 'No hay gastos seleccionados.' }
    query = query.in('id', selector.ids)
    baseFilename = 'gastos_seleccion'
  } else if (isQuarter(selector)) {
    query = query.or(periodFilter(selector))
    baseFilename = `gastos_${selector.year}_Q${selector.quarter}`
    forceGroup = true
  } else {
    query = query.or(periodFilter(selector))
    baseFilename = `gastos_${selector.year}_${String(selector.month).padStart(2, '0')}`
  }

  const { data: scans, error } = await query
    .order('fecha_ticket', { ascending: true, nullsFirst: false })
    .order('created_at',   { ascending: true })

  if (error) return { error: error.message }
  const rows = (scans ?? []) as any[]

  const zip = new JSZip()

  // Se agrupa por mes en subcarpetas cuando es un trimestre o cuando la
  // selección abarca más de un mes; si no, estructura plana.
  const distinctMonths = Array.from(new Set(rows.map(scanMonthKey))).sort()
  const grouped = forceGroup || distinctMonths.length > 1

  if (!grouped) {
    const sheetName = distinctMonths.length === 1 ? sheetNameForMonth(distinctMonths[0]) : 'Gastos'
    await writeGroup(zip, rows, baseFilename, sheetName)
  } else {
    for (const monthKey of distinctMonths) {
      const monthRows = rows.filter(r => scanMonthKey(r) === monthKey)
      const folder    = zip.folder(monthKey)!
      const baseName  = monthKey === 'sin_fecha' ? 'gastos_sin_fecha' : `gastos_${monthKey.replace('-', '_')}`
      await writeGroup(folder, monthRows, baseName, sheetNameForMonth(monthKey))
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return { buffer: zipBuffer, filename: `${baseFilename}.zip` }
}
