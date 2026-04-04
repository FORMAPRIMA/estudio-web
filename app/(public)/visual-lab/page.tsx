import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Visual Lab',
  description: 'Tecnología de realidad virtual para experimentar proyectos de arquitectura antes de construirlos.',
}

const pasos = [
  {
    numero: '01',
    titulo: 'Modelado 3D de precisión',
    descripcion:
      'A partir de los planos arquitectónicos y de interiores, construimos un modelo digital de alta fidelidad que incluye materiales, texturas, mobiliario e iluminación.',
  },
  {
    numero: '02',
    titulo: 'Renderizado en tiempo real',
    descripcion:
      'Utilizamos motores de renderizado en tiempo real (Unreal Engine y Twinmotion) para crear entornos inmersivos que responden instantáneamente al movimiento del usuario.',
  },
  {
    numero: '03',
    titulo: 'Sesión de recorrido virtual',
    descripcion:
      'En nuestras instalaciones o a domicilio, el cliente se equipa con visor VR de última generación y recorre su proyecto en escala 1:1, pudiendo explorar cada rincón.',
  },
  {
    numero: '04',
    titulo: 'Ajustes y validación',
    descripcion:
      'La experiencia VR permite detectar oportunidades de mejora antes de la construcción. Hacemos los cambios en el modelo y los validamos en una segunda sesión.',
  },
]

const beneficios = [
  {
    titulo: 'Decisiones más informadas',
    descripcion:
      'Ver el espacio en escala real elimina la brecha entre la abstracción del plano y la realidad construida. Los clientes toman decisiones con mayor confianza.',
  },
  {
    titulo: 'Reducción de cambios en obra',
    descripcion:
      'Los cambios identificados en fase de diseño virtual cuestan una fracción de lo que costarían durante la construcción. Ahorro significativo en tiempo y presupuesto.',
  },
  {
    titulo: 'Validación de materiales',
    descripcion:
      'Probamos diferentes opciones de materiales, acabados y colores en el contexto real del espacio, sin la necesidad de producir muestras físicas para cada variante.',
  },
  {
    titulo: 'Presentaciones de alto impacto',
    descripcion:
      'Para proyectos en preventa o con múltiples stakeholders, la experiencia VR es una herramienta de comunicación extraordinariamente efectiva.',
  },
]

export default function VisualLabPage() {
  return (
    <>
      {/* Hero */}
      <section className="w-full min-h-screen bg-dark flex items-end relative">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-dark/80" />
        <div className="relative z-10 max-w-screen-xl mx-auto px-6 lg:px-12 pb-24 lg:pb-40 w-full">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-6">
            Forma Prima · Visual Lab
          </p>
          <h1 className="text-cream font-light text-5xl lg:text-8xl leading-none mb-8 max-w-3xl">
            El futuro de<br />
            la presentación<br />
            arquitectónica
          </h1>
          <p className="text-cream/60 font-light leading-relaxed max-w-xl">
            Recorre tu proyecto en realidad virtual antes de que comience la construcción.
            Experimenta los espacios, la luz, los materiales y las proporciones en escala 1:1.
          </p>
        </div>
      </section>

      {/* Explanation */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-24 lg:py-40">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div>
            <h2 className="text-ink font-light text-3xl lg:text-4xl leading-tight mb-8">
              Arquitectura que puedes<br />
              <em>habitar</em> antes de existir
            </h2>
            <div className="space-y-6 text-ink/70 font-light leading-relaxed">
              <p>
                Visual Lab es el departamento de visualización avanzada de Forma Prima. Combinamos
                los más recientes avances en renderizado en tiempo real con hardware de realidad
                virtual de última generación para ofrecer a nuestros clientes una experiencia
                sin precedentes.
              </p>
              <p>
                La tecnología que utilizamos —basada en Unreal Engine y visores Meta Quest Pro y
                Apple Vision Pro— produce imágenes fotorrealistas con iluminación dinámica,
                texturas de alta resolución y física de materiales precisa.
              </p>
              <p>
                Esta herramienta no es un lujo decorativo: es un instrumento de trabajo que
                mejora la calidad de las decisiones de diseño y reduce significativamente los
                costos derivados de cambios en obra.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="aspect-[4/3] bg-gray-800 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900" />
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-cream/20 text-xs tracking-widest uppercase font-light">
                  Visual Lab Experience
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="bg-dark py-24 lg:py-40">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-12">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-16">
            Proceso
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {pasos.map((paso) => (
              <div key={paso.numero} className="border-t border-cream/10 pt-8">
                <span className="text-meta text-xs tracking-widest font-light block mb-4">
                  {paso.numero}
                </span>
                <h3 className="text-cream font-light text-lg mb-4">{paso.titulo}</h3>
                <p className="text-cream/50 font-light text-sm leading-relaxed">
                  {paso.descripcion}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-24 lg:py-40">
        <p className="text-meta text-xs tracking-widest uppercase font-light mb-16">
          Beneficios
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-12">
          {beneficios.map((beneficio) => (
            <div key={beneficio.titulo} className="flex gap-8">
              <div className="w-px bg-ink/10 shrink-0" />
              <div>
                <h3 className="text-ink font-light text-lg mb-3">{beneficio.titulo}</h3>
                <p className="text-ink/60 font-light text-sm leading-relaxed">
                  {beneficio.descripcion}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Visual Examples */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-16 lg:pb-24">
        <p className="text-meta text-xs tracking-widest uppercase font-light mb-8">
          Ejemplos visuales
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-[4/3] bg-gray-300 relative overflow-hidden">
              <div
                className={`absolute inset-0 ${
                  i % 3 === 0
                    ? 'bg-gradient-to-br from-gray-700 to-gray-900'
                    : i % 3 === 1
                    ? 'bg-gradient-to-tl from-gray-200 to-gray-400'
                    : 'bg-gradient-to-r from-gray-300 to-gray-500'
                }`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-ink/10">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-24 lg:py-32 text-center">
          <h2 className="text-ink font-light text-4xl lg:text-5xl mb-4">
            ¿Listo para experimentar<br />tu proyecto?
          </h2>
          <p className="text-meta font-light mb-10 text-sm tracking-wider">
            Agenda una sesión de demostración sin compromiso.
          </p>
          <Link
            href="/contacto"
            className="text-xs tracking-widest uppercase font-light text-cream bg-dark px-10 py-4 hover:opacity-80 transition-opacity inline-block"
          >
            Agendar sesión VR
          </Link>
        </div>
      </section>
    </>
  )
}
