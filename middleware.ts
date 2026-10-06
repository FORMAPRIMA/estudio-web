import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // ── La raíz ────────────────────────────────────────────────────────────────
  // Aquí vivía la reescritura de / al teaser /wip mientras la web estaba cerrada.
  // Ya no: la raíz ES la Home del sitio.
  //
  // Lo que queda es el host interno. internal.formaprima.es sirve la MISMA
  // aplicación, así que sin esto su raíz enseñaría la web pública al equipo, que
  // lo que quiere ahí es entrar. Solo GET: un POST a / es un Server Action, y
  // redirigirlo lo rompe.
  const host = (request.headers.get('host') || '').toLowerCase()
  // Salas (salas.*) es una burbuja aparte: nada de la sesión ni las redirecciones
  // de internal. next.config lo reescribe todo a app/salas.
  if (host.startsWith('salas.')) return NextResponse.next()
  if (host === 'internal.formaprima.es' && request.nextUrl.pathname === '/' && request.method === 'GET') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Maquetas 3D de los teasers (public/propuesta/<slug>/maqueta/*): solo con la
  // cookie que deja el PIN de esa propuesta. La cookie va con path
  // /propuesta/<slug>, así que el navegador la manda también aquí.
  const maqueta = request.nextUrl.pathname.match(/^\/propuesta\/([a-z0-9-]+)\/maqueta\//)
  if (maqueta) {
    const slug = maqueta[1]
    const nombre = `fp_prop_${slug.replace(/[^a-z0-9]/g, '').slice(-16)}`
    const ok = await cookiePropuestaValida(slug, request.cookies.get(nombre)?.value)
    return ok ? NextResponse.next() : new NextResponse('No autorizado', { status: 401 })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Protect /area-privada/* and /team/*
  const isAreaPrivada = pathname.startsWith('/area-privada')
  const isTeam = pathname.startsWith('/team')

  // /protegido/* son archivos estáticos de `public/` que solo el equipo FP
  // puede descargar (maquetas de clientes reales, p. ej. FP Visual Lab · Isla
  // Creta). Proteger la página no protege el GLB: se protege aquí, y como lo
  // pide un fetch y no un navegador, se responde 401 en vez de redirigir.
  if (pathname.startsWith('/protegido')) {
    if (!session) return new NextResponse('No autorizado', { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('rol').eq('id', session.user.id).single()
    const FP_ROLES = ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev']
    if (!profile?.rol || !FP_ROLES.includes(profile.rol)) return new NextResponse('No autorizado', { status: 403 })
    return supabaseResponse
  }

  if (!session && (isAreaPrivada || isTeam)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (session && (isAreaPrivada || isTeam)) {
    // Fetch user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', session.user.id)
      .single()

    const rol = profile?.rol
    const FP_ROLES = ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev']
    const isFpStaff = rol ? FP_ROLES.includes(rol) : false

    // No role or unknown role → redirect to login
    if (!rol) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Non-fp user trying to access /team
    if (isTeam && !isFpStaff) {
      return NextResponse.redirect(new URL('/area-privada', request.url))
    }

    // fp staff trying to access /area-privada
    if (isAreaPrivada && isFpStaff) {
      return NextResponse.redirect(new URL('/team', request.url))
    }
  }

  return supabaseResponse
}

// Misma firma que lib/propuestas/acceso.ts (HMAC-SHA256 de PORTAL_SECRET), con
// Web Crypto: el middleware corre en el edge y no tiene el crypto de Node.
async function cookiePropuestaValida(slug: string, valor: string | undefined): Promise<boolean> {
  if (!valor) return false
  const secreto = process.env.PORTAL_SECRET ?? (process.env.NODE_ENV === 'production' ? '' : 'dev-only-secret-not-for-production')
  if (!secreto) return false
  const enc = new TextEncoder()
  const clave = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const firma = new Uint8Array(await crypto.subtle.sign('HMAC', clave, enc.encode(`propuesta-web:${slug}`)))
  const esperado = Array.from(firma, (b) => b.toString(16).padStart(2, '0')).join('')
  if (esperado.length !== valor.length) return false
  let dif = 0
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ valor.charCodeAt(i)
  return dif === 0
}

export const config = {
  matcher: [
    '/',
    '/area-privada/:path*',
    '/team/:path*',
    '/protegido/:path*',
    '/propuesta/:slug/maqueta/:path*',
  ],
}
