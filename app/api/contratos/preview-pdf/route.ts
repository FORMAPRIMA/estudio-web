import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { ContratoPDF } from '@/components/pdfs/ContratoPDF'
import type { ContratoPDFData, ServicioContrato, ContratoHonorario } from '@/components/pdfs/ContratoPDF'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { contratoId } = await req.json()

  const admin = createAdminClient()
  const { data: contrato, error } = await admin
    .from('contratos')
    .select('*')
    .eq('id', contratoId)
    .single()

  if (error || !contrato) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  const serviciosContrato: ServicioContrato[] = (contrato.contenido?.servicios ?? []) as ServicioContrato[]
  const honorarios: ContratoHonorario[]       = (contrato.honorarios ?? []) as ContratoHonorario[]

  const data: ContratoPDFData = {
    numero:             contrato.numero ?? '—',
    fecha_contrato:     contrato.fecha_contrato ?? null,
    tipo_cliente:       (contrato.contenido?.tipo_cliente ?? (contrato.cliente_empresa ? 'juridica' : 'fisica')) as 'fisica' | 'juridica',
    cliente_nombre:     contrato.cliente_nombre    ?? null,
    cliente_apellidos:  contrato.cliente_apellidos ?? null,
    cliente_empresa:    contrato.cliente_empresa   ?? null,
    cliente_nif:        contrato.cliente_nif       ?? null,
    cliente_direccion:  contrato.cliente_direccion ?? null,
    cliente_ciudad:     contrato.cliente_ciudad    ?? null,
    proyecto_nombre:    contrato.proyecto_nombre   ?? null,
    proyecto_direccion: contrato.proyecto_direccion ?? null,
    proyecto_tipo:      contrato.proyecto_tipo     ?? null,
    servicios_contrato: serviciosContrato,
    honorarios,
    notas:              contrato.notas ?? null,
  }

  const buffer = await renderToBuffer(createElement(ContratoPDF, { data }))
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="Contrato-${data.numero}.pdf"`,
    },
  })
}
