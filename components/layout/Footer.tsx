import Link from 'next/link'
import Image from 'next/image'

const navLinks = [
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/estudio', label: 'Estudio' },
  { href: '/visual-lab', label: 'Visual Lab' },
  { href: '/real-estate', label: 'Real Estate' },
  { href: '/contacto', label: 'Contacto' },
]

export default function Footer() {
  return (
    <footer className="bg-dark text-cream">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          {/* Studio Info */}
          <div>
            <Image
              src="/FORMA_PRIMA_BLANCO.png"
              alt="Forma Prima"
              height={124}
              width={620}
              className="block h-[124px] w-auto mb-6"
            />
            <p className="text-meta text-sm font-light leading-relaxed max-w-xs">
              Estudio de arquitectura e interiorismo fundado en Ciudad de México. Proyectos residenciales,
              comerciales y de hospitalidad con una visión editorial y sensible al contexto.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-xs tracking-widest uppercase font-light text-meta mb-6">Navegación</p>
            <nav className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-cream/70 text-sm font-light hover:text-cream transition-colors tracking-wider"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/area-privada"
                className="text-meta text-sm font-light hover:text-cream transition-colors tracking-wider"
              >
                Área Privada
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs tracking-widest uppercase font-light text-meta mb-6">Contacto</p>
            <address className="not-italic text-sm font-light text-cream/70 leading-relaxed space-y-2">
              <p>Av. Presidente Masaryk 111, Piso 8</p>
              <p>Polanco, Ciudad de México</p>
              <p>C.P. 11560</p>
              <p className="pt-3">
                <a href="mailto:hola@formaprima.mx" className="hover:text-cream transition-colors">
                  hola@formaprima.mx
                </a>
              </p>
              <p>
                <a href="tel:+525512345678" className="hover:text-cream transition-colors">
                  +52 55 1234 5678
                </a>
              </p>
            </address>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-cream/10 mt-12 pt-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <p className="text-meta text-xs tracking-widest font-light">
            © {new Date().getFullYear()} Forma Prima. Todos los derechos reservados.
          </p>
          <p className="text-meta text-xs font-light">
            Arquitectura · Interiorismo · Experiencias
          </p>
        </div>
      </div>
    </footer>
  )
}
