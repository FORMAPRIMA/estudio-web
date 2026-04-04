import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { proyectosMock } from '@/lib/data/mock'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return proyectosMock.map((proyecto) => ({
    slug: proyecto.slug,
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const proyecto = proyectosMock.find((p) => p.slug === slug)
  if (!proyecto) return { title: 'Proyecto no encontrado' }
  return {
    title: proyecto.nombre,
    description: proyecto.descripcion,
  }
}

export default async function ProyectoDetailPage({ params }: Props) {
  const { slug } = await params
  const proyecto = proyectosMock.find((p) => p.slug === slug)

  if (!proyecto) notFound()

  return (
    <>
      {/* Hero Image */}
      <section className="w-full h-screen bg-dark relative">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-dark/60" />
        <div className="absolute bottom-0 left-0 right-0 max-w-screen-xl mx-auto px-6 lg:px-12 pb-12 z-10">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-3">
            {proyecto.tipologia}
          </p>
          <h1 className="text-cream font-light text-5xl lg:text-7xl tracking-wide">
            {proyecto.nombre}
          </h1>
        </div>
      </section>

      {/* Project Metadata */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-12 lg:py-16 border-b border-ink/10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <p className="text-meta text-xs tracking-widest uppercase font-light mb-2">Proyecto</p>
            <p className="text-ink font-light">{proyecto.nombre}</p>
          </div>
          <div>
            <p className="text-meta text-xs tracking-widest uppercase font-light mb-2">Ubicación</p>
            <p className="text-ink font-light">{proyecto.ubicacion}</p>
          </div>
          <div>
            <p className="text-meta text-xs tracking-widest uppercase font-light mb-2">Año</p>
            <p className="text-ink font-light">{proyecto.año}</p>
          </div>
          <div>
            <p className="text-meta text-xs tracking-widest uppercase font-light mb-2">Tipología</p>
            <p className="text-ink font-light">{proyecto.tipologia}</p>
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-xs tracking-widest uppercase font-light text-meta mb-6">
              Sobre el proyecto
            </h2>
            <p className="text-ink/70 font-light leading-relaxed text-lg">
              {proyecto.descripcion}
            </p>
            <p className="text-ink/60 font-light leading-relaxed mt-6">
              El proyecto fue concebido como una respuesta directa al lugar y al programa solicitado
              por el cliente. La materialidad fue cuidadosamente seleccionada para crear una paleta
              coherente que dialogue con el entorno inmediato.
            </p>
            <p className="text-ink/60 font-light leading-relaxed mt-4">
              Los espacios de transición —accesos, pasillos, umbrales— reciben especial atención
              en el diseño, entendiendo que son ellos los que crean la narrativa espacial del recorrido.
              La luz natural es el recurso principal de composición a lo largo de todo el día.
            </p>
          </div>
          <div className="space-y-6">
            <div className="aspect-[3/4] bg-gray-200 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300" />
            </div>
          </div>
        </div>
      </section>

      {/* Image Gallery */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-16 lg:pb-24">
        <p className="text-meta text-xs tracking-widest uppercase font-light mb-8">
          Galería
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div className="aspect-[4/3] bg-gray-200 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-300 to-gray-200" />
          </div>
          <div className="aspect-[4/3] bg-gray-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tl from-gray-200 via-gray-300 to-gray-400" />
          </div>
          <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden lg:col-span-2">
            <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100" />
          </div>
          <div className="aspect-[4/3] bg-gray-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-bl from-gray-300 via-gray-200 to-gray-300" />
          </div>
          <div className="aspect-[4/3] bg-gray-200 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-gray-100 via-gray-300 to-gray-200" />
          </div>
        </div>
      </section>

      {/* Navigation */}
      <section className="border-t border-ink/10">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-10 flex justify-between items-center">
          <Link
            href="/proyectos"
            className="text-xs tracking-widest uppercase font-light text-meta hover:text-ink transition-colors"
          >
            ← Todos los proyectos
          </Link>
          <Link
            href="/contacto"
            className="text-xs tracking-widest uppercase font-light text-ink border-b border-ink pb-1 hover:opacity-60 transition-opacity"
          >
            Iniciar proyecto →
          </Link>
        </div>
      </section>
    </>
  )
}
