import type { ReactNode } from 'react'
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
import {
  generateEspacioCookieToken,
  espacioCookieName,
  generatePresentationCookieToken,
  presentationCookieName,
} from '@/lib/espacio/access'
import { requierePin, type Etapa } from '@/lib/espacio/theme'
import { getStudio, HERO_IMAGE, getOrderedProyectoImages } from '@/lib/espacio/studio'
import EspacioGate from '@/components/espacio/EspacioGate'
import PresentationBadge from '@/components/espacio/PresentationBadge'
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

export default async function EspacioPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams?: { p?: string }
}) {
  const { token } = params

  const espacio = await getEspacioByToken(token)
  if (!espacio) return <NoDisponible />

  const etapa = (espacio.etapa ?? 'bienvenida') as Etapa

  // ── ¿Vista interna en "modo presentación"? ───────────────────────────────
  // ÚNICA vía: el PIN maestro de administración (1330), que setea una cookie de
  // presentación atada a este Espacio. NO existe bypass por estar logueado como
  // equipo: a partir de la propuesta el portal exige PIN para todos, de modo que
  // los roles sin acceso a información sensible no pueden colarse. Las visitas en
  // modo presentación nunca cuentan como acceso del cliente.
  const cookieStore = await cookies()
  const presentationValid =
    cookieStore.get(presentationCookieName(token))?.value === generatePresentationCookieToken(token)
  const needsPin = requierePin(etapa)
  const clientCookieValid =
    cookieStore.get(espacioCookieName(token))?.value === generateEspacioCookieToken(token)

  // Gate de PIN: contenido privado sin autorización → pedir PIN. (No cuenta acceso:
  // ver la pantalla del PIN no es "ver la propuesta".)
  if (needsPin && !presentationValid && !clientCookieValid) {
    return <EspacioGate token={token} nombre={espacio.nombre} needsSetup={!espacio.pin_hash} />
  }

  // Tracking de acceso (no bloqueante): SOLO visitas reales de cliente ya
  // autorizado (cookie válida, o etapa pública). El modo presentación (PIN
  // maestro) nunca cuenta. Se registra aquí, tras el gate, no antes.
  const clienteAutorizado = !presentationValid && (!needsPin || clientCookieValid)
  if (clienteAutorizado) {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'desconocida'
    const ua = h.get('user-agent') ?? ''
    void registrarAccesoEspacio(token, ip, ua)
  }

  let content: ReactNode = null

  // ── Etapa Propuesta: vista comercial ──────────────────────────────────────
  if (etapa === 'propuesta') {
    const data = await getEspacioPropuesta(token)
    if (!data) {
      content = (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <span className="fp-section-label">Propuesta</span>
          <h1 style={{ fontSize: 26, fontWeight: 300 }}>Estamos preparando tu propuesta.</h1>
          <p style={{ color: '#888', marginTop: 12 }}>Te avisaremos en cuanto esté disponible aquí.</p>
        </div>
      )
    } else {
      // Registramos la apertura solo cuando la ve el cliente (no en presentación).
      if (!presentationValid) void registrarEventoEspacio(token, 'propuesta_vista', { propuestaId: data.propuestaId })
      content = <PropuestaView token={token} nombre={espacio.nombre} vm={data.vm} status={data.status} />
    }

  // ── Etapa Formalización: captura progresiva de datos del firmante ─────────
  } else if (etapa === 'formalizacion') {
    const data = await getEspacioFormalizacion(token)
    if (data && !data.completado) {
      content = <FormalizacionView token={token} nombre={espacio.nombre} lead={data.lead} />
    } else {
      content = (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <span className="fp-section-label">Formalización</span>
          <h1 style={{ fontSize: 26, fontWeight: 300 }}>¡Gracias, {espacio.nombre}!</h1>
          <p style={{ color: '#888', marginTop: 12, lineHeight: 1.7 }}>
            Hemos recibido tus datos. Estamos preparando tu contrato y te avisaremos aquí en cuanto esté listo para firmar.
          </p>
        </div>
      )
    }

  // ── Etapa Contrato: estado + propuesta archivada + PDF firmado ────────────
  } else if (etapa === 'contrato') {
    const contrato = await getEspacioContrato(token)
    if (contrato) {
      content = <ContratoView token={token} nombre={espacio.nombre} contrato={contrato} />
    } else {
      content = (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <span className="fp-section-label">Contrato</span>
          <h1 style={{ fontSize: 26, fontWeight: 300 }}>Estamos preparando tu contrato.</h1>
          <p style={{ color: '#888', marginTop: 12 }}>Te avisaremos aquí en cuanto esté listo.</p>
        </div>
      )
    }

  // ── Etapa Proyecto: multi-proyecto + portal (reusa ClientPortal) ──────────
  } else if (etapa === 'proyecto') {
    const data = await getEspacioProyectos(token)
    if (!data || data.proyectos.length === 0) {
      content = (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <span className="fp-section-label">Proyecto</span>
          <h1 style={{ fontSize: 26, fontWeight: 300 }}>Tu proyecto arranca muy pronto.</h1>
          <p style={{ color: '#888', marginTop: 12 }}>Aquí verás el avance de obra, visitas, cronograma y documentos.</p>
        </div>
      )
    } else {
      // Proyecto seleccionado por ?p= (validado contra los del cliente) o único.
      const requested = searchParams?.p && data.proyectos.some(p => p.id === searchParams.p) ? searchParams.p : null
      const selectedId = requested ?? (data.proyectos.length === 1 ? data.proyectos[0].id : null)

      if (!selectedId) {
        content = <ProyectoHome token={token} nombre={espacio.nombre} proyectos={data.proyectos} />
      } else {
        const props = await loadPortalData(selectedId)
        if (!props) {
          content = <ProyectoHome token={token} nombre={espacio.nombre} proyectos={data.proyectos} />
        } else {
          content = (
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
      }
    }

  // ── Etapa Bienvenida: la landing comercial (reusa BienvenidaPage) ─────────
  } else if (etapa === 'bienvenida') {
    const lang = espacio.idioma === 'en' ? 'en' : 'es'
    const proyectoImages = await getOrderedProyectoImages()
    content = (
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

  } else {
    content = (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '80px 24px' }}>
        <span className="fp-section-label">{etapa}</span>
        <h1 style={{ fontSize: 28, fontWeight: 300 }}>Espacio de {espacio.nombre}</h1>
        <p style={{ color: '#888', marginTop: 12 }}>
          Etapa actual: <strong>{etapa}</strong>.
        </p>
      </div>
    )
  }

  return (
    <>
      {content}
      {presentationValid && <PresentationBadge />}
    </>
  )
}
