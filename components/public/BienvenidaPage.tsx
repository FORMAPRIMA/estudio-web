'use client'

import { useState, useEffect, useRef } from 'react'
import { submitBienvenidaForm } from '@/app/actions/bienvenida'

export type BienvenidaSubmit = (
  token: string,
  formData: {
    nombre: string
    apellidos: string
    email: string
    telefono: string
    empresa?: string
    interes?: string
    notas?: string
  },
) => Promise<{ success: true } | { error: string }>

interface Props {
  nombreCliente: string
  token: string
  heroImage: string
  proyectoImages: { nombre: string; url: string; tipologia: string | null }[]
  studio: {
    tagline: string
    descripcion: string
    proyectos: string
    paises: string
    fundacion: string
    socios: { nombre: string; titulo: string; bio: string }[]
  }
  // Acción de envío del formulario. Por defecto crea un lead suelto; el Espacio
  // pasa una variante que además vincula el lead a su espacio.
  submitAction?: BienvenidaSubmit
  // Idioma de la landing. Por defecto inglés (compatibilidad con el flujo legacy).
  lang?: 'es' | 'en'
}

const COPY = {
  es: {
    heroKicker: 'Arquitectura · Interiorismo',
    heroHello: (n: string) => `Hola, ${n}.`,
    heroSub: 'Nos alegra que estés aquí. Nos encantaría presentarnos y mostrarte cómo trabajamos antes de dar cualquier paso juntos.',
    heroCta: 'Cuéntanos sobre tu proyecto →',
    formKicker: 'Primer paso',
    thanks: (n: string) => `¡Gracias, ${n}!`,
    thanksSub: 'Hemos recibido tu información y nos pondremos en contacto contigo en menos de 24 horas.',
    formTitle: 'Cuéntanos sobre ti y tu idea',
    formSub: 'Sin compromiso. Solo queremos conocerte mejor antes de nuestra primera conversación.',
    firstName: 'Nombre *', firstNamePh: 'Tu nombre',
    lastName: 'Apellidos', lastNamePh: 'Tus apellidos',
    email: 'Email *', phone: 'Teléfono', phonePh: '+34 600 000 000',
    company: 'Empresa (opcional)', companyPh: 'Tu empresa o comunidad',
    idea: '¿Qué tienes en mente?', ideaPh: 'Cuéntanos brevemente sobre tu proyecto o idea…',
    findUs: '¿Cómo nos conociste?', selectDefault: '— Selecciona una opción —',
    optReferral: 'Referido / recomendación', optWebsite: 'Página web', optEvent: 'Evento', optOther: 'Otro',
    submit: 'Empecemos →', sending: 'Enviando…',
    disclaimer: 'Tu información es confidencial y solo se usará para ponernos en contacto contigo.',
    studioKicker: 'El estudio',
    studioHeading: 'La verdadera armonía no se encuentra en la uniformidad, sino en la amalgama estratégica de contrastes.',
    statProjects: 'Proyectos', statFounded: 'Fundación', statCountries: 'Proyectos en',
    recentProjects: 'Proyectos recientes',
    teamKicker: 'El equipo', teamHeading: 'Con quién vas a trabajar',
    teamSub: 'Forma Prima es un estudio deliberadamente pequeño. Cada proyecto lo llevamos personalmente nosotros — sin traspasos, sin intermediarios.',
    workKicker: 'Nuestro trabajo', workHeading: 'Cómo se siente trabajar con Forma Prima.',
  },
  en: {
    heroKicker: 'Architecture · Interior Design',
    heroHello: (n: string) => `Hello, ${n}.`,
    heroSub: 'We are glad you are here. We would love to introduce ourselves and show you how we work before taking any step together.',
    heroCta: 'Tell us about your project →',
    formKicker: 'First step',
    thanks: (n: string) => `Thank you, ${n}!`,
    thanksSub: 'We have received your information and will be in touch within 24 hours.',
    formTitle: 'Tell us about yourself and your idea',
    formSub: 'No commitment needed. We simply want to understand you better before our first conversation.',
    firstName: 'First name *', firstNamePh: 'Your first name',
    lastName: 'Last name', lastNamePh: 'Your last name',
    email: 'Email *', phone: 'Phone', phonePh: '+32 000 000 000',
    company: 'Company (optional)', companyPh: 'Your company or community name',
    idea: 'What do you have in mind?', ideaPh: 'Tell us briefly about your project or idea…',
    findUs: 'How did you find us?', selectDefault: '— Select an option —',
    optReferral: 'Referral / recommendation', optWebsite: 'Website', optEvent: 'Event', optOther: 'Other',
    submit: "Let's get started →", sending: 'Sending…',
    disclaimer: 'Your information is confidential and will only be used to get in touch with you.',
    studioKicker: 'The studio',
    studioHeading: 'True harmony is not found in uniformity, but in the strategic amalgamation of contrasts.',
    statProjects: 'Projects', statFounded: 'Founded', statCountries: 'Projects in',
    recentProjects: 'Recent projects',
    teamKicker: 'The team', teamHeading: 'Who you will be working with',
    teamSub: 'Forma Prima is a deliberately small studio. Every project is handled personally by us — no hand-offs, no intermediaries.',
    workKicker: 'Our work', workHeading: 'What it feels like to work with Forma Prima.',
  },
}

