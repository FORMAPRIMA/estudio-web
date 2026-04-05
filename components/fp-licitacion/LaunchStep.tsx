'use client'

import { useState } from 'react'
import { lanzarLicitacion } from '@/app/actions/fp-licitacion'
import type { PackagePreview } from './ReviewStep'

interface FileItem { id: string; name: string; size: number; path?: string }
interface Partner { id: string; nombre: string; contacto_nombre?: string; especialidades: string[] }
interface ExecutionProject {
  id: string; nombre: string; cliente: string; direccion: string; ciudad: string; descripcion: string
  generalFiles: FileItem[]
}

const inputSt: React.CSSProperties = {
  width: '100%', border: '1px solid #E8E6E0', background: '#fff',
  padding: '9px 12px', fontSize: 13, color: '#1A1A1A', fontWeight: 300,
  outline: 'none', borderRadius: 3, boxSizing: 'border-box',
}
const labelSt: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#AAA', fontWeight: 600, marginBottom: 8, display: 'block',
}

function generarTexto(project: ExecutionProject, partner: Partner, subcaps: string[], fechaLimite: string): string {
  const fecha = fechaLimite ? new Date(fechaLimite).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const contacto = partner.contacto_nombre || partner.nombre
  const direccion = [project.direccion, project.ciudad].filter(Boolean).join(', ')
  const listaUnidades = subcaps.length > 0 ? subcaps.join(', ') : 'las unidades de obra indicadas'

  return `Estimado/a ${contacto},

En nombre del equipo de Forma Prima, nos complace invitarle a participar en el proceso de licitación del siguiente proyecto de reforma e interiorismo:

Proyecto: ${project.nombre}${direccion ? `\nDirección: ${direccion}` : ''}${project.descripcion ? `\nDescripción: ${project.descripcion}` : ''}

Le invitamos a presentar su oferta económica para las siguientes unidades de obra: ${listaUnidades}.

Fecha límite para la presentación de ofertas: ${fecha}.

A través del enlace adjunto tendrá acceso a toda la documentación técnica necesaria del proyecto, así como al formulario estructurado para presentar su oferta de forma detallada por subcapítulos.

Valoramos enormemente su colaboración y esperamos contar con su participación en este proceso.

Un cordial saludo,
El equipo de Forma Prima`
}

interface LaunchStepProps {
  project: ExecutionProject
  packages: PackagePreview[]
  partners: Partner[]
  onLaunched: () => void
}

