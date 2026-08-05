'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { site, display } from '../theme'
import { useSite } from '../SiteProvider'
import { Reveal } from '../Reveal'
import { submitContactoWeb } from '@/app/actions/web-publica'
import { guardarContactoParcial, ampliarContactoWeb } from '@/app/actions/contacto'
import { pick, type ContentMap } from '@/lib/web-publica'
import { SERVICIOS, SUPERFICIES, PLAZOS, PRESUPUESTOS, EMAIL_RE, type OpcionChip } from '@/lib/contacto'

// Formulario de contacto orientado a convertir, no a "recoger un mensaje":
//
//  · UN solo paso para enviar. Obligatorio: nombre, email y consentimiento. Todo
//    lo demás es opcional (decisión de Jose: la cualificación friccionaba).
//  · La cualificación pesada (ubicación, superficie, plazo, presupuesto) se pide
//    DESPUÉS de enviar: el lead ya está asegurado, así que abandonarla no cuesta
//    un contacto. Enriquece el mismo lead vía ampliarContactoWeb.
//  · Captura progresiva: al salir de cada campo se guarda por detrás (ver
//    app/actions/contacto.ts). Si alguien deja el formulario a medias, el equipo
//    conserva lo que hubiera escrito y puede llamarle.
//  · Anti-bot sin captcha: honeypot + tiempo mínimo de relleno.

const CLAVE_SESION = 'fp_contacto_v1'

