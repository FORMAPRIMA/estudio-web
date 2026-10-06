import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONCILIACION_BUCKET, leerJson, requirePartnerApi, trimestreValido } from '@/lib/revision-gestoria/server'

export const dynamic = 'force-dynamic'

// GET ?p=<ruta del paquete local> → redirige a una URL firmada y de corta vida del documento.
export async function GET(req: NextRequest, { params }: { params: { trimestre: string } }) {
  const auth = await requirePartnerApi()
  if (!auth.ok) return auth.res
  if (!trimestreValido(params.trimestre)) return NextResponse.json({ error: 'Trimestre no válido' }, { status: 404 })

  const p = req.nextUrl.searchParams.get('p') || ''
  const manifest = await leerJson<Record<string, string>>(`${params.trimestre}/manifest.json`)
  const objeto = manifest?.[p]
  if (!objeto) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  const { data, error } = await createAdminClient().storage
    .from(CONCILIACION_BUCKET).createSignedUrl(`${params.trimestre}/${objeto}`, 60 * 30)
  if (error || !data) return NextResponse.json({ error: 'No se pudo firmar el archivo' }, { status: 500 })

  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'private, no-store' } })
}
