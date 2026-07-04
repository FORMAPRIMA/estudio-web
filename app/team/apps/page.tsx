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
        {profile.rol === 'fp_partner' && (
          <Link href="/team/apps/urban-analyst" style={{ textDecoration: 'none' }}>
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
                🏛
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 6, letterSpacing: '-0.01em' }}>
                Urban Analyst
              </p>
              <p style={{ fontSize: 11, color: '#1A1A1A70', fontWeight: 300, lineHeight: 1.5, marginBottom: 20 }}>
                Análisis urbanístico preliminar de activos en Madrid: Catastro, PGOUM, red flags y escenarios.
              </p>
              <span style={{
                fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#D85A30', fontWeight: 500,
              }}>
                Abrir →
              </span>
            </div>
          </Link>
        )}

        <Link href="/team/apps/quiniela" style={{ textDecoration: 'none' }}>
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
              background: '#3D8B5F15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, marginBottom: 16,
            }}>
              ⚽
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 6, letterSpacing: '-0.01em' }}>
              La Porra del Mundial
            </p>
            <p style={{ fontSize: 11, color: '#1A1A1A70', fontWeight: 300, lineHeight: 1.5, marginBottom: 20 }}>
              Quiniela del Mundial 2026: marcadores, escalera del campeón y bote para el podio.
            </p>
            <span style={{
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#3D8B5F', fontWeight: 500,
            }}>
              Abrir →
            </span>
          </div>
        </Link>

        <Link href="/team/apps/showroom-3d" style={{ textDecoration: 'none' }}>
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
              background: '#1A1A1A0D',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, marginBottom: 16,
            }}>
              ◳
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 6, letterSpacing: '-0.01em' }}>
              Showroom 3D
            </p>
            <p style={{ fontSize: 11, color: '#1A1A1A70', fontWeight: 300, lineHeight: 1.5, marginBottom: 20 }}>
              Visor de maquetas 3D del estudio. Sube modelos de Blender y explóralos en órbita.
            </p>
            <span style={{
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#1A1A1A', fontWeight: 500,
            }}>
              Abrir →
            </span>
          </div>
        </Link>

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

        <Link href="/team/apps/dd-visits" style={{ textDecoration: 'none' }}>
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
              background: '#5B7FA615',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, marginBottom: 16,
            }}>
              🏗
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 6, letterSpacing: '-0.01em' }}>
              DD Visits
            </p>
            <p style={{ fontSize: 11, color: '#1A1A1A70', fontWeight: 300, lineHeight: 1.5, marginBottom: 20 }}>
              Due Diligence técnica de activos residenciales. Visita, revisión interna e informe.
            </p>
            <span style={{
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#5B7FA6', fontWeight: 500,
            }}>
              Abrir →
            </span>
          </div>
        </Link>
      </div>
    </div>
  )
}
