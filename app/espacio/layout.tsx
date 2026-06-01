import EspacioStyles from '@/components/espacio/EspacioStyles'

export default function EspacioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fp-espacio">
      <EspacioStyles />
      {children}
    </div>
  )
}
