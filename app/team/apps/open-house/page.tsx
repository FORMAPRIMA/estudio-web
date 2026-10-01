import { redirect } from 'next/navigation'
import { usuarioEquipo } from '@/lib/open-house/equipo'

export const metadata = { title: 'Open House CC38' }

// Panel del Open House · Claudio Coello 38: el diseño de Claude Design en modo
// estudio, enmarcado. Invitaciones, horarios, exportación y postales.
export default async function OpenHousePage() {
  if (!(await usuarioEquipo())) redirect('/login')
  return (
    <iframe
      src="/team/apps/open-house/app"
      title="Open House CC38"
      style={{ display: 'block', width: '100%', height: 'calc(100dvh - var(--fp-team-top, 0px))', minHeight: 600, border: 0, background: '#fff' }}
    />
  )
}
