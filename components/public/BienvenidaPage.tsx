'use client'

import { useState, useEffect } from 'react'
import { submitBienvenidaForm } from '@/app/actions/bienvenida'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Socio {
  nombre: string
  titulo: string
  bio: string
}

interface Studio {
  nombre: string
  tagline: string
  descripcion: string
  fundacion: string
  proyectos: string
  ciudades: string
  socios: Socio[]
}

interface Props {
  nombreCliente: string
  token: string
  studio: Studio
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(nombre: string) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function inp(): React.CSSProperties {
  return {
    padding: '10px 14px',
    border: '1px solid #E5E2DA',
    borderRadius: 4,
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#fff',
    color: '#1A1A1A',
    outline: 'none',
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BienvenidaPage({ nombreCliente, token, studio }: Props) {
  const [isMobile, setIsMobile] = useState(false)

  // Form state
  const [nombre, setNombre] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [interes, setInteres] = useState('')
  const [origen, setOrigen] = useState('')
  const [notas, setNotas] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)
    const res = await submitBienvenidaForm(token, {
      nombre,
      apellidos,
      email,
      telefono,
      empresa: empresa || undefined,
      interes: interes || undefined,
      notas: notas || undefined,
    })
    setIsSubmitting(false)
    if ('error' in res) {
      setSubmitError(res.error)
    } else {
      setSubmitted(true)
    }
  }

  const containerStyle: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, sans-serif",
    background: '#F8F6F1',
    color: '#1A1A1A',
    margin: 0,
    padding: 0,
  }

  const sectionWrap = (maxW = 1100): React.CSSProperties => ({
    maxWidth: maxW,
    margin: '0 auto',
  })

