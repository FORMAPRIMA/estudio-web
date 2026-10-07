import type { Metadata, Viewport } from 'next'
import { rcFontVars } from '@/components/recorrido/fuentes'
import '@/components/recorrido/recorrido.css'

export const metadata: Metadata = {
  title: 'El recorrido · Open House CC38',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#161616',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={rcFontVars}>{children}</div>
}
