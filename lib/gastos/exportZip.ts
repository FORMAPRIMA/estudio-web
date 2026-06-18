import type { SupabaseClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'

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

/**
 * Genera el ZIP mensual de gastos: Excel con todos los campos + carpeta de
 * fotos nombradas por orden/fecha/tipo. Compartido entre el export interno
 * y el portal del gestor.
 */
export async function buildGastosZip(
  admin: SupabaseClient,
  year: number,
  month: number
): Promise<{ buffer: Buffer; filename: string } | { error: string }> {
  const from    = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to      = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  const { data: scans, error } = await admin
    .from('expense_scans')
    .select('*, autor:profiles!user_id(nombre), proyecto:proyectos!proyecto_id(nombre, codigo)')
    .or(`and(fecha_ticket.gte.${from},fecha_ticket.lte.${to}),and(fecha_ticket.is.null,created_at.gte.${from}T00:00:00,created_at.lte.${to}T23:59:59)`)
    .order('fecha_ticket', { ascending: true,  nullsFirst: false })
    .order('created_at',   { ascending: true })

  if (error) return { error: error.message }

  const rows = (scans ?? []) as any[]
  const monthLabel = String(month).padStart(2, '0')
  const folderName = `gastos_${year}_${monthLabel}`

  const zip = new JSZip()
  const fotosFolder = zip.folder('fotos')!

  // ── Excel ────────────────────────────────────────────────────────────────
  const excelRows = rows.map((r, i) => ({
    '#':              i + 1,
    'Fecha documento': r.fecha_ticket ?? '',
    'Hora':           r.hora_ticket ?? '',
    'Fecha subida':   r.created_at ? r.created_at.split('T')[0] : '',
    'Subido por':     (r.autor as any)?.nombre ?? '',
    'Tipo':           TIPO_LABELS[r.tipo] ?? r.tipo ?? '',
    'Proveedor':      r.proveedor ?? '',
    'NIF proveedor':  r.nif_proveedor ?? '',
    'Descripción':    r.descripcion ?? '',
    'Importe':        r.monto != null ? r.monto : '',
    'Moneda':         r.moneda ?? 'EUR',
    'Tarjeta (últ. 4)': r.ultimos_4 ?? '',
    'Proyecto':       (r.proyecto as any)?.nombre
                        ? `${(r.proyecto as any).nombre}${(r.proyecto as any).codigo ? ` (${(r.proyecto as any).codigo})` : ''}`
                        : '',
    'Notas':          r.notas ?? '',
    'URL foto':       r.foto_url ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(excelRows)

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 14 }, { wch: 6 }, { wch: 13 }, { wch: 18 },
    { wch: 22 }, { wch: 24 }, { wch: 13 }, { wch: 36 }, { wch: 10 },
    { wch: 7 }, { wch: 12 }, { wch: 28 }, { wch: 30 }, { wch: 60 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Gastos ${monthLabel}-${year}`)
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  zip.file(`gastos_${year}_${monthLabel}.xlsx`, excelBuffer)

  // ── Photos ───────────────────────────────────────────────────────────────
  const photoPromises = rows.map(async (r, i) => {
    if (!r.foto_url) return
    try {
      const res = await fetch(r.foto_url)
      if (!res.ok) return
      const buf = await res.arrayBuffer()
      const ext = r.foto_url.split('.').pop()?.split('?')[0] ?? 'jpg'
      const fecha = r.fecha_ticket ?? r.created_at?.split('T')[0] ?? 'sin_fecha'
      const tipo  = r.tipo ?? 'gasto'
      const name  = `${String(i + 1).padStart(3, '0')}_${fecha}_${tipo}.${ext}`
      fotosFolder.file(name, buf)
    } catch {
      // skip failed downloads silently
    }
  })

  await Promise.all(photoPromises)

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return { buffer: zipBuffer, filename: `${folderName}.zip` }
}
