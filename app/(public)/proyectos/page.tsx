import type { Metadata } from 'next'
import ProjectCard from '@/components/ui/ProjectCard'
import { proyectosMock } from '@/lib/data/mock'

export const metadata: Metadata = {
  title: 'Proyectos',
  description: 'Portafolio de proyectos de arquitectura e interiorismo de Forma Prima.',
}

const tipologias = ['Todos', 'Residencial', 'Comercial', 'Interiorismo', 'Hospitalidad']

export default function ProyectosPage() {
  return (
    <>
      {/* Page Header */}
      <section className="pt-32 lg:pt-40 pb-16 lg:pb-24 max-w-screen-xl mx-auto px-6 lg:px-12">
        <div className="border-b border-ink/10 pb-12">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-4">
            Portafolio
          </p>
          <h1 className="text-ink font-light text-6xl lg:text-8xl tracking-wide">
            Proyectos
          </h1>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 mb-12">
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-meta text-xs tracking-widest uppercase font-light mr-2">
            Tipología:
          </span>
          {tipologias.map((tipologia) => (
            <button
              key={tipologia}
              className={`text-xs tracking-widest uppercase font-light px-4 py-2 border transition-all duration-200 ${
                tipologia === 'Todos'
                  ? 'border-ink bg-ink text-cream'
                  : 'border-ink/20 text-meta hover:border-ink hover:text-ink'
              }`}
            >
              {tipologia}
            </button>
          ))}
        </div>
      </section>

      {/* Projects Grid */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-24 lg:pb-40">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          {proyectosMock.map((proyecto) => (
            <ProjectCard key={proyecto.id} proyecto={proyecto} />
          ))}
        </div>
      </section>
    </>
  )
}
