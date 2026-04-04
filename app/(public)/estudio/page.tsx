import type { Metadata } from 'next'
import { equipoMock } from '@/lib/data/mock'

export const metadata: Metadata = {
  title: 'Estudio',
  description: 'Conoce a Forma Prima, estudio de arquitectura e interiorismo con base en Ciudad de México.',
}

const valores = [
  {
    titulo: 'Rigor Técnico',
    descripcion:
      'Cada decisión proyectual está respaldada por un dominio profundo de la técnica constructiva, los materiales y las normativas. La belleza sin solidez técnica no nos interesa.',
  },
  {
    titulo: 'Sensibilidad Contextual',
    descripcion:
      'Escuchamos el lugar antes de intervenir. La geografía, el clima, la historia y la cultura del sitio informan cada proyecto. Nunca imponemos una imagen preconcebida.',
  },
  {
    titulo: 'Colaboración Auténtica',
    descripcion:
      'Trabajamos en estrecha colaboración con nuestros clientes, entendiéndolos como coautores del proyecto. El resultado debe reflejar su manera de vivir, no la nuestra.',
  },
  {
    titulo: 'Permanencia',
    descripcion:
      'Diseñamos para durar. Elegimos materiales honestos que envejecen con dignidad y espacios que se adaptan a los cambios de vida sin perder su esencia.',
  },
]

export default function EstudioPage() {
  return (
    <>
      {/* Header */}
      <section className="pt-32 lg:pt-40 pb-16 lg:pb-24 max-w-screen-xl mx-auto px-6 lg:px-12">
        <div className="border-b border-ink/10 pb-12">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-4">
            Quiénes somos
          </p>
          <h1 className="text-ink font-light text-6xl lg:text-8xl tracking-wide">
            Estudio
          </h1>
        </div>
      </section>

      {/* Studio Story */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div className="aspect-[3/4] bg-gray-200 relative overflow-hidden sticky top-24">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300" />
          </div>
          <div className="space-y-8">
            <h2 className="text-ink font-light text-3xl lg:text-4xl leading-tight">
              Un estudio fundado sobre la convicción de que la arquitectura<br />
              <em>transforma la vida de las personas</em>.
            </h2>
            <div className="space-y-6 text-ink/70 font-light leading-relaxed">
              <p>
                Forma Prima nació en 2015 de la asociación entre Ana Lorena García y Carlos Mendoza,
                dos arquitectos que compartían una visión: crear espacios que honren tanto al habitante
                como al lugar. Desde entonces, el estudio ha crecido para incluir un equipo
                multidisciplinario de arquitectos, diseñadores de interiores y especialistas en
                visualización digital.
              </p>
              <p>
                Nuestra práctica abarca proyectos de muy diversa escala y tipología: desde la
                remodelación íntima de un apartamento hasta el diseño de un hotel boutique de
                nueva planta. En todos los casos, el proceso creativo parte de la misma premisa:
                comprender profundamente el contexto —físico, cultural y humano— antes de trazar
                la primera línea.
              </p>
              <p>
                Trabajamos principalmente en México, aunque hemos desarrollado proyectos en
                España y Guatemala. Creemos en el valor de lo local: en los materiales regionales,
                en los oficios artesanales, en la arquitectura vernácula como fuente de inspiración
                contemporánea.
              </p>
              <p>
                En 2022 incorporamos el departamento de Visual Lab, una plataforma de visualización
                avanzada que permite a nuestros clientes experimentar sus proyectos en realidad virtual
                antes de la construcción. Esta herramienta ha transformado la manera en que tomamos
                decisiones de diseño colectivamente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16 lg:py-24 border-t border-ink/10">
        <p className="text-meta text-xs tracking-widest uppercase font-light mb-16">
          Equipo fundador
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
          {equipoMock.map((miembro) => (
            <div key={miembro.id}>
              {/* Photo placeholder */}
              <div className="aspect-[3/4] bg-gray-200 mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-gray-100 via-gray-200 to-gray-300" />
              </div>
              <h3 className="text-ink font-light text-lg mb-1">{miembro.nombre}</h3>
              <p className="text-meta text-xs tracking-widest uppercase font-light mb-4">
                {miembro.rol}
              </p>
              <p className="text-ink/60 font-light text-sm leading-relaxed">
                {miembro.bio}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-dark py-24 lg:py-40 mt-8">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-16">
            Nuestra aproximación
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
            {valores.map((valor) => (
              <div key={valor.titulo} className="border-t border-cream/10 pt-8">
                <h3 className="text-cream font-light text-xl mb-4">{valor.titulo}</h3>
                <p className="text-cream/50 font-light leading-relaxed text-sm">
                  {valor.descripcion}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Awards/Recognition */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
        <p className="text-meta text-xs tracking-widest uppercase font-light mb-12">
          Reconocimientos
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            { año: '2023', premio: 'Premio IMCYC de Arquitectura', categoria: 'Categoría Residencial' },
            { año: '2022', premio: 'Architectural Digest Mexico AD100', categoria: 'Estudio emergente' },
            { año: '2022', premio: 'Premio Nacional de Arquitectura', categoria: 'Mención honorífica' },
            { año: '2021', premio: 'ArchDaily México Building of the Year', categoria: 'Hospitalidad' },
          ].map((item) => (
            <div key={item.premio} className="flex gap-8 border-b border-ink/10 pb-6">
              <span className="text-meta text-xs tracking-widest font-light w-12 shrink-0">
                {item.año}
              </span>
              <div>
                <p className="text-ink font-light mb-1">{item.premio}</p>
                <p className="text-meta text-xs tracking-widest uppercase font-light">
                  {item.categoria}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
