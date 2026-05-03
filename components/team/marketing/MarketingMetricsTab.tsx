'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MarketingMetricsView } from '@/components/team/marketing/MarketingMetricsView'
import type {
  ProyectoNegocio,
  SeccionNegocio,
  FaseNegocio,
  TeamMemberSimple,
} from '@/components/team/proyectos/PlantillaManager'

interface Props {
  currentUserId:    string
  currentUserRole:  'fp_partner' | 'fp_biz_dev'
  proyectosNegocio: ProyectoNegocio[]
  seccionesNegocio: SeccionNegocio[]
  fasesNegocio:     FaseNegocio[]
  teamMembers:      TeamMemberSimple[]
}

interface RawEntry {
  user_id:           string
  horas:             number
  es_extra:          boolean
  categoria_interna: string | null
}

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const todayStr = () => new Date().toISOString().slice(0, 10)

const getMondayOf = (d: string) => {
  const dt = new Date(d)
  const day = dt.getDay()
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day))
  return dt.toISOString().slice(0, 10)
}

const getWeekDates = (m: string) => {
  const dates: string[] = []
  const d = new Date(m)
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

const fmtWeek = (m: string) => {
  const d = new Date(m)
  const e = new Date(m)
  e.setDate(e.getDate() + 6)
  const mn = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${d.getDate()} ${mn[d.getMonth()]} — ${e.getDate()} ${mn[e.getMonth()]} ${e.getFullYear()}`
}

export function MarketingMetricsTab({
  currentUserId,
  currentUserRole,
  proyectosNegocio,
  seccionesNegocio,
  fasesNegocio,
  teamMembers,
}: Props) {
  const supabase = createClient()

  const [period, setPeriod]   = useState<'week' | 'month' | 'year'>('month')
  const [week, setWeek]       = useState(() => getMondayOf(todayStr()))
  const [month, setMonth]     = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [year, setYear]       = useState(() => new Date().getFullYear())
  const [scope, setScope]     = useState<'team' | 'personal'>(currentUserRole === 'fp_partner' ? 'team' : 'personal')
  const [entries, setEntries] = useState<RawEntry[]>([])
  const [loading, setLoading] = useState(false)

  const periodLabel = useMemo(() => {
    if (period === 'week') return fmtWeek(week)
    if (period === 'month') {
      const [yr, mo] = month.split('-').map(Number)
      return `${MONTH_NAMES[mo - 1]} ${yr}`
    }
    return String(year)
  }, [period, week, month, year])

  const isCurrentPeriod = useMemo(() => {
    if (period === 'week') return week === getMondayOf(todayStr())
    if (period === 'month') {
      const d = new Date()
      return month === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    return year === new Date().getFullYear()
  }, [period, week, month, year])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    let startDate: string, endDate: string
    if (period === 'week') {
      startDate = week
      endDate = getWeekDates(week)[6]
    } else if (period === 'month') {
      const [yr, mo] = month.split('-').map(Number)
      const lastDay = new Date(yr, mo, 0).getDate()
      startDate = `${month}-01`
      endDate = `${month}-${String(lastDay).padStart(2, '0')}`
    } else {
      startDate = `${year}-01-01`
      endDate = `${year}-12-31`
    }

    // For partner in team scope: query all marketing-eligible team members.
    // Otherwise restrict to currentUserId.
    const userIds = scope === 'team'
      ? teamMembers.map(m => m.id)
      : [currentUserId]

    if (userIds.length === 0) { setEntries([]); setLoading(false); return }

    const { data } = await supabase
      .from('time_entries')
      .select('user_id, horas, es_extra, categoria_interna')
      .in('user_id', userIds)
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .like('categoria_interna', 'iproj_%')

    setEntries((data as RawEntry[] | null) ?? [])
    setLoading(false)
  }, [supabase, period, week, month, year, scope, teamMembers, currentUserId])

  useEffect(() => { loadEntries() }, [loadEntries])

  const prevPeriod = () => {
    if (period === 'week') {
      const d = new Date(week); d.setDate(d.getDate() - 7); setWeek(d.toISOString().slice(0, 10))
    } else if (period === 'month') {
      const [yr, mo] = month.split('-').map(Number)
      const d = new Date(yr, mo - 2, 1)
      setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    } else setYear(y => y - 1)
  }
  const nextPeriod = () => {
    if (period === 'week') {
      const d = new Date(week); d.setDate(d.getDate() + 7); setWeek(d.toISOString().slice(0, 10))
    } else if (period === 'month') {
      const [yr, mo] = month.split('-').map(Number)
      const d = new Date(yr, mo, 1)
      setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    } else setYear(y => y + 1)
  }
  const goCurrentPeriod = () => {
    if (period === 'week') setWeek(getMondayOf(todayStr()))
    else if (period === 'month') {
      const d = new Date(); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    } else setYear(new Date().getFullYear())
  }

  const navBtnStyle: React.CSSProperties = {
    width: 32, height: 32, border: '1px solid #E0DDD8', background: '#fff',
    borderRadius: 4, cursor: 'pointer', fontSize: 16, color: '#666',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div style={{ maxWidth: 920 }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        {/* Period type */}
        <div style={{
          display: 'inline-flex', gap: 0,
          background: '#EDEBE5', padding: 3, borderRadius: 8,
        }}>
          {(['week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 16px', fontSize: 11, border: 'none', cursor: 'pointer',
                borderRadius: 6, transition: 'all 0.2s',
                background: period === p ? '#fff' : 'transparent',
                color: period === p ? '#1A1A1A' : '#999',
                fontWeight: period === p ? 600 : 400,
                boxShadow: period === p ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
            </button>
          ))}
        </div>

        {/* Period navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={prevPeriod} style={navBtnStyle}>‹</button>
          <span style={{
            fontSize: 13, fontWeight: 500, color: '#333',
            minWidth: period === 'week' ? 200 : 120, textAlign: 'center',
          }}>
            {periodLabel}
          </span>
          <button onClick={nextPeriod} style={navBtnStyle}>›</button>
          {!isCurrentPeriod && (
            <button onClick={goCurrentPeriod} style={{ ...navBtnStyle, fontSize: 11, width: 'auto', padding: '0 10px' }}>
              Hoy
            </button>
          )}
        </div>

        {/* Scope toggle (only for partner) */}
        {currentUserRole === 'fp_partner' && (
          <div style={{
            display: 'inline-flex', gap: 0, marginLeft: 'auto',
            background: '#EDEBE5', padding: 3, borderRadius: 8,
          }}>
            {(['team', 'personal'] as const).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                style={{
                  padding: '6px 14px', fontSize: 11, border: 'none', cursor: 'pointer',
                  borderRadius: 6, transition: 'all 0.2s',
                  background: scope === s ? '#fff' : 'transparent',
                  color: scope === s ? '#1A1A1A' : '#999',
                  fontWeight: scope === s ? 600 : 400,
                  boxShadow: scope === s ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {s === 'team' ? 'Equipo' : 'Yo'}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#999', fontSize: 12 }}>
          Cargando métricas…
        </div>
      ) : (
        <MarketingMetricsView
          entries={entries}
          proyectosNegocio={proyectosNegocio}
          seccionesNegocio={seccionesNegocio}
          fasesNegocio={fasesNegocio}
          teamMembers={teamMembers}
          mode={scope}
          userIdFilter={scope === 'personal' ? currentUserId : undefined}
          periodLabel={periodLabel}
        />
      )}
    </div>
  )
}
