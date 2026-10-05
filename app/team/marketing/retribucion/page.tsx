import { redirect } from 'next/navigation'
import { getAccesoRetribucion, getPlanes, getProyectos } from '@/lib/retribucion-data'
import { RetribucionPage } from '@/components/team/marketing/retribucion/RetribucionPage'

export const metadata = { title: 'Retribución · Marketing' }
export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: { b?: string } }) {
  const acceso = await getAccesoRetribucion()
  if (!acceso) redirect('/team/dashboard')

  const planes = await getPlanes()
  if (!planes.length) {
    return (
      <div style={{ padding: '40px 48px', maxWidth: 640, fontSize: 13, color: '#1A1A1A99', lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, color: '#1A1A1A', margin: '0 0 12px' }}>Retribución</h1>
        No hay ningún plan de retribución activo. Si acabas de instalar el módulo, aplica la migración
        {' '}<code>supabase/migrations/retribucion_variable.sql</code> en Supabase.
      </div>
    )
  }

  // Ana ve el suyo; un socio el que pida ?b= o el primero
  const plan = planes.find((p) => p.beneficiarioId === searchParams.b)
    ?? planes.find((p) => p.beneficiarioId === acceso.userId)
    ?? planes[0]
  const proyectos = await getProyectos(plan.beneficiarioId)

  return (
    <RetribucionPage
      key={plan.beneficiarioId}
      planes={planes}
      plan={plan}
      proyectos={proyectos}
      esPartner={acceso.esPartner}
      esPropio={plan.beneficiarioId === acceso.userId}
    />
  )
}
