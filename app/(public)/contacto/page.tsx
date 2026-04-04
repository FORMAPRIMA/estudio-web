'use client'

import { useState } from 'react'

export default function ContactoPage() {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    asunto: '',
    mensaje: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    console.log('Contact form submitted:', formData)
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <>
      {/* Header */}
      <section className="pt-32 lg:pt-40 pb-16 lg:pb-24 max-w-screen-xl mx-auto px-6 lg:px-12">
        <div className="border-b border-ink/10 pb-12">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-4">
            Hablemos
          </p>
          <h1 className="text-ink font-light text-6xl lg:text-8xl tracking-wide">
            Contacto
          </h1>
        </div>
      </section>

      <section className="max-w-screen-xl mx-auto px-6 lg:px-12 pb-24 lg:pb-40">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Contact Info */}
          <div className="space-y-12">
            <div>
              <p className="text-meta text-xs tracking-widest uppercase font-light mb-6">
                Estudio
              </p>
              <address className="not-italic text-ink/70 font-light leading-relaxed space-y-2">
                <p className="text-ink font-light">Forma Prima</p>
                <p>Av. Presidente Masaryk 111, Piso 8</p>
                <p>Polanco, Ciudad de México</p>
                <p>C.P. 11560, México</p>
              </address>
            </div>

            <div>
              <p className="text-meta text-xs tracking-widest uppercase font-light mb-6">
                Contacto directo
              </p>
              <div className="space-y-3 text-ink/70 font-light">
                <p>
                  <a
                    href="mailto:hola@formaprima.mx"
                    className="hover:text-ink transition-colors"
                  >
                    hola@formaprima.mx
                  </a>
                </p>
                <p>
                  <a href="tel:+525512345678" className="hover:text-ink transition-colors">
                    +52 55 1234 5678
                  </a>
                </p>
              </div>
            </div>

            <div>
              <p className="text-meta text-xs tracking-widest uppercase font-light mb-6">
                Horario de atención
              </p>
              <div className="space-y-2 text-ink/70 font-light text-sm">
                <p>Lunes a Viernes</p>
                <p>9:00 — 18:00 hrs (GMT-6)</p>
              </div>
            </div>

            {/* Map Placeholder */}
            <div>
              <p className="text-meta text-xs tracking-widest uppercase font-light mb-4">
                Ubicación
              </p>
              <div className="w-full h-56 bg-gray-200 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-meta text-xs tracking-widest uppercase font-light">
                    Mapa · Polanco, CDMX
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <p className="text-meta text-xs tracking-widest uppercase font-light mb-8">
              Enviar mensaje
            </p>

            {submitted ? (
              <div className="border border-ink/10 p-10 text-center">
                <p className="text-ink font-light text-2xl mb-4">
                  Mensaje enviado
                </p>
                <p className="text-meta font-light text-sm leading-relaxed">
                  Gracias por contactarnos. Revisaremos tu mensaje y te responderemos
                  en un plazo máximo de 48 horas hábiles.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
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

                <div>
                  <label className="text-xs tracking-widest uppercase font-light text-meta block mb-2">
                    Asunto *
                  </label>
                  <select
                    name="asunto"
                    value={formData.asunto}
                    onChange={handleChange}
                    required
                    className="w-full border border-ink/20 bg-cream px-4 py-3 text-ink font-light text-sm focus:outline-none focus:border-ink transition-colors"
                  >
                    <option value="">Selecciona un asunto</option>
                    <option value="proyecto-nuevo">Nuevo proyecto de arquitectura</option>
                    <option value="interiorismo">Proyecto de interiorismo</option>
                    <option value="visual-lab">Visual Lab / Realidad Virtual</option>
                    <option value="real-estate">Consulta sobre propiedad</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs tracking-widest uppercase font-light text-meta block mb-2">
                    Mensaje *
                  </label>
                  <textarea
                    name="mensaje"
                    value={formData.mensaje}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="w-full border border-ink/20 bg-transparent px-4 py-3 text-ink font-light text-sm focus:outline-none focus:border-ink transition-colors resize-none"
                    placeholder="Cuéntanos sobre tu proyecto, idea o consulta..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-ink text-cream text-xs tracking-widest uppercase font-light py-4 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar mensaje'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
