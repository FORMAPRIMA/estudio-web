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

  // tone 'light' = texto blanco (sobre oscuro); 'dark' = texto negro (sobre claro).
  const [tone, setTone] = useState<'light' | 'dark'>(darkHero ? 'light' : 'dark')
  // El nav va fijo arriba en todas las páginas, pero transparente sobre el
  // contenido claro se vuelve ilegible en cuanto empieza a pasar texto por
  // debajo. En cuanto se abandona el tope aparece una banda con desenfoque.
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24)
      // En páginas de hero oscuro, al pasar el hero el fondo se vuelve claro → negro.
      if (!darkHero) { setTone('dark'); return }
      setTone(window.scrollY > window.innerHeight * 0.78 ? 'dark' : 'light')
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [darkHero, pathname])

  // ── Amago de scroll → insinuación de la navegación ────────────────────────
  // La Home es una sola pantalla: el gesto de scroll rebota y no lleva a ningún
  // sitio. En vez de desperdiciarlo, su intensidad enciende las pestañas ("si
  // quieres ir a otro sitio, es por aquí"). La energía se escribe como variable
  // CSS sobre el header y todo el efecto es CSS: así se anima a 60 fps sin
  // provocar un re-render de React por frame.
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    el.style.setProperty('--hint', '0')
    if (!isHome) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ac = new AbortController()
    const sig = { signal: ac.signal, passive: true } as AddEventListenerOptions
    let energy = 0, raf = 0, lastTouchY = 0

    const decay = () => {
      // Caída exponencial: sube de golpe con el gesto y se apaga sola.
      energy *= 0.955
      if (energy < 0.008) { energy = 0; raf = 0 }
      el.style.setProperty('--hint', energy.toFixed(3))
      if (energy) raf = requestAnimationFrame(decay)
    }

    const bump = (delta: number) => {
      // Solo si de verdad no hay a dónde scrollear: el día que la Home crezca,
      // el gesto vuelve a ser un scroll normal y esto se calla solo.
      if (document.documentElement.scrollHeight - window.innerHeight > 4) return
      // Techo por evento: un trackpad dispara ráfagas de decenas de eventos y sin
      // tope el primer roce ya saturaría el efecto.
      energy = Math.min(1, energy + Math.min(Math.abs(delta) / 260, 0.14))
      if (!raf) raf = requestAnimationFrame(decay)
    }

    window.addEventListener('wheel', (e) => bump((e as WheelEvent).deltaY), sig)
    window.addEventListener('touchstart', (e) => { lastTouchY = (e as TouchEvent).touches[0]?.clientY ?? 0 }, sig)
    window.addEventListener('touchmove', (e) => {
      const y = (e as TouchEvent).touches[0]?.clientY ?? lastTouchY
      bump(y - lastTouchY)
      lastTouchY = y
    }, sig)

    return () => { ac.abort(); cancelAnimationFrame(raf); el.style.setProperty('--hint', '0') }
  }, [isHome, pathname])

  const isLight = tone === 'light'
  const fg = isLight ? site.color.white : site.color.ink
  const isActive = (p: string) => pathname === href(p)
  // Solo con texto en negro: sobre el hero oscuro ya hay scrim y una banda crema
  // ahí cortaría la foto a sangre.
  const banda = scrolled && !isLight

  return (
    <>
      {/* Scrim superior sutil solo sobre hero oscuro, para legibilidad del texto blanco */}
      {isLight && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 140, zIndex: 40, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.38), rgba(0,0,0,0))' }} />
      )}
      {/* Transparente en el tope; con banda desenfocada en cuanto se scrollea sobre
          contenido claro. El color del texto se adapta al fondo. */}
      <header ref={headerRef} style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 72,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${site.gutter}`, fontFamily: site.font,
        background: banda ? 'rgba(244,243,240,0.78)' : 'transparent',
        backdropFilter: banda ? 'blur(14px) saturate(1.1)' : 'none',
        WebkitBackdropFilter: banda ? 'blur(14px) saturate(1.1)' : 'none',
        borderBottom: `1px solid ${banda ? 'rgba(20,20,20,0.07)' : 'transparent'}`,
        transition: `background .45s ${site.ease}, border-color .45s ${site.ease}`,
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
          {TABS.map((t, i) => (
            <Link key={t.path} href={href(t.path)} className="site-tab" data-cursor=""
              data-active={isActive(t.path) ? '1' : undefined}
              // --i escalona el encendido: la insinuación recorre las pestañas de
              // izquierda a derecha en vez de saltar todas a la vez.
              style={{ color: fg, ['--i' as string]: i }}>
              {locale === 'en' ? t.en : t.es}
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
        /* --hint (0..1) lo escribe el rAF del amago de scroll sobre el <header>.
           --lift es ese mismo valor retrasado según la posición de la pestaña:
           con poca energía solo asoma la primera, con el gesto entero se encienden
           todas. De ahí el degradado que recorre la navegación. */
        .site-tab {
          position: relative;
          --lift: clamp(0, calc((var(--hint, 0) - var(--i, 0) * 0.055) * 1.45), 1);
          font-size: 11px; text-transform: uppercase; text-decoration: none;
          letter-spacing: calc(${site.track.wide} + var(--lift) * 0.02em);
          opacity: calc(0.72 + var(--lift) * 0.28);
          /* Con Helixa (300/400/700) el peso salta a negrita pasada la mitad del
             gesto; el text-shadow engorda el trazo antes, para que el salto no
             se note y la transición se lea continua. */
          font-weight: calc(400 + var(--lift) * 300);
          text-shadow: 0 0 calc(var(--lift) * 0.42px) currentColor;
          transition: color .4s cubic-bezier(.4,0,.2,1);
        }
        .site-tab[data-active="1"] { opacity: 1; font-weight: calc(500 + var(--lift) * 200); }
        .site-tab::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -6px; height: 1px;
          background: currentColor; transform: scaleX(var(--lift)); transform-origin: left center;
          opacity: calc(0.35 + var(--lift) * 0.65);
          transition: transform .45s cubic-bezier(.4,0,.2,1);
        }
        /* El halo detrás del grupo: lo que hace que se lea como "highlight" y no
           como un cambio de peso suelto. */
        .site-nav-desktop::before {
          content: ''; position: absolute; inset: -16px -26px; border-radius: 999px;
          background: radial-gradient(58% 150% at 50% 50%, var(--glow), transparent 72%);
          opacity: var(--hint, 0); pointer-events: none;
        }
        .site-tab:hover { opacity: 1 !important; }
        .site-tab:hover::after { transform: scaleX(1); opacity: 1; }
        /* En móvil no hay pestañas que encender: el gesto engorda la hamburguesa. */
        .site-nav-burger { opacity: calc(0.78 + var(--hint, 0) * 0.22); }
        .site-nav-burger span {
          width: calc(22px + var(--hint, 0) * 5px) !important;
          height: calc(1.5px + var(--hint, 0) * 0.9px) !important;
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
