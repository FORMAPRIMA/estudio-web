'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TimeTrackerTranslator from './TimeTrackerTranslator'

// ── Types ──────────────────────────────────────────────────────────────────

interface TimeTrackerProps {
  currentUserId: string
  currentUserRole: 'fp_team' | 'fp_manager' | 'fp_partner'
}

interface TeamMember {
  id: string
  nombre: string
  email: string
  rol: string
  active: boolean
  initials: string
  color: string
  avatar_url: string | null
}

interface Proyecto {
  id: string
  nombre: string
  codigo: string
  status: string  // 'activo' | 'on_hold'
}

interface Fase {
  id: string          // proyecto_fases.id — stored in time_entries.fase_id
  proyecto_id: string
  label: string       // catalogo_fases.label
  numero: number      // catalogo_fases.numero
  seccion: string     // catalogo_fases.seccion
}

interface TimeEntry {
  id: string
  user_id: string
  fecha: string
  hora_inicio: number
  horas: number
  proyecto_id?: string | null
  fase_id?: string | null
  categoria_interna?: string | null
  es_extra: boolean
  notas?: string | null
}

// Grid: [user_id][fecha][hora_inicio] = fase_id | 'int_CAT' | ''
type Grid = Record<string, Record<string, Record<number, string>>>

// ── Constants ──────────────────────────────────────────────────────────────

const INTERNAL_CATS = [
  'GESTION_FORMA_PRIMA',
  'LEADS_OFERTAS',
  'REUNION_CLIENTE_POTENCIAL',
  'VISITA_PROVEEDOR',
  'VACACIONES',
  'BAJA_MEDICA',
  'FORMACION',
  'AUSENTE',
]

const INTERNAL_CATS_LABELS: Record<string, string> = {
  GESTION_FORMA_PRIMA: 'Gestión FP',
  LEADS_OFERTAS: 'Leads / Ofertas',
  REUNION_CLIENTE_POTENCIAL: 'Reunión Cliente',
  VISITA_PROVEEDOR: 'Visita Proveedor',
  VACACIONES: 'Vacaciones',
  BAJA_MEDICA: 'Baja Médica',
  FORMACION: 'Formación',
  AUSENTE: 'Ausente',
}

// Catalog section order for legend
const CATALOG_SECTIONS = ['Anteproyecto', 'Proyecto de ejecución', 'Obra', 'Interiorismo', 'Post venta']

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6)
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const ROLE_COLORS: Record<string, string> = {
  fp_team: '#1D9E75',
  fp_manager: '#378ADD',
  fp_partner: '#D85A30',
}
const ROLE_LABELS: Record<string, string> = {
  fp_team: 'FP Team',
  fp_manager: 'FP Manager',
  fp_partner: 'FP Partner',
}

const AVATAR_PALETTE = [
  '#D85A30','#E8913A','#C9A227','#E6B820','#B8860B',
  '#D4622A','#F0A500','#C07020','#E57C2F','#A0720A',
]

// ── Helpers ────────────────────────────────────────────────────────────────

const mkInitials = (n: string) =>
  n.trim().split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')

const isExtraSlot = (h: number) => h < 9 || h === 14 || h >= 19

const sectionColor = (sec: string): { bg: string; tc: string } => {
  if (sec === 'Anteproyecto')             return { bg: '#EAF3DE', tc: '#27500A' }
  if (sec === 'Proyecto de ejecución')    return { bg: '#FBEAF0', tc: '#4B1528' }
  if (sec === 'Obra')                     return { bg: '#E1F5EE', tc: '#085041' }
  if (sec === 'Interiorismo')             return { bg: '#E6F1FB', tc: '#042C53' }
  if (sec === 'Post venta')               return { bg: '#FAEEDA', tc: '#633806' }
  return { bg: '#F1EFE8', tc: '#444441' }
}

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

const todayStr = () => new Date().toISOString().slice(0, 10)

// ── Main Component ─────────────────────────────────────────────────────────

