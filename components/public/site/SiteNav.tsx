'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const onScroll = () => {
      // En páginas de hero oscuro, al pasar el hero el fondo se vuelve claro → negro.
      if (!darkHero) { setTone('dark'); return }
      setTone(window.scrollY > window.innerHeight * 0.78 ? 'dark' : 'light')
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [darkHero, pathname])

  const isLight = tone === 'light'
  const fg = isLight ? site.color.white : site.color.ink
  const isActive = (p: string) => pathname === href(p)

  return (
    <>
      {/* Scrim superior sutil solo sobre hero oscuro, para legibilidad del texto blanco */}
      {isLight && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 140, zIndex: 40, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.38), rgba(0,0,0,0))' }} />
      )}
      {/* Nav SIEMPRE transparente (sin banda ni borde); el color del texto se adapta al fondo. */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 72,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${site.gutter}`, fontFamily: site.font,
        background: 'transparent',
      }}>
        {/* Logo */}
        <Link href={href('/')} style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={isLight ? '/FORMA_PRIMA_BLANCO.png' : '/FORMA_PRIMA_NEGRO.png'} alt="Forma Prima"
            style={{ height: 22, width: 'auto', display: 'block', transition: `opacity .3s ${site.ease}` }} />
        </Link>

        {/* Tabs (desktop) */}
        <nav className="site-nav-desktop" style={{ display: 'flex', gap: 34, alignItems: 'center' }}>
          {TABS.map((t) => (
            <Link key={t.path} href={href(t.path)} className="site-tab" data-cursor=""
              style={{
                fontSize: 11, letterSpacing: site.track.wide, textTransform: 'uppercase', textDecoration: 'none',
                color: fg, opacity: isActive(t.path) ? 1 : 0.72, fontWeight: isActive(t.path) ? 500 : 400,
                transition: `opacity .3s ${site.ease}, color .4s ${site.ease}`,
              }}>
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
        .site-tab { position: relative; }
        .site-tab::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -6px; height: 1px;
          background: currentColor; transform: scaleX(0); transform-origin: left center;
          transition: transform .45s cubic-bezier(.4,0,.2,1);
        }
        .site-tab:hover { opacity: 1 !important; }
        .site-tab:hover::after { transform: scaleX(1); }
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
