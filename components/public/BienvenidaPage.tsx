'use client'

import { useState, useEffect, useRef } from 'react'
import { submitBienvenidaForm } from '@/app/actions/bienvenida'

interface Props {
  nombreCliente: string
  token: string
  heroImage: string
  proyectoImages: { nombre: string; url: string; tipologia: string | null }[]
  studio: {
    tagline: string
    descripcion_es: string
    proyectos: string
    paises: string
    fundacion: string
    socios: { nombre: string; titulo: string; bio: string }[]
  }
}

function initials(n: string) {
  return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ── Scroll-to-section ─────────────────────────────────────────────────────────
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export default function BienvenidaPage({ nombreCliente, token, heroImage, proyectoImages, studio }: Props) {
  const [submitted, setSubmitted]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)
  const [copied, setCopied]         = useState(false)
  const [teamPhotoIdx, setTeamPhotoIdx] = useState(0)

  // Form state
  const [nombre,    setNombre]    = useState('')
  const [apellidos, setApellidos] = useState('')
  const [email,     setEmail]     = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [empresa,   setEmpresa]   = useState('')
  const [idea,      setIdea]      = useState('')
  const [origen,    setOrigen]    = useState('')

  // Team photo slideshow
  useEffect(() => {
    const id = setInterval(() => setTeamPhotoIdx(i => (i + 1) % 2), 4000)
    return () => clearInterval(id)
  }, [])

  // Intersection observer for fade-in sections
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const observer = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) setVisible(prev => ({ ...prev, [e.target.id]: true }))
        })
      },
      { threshold: 0.12 }
    )
    const sections = document.querySelectorAll('[data-fade]')
    sections.forEach(s => observer.current?.observe(s))
    return () => observer.current?.disconnect()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !email.trim()) return
    setSubmitting(true)
    setFormError(null)
    const result = await submitBienvenidaForm(token, {
      nombre: nombre.trim(),
      apellidos: apellidos.trim(),
      email: email.trim(),
      telefono: telefono.trim(),
      empresa: empresa.trim() || undefined,
      interes: `${idea.trim()}${origen ? ` | Origen: ${origen}` : ''}`.trim() || undefined,
      notas: undefined,
    })
    setSubmitting(false)
    if ('error' in result) setFormError(result.error)
    else setSubmitted(true)
  }

  const fadeStyle = (id: string): React.CSSProperties => ({
    opacity: visible[id] ? 1 : 0,
    transform: visible[id] ? 'translateY(0)' : 'translateY(28px)',
    transition: 'opacity 0.7s ease, transform 0.7s ease',
  })

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #F8F6F1; color: #1A1A1A; }

        .fp-section-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #D85A30;
          margin-bottom: 14px;
          display: block;
        }

        .fp-btn-primary {
          background: #D85A30;
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 16px 32px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          width: 100%;
          letter-spacing: 0.01em;
          transition: background 0.2s;
          font-family: inherit;
        }
        .fp-btn-primary:hover { background: #C24E26; }
        .fp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .fp-input {
          padding: 12px 14px;
          border: 1px solid #E5E2DA;
          border-radius: 4px;
          font-size: 14px;
          width: 100%;
          background: #fff;
          color: #1A1A1A;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
        }
        .fp-input:focus { border-color: #D85A30; }

        .fp-field-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #888;
          margin-bottom: 6px;
        }

        .fp-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 600px) {
          .fp-grid-2 { grid-template-columns: 1fr; }
        }

        .fp-stats-row {
          display: flex;
          gap: 40px;
          flex-wrap: wrap;
          margin-top: 40px;
        }
        @media (max-width: 500px) {
          .fp-stats-row { gap: 28px; }
        }

        .fp-socios-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 32px;
        }
        @media (max-width: 680px) {
          .fp-socios-grid { grid-template-columns: 1fr; }
        }

        .fp-carousel::-webkit-scrollbar { display: none; }

        /* Hero scroll bounce */
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50%       { transform: translateY(6px); opacity: 1; }
        }
        .fp-bounce { animation: bounce 2s ease-in-out infinite; }
      `}</style>

      {/* ── 1. HERO ───────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '0 24px',
      }}>
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImage}
          alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}
        />
        {/* Overlay gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.70) 100%)',
        }} />

        {/* Logo — top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '28px 28px', display: 'flex', justifyContent: 'center', zIndex: 2 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/FORMA_PRIMA_BLANCO.png" alt="Forma Prima" style={{ height: 44, opacity: 0.95 }} />
        </div>

        {/* Center content */}
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 560, padding: '80px 0 120px' }}>
          <p style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
            marginBottom: 20,
          }}>
            Architecture · Interior Design
          </p>
          <h1 style={{
            fontSize: 'clamp(32px, 8vw, 52px)',
            fontWeight: 200,
            color: '#fff',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            marginBottom: 20,
          }}>
            Hello, {nombreCliente}.
          </h1>
          <p style={{
            fontSize: 'clamp(14px, 3.5vw, 17px)',
            color: 'rgba(255,255,255,0.72)',
            lineHeight: 1.75,
            marginBottom: 36,
            fontWeight: 300,
          }}>
            We are glad you are here. We would love to introduce ourselves
            and show you how we work before taking any step together.
          </p>
          <button
            onClick={() => scrollTo('form')}
            style={{
              background: '#D85A30',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '14px 32px',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '0.02em',
              fontFamily: 'inherit',
            }}
          >
            Tell us about your project →
          </button>
        </div>

        {/* Scroll indicator */}
        <div className="fp-bounce" style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 2, color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1,
        }}>
          ↓
        </div>
      </section>

      {/* ── 2. FORM ───────────────────────────────────────────────────────────── */}
      <section id="form" data-fade style={{ background: '#fff', padding: 'clamp(60px, 8vw, 96px) 24px' }}>
        <div id="form-inner" data-fade style={{ ...fadeStyle('form-inner'), maxWidth: 600, margin: '0 auto' }}>
          <span className="fp-section-label">First step</span>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/FORMA_PRIMA_NEGRO.png" alt="Forma Prima" style={{ height: 20, marginBottom: 32, opacity: 0.7 }} />
              <h2 style={{ fontSize: 26, fontWeight: 300, marginBottom: 16 }}>
                Thank you, {nombre || nombreCliente}!
              </h2>
              <p style={{ fontSize: 15, color: '#666', lineHeight: 1.7, maxWidth: 400, margin: '0 auto' }}>
                We have received your information and will be in touch within 24 hours.
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 300, marginBottom: 10, lineHeight: 1.2 }}>
                Tell us about yourself and your idea
              </h2>
              <p style={{ fontSize: 14, color: '#888', marginBottom: 36, lineHeight: 1.65 }}>
                No commitment needed. We simply want to understand you better before our first conversation.
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="fp-grid-2">
                  <div>
                    <label className="fp-field-label">First name *</label>
                    <input className="fp-input" value={nombre} onChange={e => setNombre(e.target.value)} required placeholder="Your first name" />
                  </div>
                  <div>
                    <label className="fp-field-label">Last name</label>
                    <input className="fp-input" value={apellidos} onChange={e => setApellidos(e.target.value)} placeholder="Your last name" />
                  </div>
                </div>
                <div className="fp-grid-2">
                  <div>
                    <label className="fp-field-label">Email *</label>
                    <input className="fp-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@email.com" />
                  </div>
                  <div>
                    <label className="fp-field-label">Phone</label>
                    <input className="fp-input" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+32 000 000 000" />
                  </div>
                </div>
                <div>
                  <label className="fp-field-label">Company (optional)</label>
                  <input className="fp-input" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Your company or community name" />
                </div>
                <div>
                  <label className="fp-field-label">What do you have in mind?</label>
                  <textarea
                    className="fp-input"
                    value={idea}
                    onChange={e => setIdea(e.target.value)}
                    rows={4}
                    placeholder="Tell us briefly about your project or idea…"
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label className="fp-field-label">How did you find us?</label>
                  <select className="fp-input" value={origen} onChange={e => setOrigen(e.target.value)} style={{ cursor: 'pointer' }}>
                    <option value="">— Select an option —</option>
                    <option value="Referido">Referral / recommendation</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Web">Website</option>
                    <option value="Google">Google</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Evento">Event</option>
                    <option value="Otro">Other</option>
                  </select>
                </div>
                {formError && (
                  <p style={{ fontSize: 13, color: '#E53E3E', padding: '8px 12px', background: '#FFF5F5', borderRadius: 4 }}>
                    {formError}
                  </p>
                )}
                <button type="submit" className="fp-btn-primary" disabled={submitting}>
                  {submitting ? 'Sending…' : "Let's get started →"}
                </button>
                <p style={{ fontSize: 11, color: '#BBB', textAlign: 'center', lineHeight: 1.6 }}>
                  Your information is confidential and will only be used to get in touch with you.
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── 3. ESTUDIO ────────────────────────────────────────────────────────── */}
      <section style={{ background: '#F8F6F1', padding: 'clamp(60px, 8vw, 96px) 24px' }}>
        <div id="estudio" data-fade style={{ ...fadeStyle('estudio'), maxWidth: 720, margin: '0 auto' }}>
          <span className="fp-section-label">The studio</span>
          <h2 style={{ fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 300, lineHeight: 1.3, marginBottom: 28, maxWidth: 560 }}>
            True harmony is not found in uniformity,<br />but in the strategic amalgamation of contrasts.
          </h2>
          {studio.descripcion_es.split('\n\n').map((p, i) => (
            <p key={i} style={{ fontSize: 15, color: '#444', lineHeight: 1.8, marginBottom: 16 }}>
              {p}
            </p>
          ))}
          <div className="fp-stats-row">
            {[
              { value: studio.proyectos, label: 'Projects' },
              { value: studio.fundacion, label: 'Founded' },
              { value: studio.paises,    label: 'Projects in' },
            ].map(s => (
              <div key={s.label}>
                <p style={{ fontSize: 28, fontWeight: 200, color: '#D85A30', lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginTop: 6 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. CAROUSEL ───────────────────────────────────────────────────────── */}
      {proyectoImages.length > 0 && (
        <section style={{ background: '#1A1A1A', padding: 'clamp(48px, 6vw, 72px) 0' }}>
          <div style={{ padding: '0 24px 20px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
              Proyectos recientes
            </span>
          </div>
          <div
            className="fp-carousel"
            style={{
              display: 'flex',
              gap: 3,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingLeft: 24,
              paddingRight: 24,
            }}
          >
            {proyectoImages.map((p, i) => (
              <div
                key={i}
                style={{
                  position: 'relative',
                  flexShrink: 0,
                  width: 'clamp(260px, 45vw, 380px)',
                  aspectRatio: '3/4',
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: '#2A2A2A',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.nombre}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
                  padding: '24px 16px 16px',
                }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#fff', letterSpacing: '0.02em' }}>{p.nombre}</p>
                  {p.tipologia && (
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{p.tipologia}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 5. SOCIOS ─────────────────────────────────────────────────────────── */}
      <style>{`
        .fp-team-banner {
          position: relative;
          width: 100%;
          overflow: hidden;
          background: #1A1A1A;
          border-radius: 8px;
          /* portrait images: give enough height so the bottom (people) shows */
          height: 110vw;
          max-height: 520px;
        }
        .fp-team-intro-block {
          position: absolute;
          /* mobile: text at top so people at bottom stay visible */
          top: 0; left: 0; right: 0;
          background: linear-gradient(to bottom, rgba(15,15,15,0.82) 0%, rgba(15,15,15,0.55) 70%, transparent 100%);
          padding: 28px 24px 48px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        @media (min-width: 641px) {
          .fp-team-banner {
            height: 500px;
            max-height: 500px;
          }
          .fp-team-intro-block {
            /* desktop: text panel on the right */
            top: 0; bottom: 0;
            left: auto; right: 0;
            width: 46%;
            justify-content: center;
            padding: clamp(28px, 5vw, 52px);
            border-radius: 0 8px 8px 0;
            background: rgba(15, 15, 15, 0.70);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
          }
        }
      `}</style>
      <section style={{ background: '#F8F6F1', padding: 'clamp(60px, 8vw, 96px) 0' }}>
        <div id="equipo" data-fade style={{ ...fadeStyle('equipo'), maxWidth: 860, margin: '0 auto' }}>

          {/* Photo banner + intro row */}
          <div className="fp-team-banner" style={{ marginBottom: 48 }}>
            {/* Crossfade slideshow — fills entire banner */}
            {[
              { src: '/P1074528 copy.jpg',                         alt: 'Gabriela Hidalgo y José Lora — Forma Prima', filter: 'grayscale(100%)' },
              { src: '/9263BB2D-DDDF-47AD-9EEF-0985C56BC645.JPG', alt: 'Equipo Forma Prima en obra',                filter: 'none' },
            ].map((photo, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.src}
                src={photo.src}
                alt={photo.alt}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover', objectPosition: 'center 65%',
                  display: 'block',
                  filter: photo.filter,
                  opacity: teamPhotoIdx === i ? 1 : 0,
                  transition: 'opacity 1.2s ease',
                }}
              />
            ))}

            {/* Intro text — transparent overlay */}
            <div className="fp-team-intro-block">
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#D85A30', marginBottom: 14, display: 'block' }}>
                The team
              </span>
              <h2 style={{ fontSize: 'clamp(20px, 3.5vw, 26px)', fontWeight: 200, color: '#fff', lineHeight: 1.35, marginBottom: 16 }}>
                Who you will be working with
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>
                Forma Prima is a deliberately small studio. Every project is handled personally by us — no hand-offs, no intermediaries.
              </p>
            </div>
          </div>

          {/* Individual cards */}
          <div className="fp-socios-grid" style={{ padding: '0 24px' }}>
            {studio.socios.map(s => (
              <div key={s.nombre} style={{
                background: '#fff',
                border: '1px solid #E5E2DA',
                borderRadius: 8,
                padding: 'clamp(20px, 4vw, 32px)',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: '#F0EDE8', color: '#888',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 600, marginBottom: 16,
                  letterSpacing: '0.02em',
                }}>
                  {initials(s.nombre)}
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{s.nombre}</p>
                <p style={{ fontSize: 11, color: '#D85A30', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>{s.titulo}</p>
                {s.bio.split('\n\n').map((p, i) => (
                  <p key={i} style={{ fontSize: 13, color: '#555', lineHeight: 1.75, marginBottom: 10 }}>{p}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. VIDEO ──────────────────────────────────────────────────────────── */}
      <section style={{ background: '#1A1A1A', padding: 'clamp(60px, 8vw, 96px) 24px' }}>
        <div id="video" data-fade style={{ ...fadeStyle('video'), maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 14 }}>
            Our work
          </span>
          <h2 style={{ fontSize: 'clamp(20px, 4.5vw, 28px)', fontWeight: 200, color: '#fff', marginBottom: 32, lineHeight: 1.3 }}>
            What it feels like to work with Forma Prima.
          </h2>
          {/* YouTube Shorts embed — vertical 9/16 */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 360,
            margin: '0 auto',
            paddingBottom: 'min(640px, 177.78%)',
            height: 0,
            borderRadius: 12,
            overflow: 'hidden',
            background: '#2A2A2A',
          }}>
            <iframe
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              src="https://www.youtube.com/embed/H2oe26E1zI8?rel=0&modestbranding=1&playsinline=1"
              title="Forma Prima — así es trabajar con nosotros"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* ── 7. FOOTER ─────────────────────────────────────────────────────────── */}
      <footer style={{ background: '#111', padding: '40px 24px', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/FORMA_PRIMA_BLANCO.png" alt="Forma Prima" style={{ height: 18, marginBottom: 16, opacity: 0.6 }} />
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
          contacto@formaprima.es
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
          © 2025 Geinex Group S.L. · Madrid · Spain
        </p>
      </footer>
    </>
  )
}
