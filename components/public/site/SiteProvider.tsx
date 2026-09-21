'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { MOBILE_QUERY } from './theme'
import type { Locale } from '@/lib/web-publica'

// Base de rutas del sitio (vacía: la web vive en la raíz).
// Reexportadas: viven en un módulo neutro para que también las puedan leer los
// Server Components (ver lib/web-publica/base.ts).
export { SITE_BASE, href } from '@/lib/web-publica/base'

interface SiteCtx {
  locale: Locale
  setLocale: (l: Locale) => void
  mobile: boolean
}

const Ctx = createContext<SiteCtx>({ locale: 'es', setLocale: () => {}, mobile: false })

export function useSite() { return useContext(Ctx) }

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('es')
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    // Idioma: preferencia guardada, si no el idioma del navegador.
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('fp_locale') : null
    if (saved === 'es' || saved === 'en') setLocaleState(saved)
    else if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')) setLocaleState('en')
  }, [])

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    try { window.localStorage.setItem('fp_locale', l) } catch {}
    document.documentElement.lang = l
  }

  return <Ctx.Provider value={{ locale, setLocale, mobile }}>{children}</Ctx.Provider>
}

/** Atajo para resolver contenido con el locale/viewport actuales. */
export function useResolver() {
  const { locale, mobile } = useSite()
  return { locale, mobile }
}