export default function TimeTracker({ currentUserId, currentUserRole }: TimeTrackerProps) {
  const supabase = createClient()

  // ── State ──
  const [view, setView] = useState<'weekly' | 'dashboard' | 'team' | 'translator'>('weekly')
  const [currentMonday, setCurrentMonday] = useState(() => getMondayOf(todayStr()))
  const [viewingUserId, setViewingUserId] = useState(currentUserId)

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [fases, setFases] = useState<Fase[]>([])
  const [grid, setGrid] = useState<Grid>({})
  const [allEntries, setAllEntries] = useState<TimeEntry[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [failedCells, setFailedCells] = useState<Set<string>>(new Set())
  const [sessionDeletions, setSessionDeletions] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<{ uid: string; fecha: string; h: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  // Dropdown state
  const [openCell, setOpenCell] = useState<{ uid: string; fecha: string; h: number; top: number; left: number } | null>(null)
  const [dropSearch, setDropSearch] = useState('')
  const [clipboard, setClipboard] = useState<string | null>(null)

  // Notes modal
  const [notesModal, setNotesModal] = useState<{ uid: string; fecha: string; h: number } | null>(null)
  const [notesText, setNotesText] = useState('')

  // Analysis
  const [analysisPeriod, setAnalysisPeriod] = useState<'week' | 'month' | 'year'>('week')
  const [analysisEntries, setAnalysisEntries] = useState<TimeEntry[]>([])
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisWeek, setAnalysisWeek] = useState(() => getMondayOf(todayStr()))
  const [analysisMonth, setAnalysisMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [analysisYear, setAnalysisYear] = useState(() => new Date().getFullYear())

  // Team Analysis
  const [teamAnalysisPeriod, setTeamAnalysisPeriod] = useState<'week' | 'month' | 'year'>('week')
  const [teamAnalysisEntries, setTeamAnalysisEntries] = useState<TimeEntry[]>([])
  const [teamAnalysisLoading, setTeamAnalysisLoading] = useState(false)
  const [teamAnalysisWeek, setTeamAnalysisWeek] = useState(() => getMondayOf(todayStr()))
  const [teamAnalysisMonth, setTeamAnalysisMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [teamAnalysisYear, setTeamAnalysisYear] = useState(() => new Date().getFullYear())
  const [teamAnalysisGroupBy, setTeamAnalysisGroupBy] = useState<'person' | 'phase'>('phase')

  // ── Data loading ──

  const loadStaticData = useCallback(async () => {
    // Load team members
    const { data: membersData } = await supabase
      .from('profiles')
      .select('id, nombre, email, rol, avatar_url')
      .in('rol', ['fp_team', 'fp_manager', 'fp_partner'])
      .order('nombre')

    if (membersData) {
      const members: TeamMember[] = membersData.map((m, i) => ({
        id: m.id,
        nombre: m.nombre,
        email: m.email,
        rol: m.rol,
        active: true,
        initials: mkInitials(m.nombre),
        color: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
        avatar_url: m.avatar_url ?? null,
      }))
      setTeamMembers(members)
    }

    // Load active projects (activo + on_hold)
    const { data: proyData } = await supabase
      .from('proyectos')
      .select('id, nombre, codigo, status')
      .in('status', ['activo', 'on_hold'])
      .order('nombre')

    if (proyData) {
      setProyectos(proyData as Proyecto[])

      const proyIds = proyData.map((p: { id: string }) => p.id)
      if (proyIds.length > 0) {
        // Load proyecto_fases
        const { data: pfData } = await supabase
          .from('proyecto_fases')
          .select('id, proyecto_id, fase_id')
          .in('proyecto_id', proyIds)

        if (pfData && pfData.length > 0) {
          const catalogIds = Array.from(new Set(pfData.map((pf: { fase_id: string }) => pf.fase_id)))

          const { data: catalogData } = await supabase
            .from('catalogo_fases')
            .select('id, label, numero, seccion')
            .in('id', catalogIds)

          const catalogMap: Record<string, { label: string; numero: number; seccion: string }> = {}
          for (const cf of catalogData ?? []) {
            catalogMap[cf.id] = { label: cf.label, numero: cf.numero, seccion: cf.seccion }
          }

          const newFases: Fase[] = pfData.map((pf: { id: string; proyecto_id: string; fase_id: string }) => {
            const cf = catalogMap[pf.fase_id]
            return {
              id: pf.id,
              proyecto_id: pf.proyecto_id,
              label: cf?.label ?? 'Fase',
              numero: cf?.numero ?? 0,
              seccion: cf?.seccion ?? '',
            }
          })
          setFases(newFases)
        }
      }
    }
  }, [supabase])

  const loadWeek = useCallback(async (monday: string) => {
    const weekDates = getWeekDates(monday)
    const sunday = weekDates[6]

    const userIds =
      currentUserRole === 'fp_team'
        ? [currentUserId]
        : teamMembers.map((m) => m.id)

    if (userIds.length === 0) return

    const { data: entries } = await supabase
      .from('time_entries')
      .select('*')
      .in('user_id', userIds)
      .gte('fecha', monday)
      .lte('fecha', sunday)

    if (entries) {
      setAllEntries((prev) => {
        const filtered = prev.filter(
          (e) => !(e.fecha >= monday && e.fecha <= sunday && userIds.includes(e.user_id))
        )
        return [...filtered, ...(entries as TimeEntry[])]
      })

      setGrid((prev) => {
        const next = { ...prev }
        userIds.forEach((uid) => {
          if (!next[uid]) next[uid] = {}
          weekDates.forEach((d) => { next[uid][d] = {} })
        })
        ;(entries as TimeEntry[]).forEach((e) => {
          if (!next[e.user_id]) next[e.user_id] = {}
          if (!next[e.user_id][e.fecha]) next[e.user_id][e.fecha] = {}
          const val = e.fase_id
            ? e.fase_id
            : e.categoria_interna
            ? `int_${e.categoria_interna}`
            : ''
          next[e.user_id][e.fecha][e.hora_inicio] = val
        })
        return next
      })
    }
  }, [supabase, currentUserId, currentUserRole, teamMembers])

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadStaticData()
      setLoading(false)
    }
    init()
  }, [loadStaticData])

  // Load week when members are ready or week changes
  useEffect(() => {
    if (!loading) loadWeek(currentMonday)
  }, [currentMonday, loading, loadWeek])

  // Load analysis data when tab opens or period changes
  const loadAnalysisData = useCallback(async (
    period: 'week' | 'month' | 'year',
    week: string, month: string, year: number
  ) => {
    setAnalysisLoading(true)
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

    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', currentUserId)
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .order('fecha')

    setAnalysisEntries((data as TimeEntry[]) ?? [])
    setAnalysisLoading(false)
  }, [supabase, currentUserId])

  useEffect(() => {
    if (view === 'dashboard') loadAnalysisData(analysisPeriod, analysisWeek, analysisMonth, analysisYear)
  }, [view, analysisPeriod, analysisWeek, analysisMonth, analysisYear, loadAnalysisData])

  const loadTeamAnalysisData = useCallback(async (
    period: 'week' | 'month' | 'year',
    week: string, month: string, year: number
  ) => {
    setTeamAnalysisLoading(true)
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

    const allIds = teamMembers.map((m) => m.id)
    if (allIds.length === 0) { setTeamAnalysisLoading(false); return }

    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .in('user_id', allIds)
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .order('fecha')

    setTeamAnalysisEntries((data as TimeEntry[]) ?? [])
    setTeamAnalysisLoading(false)
  }, [supabase, teamMembers])

  useEffect(() => {
    if (view === 'team') loadTeamAnalysisData(teamAnalysisPeriod, teamAnalysisWeek, teamAnalysisMonth, teamAnalysisYear)
  }, [view, teamAnalysisPeriod, teamAnalysisWeek, teamAnalysisMonth, teamAnalysisYear, loadTeamAnalysisData])

  // Escape closes dropdown and clears clipboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenCell(null)
        setClipboard(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Close dropdown on page scroll (but not when scrolling inside the panel)
  useEffect(() => {
    if (!openCell) return
    const handler = (e: Event) => {
      const panel = document.getElementById('tt-dropdown-panel')
      if (panel && panel.contains(e.target as Node)) return
      setOpenCell(null)
    }
    window.addEventListener('scroll', handler, true)
    return () => window.removeEventListener('scroll', handler, true)
  }, [openCell])

  // ── Cell operations ──

  const getCell = (uid: string, fecha: string, h: number): string =>
    grid[uid]?.[fecha]?.[h] ?? ''

  const cellKey = (uid: string, fecha: string, h: number) => `${uid}|${fecha}|${h}`

  const commitDelete = useCallback(async (uid: string, fecha: string, h: number) => {
    const prev = getCell(uid, fecha, h)
    const key = cellKey(uid, fecha, h)

    setGrid((g) => {
      const next = { ...g }
      if (!next[uid]) next[uid] = {}
      if (!next[uid][fecha]) next[uid][fecha] = {}
      next[uid][fecha][h] = ''
      return next
    })
    setFailedCells((s) => { const n = new Set(s); n.delete(key); return n })
    setSaving(true)

    const { error: err } = await supabase
      .from('time_entries')
      .delete()
      .eq('user_id', uid)
      .eq('fecha', fecha)
      .eq('hora_inicio', h)

    setSaving(false)
    if (err) {
      setGrid((g) => {
        const next = { ...g }
        if (!next[uid]) next[uid] = {}
        if (!next[uid][fecha]) next[uid][fecha] = {}
        next[uid][fecha][h] = prev
        return next
      })
      setFailedCells((s) => new Set(s).add(key))
    } else {
      setSessionDeletions((n) => n + 1)
    }
  }, [supabase])

  const setCell = useCallback(async (uid: string, fecha: string, h: number, value: string) => {
    if (value === '' && getCell(uid, fecha, h) !== '') {
      if (sessionDeletions >= 10) {
        setPendingDelete({ uid, fecha, h })
        return
      }
      await commitDelete(uid, fecha, h)
      return
    }

    const key = cellKey(uid, fecha, h)

    setGrid((prev) => {
      const next = { ...prev }
      if (!next[uid]) next[uid] = {}
      if (!next[uid][fecha]) next[uid][fecha] = {}
      next[uid][fecha][h] = value
      return next
    })
    setFailedCells((s) => { const n = new Set(s); n.delete(key); return n })
    setSaving(true)

    let fase_id: string | null = null
    let categoria_interna: string | null = null
    let proyecto_id: string | null = null

    if (value.startsWith('int_')) {
      categoria_interna = value.slice(4)
    } else {
      fase_id = value
      const fase = fases.find((f) => f.id === value)
      if (fase) proyecto_id = fase.proyecto_id
    }

    const { error: err } = await supabase.from('time_entries').upsert({
      user_id: uid,
      fecha,
      hora_inicio: h,
      horas: 1,
      fase_id,
      categoria_interna,
      proyecto_id,
      es_extra: isExtraSlot(h),
    }, { onConflict: 'user_id,fecha,hora_inicio' })

    setSaving(false)
    if (err) {
      setGrid((prev) => {
        const next = { ...prev }
        if (!next[uid]) next[uid] = {}
        if (!next[uid][fecha]) next[uid][fecha] = {}
        next[uid][fecha][h] = ''
        return next
      })
      setFailedCells((s) => new Set(s).add(key))
    }
  }, [supabase, fases, sessionDeletions, commitDelete])

  // ── Week navigation ──

  const prevWeek = () => {
    const d = new Date(currentMonday)
    d.setDate(d.getDate() - 7)
    setCurrentMonday(d.toISOString().slice(0, 10))
  }
  const nextWeek = () => {
    const d = new Date(currentMonday)
    d.setDate(d.getDate() + 7)
    setCurrentMonday(d.toISOString().slice(0, 10))
  }
  const goToday = () => setCurrentMonday(getMondayOf(todayStr()))

  // ── Derived data ──

  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday])
  const canEdit = viewingUserId === currentUserId
  const currentMember = useMemo(
    () => teamMembers.find((m) => m.id === viewingUserId),
    [teamMembers, viewingUserId]
  )

  const visibleMembers = useMemo(() => {
    if (currentUserRole === 'fp_team') return teamMembers.filter((m) => m.id === currentUserId)
    const me = teamMembers.find((m) => m.id === currentUserId)
    const others = teamMembers.filter((m) => m.id !== currentUserId)
    return me ? [me, ...others] : teamMembers
  }, [currentUserRole, teamMembers, currentUserId])

  const weekHours = (uid: string) =>
    allEntries
      .filter((e) => e.user_id === uid && weekDates.includes(e.fecha) && !e.es_extra)
      .reduce((sum, e) => sum + e.horas, 0)

  const extraHours = (uid: string) =>
    allEntries
      .filter((e) => e.user_id === uid && weekDates.includes(e.fecha) && e.es_extra)
      .reduce((sum, e) => sum + e.horas, 0)

  // ── Export / Import ────────────────────────────────────────────────────────

  const exportCSV = async () => {
    const year = new Date().getFullYear()
    const { data: entries } = await supabase
      .from('time_entries')
      .select('*')
      .in('user_id', teamMembers.map((m) => m.id))
      .gte('fecha', `${year}-01-01`)
      .lte('fecha', `${year}-12-31`)
      .order('fecha').order('hora_inicio')

    if (!entries || entries.length === 0) return

    const memberMap = Object.fromEntries(teamMembers.map((m) => [m.id, m.nombre]))
    const proyectoMap = Object.fromEntries(proyectos.map((p) => [p.id, p.nombre]))
    const faseMap = Object.fromEntries(fases.map((f) => [f.id, f.label]))

    const header = 'user_id,user_nombre,fecha,hora_inicio,horas,proyecto_id,proyecto_nombre,fase_id,fase_label,categoria_interna,es_extra,notas'
    const rows = entries.map((e: TimeEntry) => [
      e.user_id,
      memberMap[e.user_id] ?? '',
      e.fecha,
      e.hora_inicio,
      e.horas,
      e.proyecto_id ?? '',
      e.proyecto_id ? (proyectoMap[e.proyecto_id] ?? '') : '',
      e.fase_id ?? '',
      e.fase_id ? (faseMap[e.fase_id] ?? '') : '',
      e.categoria_interna ?? '',
      e.es_extra ? '1' : '0',
      (e.notas ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
    ].join(','))

    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forma-prima-timetracker-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importCSV = async (file: File) => {
    setImporting(true)
    setImportError(null)
    const text = await file.text()
    const lines = text.trim().split('\n')
    if (lines.length < 2) { setImportError('Archivo vacío o inválido.'); setImporting(false); return }

    const header = lines[0].split(',')
    const idx = (col: string) => header.indexOf(col)
    const iUserId = idx('user_id'), iFecha = idx('fecha'), iHora = idx('hora_inicio')
    const iHoras = idx('horas'), iFaseId = idx('fase_id'), iCat = idx('categoria_interna')
    const iProyId = idx('proyecto_id'), iExtra = idx('es_extra'), iNotas = idx('notas')

    if ([iUserId, iFecha, iHora].some((i) => i === -1)) {
      setImportError('El CSV no tiene las columnas requeridas (user_id, fecha, hora_inicio).')
      setImporting(false); return
    }

    const toUpsert = lines.slice(1).map((line) => {
      const cols = line.split(',')
      return {
        user_id: cols[iUserId]?.trim(),
        fecha: cols[iFecha]?.trim(),
        hora_inicio: parseInt(cols[iHora] ?? '0'),
        horas: parseFloat(cols[iHoras] ?? '1') || 1,
        fase_id: cols[iFaseId]?.trim() || null,
        categoria_interna: cols[iCat]?.trim() || null,
        proyecto_id: cols[iProyId]?.trim() || null,
        es_extra: cols[iExtra]?.trim() === '1',
        notas: iNotas >= 0 ? (cols[iNotas]?.trim() || null) : null,
      }
    }).filter((r) => r.user_id && r.fecha && !isNaN(r.hora_inicio))

    if (toUpsert.length === 0) { setImportError('No se encontraron filas válidas.'); setImporting(false); return }

    const BATCH = 200
    let lastError: string | null = null
    for (let i = 0; i < toUpsert.length; i += BATCH) {
      const { error: err } = await supabase
        .from('time_entries')
        .upsert(toUpsert.slice(i, i + BATCH), { onConflict: 'user_id,fecha,hora_inicio' })
      if (err) { lastError = err.message; break }
    }

    if (lastError) {
      setImportError(`Error al importar: ${lastError}`)
    } else {
      await loadWeek(currentMonday)
      setImportError(`✓ ${toUpsert.length} registros restaurados correctamente.`)
    }
    setImporting(false)
  }

  // ── Phase lookup helpers ──

  const phasesByProject = useMemo(() => {
    const map: Record<string, { proyecto: Proyecto; fases: Fase[] }> = {}
    proyectos.forEach((p) => { map[p.id] = { proyecto: p, fases: [] } })
    fases.forEach((f) => { if (map[f.proyecto_id]) map[f.proyecto_id].fases.push(f) })
    Object.values(map).forEach((entry) => entry.fases.sort((a, b) => a.numero - b.numero))
    return map
  }, [proyectos, fases])

  // Shorten a fase label: strip "FASE N – " prefix, apply known abbreviations, truncate
  const abreviarFase = (label: string): string => {
    const clean = label.replace(/^FASE\s*\d+\s*[–\-]\s*/i, '').trim()
    const abbrevs: Record<string, string> = {
      'Gestión Previa': 'Gestión prev.',
      'Firma de Contrato': 'Contrato',
      'Levantamiento': 'Levantam.',
      'Plano Tasación': 'Tasación',
      'Estado Actual / Distribución': 'Distribución',
      'Planos Propuesta': 'Propuesta',
      'Diseño 3D (Renders)': '3D / Renders',
      'Documentación Escrita': 'Doc. Escrita',
      'Ejecutivo': 'Ejecutivo',
      'Renders Ejecutivo': 'Renders Ej.',
      'Documentación Económica': 'Doc. Económ.',
      'Dirección de Obra': 'Dir. Obra',
      'Control de Entrega': 'Entrega',
      'Interiorismo': 'Interiorismo',
      'Post Venta': 'Post Venta',
    }
    if (abbrevs[clean]) return abbrevs[clean]
    return clean.length > 13 ? clean.slice(0, 12) + '…' : clean
  }

  const cellDisplay = (value: string) => {
    if (!value) return { bg: 'transparent', label: '', tc: '#444', line1: '', line2: '' }
    if (value.startsWith('int_')) {
      const cat = value.slice(4)
      const intLabel = INTERNAL_CATS_LABELS[cat] ?? cat.replace(/_/g, ' ')
      return { bg: '#F1EFE8', label: intLabel, tc: '#666', line1: '', line2: '' }
    }
    const fase = fases.find((f) => f.id === value)
    if (fase) {
      const { bg, tc } = sectionColor(fase.seccion)
      const proy = proyectos.find((p) => p.id === fase.proyecto_id)
      const line1 = proy ? (proy.nombre.length > 11 ? proy.nombre.slice(0, 10) + '…' : proy.nombre) : ''
      const line2 = abreviarFase(fase.label)
      return { bg, label: '', tc, line1, line2 }
    }
    return { bg: '#EEE', label: '?', tc: '#888', line1: '', line2: '' }
  }

  // ── Dropdown filtered options ──

  const dropdownOptions = useMemo(() => {
    const q = dropSearch.toLowerCase()
    const filteredIntCats = INTERNAL_CATS.filter(
      (cat) => !q || cat.toLowerCase().includes(q) || 'interno'.includes(q)
    )
    const filteredProjects = proyectos.filter((p) => {
      if (!q) return true
      return p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
    }).map((p) => ({
      proyecto: p,
      fases: phasesByProject[p.id]?.fases ?? [],
    })).filter((pg) => pg.fases.length > 0)

    return { filteredIntCats, filteredProjects }
  }, [dropSearch, proyectos, phasesByProject])

  // ── Notes ──

  const openNotes = async (uid: string, fecha: string, h: number) => {
    const { data } = await supabase
      .from('time_entries')
      .select('notas')
      .eq('user_id', uid)
      .eq('fecha', fecha)
      .eq('hora_inicio', h)
      .maybeSingle()
    setNotesText(data?.notas ?? '')
    setNotesModal({ uid, fecha, h })
  }

  const saveNotes = async () => {
    if (!notesModal) return
    await supabase
      .from('time_entries')
      .update({ notas: notesText })
      .eq('user_id', notesModal.uid)
      .eq('fecha', notesModal.fecha)
      .eq('hora_inicio', notesModal.h)
    setNotesModal(null)
    setNotesText('')
  }

  // ── Analysis chart data ──

  const analysisChartData = useMemo(() => {
    const projectMap: Record<string, {
      nombre: string; codigo: string
      sections: Record<string, number>
      extraBySec: Record<string, number>
      extra: number
    }> = {}
    const internalSections: Record<string, number> = {}
    const internalExtraSections: Record<string, number> = {}
    let internalExtra = 0

    analysisEntries.forEach((e) => {
      if (e.fase_id) {
        const fase = fases.find((f) => f.id === e.fase_id)
        if (!fase) return
        const proy = proyectos.find((p) => p.id === fase.proyecto_id)
        if (!proy) return
        if (!projectMap[proy.id]) projectMap[proy.id] = { nombre: proy.nombre, codigo: proy.codigo, sections: {}, extraBySec: {}, extra: 0 }
        const sec = fase.seccion || 'Otro'
        projectMap[proy.id].sections[sec] = (projectMap[proy.id].sections[sec] ?? 0) + e.horas
        if (e.es_extra) {
          projectMap[proy.id].extraBySec[sec] = (projectMap[proy.id].extraBySec[sec] ?? 0) + e.horas
          projectMap[proy.id].extra += e.horas
        }
      } else if (e.categoria_interna) {
        const label = INTERNAL_CATS_LABELS[e.categoria_interna] ?? e.categoria_interna.replace(/_/g, ' ')
        internalSections[label] = (internalSections[label] ?? 0) + e.horas
        if (e.es_extra) {
          internalExtraSections[label] = (internalExtraSections[label] ?? 0) + e.horas
          internalExtra += e.horas
        }
      }
    })

    const rows: Array<{
      id: string; nombre: string; codigo: string; total: number; extra: number
      segments: Array<{ seccion: string; hours: number; extra: number; bg: string; tc: string }>
    }> = Object.entries(projectMap).map(([id, data]) => {
      const total = Object.values(data.sections).reduce((a, b) => a + b, 0)
      const segments = CATALOG_SECTIONS
        .filter((s) => data.sections[s])
        .map((s) => ({ seccion: s, hours: data.sections[s], extra: data.extraBySec[s] ?? 0, ...sectionColor(s) }))
      Object.entries(data.sections).forEach(([s, h]) => {
        if (!CATALOG_SECTIONS.includes(s)) segments.push({ seccion: s, hours: h, extra: data.extraBySec[s] ?? 0, ...sectionColor(s) })
      })
      return { id, nombre: data.nombre, codigo: data.codigo, total, extra: data.extra, segments }
    })

    const internalTotal = Object.values(internalSections).reduce((a, b) => a + b, 0)
    if (internalTotal > 0) {
      rows.push({
        id: '__interno__', nombre: 'Interno', codigo: '', total: internalTotal, extra: internalExtra,
        segments: Object.entries(internalSections).map(([label, hours]) => ({
          seccion: label, hours, extra: internalExtraSections[label] ?? 0, bg: '#F1EFE8', tc: '#666',
        })),
      })
    }

    rows.sort((a, b) => b.total - a.total)
    const maxTotal = Math.max(...rows.map((r) => r.total), 1)
    const grandTotal = rows.reduce((a, r) => a + r.total, 0)
    const grandExtra = rows.reduce((a, r) => a + r.extra, 0)
    return { rows, maxTotal, grandTotal, grandExtra }
  }, [analysisEntries, fases, proyectos])

  // ── Team analysis chart data ──

  const teamAnalysisChartData = useMemo(() => {
    const projectMemberMap: Record<string, Record<string, {
      sections: Record<string, number>
      extraBySec: Record<string, number>
      extra: number
    }>> = {}
    const projectNames: Record<string, { nombre: string; codigo: string }> = {}

    teamAnalysisEntries.forEach((e) => {
      let projectId: string
      let seccion: string

      if (e.fase_id) {
        const fase = fases.find((f) => f.id === e.fase_id)
        if (!fase) return
        const proy = proyectos.find((p) => p.id === fase.proyecto_id)
        if (!proy) return
        projectId = proy.id
        seccion = fase.seccion || 'Otro'
        if (!projectNames[projectId]) projectNames[projectId] = { nombre: proy.nombre, codigo: proy.codigo }
      } else if (e.categoria_interna) {
        projectId = '__interno__'
        seccion = INTERNAL_CATS_LABELS[e.categoria_interna] ?? e.categoria_interna.replace(/_/g, ' ')
        if (!projectNames[projectId]) projectNames[projectId] = { nombre: 'Interno', codigo: '' }
      } else {
        return
      }

      if (!projectMemberMap[projectId]) projectMemberMap[projectId] = {}
      if (!projectMemberMap[projectId][e.user_id]) {
        projectMemberMap[projectId][e.user_id] = { sections: {}, extraBySec: {}, extra: 0 }
      }
      const pm = projectMemberMap[projectId][e.user_id]
      pm.sections[seccion] = (pm.sections[seccion] ?? 0) + e.horas
      if (e.es_extra) {
        pm.extraBySec[seccion] = (pm.extraBySec[seccion] ?? 0) + e.horas
        pm.extra += e.horas
      }
    })

    const memberMap = Object.fromEntries(teamMembers.map((m) => [m.id, m]))

    const projects = Object.entries(projectMemberMap).map(([projId, memberData]) => {
      const members = Object.entries(memberData).map(([memberId, data]) => {
        const total = Object.values(data.sections).reduce((a, b) => a + b, 0)
        const member = memberMap[memberId]
        const segments = CATALOG_SECTIONS
          .filter((s) => data.sections[s])
          .map((s) => ({ seccion: s, hours: data.sections[s], extra: data.extraBySec[s] ?? 0, ...sectionColor(s) }))
        Object.entries(data.sections).forEach(([s, h]) => {
          if (!CATALOG_SECTIONS.includes(s)) {
            segments.push({ seccion: s, hours: h, extra: data.extraBySec[s] ?? 0, ...sectionColor(s) })
          }
        })
        return {
          memberId,
          memberName: member?.nombre ?? memberId,
          memberColor: member?.color ?? '#888',
          memberInitials: member?.initials ?? '?',
          memberAvatarUrl: member?.avatar_url ?? null,
          total,
          extra: data.extra,
          segments,
        }
      }).sort((a, b) => b.total - a.total)

      const totalHours = members.reduce((a, m) => a + m.total, 0)
      const info = projectNames[projId]
      return { id: projId, nombre: info?.nombre ?? projId, codigo: info?.codigo ?? '', totalHours, members }
    }).sort((a, b) => b.totalHours - a.totalHours)

    const globalMax = Math.max(...projects.flatMap((p) => p.members.map((m) => m.total)), 1)
    const grandTotal = projects.reduce((a, p) => a + p.totalHours, 0)
    const grandExtra = projects.reduce((a, p) => a + p.members.reduce((b, m) => b + m.extra, 0), 0)

    return { projects, globalMax, grandTotal, grandExtra }
  }, [teamAnalysisEntries, fases, proyectos, teamMembers])

  // ── Team analysis: grouped by phase ──

  const teamAnalysisPhaseData = useMemo(() => {
    // projectId → phaseId → memberId → { hours, extra }
    const map: Record<string, Record<string, Record<string, { hours: number; extra: number }>>> = {}
    const projectNames: Record<string, { nombre: string; codigo: string }> = {}
    const phaseInfo: Record<string, { label: string; numero: number; seccion: string }> = {}

    teamAnalysisEntries.forEach((e) => {
      if (!e.fase_id) return
      const fase = fases.find((f) => f.id === e.fase_id)
      if (!fase) return
      const proy = proyectos.find((p) => p.id === fase.proyecto_id)
      if (!proy) return

      const projId = proy.id
      const phaseId = e.fase_id
      if (!projectNames[projId]) projectNames[projId] = { nombre: proy.nombre, codigo: proy.codigo }
      if (!phaseInfo[phaseId]) phaseInfo[phaseId] = { label: fase.label, numero: fase.numero, seccion: fase.seccion }
      if (!map[projId]) map[projId] = {}
      if (!map[projId][phaseId]) map[projId][phaseId] = {}
      if (!map[projId][phaseId][e.user_id]) map[projId][phaseId][e.user_id] = { hours: 0, extra: 0 }
      map[projId][phaseId][e.user_id].hours += e.horas
      if (e.es_extra) map[projId][phaseId][e.user_id].extra += e.horas
    })

    const memberMap = Object.fromEntries(teamMembers.map((m) => [m.id, m]))

    const projects = Object.entries(map).map(([projId, phaseData]) => {
      const phases = Object.entries(phaseData).map(([phaseId, memberData]) => {
        const members = Object.entries(memberData).map(([memberId, data]) => {
          const member = memberMap[memberId]
          return {
            memberId,
            memberName: member?.nombre ?? memberId,
            memberColor: member?.color ?? '#888',
            memberInitials: member?.initials ?? '?',
            memberAvatarUrl: member?.avatar_url ?? null,
            hours: data.hours,
            extra: data.extra,
          }
        }).sort((a, b) => b.hours - a.hours)

        const totalHours = members.reduce((a, m) => a + m.hours, 0)
        const totalExtra = members.reduce((a, m) => a + m.extra, 0)
        const info = phaseInfo[phaseId]
        return {
          phaseId,
          label: info?.label ?? phaseId,
          numero: info?.numero ?? 0,
          seccion: info?.seccion ?? '',
          totalHours,
          extra: totalExtra,
          members,
        }
      }).sort((a, b) => a.numero - b.numero)

      const totalHours = phases.reduce((a, p) => a + p.totalHours, 0)
      const info = projectNames[projId]
      return { id: projId, nombre: info?.nombre ?? projId, codigo: info?.codigo ?? '', totalHours, phases }
    }).sort((a, b) => b.totalHours - a.totalHours)

    const globalMax = Math.max(...projects.flatMap((p) => p.phases.map((ph) => ph.totalHours)), 1)
    return { projects, globalMax }
  }, [teamAnalysisEntries, fases, proyectos, teamMembers])

  // ── Loading state ──

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#888' }}>
        Cargando...
      </div>
    )
  }

  // ── VIEW: Weekly Grid ──

  const renderWeekly = () => {
    return (
      <div>
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* User avatars */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {visibleMembers.map((m) => {
              const isSelected = viewingUserId === m.id
              const isOwn = m.id === currentUserId
              const size = isSelected ? 34 : 27
              return (
                <div key={m.id} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setViewingUserId(m.id)}
                    style={{
                      width: size, height: size, borderRadius: '50%',
                      border: isSelected ? '2px solid #111' : '2px solid transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', overflow: 'hidden',
                      background: m.color, opacity: isSelected || isOwn ? 1 : 0.45,
                      transition: 'all 0.15s ease', boxSizing: 'border-box',
                      padding: 0, flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      const tip = e.currentTarget.nextSibling as HTMLElement
                      if (tip) tip.style.opacity = '1'
                    }}
                    onMouseLeave={(e) => {
                      const tip = e.currentTarget.nextSibling as HTMLElement
                      if (tip) tip.style.opacity = '0'
                    }}
                  >
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: '#fff', fontSize: isSelected ? 11 : 9, fontWeight: 700, letterSpacing: '0.02em' }}>
                        {m.initials}
                      </span>
                    )}
                  </button>
                  <div style={{
                    position: 'absolute', top: '100%', left: '50%',
                    transform: 'translateX(-50%)', marginTop: 6,
                    background: '#111', color: '#fff', fontSize: 10, fontWeight: 500,
                    padding: '3px 8px', borderRadius: 3, whiteSpace: 'nowrap',
                    opacity: 0, pointerEvents: 'none', transition: 'opacity 0.1s ease', zIndex: 50,
                  }}>
                    {m.nombre}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <button onClick={prevWeek} style={navBtnStyle}>‹</button>
            <span style={{ fontSize: 13, color: '#444', fontWeight: 500, minWidth: 180, textAlign: 'center' }}>
              {fmtWeek(currentMonday)}
            </span>
            <button onClick={nextWeek} style={navBtnStyle}>›</button>
            <button onClick={goToday} style={{ ...navBtnStyle, fontSize: 11, padding: '4px 10px', borderRadius: 4 }}>
              Hoy
            </button>
          </div>

          {/* Hours summary + status */}
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#666', alignItems: 'center' }}>
            <span><strong style={{ color: '#222' }}>{weekHours(viewingUserId)}</strong> h normales</span>
            <span><strong style={{ color: '#D85A30' }}>{extraHours(viewingUserId)}</strong> h extra</span>
            {clipboard && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#378ADD14', border: '1px solid #378ADD44',
                borderRadius: 4, padding: '2px 8px 2px 6px', cursor: 'pointer',
              }}
                onClick={() => setClipboard(null)}
                title="Click para cancelar pegado"
              >
                <span style={{ fontSize: 13, opacity: 0.7 }}>📋</span>
                <span style={{ fontSize: 11, color: '#378ADD', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(() => { const d = cellDisplay(clipboard); return d.line1 ? `${d.line1} · ${d.line2}` : d.label })()}
                </span>
                <span style={{ fontSize: 10, color: '#378ADD88', marginLeft: 2 }}>× Esc</span>
              </div>
            )}
            {saving && <span style={{ color: '#888', fontStyle: 'italic' }}>Guardando...</span>}
            {failedCells.size > 0 && (
              <span style={{ color: '#D85A30', fontWeight: 600 }}>
                ⚠ {failedCells.size} celda{failedCells.size > 1 ? 's' : ''} no guardada{failedCells.size > 1 ? 's' : ''}
              </span>
            )}

            {/* Export / Import — partner & manager only */}
            {(currentUserRole === 'fp_manager' || currentUserRole === 'fp_partner') && (
              <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                <div style={{ position: 'relative' }}
                  onMouseEnter={(e) => { const t = e.currentTarget.querySelector<HTMLElement>('.tt'); if (t) t.style.opacity = '1' }}
                  onMouseLeave={(e) => { const t = e.currentTarget.querySelector<HTMLElement>('.tt'); if (t) t.style.opacity = '0' }}
                >
                  <button onClick={exportCSV} style={{ ...navBtnStyle, fontSize: 13, padding: '3px 10px', color: '#1D9E75', borderColor: '#1D9E75', lineHeight: 1 }}>↓</button>
                  <div className="tt" style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, background: '#111', color: '#fff', fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 3, whiteSpace: 'nowrap', opacity: 0, pointerEvents: 'none', transition: 'opacity 0.1s', zIndex: 50 }}>
                    Exportar año
                  </div>
                </div>
                <div style={{ position: 'relative' }}
                  onMouseEnter={(e) => { const t = e.currentTarget.querySelector<HTMLElement>('.tt'); if (t) t.style.opacity = '1' }}
                  onMouseLeave={(e) => { const t = e.currentTarget.querySelector<HTMLElement>('.tt'); if (t) t.style.opacity = '0' }}
                >
                  <label style={{ ...navBtnStyle, fontSize: 13, padding: '3px 10px', cursor: 'pointer', color: '#378ADD', borderColor: '#378ADD', lineHeight: 1, display: 'inline-block' }}>
                    ↑
                    <input type="file" accept=".csv" style={{ display: 'none' }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) importCSV(f); e.target.value = '' }} />
                  </label>
                  <div className="tt" style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, background: '#111', color: '#fff', fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 3, whiteSpace: 'nowrap', opacity: 0, pointerEvents: 'none', transition: 'opacity 0.1s', zIndex: 50 }}>
                    Restaurar desde CSV
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Grid */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%', minWidth: 700 }}>
            <thead>
              <tr>
                <th style={thStyle('#F8F7F4')}>H</th>
                {weekDates.map((d, i) => {
                  const isToday = d === todayStr()
                  return (
                    <th key={d} style={{ ...thStyle(isToday ? '#1D9E75' : '#F8F7F4'), color: isToday ? '#fff' : '#555', minWidth: 90 }}>
                      <div style={{ fontWeight: 600 }}>{DOW[i]}</div>
                      <div style={{ fontWeight: 300, opacity: 0.8, fontSize: 10 }}>
                        {new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((h) => {
                const isExtra = isExtraSlot(h)
                const isMid = h === 14
                return (
                  <tr key={h} style={{ borderTop: isMid ? '2px solid #ccc' : '1px solid #eee' }}>
                    <td style={{
                      ...tdStyle, fontWeight: 600, textAlign: 'center', minWidth: 36, fontSize: 10,
                      color: isExtra ? '#D85A30' : '#555',
                      background: isExtra ? 'rgba(216,90,48,0.04)' : '#FAFAF8',
                    }}>
                      {h}:00
                    </td>
                    {weekDates.map((d) => {
                      const val = getCell(viewingUserId, d, h)
                      const isFailed = failedCells.has(cellKey(viewingUserId, d, h))
                      const disp = cellDisplay(val)
                      const isOpen = openCell?.fecha === d && openCell?.h === h && openCell?.uid === viewingUserId
                      return (
                        <td
                          key={d}
                          style={{
                            ...tdStyle,
                            background: isFailed ? 'rgba(216,90,48,0.12)' : isExtra && !val ? 'rgba(216,90,48,0.04)' : undefined,
                            padding: 0,
                            outline: isFailed ? '1px solid #D85A30' : isOpen ? '2px solid #378ADD' : undefined,
                            cursor: canEdit ? (clipboard ? 'copy' : 'pointer') : 'default',
                          }}
                          title={isFailed ? '⚠ No se pudo guardar' : clipboard ? '📋 Click para pegar' : undefined}
                          onClick={(e) => {
                            if (!canEdit) return
                            e.stopPropagation()
                            // Paste mode: click any cell to paste clipboard value
                            if (clipboard) {
                              setCell(viewingUserId, d, h, clipboard)
                              return
                            }
                            const rect = e.currentTarget.getBoundingClientRect()
                            const panelH = 340
                            const panelW = 284
                            const top = rect.bottom + 4 + panelH > window.innerHeight
                              ? rect.top - panelH - 4
                              : rect.bottom + 4
                            const left = rect.left + panelW > window.innerWidth
                              ? window.innerWidth - panelW - 8
                              : rect.left
                            if (isOpen) { setOpenCell(null); return }
                            setOpenCell({ uid: viewingUserId, fecha: d, h, top, left })
                            setDropSearch('')
                          }}
                          onContextMenu={(e) => { e.preventDefault(); openNotes(viewingUserId, d, h) }}
                        >
                          <div style={{
                            width: '100%', height: '100%', minHeight: 28,
                            background: isExtra && !val ? 'rgba(255,180,0,0.07)' : disp.bg,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', padding: '1px 0',
                            boxSizing: 'border-box', userSelect: 'none', gap: 0,
                          }}>
                            {disp.line1 ? (
                              <>
                                <div style={{
                                  fontSize: 7, color: disp.tc, opacity: 0.6,
                                  lineHeight: 1.25, textAlign: 'center', width: '100%',
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                  letterSpacing: '0.01em',
                                }}>
                                  {disp.line1}
                                </div>
                                <div style={{
                                  fontSize: 8, color: disp.tc, fontWeight: 600,
                                  lineHeight: 1.25, textAlign: 'center', width: '100%',
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                  letterSpacing: '0.01em',
                                }}>
                                  {disp.line2}
                                </div>
                              </>
                            ) : (
                              <span style={{
                                fontSize: 9, color: disp.tc, fontWeight: 500,
                                letterSpacing: '0.03em', textAlign: 'center', lineHeight: 1.2,
                              }}>
                                {disp.label || (isExtra ? '·' : '')}
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {CATALOG_SECTIONS.map((sec) => {
            const { bg, tc } = sectionColor(sec)
            return (
              <div key={sec} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: bg, border: `1px solid ${tc}22`, display: 'inline-block' }} />
                <span style={{ color: tc }}>{sec}</span>
              </div>
            )
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: '#F1EFE8', border: '1px solid #ccc', display: 'inline-block' }} />
            <span style={{ color: '#888' }}>Interno</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(216,90,48,0.07)', border: '1px solid #D85A3040', display: 'inline-block' }} />
            <span style={{ color: '#D85A30' }}>Hora extra</span>
          </div>
        </div>

        {/* Viewing info */}
        {viewingUserId !== currentUserId && (
          <div style={{ marginTop: 12, padding: '8px 14px', background: '#FFF8E7', border: '1px solid #F0C040', borderRadius: 4, fontSize: 12, color: '#7A6020' }}>
            Visualizando agenda de <strong>{currentMember?.nombre}</strong> — solo lectura
          </div>
        )}
      </div>
    )
  }

  // ── VIEW: Análisis Personal ──

  const renderAnalisis = () => {
    const { rows, maxTotal, grandTotal, grandExtra } = analysisChartData
    const usedSections = CATALOG_SECTIONS.filter((s) => rows.some((r) => r.segments.some((sg) => sg.seccion === s)))

    // Period label for the summary stat
    const mn = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    const periodLabel = analysisPeriod === 'week'
      ? fmtWeek(analysisWeek)
      : analysisPeriod === 'month'
      ? (() => { const [yr, mo] = analysisMonth.split('-').map(Number); return `${MONTH_NAMES[mo-1]} ${yr}` })()
      : String(analysisYear)

    // Navigation helpers
    const prevPeriod = () => {
      if (analysisPeriod === 'week') {
        const d = new Date(analysisWeek); d.setDate(d.getDate() - 7); setAnalysisWeek(d.toISOString().slice(0, 10))
      } else if (analysisPeriod === 'month') {
        const [yr, mo] = analysisMonth.split('-').map(Number)
        const d = new Date(yr, mo - 2, 1)
        setAnalysisMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      } else {
        setAnalysisYear((y) => y - 1)
      }
    }
    const nextPeriod = () => {
      if (analysisPeriod === 'week') {
        const d = new Date(analysisWeek); d.setDate(d.getDate() + 7); setAnalysisWeek(d.toISOString().slice(0, 10))
      } else if (analysisPeriod === 'month') {
        const [yr, mo] = analysisMonth.split('-').map(Number)
        const d = new Date(yr, mo, 1)
        setAnalysisMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      } else {
        setAnalysisYear((y) => y + 1)
      }
    }
    const goCurrentPeriod = () => {
      if (analysisPeriod === 'week') setAnalysisWeek(getMondayOf(todayStr()))
      else if (analysisPeriod === 'month') {
        const d = new Date(); setAnalysisMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      } else setAnalysisYear(new Date().getFullYear())
    }
    const isCurrentPeriod = analysisPeriod === 'week'
      ? analysisWeek === getMondayOf(todayStr())
      : analysisPeriod === 'month'
      ? (() => { const d = new Date(); return analysisMonth === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
      : analysisYear === new Date().getFullYear()

    return (
      <div style={{ maxWidth: 860 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
            Análisis personal
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 200, color: '#1A1A1A', margin: 0, lineHeight: 1.1 }}>
            Horas por proyecto
          </h2>
        </div>

        {/* Period selector */}
        <div style={{
          display: 'inline-flex', gap: 0, marginBottom: 36,
          background: '#EDEBE5', padding: 3, borderRadius: 8,
        }}>
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setAnalysisPeriod(p)}
              style={{
                padding: '7px 20px', fontSize: 12, border: 'none', cursor: 'pointer',
                borderRadius: 6, transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                background: analysisPeriod === p ? '#fff' : 'transparent',
                color: analysisPeriod === p ? '#1A1A1A' : '#999',
                fontWeight: analysisPeriod === p ? 600 : 400,
                boxShadow: analysisPeriod === p ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
                letterSpacing: '0.02em',
              }}
            >
              {p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
            </button>
          ))}
        </div>

        {/* Period navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <button onClick={prevPeriod} style={navBtnStyle}>‹</button>
          <span style={{
            fontSize: 14, fontWeight: 500, color: '#333',
            minWidth: analysisPeriod === 'week' ? 200 : 130,
            textAlign: 'center',
          }}>
            {periodLabel}
          </span>
          <button onClick={nextPeriod} style={navBtnStyle}>›</button>
          {!isCurrentPeriod && (
            <button
              onClick={goCurrentPeriod}
              style={{ ...navBtnStyle, fontSize: 11, width: 'auto', padding: '0 10px' }}
            >
              Hoy
            </button>
          )}
        </div>

        {/* Grand total stat */}
        {!analysisLoading && grandTotal > 0 && (
          <div style={{ display: 'flex', gap: 40, marginBottom: 40, alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 52, fontWeight: 200, color: '#1A1A1A', lineHeight: 1, letterSpacing: '-0.02em' }}>
                {grandTotal}
              </div>
              <div style={{ fontSize: 11, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>
                horas {periodLabel}
              </div>
            </div>
            <div style={{ paddingBottom: 6 }}>
              <div style={{ fontSize: 24, fontWeight: 300, color: '#555' }}>{rows.filter(r => r.id !== '__interno__').length}</div>
              <div style={{ fontSize: 10, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>proyectos</div>
            </div>
            {grandExtra > 0 && (
              <div style={{ paddingBottom: 6 }}>
                <div style={{ fontSize: 24, fontWeight: 300, color: '#D85A30' }}>{grandExtra}</div>
                <div style={{ fontSize: 10, color: '#D85A3080', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>h. extra</div>
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        {analysisLoading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#CCC', fontSize: 13 }}>
            Cargando...
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, color: '#DDD', marginBottom: 12, fontWeight: 200 }}>—</div>
            <div style={{ fontSize: 13, color: '#BBB' }}>Sin registros {periodLabel}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row) => {
              const barPct = (row.total / maxTotal) * 100
              return (
                <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 36 }}>

                  {/* Label */}
                  <div style={{ width: 160, flexShrink: 0, textAlign: 'right', paddingRight: 4 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500, color: '#2A2A2A',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {row.nombre}
                    </div>
                    {row.codigo && (
                      <div style={{ fontSize: 9, color: '#C0BDB6', fontFamily: 'monospace', marginTop: 1, letterSpacing: '0.06em' }}>
                        {row.codigo}
                      </div>
                    )}
                  </div>

                  {/* Bar track */}
                  <div style={{
                    flex: 1, height: 32, background: '#EDEBE5',
                    borderRadius: 4, overflow: 'hidden', position: 'relative',
                  }}>
                    {/* Filled portion */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, bottom: 0,
                      width: `${barPct}%`,
                      display: 'flex', overflow: 'hidden',
                      transition: 'width 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}>
                      {row.segments.map((seg, si) => {
                        const segPct = (seg.hours / row.total) * 100
                        const extraPct = seg.extra > 0 ? (seg.extra / seg.hours) * 100 : 0
                        return (
                          <div
                            key={seg.seccion + si}
                            title={seg.extra > 0
                              ? `${seg.seccion}: ${seg.hours}h (${seg.extra}h extra)`
                              : `${seg.seccion}: ${seg.hours}h`}
                            style={{
                              width: `${segPct}%`,
                              background: seg.bg,
                              borderRight: si < row.segments.length - 1
                                ? '1.5px solid rgba(255,255,255,0.55)' : 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              overflow: 'hidden', flexShrink: 0, position: 'relative',
                              transition: 'width 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          >
                            {seg.hours >= 4 && (
                              <span style={{
                                fontSize: 9, color: seg.tc, fontWeight: 700,
                                letterSpacing: '0.04em', userSelect: 'none', position: 'relative', zIndex: 1,
                              }}>
                                {seg.hours}
                              </span>
                            )}
                            {/* Extra hours overlay — fills from bottom, proportional to extra/total in segment */}
                            {extraPct > 0 && (
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                height: `${extraPct}%`,
                                background: 'rgba(200, 15, 25, 0.52)',
                                borderTop: '1px solid rgba(200, 15, 25, 0.8)',
                                pointerEvents: 'none',
                              }} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Total */}
                  <div style={{ width: 52, flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#333', letterSpacing: '-0.01em' }}>
                      {row.total}
                      <span style={{ fontSize: 9, color: '#AAA', fontWeight: 400, marginLeft: 1 }}>h</span>
                    </div>
                    {row.extra > 0 && (
                      <div style={{ fontSize: 9, color: '#D85A30', fontWeight: 500, marginTop: 1, letterSpacing: '0.01em' }}>
                        +{row.extra} extra
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Legend */}
        {!analysisLoading && rows.length > 0 && (
          <div style={{ marginTop: 28, display: 'flex', gap: 14, flexWrap: 'wrap', paddingTop: 20, borderTop: '1px solid #E8E6E0' }}>
            {usedSections.map((sec) => {
              const { bg, tc } = sectionColor(sec)
              return (
                <div key={sec} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: 2,
                    background: bg, border: `1px solid ${tc}33`,
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, color: '#777' }}>{sec}</span>
                </div>
              )
            })}
            {rows.some((r) => r.id === '__interno__') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#F1EFE8', border: '1px solid #ccc', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#777' }}>Interno</span>
              </div>
            )}
            {rows.some((r) => r.extra > 0) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#EAF3DE', border: '1px solid #27500A22', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'rgba(216,90,48,0.28)', borderTop: '1px solid rgba(216,90,48,0.5)' }} />
                </div>
                <span style={{ fontSize: 11, color: '#777' }}>Zona naranja = horas extra en esa sección</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── VIEW: Team Análisis ──

  const renderTeamAnalisis = () => {
    const { projects, globalMax, grandTotal, grandExtra } = teamAnalysisChartData
    const { projects: phaseProjects, globalMax: phaseGlobalMax } = teamAnalysisPhaseData

    const periodLabel = teamAnalysisPeriod === 'week'
      ? fmtWeek(teamAnalysisWeek)
      : teamAnalysisPeriod === 'month'
      ? (() => { const [yr, mo] = teamAnalysisMonth.split('-').map(Number); return `${MONTH_NAMES[mo-1]} ${yr}` })()
      : String(teamAnalysisYear)

    const prevPeriod = () => {
      if (teamAnalysisPeriod === 'week') {
        const d = new Date(teamAnalysisWeek); d.setDate(d.getDate() - 7); setTeamAnalysisWeek(d.toISOString().slice(0, 10))
      } else if (teamAnalysisPeriod === 'month') {
        const [yr, mo] = teamAnalysisMonth.split('-').map(Number)
        const d = new Date(yr, mo - 2, 1)
        setTeamAnalysisMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      } else {
        setTeamAnalysisYear((y) => y - 1)
      }
    }
    const nextPeriod = () => {
      if (teamAnalysisPeriod === 'week') {
        const d = new Date(teamAnalysisWeek); d.setDate(d.getDate() + 7); setTeamAnalysisWeek(d.toISOString().slice(0, 10))
      } else if (teamAnalysisPeriod === 'month') {
        const [yr, mo] = teamAnalysisMonth.split('-').map(Number)
        const d = new Date(yr, mo, 1)
        setTeamAnalysisMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      } else {
        setTeamAnalysisYear((y) => y + 1)
      }
    }
    const goCurrentPeriod = () => {
      if (teamAnalysisPeriod === 'week') setTeamAnalysisWeek(getMondayOf(todayStr()))
      else if (teamAnalysisPeriod === 'month') {
        const d = new Date(); setTeamAnalysisMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      } else setTeamAnalysisYear(new Date().getFullYear())
    }
    const isCurrentPeriod = teamAnalysisPeriod === 'week'
      ? teamAnalysisWeek === getMondayOf(todayStr())
      : teamAnalysisPeriod === 'month'
      ? (() => { const d = new Date(); return teamAnalysisMonth === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
      : teamAnalysisYear === new Date().getFullYear()

    const usedSections = CATALOG_SECTIONS.filter((s) =>
      projects.some((p) => p.members.some((m) => m.segments.some((sg) => sg.seccion === s)))
    )

    return (
      <div style={{ maxWidth: 940 }}>

        {/* Header */}
        <div className="tt-team-header" style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
              Team análisis
            </p>
            <h2 style={{ fontSize: 26, fontWeight: 200, color: '#1A1A1A', margin: 0, lineHeight: 1.1 }}>
              {teamAnalysisGroupBy === 'person' ? 'Horas por proyecto y persona' : 'Horas por proyecto y fase'}
            </h2>
          </div>
          {/* Group-by toggle */}
          <div style={{ display: 'inline-flex', background: '#EDEBE5', padding: 3, borderRadius: 8, gap: 0, flexShrink: 0 }}>
            {(['person', 'phase'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setTeamAnalysisGroupBy(g)}
                style={{
                  padding: '5px 14px', fontSize: 11, border: 'none', cursor: 'pointer',
                  borderRadius: 6, transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                  background: teamAnalysisGroupBy === g ? '#fff' : 'transparent',
                  color: teamAnalysisGroupBy === g ? '#1A1A1A' : '#999',
                  fontWeight: teamAnalysisGroupBy === g ? 600 : 400,
                  boxShadow: teamAnalysisGroupBy === g ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
                  letterSpacing: '0.02em',
                }}
              >
                {g === 'person' ? 'Por persona' : 'Por fase'}
              </button>
            ))}
          </div>
        </div>

        {/* Period selector */}
        <div style={{
          display: 'inline-flex', gap: 0, marginBottom: 36,
          background: '#EDEBE5', padding: 3, borderRadius: 8,
        }}>
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setTeamAnalysisPeriod(p)}
              style={{
                padding: '7px 20px', fontSize: 12, border: 'none', cursor: 'pointer',
                borderRadius: 6, transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                background: teamAnalysisPeriod === p ? '#fff' : 'transparent',
                color: teamAnalysisPeriod === p ? '#1A1A1A' : '#999',
                fontWeight: teamAnalysisPeriod === p ? 600 : 400,
                boxShadow: teamAnalysisPeriod === p ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
                letterSpacing: '0.02em',
              }}
            >
              {p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
            </button>
          ))}
        </div>

        {/* Period navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <button onClick={prevPeriod} style={navBtnStyle}>‹</button>
          <span style={{
            fontSize: 14, fontWeight: 500, color: '#333',
            minWidth: teamAnalysisPeriod === 'week' ? 200 : 130,
            textAlign: 'center',
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

        {/* Grand totals */}
        {!teamAnalysisLoading && grandTotal > 0 && (
          <div style={{ display: 'flex', gap: 40, marginBottom: 40, alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 52, fontWeight: 200, color: '#1A1A1A', lineHeight: 1, letterSpacing: '-0.02em' }}>
                {grandTotal}
              </div>
              <div style={{ fontSize: 11, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>
                horas equipo {periodLabel}
              </div>
            </div>
            <div style={{ paddingBottom: 6 }}>
              <div style={{ fontSize: 24, fontWeight: 300, color: '#555' }}>{projects.filter(p => p.id !== '__interno__').length}</div>
              <div style={{ fontSize: 10, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>proyectos</div>
            </div>
            <div style={{ paddingBottom: 6 }}>
              <div style={{ fontSize: 24, fontWeight: 300, color: '#555' }}>
                {new Set(projects.flatMap(p => p.members.map(m => m.memberId))).size}
              </div>
              <div style={{ fontSize: 10, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>personas</div>
            </div>
            {grandExtra > 0 && (
              <div style={{ paddingBottom: 6 }}>
                <div style={{ fontSize: 24, fontWeight: 300, color: '#D85A30' }}>{grandExtra}</div>
                <div style={{ fontSize: 10, color: '#D85A3080', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>h. extra</div>
              </div>
            )}
          </div>
        )}

        {/* Projects — shared project header renderer */}
        {teamAnalysisLoading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#CCC', fontSize: 13 }}>
            Cargando...
          </div>
        ) : projects.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 40, color: '#DDD', marginBottom: 12, fontWeight: 200 }}>—</div>
            <div style={{ fontSize: 13, color: '#BBB' }}>Sin registros {periodLabel}</div>
          </div>
        ) : teamAnalysisGroupBy === 'person' ? (

          /* ── View: by person ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {projects.map((project) => (
              <div key={project.id}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #E8E6E0' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{project.nombre}</span>
                  {project.codigo && <span style={{ fontSize: 9, color: '#C0BDB6', fontFamily: 'monospace', letterSpacing: '0.06em' }}>{project.codigo}</span>}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    {(() => { const x = project.members.reduce((a, m) => a + m.extra, 0); return x > 0 ? <span style={{ fontSize: 11, fontWeight: 500, color: '#D85A30' }}>+{x} extra</span> : null })()}
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#555', letterSpacing: '-0.01em' }}>{project.totalHours}<span style={{ fontSize: 9, color: '#AAA', fontWeight: 400, marginLeft: 1 }}>h total</span></span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {project.members.map((member) => {
                    const barPct = (member.total / globalMax) * 100
                    return (
                      <div key={member.memberId} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 30 }}>
                        <div style={{ width: 140, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: member.memberColor, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {member.memberAvatarUrl ? <img src={member.memberAvatarUrl} alt={member.memberName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>{member.memberInitials}</span>}
                          </div>
                          <span style={{ fontSize: 11, color: '#444', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.memberName.split(' ')[0]}</span>
                        </div>
                        <div style={{ flex: 1, height: 26, background: '#EDEBE5', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${barPct}%`, display: 'flex', overflow: 'hidden', transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)' }}>
                            {member.segments.map((seg, si) => {
                              const segPct = (seg.hours / member.total) * 100
                              const extraPct = seg.extra > 0 ? (seg.extra / seg.hours) * 100 : 0
                              return (
                                <div key={seg.seccion + si} title={seg.extra > 0 ? `${seg.seccion}: ${seg.hours}h (${seg.extra}h extra)` : `${seg.seccion}: ${seg.hours}h`}
                                  style={{ width: `${segPct}%`, background: seg.bg, borderRight: si < member.segments.length - 1 ? '1.5px solid rgba(255,255,255,0.55)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative', transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)' }}>
                                  {seg.hours >= 4 && <span style={{ fontSize: 8, color: seg.tc, fontWeight: 700, letterSpacing: '0.04em', userSelect: 'none', position: 'relative', zIndex: 1 }}>{seg.hours}</span>}
                                  {extraPct > 0 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${extraPct}%`, background: 'rgba(200,15,25,0.52)', borderTop: '1px solid rgba(200,15,25,0.8)', pointerEvents: 'none' }} />}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div style={{ width: 52, flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#333', letterSpacing: '-0.01em' }}>{member.total}<span style={{ fontSize: 9, color: '#AAA', fontWeight: 400, marginLeft: 1 }}>h</span></div>
                          {member.extra > 0 && <div style={{ fontSize: 9, color: '#D85A30', fontWeight: 500, marginTop: 1 }}>+{member.extra}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

        ) : (

          /* ── View: by phase ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {phaseProjects.map((project) => (
              <div key={project.id}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #E8E6E0' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{project.nombre}</span>
                  {project.codigo && <span style={{ fontSize: 9, color: '#C0BDB6', fontFamily: 'monospace', letterSpacing: '0.06em' }}>{project.codigo}</span>}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    {(() => { const x = project.phases.reduce((a, p) => a + p.extra, 0); return x > 0 ? <span style={{ fontSize: 11, fontWeight: 500, color: '#D85A30' }}>+{x} extra</span> : null })()}
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#555', letterSpacing: '-0.01em' }}>{project.totalHours}<span style={{ fontSize: 9, color: '#AAA', fontWeight: 400, marginLeft: 1 }}>h total</span></span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {project.phases.map((phase) => {
                    const barPct = (phase.totalHours / phaseGlobalMax) * 100
                    const { bg: secBg, tc: secTc } = sectionColor(phase.seccion)
                    return (
                      <div key={phase.phaseId} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 30 }}>
                        {/* Phase label */}
                        <div style={{ width: 140, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 8, fontWeight: 700, background: secBg, border: `1px solid ${secTc}44`, borderRadius: 3, padding: '1px 5px', flexShrink: 0, letterSpacing: '0.03em', color: secTc }}>
                            F{phase.numero}
                          </span>
                          <span style={{ fontSize: 11, color: '#444', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {abreviarFase(phase.label)}
                          </span>
                        </div>
                        {/* Bar stacked by member */}
                        <div style={{ flex: 1, height: 26, background: '#EDEBE5', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${barPct}%`, display: 'flex', overflow: 'hidden', transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)' }}>
                            {phase.members.map((member, mi) => {
                              const segPct = (member.hours / phase.totalHours) * 100
                              const extraPct = member.extra > 0 ? (member.extra / member.hours) * 100 : 0
                              return (
                                <div key={member.memberId} title={member.extra > 0 ? `${member.memberName}: ${member.hours}h (${member.extra}h extra)` : `${member.memberName}: ${member.hours}h`}
                                  style={{ width: `${segPct}%`, background: member.memberColor + 'BB', borderRight: mi < phase.members.length - 1 ? '1.5px solid rgba(255,255,255,0.6)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, position: 'relative', transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)' }}>
                                  <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, letterSpacing: '0.02em', userSelect: 'none', position: 'relative', zIndex: 1, textShadow: '0 1px 2px rgba(0,0,0,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90%' }}>{(() => { const p = member.memberName.trim().split(' '); return p[1] ? `${p[0]} ${p[1][0]}.` : p[0] })()}</span>
                                  {extraPct > 0 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${extraPct}%`, background: 'rgba(200,15,25,0.52)', borderTop: '1px solid rgba(200,15,25,0.8)', pointerEvents: 'none' }} />}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        {/* Total */}
                        <div style={{ width: 52, flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#333', letterSpacing: '-0.01em' }}>{phase.totalHours}<span style={{ fontSize: 9, color: '#AAA', fontWeight: 400, marginLeft: 1 }}>h</span></div>
                          {phase.extra > 0 && <div style={{ fontSize: 9, color: '#D85A30', fontWeight: 500, marginTop: 1 }}>+{phase.extra}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        {!teamAnalysisLoading && projects.length > 0 && teamAnalysisGroupBy === 'person' && (
          <div style={{ marginTop: 32, display: 'flex', gap: 14, flexWrap: 'wrap', paddingTop: 20, borderTop: '1px solid #E8E6E0' }}>
            {usedSections.map((sec) => {
              const { bg, tc } = sectionColor(sec)
              return (
                <div key={sec} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: `1px solid ${tc}33`, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#777' }}>{sec}</span>
                </div>
              )
            })}
            {projects.some((p) => p.id === '__interno__') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#F1EFE8', border: '1px solid #ccc', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#777' }}>Interno</span>
              </div>
            )}
            {grandExtra > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#EAF3DE', border: '1px solid #27500A22', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'rgba(216,90,48,0.28)', borderTop: '1px solid rgba(216,90,48,0.5)' }} />
                </div>
                <span style={{ fontSize: 11, color: '#777' }}>Zona naranja = horas extra</span>
              </div>
            )}
          </div>
        )}
        {!teamAnalysisLoading && phaseProjects.length > 0 && teamAnalysisGroupBy === 'phase' && (
          <div style={{ marginTop: 32, display: 'flex', gap: 14, flexWrap: 'wrap', paddingTop: 20, borderTop: '1px solid #E8E6E0' }}>
            {Array.from(new Map(phaseProjects.flatMap(p => p.phases.flatMap(ph => ph.members)).map(m => [m.memberId, m])).values()).map((member) => (
              <div key={member.memberId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: member.memberColor + 'BB', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#777' }}>{member.memberName.split(' ')[0]}</span>
              </div>
            ))}
            {phaseProjects.some(p => p.phases.some(ph => ph.extra > 0)) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#aaa', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'rgba(216,90,48,0.35)', borderTop: '1px solid rgba(216,90,48,0.6)' }} />
                </div>
                <span style={{ fontSize: 11, color: '#777' }}>Zona naranja = horas extra</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Notes Modal ──

  const renderNotesModal = () => {
    if (!notesModal) return null
    return (
      <Modal title={`Notas — ${notesModal.fecha} ${notesModal.h}:00`} onClose={() => setNotesModal(null)}>
        <textarea
          style={{ ...inputStyle, height: 100, resize: 'vertical' }}
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          placeholder="Notas opcionales para esta hora..."
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button style={ghostBtnStyle} onClick={() => setNotesModal(null)}>Cancelar</button>
          <button style={primaryBtnStyle} onClick={saveNotes}>Guardar nota</button>
        </div>
      </Modal>
    )
  }

  // ── Main Render ──

  const { filteredIntCats, filteredProjects } = dropdownOptions

  return (
    <div style={{ fontFamily: "'Inter', 'system-ui', sans-serif", background: '#F8F7F4', minHeight: '100vh', color: '#222' }}>
      {/* Top bar */}
      <div className="tt-topbar" style={{
        background: '#fff', borderBottom: '1px solid #E0DED8', padding: '0 28px',
        display: 'flex', alignItems: 'center', gap: 0, height: 48,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', color: '#333', marginRight: 28 }}>
          TIME TRACKER
        </span>
        {((['weekly', 'dashboard'] as const) as ('weekly' | 'dashboard' | 'team' | 'translator')[])
          .concat(currentUserRole !== 'fp_team' ? ['team'] : [])
          .concat(currentUserRole === 'fp_partner' ? ['translator'] : [])
          .map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: view === tab ? 600 : 400,
                color: view === tab ? '#222' : '#888',
                padding: '0 14px', height: '100%',
                borderBottom: view === tab ? '2px solid #222' : '2px solid transparent',
                letterSpacing: '0.03em', textTransform: 'uppercase', transition: 'color 0.15s',
              }}
            >
              {tab === 'weekly' ? 'Semana'
                : tab === 'dashboard' ? 'Análisis Personal'
                : tab === 'team' ? 'Team Análisis'
                : 'Translator'}
            </button>
          ))
        }
        {error && <span style={{ marginLeft: 'auto', color: '#D85A30', fontSize: 11 }}>{error}</span>}
      </div>

      {/* Content */}
      <div className="tt-content" style={{ padding: '28px 28px', maxWidth: 1280, margin: '0 auto' }}>
        {view === 'weekly' && renderWeekly()}
        {view === 'dashboard' && renderAnalisis()}
        {view === 'team' && renderTeamAnalisis()}
        {view === 'translator' && (
          <TimeTrackerTranslator
            teamMembers={teamMembers}
            proyectos={proyectos}
            fases={fases}
          />
        )}
      </div>

      {/* Notes modal */}
      {renderNotesModal()}

      {/* ── Cell Dropdown Panel ── */}
      {openCell && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={() => setOpenCell(null)}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed',
            top: openCell.top,
            left: openCell.left,
            width: 284,
            maxHeight: 340,
            zIndex: 999,
            background: '#fff',
            border: '1px solid #C8C5BE',
            boxShadow: '0 10px 30px rgba(0,0,0,0.13)',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
          }}>
            {/* Search input */}
            <div style={{ padding: '9px 12px', borderBottom: '1px solid #EDEAE4', flexShrink: 0 }}>
              <input
                autoFocus
                value={dropSearch}
                onChange={(e) => setDropSearch(e.target.value)}
                placeholder="Buscar proyecto o código..."
                style={{
                  width: '100%', fontSize: 12, border: 'none', outline: 'none',
                  background: 'transparent', color: '#222', fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Options list */}
            <div id="tt-dropdown-panel" style={{ overflowY: 'auto', flex: 1 }}>
              {/* Clear + Copy options */}
              {getCell(openCell.uid, openCell.fecha, openCell.h) && (
                <div style={{ display: 'flex', borderBottom: '1px solid #F5F3EE' }}>
                  <div
                    onClick={() => { setCell(openCell.uid, openCell.fecha, openCell.h, ''); setOpenCell(null) }}
                    style={{ flex: 1, padding: '6px 12px', fontSize: 11, color: '#AAA', cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#F8F6F1' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    — vacío —
                  </div>
                  <div
                    onClick={() => { setClipboard(getCell(openCell.uid, openCell.fecha, openCell.h)); setOpenCell(null) }}
                    style={{ padding: '6px 10px', fontSize: 11, color: '#378ADD', cursor: 'pointer', fontWeight: 500, borderLeft: '1px solid #F5F3EE', display: 'flex', alignItems: 'center', gap: 4 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#F0F6FF' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 12 }}>📋</span> Copiar
                  </div>
                </div>
              )}

              {/* Internal categories */}
              {filteredIntCats.length > 0 && (
                <>
                  <div style={{ padding: '7px 12px 3px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#BBB', fontWeight: 600 }}>
                    Interno
                  </div>
                  {filteredIntCats.map((cat) => {
                    const val = `int_${cat}`
                    const isSelected = getCell(openCell.uid, openCell.fecha, openCell.h) === val
                    return (
                      <div
                        key={cat}
                        onClick={() => { setCell(openCell.uid, openCell.fecha, openCell.h, val); setOpenCell(null) }}
                        style={{
                          padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                          background: isSelected ? '#F1EFE8' : 'transparent',
                          color: isSelected ? '#444' : '#666',
                          fontWeight: isSelected ? 500 : 400,
                        }}
                        onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#F8F6F1' }}
                        onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        {INTERNAL_CATS_LABELS[cat] ?? cat.replace(/_/g, ' ')}
                      </div>
                    )
                  })}
                </>
              )}

              {/* Projects + phases */}
              {filteredProjects.map(({ proyecto, fases: pFases }) => (
                <div key={proyecto.id}>
                  <div style={{
                    padding: '8px 12px 3px', borderTop: '1px solid #F0EEE8',
                    display: 'flex', gap: 7, alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#222' }}>{proyecto.nombre}</span>
                    <span style={{ fontSize: 9, color: '#BBB', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{proyecto.codigo}</span>
                    {proyecto.status === 'on_hold' && (
                      <span style={{ fontSize: 8, color: '#C9A227', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>pausado</span>
                    )}
                  </div>
                  {pFases.map((f) => {
                    const { bg, tc } = sectionColor(f.seccion)
                    const isSelected = getCell(openCell.uid, openCell.fecha, openCell.h) === f.id
                    return (
                      <div
                        key={f.id}
                        onClick={() => { setCell(openCell.uid, openCell.fecha, openCell.h, f.id); setOpenCell(null) }}
                        style={{
                          padding: '4px 12px 4px 22px', fontSize: 11, cursor: 'pointer',
                          background: isSelected ? bg : 'transparent',
                          color: isSelected ? tc : '#444',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}
                        onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#F8F6F1' }}
                        onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        <span style={{ fontSize: 9, color: '#BBB', minWidth: 20, flexShrink: 0, fontFamily: 'monospace' }}>F{f.numero}</span>
                        <span style={{ lineHeight: 1.3 }}>{f.label}</span>
                      </div>
                    )
                  })}
                </div>
              ))}

              {filteredIntCats.length === 0 && filteredProjects.length === 0 && (
                <div style={{ padding: '18px 12px', fontSize: 11, color: '#BBB', textAlign: 'center' }}>
                  Sin resultados
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Deletion friction modal */}
      {pendingDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 28, maxWidth: 420, width: '90%', borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#222', marginBottom: 8 }}>¿Eliminar este registro?</p>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
              Has eliminado <strong>{sessionDeletions}</strong> registros en esta sesión. Llevas más de 10 eliminaciones.
            </p>
            <p style={{ fontSize: 11, color: '#999', marginBottom: 20 }}>
              Recuerda que puedes exportar un respaldo del año antes de eliminar datos importantes. Los registros eliminados no se pueden recuperar automáticamente.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingDelete(null)} style={{ fontSize: 11, padding: '6px 16px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#444' }}>
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const { uid, fecha, h } = pendingDelete
                  setPendingDelete(null)
                  await commitDelete(uid, fecha, h)
                }}
                style={{ fontSize: 11, padding: '6px 16px', border: '1px solid #D85A30', borderRadius: 4, background: '#D85A30', cursor: 'pointer', color: '#fff', fontWeight: 600 }}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import feedback */}
      {importError && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: importError.startsWith('✓') ? '#1D9E75' : '#D85A30',
          color: '#fff', padding: '10px 20px', borderRadius: 6, fontSize: 12,
          fontWeight: 500, zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {importing ? 'Importando...' : importError}
          {!importing && (
            <button onClick={() => setImportError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared micro-components ────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 500, color: '#222', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────

const thStyle = (bg: string): React.CSSProperties => ({
  background: bg, padding: '6px 4px', fontWeight: 600, fontSize: 11,
  color: '#555', textAlign: 'center', border: '1px solid #E8E6E0', letterSpacing: '0.04em',
})

const tdStyle: React.CSSProperties = {
  border: '1px solid #EEECE6', padding: 0, verticalAlign: 'middle', height: 28,
}

const navBtnStyle: React.CSSProperties = {
  border: '1px solid #DDD', background: '#fff', cursor: 'pointer', fontSize: 16,
  width: 28, height: 28, borderRadius: 4, display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: '#555',
}

const primaryBtnStyle: React.CSSProperties = {
  background: '#222', color: '#fff', border: 'none', borderRadius: 4,
  padding: '7px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 500, letterSpacing: '0.02em',
}

const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent', color: '#555', border: '1px solid #DDD',
  borderRadius: 4, padding: '7px 16px', fontSize: 12, cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #E0DED8', borderRadius: 4, padding: '7px 10px',
  fontSize: 12, color: '#222', background: '#fff', outline: 'none', boxSizing: 'border-box',
}
