'use client'

// ══════════════════════════════════════════════════════════════════════════════
// ObraPhasesTimeline — Lista cronológica de fases de obra
//
// Vista espejo del Gantt: ordena las fases por fecha de inicio efectiva
// (actual ?? planned) y muestra para cada una EPs, fechas, duración, % avance,
// y los hitos que la triggerean (requires) y la cierran (achieves).
//
// Garantía de sincronización: toda la lógica de derivación se importa de
// lib/fp-execution/obra-view.ts — el mismo módulo que consume ObraGantt. Si
// cambia el modelo (reglas de fallback, status, resolución de hitos), ambos
// componentes lo reflejan automáticamente sin tocar nada aquí.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react'
import type { ObraPhase, ObraMilestone } from '@/lib/fp-execution/obra'
import {
  STATUS_STYLE,
  resolvePhaseDates,
  sortPhasesChronological,
  getPhaseDelay,
  getTodayUTC,
  resolveTriggers,
  resolveAchievements,
  fmtDate,
  fmtDateShort,
  type ResolvedMilestone,
} from '@/lib/fp-execution/obra-view'

const MESES_LARGOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function ObraPhasesTimeline({
  phases,
  milestones,
  chapterNames,
  partnerNames,
  onPhaseClick,
}: {
  phases:        ObraPhase[]
  milestones:    ObraMilestone[]
  chapterNames:  Record<string, string>
  partnerNames:  Record<string, string>
  onPhaseClick?: (phaseId: string) => void
}) {
  const today  = useMemo(() => getTodayUTC(), [])
  const sorted = useMemo(() => sortPhasesChronological(phases), [phases])

  // Agrupar visualmente por mes (clave del start efectivo)
  type MonthGroup = { key: string; label: string; phases: ObraPhase[] }
  const groups: MonthGroup[] = useMemo(() => {
    const out: MonthGroup[] = []
    let lastKey: string | null = null
    for (const ph of sorted) {
      const d = resolvePhaseDates(ph).start
      const key = d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2,'0')}` : '__sin_fecha__'
      if (key !== lastKey) {
        const label = d
          ? `${MESES_LARGOS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
          : 'Sin fecha programada'
        out.push({ key, label, phases: [] })
        lastKey = key
      }
      out[out.length - 1].phases.push(ph)
    }
    return out
  }, [sorted])

  if (sorted.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px dashed #E8E6E0' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
          No hay fases en el cronograma de obra.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E8E6E0',
      borderRadius: 10,
      overflow: 'hidden',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid #F0EEE8',
        background: '#FAFAF8',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', letterSpacing: '0.01em' }}>
            Lista cronológica de fases
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            Espejo del cronograma · {sorted.length} {sorted.length === 1 ? 'fase' : 'fases'} ordenadas por fecha de inicio
          </div>
        </div>
        <Legend />
      </div>

      {groups.map((g, gIdx) => (
        <React.Fragment key={g.key}>
          <div style={{
            padding: '8px 20px',
            background: '#F8F7F4',
            borderTop: gIdx === 0 ? 'none' : '1px solid #E8E6E0',
            borderBottom: '1px solid #F0EEE8',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#888',
          }}>
            {g.label}
          </div>
          {g.phases.map(ph => (
            <PhaseRow
              key={ph.id}
              phase={ph}
              milestones={milestones}
              chapterNames={chapterNames}
              partnerNames={partnerNames}
              today={today}
              onClick={onPhaseClick ? () => onPhaseClick(ph.id) : undefined}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Una fila ────────────────────────────────────────────────────────────────
function PhaseRow({
  phase, milestones, chapterNames, partnerNames, today, onClick,
}: {
  phase:        ObraPhase
  milestones:   ObraMilestone[]
  chapterNames: Record<string, string>
  partnerNames: Record<string, string>
  today:        Date
  onClick?:     () => void
}) {
  const dates    = resolvePhaseDates(phase)
  const delay    = getPhaseDelay(phase, today)
  const styling  = STATUS_STYLE[phase.status]
  const triggers = resolveTriggers(phase, milestones)
  const closing  = resolveAchievements(phase, milestones)
  const chapter  = phase.chapter_id ? (chapterNames[phase.chapter_id] ?? '—') : '—'

  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 20px 14px 23px',
        borderTop: '1px solid #F8F7F4',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.12s',
        position: 'relative',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAF8' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
    >
      {/* Status accent strip */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: styling.fill,
      }} />

      {/* Línea 1: nombre, capítulo, status, retraso */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%',
            background: styling.fill, border: `1px solid ${styling.border}`,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 13, fontWeight: 600, color: '#1A1A1A',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {phase.nombre}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#888', background: '#F0EEE8',
            padding: '2px 7px', borderRadius: 3, flexShrink: 0,
          }}>
            {chapter}
          </span>
        </div>
        {delay && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: '#DC2626', background: '#FEF2F2',
            padding: '2px 7px', borderRadius: 3,
            border: '1px solid #FECACA',
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}>
            +{delay.days} {delay.days === 1 ? 'día' : 'días'} {delay.reason === 'unstarted' ? 'sin iniciar' : 'retraso'}
          </span>
        )}
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
          color: styling.border, flexShrink: 0,
        }}>
          {styling.label.toUpperCase()}
        </span>
      </div>

      {/* Línea 2: fechas + duración + avance + EPs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        marginTop: 8, marginLeft: 17,
      }}>
        <div style={{ fontSize: 12, color: '#555', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{dates.start ? fmtDate(dates.start) : '—'}</span>
          <span style={{ color: '#BBB' }}>→</span>
          <span>{dates.end ? fmtDate(dates.end) : '—'}</span>
          {(dates.start || dates.end) && (
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
              color: dates.isActual ? '#059669' : '#888',
              background: dates.isActual ? '#ECFDF5' : '#F0EEE8',
              padding: '1px 5px', borderRadius: 2, marginLeft: 2,
            }}>
              {dates.isActual ? 'REAL' : 'PLAN'}
            </span>
          )}
        </div>
        {dates.duration != null && (
          <div style={{ fontSize: 12, color: '#888', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(dates.duration)} días háb.
          </div>
        )}
        {phase.pct_avance > 0 && phase.status !== 'completada' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 130 }}>
            <div style={{
              flex: 1, height: 6, background: '#F0EEE8',
              borderRadius: 3, overflow: 'hidden', minWidth: 70,
            }}>
              <div style={{
                width: `${Math.min(100, phase.pct_avance)}%`, height: '100%',
                background: styling.fill, transition: 'width 0.2s',
              }} />
            </div>
            <span style={{
              fontSize: 11, color: '#555',
              fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 30, textAlign: 'right',
            }}>
              {Math.round(phase.pct_avance)}%
            </span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {phase.partner_ids.length > 0 ? (
            phase.partner_ids.map(pid => (
              <span key={pid} style={{
                fontSize: 10, fontWeight: 600,
                color: '#1A1A1A', background: '#fff',
                border: '1px solid #D85A30', borderRadius: 3,
                padding: '2px 8px',
                whiteSpace: 'nowrap',
              }}>
                {partnerNames[pid] ?? pid.slice(0, 8)}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 10, color: '#BBB', fontStyle: 'italic' }}>
              sin EP asignado
            </span>
          )}
        </div>
      </div>

      {/* Línea 3: hitos trigger + cierre */}
      {(triggers.length > 0 || closing.length > 0) && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          marginTop: 10, marginLeft: 17,
        }}>
          {triggers.length > 0 && (
            <MilestoneLine label="Trigger" items={triggers} />
          )}
          {closing.length > 0 && (
            <MilestoneLine label="Cierra" items={closing} />
          )}
        </div>
      )}
    </div>
  )
}

