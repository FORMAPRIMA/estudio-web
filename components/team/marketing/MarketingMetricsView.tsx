'use client'

import { useMemo } from 'react'
import type {
  ProyectoNegocio,
  SeccionNegocio,
  FaseNegocio,
} from '@/components/team/proyectos/PlantillaManager'

// ── Types ─────────────────────────────────────────────────────────────────

export interface MarketingMetricsEntry {
  user_id:            string
  horas:              number
  es_extra:           boolean
  categoria_interna?: string | null
}

export interface MarketingMetricsMember {
  id:        string
  nombre:    string
  initials:  string
  color:     string
  avatar_url?: string | null
}

interface Props {
  entries:          MarketingMetricsEntry[]
  proyectosNegocio: ProyectoNegocio[]
  seccionesNegocio: SeccionNegocio[]
  fasesNegocio:     FaseNegocio[]
  teamMembers:      MarketingMetricsMember[]
  /** 'personal' shows aggregate without the per-person breakdown.
   *  'team' shows aggregate + per-person table. */
  mode:             'personal' | 'team'
  /** When set, restrict computations to this user (useful for biz_dev viewing themselves
   *  inside a partner-rendered context). */
  userIdFilter?:    string
  /** Optional period label shown in the header (e.g. "Mar 2026", "1 abr — 7 abr"). */
  periodLabel?:     string
}

// ── Color helpers ─────────────────────────────────────────────────────────

const KNOWN_CHANNELS: Record<string, { bg: string; tc: string }> = {
  instagram: { bg: '#FCE6F0', tc: '#8B1A4F' },
  linkedin:  { bg: '#E1EDF7', tc: '#0A4677' },
  facebook:  { bg: '#E5ECF7', tc: '#1B3D7A' },
  tiktok:    { bg: '#EDEDED', tc: '#1A1A1A' },
  youtube:   { bg: '#FBE3E3', tc: '#8C1818' },
  email:     { bg: '#FBEFD8', tc: '#7A4F0A' },
  web:       { bg: '#EDE5F8', tc: '#3F1F70' },
  prensa:    { bg: '#E8E8DE', tc: '#3A3A1F' },
  estrategia:{ bg: '#E5EFE9', tc: '#1F4A2E' },
}

const FALLBACK_PALETTE = [
  { bg: '#EDE5F8', tc: '#3F1F70' },
  { bg: '#F0EBF8', tc: '#5B3A7E' },
  { bg: '#E5E0F0', tc: '#4A3970' },
  { bg: '#F4ECFA', tc: '#6B3F8E' },
  { bg: '#E1D8EE', tc: '#3D2761' },
]

function channelColor(name: string): { bg: string; tc: string } {
  const k = name.trim().toLowerCase()
  for (const known of Object.keys(KNOWN_CHANNELS)) {
    if (k.includes(known)) return KNOWN_CHANNELS[known]
  }
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length]
}

// ── Component ─────────────────────────────────────────────────────────────

