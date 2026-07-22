import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://formaprima.es'),
  title: {
    default: 'Forma Prima — Arquitectura & Interiorismo',
    template: '%s — Forma Prima',
  },
  description:
    'Forma Prima es un estudio de arquitectura e interiorismo en Madrid. Proyecto, obra y experiencias inmersivas: del anteproyecto a la entrega, con criterio y tecnología propia.',
  keywords: ['arquitectura', 'interiorismo', 'estudio de arquitectura', 'Madrid', 'reforma', 'diseño', 'Forma Prima'],
  icons: { apple: '/apple-touch-icon.png' },
  openGraph: {
    type: 'website',
    siteName: 'Forma Prima',
    locale: 'es_ES',
    url: 'https://formaprima.es',
    title: 'Forma Prima — Arquitectura & Interiorismo',
    description: 'Estudio de arquitectura e interiorismo en Madrid. Proyecto, obra y experiencias inmersivas.',
  },
  twitter: { card: 'summary_large_image', title: 'Forma Prima — Arquitectura & Interiorismo' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-cream text-ink font-sans font-light antialiased">
        {children}
      </body>
    </html>
  )
}
