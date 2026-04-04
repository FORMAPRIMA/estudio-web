import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AreaPrivadaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, rol')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Team members go to their own area
  if (profile.rol !== 'cliente') {
    redirect('/team/dashboard')
  }

  const handleLogout = async () => {
    'use server'
    const supabaseServer = await createClient()
    await supabaseServer.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Sidebar */}
      <aside className="w-64 bg-dark text-cream flex flex-col shrink-0 min-h-screen">
        <div className="p-8 border-b border-cream/10">
          <Link
            href="/"
            className="text-xs tracking-ultra font-light uppercase text-cream hover:opacity-60 transition-opacity block mb-2"
          >
            Forma Prima
          </Link>
          <p className="text-meta text-xs tracking-widest uppercase font-light">
            Área Privada
          </p>
        </div>

        <nav className="flex-1 p-6 space-y-1">
          <Link
            href="/area-privada"
            className="block text-xs tracking-widest uppercase font-light text-cream/70 hover:text-cream transition-colors py-2"
          >
            Dashboard
          </Link>
          <Link
            href="/area-privada"
            className="block text-xs tracking-widest uppercase font-light text-cream/70 hover:text-cream transition-colors py-2"
          >
            Mis proyectos
          </Link>
          <Link
            href="/area-privada"
            className="block text-xs tracking-widest uppercase font-light text-cream/70 hover:text-cream transition-colors py-2"
          >
            Documentos
          </Link>
          <Link
            href="/contacto"
            className="block text-xs tracking-widest uppercase font-light text-cream/70 hover:text-cream transition-colors py-2"
          >
            Contactar estudio
          </Link>
        </nav>

        <div className="p-6 border-t border-cream/10">
          <p className="text-cream/50 text-xs font-light mb-4 truncate">
            {profile.nombre}
          </p>
          <form action={handleLogout}>
            <button
              type="submit"
              className="text-xs tracking-widest uppercase font-light text-meta hover:text-cream transition-colors"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
