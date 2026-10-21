import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { COOKIE_PANEL, auditar, esHostSalas, maxAgeSesion, valorSesion } from '@/lib/salas/panel'
import { leerPase } from '@/lib/salas/puente'

// salas.*/entrar?pase=… — recoge el pase que emite internal (/team/salas) y abre
// la sesión del panel como si se hubiera tecleado el código.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!esHostSalas()) return new NextResponse('No disponible', { status: 404 })
  // req.url llega reescrito (/salas/entrar en el host interno): la vuelta se
  // construye con el host real de la petición.
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'salas.formaprima.es'
  const proto = req.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
  const inicio = `${proto}://${host}/`
  const caducado = `${inicio}?pase=caducado`
  const pase = leerPase(req.nextUrl.searchParams.get('pase'))
  if (!pase) return NextResponse.redirect(caducado)

  const admin = createAdminClient()
  const { data: m } = await admin.from('sala_miembros').select('id, activo, ultimo_acceso').eq('id', pase.miembroId).maybeSingle()
  // De un solo uso: un pase emitido antes del último acceso ya se ha gastado.
  if (!m || !m.activo || (m.ultimo_acceso && Date.parse(m.ultimo_acceso) >= pase.emitido)) {
    return NextResponse.redirect(caducado)
  }

  await admin.from('sala_miembros').update({ ultimo_acceso: new Date().toISOString() }).eq('id', m.id)
  await auditar(m.id, 'entrar_cuenta_fp', null)
  const res = NextResponse.redirect(inicio)
  res.cookies.set(COOKIE_PANEL, valorSesion(m.id), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: maxAgeSesion,
  })
  return res
}