export default function LaunchStep({ project, packages, partners, onLaunched }: LaunchStepProps) {
  const tomorrow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [fechaLimite, setFechaLimite] = useState(tomorrow)
  const [descripcionExtra, setDescripcionExtra] = useState('')
  const [loading, setLoading] = useState(false)
  const [launched, setLaunched] = useState<{ token: string; partnerNombre: string }[] | null>(null)
  const [error, setError] = useState('')

  const previewPartner = packages[0]
    ? partners.find(p => p.id === packages[0].partnerId) ?? null
    : null
  const previewSubcaps = packages[0]?.capitulos.flatMap(c => c.subcapitulos.map(s => s.nombre)) ?? []
  const textoPreview = previewPartner
    ? generarTexto({ ...project, descripcion: descripcionExtra || project.descripcion }, previewPartner, previewSubcaps, fechaLimite)
    : ''

  const handleLanzar = async () => {
    if (!fechaLimite) { setError('Establece una fecha límite.'); return }
    if (packages.length === 0) { setError('No hay paquetes configurados.'); return }
    setLoading(true); setError('')

    const paquetesInput = packages.map(pkg => {
      const partner = partners.find(p => p.id === pkg.partnerId)!
      const allSubcaps = pkg.capitulos.flatMap(c => c.subcapitulos.map(s => s.nombre))
      return {
        partnerId: pkg.partnerId,
        scope: {
          projectNombre: project.nombre,
          projectDireccion: project.direccion,
          projectDescripcion: descripcionExtra || project.descripcion,
          fechaLimite,
          generalFiles: project.generalFiles,
          capitulos: pkg.capitulos.map(c => ({
            id: c.id,
            numero: c.numero,
            nombre: c.nombre,
            subcapitulos: c.subcapitulos,
            zonas: c.zonas,
          })),
          textoInvitacion: generarTexto(
            { ...project, descripcion: descripcionExtra || project.descripcion },
            partner, allSubcaps, fechaLimite
          ),
        },
      }
    })

    const result = await lanzarLicitacion({
      projectId: project.id,
      descripcionProyecto: descripcionExtra || project.descripcion,
      fechaLimite: new Date(fechaLimite).toISOString(),
      paquetes: paquetesInput,
    })

    setLoading(false)

    if ('error' in result && result.error) {
      setError(result.error)
      return
    }

    const paquetesConNombre = (result.paquetes ?? []).map((paq: any) => ({
      token: paq.token,
      partnerNombre: partners.find(p => p.id === paq.partner_id)?.nombre ?? paq.partner_id,
    }))
    setLaunched(paquetesConNombre)
    onLaunched()
  }

  if (launched) {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return (
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 200, color: '#1A1A1A', marginBottom: 8, letterSpacing: '-0.01em' }}>Licitación lanzada</h2>
        <p style={{ fontSize: 13, color: '#888', fontWeight: 300, marginBottom: 24, lineHeight: 1.6 }}>
          Se han generado {launched.length} paquete{launched.length !== 1 ? 's' : ''} de licitación. Comparte cada enlace con el Execution Partner correspondiente.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {launched.map(({ token, partnerNombre }) => (
            <div key={token} style={{ border: '1px solid #E8E6E0', borderRadius: 6, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', margin: 0 }}>{partnerNombre}</p>
                <p style={{ fontSize: 11, color: '#AAA', margin: '3px 0 0', fontFamily: 'monospace' }}>{base}/licitacion/{token}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(`${base}/licitacion/${token}`)}
                style={{ fontSize: 11, padding: '6px 14px', border: '1px solid #E8E6E0', background: '#fff', color: '#555', cursor: 'pointer', borderRadius: 4, flexShrink: 0 }}
              >
                Copiar enlace
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 200, color: '#1A1A1A', marginBottom: 8, letterSpacing: '-0.01em' }}>Lanzar licitación</h2>
      <p style={{ fontSize: 13, color: '#888', fontWeight: 300, marginBottom: 28, lineHeight: 1.6 }}>
        Se enviará un paquete personalizado a {packages.length} Execution Partner{packages.length !== 1 ? 's' : ''}.
        El texto de invitación se genera automáticamente con los datos del proyecto.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: config */}
        <div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelSt}>Fecha límite de entrega de ofertas *</label>
            <input
              type="date"
              value={fechaLimite}
              onChange={e => setFechaLimite(e.target.value)}
              style={inputSt}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelSt}>Información adicional del proyecto (opcional)</label>
            <textarea
              value={descripcionExtra}
              onChange={e => setDescripcionExtra(e.target.value)}
              placeholder="Añade contexto adicional que quieras incluir en la invitación…"
              style={{ ...inputSt, minHeight: 100, resize: 'vertical' }}
            />
            <p style={{ fontSize: 10, color: '#CCC', margin: '6px 0 0' }}>
              Si dejas este campo vacío se usará la descripción del proyecto.
            </p>
          </div>

          <div style={{ background: '#F8F7F4', border: '1px solid #E8E6E0', borderRadius: 6, padding: 16, marginBottom: 20 }}>
            <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA', fontWeight: 600, marginBottom: 12 }}>Resumen</p>
            {packages.map(pkg => (
              <div key={pkg.partnerId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', marginBottom: 6 }}>
                <span>{pkg.partnerNombre}</span>
                <span style={{ color: '#AAA' }}>{pkg.capitulos.length} cap. · {pkg.capitulos.reduce((n, c) => n + c.subcapitulos.length, 0)} subcap.</span>
              </div>
            ))}
          </div>

          {error && <p style={{ fontSize: 12, color: '#C0392B', marginBottom: 16 }}>{error}</p>}

          <button
            onClick={handleLanzar}
            disabled={loading || packages.length === 0}
            style={{
              width: '100%', fontSize: 13, fontWeight: 500, padding: '12px 20px',
              border: 'none', background: loading || packages.length === 0 ? '#E8E6E0' : '#1A1A1A',
              color: loading || packages.length === 0 ? '#AAA' : '#fff',
              cursor: loading || packages.length === 0 ? 'default' : 'pointer', borderRadius: 4,
            }}
          >
            {loading ? 'Lanzando…' : `Lanzar proceso de licitación →`}
          </button>
        </div>

        {/* Right: preview of invitation text */}
        <div>
          <label style={labelSt}>Vista previa del texto de invitación{previewPartner ? ` — ${previewPartner.nombre}` : ''}</label>
          <div style={{
            border: '1px solid #E8E6E0', borderRadius: 6, padding: 16,
            fontSize: 12, color: '#444', lineHeight: 1.8, whiteSpace: 'pre-wrap',
            background: '#FAFAF8', maxHeight: 420, overflowY: 'auto', fontWeight: 300,
          }}>
            {textoPreview || <span style={{ color: '#CCC', fontStyle: 'italic' }}>Sin paquetes configurados</span>}
          </div>
          {packages.length > 1 && (
            <p style={{ fontSize: 10, color: '#CCC', marginTop: 6 }}>
              Mostrando vista previa del primero. Cada partner recibe su texto personalizado.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
