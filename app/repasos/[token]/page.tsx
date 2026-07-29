import { createAdminClient } from '@/lib/supabase/admin'
import { validateRepasoToken } from '@/lib/repasos/auth'
import { loadProyectoData } from '@/lib/repasos/data'
import RepasoProyectoView from '@/components/team/repasos/RepasoProyectoView'

export const metadata = { title: 'Repasos de obra · Forma Prima' }
export const dynamic = 'force-dynamic'

// Modo presentación: solo lectura, sin sesión. El token determina la audiencia y
// el filtrado por visibilidad ocurre en `loadProyectoData`, en servidor.

export default async function Page({ params }: { params: { token: string } }) {
  const admin = createAdminClient()
  const tokenRow = await validateRepasoToken(admin, params.token)

  if (!tokenRow) return <EnlaceNoValido />

  const data = await loadProyectoData(tokenRow.proyecto_id, tokenRow.audiencia)
  if (!data) return <EnlaceNoValido />

  return (
    <RepasoProyectoView
      proyecto={data.proyecto}
      planos={data.planos}
      repasos={data.repasos}
      modo="presentacion"
      audiencia={tokenRow.audiencia}
      token={params.token}
    />
  )
}

function EnlaceNoValido() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8F7F4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <p style={{ fontSize: 32, margin: '0 0 16px' }}>🔒</p>
        <h1 style={{ fontSize: 18, fontWeight: 400, color: '#1A1A1A', margin: '0 0 8px' }}>
          Enlace no válido
        </h1>
        <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.6 }}>
          Este enlace de repasos ha sido revocado o no existe. Contacta con Forma Prima para
          solicitar uno nuevo.
        </p>
      </div>
    </div>
  )
}
