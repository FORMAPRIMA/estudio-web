'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { site, display } from './theme'
import { useSite, href, SITE_BASE } from './SiteProvider'
import { Reveal } from './Reveal'

// Cierre del sitio. Va EN EL FLUJO al final de cada página, no como barra fija:
// un footer flotante que aparece y desaparece no puede sostener columnas de
// enlaces, y además al ocultarse cancelaba el scroll suave del "volver arriba".
//
// No aparece en la Home a propósito: es una sola pantalla que no scrollea, y
// añadirle un footer la volvería scrollable — cargándose el amago del gesto que
// enciende la navegación.

const ISOTIPO = '/ISOTIPO%20NEGRO%20cropped.png'
const WORDMARK = '/FORMA_PRIMA_NEGRO.png'
const INSTAGRAM = 'https://www.instagram.com/forma.prima/'

const TABS: { path: string; es: string; en: string }[] = [
  { path: '/estudio',     es: 'Estudio',     en: 'Studio' },
  { path: '/proyectos',   es: 'Proyectos',   en: 'Projects' },
  { path: '/fp-tools',    es: 'FP Tools',    en: 'FP Tools' },
  { path: '/real-estate', es: 'Real Estate', en: 'Real Estate' },
  { path: '/contacto',    es: 'Contacto',    en: 'Contact' },
]

export interface FooterDatos {
  email: string
  telefono: string
  direccion: string
}

