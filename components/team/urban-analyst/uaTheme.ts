'use client'

// Sistema de tema de Urban Analyst: light (por defecto, blancos/grises
// elegantes) y dark ("gemelo digital"). Los componentes usan CSS variables,
// así que el toggle es instantáneo; el visor 3D recibe el modo como prop
// porque MapLibre necesita hexadecimales reales.

import { useCallback, useEffect, useState } from 'react'

export type UAMode = 'light' | 'dark'

const STORAGE_KEY = 'ua-theme'

export const UA_VARS: Record<UAMode, Record<string, string>> = {
  light: {
    '--ua-bg': '#F6F5F2',
    '--ua-panel': '#FFFFFF',
    '--ua-panel2': '#F2F1ED',
    '--ua-edge': '#E8E6E0',
    '--ua-edge2': '#D6D3CB',
    '--ua-txt': '#1A1A1A',
    '--ua-body': '#43464E',
    '--ua-sub': '#65686F',
    '--ua-faint': '#989BA3',
    '--ua-brand': '#D85A30',
    '--ua-ok': '#2F8F5B',
    '--ua-warn': '#A87A1D',
    '--ua-bad': '#C2453A',
    '--ua-crit': '#A32A20',
    '--ua-glass': '#F6F5F2E0',
    '--ua-overlay': '#1A1A1A55',
    '--ua-shadow': '0 12px 40px #1A1A1A14',
    '--ua-shadow-lg': '0 30px 90px #1A1A1A26',
  },
  dark: {
    '--ua-bg': '#0E0F12',
    '--ua-panel': '#15171C',
    '--ua-panel2': '#1B1E24',
    '--ua-edge': '#262A33',
    '--ua-edge2': '#3A3F4B',
    '--ua-txt': '#E8E6E1',
    '--ua-body': '#B9BDC7',
    '--ua-sub': '#8A8F9B',
    '--ua-faint': '#5C6270',
    '--ua-brand': '#FF6A3D',
    '--ua-ok': '#57B77C',
    '--ua-warn': '#E0AE4F',
    '--ua-bad': '#E5615C',
    '--ua-crit': '#FF3B30',
    '--ua-glass': '#0B0D11CC',
    '--ua-overlay': '#05060899',
    '--ua-shadow': '0 12px 40px #00000066',
    '--ua-shadow-lg': '0 30px 90px #000000CC',
  },
}

export function useUATheme(): { mode: UAMode; toggle: () => void; vars: React.CSSProperties } {
  const [mode, setMode] = useState<UAMode>('light')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved === 'dark' || saved === 'light') setMode(saved)
    } catch { /* sin storage */ }
  }, [])

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === 'light' ? 'dark' : 'light'
      try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* */ }
      return next
    })
  }, [])

  return { mode, toggle, vars: UA_VARS[mode] as React.CSSProperties }
}

// Tokens como referencias var() — usables en cualquier estilo inline
export const BG = 'var(--ua-bg)'
export const PANEL = 'var(--ua-panel)'
export const PANEL2 = 'var(--ua-panel2)'
export const EDGE = 'var(--ua-edge)'
export const EDGE2 = 'var(--ua-edge2)'
export const TXT = 'var(--ua-txt)'
export const BODY = 'var(--ua-body)'
export const SUB = 'var(--ua-sub)'
export const FAINT = 'var(--ua-faint)'
export const BRAND = 'var(--ua-brand)'
export const OK = 'var(--ua-ok)'
export const WARN = 'var(--ua-warn)'
export const BAD = 'var(--ua-bad)'
export const CRIT = 'var(--ua-crit)'
export const GLASS = 'var(--ua-glass)'
export const OVERLAY = 'var(--ua-overlay)'
export const SHADOW = 'var(--ua-shadow)'
export const SHADOW_LG = 'var(--ua-shadow-lg)'

/** Mezcla un token con transparencia (sustituto de los sufijos alpha hex). */
export const alpha = (token: string, pct: number) =>
  `color-mix(in srgb, ${token} ${pct}%, transparent)`