type Campos = {
  nombre: string; email: string; telefono: string; empresa: string; mensaje: string
  servicio: string; ubicacion: string; superficie: string; plazo: string; presupuesto: string
}
const VACIO: Campos = {
  nombre: '', email: '', telefono: '', empresa: '', mensaje: '',
  servicio: '', ubicacion: '', superficie: '', plazo: '', presupuesto: '',
}

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

  // Elementos de confianza (editables en el CMS).
  const quien = pick(content, 'confianza', 'quien', { locale, mobile })
  const respuesta = pick(content, 'confianza', 'respuesta', { locale, mobile })
  const pruebas = [1, 2, 3].map((n) => pick(content, 'confianza', `prueba_${n}`, { locale, mobile })).filter(Boolean)

  const [campos, setCampos] = useState<Campos>(VACIO)
  const [fase, setFase] = useState<'form' | 'gracias'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [consent, setConsent] = useState(false)
  const [comercial, setComercial] = useState(false)
  const honeypot = useRef('')
  const montadoEn = useRef(Date.now())

  // Id de esta sesión de formulario: sessionStorage, no cookie (nada de rastreo
  // entre sitios). Sobrevive a un refresco pero no al día siguiente.
  const [sesionId, setSesionId] = useState<string>('')
  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem(CLAVE_SESION)
      if (guardado) {
        const { id, campos: c } = JSON.parse(guardado) as { id: string; campos?: Partial<Campos> }
        setSesionId(id)
        if (c) setCampos((prev) => ({ ...prev, ...c }))
        return
      }
      const id = crypto.randomUUID()
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ id, campos: {} }))
      setSesionId(id)
    } catch { /* sessionStorage bloqueado: el formulario sigue funcionando sin autoguardado */ }
  }, [])

  const recordarEnNavegador = useCallback((next: Campos) => {
    try {
      const guardado = sessionStorage.getItem(CLAVE_SESION)
      const id = guardado ? (JSON.parse(guardado).id as string) : sesionId
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ id, campos: next }))
    } catch { /* sin persistencia local, seguimos */ }
  }, [sesionId])

  // Autoguardado en servidor: al salir del campo, con debounce. Solo se persiste
  // en cuanto hay email o teléfono (lo comprueba también el servidor).
  const ultimoEnviado = useRef('')
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoguardar = useCallback((next: Campos) => {
    if (!sesionId) return
    const huella = JSON.stringify(next)
    if (huella === ultimoEnviado.current) return
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      ultimoEnviado.current = huella
      void guardarContactoParcial({ id: sesionId, campos: next, paso: 1, idioma: locale })
    }, 800)
  }, [sesionId, locale])

  const set = (k: keyof Campos, v: string) => {
    setCampos((prev) => {
      const next = { ...prev, [k]: v }
      recordarEnNavegador(next)
      return next
    })
  }
  /** Los chips se guardan al instante (no hay "salir del campo"). */
  const setChip = (k: keyof Campos, v: string) => {
    setCampos((prev) => {
      const next = { ...prev, [k]: prev[k] === v ? '' : v }
      recordarEnNavegador(next)
      autoguardar(next)
      return next
    })
  }
  const alSalir = () => autoguardar(campos)

  const listo = campos.nombre.trim().length > 1 && EMAIL_RE.test(campos.email.trim()) && consent

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (!campos.nombre.trim()) return setError(t('Dinos cómo te llamas.', 'Tell us your name.'))
    if (!EMAIL_RE.test(campos.email.trim())) return setError(t('Ese email no parece correcto.', 'That email doesn’t look right.'))
    if (!consent) return setError(t('Necesitamos que aceptes la Política de Privacidad.', 'Please accept the Privacy Policy.'))
    // Bot: nadie humano rellena esto en menos de 2 segundos.
    if (Date.now() - montadoEn.current < 2000) return setError(t('Inténtalo de nuevo.', 'Please try again.'))

    setLoading(true)
    const res = await submitContactoWeb({
      nombre: campos.nombre, email: campos.email, telefono: campos.telefono,
      empresa: campos.empresa, mensaje: campos.mensaje,
      servicio: campos.servicio || undefined,
      idioma: locale, consent, comercial, website: honeypot.current,
      parcialId: sesionId || undefined,
    })
    setLoading(false)
    if ('error' in res) return setError(res.error)
    setFase('gracias')
  }

  return (
    <main style={{ fontFamily: site.font, background: site.color.cream, color: site.color.ink, minHeight: '100vh',
      padding: `120px ${site.gutter} clamp(60px, 10vh, 120px)` }}>
      <div style={{ maxWidth: site.maxWidth, margin: '0 auto' }}>
        <header style={{ marginBottom: 'clamp(36px, 6vh, 64px)' }}>
          {eyebrow && <Reveal as="p" style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', color: site.color.accent, margin: '0 0 16px' }}>{eyebrow}</Reveal>}
          {titulo && <Reveal as="h1" delay={100} style={{ fontSize: display.hero, fontWeight: 300, letterSpacing: '0', lineHeight: 1.2, margin: 0, maxWidth: '22ch' }}>{titulo}</Reveal>}
          {intro && <Reveal as="p" delay={180} style={{ fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)', fontWeight: 300, lineHeight: 1.6, opacity: 0.7, margin: '22px 0 0', maxWidth: '52ch', whiteSpace: 'pre-wrap' }}>{intro}</Reveal>}
        </header>

        <div className="ct-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.85fr) minmax(0,1.5fr)', gap: 'clamp(32px, 6vw, 88px)', alignItems: 'start' }}>
          {/* Columna de confianza */}
          <Reveal style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            {(quien || respuesta) && (
              <div style={{ borderLeft: `2px solid ${site.color.accent}`, paddingLeft: 16 }}>
                {quien && <p style={{ fontSize: 15, fontWeight: 400, margin: 0, lineHeight: 1.5 }}>{quien}</p>}
                {respuesta && <p style={{ fontSize: 13.5, fontWeight: 300, margin: '8px 0 0', opacity: 0.7, lineHeight: 1.55 }}>{respuesta}</p>}
              </div>
            )}

            {pruebas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pruebas.map((p, i) => (
                  <p key={i} style={{ fontSize: 13, fontWeight: 300, margin: 0, opacity: 0.75, display: 'flex', gap: 10 }}>
                    <span style={{ color: site.color.accent, fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>{p}
                  </p>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 4 }}>
              {email && <Dato k="Email" v={email} href={`mailto:${email}`} />}
              {telefono && <Dato k={t('Teléfono', 'Phone')} v={telefono} href={`tel:${telefono.replace(/\s+/g, '')}`} />}
              {direccion && <Dato k={t('Dirección', 'Address')} v={direccion} />}
              {horario && <Dato k={t('Horario', 'Hours')} v={horario} />}
            </div>
          </Reveal>

          {/* Formulario / gracias */}
          <Reveal delay={120}>
            {fase === 'gracias' ? (
              <Gracias sesionId={sesionId} nombre={campos.nombre} email={email} locale={locale} />
            ) : (
              <form onSubmit={onSubmit} noValidate>
                {/* Cualificación ligera: un toque, opcional, y ya clasifica el lead */}
                <p style={labelStyle}>{t('¿Qué necesitas?', 'What do you need?')} <Opcional locale={locale} /></p>
                <Chips ops={SERVICIOS} valor={campos.servicio} onPick={(v) => setChip('servicio', v)} locale={locale} />

                <div className="ct-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 22px', marginTop: 30 }}>
                  <Campo label={t('Nombre', 'Name')} required value={campos.nombre} onChange={(v) => set('nombre', v)} onBlur={alSalir} autoComplete="name" />
                  <Campo label="Email" required type="email" value={campos.email} onChange={(v) => set('email', v)} onBlur={alSalir} autoComplete="email" inputMode="email" />
                  <Campo label={t('Teléfono', 'Phone')} value={campos.telefono} onChange={(v) => set('telefono', v)} onBlur={alSalir} autoComplete="tel" inputMode="tel"
                    ayuda={t('Solo para llamarte sobre tu proyecto.', 'Only to call you about your project.')} />
                  <Campo label={t('Empresa', 'Company')} value={campos.empresa} onChange={(v) => set('empresa', v)} onBlur={alSalir} autoComplete="organization" />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>{t('Cuéntanos', 'Tell us')} <Opcional locale={locale} /></label>
                    <textarea value={campos.mensaje} onChange={(e) => set('mensaje', e.target.value)} onBlur={alSalir} rows={4} style={inputStyle}
                      placeholder={t('Qué tienes en mente, dónde, y en qué punto estás.', 'What you have in mind, where, and where you stand.')} />
                  </div>
                </div>

                {/* Honeypot anti-bot */}
                <input type="text" tabIndex={-1} autoComplete="off" aria-hidden onChange={(e) => { honeypot.current = e.target.value }}
                  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />

                <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={checkStyle}>
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>{t('Acepto la Política de Privacidad y el tratamiento de mis datos para gestionar mi solicitud.',
                             'I accept the Privacy Policy and the processing of my data to handle my request.')}</span>
                  </label>
                  <label style={checkStyle}>
                    <input type="checkbox" checked={comercial} onChange={(e) => setComercial(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>{t('Quiero recibir los proyectos nuevos de Forma Prima por email.',
                             'I’d like to receive Forma Prima’s new projects by email.')}</span>
                  </label>
                </div>

                {error && <p style={{ color: '#b3261e', fontSize: 13, margin: '18px 0 0' }}>{error}</p>}

                <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <button type="submit" disabled={loading} data-cursor=""
                    style={{ padding: '15px 34px', background: site.color.ink, color: site.color.cream, border: 'none', fontSize: 12,
                      letterSpacing: site.track.wide, textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer',
                      opacity: loading ? 0.6 : listo ? 1 : 0.85, fontFamily: 'inherit', transition: `opacity .3s ${site.ease}` }}>
                    {loading ? t('Enviando…', 'Sending…') : t('Enviar', 'Send')}
                  </button>
                  {respuesta && <span style={{ fontSize: 12, opacity: 0.55, fontWeight: 300 }}>{respuesta}</span>}
                </div>

                {/* Aviso del autoguardado: obligado si guardamos antes de que pulse Enviar */}
                <p style={{ fontSize: 11.5, lineHeight: 1.55, opacity: 0.45, fontWeight: 300, margin: '20px 0 0', maxWidth: '58ch' }}>
                  {t('Guardamos lo que escribes para poder retomar tu solicitud si no llegas a enviarla. Solo lo usamos para responderte, nunca para publicidad sin tu permiso, y lo borramos a los 30 días.',
                     'We save what you type so we can follow up if you don’t finish sending it. We only use it to reply to you, never for marketing without your permission, and we delete it after 30 days.')}
                </p>
              </form>
            )}
          </Reveal>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 860px) { .ct-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 620px) { .ct-fields { grid-template-columns: 1fr !important; } }
        .ct-chip { transition: background .25s ${site.ease}, border-color .25s ${site.ease}, color .25s ${site.ease}; }
        .ct-chip:hover { border-color: ${site.color.ink}66; }
      ` }} />
    </main>
  )
}

/** Pantalla de gracias: dice qué pasa ahora y ofrece cualificar sin obligación. */
function Gracias({ sesionId, nombre, email, locale }: { sesionId: string; nombre: string; email: string; locale: 'es' | 'en' }) {
  const t = (es: string, en: string) => (locale === 'en' ? en : es)
  const [detalle, setDetalle] = useState({ ubicacion: '', superficie: '', plazo: '', presupuesto: '' })
  const [enviado, setEnviado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const algo = Object.values(detalle).some(Boolean)
  const enviar = async () => {
    if (!algo || !sesionId) return
    setGuardando(true)
    await ampliarContactoWeb({ id: sesionId, ...detalle, idioma: locale })
    setGuardando(false); setEnviado(true)
  }

  return (
    <div>
      <h2 style={{ fontSize: display.h2, fontWeight: 300, margin: 0, letterSpacing: '-0.01em' }}>
        {t(`Gracias${nombre ? `, ${nombre.split(' ')[0]}` : ''}.`, `Thank you${nombre ? `, ${nombre.split(' ')[0]}` : ''}.`)}
      </h2>
      <ol style={{ margin: '22px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          t('Te acabamos de enviar un correo con el acceso a tu espacio privado.', 'We’ve just emailed you access to your private space.'),
          t('Ana, de nuestro equipo, revisa tu solicitud y te responde en menos de 24 h laborables.', 'Ana, from our team, reviews your request and replies within 24 working hours.'),
          t('Si es urgente, escríbenos directamente y lo vemos hoy.', 'If it’s urgent, write to us directly and we’ll look at it today.'),
        ].map((linea, i) => (
          <li key={i} style={{ display: 'flex', gap: 14, fontSize: 14.5, fontWeight: 300, lineHeight: 1.6, opacity: 0.8 }}>
            <span style={{ color: site.color.accent, fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>{linea}
          </li>
        ))}
      </ol>
      {email && (
        <p style={{ margin: '20px 0 0', fontSize: 14, fontWeight: 300 }}>
          <a href={`mailto:${email}`} data-cursor="" style={{ color: site.color.ink }}>{email}</a>
        </p>
      )}

      {enviado ? (
        <p style={{ marginTop: 36, fontSize: 14, fontWeight: 300, opacity: 0.7 }}>
          {t('Anotado, gracias. Con esto llegamos a la primera llamada con los deberes hechos.',
             'Noted, thank you. This way we come to the first call prepared.')}
        </p>
      ) : (
        <div style={{ marginTop: 40, paddingTop: 28, borderTop: `1px solid ${site.color.ink}1A` }}>
          <p style={{ fontSize: 14.5, fontWeight: 400, margin: 0 }}>
            {t('¿Nos cuentas un poco más del proyecto?', 'Care to tell us a bit more about the project?')}
          </p>
          <p style={{ fontSize: 12.5, fontWeight: 300, opacity: 0.6, margin: '6px 0 22px' }}>
            {t('Opcional, y en tres toques. Nos ayuda a llegar preparados a la primera conversación.',
               'Optional, three taps. It helps us come prepared to the first conversation.')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={labelStyle}>{t('¿Dónde está?', 'Where is it?')}</label>
              <input value={detalle.ubicacion} onChange={(e) => setDetalle({ ...detalle, ubicacion: e.target.value })}
                placeholder={t('Barrio de Salamanca, Madrid', 'Salamanca district, Madrid')} style={inputStyle} />
            </div>
            <Bloque label={t('Superficie aproximada', 'Approximate size')} ops={SUPERFICIES} valor={detalle.superficie} onPick={(v) => setDetalle({ ...detalle, superficie: detalle.superficie === v ? '' : v })} locale={locale} />
            <Bloque label={t('¿Para cuándo?', 'Timeline')} ops={PLAZOS} valor={detalle.plazo} onPick={(v) => setDetalle({ ...detalle, plazo: detalle.plazo === v ? '' : v })} locale={locale} />
            <Bloque label={t('Presupuesto orientativo', 'Indicative budget')} ops={PRESUPUESTOS} valor={detalle.presupuesto} onPick={(v) => setDetalle({ ...detalle, presupuesto: detalle.presupuesto === v ? '' : v })} locale={locale} />
          </div>

          <button onClick={enviar} disabled={!algo || guardando} data-cursor=""
            style={{ marginTop: 26, padding: '13px 28px', background: algo ? site.color.ink : 'transparent', color: algo ? site.color.cream : `${site.color.ink}66`,
              border: algo ? 'none' : `1px solid ${site.color.ink}33`, fontSize: 12, letterSpacing: site.track.wide, textTransform: 'uppercase',
              cursor: algo && !guardando ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {guardando ? t('Guardando…', 'Saving…') : t('Añadir estos datos', 'Add these details')}
          </button>
        </div>
      )}
    </div>
  )
}

function Bloque({ label, ops, valor, onPick, locale }: { label: string; ops: OpcionChip[]; valor: string; onPick: (v: string) => void; locale: 'es' | 'en' }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <Chips ops={ops} valor={valor} onPick={onPick} locale={locale} />
    </div>
  )
}

function Chips({ ops, valor, onPick, locale }: { ops: OpcionChip[]; valor: string; onPick: (v: string) => void; locale: 'es' | 'en' }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 10 }}>
      {ops.map((o) => {
        const activo = valor === o.valor
        return (
          <button key={o.valor} type="button" className="ct-chip" data-cursor="" onClick={() => onPick(o.valor)}
            style={{
              padding: '9px 16px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 300,
              border: `1px solid ${activo ? site.color.ink : `${site.color.ink}26`}`,
              background: activo ? site.color.ink : 'transparent',
              color: activo ? site.color.cream : site.color.ink,
            }}>
            {locale === 'en' ? o.en : o.es}
          </button>
        )
      })}
    </div>
  )
}

function Campo({ label, value, onChange, onBlur, required, type = 'text', ayuda, ...rest }: {
  label: string; value: string; onChange: (v: string) => void; onBlur: () => void
  required?: boolean; type?: string; ayuda?: string
  autoComplete?: string; inputMode?: 'email' | 'tel' | 'text'
}) {
  return (
    <div>
      <label style={labelStyle}>{label}{required ? ' *' : ''}</label>
      <input {...rest} type={type} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} style={inputStyle} />
      {ayuda && <p style={{ fontSize: 11, opacity: 0.4, fontWeight: 300, margin: '6px 0 0' }}>{ayuda}</p>}
    </div>
  )
}

function Opcional({ locale }: { locale: 'es' | 'en' }) {
  return <span style={{ opacity: 0.45, letterSpacing: 0, textTransform: 'none', fontSize: 11 }}>· {locale === 'en' ? 'optional' : 'opcional'}</span>
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

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 7, margin: 0,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 0', border: 'none', borderBottom: `1px solid ${site.color.ink}33`,
  background: 'transparent', fontSize: 15, fontWeight: 300, color: site.color.ink, fontFamily: 'inherit', outline: 'none',
  marginTop: 7,
}
const checkStyle: React.CSSProperties = {
  display: 'flex', gap: 10, fontSize: 12.5, fontWeight: 300, lineHeight: 1.5, opacity: 0.8, cursor: 'pointer',
}
