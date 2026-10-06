import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONCILIACION_BUCKET, leerJson, requirePartnerApi, trimestreValido } from '@/lib/revision-gestoria/server'

export const dynamic = 'force-dynamic'

type Marca = { estado?: string; nota?: string; link?: string; por?: string; en?: string }
type Estado = Record<string, Marca>

export async function GET(_req: Request, { params }: { params: { trimestre: string } }) {
  const auth = await requirePartnerApi()
  if (!auth.ok) return auth.res
  if (!trimestreValido(params.trimestre)) return NextResponse.json({ error: 'Trimestre no válido' }, { status: 404 })

  const estado = (await leerJson<Estado>(`${params.trimestre}/estado.json`)) || {}
  return NextResponse.json(estado, { headers: { 'Cache-Control': 'private, no-store' } })
}

// POST { cambios: { <clave>: { estado, nota, link } } } — fusiona por clave, así lo que marque
// un socio no pisa lo que esté marcando el otro en otros registros.
export async function POST(req: Request, { params }: { params: { trimestre: string } }) {
  const auth = await requirePartnerApi()
  if (!auth.ok) return auth.res
  if (!trimestreValido(params.trimestre)) return NextResponse.json({ error: 'Trimestre no válido' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const cambios = body?.cambios
  if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const path = `${params.trimestre}/estado.json`
  const estado = (await leerJson<Estado>(path)) || {}
  const en = new Date().toISOString()
  for (const [k, v] of Object.entries(cambios as Record<string, Marca>)) {
    if (!/^[a-zA-Z][\w-]{0,40}$/.test(k) || !v || typeof v !== 'object') continue
    const marca: Marca = { por: auth.nombre, en }
    for (const campo of ['estado', 'nota', 'link'] as const) {
      if (typeof v[campo] === 'string') marca[campo] = v[campo]!.slice(0, 4000)
    }
    estado[k] = marca
  }

  const admin = createAdminClient()
  const json = JSON.stringify(estado)
  // Copia por hora, como hacía el servidor local con _backups/
  const stamp = en.slice(0, 13)
  await admin.storage.from(CONCILIACION_BUCKET)
    .upload(`${params.trimestre}/backups/estado_${stamp}.json`, json, { contentType: 'application/json', upsert: true })
  const { error } = await admin.storage.from(CONCILIACION_BUCKET)
    .upload(path, json, { contentType: 'application/json', upsert: true, cacheControl: '0' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, n: Object.keys(estado).length })
}
