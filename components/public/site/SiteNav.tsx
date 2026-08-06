'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { site } from './theme'
import { useSite, href, SITE_BASE } from './SiteProvider'
import type { Locale } from '@/lib/web-publica'

const TABS: { path: string; es: string; en: string }[] = [
  { path: '/estudio',     es: 'Estudio',     en: 'Studio' },
  { path: '/proyectos',   es: 'Proyectos',   en: 'Projects' },
  { path: '/fp-tools',    es: 'FP Tools',    en: 'FP Tools' },
  { path: '/real-estate', es: 'Real Estate', en: 'Real Estate' },
  { path: '/contacto',    es: 'Contacto',    en: 'Contact' },
]

export function SiteNav() {
  const { locale, setLocale } = useSite()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  // Páginas cuyo TOPE es un hero oscuro a sangre (texto del nav en blanco arriba).
  // El resto arrancan con fondo claro (texto en negro).
  const isHome = pathname === SITE_BASE || pathname === `${SITE_BASE}/`
  const darkHero =
    isHome ||
    pathname === href('/estudio') ||
    pathname.startsWith(href('/proyectos/')) ||   // detalle de proyecto
    pathname.startsWith(href('/real-estate/'))    // detalle de propiedad

  // El nav vive EN la página, no pegado al viewport: al scrollear se va con el
  // contenido y para recuperarlo hay que volver arriba (de ahí el "volver arriba"
  // del cierre de página, SiteEndMark). Como solo se ve en el tope, el color del
  // texto se decide de una vez por lo que hay ahí arriba y ya no cambia: sin
  // listener de scroll ni banda de fondo, que solo harían falta si flotara sobre
  // el contenido.
  const isLight = darkHero

  // ── Amago de scroll → insinuación de la navegación ────────────────────────
  // La Home es una sola pantalla: el gesto de scroll rebota y no lleva a ningún
  // sitio. En vez de desperdiciarlo, su intensidad hace respirar las pestañas
  // ("si quieres ir a otro sitio, es por aquí").
  //
  // Dos reglas que aquí no se negocian:
  //  1. Solo se animan transform y opacity. La primera versión tocaba
  //     letter-spacing y font-weight, que son propiedades de layout: el navegador
  //     rehacía la línea entera en cada frame, las pestañas se empujaban unas a
  //     otras y el resultado iba a tirones. Ahora el grosor lo finge
  //     -webkit-text-stroke, que se pinta sin recolocar nada.
  //  2. Cada palabra escala desde SU propio centro (transform-origin: 50% 50%),
  //     no desde un extremo del header, y todas responden a la vez: es la
  //     navegación entera la que respira, no una ola que la recorre.
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    el.style.setProperty('--hint', '0')
    if (!isHome) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ac = new AbortController()
    const sig = { signal: ac.signal, passive: true } as AddEventListenerOptions
    // Resorte amortiguado: `target` es la energía que mete el gesto y se desinfla
    // sola en cuanto paras; `lift` la persigue con inercia. De ahí el rebote
    // mínimo al final, que es lo que separa esto de un fundido lineal.
    let target = 0, lift = 0, vel = 0, raf = 0, lastTouchY = 0

    const tick = () => {
      target *= 0.885                      // el impulso se desinfla
      vel += (target - lift) * 0.17        // atracción hacia el objetivo
      vel *= 0.76                          // amortiguación
      lift += vel
      if (target < 0.001 && Math.abs(lift) < 0.002 && Math.abs(vel) < 0.002) {
        lift = 0; vel = 0; raf = 0
        el.style.setProperty('--hint', '0')
        el.classList.remove('nav-hinting')
        return
      }
      // Se permite pasar de 1: ese exceso es el rebote, y en CSS solo engorda un
      // pelo la escala (opacidad y demás los recorta el navegador).
      el.style.setProperty('--hint', Math.max(0, Math.min(1.06, lift)).toFixed(3))
      raf = requestAnimationFrame(tick)
    }

    const bump = (delta: number) => {
      // Solo si de verdad no hay a dónde scrollear: el día que la Home crezca,
      // el gesto vuelve a ser un scroll normal y esto se calla solo.
      if (document.documentElement.scrollHeight - window.innerHeight > 4) return
      // Techo por evento: un trackpad dispara ráfagas de decenas de eventos y sin
      // tope el primer roce ya saturaría el efecto.
      target = Math.min(1, target + Math.min(Math.abs(delta) / 300, 0.13))
      if (!raf) { el.classList.add('nav-hinting'); raf = requestAnimationFrame(tick) }
    }

    window.addEventListener('wheel', (e) => bump((e as WheelEvent).deltaY), sig)
    window.addEventListener('touchstart', (e) => { lastTouchY = (e as TouchEvent).touches[0]?.clientY ?? 0 }, sig)
    window.addEventListener('touchmove', (e) => {
      const y = (e as TouchEvent).touches[0]?.clientY ?? lastTouchY
      bump(y - lastTouchY)
      lastTouchY = y
    }, sig)

    return () => {
      ac.abort(); cancelAnimationFrame(raf)
      el.style.setProperty('--hint', '0'); el.classList.remove('nav-hinting')
    }
  }, [isHome, pathname])

  const fg = isLight ? site.color.white : site.color.ink
  const isActive = (p: string) => pathname === href(p)

  return (
    <>
      {/* Scrim superior sutil solo sobre hero oscuro, para legibilidad del texto
          blanco. Absoluto como el nav: se va con él al scrollear. */}
      {isLight && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140, zIndex: 40, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.38), rgba(0,0,0,0))' }} />
      )}
      {/* Absoluto, no fijo: anclado al tope del documento. Siempre transparente
          (sin banda ni borde); el color del texto se adapta a lo que hay debajo. */}
      <header ref={headerRef} style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, height: 72,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${site.gutter}`, fontFamily: site.font,
        background: 'transparent',
        // El halo del amago tiene que leerse sobre foto oscura y sobre crema.
        ['--glow' as string]: isLight ? 'rgba(255,255,255,0.14)' : 'rgba(20,20,20,0.07)',
      }}>
        {/* Logo */}
        <Link href={href('/')} style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={isLight ? '/FORMA_PRIMA_BLANCO.png' : '/FORMA_PRIMA_NEGRO.png'} alt="Forma Prima"
            style={{ height: 22, width: 'auto', display: 'block', transition: `opacity .3s ${site.ease}` }} />
        </Link>

        {/* Tabs (desktop) */}
        <nav className="site-nav-desktop" style={{ display: 'flex', gap: 34, alignItems: 'center', position: 'relative' }}>
          {TABS.map((t) => (
            <Link key={t.path} href={href(t.path)} className="site-tab" data-cursor=""
              data-active={isActive(t.path) ? '1' : undefined} style={{ color: fg }}>
              <span className="site-tab-txt">{locale === 'en' ? t.en : t.es}</span>
            </Link>
          ))}
          <LangToggle locale={locale} setLocale={setLocale} fg={fg} />
        </nav>

        {/* Hamburguesa (móvil) */}
        <button className="site-nav-burger" onClick={() => setMenuOpen(true)} aria-label="Menú"
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', flexDirection: 'column', gap: 5, padding: 4 }}>
          <span style={{ width: 22, height: 1.5, background: fg, display: 'block' }} />
          <span style={{ width: 22, height: 1.5, background: fg, display: 'block' }} />
        </button>
      </header>

      {/* Menú móvil */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: site.color.stage, color: site.color.white,
          display: 'flex', flexDirection: 'column', padding: site.gutter, fontFamily: site.font }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setMenuOpen(false)} aria-label="Cerrar"
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 40 }}>
            {TABS.map((t) => (
              <Link key={t.path} href={href(t.path)} onClick={() => setMenuOpen(false)}
                style={{ fontSize: 26, fontWeight: 300, letterSpacing: '0.02em', color: '#fff', textDecoration: 'none' }}>
                {locale === 'en' ? t.en : t.es}
              </Link>
            ))}
          </nav>
          <div style={{ marginTop: 'auto' }}>
            <LangToggle locale={locale} setLocale={(l) => { setLocale(l) }} fg="#fff" />
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        /* --hint (0..1, con rebote hasta 1.06) lo escribe el resorte del amago
           sobre el <header>. Todo lo que se mueve de aquí abajo es transform u
           opacity: cero layout, cero reflow, todo en el compositor. */
        .site-tab {
          position: relative;
          display: inline-block;
          font-size: 11px; text-decoration: none;
          /* Métrica CONGELADA: el tracking no se anima nunca. Animarlo era lo que
             hacía que las pestañas se empujaran entre sí en cada frame. */
          letter-spacing: ${site.track.wide};
          text-transform: uppercase;
          font-weight: 400;
          opacity: calc(0.7 + var(--hint, 0) * 0.3);
          transition: color .4s cubic-bezier(.4,0,.2,1), opacity .55s cubic-bezier(.22,1,.36,1);
        }
        .site-tab[data-active="1"] { opacity: 1; font-weight: 500; }

        /* La palabra crece desde su propio centro. El texto va en un span aparte
           para que el <a> conserve su caja (y su área de clic) mientras la palabra
           escala por encima. */
        .site-tab-txt {
          display: inline-block;
          transform-origin: 50% 50%;
          transform: scale(calc(1 + var(--hint, 0) * 0.09)) translateY(calc(var(--hint, 0) * -1.5px));
          /* Grosor fingido con contorno: engorda el trazo de forma CONTINUA sin
             recolocar nada. Helixa solo tiene 300/400/700, así que interpolar
             font-weight daría un salto seco justo a mitad del gesto. */
          -webkit-text-stroke: calc(var(--hint, 0) * 0.32px) currentColor;
        }

        /* Highlight propio de cada palabra, centrado en ella y creciendo con ella:
           no un halo único para todo el header. */
        .site-tab::before {
          content: ''; position: absolute; left: 50%; top: 50%;
          width: calc(100% + 30px); height: 34px; border-radius: 999px;
          background: radial-gradient(52% 58% at 50% 50%, var(--glow), transparent 72%);
          transform: translate(-50%, -50%) scale(calc(0.62 + var(--hint, 0) * 0.38));
          opacity: var(--hint, 0); pointer-events: none;
        }

        /* Subrayado que se abre desde el centro hacia los dos lados. */
        .site-tab::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -7px; height: 1px;
          background: currentColor; opacity: 0.9;
          transform: scaleX(var(--hint, 0)); transform-origin: 50% 50%;
          transition: transform .5s cubic-bezier(.22,1,.36,1);
        }
        .site-tab:hover { opacity: 1 !important; }
        .site-tab:hover::after { transform: scaleX(1); }
        /* Durante el gesto manda el resorte: la transición del subrayado tiene que
           quitarse de en medio o iría siempre un paso por detrás. */
        .nav-hinting .site-tab::after,
        .nav-hinting .site-tab { transition: none; }
        .nav-hinting .site-tab-txt { will-change: transform; }

        /* En móvil no hay pestañas que encender: respira la hamburguesa. También
           con transform, no con width/height. */
        .site-nav-burger { opacity: calc(0.78 + var(--hint, 0) * 0.22); }
        .site-nav-burger span {
          transform: scaleX(calc(1 + var(--hint, 0) * 0.2)) scaleY(calc(1 + var(--hint, 0) * 0.55));
          transform-origin: 50% 50%;
        }

        @media (prefers-reduced-motion: reduce) {
          .site-tab, .site-tab-txt, .site-tab::after, .site-tab::before { transition: none; }
        }
        @media (max-width: 860px) {
          .site-nav-desktop { display: none !important; }
          .site-nav-burger  { display: flex !important; }
        }
      ` }} />
    </>
  )
}

function LangToggle({ locale, setLocale, fg }: { locale: Locale; setLocale: (l: Locale) => void; fg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, letterSpacing: '0.1em' }}>
      {(['es', 'en'] as Locale[]).map((l, i) => (
        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i === 1 && <span style={{ color: fg, opacity: 0.35 }}>/</span>}
          <button onClick={() => setLocale(l)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: fg, opacity: locale === l ? 1 : 0.5, fontWeight: locale === l ? 600 : 400, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 11, fontFamily: 'inherit' }}>
            {l}
          </button>
        </span>
      ))}
    </div>
  )
}
