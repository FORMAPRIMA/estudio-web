import { Hanken_Grotesk } from 'next/font/google'
import type { Metadata } from 'next'

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-hanken',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Forma Prima',
  description: 'Estamos construyendo una nueva web. / A new website is on the way.',
}

export default function WipLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={hanken.variable} style={{ height: '100%' }}>
      {children}
    </div>
  )
}
