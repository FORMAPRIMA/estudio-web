import { redirect } from 'next/navigation'

// El scanner vive ahora en /team/gastos ("Gastos y facturas"), accesible a
// todos los roles FP. Esta ruta se mantiene solo como redirect.
export default function Page({ searchParams }: { searchParams: { year?: string; month?: string } }) {
  const params = new URLSearchParams()
  if (searchParams.year)  params.set('year',  searchParams.year)
  if (searchParams.month) params.set('month', searchParams.month)
  const qs = params.toString()
  redirect(`/team/gastos${qs ? `?${qs}` : ''}`)
}
