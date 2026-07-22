'use client'

import { useState } from 'react'
import { site, display } from '../theme'
import { useSite } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { submitContactoWeb } from '@/app/actions/web-publica'
import { pick, type ContentMap } from '@/lib/web-publica'

export function ContactoPage({ content }: { content: ContentMap }) {
  const { locale, mobile } = useSite()
  const t = (es: string, en: string) => (locale === 'en' ? en : es)

  const eyebrow = pick(content, 'hero', 'eyebrow', { locale, mobile })
  const titulo = pick(content, 'hero', 'titulo', { locale, mobile })
  const intro = pick(content, 'hero', 'intro', { locale, mobile })
  const email = pick(content, 'datos', 'email', { locale, mobile })
  const telefono = pick(content, 'datos', 'telefono', { locale, mobile })
  const direccion = pick(content, 'datos', 'direccion', { locale, mobile })
  const horario = pick(content, 'datos', 'horario', { locale, mobile })

  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true); setError('')
    const fd = new FormData(e.currentTarget)
    if (!fd.get('consent')) { setError(t('Debes aceptar la Política de Privacidad.', 'You must accept the Privacy Policy.')); setLoading(false); return }
    const res = await submitContactoWeb({
      nombre: String(fd.get('nombre') || ''),
      email: String(fd.get('email') || ''),
      telefono: String(fd.get('telefono') || ''),
      empresa: String(fd.get('empresa') || ''),
      mensaje: String(fd.get('mensaje') || ''),
      idioma: locale,
      consent: !!fd.get('consent'),
      comercial: !!fd.get('comercial'),
      website: String(fd.get('website') || ''),
    })
    setLoading(false)
    if ('error' in res) { setError(res.error); return }
    setSent(true)
  }

  return (
    <main style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink, minHeight: '100vh',
      padding: `120px ${site.gutter} clamp(60px, 10vh, 120px)` }}>
      <div style={{ maxWidth: site.maxWidth, margin: '0 auto' }}>
        <header style={{ marginBottom: 'clamp(40px, 7vh, 72px)' }}>
          {eyebrow && <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', color: site.color.accent, margin: '0 0 16px' }}>{eyebrow}</Reveal>}
          {titulo && <Reveal as="h1" delay={100} style={{ fontSize: display.hero, fontWeight: 300, letterSpacing: '-0.01em', margin: 0, maxWidth: '16ch' }}>{titulo}</Reveal>}
          {intro && <Reveal as="p" delay={180} style={{ fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)', fontWeight: 300, lineHeight: 1.6, opacity: 0.7, margin: '22px 0 0', maxWidth: '52ch', whiteSpace: 'pre-wrap' }}>{intro}</Reveal>}
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.8fr) minmax(0,1.6fr)', gap: 'clamp(32px, 6vw, 90px)', alignItems: 'start' }} className="ct-grid">
          {/* Datos */}
          <Reveal style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {email && <Dato k="Email" v={email} href={`mailto:${email}`} />}
            {telefono && <Dato k={t('Teléfono', 'Phone')} v={telefono} href={`tel:${telefono.replace(/\s+/g, '')}`} />}
            {direccion && <Dato k={t('Dirección', 'Address')} v={direccion} />}
            {horario && <Dato k={t('Horario', 'Hours')} v={horario} />}
          </Reveal>

          {/* Formulario */}
          <Reveal delay={120}>
            {sent ? (
              <div style={{ padding: '40px 0' }}>
                <h2 style={{ fontSize: display.h2, fontWeight: 300, margin: 0 }}>{t('Gracias', 'Thank you')}</h2>
                <p style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.6, opacity: 0.75, marginTop: 14, maxWidth: '46ch' }}>
                  {t('Hemos recibido tu mensaje y te hemos enviado un correo con tu acceso. Nos pondremos en contacto muy pronto.',
                     'We received your message and sent you an email with your access. We will get back to you very soon.')}
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 22px' }}>
                <Field name="nombre" label={t('Nombre', 'Name')} required />
                <Field name="email" label="Email" type="email" required />
                <Field name="telefono" label={t('Teléfono', 'Phone')} />
                <Field name="empresa" label={t('Empresa', 'Company')} />
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldLabel>{t('Mensaje', 'Message')}</FieldLabel>
                  <textarea name="mensaje" rows={4} style={inputStyle} />
                </div>
                {/* Honeypot anti-bot */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} aria-hidden />
                <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, fontSize: 12.5, fontWeight: 300, lineHeight: 1.5, opacity: 0.8, cursor: 'pointer' }}>
                  <input type="checkbox" name="consent" required style={{ marginTop: 3 }} />
                  {t('Acepto la Política de Privacidad y el tratamiento de mis datos para gestionar mi solicitud.',
                     'I accept the Privacy Policy and the processing of my data to handle my request.')}
                </label>
                <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, fontSize: 12.5, fontWeight: 300, lineHeight: 1.5, opacity: 0.8, cursor: 'pointer' }}>
                  <input type="checkbox" name="comercial" style={{ marginTop: 3 }} />
                  {t('Acepto recibir comunicaciones comerciales de Forma Prima.', 'I agree to receive commercial communications from Forma Prima.')}
                </label>
                {error && <p style={{ gridColumn: '1 / -1', color: '#b3261e', fontSize: 13, margin: 0 }}>{error}</p>}
                <div style={{ gridColumn: '1 / -1' }}>
                  <button type="submit" disabled={loading} data-cursor=""
                    style={{ padding: '14px 32px', background: site.color.ink, color: site.color.cream, border: 'none', fontSize: 12, letterSpacing: site.track.wide, textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'inherit' }}>
                    {loading ? t('Enviando…', 'Sending…') : t('Enviar', 'Send')}
                  </button>
                </div>
              </form>
            )}
          </Reveal>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `@media (max-width: 760px) { .ct-grid { grid-template-columns: 1fr !important; } }` }} />
    </main>
  )
}

function Dato({ k, v, href }: { k: string; v: string; href?: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: site.track.normal, textTransform: 'uppercase', opacity: 0.45, margin: '0 0 6px' }}>{k}</p>
      {href ? <a href={href} data-cursor="" style={{ fontSize: 16, fontWeight: 300, color: site.color.ink, textDecoration: 'none' }}>{v}</a>
            : <p style={{ fontSize: 16, fontWeight: 300, margin: 0, whiteSpace: 'pre-wrap' }}>{v}</p>}
    </div>
  )
}

function Field({ name, label, type = 'text', required }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <div>
      <FieldLabel>{label}{required && ' *'}</FieldLabel>
      <input name={name} type={type} required={required} style={inputStyle} />
    </div>
  )
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 7 }}>{children}</label>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 0', border: 'none', borderBottom: `1px solid ${site.color.ink}33`,
  background: 'transparent', fontSize: 15, fontWeight: 300, color: site.color.ink, fontFamily: 'inherit', outline: 'none',
}
