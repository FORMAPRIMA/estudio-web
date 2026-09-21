'use client'

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
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

/**
 * El store del viewport. Las dos funciones viven FUERA del componente y no se
 * recrean: `useSyncExternalStore` compara referencias y con funciones nuevas en
 * cada render se resuscribiría sin parar.
 */
function suscribirViewport(alCambiar: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY)
  mq.addEventListener('change', alCambiar)
  return () => mq.removeEventListener('change', alCambiar)
}
function esMovil() {
  return window.matchMedia(MOBILE_QUERY).matches
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('es')

  /**
   * El viewport, resuelto YA en el primer render del cliente.
   *
   * Estaba en un `useState(false)` corregido desde un `useEffect`, o sea DESPUÉS
   * de montar. Un render de más no parece nada, pero lo que cuelga de `mobile` son
   * las variantes móviles del CMS —vídeos, imágenes, textos— y todo lo que se
   * monta en ese primer render lo hace con el valor de escritorio. En el vídeo de
   * intro eso era fatal: un <video> no reevalúa sus <source> una vez ha elegido
   * archivo, así que en un teléfono se quedaba reproduciendo el MP4 horizontal
   * para siempre, recortadísimo, mientras el póster sí cambiaba al vertical.
   *
   * `useSyncExternalStore` es exactamente esto: un valor externo al árbol que React
   * lee en el mismo render, no un efecto que llega tarde. En el servidor no hay
   * viewport que medir, así que allí vale `false` y el cliente corrige antes de
   * pintar.
   */
  const mobile = useSyncExternalStore(suscribirViewport, esMovil, () => false)

  useEffect(() => {
    // Idioma: preferencia guardada, si no el idioma del navegador.
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('fp_locale') : null
    if (saved === 'es' || saved === 'en') setLocaleState(saved)
    else if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')) setLocaleState('en')
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
