'use client'

import { useState } from 'react'
import { ContenidoEditor } from './ContenidoEditor'
import { ProyectosEditor } from './ProyectosEditor'
import { EquipoEditor } from './EquipoEditor'
import { FpToolsEditor } from './FpToolsEditor'
import { PropiedadesEditor } from './PropiedadesEditor'
import type { WebProyecto, ContentMap } from '@/lib/web-publica'
import type { WebEquipo } from '@/lib/web-equipo'
import type { WebFpTool } from '@/lib/web-fp-tools'
import type { WebPropiedad } from '@/lib/web-propiedades'

const ORANGE = '#D85A30'
const INK = '#1A1A1A'
const BORDER = '#F0EEE8'

type Tab = 'contenido' | 'proyectos' | 'equipo' | 'fp_tools' | 'propiedades'

export function WebPublicaPage({
  proyectos, content, equipo, tools, propiedades,
}: {
  proyectos: WebProyecto[]
  content: Record<string, ContentMap>
  equipo: WebEquipo[]
  tools: WebFpTool[]
  propiedades: WebPropiedad[]
}) {
  const [tab, setTab] = useState<Tab>('contenido')

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1000 }}>
      <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: `${INK}99`, marginBottom: 8 }}>
        Marketing · Forma Prima
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, color: INK, letterSpacing: '-0.02em', margin: 0 }}>
          Web pública
        </h1>
        <a href="/wip" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: ORANGE, fontWeight: 500, textDecoration: 'none' }}>
          Ver teaser ↗
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${BORDER}`, marginBottom: 28 }}>
        {([['contenido', 'Contenido'], ['proyectos', 'Proyectos'], ['equipo', 'Equipo'], ['fp_tools', 'FP Tools'], ['propiedades', 'Real Estate']] as [Tab, string][]).map(([id, label]) => {
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)}
              style={{
                background: 'none', border: 'none', padding: '0 0 12px', cursor: 'pointer',
                fontSize: 13, letterSpacing: '0.04em', color: active ? INK : `${INK}55`, fontWeight: active ? 500 : 400,
                borderBottom: `2px solid ${active ? INK : 'transparent'}`, marginBottom: -1,
              }}>
              {label}
            </button>
          )
        })}
      </div>

      {tab === 'contenido' && <ContenidoEditor content={content} />}
      {tab === 'proyectos' && <ProyectosEditor proyectos={proyectos} />}
      {tab === 'equipo' && <EquipoEditor equipo={equipo} />}
      {tab === 'fp_tools' && <FpToolsEditor tools={tools} />}
      {tab === 'propiedades' && <PropiedadesEditor propiedades={propiedades} />}
    </div>
  )
}
