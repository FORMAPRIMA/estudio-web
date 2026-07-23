import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Recibe la captura PNG de la maqueta 3D (dataURL desde el canvas de MapLibre)
// y la guarda en Storage en una ruta determinista por activo. El informe PDF
// la incrusta si existe.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || ['fp_partner', 'fp_manager'].indexOf(profile.rol) === -1) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { image } = await req.json().catch(() => ({})) as { image?: string }
  if (!image || !image.startsWith('data:image/png;base64,')) {
    return NextResponse.json({ error: 'Se espera un PNG en dataURL' }, { status: 400 })
  }
  const base64 = image.slice('data:image/png;base64,'.length)
  if (base64.length > 12_000_000) {
    return NextResponse.json({ error: 'Captura demasiado grande' }, { status: 413 })
  }
  const buffer = Buffer.from(base64, 'base64')

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('urban-analyst')
    .upload(`capturas/${params.id}.png`, buffer, { contentType: 'image/png', upsert: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
