import { headers, cookies } from 'next/headers'
import {
  getEspacioByToken,
  registrarAccesoEspacio,
  registrarEventoEspacio,
  submitEspacioBienvenida,
  getEspacioPropuesta,
  getEspacioFormalizacion,
  getEspacioContrato,
  getEspacioProyectos,
} from '@/app/actions/espacios'
import PropuestaView from '@/components/espacio/PropuestaView'
import FormalizacionView from '@/components/espacio/FormalizacionView'
import ContratoView from '@/components/espacio/ContratoView'
import ProyectoHome from '@/components/espacio/ProyectoHome'
import ClientPortal from '@/components/portal/ClientPortal'
import { loadPortalData } from '@/lib/portal/load'
import { createClient } from '@/lib/supabase/server'
import {
  generateEspacioCookieToken,
  espacioCookieName,
} from '@/lib/espacio/access'
import { requierePin, type Etapa } from '@/lib/espacio/theme'
import { getStudio, HERO_IMAGE, getOrderedProyectoImages } from '@/lib/espacio/studio'
import EspacioGate from '@/components/espacio/EspacioGate'
import BienvenidaPage from '@/components/public/BienvenidaPage'

export const dynamic = 'force-dynamic'

function NoDisponible() {
  return (
    <div style={{
      minHeight: '100vh', background: '#1A1A1A', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', system-ui, sans-serif",
      padding: '40px 24px', textAlign: 'center',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/FORMA_PRIMA_BLANCO.png" alt="Forma Prima" style={{ height: 28, marginBottom: 40, opacity: 0.9 }} />
      <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', fontWeight: 300 }}>
        Este enlace no está disponible.
      </p>
    </div>
  )
}

// ¿Es un miembro del equipo FP autenticado? (bypass del PIN, como en /portal/[id])
async function isTeamMember(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    return ['fp_partner', 'fp_manager', 'fp_team', 'fp_biz_dev'].includes(profile?.rol as string)
  } catch {
    return false
  }
}

export default async function EspacioPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams?: { p?: string }
}) {
  const { token } = params

  // Tracking de acceso (no bloqueante).
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'desconocida'
  const ua = h.get('user-agent') ?? ''
  void registrarAccesoEspacio(token, ip, ua)

  const espacio = await getEspacioByToken(token)
  if (!espacio) return <NoDisponible />

  const etapa = (espacio.etapa ?? 'bienvenida') as Etapa
  const team = requierePin(etapa) ? await isTeamMember() : false

  // Gate de PIN: solo a partir de contenido privado (propuesta en adelante).
  if (requierePin(etapa) && !team) {
    const cookieStore = await cookies()
    const cookie = cookieStore.get(espacioCookieName(token))?.value
    const valid = cookie === generateEspacioCookieToken(token)
    if (!valid) {
      return <EspacioGate token={token} nombre={espacio.nombre} needsSetup={!espacio.pin_hash} />
    }
  }

  // ── Etapa Propuesta: vista comercial ────────────────────────────────────────
  if (etapa === 'propuesta') {
    const data = await getEspacioPropuesta(token)
    if (!data) {
      return (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <span className="fp-section-label">Propuesta</span>
          <h1 style={{ fontSize: 26, fontWeight: 300 }}>Estamos preparando tu propuesta.</h1>
          <p style={{ color: '#888', marginTop: 12 }}>Te avisaremos en cuanto esté disponible aquí.</p>
        </div>
      )
    }
    // Registramos la apertura solo cuando la ve el cliente (no el equipo).
    if (!team) void registrarEventoEspacio(token, 'propuesta_vista', { propuestaId: data.propuestaId })
    return <PropuestaView token={token} nombre={espacio.nombre} vm={data.vm} status={data.status} />
  }

  // ── Etapa Formalización: captura progresiva de datos del firmante ───────────
  if (etapa === 'formalizacion') {
    const data = await getEspacioFormalizacion(token)
    if (data && !data.completado) {
      return <FormalizacionView token={token} nombre={espacio.nombre} lead={data.lead} />
    }
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
        <span className="fp-section-label">Formalización</span>
        <h1 style={{ fontSize: 26, fontWeight: 300 }}>¡Gracias, {espacio.nombre}!</h1>
        <p style={{ color: '#888', marginTop: 12, lineHeight: 1.7 }}>
          Hemos recibido tus datos. Estamos preparando tu contrato y te avisaremos aquí en cuanto esté listo para firmar.
        </p>
      </div>
    )
  }

  // ── Etapa Contrato: estado + propuesta archivada + PDF firmado ──────────────
  if (etapa === 'contrato') {
    const contrato = await getEspacioContrato(token)
    if (contrato) {
      return <ContratoView token={token} nombre={espacio.nombre} contrato={contrato} />
    }
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
        <span className="fp-section-label">Contrato</span>
        <h1 style={{ fontSize: 26, fontWeight: 300 }}>Estamos preparando tu contrato.</h1>
        <p style={{ color: '#888', marginTop: 12 }}>Te avisaremos aquí en cuanto esté listo.</p>
      </div>
    )
  }

  // ── Etapa Proyecto: multi-proyecto + portal (reusa ClientPortal) ────────────
  if (etapa === 'proyecto') {
    const data = await getEspacioProyectos(token)
    if (!data || data.proyectos.length === 0) {
      return (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <span className="fp-section-label">Proyecto</span>
          <h1 style={{ fontSize: 26, fontWeight: 300 }}>Tu proyecto arranca muy pronto.</h1>
          <p style={{ color: '#888', marginTop: 12 }}>Aquí verás el avance de obra, visitas, cronograma y documentos.</p>
        </div>
      )
    }

    // Proyecto seleccionado por ?p= (validado contra los del cliente) o único.
    const requested = searchParams?.p && data.proyectos.some(p => p.id === searchParams.p) ? searchParams.p : null
    const selectedId = requested ?? (data.proyectos.length === 1 ? data.proyectos[0].id : null)

    if (!selectedId) {
      return <ProyectoHome token={token} nombre={espacio.nombre} proyectos={data.proyectos} />
    }

    const props = await loadPortalData(selectedId)
    if (!props) return <ProyectoHome token={token} nombre={espacio.nombre} proyectos={data.proyectos} />

    return (
      <>
        {data.proyectos.length > 1 && (
          <div style={{ padding: '14px 24px', borderBottom: '1px solid #E5E2DA', background: '#fff' }}>
            <a href={`/espacio/${token}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← Mis proyectos</a>
          </div>
        )}
        <ClientPortal {...props} />
      </>
    )
  }

  // ── Etapa Bienvenida: la landing comercial (reusa BienvenidaPage) ───────────
  if (etapa === 'bienvenida') {
    const lang = espacio.idioma === 'en' ? 'en' : 'es'
    const proyectoImages = await getOrderedProyectoImages()
    return (
      <BienvenidaPage
        nombreCliente={espacio.nombre}
        token={token}
        heroImage={HERO_IMAGE}
        proyectoImages={proyectoImages}
        studio={getStudio(lang)}
        submitAction={submitEspacioBienvenida}
        lang={lang}
      />
    )
  }

  // TODO (Fase 2+): propuesta · formalizacion · contrato · proyecto.
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '80px 24px' }}>
      <span className="fp-section-label">{etapa}</span>
      <h1 style={{ fontSize: 28, fontWeight: 300 }}>Espacio de {espacio.nombre}</h1>
      <p style={{ color: '#888', marginTop: 12 }}>
        Etapa actual: <strong>{etapa}</strong>. La cara de esta etapa se implementa en las siguientes fases.
      </p>
    </div>
  )
}
