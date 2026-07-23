import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PropuestaData } from '@/components/pdfs/PropuestaTraspasoPDF'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const nz = (x: unknown, def: number) => (Number.isFinite(x) ? Number(x) : def)
const str = (x: unknown, def: string) => (typeof x === 'string' && x.trim() ? x.trim() : def)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const b = await req.json()
    const data: PropuestaData = {
      fecha: new Date().toISOString(),
      destinatarios: str(b?.destinatarios, 'Ángel y Mari'),
      firmantes: str(b?.firmantes, 'José y Gaby'),
      direccion: str(b?.direccion, 'Calle Goya, 63 · Madrid'),
      opcion1Monto: nz(b?.opcion1Monto, 58000),
      opcion1Irpf: nz(b?.opcion1Irpf, 12200),
      opcion1Neto: nz(b?.opcion1Neto, 45800),
      opcion2Total: nz(b?.opcion2Total, 75000),
      opcion2Entrada: nz(b?.opcion2Entrada, 10000),
      opcion2Mensualidad: nz(b?.opcion2Mensualidad, 1083),
      opcion2Meses: nz(b?.opcion2Meses, 60),
      opcion2IrpfPrimer: nz(b?.opcion2IrpfPrimer, 4700),
      opcion2IrpfResto: nz(b?.opcion2IrpfResto, 2600),
      opcion2Neto: nz(b?.opcion2Neto, 59900),
      senal: nz(b?.senal, 3000),
      compensacion: nz(b?.compensacion, 3000),
      reservaDias: nz(b?.reservaDias, 60),
    }

    const reactPdf = await import('@react-pdf/renderer')
    const { buildPropuestaTraspasoElement } = await import('@/components/pdfs/PropuestaTraspasoPDF')
    const element = buildPropuestaTraspasoElement(reactPdf, data)
    const buffer = await reactPdf.renderToBuffer(element)

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Propuesta_Traspaso_Quiosco_Goya63.pdf"',
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (err) {
    console.error('[modelo-cafe/propuesta-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando la propuesta' },
      { status: 500 }
    )
  }
}
