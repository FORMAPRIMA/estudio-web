'use client'

import { site, display } from './theme'
import { useSite } from './SiteProvider'
import { Reveal } from './Reveal'

export function SitePlaceholder({ es, en }: { es: string; en: string }) {
  const { locale } = useSite()
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: `120px ${site.gutter} 80px`, fontFamily: site.font, background: site.color.cream, color: site.color.ink }}>
      <Reveal as="p" delay={0} style={{ fontSize: display.eyebrow, letterSpacing: site.track.ultra, textTransform: 'uppercase', color: site.color.accent, margin: '0 0 20px' }}>
        {locale === 'en' ? en : es}
      </Reveal>
      <Reveal as="h1" delay={120} style={{ fontSize: display.h1, fontWeight: 300, margin: 0, letterSpacing: '-0.01em' }}>
        {locale === 'en' ? 'Coming soon' : 'Próximamente'}
      </Reveal>
    </main>
  )
}