export function MarketingMetricsView({
  entries,
  proyectosNegocio,
  seccionesNegocio,
  fasesNegocio,
  teamMembers,
  mode,
  userIdFilter,
  periodLabel,
}: Props) {
  // Build lookups once
  const lookup = useMemo(() => {
    const fasesById = new Map(fasesNegocio.map(f => [f.id, f]))
    const seccionesById = new Map(seccionesNegocio.map(s => [s.id, s]))
    const proyectosById = new Map(proyectosNegocio.map(p => [p.id, p]))
    return { fasesById, seccionesById, proyectosById }
  }, [fasesNegocio, seccionesNegocio, proyectosNegocio])

  const data = useMemo(() => {
    // proyectoId → { nombre, sections: { seccionId → { hours, extra, nombre, fases: { faseId → { nombre, hours, extra } } } } }
    type SeccionAgg = {
      id:       string
      nombre:   string
      hours:    number
      extra:    number
      fases:    Map<string, { id: string; nombre: string; hours: number; extra: number }>
    }
    type ProyectoAgg = {
      id:       string
      nombre:   string
      hours:    number
      extra:    number
      secciones: Map<string, SeccionAgg>
    }
    const proyectoMap = new Map<string, ProyectoAgg>()
    const memberMap = new Map<string, { hours: number; extra: number; topProyectos: Map<string, number> }>()

    let totalHours = 0
    let totalExtra = 0

    for (const entry of entries) {
      if (userIdFilter && entry.user_id !== userIdFilter) continue
      const cat = entry.categoria_interna
      if (!cat || !cat.startsWith('iproj_')) continue
      const faseId = cat.slice(6)
      const fase = lookup.fasesById.get(faseId)
      if (!fase) continue
      const seccion = lookup.seccionesById.get(fase.seccion_id)
      if (!seccion) continue
      const proyecto = lookup.proyectosById.get(seccion.proyecto_id)
      if (!proyecto || proyecto.equipo !== 'marketing') continue

      // Aggregate by proyecto/seccion/fase
      let proy = proyectoMap.get(proyecto.id)
      if (!proy) {
        proy = { id: proyecto.id, nombre: proyecto.nombre, hours: 0, extra: 0, secciones: new Map() }
        proyectoMap.set(proyecto.id, proy)
      }
      proy.hours += entry.horas
      if (entry.es_extra) proy.extra += entry.horas

      let sec = proy.secciones.get(seccion.id)
      if (!sec) {
        sec = { id: seccion.id, nombre: seccion.nombre, hours: 0, extra: 0, fases: new Map() }
        proy.secciones.set(seccion.id, sec)
      }
      sec.hours += entry.horas
      if (entry.es_extra) sec.extra += entry.horas

      let f = sec.fases.get(fase.id)
      if (!f) {
        f = { id: fase.id, nombre: fase.nombre, hours: 0, extra: 0 }
        sec.fases.set(fase.id, f)
      }
      f.hours += entry.horas
      if (entry.es_extra) f.extra += entry.horas

      // Per-member aggregation (for team mode)
      let mb = memberMap.get(entry.user_id)
      if (!mb) {
        mb = { hours: 0, extra: 0, topProyectos: new Map() }
        memberMap.set(entry.user_id, mb)
      }
      mb.hours += entry.horas
      if (entry.es_extra) mb.extra += entry.horas
      mb.topProyectos.set(proyecto.id, (mb.topProyectos.get(proyecto.id) ?? 0) + entry.horas)

      totalHours += entry.horas
      if (entry.es_extra) totalExtra += entry.horas
    }

    const proyectos = Array.from(proyectoMap.values())
      .map(p => ({
        ...p,
        secciones: Array.from(p.secciones.values())
          .map(s => ({
            ...s,
            fases: Array.from(s.fases.values()).sort((a, b) => b.hours - a.hours),
          }))
          .sort((a, b) => b.hours - a.hours),
      }))
      .sort((a, b) => b.hours - a.hours)

    const memberRows = Array.from(memberMap.entries())
      .map(([userId, agg]) => {
        const member = teamMembers.find(m => m.id === userId)
        const topProyecto = Array.from(agg.topProyectos.entries())
          .sort(([, a], [, b]) => b - a)[0]
        const topNombre = topProyecto ? proyectoMap.get(topProyecto[0])?.nombre ?? '' : ''
        return {
          userId,
          nombre:        member?.nombre ?? userId.slice(0, 8),
          initials:      member?.initials ?? '?',
          color:         member?.color ?? '#888',
          avatar_url:    member?.avatar_url ?? null,
          hours:         agg.hours,
          extra:         agg.extra,
          topProyecto:   topNombre,
          topHours:      topProyecto?.[1] ?? 0,
        }
      })
      .sort((a, b) => b.hours - a.hours)

    const maxProyectoHours = Math.max(...proyectos.map(p => p.hours), 1)
    const maxMemberHours = Math.max(...memberRows.map(m => m.hours), 1)

    return { proyectos, memberRows, totalHours, totalExtra, maxProyectoHours, maxMemberHours }
  }, [entries, lookup, teamMembers, userIdFilter])

  if (data.totalHours === 0) {
    return (
      <div style={{
        padding: '40px 24px',
        textAlign: 'center',
        background: '#FBFAF7',
        border: '1px dashed #E0DDD8',
        borderRadius: 4,
      }}>
        <p style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 300, marginBottom: 4 }}>
          Sin horas registradas en marketing
        </p>
        <p style={{ fontSize: 11, color: '#1A1A1A60', fontWeight: 300 }}>
          {periodLabel ? `Período: ${periodLabel}` : 'Aún no hay registros para este período.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Stat row */}
      <div style={{ display: 'flex', gap: 40, marginBottom: 32, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 44, fontWeight: 200, color: '#1A1A1A', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {data.totalHours}
          </div>
          <div style={{ fontSize: 10, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>
            horas marketing
          </div>
        </div>
        <div style={{ paddingBottom: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 300, color: '#555' }}>{data.proyectos.length}</div>
          <div style={{ fontSize: 10, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
            campañas
          </div>
        </div>
        {data.totalExtra > 0 && (
          <div style={{ paddingBottom: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 300, color: '#D85A30' }}>{data.totalExtra}</div>
            <div style={{ fontSize: 10, color: '#D85A3080', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
              h. extra
            </div>
          </div>
        )}
        {mode === 'team' && (
          <div style={{ paddingBottom: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 300, color: '#555' }}>{data.memberRows.length}</div>
            <div style={{ fontSize: 10, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
              personas
            </div>
          </div>
        )}
      </div>

      {/* Por campaña */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888', marginBottom: 14, fontWeight: 600 }}>
          Por campaña
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.proyectos.map(proy => {
            const widthPct = (proy.hours / data.maxProyectoHours) * 100
            return (
              <div key={proy.id}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>{proy.nombre}</span>
                  <span style={{ fontSize: 11, color: '#666' }}>
                    <strong style={{ fontWeight: 600 }}>{proy.hours}</strong>
                    <span style={{ color: '#AAA' }}>h</span>
                    {proy.extra > 0 && (
                      <span style={{ color: '#D85A30', marginLeft: 6 }}>+{proy.extra} extra</span>
                    )}
                  </span>
                </div>
                <div style={{
                  display: 'flex', height: 20, borderRadius: 3, overflow: 'hidden',
                  width: `${widthPct}%`, minWidth: 4, background: '#F1EFE8',
                }}>
                  {proy.secciones.map(sec => {
                    const segPct = (sec.hours / proy.hours) * 100
                    const c = channelColor(sec.nombre)
                    return (
                      <div
                        key={sec.id}
                        title={`${sec.nombre} — ${sec.hours}h${sec.extra > 0 ? ` (${sec.extra} extra)` : ''}`}
                        style={{
                          width: `${segPct}%`,
                          background: c.bg,
                          borderRight: '1px solid rgba(255,255,255,0.6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: c.tc, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap',
                        }}
                      >
                        {segPct >= 14 ? sec.nombre : ''}
                      </div>
                    )
                  })}
                </div>
                {/* Section breakdown labels (small) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {proy.secciones.map(sec => {
                    const c = channelColor(sec.nombre)
                    return (
                      <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: c.bg, border: `1px solid ${c.tc}33`, display: 'inline-block' }} />
                        <span style={{ fontSize: 10, color: '#666' }}>
                          {sec.nombre} <span style={{ color: '#AAA' }}>· {sec.hours}h</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Foco por persona — solo en team mode */}
      {mode === 'team' && data.memberRows.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888', marginBottom: 14, fontWeight: 600 }}>
            Foco por persona
          </p>
          <div style={{
            border: '1px solid #E8E6E0',
            borderRadius: 4,
            background: '#fff',
            overflow: 'hidden',
          }}>
            {data.memberRows.map((m, idx) => {
              const widthPct = (m.hours / data.maxMemberHours) * 100
              return (
                <div
                  key={m.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 16px',
                    borderTop: idx === 0 ? 'none' : '1px solid #F0EEE8',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: m.color,
                    color: '#fff', fontSize: 11, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                    {m.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.avatar_url} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : m.initials}
                  </div>
                  {/* Nombre + bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#222' }}>{m.nombre}</span>
                      <span style={{ fontSize: 10, color: '#999' }}>
                        {m.topProyecto && (
                          <>
                            top: <strong style={{ color: '#666', fontWeight: 500 }}>{m.topProyecto}</strong>
                            <span style={{ color: '#BBB', marginLeft: 4 }}>· {m.topHours}h</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#F1EFE8', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${widthPct}%`, height: '100%',
                        background: m.color, opacity: 0.7,
                      }} />
                    </div>
                  </div>
                  {/* Total */}
                  <div style={{ minWidth: 60, textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                      {m.hours}<span style={{ fontSize: 10, color: '#AAA', fontWeight: 400, marginLeft: 1 }}>h</span>
                    </div>
                    {m.extra > 0 && (
                      <div style={{ fontSize: 10, color: '#D85A30', fontWeight: 500 }}>+{m.extra} extra</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
