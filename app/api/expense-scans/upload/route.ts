import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('photo') as File | null
  if (!file || file.size === 0) return NextResponse.json({ error: 'No se recibió ninguna foto.' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'La foto no puede superar 10 MB.' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const storagePath = `${user.id}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('expense-scans')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage
    .from('expense-scans')
    .getPublicUrl(data.path)

  return NextResponse.json({ url: publicUrl, path: data.path })
}
