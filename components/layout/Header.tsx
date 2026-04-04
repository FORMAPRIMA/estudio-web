'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/estudio', label: 'Estudio' },
  { href: '/visual-lab', label: 'Visual Lab' },
  { href: '/real-estate', label: 'Real Estate' },
  { href: '/contacto', label: 'Contacto' },
]

// Páginas cuyo hero inicial es oscuro — el header arranca en blanco
function pageHasDarkHero(pathname: string): boolean {
  if (pathname === '/') return true
  if (pathname === '/visual-lab') return true
  if (/^\/proyectos\/.+/.test(pathname)) return true
  if (/^\/real-estate\/.+/.test(pathname)) return true
  return false
}

export default function Header() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 60)
    update() // evaluar posición actual al montar
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  // Re-evaluar al cambiar de página (el scroll puede no estar en 0)
  useEffect(() => {
    setScrolled(window.scrollY > 60)
    setMenuOpen(false)
  }, [pathname])

  // Tema claro (logo blanco, texto cream) solo en páginas con hero oscuro antes de scroll
  const light = pageHasDarkHero(pathname) && !scrolled

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-cream/95 backdrop-blur-sm border-b border-ink/10'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-[74px]">

          {/* Logo — ambas versiones precargadas, se alterna por opacity */}
          <Link href="/" className="hover:opacity-70 transition-opacity duration-300 relative flex items-center h-[56px]">
            <Image
              src="/FORMA_PRIMA_NEGRO.png"
              alt="Forma Prima"
              height={56}
              width={280}
              className={`block h-[56px] w-auto transition-opacity duration-500 ${
                light ? 'opacity-0 absolute' : 'opacity-100'
              }`}
              priority
            />
            <Image
              src="/FORMA_PRIMA_BLANCO.png"
              alt=""
              height={56}
              width={280}
              className={`block h-[56px] w-auto transition-opacity duration-500 ${
                light ? 'opacity-100' : 'opacity-0 absolute'
              }`}
              priority
            />
          </Link>

          {/* Nav + Área Privada agrupados a la derecha */}
          <div className="hidden lg:flex items-center gap-10 ml-auto">
            <nav className="flex items-center gap-10">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[9px] tracking-widest uppercase font-light transition-colors duration-500 hover:opacity-60 ${
                    light ? 'text-cream' : 'text-ink'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <Link
              href="/area-privada"
              className={`text-[9px] tracking-widest uppercase font-light transition-colors duration-500 hover:opacity-60 ${
                light ? 'text-cream' : 'text-ink'
              }`}
            >
              Área Privada
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className={`lg:hidden flex flex-col gap-1.5 p-2 transition-colors duration-500 ${
              light ? 'text-cream' : 'text-ink'
            }`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`block w-6 h-px bg-current transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-px bg-current transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-px bg-current transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>

        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`lg:hidden transition-all duration-500 overflow-hidden ${
          menuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        } bg-ink`}
      >
        <nav className="flex flex-col px-6 py-8 gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-cream text-xs tracking-widest uppercase font-light hover:opacity-60 transition-opacity"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/area-privada"
            onClick={() => setMenuOpen(false)}
            className="text-meta text-xs tracking-widest uppercase font-light hover:opacity-60 transition-opacity"
          >
            Área Privada
          </Link>
        </nav>
      </div>
    </header>
  )
}
