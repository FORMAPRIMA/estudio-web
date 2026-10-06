import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONCILIACION_BUCKET, requirePartnerApi, trimestreValido } from '@/lib/revision-gestoria/server'

export const dynamic = 'force-dynamic'

// Sirve la app de revisión. Sus rutas relativas («estado», «archivo?p=») resuelven
// a las rutas hermanas de esta.
export async function GET(_req: Request, { params }: { params: { trimestre: string } }) {
  const auth = await requirePartnerApi()
  if (!auth.ok) return auth.res
  if (!trimestreValido(params.trimestre)) return NextResponse.json({ error: 'Trimestre no válido' }, { status: 404 })

  const { data, error } = await createAdminClient().storage
    .from(CONCILIACION_BUCKET).download(`${params.trimestre}/app.html`)
  if (error || !data) return NextResponse.json({ error: 'No hay app para este trimestre' }, { status: 404 })

  return new NextResponse(await data.text(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}
