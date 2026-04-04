import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
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
    const FP_ROLES = ['fp_team', 'fp_manager', 'fp_partner']
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

export const config = {
  matcher: [
    '/area-privada/:path*',
    '/team/:path*',
  ],
}
