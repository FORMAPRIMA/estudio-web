import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '¡Macarena cumple 4! · Invitación',
  description: '¡Estás invitado al 4º cumpleaños de Macarena!',
}

export default function CumpleLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
