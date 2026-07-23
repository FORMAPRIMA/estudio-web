'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { submitContactoWeb } from '@/app/actions/web-publica'
import type { WebProyecto } from '@/lib/web-publica'
import MadridProjectsMap from './MadridProjectsMap'

const LOGO_WHITE = '/wip/logo-h.png'            // logo horizontal (negro; se pinta en blanco con filtro CSS)
const ISOTIPO_DARK = '/ISOTIPO%20NEGRO.png'     // isotipo oscuro (esquina, modo abierto/claro)

interface ProjData {
  n: string
  loc: string
  yr: string
  note: string
  hero: string
  heroMobile: string
  gallery: string[]
}

export function WipLanding({ proyectos }: { proyectos: WebProyecto[] }) {
  const root = useRef<HTMLDivElement>(null)
  const [mapOpen, setMapOpen] = useState(false)

  const P = useMemo<ProjData[]>(
    () =>
      proyectos.map((p) => {
        const gallery = (p.galeria && p.galeria.length ? p.galeria : [p.hero_url].filter(Boolean)) as string[]
        return {
          n: p.nombre,
          loc: p.ubicacion || '',
          yr: p.anio || '',
          note: p.nota || '',
          hero: p.hero_url || '',
          heroMobile: p.hero_mobile_url || '',
          gallery,
        }
      }),
    [proyectos]
  )

  useEffect(() => {
    const D = root.current
    if (!D) return
    const ac = new AbortController()
    const sig = { signal: ac.signal }
    const $ = (id: string) => D.querySelector<HTMLElement>('#' + id)!

    const N = P.length
    const DURATION = 6500

    // Móvil: usa la foto vertical (override) si existe.
    const mq = window.matchMedia('(max-width: 640px)')
    let isMobile = mq.matches
    const heroSrc = (p: ProjData) => (isMobile && p.heroMobile ? p.heroMobile : p.hero)

    // Preload (solo las fotos relevantes para el viewport actual)
    Array.from(new Set(P.flatMap((p) => [heroSrc(p), ...p.gallery]).filter(Boolean))).forEach((src) => {
      const im = new Image()
      im.src = src
    })

    // Refs
    const heroBox = $('fp-hero')
    let front = $('fp-hero-a') as HTMLImageElement
    let back = $('fp-hero-b') as HTMLImageElement
    const heroScrim = $('fp-hero-scrim')
    const centerScrim = $('fp-scrim')
    const center = $('fp-center')
    const logoCorner = $('fp-logo-corner')
    const contact = $('fp-contact')
    const mapBtn = $('fp-map-btn')
    const closeBtn = $('fp-close')
    const openLayer = $('fp-open')
    const sheet = $('fp-sheet')
    const oTitle = $('fp-open-title')
    const oType = $('fp-open-type')
    const oSub = $('fp-open-sub')
    const gImgs = [$('fp-g0'), $('fp-g1'), $('fp-g2')] as HTMLImageElement[]
    const tinted = Array.from(D.querySelectorAll<HTMLElement>('.fp-tint'))
    const buttons = Array.from(D.querySelectorAll<HTMLElement>('#fp-index button'))

    let current = 0
    let mode: 'ambient' | 'open' = 'ambient'
    let timer: ReturnType<typeof setInterval> | null = null

    const setLight = (light: boolean) => {
      const col = light ? '#141414' : '#ffffff'
      tinted.forEach((el) => { el.style.color = col })
    }

    const showHero = (i: number) => {
      back.src = heroSrc(P[i])
      back.style.opacity = '1'
      front.style.opacity = '0'
      const t = front; front = back; back = t
    }

    // Cambio de breakpoint (rotar el móvil, redimensionar): recoloca la foto actual.
    const onMq = (e: MediaQueryListEvent) => {
      isMobile = e.matches
      if (N > 0) front.src = heroSrc(P[current])
    }
    mq.addEventListener('change', onMq)

    const setIndexUI = (i: number, fill: boolean) => {
      buttons.forEach((b, k) => {
        b.style.opacity = k === i ? '1' : '0.42'
        const u = b.querySelector<HTMLElement>('.fp-underline')!
        if (k === i) {
          if (fill && mode === 'ambient') {
            u.style.transition = 'none'
            u.style.transform = 'scaleX(0)'
            void u.offsetWidth
            u.style.transition = 'transform ' + DURATION + 'ms linear'
            u.style.transform = 'scaleX(1)'
          } else {
            u.style.transition = 'transform .5s ease'
            u.style.transform = 'scaleX(1)'
          }
        } else {
          u.style.transition = 'transform .4s ease'
          u.style.transform = 'scaleX(0)'
        }
      })
    }

    const go = (i: number, fill: boolean) => { current = i; showHero(i); setIndexUI(i, fill) }

    const startTimer = () => {
      stopTimer()
      if (N < 2) return
      timer = setInterval(() => { if (mode === 'ambient') go((current + 1) % N, true) }, DURATION)
    }
    const stopTimer = () => { if (timer) { clearInterval(timer); timer = null } }

    const openProject = (i: number) => {
      current = i
      stopTimer()
      mode = 'open'
      const p = P[i]
      oTitle.textContent = p.n
      oType.textContent = p.note
      oSub.textContent = [p.loc, p.yr].filter(Boolean).join(' · ')
      gImgs.forEach((im, k) => { im.src = p.gallery[k] || '' })
      sheet.style.opacity = '0'
      openLayer.style.opacity = '1'
      openLayer.style.pointerEvents = 'auto'
      requestAnimationFrame(() => { sheet.style.opacity = '1' })
      setLight(true)
      center.style.opacity = '0'
      centerScrim.style.opacity = '0'
      heroScrim.style.opacity = '0'
      logoCorner.style.opacity = '1'
      contact.style.opacity = '0'; contact.style.pointerEvents = 'none'
      mapBtn.style.opacity = '0'; mapBtn.style.pointerEvents = 'none'
      closeBtn.style.opacity = '1'; closeBtn.style.pointerEvents = 'auto'
      setIndexUI(i, false)
    }

    const closeProject = () => {
      mode = 'ambient'
      openLayer.style.opacity = '0'
      openLayer.style.pointerEvents = 'none'
      sheet.style.opacity = '0'
      setLight(false)
      center.style.opacity = '1'
      centerScrim.style.opacity = '1'
      heroScrim.style.opacity = '1'
      logoCorner.style.opacity = '0'
      contact.style.opacity = '0.92'; contact.style.pointerEvents = 'auto'
      mapBtn.style.opacity = '0.92'; mapBtn.style.pointerEvents = 'auto'
      closeBtn.style.opacity = '0'; closeBtn.style.pointerEvents = 'none'
      go(current, true)
      startTimer()
    }

    buttons.forEach((b) => {
      const idx = parseInt(b.getAttribute('data-idx') || '0', 10)
      b.addEventListener('mouseenter', () => { if (mode === 'ambient') { stopTimer(); go(idx, false) } }, sig)
      b.addEventListener('mouseleave', () => { if (mode === 'ambient') { startTimer(); go(current, true) } }, sig)
      b.addEventListener('click', () => { openProject(idx) }, sig)
    })
    closeBtn.addEventListener('click', closeProject, sig)
    openLayer.addEventListener('click', (e) => { if (e.target === openLayer) closeProject() }, sig)

    // Parallax + cursor (solo puntero fino y sin reduce-motion)
    const fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let tx = 0, ty = 0, cx = 0, cy = 0, curX = -100, curY = -100, cgX = -100, cgY = -100
    let rafId = 0
    const cursor = $('fp-cursor')
    const ring = $('fp-cursor-ring')
    const label = $('fp-cursor-label')

    if (!reduce) {
      const stage = $('fp-stage')

      if (fine) {
        // Escritorio: parallax con el ratón + cursor personalizado
        cursor.style.display = 'block'
        stage.style.cursor = 'none'
        document.addEventListener('mousemove', (e) => {
          const w = window.innerWidth, h = window.innerHeight
          tx = (e.clientX / w - 0.5) * -22
          ty = (e.clientY / h - 0.5) * -22
          curX = e.clientX; curY = e.clientY
        }, sig)
      } else {
        // Móvil: parallax con la inclinación del dispositivo (giroscopio)
        const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
        let baseBeta: number | null = null
        const onOrient = (e: DeviceOrientationEvent) => {
          const g = e.gamma ?? 0                  // izquierda-derecha
          const b = e.beta ?? 0                   // adelante-atrás
          if (baseBeta === null) baseBeta = b     // calibra con la inclinación inicial
          tx = clamp(g / 26, -1, 1) * -22
          ty = clamp((b - baseBeta) / 26, -1, 1) * -22
        }
        const enableTilt = () => window.addEventListener('deviceorientation', onOrient, sig)
        const DOE = window.DeviceOrientationEvent as any
        if (DOE && typeof DOE.requestPermission === 'function') {
          // iOS 13+: requiere permiso de movimiento tras un gesto del usuario
          const ask = () => { DOE.requestPermission().then((s: string) => { if (s === 'granted') enableTilt() }).catch(() => {}) }
          document.addEventListener('touchend', ask, { once: true, signal: ac.signal })
          document.addEventListener('click', ask, { once: true, signal: ac.signal })
        } else if (DOE) {
          enableTilt()
        }
      }

      const raf = () => {
        cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06
        heroBox.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)'
        if (fine) {
          cgX += (curX - cgX) * 0.18; cgY += (curY - cgY) * 0.18
          cursor.style.transform = 'translate(' + cgX.toFixed(1) + 'px,' + cgY.toFixed(1) + 'px) translate(-50%,-50%)'
        }
        rafId = requestAnimationFrame(raf)
      }
      rafId = requestAnimationFrame(raf)

      if (fine) {
        D.querySelectorAll<HTMLElement>('.fp-interactive').forEach((el) => {
          el.addEventListener('mouseenter', () => {
            const txt = el.getAttribute('data-cursor')
            if (txt) {
              ring.style.width = '58px'; ring.style.height = '58px'
              label.textContent = txt; label.style.opacity = '1'
            } else {
              ring.style.width = '34px'; ring.style.height = '34px'
            }
          }, sig)
          el.addEventListener('mouseleave', () => {
            ring.style.width = '9px'; ring.style.height = '9px'
            label.style.opacity = '0'
          }, sig)
        })
      }
    }

    // Modal de contacto
    const modal = $('fp-modal')
    const panel = $('fp-modal-panel')
    const mClose = $('fp-modal-close')
    const backdrop = $('fp-modal-bd')
    const openModal = () => { modal.style.display = 'block'; requestAnimationFrame(() => { modal.style.opacity = '1'; panel.style.transform = 'translate(-50%,-50%)' }) }
    const closeModal = () => { modal.style.opacity = '0'; panel.style.transform = 'translate(-50%,-48%)'; setTimeout(() => { modal.style.display = 'none' }, 380) }
    contact.addEventListener('click', openModal, sig)
    mClose.addEventListener('click', closeModal, sig)
    backdrop.addEventListener('click', closeModal, sig)
    contact.addEventListener('mouseenter', () => { contact.style.opacity = '1' }, sig)
    contact.addEventListener('mouseleave', () => { if (mode === 'ambient') contact.style.opacity = '.92' }, sig)
    mClose.addEventListener('mouseenter', () => { mClose.style.opacity = '1' }, sig)
    mClose.addEventListener('mouseleave', () => { mClose.style.opacity = '.55' }, sig)

    // Teclado
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (modal.style.display === 'block') closeModal()
        else if (mode === 'open') closeProject()
      } else if (N > 0 && e.key === 'ArrowRight') {
        const ni = (current + 1) % N
        if (mode === 'open') openProject(ni); else { stopTimer(); go(ni, false) }
      } else if (N > 0 && e.key === 'ArrowLeft') {
        const pi = (current - 1 + N) % N
        if (mode === 'open') openProject(pi); else { stopTimer(); go(pi, false) }
      }
    }, sig)

    // Formulario (server action)
    const form = $('fp-form') as HTMLFormElement
    const formWrap = $('fp-form-wrap')
    const thanks = $('fp-thanks')
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    const errBox = $('fp-form-err')
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      errBox.style.display = 'none'
      const fd = new FormData(form)
      // Consentimiento RGPD obligatorio (revalidado también en servidor).
      if (fd.get('consent') !== 'on') {
        errBox.textContent = 'Para enviar, acepta la Política de Privacidad.'
        errBox.style.display = 'block'
        return
      }
      submitBtn.disabled = true
      submitBtn.style.opacity = '.5'
      submitBtn.textContent = 'Enviando…'
      const restoreBtn = () => {
        submitBtn.disabled = false
        submitBtn.style.opacity = '1'
        submitBtn.textContent = 'Enviar'
      }
      const idioma = (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'es'
      try {
        const res = await submitContactoWeb({
          nombre: String(fd.get('nombre') || ''),
          email: String(fd.get('email') || ''),
          telefono: String(fd.get('telefono') || ''),
          empresa: String(fd.get('empresa') || ''),
          mensaje: String(fd.get('mensaje') || ''),
          idioma,
          consent: fd.get('consent') === 'on',
          comercial: fd.get('comercial') === 'on',
          website: String(fd.get('website') || ''),
        })
        if ('success' in res) {
          formWrap.style.display = 'none'
          thanks.style.display = 'block'
        } else {
          errBox.textContent = res.error
          errBox.style.display = 'block'
          restoreBtn()
        }
      } catch {
        errBox.textContent = 'No hemos podido enviar tu mensaje. Inténtalo de nuevo.'
        errBox.style.display = 'block'
        restoreBtn()
      }
    }, sig)

    // No scroll del body mientras el teaser está montado
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Init
    setLight(false)
    if (N > 0) { go(0, true); startTimer() }

    return () => {
      ac.abort()
      mq.removeEventListener('change', onMq)
      stopTimer()
      if (rafId) cancelAnimationFrame(rafId)
      document.body.style.overflow = prevOverflow
    }
  }, [P])

  return (
    <div ref={root}>
      <div
        id="fp-stage"
        style={{
          position: 'fixed', inset: 0, overflow: 'hidden', background: '#0d0d0d',
          fontFamily: "var(--font-hanken), -apple-system, sans-serif", color: '#fff',
        }}
      >
        {/* HERO */}
        <div id="fp-hero" style={{ position: 'absolute', inset: '-6%', willChange: 'transform' }}>
          {/* src lo asigna el JS según el viewport (foto vertical en móvil) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img id="fp-hero-a" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 1, transition: 'opacity 1.6s cubic-bezier(.4,0,.2,1)' }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img id="fp-hero-b" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0, transition: 'opacity 1.6s cubic-bezier(.4,0,.2,1)' }} />
        </div>
        <div id="fp-hero-scrim" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(0,0,0,.30) 0%,rgba(0,0,0,0) 24%,rgba(0,0,0,0) 64%,rgba(0,0,0,.42) 100%)', transition: 'opacity .7s ease' }} />

        {/* CENTER RADIAL SCRIM */}
        <div id="fp-scrim" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 1, transition: 'opacity .7s ease', background: 'radial-gradient(ellipse 42% 34% at 50% 50%,rgba(0,0,0,.34) 0%,rgba(0,0,0,.15) 45%,rgba(0,0,0,0) 78%)' }} />

        {/* OPEN LAYER */}
        <div id="fp-open" style={{ position: 'absolute', inset: 0, background: '#f4f3f0', opacity: 0, pointerEvents: 'none', transition: 'opacity .75s cubic-bezier(.4,0,.2,1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(72px,10vh,120px) clamp(24px,5vw,64px)' }}>
          <div id="fp-sheet" style={{ width: '100%', maxWidth: 'clamp(680px,82vw,1060px)', display: 'flex', flexDirection: 'column', gap: 'clamp(18px,2.6vh,28px)', opacity: 0, transition: 'opacity .5s ease' }}>
            <div className="fp-sheet-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, borderBottom: '1px solid rgba(20,20,20,.16)', paddingBottom: 14 }}>
              <div id="fp-open-title" style={{ fontSize: 'clamp(24px,3.4vw,40px)', fontWeight: 500, letterSpacing: '-.02em', lineHeight: 1, color: '#141414' }} />
              <div style={{ textAlign: 'right', color: '#141414', flex: 'none' }}>
                <div id="fp-open-type" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.24em', textTransform: 'uppercase' }} />
                <div id="fp-open-sub" style={{ marginTop: 5, fontSize: 12, fontWeight: 300, opacity: .55, letterSpacing: '.04em' }} />
              </div>
            </div>
            <div id="fp-gallery" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gridTemplateRows: 'repeat(2,1fr)', gap: 12, height: 'clamp(340px,54vh,540px)' }}>
              <div style={{ gridRow: '1 / span 2', overflow: 'hidden', background: '#e9e8e4' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img id="fp-g0" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ overflow: 'hidden', background: '#e9e8e4' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img id="fp-g1" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ overflow: 'hidden', background: '#e9e8e4' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img id="fp-g2" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            </div>
          </div>
        </div>

        {/* CENTER CLUSTER */}
        <div id="fp-center" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', pointerEvents: 'none', width: 'auto', maxWidth: '90vw', transition: 'opacity .55s ease' }}>
          <div style={{ position: 'relative', width: 'clamp(220px,32vw,360px)', lineHeight: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img id="fp-logo-white" src={LOGO_WHITE} alt="Forma Prima" style={{ display: 'block', width: '100%', height: 'auto', filter: 'brightness(0) invert(1)', opacity: 1, transition: 'opacity 1s ease' }} />
          </div>
          <div className="fp-tint" style={{ marginTop: 21, width: 22, height: 1, background: 'currentColor', color: '#fff', opacity: .4, transition: 'color 1s ease' }} />
          <div className="fp-tint" style={{ marginTop: 19, fontSize: 9, fontWeight: 500, letterSpacing: '.34em', textTransform: 'uppercase', color: '#fff', opacity: .62, transition: 'color 1s ease' }}>Work in Progress</div>
          <div className="fp-tint fp-tag" style={{ whiteSpace: 'nowrap', marginTop: 13, fontSize: 'clamp(10.5px,1vw,12px)', lineHeight: 1.45, fontWeight: 700, letterSpacing: '.02em', color: '#fff', transition: 'color 1s ease' }}>Estamos construyendo una nueva web</div>
          <div className="fp-tint fp-tag" style={{ whiteSpace: 'nowrap', marginTop: 3, fontSize: 'clamp(10.5px,1vw,12px)', lineHeight: 1.45, fontWeight: 300, letterSpacing: '.02em', color: '#fff', opacity: .55, transition: 'color 1s ease' }}>A new website is on the way</div>
        </div>

        {/* CORNER LOGO (open mode) */}
        <div id="fp-logo-corner" style={{ position: 'absolute', top: 'clamp(24px,3.4vh,38px)', left: 'clamp(22px,3.4vw,44px)', width: 54, aspectRatio: '1.922', opacity: 0, pointerEvents: 'none', transition: 'opacity .6s ease' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ISOTIPO_DARK} alt="Forma Prima" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        {/* TOP-RIGHT ACTIONS (mapa + contacto) */}
        <div style={{ position: 'absolute', top: 'clamp(22px,3.2vh,36px)', right: 'clamp(22px,3.4vw,44px)', zIndex: 6, display: 'flex', alignItems: 'center', gap: 'clamp(14px,2vw,26px)' }}>
          {/* MAPA MADRID */}
          <button
            id="fp-map-btn"
            onClick={() => setMapOpen(true)}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '.92' }}
            className="fp-tint fp-interactive"
            data-cursor=""
            style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', padding: 8, margin: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, letterSpacing: '.24em', textTransform: 'uppercase', color: '#fff', transition: 'color 1s ease,opacity .4s ease', opacity: .92 }}
          >
            <span style={{ fontSize: 12, lineHeight: 1 }}>◍</span>
            <span className="fp-mapbtn-full">Mapa Madrid</span>
            <span className="fp-mapbtn-short">Mapa</span>
          </button>
          {/* CONTACTO */}
          <button id="fp-contact" className="fp-tint fp-interactive" data-cursor="" style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', padding: 8, margin: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, letterSpacing: '.24em', textTransform: 'uppercase', color: '#fff', transition: 'color 1s ease,opacity .4s ease', opacity: .92 }}>
            <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
            <span>Contacto</span>
          </button>
        </div>

        {/* CLOSE (open mode) */}
        <button id="fp-close" className="fp-tint fp-interactive" data-cursor="" aria-label="Cerrar" style={{ position: 'absolute', top: 'clamp(20px,3vh,32px)', right: 'clamp(20px,3.2vw,42px)', display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', padding: 8, margin: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, letterSpacing: '.24em', textTransform: 'uppercase', color: '#141414', opacity: 0, pointerEvents: 'none', transition: 'color 1s ease,opacity .5s ease' }}>
          <span>Cerrar</span><span style={{ fontSize: 15, lineHeight: 1 }}>✕</span>
        </button>

        {/* PROJECT INDEX */}
        <nav id="fp-index" style={{ position: 'absolute', left: 'clamp(22px,3.4vw,44px)', bottom: 'clamp(20px,3.4vh,34px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, zIndex: 5 }}>
          {P.map((p, i) => (
            <button
              key={i}
              className="fp-tint fp-interactive"
              data-idx={i}
              data-cursor="Ver proyecto"
              style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 12, background: 'none', border: 'none', padding: '3px 0', margin: 0, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', opacity: i === 0 ? 1 : 0.42, transition: 'color 1s ease,opacity .45s ease' }}
            >
              <span style={{ fontSize: 10, letterSpacing: '.18em', opacity: .5, fontVariantNumeric: 'tabular-nums', width: 16, textAlign: 'left' }}>{String(i + 1).padStart(2, '0')}</span>
              <span className="fp-iname" style={{ whiteSpace: 'nowrap', fontSize: 12.5, letterSpacing: '.05em', opacity: .92, transition: 'opacity .35s ease' }}>{p.n}</span>
              <i className="fp-underline" style={{ position: 'absolute', left: 0, bottom: -1, height: 1, width: '100%', background: 'currentColor', transform: 'scaleX(0)', transformOrigin: 'left center', opacity: .45 }} />
            </button>
          ))}
        </nav>

        {/* CUSTOM CURSOR */}
        <div id="fp-cursor" className="fp-tint" style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none', display: 'none', transform: 'translate(-50%,-50%)', color: '#fff' }}>
          <div id="fp-cursor-ring" style={{ width: 9, height: 9, borderRadius: '50%', border: '1px solid currentColor', transition: 'width .3s cubic-bezier(.2,.8,.2,1),height .3s cubic-bezier(.2,.8,.2,1),opacity .3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span id="fp-cursor-label" style={{ fontSize: 8.5, letterSpacing: '.18em', textTransform: 'uppercase', opacity: 0, whiteSpace: 'nowrap', transition: 'opacity .25s ease' }} />
          </div>
        </div>

        {/* CONTACT MODAL */}
        <div id="fp-modal" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'none', opacity: 0, transition: 'opacity .4s ease' }}>
          <div id="fp-modal-bd" style={{ position: 'absolute', inset: 0, background: 'rgba(12,12,12,.46)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)' }} />
          <div id="fp-modal-panel" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-48%)', width: 'min(92vw,560px)', maxHeight: '90vh', overflowY: 'auto', background: '#fbfbfa', color: '#111', padding: 'clamp(30px,4.6vw,52px)', boxShadow: '0 40px 120px -40px rgba(0,0,0,.5)', transition: 'transform .45s cubic-bezier(.2,.8,.2,1)' }}>
            <button id="fp-modal-close" aria-label="Cerrar" style={{ position: 'absolute', top: 20, right: 20, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#111', fontSize: 20, lineHeight: 1, opacity: .55, transition: 'opacity .25s ease' }}>✕</button>

            <div id="fp-form-wrap">
              <div style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '.3em', textTransform: 'uppercase', opacity: .5 }}>Contacto</div>
              <h2 style={{ margin: '13px 0 0', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 500, letterSpacing: '-.01em', lineHeight: 1.15 }}>Cuéntanos tu proyecto</h2>
              <p style={{ margin: '11px 0 0', fontSize: 14, fontWeight: 300, lineHeight: 1.55, opacity: .62, maxWidth: '42ch' }}>Déjanos tus datos y nos pondremos en contacto contigo. / Leave us your details and we will get back to you.</p>

              <form id="fp-form" style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '22px 24px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .5 }}>Nombre</span>
                  <input type="text" name="nombre" required style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .5 }}>Email</span>
                  <input type="email" name="email" required style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .5 }}>Teléfono</span>
                  <input type="tel" name="telefono" style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .5 }}>Empresa</span>
                  <input type="text" name="empresa" style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .5 }}>Mensaje / Proyecto</span>
                  <textarea name="mensaje" rows={3} style={{ ...inputStyle, resize: 'none' }} />
                </label>

                {/* Honeypot anti-bot: oculto para humanos, debe quedar vacío */}
                <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                  <label>No rellenar<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
                </div>

                {/* Consentimiento RGPD (obligatorio) + comerciales (opcional) */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 2 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, lineHeight: 1.5, color: '#444', cursor: 'pointer' }}>
                    <input type="checkbox" name="consent" required style={{ marginTop: 2, accentColor: '#111', width: 15, height: 15, flex: 'none' }} />
                    <span>
                      He leído y acepto la{' '}
                      <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: '#111', textDecoration: 'underline' }}>Política de Privacidad</a>.{' '}
                      <span style={{ opacity: .6 }}>/ I have read and accept the{' '}
                      <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: '#111', textDecoration: 'underline' }}>Privacy Policy</a>.</span>
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, lineHeight: 1.5, color: '#444', cursor: 'pointer' }}>
                    <input type="checkbox" name="comercial" style={{ marginTop: 2, accentColor: '#111', width: 15, height: 15, flex: 'none' }} />
                    <span>
                      Acepto recibir comunicaciones comerciales de Forma Prima.{' '}
                      <span style={{ opacity: .6 }}>/ I agree to receive commercial communications from Forma Prima. <em>(opcional)</em></span>
                    </span>
                  </label>
                  <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.55, color: '#999' }}>
                    Responsable: GEINEX GROUP, S.L. Finalidad: atender tu solicitud y crear tu espacio de cliente. Legitimación: tu consentimiento. Puedes ejercer tus derechos en contacto@formaprima.es. Más información en la Política de Privacidad.
                  </p>
                </div>

                <div id="fp-form-err" style={{ display: 'none', gridColumn: '1 / -1', fontSize: 13, color: '#b3261e' }} />
                <button type="submit" className="fp-interactive" style={{ gridColumn: '1 / -1', marginTop: 6, justifySelf: 'start', background: '#111', color: '#fff', border: 'none', padding: '15px 38px', fontFamily: 'inherit', fontSize: 11, fontWeight: 500, letterSpacing: '.22em', textTransform: 'uppercase', cursor: 'pointer', transition: 'opacity .25s ease' }}>Enviar</button>
              </form>

              <div style={{ marginTop: 34, paddingTop: 24, borderTop: '1px solid rgba(17,17,17,.1)', display: 'flex', flexWrap: 'wrap', gap: '6px 26px', fontSize: 12, letterSpacing: '.04em', opacity: .62 }}>
                <a href="mailto:contacto@formaprima.es" style={{ color: '#111', textDecoration: 'none' }}>contacto@formaprima.es</a>
                <span>Madrid, España</span>
                <a href="https://www.instagram.com/forma.prima/" target="_blank" rel="noopener noreferrer" style={{ color: '#111', textDecoration: 'none' }}>@forma.prima</a>
              </div>
            </div>

            <div id="fp-thanks" style={{ display: 'none', padding: '18px 0 8px', textAlign: 'left' }}>
              <div style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '.3em', textTransform: 'uppercase', opacity: .5 }}>Gracias</div>
              <h2 style={{ margin: '13px 0 0', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 500, letterSpacing: '-.01em', lineHeight: 1.2 }}>Hemos recibido tu mensaje.</h2>
              <p style={{ margin: '12px 0 0', fontSize: 14, fontWeight: 300, lineHeight: 1.6, opacity: .62, maxWidth: '44ch' }}>Te responderemos lo antes posible. / We will get back to you shortly.</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAPA INTERACTIVO DE MADRID */}
      <MadridProjectsMap open={mapOpen} onClose={() => setMapOpen(false)} />

      {/* estilos que no se pueden expresar inline (placeholder, focus, hover) */}
      <style>{`
        #fp-modal input::placeholder,#fp-modal textarea::placeholder{color:rgba(17,17,17,.28);}
        #fp-modal input:focus,#fp-modal textarea:focus{border-bottom-color:#111 !important;}
        #fp-index button:hover .fp-iname{opacity:1 !important;}
        .fp-mapbtn-short{ display:none; }
        @media (max-width: 560px){ .fp-mapbtn-full{ display:none; } .fp-mapbtn-short{ display:inline; } }

        /* ── Mobile-first ─────────────────────────────────────────── */
        @media (max-width: 640px){
          /* Textos del centro: que envuelvan, no recortar */
          .fp-tag{ white-space:normal !important; max-width:84vw; }
          /* Índice de proyectos: área de toque más cómoda */
          #fp-index{ gap:11px !important; }
          #fp-index button{ padding:6px 0 !important; }
          #fp-index .fp-iname{ font-size:14px !important; opacity:1 !important; }
          #fp-index button{ opacity:1 !important; }

          /* Ficha de proyecto: scroll y apilado vertical */
          #fp-open{ align-items:flex-start !important; justify-content:flex-start !important; overflow-y:auto !important; padding:68px 20px 28px !important; }
          .fp-sheet-head{ flex-direction:column !important; align-items:flex-start !important; gap:6px !important; }
          .fp-sheet-head > div:last-child{ text-align:left !important; }
          #fp-gallery{ grid-template-columns:1fr !important; grid-template-rows:none !important; height:auto !important; gap:10px !important; }
          #fp-gallery > div{ height:58vw !important; }
          #fp-gallery > div:first-child{ grid-row:auto !important; height:72vw !important; }

          /* Contacto: una sola columna */
          #fp-form{ grid-template-columns:1fr !important; gap:18px !important; }
          #fp-modal-panel{ padding:30px 22px !important; }
        }
      `}</style>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: 'none',
  borderBottom: '1px solid rgba(17,17,17,.18)',
  background: 'transparent',
  padding: '9px 0',
  fontFamily: 'inherit',
  fontSize: 15,
  color: '#111',
  outline: 'none',
  transition: 'border-color .25s ease',
}
