import type { Metadata, Viewport } from 'next'
import { rcFontVars } from '@/components/recorrido/fuentes'
import '@/components/recorrido/recorrido.css'

// Solo envuelve las páginas del recorrido del invitado; la invitación
// (/cc38/<token>) es un route handler y no pasa por aquí.

export const metadata: Metadata = {
  title: 'Open House · Claudio Coello 38 · Forma Prima',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#f5f1ec',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={rcFontVars}>{children}</div>
}
