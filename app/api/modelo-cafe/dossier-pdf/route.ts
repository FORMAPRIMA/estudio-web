import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeInputs, computeModelo } from '@/lib/modelo-cafe/domain'
import { derivarEscenarios, estructuraInversion } from '@/lib/modelo-cafe/dossier'
import {
  BEBIDAS, UBICACION, TRASPASOS, mediaPorBebida, ticketMedioPorLocal,
  ticketMedioMercado, mercadoTraspasos,
} from '@/lib/modelo-cafe/mercado'
import type { DossierData } from '@/components/pdfs/DossierBancarioPDF'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const inputs = normalizeInputs(body?.inputs)
    const escenarioNombre = typeof body?.escenarioNombre === 'string' ? body.escenarioNombre : 'Conservador'
    const pesimistaPct = Number.isFinite(body?.pesimistaPct) ? Number(body.pesimistaPct) : -0.3
    const optimistaPct = Number.isFinite(body?.optimistaPct) ? Number(body.optimistaPct) : 0.4

    const escenarios = derivarEscenarios(inputs, pesimistaPct, optimistaPct)
    const conservador = escenarios.find((e) => e.clave === 'conservador')?.r ?? computeModelo(inputs)
    const estructura = estructuraInversion(inputs)

    const capexDetalle: { categoria: string; importe: number }[] | undefined = Array.isArray(body?.capexDetalle)
      ? body.capexDetalle
          .filter((c: unknown) => c && typeof c === 'object')
          .map((c: { categoria?: unknown; importe?: unknown }) => ({
            categoria: typeof c.categoria === 'string' ? c.categoria : '—',
            importe: Number.isFinite(c.importe) ? Number(c.importe) : 0,
          }))
      : undefined

    const medias = mediaPorBebida()
    const data: DossierData = {
      fecha: new Date().toISOString(),
      escenarioNombre,
      inputs,
      conservador,
      escenarios: escenarios.map((e) => ({
        clave: e.clave, nombre: e.nombre, cafesDia: e.cafesDia,
        facturacionAnual: e.facturacionAnual, margenBrutoPct: e.margenBrutoPct,
        ebitdaAnual: e.ebitdaAnual, netoAnual: e.netoAnual, margenNeto: e.margenNeto,
        cajaArranque: e.cajaArranque, cajaEstable: e.cajaEstable,
        dscrArranque: e.dscrArranque, dscrEstable: e.dscrEstable, paybackMeses: e.paybackMeses,
      })),
      estructura,
      mercado: {
        ubicacion: {
          rentaGoya: UBICACION.rentaGoya, vacancy: UBICACION.vacancy,
          posicionCalle: UBICACION.posicionCalle, alquilerLocal: UBICACION.alquilerLocal,
        },
        traspasos: TRASPASOS.map((t) => ({ quiosco: t.quiosco, zona: t.zona, precioTexto: t.precioTexto, goya: t.goya })),
        traspasoMedia: mercadoTraspasos().media,
        ticketMercado: ticketMedioMercado(),
        bebidas: BEBIDAS.map((b) => ({ label: b.label, media: medias[b.key].media, n: medias[b.key].n })),
        ticketPorLocal: ticketMedioPorLocal().map((t) => ({ nombre: t.nombre, ticket: t.ticket, destacada: t.destacada })),
      },
      capex: capexDetalle,
    }

    const reactPdf = await import('@react-pdf/renderer')
    const { buildDossierBancarioElement } = await import('@/components/pdfs/DossierBancarioPDF')
    const element = buildDossierBancarioElement(reactPdf, data)
    const buffer = await reactPdf.renderToBuffer(element)

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Dossier_Financiacion_Cafe_Goya63.pdf"',
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[modelo-cafe/dossier-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando el dossier' },
      { status: 500 }
    )
  }
}
