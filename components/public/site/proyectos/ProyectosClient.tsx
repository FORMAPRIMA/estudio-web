'use client'

import dynamic from 'next/dynamic'
import { site } from '../theme'
import type { MaquetaItem } from './ProyectosShowroom'

// Three.js solo en cliente y bajo demanda (nunca SSR).
const Showroom = dynamic(() => import('./ProyectosShowroom'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: site.font, color: '#1A1A1A55', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
      Cargando maquetas…
    </div>
  ),
})

export function ProyectosClient({ modelos }: { modelos: MaquetaItem[] }) {
  return <Showroom modelos={modelos} />
}
