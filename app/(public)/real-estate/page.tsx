import type { Metadata } from 'next'
import PropertyCard from '@/components/ui/PropertyCard'
import { propiedadesMock } from '@/lib/data/mock'

export const metadata: Metadata = {
  title: 'Real Estate',
  description: 'Propiedades residenciales y comerciales seleccionadas con criterio arquitectónico.',
}

export default function RealEstatePage() {
  return (
    <>
      {/* Header */}
      <section className="pt-32 lg:pt-40 pb-16 lg:pb-24 max-w-screen-xl mx-auto px-6 lg:px-12">
        <div className="border-b border-ink/10 pb-12">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-4">
            Propiedades
          </p>
          <h1 className="text-ink font-light text-6xl lg:text-8xl tracking-wide">
            Real Estate
          </h1>
        </div>
      </section>

      {/* Explanation */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-16 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div className="space-y-6 text-ink/70 font-light leading-relaxed">
            <p className="text-ink text-2xl font-light leading-relaxed">
              Propiedades seleccionadas con el mismo criterio con que diseñamos arquitectura.
            </p>
            <p>
              Forma Prima actúa como agente de referidos en la comercialización de propiedades
              residenciales y comerciales de alta calidad. No somos una inmobiliaria tradicional:
              seleccionamos únicamente propiedades que cumplen con estándares arquitectónicos
              y de calidad que consideramos relevantes.
            </p>
            <p>
              Nuestro servicio es completamente gratuito para el comprador. Trabajamos con una
              estructura de comisión de referido pagada por el desarrollador o vendedor al
              concretarse la operación.
            </p>
            <p>
              Si te interesa alguna de las propiedades listadas, te conectamos directamente
              con el desarrollador y podemos acompañarte en el proceso con nuestra visión
              arquitectónica y de interiorismo.
            </p>
          </div>
          <div className="bg-cream border border-ink/10 p-8">
            <p className="text-xs tracking-widest uppercase font-light text-meta mb-4">
              Modelo de trabajo
            </p>
            <ul className="space-y-4">
              {[
                'Selección curada de propiedades con criterio arquitectónico',
                'Servicio gratuito para el comprador',
                'Comisión de referido pagada por el vendedor',
                'Acompañamiento arquitectónico en la decisión de compra',
                'Posibilidad de personalización e interiorismo con nuestro estudio',
              ].map((item) => (
                <li key={item} className="flex gap-3 text-ink/70 font-light text-sm">
                  <span className="text-meta mt-0.5">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Properties Grid */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-24 lg:pb-40">
        <div className="flex items-end justify-between mb-12 border-t border-ink/10 pt-12">
          <p className="text-meta text-xs tracking-widest uppercase font-light">
            {propiedadesMock.length} propiedades disponibles
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-12">
          {propiedadesMock.map((propiedad) => (
            <PropertyCard key={propiedad.id} propiedad={propiedad} />
          ))}
        </div>
      </section>
    </>
  )
}
