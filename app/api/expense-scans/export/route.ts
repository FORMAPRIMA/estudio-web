import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'

const TIPO_LABELS: Record<string, string> = {
  taxi_transporte:       'Taxi / Transporte',
  restaurante_comida:    'Restaurante / Comida',
  alojamiento:           'Alojamiento',
  material_oficina:      'Material de oficina',
  software_suscripcion:  'Software / Suscripción',
  gasto_proyecto:        'Gasto de proyecto',
  factura_proveedor:     'Factura proveedor',
  otro:                  'Otro',
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()), 10)
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10)

  const from    = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to      = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  const admin = createAdminClient()
  const { data: scans, error } = await admin
    .from('expense_scans')
    .select('*, autor:profiles!user_id(nombre)')
    .or(`and(fecha_ticket.gte.${from},fecha_ticket.lte.${to}),and(fecha_ticket.is.null,created_at.gte.${from}T00:00:00,created_at.lte.${to}T23:59:59)`)
    .order('fecha_ticket', { ascending: true,  nullsFirst: false })
    .order('created_at',   { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (scans ?? []) as any[]
  const monthLabel = String(month).padStart(2, '0')
  const folderName = `gastos_${year}_${monthLabel}`

  const zip = new JSZip()
  const fotosFolder = zip.folder('fotos')!

  // ── Excel ────────────────────────────────────────────────────────────────────
  const excelRows = rows.map((r, i) => ({
    '#':           i + 1,
    'Fecha ticket': r.fecha_ticket ?? '',
    'Fecha subida': r.created_at ? r.created_at.split('T')[0] : '',
    'Subido por':   (r.autor as any)?.nombre ?? '',
    'Tipo':         TIPO_LABELS[r.tipo] ?? r.tipo ?? '',
    'Proveedor':    r.proveedor ?? '',
    'Descripción':  r.descripcion ?? '',
    'Importe':      r.monto != null ? r.monto : '',
    'Moneda':       r.moneda ?? 'EUR',
    'Proyecto ID':  r.proyecto_id ?? '',
    'Notas':        r.notas ?? '',
    'URL foto':     r.foto_url ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(excelRows)

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 14 }, { wch: 13 }, { wch: 18 },
    { wch: 22 }, { wch: 24 }, { wch: 36 }, { wch: 10 },
    { wch: 7 }, { wch: 36 }, { wch: 30 }, { wch: 60 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Gastos ${monthLabel}-${year}`)
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  zip.file(`gastos_${year}_${monthLabel}.xlsx`, excelBuffer)

  // ── Photos ───────────────────────────────────────────────────────────────────
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

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${folderName}.zip"`,
    },
  })
}
