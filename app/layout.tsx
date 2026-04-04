import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500'],
})

export const metadata: Metadata = {
  title: {
    default: 'Forma Prima — Arquitectura & Interiorismo',
    template: '%s — Forma Prima',
  },
  description:
    'Estudio de arquitectura e interiorismo con base en Ciudad de México. Proyectos residenciales, comerciales y de hospitalidad.',
  keywords: ['arquitectura', 'interiorismo', 'diseño', 'México', 'Forma Prima'],
  icons: {
    apple: '/apple-touch-icon.png',
  },
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