function MilestoneLine({ label, items }: { label: string; items: ResolvedMilestone[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#666', flexWrap: 'wrap' }}>
      <span style={{
        fontWeight: 700, color: '#888', minWidth: 56,
        letterSpacing: '0.02em', fontSize: 10, textTransform: 'uppercase',
      }}>
        {label}
      </span>
      {items.map((m, idx) => (
        <span key={m.id} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          ...(idx > 0 ? { borderLeft: '1px solid #E8E6E0', paddingLeft: 8 } : {}),
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 14, height: 14, borderRadius: '50%',
            background: m.achieved ? '#059669' : 'transparent',
            border: m.achieved ? 'none' : '1.5px solid #C9C5BD',
            color: '#fff', fontSize: 9, fontWeight: 700,
            flexShrink: 0,
          }}>
            {m.achieved ? '✓' : ''}
          </span>
          <span style={{
            color: m.achieved ? '#1A1A1A' : '#555',
            fontWeight: m.achieved ? 600 : 500,
          }}>
            {m.nombre}
          </span>
          {m.date && (
            <span style={{
              color: m.achieved ? '#059669' : '#999',
              fontSize: 10, fontVariantNumeric: 'tabular-nums',
            }}>
              {m.achieved ? '' : '~'}{fmtDateShort(m.date)}
            </span>
          )}
          {m.es_hito_pago && (
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
              color: '#D85A30', background: '#FFF7F0',
              padding: '1px 4px', borderRadius: 2,
              border: '1px solid #FED7AA',
            }}>
              PAGO
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 10, color: '#888', flexWrap: 'wrap' }}>
      {(['pendiente','en_curso','completada','bloqueada'] as const).map(s => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: STATUS_STYLE[s].fill,
            border: `1px solid ${STATUS_STYLE[s].border}`,
          }} />
          {STATUS_STYLE[s].label}
        </span>
      ))}
    </div>
  )
}
