import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FP_ROLES, type FpRole } from '@/lib/types'
import { crearPase, urlSalas } from '@/lib/salas/puente'

// Entrada a Salas con la cuenta de internal (ver lib/salas/puente.ts). La persona
// tiene que estar dada de alta en Salas → Equipo con el mismo correo: su fila de
// sala_miembros es la que decide qué salas ve.

export const dynamic = 'force-dynamic'

export default async function EntrarEnSalas() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: perfil } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!perfil || !FP_ROLES.includes(perfil.rol as FpRole)) redirect('/login')

  const email = (user.email ?? '').trim().toLowerCase()
  const { data: miembro } = email
    ? await createAdminClient().from('sala_miembros').select('id, activo').eq('email', email).eq('activo', true).maybeSingle()
    : { data: null }

  if (!miembro) {
    return (
      <div style={{ maxWidth: 520, padding: '48px 0' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D85A30', fontWeight: 600, margin: 0 }}>Salas</p>
        <h1 style={{ fontSize: 26, fontWeight: 300, margin: '10px 0 12px' }}>Todavía no tienes acceso a Salas</h1>
        <p style={{ fontSize: 14, color: '#1A1A1A99', lineHeight: 1.6, margin: 0 }}>
          Pide a José o a Gabriela que te den de alta en Salas → Equipo con tu correo <b>{email || 'de Forma Prima'}</b>. En cuanto lo hagan, este enlace te llevará directo al panel.
        </p>
      </div>
    )
  }

  redirect(`${urlSalas(headers().get('host') ?? '')}/entrar?pase=${encodeURIComponent(crearPase(miembro.id))}`)
}