export function SiteFooter({ datos, anio }: { datos: FooterDatos; anio: number }) {
  const { locale } = useSite()
  const pathname = usePathname()
  const isHome = pathname === SITE_BASE || pathname === `${SITE_BASE}/`
  if (isHome) return null

  const t = (es: string, en: string) => (locale === 'en' ? en : es)

  return (
    <footer style={{
      position: 'relative', overflow: 'hidden',
      background: site.color.cream, color: site.color.ink, fontFamily: site.font,
      borderTop: `1px solid rgba(20,20,20,0.1)`,
      padding: `clamp(58px, 9vh, 112px) ${site.gutter} 30px`,
      marginTop: 'clamp(40px, 8vh, 90px)',
    }}>
      {/* Isotipo a sangre por la esquina, casi invisible: da peso gráfico al
          cierre sin competir con nada. Puramente decorativo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ISOTIPO} alt="" aria-hidden="true" draggable={false}
        style={{ position: 'absolute', right: '-3%', bottom: '-24%', height: 'clamp(190px, 27vw, 350px)',
          width: 'auto', opacity: 0.05, pointerEvents: 'none', userSelect: 'none' }} />

      <div style={{ position: 'relative', maxWidth: site.maxWidth, margin: '0 auto' }}>

        {/* Fila superior: marca a un lado, volver arriba al otro. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 30, flexWrap: 'wrap' }}>
          <Reveal y={16}>
            <Link href={href('/')} style={{ display: 'inline-block' }} data-cursor="">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={WORDMARK} alt="Forma Prima" style={{ height: 21, width: 'auto', display: 'block' }} />
            </Link>
            <p style={{ margin: '18px 0 0', fontSize: display.eyebrow, letterSpacing: site.track.ultra,
              textTransform: 'uppercase', opacity: 0.42, maxWidth: '26ch', lineHeight: 2 }}>
              {t('Arquitectura · Interiorismo · Dirección de obra', 'Architecture · Interiors · Site management')}
            </p>
          </Reveal>

          <Reveal y={16} delay={80}>
            <VolverArriba etiqueta={t('Volver arriba', 'Back to top')} />
          </Reveal>
        </div>

        {/* Columnas */}
        <div className="ft-cols" style={{ display: 'grid', gap: '46px 30px', margin: 'clamp(52px, 8vh, 96px) 0 0' }}>
          <Reveal y={18} delay={40}>
            <Columna titulo={t('Contacto', 'Contact')}>
              {datos.email && <Enlace externo href={`mailto:${datos.email}`}>{datos.email}</Enlace>}
              {datos.telefono && <Enlace externo href={`tel:${datos.telefono.replace(/\s+/g, '')}`}>{datos.telefono}</Enlace>}
              {datos.direccion && <Texto>{datos.direccion}</Texto>}
            </Columna>
          </Reveal>

          <Reveal y={18} delay={120}>
            <Columna titulo={t('Navegación', 'Navigation')}>
              {TABS.map((tab) => (
                <Enlace key={tab.path} href={href(tab.path)}>{locale === 'en' ? tab.en : tab.es}</Enlace>
              ))}
            </Columna>
          </Reveal>

          <Reveal y={18} delay={200}>
            <Columna titulo={t('Legal', 'Legal')}>
              <Enlace href="/aviso-legal">{t('Aviso legal', 'Legal notice')}</Enlace>
              <Enlace href="/privacidad">{t('Política de privacidad', 'Privacy policy')}</Enlace>
            </Columna>
          </Reveal>

          <Reveal y={18} delay={280}>
            <Columna titulo={t('Síguenos', 'Follow')}>
              <Enlace externo href={INSTAGRAM}>@forma.prima</Enlace>
            </Columna>
          </Reveal>
        </div>

        {/* Pie de pie: la letra pequeña. */}
        <div className="ft-legal" style={{
          display: 'flex', justifyContent: 'space-between', gap: '8px 26px', flexWrap: 'wrap',
          marginTop: 'clamp(46px, 7vh, 84px)', paddingTop: 22, borderTop: '1px solid rgba(20,20,20,0.09)',
          fontSize: 10.5, letterSpacing: site.track.tight, opacity: 0.4,
        }}>
          {/* Sin repetir "Madrid": ya está en la dirección de la columna. */}
          <span>© {anio} Forma Prima Arquitectos, S.L.</span>
          {/* NIF XXXX: provisional hasta que Jose pase el de la nueva sociedad. */}
          <span>NIF XXXX</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ft-cols { grid-template-columns: 1fr; }
        @media (min-width: 620px)  { .ft-cols { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1000px) { .ft-cols { grid-template-columns: repeat(4, 1fr); } }

        /* Enlaces: filete que se abre desde la izquierda y un empujón mínimo del
           texto. Solo transform y opacity, nada que provoque reflow. */
        .ft-link { position: relative; display: inline-block; text-decoration: none; color: inherit; }
        .ft-link > span {
          display: inline-block; opacity: 0.78;
          transform: translateX(0);
          transition: transform .5s cubic-bezier(.22,1,.36,1), opacity .35s ease;
        }
        .ft-link::after {
          content: ''; position: absolute; left: 0; bottom: -3px; width: 100%; height: 1px;
          background: currentColor; opacity: 0.55;
          transform: scaleX(0); transform-origin: left center;
          transition: transform .55s cubic-bezier(.22,1,.36,1);
        }
        .ft-link:hover > span { opacity: 1; transform: translateX(3px); }
        .ft-link:hover::after { transform: scaleX(1); }

        .ft-top { display: inline-flex; align-items: center; gap: 11px; background: none; border: none;
          padding: 6px 0; cursor: pointer; font-family: inherit; color: inherit; }
        .ft-top-lbl { opacity: 0.55; transition: opacity .35s ease; }
        .ft-top:hover .ft-top-lbl { opacity: 1; }
        /* Flecha: un asta con dos aspas, dibujada en CSS. Sube y el asta se estira
           al pasar por encima; es toda la pista de dirección que hace falta. */
        .ft-arrow { position: relative; display: block; width: 9px; height: 30px;
          transition: transform .55s cubic-bezier(.22,1,.36,1); }
        .ft-arrow::before { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px;
          background: currentColor; opacity: 0.5; transform: translateX(-50%) scaleY(1); transform-origin: bottom center;
          transition: transform .55s cubic-bezier(.22,1,.36,1), opacity .35s ease; }
        .ft-arrow::after { content: ''; position: absolute; left: 50%; top: 0; width: 6px; height: 6px;
          border-left: 1px solid currentColor; border-top: 1px solid currentColor;
          transform: translateX(-50%) rotate(45deg); }
        .ft-top:hover .ft-arrow { transform: translateY(-5px); }
        .ft-top:hover .ft-arrow::before { transform: translateX(-50%) scaleY(1.22); opacity: 0.9; }

        @media (prefers-reduced-motion: reduce) {
          .ft-link > span, .ft-link::after, .ft-arrow, .ft-arrow::before, .ft-top-lbl { transition: none; }
        }
      ` }} />
    </footer>
  )
}

function Columna({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 20px', fontSize: 10, fontWeight: 500, letterSpacing: site.track.ultra,
        textTransform: 'uppercase', opacity: 0.38 }}>{titulo}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 13, fontSize: 13, fontWeight: 300 }}>
        {children}
      </div>
    </div>
  )
}

function Enlace({ href: h, children, externo }: { href: string; children: React.ReactNode; externo?: boolean }) {
  if (externo) {
    return (
      <a href={h} className="ft-link" data-cursor=""
        {...(h.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        <span>{children}</span>
      </a>
    )
  }
  return <Link href={h} className="ft-link" data-cursor=""><span>{children}</span></Link>
}

function Texto({ children }: { children: React.ReactNode }) {
  // pre-line: la dirección se guarda en el CMS con un salto de línea real
  // ("Príncipe de Vergara 56, 6ª 2ª\n28006 Madrid") y hay que respetarlo.
  return <span style={{ opacity: 0.62, lineHeight: 1.65, maxWidth: '24ch', whiteSpace: 'pre-line' }}>{children}</span>
}

/**
 * Vuelve al tope con una interpolación propia en rAF, no con
 * scrollTo({behavior:'smooth'}).
 *
 * El scroll suave nativo lo cancela cualquier cambio de foco o cualquier
 * scrollIntoView que dispare el navegador por el camino: de ahí que antes se
 * detuviera a medias, en el primer campo del formulario. Aquí escribimos scrollTop
 * en cada frame, así que nada nos interrumpe salvo el propio usuario — que sí debe
 * poder abortarlo (si toca la rueda, paramos y le dejamos el control).
 */
function VolverArriba({ etiqueta }: { etiqueta: string }) {
  const raf = useRef(0)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const subir = () => {
    // Un input con el foco se lo reclama el navegador a mitad de camino.
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    cancelAnimationFrame(raf.current)

    const desde = window.scrollY || document.documentElement.scrollTop
    if (desde <= 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { window.scrollTo(0, 0); return }

    // globals.css declara `html { scroll-behavior: smooth }`. Con eso puesto, CADA
    // escritura de scrollTop lanza además la animación nativa hacia ese valor: como
    // le cambiamos el destino cada frame, la página persigue nuestra interpolación
    // con retraso y el viaje se arrastra. Lo desactivamos mientras dura el nuestro.
    const raiz = document.documentElement
    const previo = raiz.style.scrollBehavior
    raiz.style.scrollBehavior = 'auto'

    // Recorridos largos no deben tardar proporcionalmente más: el tiempo crece con
    // la raíz de la distancia y se corta en 760 ms.
    const dur = Math.min(760, 280 + Math.sqrt(desde) * 14)
    const t0 = performance.now()
    let abortado = false
    const abortar = () => { abortado = true }
    window.addEventListener('wheel', abortar, { passive: true, once: true })
    window.addEventListener('touchstart', abortar, { passive: true, once: true })

    const limpiar = () => {
      raiz.style.scrollBehavior = previo
      window.removeEventListener('wheel', abortar)
      window.removeEventListener('touchstart', abortar)
    }

    const paso = (ahora: number) => {
      if (abortado) { limpiar(); return }
      const p = Math.min(1, (ahora - t0) / dur)
      // easeOutQuint: sale disparado y aterriza muy suave. Para "volver arriba" el
      // arranque lento de un ease-in-out se siente como que el botón no responde.
      const e = 1 - Math.pow(1 - p, 5)
      const y = desde * (1 - e)
      raiz.scrollTop = y
      document.body.scrollTop = y
      if (p < 1) { raf.current = requestAnimationFrame(paso); return }
      // Cierre exacto: el redondeo de subpíxeles puede dejarlo en 0,4 px.
      raiz.scrollTop = 0
      document.body.scrollTop = 0
      limpiar()
    }
    raf.current = requestAnimationFrame(paso)
  }

  return (
    <button type="button" onClick={subir} className="ft-top" data-cursor=""
      style={{ fontSize: 10, letterSpacing: site.track.ultra, textTransform: 'uppercase' }}>
      <span className="ft-arrow" aria-hidden="true" />
      <span className="ft-top-lbl">{etiqueta}</span>
    </button>
  )
}
