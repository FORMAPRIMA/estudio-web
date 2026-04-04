import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Vercel Cron — runs daily at 08:00 UTC (vercel.json)
// Also callable manually with CRON_SECRET header for testing
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin  = createAdminClient()
  const today  = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // 1. Find all contract invoices whose agreed date has arrived
  const { data: candidatas, error: fetchErr } = await admin
    .from('facturas')
    .select('id, concepto, monto, proyecto_id, proyectos(nombre, codigo)')
    .eq('status', 'acordada_contrato')
    .lte('fecha_pago_acordada', today)
    .not('fecha_pago_acordada', 'is', null)

  if (fetchErr) {
    console.error('[cron/facturas-cobrables] fetch error:', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!candidatas || candidatas.length === 0) {
    return NextResponse.json({ updated: 0, message: 'No hay facturas cobrables hoy.' })
  }

  const ids = candidatas.map(f => f.id)

  // 2. Update status → cobrable + create one aviso per invoice
  // Do them individually so the aviso logic stays consistent with manual status changes
  const results = await Promise.allSettled(
    candidatas.map(async (f) => {
      const proyecto = f.proyectos as unknown as { nombre: string; codigo: string | null } | null
      const proyLabel = proyecto
        ? `${proyecto.codigo ? proyecto.codigo + ' · ' : ''}${proyecto.nombre}`
        : 'proyecto'
      const montoFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(f.monto)

      await admin.from('facturas').update({ status: 'cobrable' }).eq('id', f.id)
      await admin.from('avisos').insert({
        tipo:         'equipo',
        autor_id:     null,
        titulo:       `Factura cobrable: ${f.concepto}`,
        contenido:    `La factura de ${montoFmt} del proyecto "${proyLabel}" ha llegado a su fecha acordada y está lista para emitir.`,
        nivel:        'info',
        fecha_activa: today,
      })
    })
  )

  const errors = results.filter(r => r.status === 'rejected')
  if (errors.length) {
    console.error('[cron/facturas-cobrables] some errors:', errors)
  }

  console.log(`[cron/facturas-cobrables] ${ids.length} facturas → cobrable`)
  return NextResponse.json({ updated: ids.length, ids })
}
