import Link from 'next/link'
import ProjectCard from '@/components/ui/ProjectCard'
import { proyectosMock } from '@/lib/data/mock'

export default function HomePage() {
  const featuredProjects = proyectosMock.slice(0, 3)

  return (
    <>
      {/* Hero Section */}
      <section className="relative w-full h-screen bg-dark flex items-end">
        {/* Background texture overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-dark/60 via-dark/40 to-dark/80 z-10" />
        {/* Background image placeholder */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900" />

        <div className="relative z-20 max-w-screen-xl mx-auto px-6 lg:px-12 pb-20 lg:pb-32 w-full">
          <div className="max-w-4xl">
            <h1 className="text-cream font-light tracking-ultra uppercase text-6xl sm:text-7xl lg:text-9xl mb-6 leading-none">
              Forma<br />Prima
            </h1>
            <p className="text-meta text-xs tracking-widest uppercase font-light">
              Arquitectura · Interiorismo · Experiencias
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 right-12 z-20 hidden lg:flex flex-col items-center gap-3">
          <span className="text-meta text-xs tracking-widest uppercase font-light rotate-90 origin-center">
            Scroll
          </span>
          <div className="w-px h-12 bg-meta/40" />
        </div>
      </section>

      {/* Intro Section */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-24 lg:py-40">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div>
            <h2 className="text-ink font-light text-4xl lg:text-5xl leading-tight">
              Arquitectura que<br />
              <span className="italic">narra</span> el espacio
            </h2>
          </div>
          <div className="space-y-6 text-ink/70 font-light leading-relaxed">
            <p>
              Forma Prima es un estudio de arquitectura e interiorismo fundado en Ciudad de México.
              Trabajamos en la intersección entre el rigor técnico y la sensibilidad poética,
              creando espacios que trascienden la función para convertirse en experiencias.
            </p>
            <p>
              Cada proyecto es una conversación entre el lugar, el cliente y nuestra manera de
              entender el habitar. Nos interesa la permanencia de los materiales, la calidad de
              la luz natural y la relación entre interior y exterior.
            </p>
            <p>
              Nuestro trabajo abarca desde residencias particulares y hoteles boutique hasta
              espacios comerciales y proyectos de interiorismo. En todos los casos, el proceso
              creativo parte de escuchar profundamente al cliente y al sitio.
            </p>
            <div className="pt-4">
              <Link
                href="/estudio"
                className="text-xs tracking-widest uppercase font-light text-ink border-b border-ink pb-1 hover:opacity-60 transition-opacity"
              >
                Conocer el estudio
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12 lg:mb-16">
          <h2 className="text-xs tracking-widest uppercase font-light text-meta">
            Proyectos Seleccionados
          </h2>
          <Link
            href="/proyectos"
            className="text-xs tracking-widest uppercase font-light text-ink hover:opacity-60 transition-opacity"
          >
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          {featuredProjects.map((proyecto) => (
            <ProjectCard key={proyecto.id} proyecto={proyecto} />
          ))}
        </div>
      </section>

      {/* Visual Lab Teaser */}
      <section className="w-full bg-dark py-24 lg:py-40 mt-16">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-meta text-xs tracking-widest uppercase font-light mb-6">
                Visual Lab
              </p>
              <h2 className="text-cream font-light text-4xl lg:text-5xl leading-tight mb-8">
                Vive tu proyecto<br />
                antes de construirlo
              </h2>
              <p className="text-cream/60 font-light leading-relaxed mb-10 max-w-md">
                Utilizamos tecnología de realidad virtual para que nuestros clientes puedan
                recorrer y experimentar sus proyectos en escala 1:1 antes de que comience
                la construcción.
              </p>
              <Link
                href="/visual-lab"
                className="text-xs tracking-widest uppercase font-light text-cream border border-cream/40 px-8 py-4 hover:bg-cream hover:text-dark transition-all duration-300 inline-block"
              >
                Descubrir Visual Lab
              </Link>
            </div>
            <div className="aspect-[4/3] bg-gray-800 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-gray-900 via-gray-700 to-gray-800" />
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-cream/20 text-xs tracking-widest uppercase font-light">
                  VR Experience
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real Estate Teaser */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-24 lg:py-40">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          <div className="lg:col-span-2">
            <p className="text-meta text-xs tracking-widest uppercase font-light mb-6">
              Real Estate
            </p>
            <h2 className="text-ink font-light text-4xl lg:text-5xl leading-tight mb-8">
              Propiedades con<br />criterio arquitectónico
            </h2>
            <p className="text-ink/60 font-light leading-relaxed mb-10 max-w-xl">
              Seleccionamos y presentamos propiedades residenciales y comerciales de alta calidad
              en las mejores ubicaciones de México. Nuestro criterio arquitectónico garantiza
              que cada propiedad ofrezca valor tanto estético como de inversión.
            </p>
            <Link
              href="/real-estate"
              className="text-xs tracking-widest uppercase font-light text-ink border-b border-ink pb-1 hover:opacity-60 transition-opacity inline-block"
            >
              Ver propiedades →
            </Link>
          </div>
          <div className="space-y-6">
            <div className="aspect-square bg-gray-200 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300" />
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="border-t border-ink/10">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-24 lg:py-32 text-center">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-6">
            Hablemos
          </p>
          <h2 className="text-ink font-light text-4xl lg:text-6xl leading-tight mb-10">
            ¿Tienes un proyecto<br />en mente?
          </h2>
          <Link
            href="/contacto"
            className="text-xs tracking-widest uppercase font-light text-cream bg-ink px-10 py-4 hover:opacity-80 transition-opacity inline-block"
          >
            Iniciar conversación
          </Link>
        </div>
      </section>
    </>
  )
}
