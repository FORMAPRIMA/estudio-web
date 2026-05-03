import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FP_ROLES } from '@/lib/types'
import type { FpRole } from '@/lib/types'

export const metadata = { title: 'Apps' }

export default async function AppsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !FP_ROLES.includes(profile.rol as FpRole)) redirect('/login')

  return (
    <div style={{ padding: '40px 48px', maxWidth: 900 }}>
      <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1A1A1A99', marginBottom: 8 }}>
        Forma Prima
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 300, color: '#1A1A1A', marginBottom: 4, letterSpacing: '-0.02em' }}>
        Apps
      </h1>
      <p style={{ fontSize: 13, color: '#1A1A1A60', marginBottom: 40, fontWeight: 300 }}>
        Herramientas del equipo
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        <Link href="/team/apps/design-hunter" style={{ textDecoration: 'none' }}>
          <div
            className="apps-card"
            style={{
              background: '#fff',
              borderRadius: 4,
              padding: '28px 24px',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 4,
              background: '#D85A3015',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, marginBottom: 16,
            }}>
              🔍
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 6, letterSpacing: '-0.01em' }}>
              Design Hunter
            </p>
            <p style={{ fontSize: 11, color: '#1A1A1A70', fontWeight: 300, lineHeight: 1.5, marginBottom: 20 }}>
              Captura y organiza referencias de diseño durante viajes e inspecciones.
            </p>
            <span style={{
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#D85A30', fontWeight: 500,
            }}>
              Abrir →
            </span>
          </div>
        </Link>
      </div>
    </div>
  )
}
