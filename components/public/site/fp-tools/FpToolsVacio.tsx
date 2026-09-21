'use client'

import { site, display } from '../theme'
import { useSite } from '../SiteProvider'

/** Sección sin ninguna capacidad publicada. No debería verse nunca en producción,
 *  pero una página en blanco se lee como una web rota y esto no. */
export function FpToolsVacio() {
  const { locale } = useSite()
  const t = (es: string, en: string) => (locale === 'en' ? en : es)
  return (
    <main style={{
      fontFamily: site.font, background: site.color.cream, color: site.color.ink,
      minHeight: '100dvh', display: 'flex', alignItems: 'center',
      padding: `120px ${site.gutter}`,
    }}>
      <div style={{ maxWidth: site.maxWidth, margin: '0 auto', width: '100%' }}>
        <p style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', color: site.color.accent, margin: '0 0 16px' }}>
          FP Tools
        </p>
        <h1 style={{ fontSize: display.hero, fontWeight: 300, lineHeight: 1.2, margin: 0, maxWidth: '22ch' }}>
          {t('Muy pronto.', 'Coming soon.')}
        </h1>
      </div>
    </main>
  )
}
