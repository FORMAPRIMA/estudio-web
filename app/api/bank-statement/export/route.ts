import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getPartnerUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') return null
  return user
}

// ── GET /api/bank-statement/export?statement_id= ──────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getPartnerUser()
  if (!user) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const statementId = searchParams.get('statement_id')
  if (!statementId) return NextResponse.json({ error: 'statement_id requerido' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch statement
  const { data: statement, error: stmtErr } = await admin
    .from('bank_statements')
    .select('*')
    .eq('id', statementId)
    .single()

  if (stmtErr || !statement) {
    return NextResponse.json({ error: 'Extracto no encontrado' }, { status: 404 })
  }

  // Fetch all transactions with linked scan data
  const { data: transactions, error: txErr } = await admin
    .from('bank_transactions')
    .select(`
      *,
      linked_scan:expense_scans!expense_scan_id(
        foto_url,
        tipo,
        monto,
        fecha_ticket,
        proveedor
      )
    `)
    .eq('statement_id', statementId)
    .order('fecha', { ascending: true })

  if (txErr) {
    return NextResponse.json({ error: txErr.message }, { status: 500 })
  }

  const txList = (transactions ?? []) as Array<{
    id: string
    fecha: string | null
    concepto: string | null
    importe: number | null
    moneda: string
    tipo_fiscal: string
    expense_scan_id: string | null
    linked_scan: {
      foto_url: string
      tipo: string
      monto: number | null
      fecha_ticket: string | null
      proveedor: string | null
    } | null
  }>

  // ── Generate FP codes (matched transactions in date order) ────────────────────
  const matchedTx = txList
    .filter(t => t.expense_scan_id != null)
    .sort((a, b) => {
      const da = a.fecha ?? ''
      const db = b.fecha ?? ''
      return da < db ? -1 : da > db ? 1 : 0
    })

  const { year, month } = statement as { year: number; month: number }
  const yy  = String(year).slice(-2)
  const mm  = String(month).padStart(2, '0')

  const codeMap = new Map<string, string>()
  matchedTx.forEach((tx, i) => {
    codeMap.set(tx.id, `FP-${yy}${mm}-${String(i + 1).padStart(3, '0')}`)
  })

  // ── Build Excel ───────────────────────────────────────────────────────────────
  const excelRows = txList.map(tx => {
    const code = codeMap.get(tx.id) ?? ''
    const scan = tx.linked_scan
    return {
      'Código':          code,
      'Fecha':           tx.fecha ?? '',
      'Concepto':        tx.concepto ?? '',
      'Importe':         tx.importe ?? '',
      'Tipo fiscal':     tx.tipo_fiscal ?? '',
      'Proveedor ticket': scan?.proveedor ?? '',
      'Fecha ticket':    scan?.fecha_ticket ?? '',
      'Archivo':         code ? `tickets/${code}_${tx.fecha}_${scan?.tipo ?? 'gasto'}.jpg` : '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(excelRows)
  ws['!cols'] = [
    { wch: 16 }, { wch: 12 }, { wch: 40 }, { wch: 12 },
    { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 48 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Extracto ${mm}-${year}`)
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  // ── Build ZIP ─────────────────────────────────────────────────────────────────
  const zip  = new JSZip()
  zip.file(`extracto_${year}_${mm}.xlsx`, excelBuffer)
  const ticketsFolder = zip.folder('tickets')!

  const photoPromises = matchedTx.map(async tx => {
    const scan = tx.linked_scan
    if (!scan?.foto_url) return
    const code = codeMap.get(tx.id)
    if (!code) return
    try {
      const res = await fetch(scan.foto_url)
      if (!res.ok) return
      const buf = await res.arrayBuffer()
      const ext = scan.foto_url.split('.').pop()?.split('?')[0] ?? 'jpg'
      const name = `${code}_${tx.fecha ?? 'sin_fecha'}_${scan.tipo ?? 'gasto'}.${ext}`
      ticketsFolder.file(name, buf)
    } catch {
      // skip silently
    }
  })

  await Promise.all(photoPromises)

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  const folderName = `conciliacion_${year}_${mm}`
  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${folderName}.zip"`,
    },
  })
}
