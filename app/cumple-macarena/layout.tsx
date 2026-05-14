import type { ReactNode } from 'react'
import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'

export const metadata: Metadata = {
  title: '¡Macarena cumple 4! · Invitación',
  description: '¡Estás invitado al 4º cumpleaños de Macarena! 🎂 13 junio 2026 · Urban Planet Madrid',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎂</text></svg>",
  },
  openGraph: {
    title: '¡Macarena cumple 4! 🎂',
    description: '¡Estás invitado al 4º cumpleaños de Macarena! 13 junio · Urban Planet Madrid',
    images: [{ url: `${siteUrl}/cumple-og.png`, width: 1200, height: 630, alt: 'Cumpleaños Macarena' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '¡Macarena cumple 4! 🎂',
    description: '¡Estás invitado al 4º cumpleaños de Macarena! 13 junio · Urban Planet Madrid',
    images: [`${siteUrl}/cumple-og.png`],
  },
}

export default function CumpleLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
