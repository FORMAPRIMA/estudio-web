'use client'

import { useState } from 'react'
import { TEMPLATE_DEFAULT } from '@/app/team/fp-execution/template/templateData'

interface FileItem { id: string; name: string; size: number; path?: string }
interface UploadZone {
  id: string; pdf: FileItem | null; dwg: FileItem | null; textFile: FileItem | null
  coveredSubIds: string[]; partnerIds: string[]
}
interface ExecutionProject {
  id: string; nombre: string; cliente: string; direccion: string; ciudad: string
  descripcion: string; activeSubIds: string[]; generalFiles: FileItem[]
  chapterZones: Record<string, UploadZone[]>
}
interface Partner { id: string; nombre: string; especialidades: string[] }

interface PackagePreview {
  partnerId: string
  partnerNombre: string
  capitulos: {
    id: string; numero: number; nombre: string
    subcapitulos: { id: string; nombre: string }[]
    zonas: { pdf: FileItem | null; dwg: FileItem | null; textFile: FileItem | null }[]
  }[]
  totalDocs: number
}

function computePackages(project: ExecutionProject, partners: Partner[]): PackagePreview[] {
  const map = new Map<string, PackagePreview>()

  for (const cap of TEMPLATE_DEFAULT) {
    const zones: UploadZone[] = project.chapterZones[cap.id] ?? []
    for (const zone of zones) {
      for (const partnerId of zone.partnerIds) {
        if (!map.has(partnerId)) {
          const p = partners.find(x => x.id === partnerId)
          if (!p) continue
          map.set(partnerId, { partnerId, partnerNombre: p.nombre, capitulos: [], totalDocs: 0 })
        }
        const pkg = map.get(partnerId)!
        let capEntry = pkg.capitulos.find(c => c.id === cap.id)
        if (!capEntry) {
          capEntry = { id: cap.id, numero: cap.numero, nombre: cap.nombre, subcapitulos: [], zonas: [] }
          pkg.capitulos.push(capEntry)
        }
        const subs = cap.subcapitulos.filter(s =>
          zone.coveredSubIds.includes(s.id) && project.activeSubIds.includes(s.id)
        )
        subs.forEach(s => { if (!capEntry!.subcapitulos.find(x => x.id === s.id)) capEntry!.subcapitulos.push(s) })
        capEntry.zonas.push({ pdf: zone.pdf, dwg: zone.dwg, textFile: zone.textFile })
        pkg.totalDocs += (zone.pdf ? 1 : 0) + (zone.dwg ? 1 : 0) + (zone.textFile ? 1 : 0)
      }
    }
  }

  return Array.from(map.values())
}

const labelSt: React.CSSProperties = { fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', fontWeight: 600, marginBottom: 8, display: 'block' }

export default function ReviewStep({ project, partners }: { project: ExecutionProject; partners: Partner[] }) {
  const [view, setView] = useState<'por_ep' | 'por_capitulo'>('por_ep')
  const packages = computePackages(project, partners)

  const fileBadge = (f: FileItem | null, ext: string) => f ? (
    <span style={{ fontSize: 9, background: '#1A1A1A', color: '#fff', padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ext}</span>
  ) : null

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 200, color: '#1A1A1A', marginBottom: 8, letterSpacing: '-0.01em' }}>Revisar paquetes</h2>
      <p style={{ fontSize: 13, color: '#888', fontWeight: 300, marginBottom: 24, lineHeight: 1.6 }}>
        Comprueba los paquetes de licitación antes de lanzar. {packages.length} partner{packages.length !== 1 ? 's' : ''} recibirán invitación.
      </p>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #E8E6E0' }}>
        {([['por_ep', 'Por Execution Partner'], ['por_capitulo', 'Por capítulo']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px',
            fontSize: 12, fontWeight: view === k ? 500 : 400,
            color: view === k ? '#1A1A1A' : '#AAA',
            borderBottom: `2px solid ${view === k ? '#1A1A1A' : 'transparent'}`,
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {packages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#AAA', border: '1px dashed #E8E6E0', borderRadius: 6 }}>
          <p style={{ fontSize: 13, fontWeight: 300 }}>No hay Execution Partners asignados en ninguna zona.</p>
          <p style={{ fontSize: 11, fontWeight: 300, marginTop: 4 }}>Vuelve a los capítulos y asigna EPs a las zonas.</p>
        </div>
      ) : view === 'por_ep' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {packages.map(pkg => (
            <div key={pkg.partnerId} style={{ border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ background: '#1A1A1A', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 400, color: '#fff' }}>{pkg.partnerNombre}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>
                    {pkg.capitulos.length} cap.
                  </span>
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>
                    {pkg.totalDocs + project.generalFiles.length} docs
                  </span>
                </div>
              </div>
              <div style={{ padding: 16 }}>
                {/* General files */}
                {project.generalFiles.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={labelSt}>Documentación general</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {project.generalFiles.map(f => (
                        <div key={f.id} style={{ fontSize: 11, background: '#F8F7F4', border: '1px solid #E8E6E0', padding: '4px 10px', borderRadius: 3, color: '#555' }}>
                          {f.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Chapters */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pkg.capitulos.map(cap => (
                    <div key={cap.id} style={{ border: '1px solid #F0EEE8', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ background: '#FAFAF8', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>{cap.numero}. {cap.nombre}</span>
                        <span style={{ fontSize: 10, color: '#AAA' }}>{cap.subcapitulos.length} subcap.</span>
                      </div>
                      <div style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                          {cap.subcapitulos.map(s => (
                            <span key={s.id} style={{ fontSize: 10, background: '#F0EEE8', color: '#666', padding: '2px 8px', borderRadius: 10 }}>{s.nombre}</span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {cap.zonas.map((z, i) => (
                            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {fileBadge(z.pdf, 'PDF')}
                              {fileBadge(z.dwg, 'DWG')}
                              {fileBadge(z.textFile, 'TXT')}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Por capítulo
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {TEMPLATE_DEFAULT.filter(c => c.subcapitulos.some(s => project.activeSubIds.includes(s.id))).map(cap => {
            const epsInCap = packages.filter(pkg => pkg.capitulos.find(c => c.id === cap.id))
            if (epsInCap.length === 0) return null
            return (
              <div key={cap.id} style={{ border: '1px solid #E8E6E0', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: '#FAFAF8', padding: '12px 16px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 400, color: '#1A1A1A' }}>{cap.numero}. {cap.nombre}</span>
                  <span style={{ fontSize: 10, color: '#AAA' }}>{epsInCap.length} partner{epsInCap.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {epsInCap.map(pkg => {
                    const capEntry = pkg.capitulos.find(c => c.id === cap.id)!
                    return (
                      <div key={pkg.partnerId} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', minWidth: 160, flexShrink: 0 }}>{pkg.partnerNombre}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                            {capEntry.subcapitulos.map(s => (
                              <span key={s.id} style={{ fontSize: 10, background: '#F0EEE8', color: '#666', padding: '2px 8px', borderRadius: 10 }}>{s.nombre}</span>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {capEntry.zonas.map((z, i) => (
                              <div key={i} style={{ display: 'flex', gap: 3 }}>
                                {fileBadge(z.pdf, 'PDF')}
                                {fileBadge(z.dwg, 'DWG')}
                                {fileBadge(z.textFile, 'TXT')}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { computePackages }
export type { PackagePreview }
