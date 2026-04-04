'use client'

import { useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { propiedadesMock } from '@/lib/data/mock'
import { use } from 'react'

interface Props {
  params: Promise<{ slug: string }>
}

function formatPrice(precio: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(precio)
}

export default function PropiedadDetailPage({ params }: Props) {
  const { slug } = use(params)
  const propiedad = propiedadesMock.find((p) => p.slug === slug)

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    mensaje: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!propiedad) notFound()

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Mock submission
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log('Lead submitted:', { ...formData, propiedad_id: propiedad.id })
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <>
      {/* Hero */}
      <section className="w-full h-[70vh] bg-dark relative">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-dark/60" />
        <div className="absolute bottom-0 left-0 right-0 max-w-screen-xl mx-auto px-6 lg:px-12 pb-12 z-10">
          {propiedad.disponible ? (
            <span className="inline-block text-xs tracking-widest uppercase font-light bg-cream text-ink px-3 py-1 mb-4">
              Disponible
            </span>
          ) : (
            <span className="inline-block text-xs tracking-widest uppercase font-light bg-meta text-cream px-3 py-1 mb-4">
              Reservada
            </span>
          )}
          <h1 className="text-cream font-light text-4xl lg:text-6xl tracking-wide">
            {propiedad.nombre}
          </h1>
        </div>
      </section>

      {/* Property Details */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-12 lg:py-16 border-b border-ink/10">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
          <div>
            <p className="text-meta text-xs tracking-widest uppercase font-light mb-2">Ubicación</p>
            <p className="text-ink font-light">{propiedad.ubicacion}</p>
          </div>
          <div>
            <p className="text-meta text-xs tracking-widest uppercase font-light mb-2">Precio</p>
            <p className="text-ink font-light text-xl">{formatPrice(propiedad.precio)}</p>
          </div>
          <div>
            <p className="text-meta text-xs tracking-widest uppercase font-light mb-2">Estado</p>
            <p className="text-ink font-light">
              {propiedad.disponible ? 'Disponible' : 'Reservada'}
            </p>
          </div>
        </div>
      </section>

      {/* Description & Gallery */}
      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <p className="text-meta text-xs tracking-widest uppercase font-light mb-6">
              Descripción
            </p>
            <p className="text-ink/70 font-light leading-relaxed text-lg mb-6">
              {propiedad.descripcion}
            </p>
            <p className="text-ink/60 font-light leading-relaxed">
              Esta propiedad ha sido seleccionada por nuestro equipo como una oportunidad
              destacada que cumple con los estándares arquitectónicos y de calidad de Forma Prima.
              El inmueble ofrece una combinación excepcional de ubicación, diseño y valor
              de inversión a largo plazo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square bg-gray-200 relative overflow-hidden">
                <div
                  className={`absolute inset-0 ${
                    i % 2 === 0
                      ? 'bg-gradient-to-br from-gray-200 to-gray-300'
                      : 'bg-gradient-to-tl from-gray-100 to-gray-300'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Capture Form */}
      <section className="bg-cream border-t border-ink/10">
        <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
          <div className="max-w-2xl mx-auto">
            <p className="text-meta text-xs tracking-widest uppercase font-light mb-4 text-center">
              Mostrar interés
            </p>
            <h2 className="text-ink font-light text-3xl lg:text-4xl text-center mb-12">
              ¿Te interesa esta propiedad?
            </h2>

            {submitted ? (
              <div className="text-center py-16 border border-ink/10">
                <p className="text-ink font-light text-2xl mb-4">¡Gracias por tu interés!</p>
                <p className="text-meta font-light text-sm mb-8">
                  Nos pondremos en contacto contigo a la brevedad para darte más información
                  sobre {propiedad.nombre}.
                </p>
                <Link
                  href="/real-estate"
                  className="text-xs tracking-widest uppercase font-light text-ink border-b border-ink pb-1 hover:opacity-60 transition-opacity"
                >
                  Ver más propiedades
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs tracking-widest uppercase font-light text-meta block mb-2">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      required
                      className="w-full border border-ink/20 bg-transparent px-4 py-3 text-ink font-light text-sm focus:outline-none focus:border-ink transition-colors"
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase font-light text-meta block mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full border border-ink/20 bg-transparent px-4 py-3 text-ink font-light text-sm focus:outline-none focus:border-ink transition-colors"
                      placeholder="tu@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs tracking-widest uppercase font-light text-meta block mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    className="w-full border border-ink/20 bg-transparent px-4 py-3 text-ink font-light text-sm focus:outline-none focus:border-ink transition-colors"
                    placeholder="+52 55 0000 0000"
                  />
                </div>
                <div>
                  <label className="text-xs tracking-widest uppercase font-light text-meta block mb-2">
                    Mensaje
                  </label>
                  <textarea
                    name="mensaje"
                    value={formData.mensaje}
                    onChange={handleChange}
                    rows={4}
                    className="w-full border border-ink/20 bg-transparent px-4 py-3 text-ink font-light text-sm focus:outline-none focus:border-ink transition-colors resize-none"
                    placeholder="¿Tienes alguna pregunta específica sobre la propiedad?"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-ink text-cream text-xs tracking-widest uppercase font-light py-4 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar solicitud de información'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Back link */}
      <div className="max-w-screen-xl mx-auto px-6 lg:px-12 py-8 border-t border-ink/10">
        <Link
          href="/real-estate"
          className="text-xs tracking-widest uppercase font-light text-meta hover:text-ink transition-colors"
        >
          ← Todas las propiedades
        </Link>
      </div>
    </>
  )
}