  return (
    <>
      {/* Inject keyframe animation */}
      <style>{`
        @keyframes bv-bounce {
          0%, 100% { opacity: 0.35; transform: translateY(0); }
          50% { opacity: 0.6; transform: translateY(6px); }
        }
        @keyframes bv-gallery-hide-scrollbar {
          from {} to {}
        }
        .bv-gallery::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={containerStyle}>

        {/* ── Section 1: Hero ── */}
        <section
          style={{
            background: '#1A1A1A',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 24px 80px',
            position: 'relative',
            textAlign: 'center',
          }}
        >
          {/* Logo */}
          <p
            style={{
              fontSize: 28,
              fontWeight: 200,
              letterSpacing: '0.25em',
              color: '#fff',
              margin: '0 0 0',
            }}
          >
            FORMA PRIMA
          </p>

          {/* Thin rule */}
          <div
            style={{
              width: 60,
              height: 1,
              background: 'rgba(255,255,255,0.2)',
              margin: '24px auto',
            }}
          />

          {/* Greeting */}
          <h1
            style={{
              fontSize: isMobile ? 28 : 42,
              fontWeight: 200,
              color: '#fff',
              letterSpacing: '-0.02em',
              margin: '0 0 20px',
              lineHeight: 1.2,
            }}
          >
            Hola, {nombreCliente}.
          </h1>

          {/* Subtitle */}
          <p
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 16,
              maxWidth: 480,
              margin: '0 auto',
              lineHeight: 1.7,
              textAlign: 'center',
            }}
          >
            Nos alegra que estés aquí. Queremos presentarte quiénes somos y cómo trabajamos antes de dar cualquier paso.
          </p>

          {/* Scroll indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 22,
              color: 'rgba(255,255,255,0.4)',
              animation: 'bv-bounce 2s ease-in-out infinite',
              userSelect: 'none',
            }}
          >
            ▾
          </div>
        </section>

        {/* ── Section 2: Studio intro ── */}
        <section style={{ padding: '80px 24px', background: '#F8F6F1' }}>
          <div style={sectionWrap()}>
            {/* Label */}
            <p
              style={{
                fontSize: 10,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#D85A30',
                marginBottom: 16,
                fontWeight: 500,
              }}
            >
              ESTUDIO
            </p>

            {/* Title */}
            <h2
              style={{
                fontSize: isMobile ? 24 : 32,
                fontWeight: 300,
                color: '#1A1A1A',
                maxWidth: 560,
                margin: '0 0 24px',
                lineHeight: 1.3,
              }}
            >
              Diseñamos espacios que transforman vidas.
            </h2>

            {/* Description */}
            <p
              style={{
                fontSize: 15,
                color: '#555',
                lineHeight: 1.8,
                maxWidth: 640,
                margin: '0 0 48px',
              }}
            >
              {studio.descripcion}
            </p>

            {/* Stats */}
            <div
              style={{
                display: 'flex',
                gap: isMobile ? 24 : 48,
                flexWrap: 'wrap',
              }}
            >
              {[
                { value: studio.proyectos, label: 'Proyectos' },
                { value: studio.fundacion, label: 'Año fundación' },
                { value: studio.ciudades, label: 'Presencia' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p
                    style={{
                      fontSize: 28,
                      fontWeight: 200,
                      color: '#D85A30',
                      margin: '0 0 4px',
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: '#888',
                      margin: 0,
                    }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 3: Gallery ── */}
        <section style={{ background: '#1A1A1A', padding: 0 }}>
          <p
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.4)',
              padding: '40px 40px 16px',
              margin: 0,
            }}
          >
            PROYECTOS RECIENTES
          </p>
          <div
            className="bv-gallery"
            style={{
              display: 'flex',
              overflowX: 'auto',
              gap: 2,
              scrollbarWidth: 'none',
            }}
          >
            {(['#2A2A2A', '#3A3530', '#4A3F38', '#2E2825', '#352F2A', '#3F3830'] as const).map(
              (bg, i) => (
                <div
                  key={i}
                  style={{
                    background: bg,
                    aspectRatio: '4/3',
                    minWidth: 320,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.4)',
                      opacity: 0.4,
                    }}
                  >
                    Próximamente: galería de proyectos
                  </span>
                </div>
              )
            )}
          </div>
        </section>

        {/* ── Section 4: Socios ── */}
        <section style={{ padding: '80px 24px', background: '#F8F6F1' }}>
          <div style={sectionWrap()}>
            <p
              style={{
                fontSize: 10,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#D85A30',
                marginBottom: 16,
                fontWeight: 500,
              }}
            >
              EL EQUIPO
            </p>
            <h2
              style={{
                fontSize: isMobile ? 22 : 28,
                fontWeight: 300,
                color: '#1A1A1A',
                margin: '0 0 40px',
              }}
            >
              Con quienes vas a trabajar
            </h2>

            <div
              style={{
                display: 'flex',
                gap: 20,
                flexWrap: 'wrap',
              }}
            >
              {studio.socios.map((socio) => (
                <div
                  key={socio.nombre}
                  style={{
                    background: '#fff',
                    border: '1px solid #E5E2DA',
                    borderRadius: 8,
                    padding: 28,
                    flex: '1 1 260px',
                    minWidth: isMobile ? '100%' : 260,
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: '#F0EDE8',
                      color: '#888',
                      fontSize: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                      fontWeight: 300,
                    }}
                  >
                    {initials(socio.nombre)}
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px', color: '#1A1A1A' }}>
                    {socio.nombre}
                  </p>
                  <p style={{ fontSize: 12, color: '#D85A30', margin: '0 0 12px' }}>{socio.titulo}</p>
                  <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, margin: 0 }}>{socio.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 5: Video placeholder ── */}
        <section style={{ padding: '80px 24px', background: '#1A1A1A' }}>
          <div style={sectionWrap()}>
            <p
              style={{
                fontSize: 10,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: 16,
                fontWeight: 500,
              }}
            >
              NUESTRO TRABAJO
            </p>
            <h2
              style={{
                fontSize: isMobile ? 22 : 28,
                fontWeight: 200,
                color: '#fff',
                margin: '0 0 0',
              }}
            >
              Así es trabajar con Forma Prima.
            </h2>
            <div
              style={{
                background: '#2A2A2A',
                borderRadius: 8,
                aspectRatio: '16/9',
                maxWidth: 800,
                margin: '32px auto 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                Vídeo próximamente
              </span>
            </div>
          </div>
        </section>

        {/* ── Section 6: Form ── */}
        <section style={{ padding: '80px 24px', background: '#F8F6F1' }}>
          <div style={{ ...sectionWrap(640) }}>
            <p
              style={{
                fontSize: 10,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#D85A30',
                marginBottom: 16,
                fontWeight: 500,
              }}
            >
              PRIMER PASO
            </p>
            <h2
              style={{
                fontSize: isMobile ? 22 : 28,
                fontWeight: 300,
                color: '#1A1A1A',
                margin: '0 0 12px',
              }}
            >
              Cuéntanos sobre ti y tu idea
            </h2>
            <p style={{ fontSize: 14, color: '#888', marginBottom: 40 }}>
              Sin compromiso. Solo queremos entenderte mejor antes de nuestra primera conversación.
            </p>

            {submitted ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <h3
                  style={{
                    fontSize: isMobile ? 22 : 28,
                    fontWeight: 300,
                    color: '#1A1A1A',
                    margin: '0 0 16px',
                  }}
                >
                  ¡Gracias, {nombre}!
                </h3>
                <p style={{ fontSize: 15, color: '#555', lineHeight: 1.7, maxWidth: 400, margin: '0 auto 32px' }}>
                  Hemos recibido tu información. Nos pondremos en contacto contigo en menos de 24 horas.
                </p>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 200,
                    letterSpacing: '0.2em',
                    color: '#888',
                  }}
                >
                  FORMA PRIMA
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* Row: Nombre + Apellidos */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                      gap: 16,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: '#888',
                          marginBottom: 6,
                        }}
                      >
                        Nombre *
                      </label>
                      <input
                        required
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        style={inp()}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: '#888',
                          marginBottom: 6,
                        }}
                      >
                        Apellidos
                      </label>
                      <input
                        type="text"
                        value={apellidos}
                        onChange={(e) => setApellidos(e.target.value)}
                        style={inp()}
                      />
                    </div>
                  </div>

                  {/* Row: Email + Teléfono */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                      gap: 16,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: '#888',
                          marginBottom: 6,
                        }}
                      >
                        Email *
                      </label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={inp()}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: '#888',
                          marginBottom: 6,
                        }}
                      >
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        style={inp()}
                      />
                    </div>
                  </div>

                  {/* Empresa */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: '#888',
                        marginBottom: 6,
                      }}
                    >
                      Empresa
                    </label>
                    <input
                      type="text"
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      style={inp()}
                    />
                  </div>

                  {/* Interes */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: '#888',
                        marginBottom: 6,
                      }}
                    >
                      ¿Qué tienes en mente?
                    </label>
                    <textarea
                      rows={4}
                      value={interes}
                      onChange={(e) => setInteres(e.target.value)}
                      placeholder="Cuéntanos brevemente tu proyecto o idea…"
                      style={{ ...inp(), resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                  {/* Origen */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: '#888',
                        marginBottom: 6,
                      }}
                    >
                      ¿Cómo nos has conocido?
                    </label>
                    <select
                      value={origen}
                      onChange={(e) => setOrigen(e.target.value)}
                      style={inp()}
                    >
                      <option value="">Selecciona una opción…</option>
                      <option value="Referido">Referido</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Web">Web</option>
                      <option value="Google">Google</option>
                      <option value="Evento">Evento</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  {/* Error */}
                  {submitError && (
                    <div
                      style={{
                        padding: '10px 16px',
                        background: '#FEF2F2',
                        border: '1px solid #FCA5A5',
                        borderRadius: 4,
                        fontSize: 13,
                        color: '#DC2626',
                      }}
                    >
                      {submitError}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      background: isSubmitting ? '#C0876A' : '#D85A30',
                      color: '#fff',
                      padding: '14px',
                      fontSize: 15,
                      fontWeight: 500,
                      border: 'none',
                      borderRadius: 4,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      transition: 'background 0.15s',
                    }}
                  >
                    {isSubmitting ? 'Enviando…' : 'Quiero empezar →'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* ── Section 7: Footer ── */}
        <footer
          style={{
            background: '#1A1A1A',
            padding: '32px 24px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: 14,
              fontWeight: 200,
              letterSpacing: '0.2em',
              color: '#fff',
              margin: '0 0 8px',
            }}
          >
            FORMA PRIMA
          </p>
          <p
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              margin: '0 0 4px',
            }}
          >
            contacto@formaprima.es
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            © 2025 Geinex Group S.L.
          </p>
        </footer>
      </div>
    </>
  )
}