function initials(n: string) {
  return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ── Scroll-to-section ─────────────────────────────────────────────────────────
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export default function BienvenidaPage({ nombreCliente, token, heroImage, proyectoImages, studio, submitAction, lang = 'en' }: Props) {
  const t = COPY[lang]
  const [submitted, setSubmitted]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)
  const [copied, setCopied]         = useState(false)
  const [teamPhotoIdx, setTeamPhotoIdx] = useState(0)
  const [heroIdx, setHeroIdx]           = useState(0)
  const [heroPrev, setHeroPrev]         = useState<number | null>(null)

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

  // Hero slideshow — starts after 5 s, then every 5 s
  useEffect(() => {
    if (proyectoImages.length < 2) return
    const start = setTimeout(() => {
      setHeroPrev(0)
      setHeroIdx(1)
      const id = setInterval(() => {
        setHeroIdx(prev => {
          const next = (prev + 1) % proyectoImages.length
          setHeroPrev(prev)
          return next
        })
      }, 5000)
      return () => clearInterval(id)
    }, 5000)
    return () => clearTimeout(start)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const action = submitAction ?? submitBienvenidaForm
    const result = await action(token, {
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

        /* Ken Burns zoom for hero images */
        @keyframes kenBurns {
          from { transform: scale(1);    }
          to   { transform: scale(1.07); }
        }
        .fp-hero-active { animation: kenBurns 6s ease-out forwards; }

        /* Hero project name label */
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fp-hero-label { animation: fadeSlideUp 0.6s ease forwards; }
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
        {/* Background slideshow */}
        {proyectoImages.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.url}
            src={p.url}
            alt=""
            className={heroIdx === i ? 'fp-hero-active' : undefined}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center',
              opacity: heroIdx === i ? 1 : 0,
              transition: heroIdx === i ? 'opacity 1.4s ease' : 'opacity 1.4s ease 0s',
              willChange: 'opacity, transform',
            }}
          />
        ))}

        {/* Overlay gradient */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.72) 100%)',
        }} />

        {/* Project name label — bottom left */}
        {proyectoImages[heroIdx] && heroIdx > 0 && (
          <div
            key={heroIdx}
            className="fp-hero-label"
            style={{
              position: 'absolute', bottom: 60, left: 28, zIndex: 2,
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>
              {proyectoImages[heroIdx].tipologia ?? 'Project'}
            </p>
            <p style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.01em' }}>
              {proyectoImages[heroIdx].nombre}
            </p>
          </div>
        )}

        {/* Logo — top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '28px 28px', display: 'flex', justifyContent: 'center', zIndex: 3 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/FORMA_PRIMA_BLANCO.png" alt="Forma Prima" style={{ height: 44, opacity: 0.95 }} />
        </div>

        {/* Center content */}
        <div style={{ position: 'relative', zIndex: 3, textAlign: 'center', maxWidth: 560, padding: '80px 0 120px' }}>
          <p style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
            marginBottom: 20,
          }}>
            {t.heroKicker}
          </p>
          <h1 style={{
            fontSize: 'clamp(32px, 8vw, 52px)',
            fontWeight: 200,
            color: '#fff',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            marginBottom: 20,
          }}>
            {t.heroHello(nombreCliente)}
          </h1>
          <p style={{
            fontSize: 'clamp(14px, 3.5vw, 17px)',
            color: 'rgba(255,255,255,0.72)',
            lineHeight: 1.75,
            marginBottom: 36,
            fontWeight: 300,
          }}>
            {t.heroSub}
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
            {t.heroCta}
          </button>
        </div>

        {/* Scroll indicator */}
        <div className="fp-bounce" style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 3, color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1,
        }}>
          ↓
        </div>
      </section>

      {/* ── 2. FORM ───────────────────────────────────────────────────────────── */}
      <section id="form" data-fade style={{ background: '#fff', padding: 'clamp(60px, 8vw, 96px) 24px' }}>
        <div id="form-inner" data-fade style={{ ...fadeStyle('form-inner'), maxWidth: 600, margin: '0 auto' }}>
          <span className="fp-section-label">{t.formKicker}</span>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/FORMA_PRIMA_NEGRO.png" alt="Forma Prima" style={{ height: 20, marginBottom: 32, opacity: 0.7 }} />
              <h2 style={{ fontSize: 26, fontWeight: 300, marginBottom: 16 }}>
                {t.thanks(nombre || nombreCliente)}
              </h2>
              <p style={{ fontSize: 15, color: '#666', lineHeight: 1.7, maxWidth: 400, margin: '0 auto' }}>
                {t.thanksSub}
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 300, marginBottom: 10, lineHeight: 1.2 }}>
                {t.formTitle}
              </h2>
              <p style={{ fontSize: 14, color: '#888', marginBottom: 36, lineHeight: 1.65 }}>
                {t.formSub}
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="fp-grid-2">
                  <div>
                    <label className="fp-field-label">{t.firstName}</label>
                    <input className="fp-input" value={nombre} onChange={e => setNombre(e.target.value)} required placeholder={t.firstNamePh} />
                  </div>
                  <div>
                    <label className="fp-field-label">{t.lastName}</label>
                    <input className="fp-input" value={apellidos} onChange={e => setApellidos(e.target.value)} placeholder={t.lastNamePh} />
                  </div>
                </div>
                <div className="fp-grid-2">
                  <div>
                    <label className="fp-field-label">{t.email}</label>
                    <input className="fp-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@email.com" />
                  </div>
                  <div>
                    <label className="fp-field-label">{t.phone}</label>
                    <input className="fp-input" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder={t.phonePh} />
                  </div>
                </div>
                <div>
                  <label className="fp-field-label">{t.company}</label>
                  <input className="fp-input" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder={t.companyPh} />
                </div>
                <div>
                  <label className="fp-field-label">{t.idea}</label>
                  <textarea
                    className="fp-input"
                    value={idea}
                    onChange={e => setIdea(e.target.value)}
                    rows={4}
                    placeholder={t.ideaPh}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label className="fp-field-label">{t.findUs}</label>
                  <select className="fp-input" value={origen} onChange={e => setOrigen(e.target.value)} style={{ cursor: 'pointer' }}>
                    <option value="">{t.selectDefault}</option>
                    <option value="Referido">{t.optReferral}</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Web">{t.optWebsite}</option>
                    <option value="Google">Google</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Evento">{t.optEvent}</option>
                    <option value="Otro">{t.optOther}</option>
                  </select>
                </div>
                {formError && (
                  <p style={{ fontSize: 13, color: '#E53E3E', padding: '8px 12px', background: '#FFF5F5', borderRadius: 4 }}>
                    {formError}
                  </p>
                )}
                <button type="submit" className="fp-btn-primary" disabled={submitting}>
                  {submitting ? t.sending : t.submit}
                </button>
                <p style={{ fontSize: 11, color: '#BBB', textAlign: 'center', lineHeight: 1.6 }}>
                  {t.disclaimer}
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── 3. ESTUDIO ────────────────────────────────────────────────────────── */}
      <section style={{ background: '#F8F6F1', padding: 'clamp(60px, 8vw, 96px) 24px' }}>
        <div id="estudio" data-fade style={{ ...fadeStyle('estudio'), maxWidth: 720, margin: '0 auto' }}>
          <span className="fp-section-label">{t.studioKicker}</span>
          <h2 style={{ fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 300, lineHeight: 1.3, marginBottom: 28, maxWidth: 560 }}>
            {t.studioHeading}
          </h2>
          {studio.descripcion.split('\n\n').map((p, i) => (
            <p key={i} style={{ fontSize: 15, color: '#444', lineHeight: 1.8, marginBottom: 16 }}>
              {p}
            </p>
          ))}
          <div className="fp-stats-row">
            {[
              { value: studio.proyectos, label: t.statProjects },
              { value: studio.fundacion, label: t.statFounded },
              { value: studio.paises,    label: t.statCountries },
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
              {t.recentProjects}
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
      <section style={{ background: '#F8F6F1', padding: 'clamp(60px, 8vw, 96px) 0' }}>
        <div id="equipo" data-fade style={{ ...fadeStyle('equipo'), maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>

          {/* Team banner — image stacked above text, no overlap */}
          <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 48 }}>

            {/* Crossfade slideshow — portrait images */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: 'clamp(280px, 75vw, 440px)',
              background: '#1A1A1A',
              overflow: 'hidden',
            }}>
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
                    objectFit: 'cover', objectPosition: 'center 70%',
                    display: 'block',
                    filter: photo.filter,
                    opacity: teamPhotoIdx === i ? 1 : 0,
                    transition: 'opacity 1.2s ease',
                  }}
                />
              ))}
            </div>

            {/* Text block — below image, fully opaque */}
            <div style={{
              background: '#1A1A1A',
              padding: 'clamp(24px, 4vw, 40px) clamp(24px, 5vw, 48px)',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#D85A30', marginBottom: 14, display: 'block' }}>
                {t.teamKicker}
              </span>
              <h2 style={{ fontSize: 'clamp(20px, 3.5vw, 26px)', fontWeight: 200, color: '#fff', lineHeight: 1.35, marginBottom: 14 }}>
                {t.teamHeading}
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, maxWidth: 560 }}>
                {t.teamSub}
              </p>
            </div>
          </div>

          {/* Individual cards */}
          <div className="fp-socios-grid">
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
            {t.workKicker}
          </span>
          <h2 style={{ fontSize: 'clamp(20px, 4.5vw, 28px)', fontWeight: 200, color: '#fff', marginBottom: 32, lineHeight: 1.3 }}>
            {t.workHeading}
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
