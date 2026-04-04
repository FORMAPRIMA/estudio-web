'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMember { id: string; nombre: string; initials: string; color: string }
interface Proyecto { id: string; nombre: string; codigo: string }
interface Fase { id: string; proyecto_id: string; label: string; seccion: string }

interface ClaudeRow {
  user_nombre: string | null
  proyecto_nombre: string | null
  fase_label: string | null
  horas: number | null
  fecha: string | null
  notas: string | null
}

interface ParsedEntry {
  user_nombre: string | null
  user_id: string | null
  proyecto_nombre: string | null
  proyecto_id: string | null
  fase_label: string | null
  fase_id: string | null
  horas: number | null
  fecha: string | null
  notas: string | null
  confidence: { user: ConfLevel; proyecto: ConfLevel; fase: ConfLevel }
}

interface SimulatedEntry {
  user_id: string
  fecha: string        // YYYY-MM-DD
  hora_inicio: number  // 9, 10, 11...
  horas: number
  proyecto_id: string | null
  fase_id: string | null
  es_extra: boolean
  notas: string | null
  // For display
  _user_nombre: string | null
  _proyecto_nombre: string | null
  _fase_label: string | null
}

interface ImportedEntry {
  id: string; batch_id: string
  user_nombre: string | null; user_id: string | null
  proyecto_nombre: string | null; proyecto_id: string | null
  fase_label: string | null; fase_id: string | null
  horas: number | null; fecha: string | null; notas: string | null
  created_at: string
}

interface Props { teamMembers: TeamMember[]; proyectos: Proyecto[]; fases: Fase[] }

// Mappings: raw CSV value → resolved DB id ('' = skip/ignore)
interface Mappings {
  users: Record<string, string>      // user_nombre → user_id | ''
  proyectos: Record<string, string>  // proyecto_nombre → proyecto_id | ''
  fases: Record<string, string>      // `${proyecto_nombre}||${fase_label}` → fase_id | ''
}

// ── Fuzzy matching ────────────────────────────────────────────────────────────

type ConfLevel = 'high' | 'medium' | 'low' | 'none'

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim()
}

function matchUser(nombre: string | null, members: TeamMember[]): { id: string | null; conf: ConfLevel } {
  if (!nombre) return { id: null, conf: 'none' }
  const q = normalize(nombre)
  const exact = members.find(m => normalize(m.nombre) === q)
  if (exact) return { id: exact.id, conf: 'high' }
  const firstName = q.split(' ')[0]
  const byFirst = members.filter(m => normalize(m.nombre).startsWith(firstName))
  if (byFirst.length === 1) return { id: byFirst[0].id, conf: 'medium' }
  const contains = members.filter(m => normalize(m.nombre).includes(q) || q.includes(normalize(m.nombre).split(' ')[0]))
  if (contains.length === 1) return { id: contains[0].id, conf: 'medium' }
  return { id: null, conf: 'low' }
}

function matchProyecto(nombre: string | null, proyectos: Proyecto[]): { id: string | null; conf: ConfLevel } {
  if (!nombre) return { id: null, conf: 'none' }
  const q = normalize(nombre)
  const exact = proyectos.find(p => normalize(p.nombre) === q || normalize(p.codigo) === q)
  if (exact) return { id: exact.id, conf: 'high' }
  const byCodigo = proyectos.find(p => q.includes(normalize(p.codigo)) || normalize(p.codigo).includes(q))
  if (byCodigo) return { id: byCodigo.id, conf: 'medium' }
  const byNombre = proyectos.filter(p => normalize(p.nombre).includes(q) || q.includes(normalize(p.nombre)))
  if (byNombre.length === 1) return { id: byNombre[0].id, conf: 'medium' }
  if (byNombre.length > 1) return { id: byNombre[0].id, conf: 'low' }
  return { id: null, conf: 'low' }
}

function matchFase(label: string | null, fases: Fase[], proyectoId: string | null): { id: string | null; conf: ConfLevel } {
  if (!label) return { id: null, conf: 'none' }
  const q = normalize(label)
  const pool = proyectoId ? fases.filter(f => f.proyecto_id === proyectoId) : fases
  if (!pool.length) return { id: null, conf: 'none' }
  const exact = pool.find(f => normalize(f.label) === q)
  if (exact) return { id: exact.id, conf: 'high' }
  const contains = pool.filter(f => normalize(f.label).includes(q) || q.includes(normalize(f.label)))
  if (contains.length === 1) return { id: contains[0].id, conf: 'medium' }
  const words = q.split(' ').filter(w => w.length > 3)
  const byWords = pool.filter(f => words.some(w => normalize(f.label).includes(w)))
  if (byWords.length === 1) return { id: byWords[0].id, conf: 'low' }
  return { id: null, conf: 'none' }
}

function resolveEntries(rows: ClaudeRow[], teamMembers: TeamMember[], proyectos: Proyecto[], fases: Fase[]): ParsedEntry[] {
  return rows.map(row => {
    const userMatch = matchUser(row.user_nombre, teamMembers)
    const proyMatch = matchProyecto(row.proyecto_nombre, proyectos)
    const faseMatch = matchFase(row.fase_label, fases, proyMatch.id)
    return {
      user_nombre: row.user_nombre, user_id: userMatch.id,
      proyecto_nombre: row.proyecto_nombre, proyecto_id: proyMatch.id,
      fase_label: row.fase_label, fase_id: faseMatch.id,
      horas: row.horas, fecha: row.fecha, notas: row.notas,
      confidence: { user: userMatch.conf, proyecto: proyMatch.conf, fase: faseMatch.conf },
    }
  })
}

// Apply manual mappings on top of auto-resolved entries
function applyMappings(entries: ParsedEntry[], mappings: Mappings, fases: Fase[]): ParsedEntry[] {
  return entries.map(e => {
    const userKey = e.user_nombre ?? ''
    const proyKey = e.proyecto_nombre ?? ''
    const faseKey = `${proyKey}||${e.fase_label ?? ''}`

    const userId = userKey && userKey in mappings.users
      ? (mappings.users[userKey] || null) : e.user_id
    const proyId = proyKey && proyKey in mappings.proyectos
      ? (mappings.proyectos[proyKey] || null) : e.proyecto_id

    // Re-run fase match with resolved proyecto_id if fase wasn't manually mapped
    let faseId = e.fase_id
    if (faseKey in mappings.fases) {
      faseId = mappings.fases[faseKey] || null
    } else if (proyId && proyId !== e.proyecto_id) {
      // Project was resolved manually, re-match fase against new project
      faseId = matchFase(e.fase_label, fases, proyId).id
    }

    return { ...e, user_id: userId, proyecto_id: proyId, fase_id: faseId }
  })
}

// ── Date simulation ───────────────────────────────────────────────────────────

const SIM_START = '2026-01-01'
const MAX_HOURS_PER_DAY = 8
const DAY_START_HOUR = 9

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

function nextWorkingDay(d: Date): Date {
  const next = new Date(d)
  do { next.setDate(next.getDate() + 1) } while (isWeekend(next))
  return next
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function simulateEntries(entries: ParsedEntry[]): SimulatedEntry[] {
  // Group entries by user_id (skip entries with no user_id)
  const byUser: Record<string, ParsedEntry[]> = {}
  for (const e of entries) {
    if (!e.user_id || !e.horas) continue
    if (!byUser[e.user_id]) byUser[e.user_id] = []
    byUser[e.user_id].push(e)
  }

  const result: SimulatedEntry[] = []

  for (const [userId, userEntries] of Object.entries(byUser)) {
    let currentDate = new Date(SIM_START)
    // Ensure start is a working day
    while (isWeekend(currentDate)) currentDate = nextWorkingDay(currentDate)

    let hoursUsedToday = 0

    for (const entry of userEntries) {
      const h = entry.horas!
      // If not enough room in today (need at least the full entry), move to next day
      if (hoursUsedToday + h > MAX_HOURS_PER_DAY && hoursUsedToday > 0) {
        currentDate = nextWorkingDay(currentDate)
        hoursUsedToday = 0
      }

      // Skip lunch slot (hora 14 = extra). If packing would land on 14, bump to 15.
      const rawHora = DAY_START_HOUR + hoursUsedToday
      const hora_inicio = rawHora >= 14 ? rawHora + 1 : rawHora
      result.push({
        user_id: userId,
        fecha: toISODate(currentDate),
        hora_inicio,
        horas: h,
        proyecto_id: entry.proyecto_id,
        fase_id: entry.fase_id,
        es_extra: false,
        notas: entry.notas,
        _user_nombre: entry.user_nombre,
        _proyecto_nombre: entry.proyecto_nombre,
        _fase_label: entry.fase_label,
      })

      hoursUsedToday += h
      if (hoursUsedToday >= MAX_HOURS_PER_DAY) {
        currentDate = nextWorkingDay(currentDate)
        hoursUsedToday = 0
      }
    }
  }

  return result
}

// ── CSV parsing ────────────────────────────────────────────────────────────────

function isCleanFormat(content: string): boolean {
  const first = content.split('\n')[0].toLowerCase()
  return first.includes('user_nombre') && first.includes('proyecto_nombre') && first.includes('fase_label') && first.includes('horas')
}

function parseCleanCsv(content: string): ClaudeRow[] {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const iUser = headers.indexOf('user_nombre')
  const iProy = headers.indexOf('proyecto_nombre')
  const iFase = headers.indexOf('fase_label')
  const iHoras = headers.indexOf('horas')
  const iFecha = headers.findIndex(h => h.includes('fecha'))
  const iNotas = headers.findIndex(h => h.includes('nota'))
  return lines.slice(1).map(line => {
    const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    return {
      user_nombre: iUser >= 0 ? (cols[iUser] || null) : null,
      proyecto_nombre: iProy >= 0 ? (cols[iProy] || null) : null,
      fase_label: iFase >= 0 ? (cols[iFase] || null) : null,
      horas: iHoras >= 0 ? (parseFloat(cols[iHoras].replace(',', '.')) || null) : null,
      fecha: iFecha >= 0 ? (cols[iFecha] || null) : null,
      notas: iNotas >= 0 ? (cols[iNotas] || null) : null,
    }
  })
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function confidenceBadge(level: ConfLevel) {
  const map = {
    high: { bg: '#D1FAE5', color: '#065F46', label: '✓' },
    medium: { bg: '#FEF3C7', color: '#92400E', label: '~' },
    low: { bg: '#FEE2E2', color: '#991B1B', label: '?' },
    none: { bg: '#F3F4F6', color: '#6B7280', label: '—' },
  }
  const s = map[level]
  return <span style={{ display: 'inline-block', padding: '1px 5px', borderRadius: 3, background: s.bg, color: s.color, fontSize: 10, fontWeight: 700 }}>{s.label}</span>
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimeTrackerTranslator({ teamMembers, proyectos, fases }: Props) {
  const supabase = createClient()

  const [csvContent, setCsvContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseProgress, setParseProgress] = useState({ current: 0, total: 0 })
  const [parseError, setParseError] = useState('')

  // step: 'upload' | 'resolve' | 'preview'
  const [step, setStep] = useState<'upload' | 'resolve' | 'preview'>('upload')
  const [rawEntries, setRawEntries] = useState<ParsedEntry[]>([])   // after auto-match
  const [finalEntries, setFinalEntries] = useState<ParsedEntry[]>([]) // after applying mappings
  const [mappings, setMappings] = useState<Mappings>({ users: {}, proyectos: {}, fases: {} })

  const [simulated, setSimulated] = useState<SimulatedEntry[]>([])

  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [importError, setImportError] = useState('')

  const [imported, setImported] = useState<ImportedEntry[]>([])
  const [loadingImported, setLoadingImported] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload')

  const CHUNK_SIZE = 30

  // ── History ──────────────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setLoadingImported(true)
    const { data } = await supabase.from('notion_translator_entries').select('*').order('created_at', { ascending: false }).limit(500)
    setImported(data ?? [])
    setLoadingImported(false)
  }, [supabase])

  // ── File upload ──────────────────────────────────────────────────────────────

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) { setParseError('El archivo debe ser un CSV'); return }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => { setCsvContent(e.target?.result as string); setParseError(''); setImportDone(false) }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent) { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }

  // ── API call ─────────────────────────────────────────────────────────────────

  async function callChunk(chunkCsv: string): Promise<ClaudeRow[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90000)
    try {
      const res = await fetch('/api/time-tracker-translator', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ csvContent: chunkCsv }),
      })
      clearTimeout(timeout)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error desconocido')
      return json.rows ?? []
    } catch (err) { clearTimeout(timeout); throw err }
  }

  // ── Parse + auto-resolve ─────────────────────────────────────────────────────

  async function handleParse() {
    if (!csvContent.trim()) return
    setParsing(true); setParseError('')

    try {
      let allRows: ClaudeRow[]

      if (isCleanFormat(csvContent)) {
        allRows = parseCleanCsv(csvContent)
      } else {
        const lines = csvContent.split('\n').filter(l => l.trim())
        const headerLine = lines[0]
        const dataLines = lines.slice(1)
        const chunks: string[][] = []
        for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) chunks.push(dataLines.slice(i, i + CHUNK_SIZE))
        setParseProgress({ current: 0, total: chunks.length })
        allRows = []
        for (let i = 0; i < chunks.length; i++) {
          setParseProgress({ current: i + 1, total: chunks.length })
          if (i > 0) await new Promise(r => setTimeout(r, 2000))
          const chunkCsv = [headerLine, ...chunks[i]].join('\n')
          let rows: ClaudeRow[] = []; let lastErr: Error | null = null
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 15000))
              rows = await callChunk(chunkCsv); lastErr = null; break
            } catch (err) { lastErr = err as Error }
          }
          if (lastErr) throw lastErr
          allRows.push(...rows)
        }
      }

      const resolved = resolveEntries(allRows, teamMembers, proyectos, fases)
      setRawEntries(resolved)

      // Build initial mappings: pre-fill with auto-matched values
      const initMappings: Mappings = { users: {}, proyectos: {}, fases: {} }
      for (const e of resolved) {
        if (e.user_nombre && !(e.user_nombre in initMappings.users))
          initMappings.users[e.user_nombre] = e.user_id ?? ''
        if (e.proyecto_nombre && !(e.proyecto_nombre in initMappings.proyectos))
          initMappings.proyectos[e.proyecto_nombre] = e.proyecto_id ?? ''
        const fKey = `${e.proyecto_nombre ?? ''}||${e.fase_label ?? ''}`
        if (e.fase_label && !(fKey in initMappings.fases))
          initMappings.fases[fKey] = e.fase_id ?? ''
      }
      setMappings(initMappings)
      setStep('resolve')
    } catch (err) {
      setParseError((err as Error).name === 'AbortError' ? 'Timeout: un lote tardó demasiado.' : String(err))
    } finally {
      setParsing(false); setParseProgress({ current: 0, total: 0 })
    }
  }

  // ── Apply mappings → preview ──────────────────────────────────────────────────

  function handleApplyMappings() {
    const final = applyMappings(rawEntries, mappings, fases)
    setFinalEntries(final)
    setSimulated(simulateEntries(final))
    setStep('preview')
  }

  // ── Import ────────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!simulated.length) return
    setImporting(true); setImportError('')

    // Insert into real time_entries
    const rows = simulated.map(({ _user_nombre, _proyecto_nombre, _fase_label, ...e }) => e)
    const { error } = await supabase.from('time_entries').insert(rows)
    if (error) { setImportError(error.message); setImporting(false); return }

    setImportDone(true)
    setStep('upload')
    setCsvContent(''); setFileName(''); setRawEntries([]); setFinalEntries([]); setSimulated([])
    setImporting(false)
  }

  // ── Resolution step ───────────────────────────────────────────────────────────

  function renderResolveStep() {
    const uniqueUsers = [...new Set(rawEntries.map(e => e.user_nombre).filter(Boolean))] as string[]
    const uniqueProyectos = [...new Set(rawEntries.map(e => e.proyecto_nombre).filter(Boolean))] as string[]
    const faseKeys = [...new Set(rawEntries.filter(e => e.fase_label).map(e => `${e.proyecto_nombre ?? ''}||${e.fase_label ?? ''}`))]

    // Hours at stake per key
    const horasByUser: Record<string, number> = {}
    const horasByProy: Record<string, number> = {}
    const horasByFase: Record<string, number> = {}
    for (const e of rawEntries) {
      const h = e.horas ?? 0
      if (e.user_nombre) horasByUser[e.user_nombre] = (horasByUser[e.user_nombre] ?? 0) + h
      if (e.proyecto_nombre) horasByProy[e.proyecto_nombre] = (horasByProy[e.proyecto_nombre] ?? 0) + h
      const fk = `${e.proyecto_nombre ?? ''}||${e.fase_label ?? ''}`
      if (e.fase_label) horasByFase[fk] = (horasByFase[fk] ?? 0) + h
    }
    console.log('[translator] horasByUser', horasByUser)
    console.log('[translator] sample entry horas', rawEntries[0]?.horas)

    const needsAttention =
      uniqueUsers.some(u => !mappings.users[u]) ||
      uniqueProyectos.some(p => !mappings.proyectos[p]) ||
      faseKeys.some(k => !mappings.fases[k])

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#222' }}>Resolución de entidades</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Asigna manualmente las entidades que el sistema no pudo identificar. Las que ya tienen ✓ fueron reconocidas automáticamente.
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => { setStep('upload'); setRawEntries([]) }}
              style={{ padding: '7px 14px', background: '#fff', border: '1px solid #C8C5BE', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#555' }}>
              ← Volver
            </button>
            <button onClick={handleApplyMappings}
              style={{ padding: '7px 16px', background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {needsAttention ? 'Continuar con pendientes →' : 'Confirmar y previsualizar →'}
            </button>
          </div>
        </div>

        {needsAttention && (
          <div style={{ padding: '8px 12px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, fontSize: 12, color: '#92400E' }}>
            Hay entidades sin asignar. Puedes continuar igualmente — esas entradas se guardarán solo con el nombre de texto, sin ID vinculado.
          </div>
        )}

        {/* Personas */}
        <MappingSection title="Personas" count={uniqueUsers.length}>
          {uniqueUsers.map(u => {
            const currentId = mappings.users[u] ?? ''
            const isAuto = rawEntries.find(e => e.user_nombre === u)?.confidence.user === 'high'
            return (
              <MappingRow key={u} rawValue={u} isAuto={isAuto} resolved={!!currentId} horas={horasByUser[u] ?? 0}>
                <select value={currentId}
                  onChange={e => setMappings(prev => ({ ...prev, users: { ...prev.users, [u]: e.target.value } }))}
                  style={selectStyle}>
                  <option value="">— Sin asignar —</option>
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </MappingRow>
            )
          })}
        </MappingSection>

        {/* Proyectos */}
        <MappingSection title="Proyectos" count={uniqueProyectos.length}>
          {uniqueProyectos.map(p => {
            const currentId = mappings.proyectos[p] ?? ''
            const isAuto = rawEntries.find(e => e.proyecto_nombre === p)?.confidence.proyecto === 'high'
            return (
              <MappingRow key={p} rawValue={p} isAuto={isAuto} resolved={!!currentId} horas={horasByProy[p] ?? 0}>
                <select value={currentId}
                  onChange={e => setMappings(prev => ({ ...prev, proyectos: { ...prev.proyectos, [p]: e.target.value } }))}
                  style={selectStyle}>
                  <option value="">— Sin asignar —</option>
                  {proyectos.map(pr => <option key={pr.id} value={pr.id}>{pr.codigo} — {pr.nombre}</option>)}
                </select>
              </MappingRow>
            )
          })}
        </MappingSection>

        {/* Fases */}
        <MappingSection title="Fases" count={faseKeys.length}>
          {faseKeys.map(fKey => {
            const [proyNombre, faseLabel] = fKey.split('||')
            const currentId = mappings.fases[fKey] ?? ''
            const isAuto = rawEntries.find(e => e.proyecto_nombre === proyNombre && e.fase_label === faseLabel)?.confidence.fase === 'high'
            const proyId = mappings.proyectos[proyNombre] ?? ''
            const fasesPool = proyId ? fases.filter(f => f.proyecto_id === proyId) : fases
            return (
              <MappingRow key={fKey} rawValue={faseLabel} subtitle={proyNombre} isAuto={isAuto} resolved={!!currentId} horas={horasByFase[fKey] ?? 0}>
                <select value={currentId}
                  onChange={e => setMappings(prev => ({ ...prev, fases: { ...prev.fases, [fKey]: e.target.value } }))}
                  style={selectStyle}>
                  <option value="">— Sin asignar —</option>
                  {fasesPool.length === 0 && <option disabled>Primero asigna el proyecto</option>}
                  {fasesPool.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </MappingRow>
            )
          })}
        </MappingSection>
      </div>
    )
  }

  // ── Preview step ──────────────────────────────────────────────────────────────

  function renderPreviewStep() {
    const skipped = finalEntries.filter(e => !e.user_id).length

    // Summary per user
    const userSummary: Record<string, { nombre: string; totalHoras: number; lastDate: string; dias: Set<string> }> = {}
    for (const s of simulated) {
      if (!userSummary[s.user_id]) {
        const m = teamMembers.find(m => m.id === s.user_id)
        userSummary[s.user_id] = { nombre: m?.nombre ?? s._user_nombre ?? s.user_id, totalHoras: 0, lastDate: '', dias: new Set() }
      }
      userSummary[s.user_id].totalHoras += s.horas
      userSummary[s.user_id].dias.add(s.fecha)
      if (s.fecha > userSummary[s.user_id].lastDate) userSummary[s.user_id].lastDate = s.fecha
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#222' }}>Confirmar importación</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {simulated.length} entradas en time tracker · desde 01/01/2026 · días laborables · 8h/día
              {skipped > 0 && ` · ${skipped} omitidos (sin usuario asignado)`}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('resolve')}
              style={{ padding: '7px 14px', background: '#fff', border: '1px solid #C8C5BE', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#555' }}>
              ← Volver
            </button>
            <button onClick={handleImport} disabled={importing || simulated.length === 0}
              style={{ padding: '7px 16px', background: importing ? '#888' : '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, cursor: importing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>
              {importing ? 'Importando...' : `Importar ${simulated.length} entradas al time tracker`}
            </button>
          </div>
        </div>

        {importError && <div style={{ padding: '8px 12px', background: '#FEE2E2', borderRadius: 6, fontSize: 12, color: '#991B1B' }}>{importError}</div>}

        {skipped > 0 && (
          <div style={{ padding: '8px 12px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, fontSize: 12, color: '#92400E' }}>
            {skipped} registros no se importarán porque no tienen usuario asignado. Puedes volver a resolución para asignarlos.
          </div>
        )}

        {/* Per-user summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {Object.entries(userSummary).map(([uid, s]) => {
            const member = teamMembers.find(m => m.id === uid)
            return (
              <div key={uid} style={{ border: '1px solid #E0DED8', borderRadius: 8, padding: '12px 14px', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {member && <div style={{ width: 24, height: 24, borderRadius: '50%', background: member.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{member.initials}</div>}
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#222' }}>{s.nombre}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#222' }}>{s.totalHoras.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 400, color: '#888' }}>h</span></div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{s.dias.size} días laborables</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>hasta {s.lastDate}</div>
              </div>
            )
          })}
        </div>

        {/* Detailed table */}
        <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#F7F6F2', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid #E0DED8' }}>
                <th style={th}>Fecha</th><th style={th}>Usuario</th><th style={th}>Proyecto</th>
                <th style={th}>Fase</th><th style={th}>Inicio</th><th style={th}>Horas</th>
              </tr>
            </thead>
            <tbody>
              {simulated.map((e, i) => {
                const member = teamMembers.find(m => m.id === e.user_id)
                const proy = proyectos.find(p => p.id === e.proyecto_id)
                const fase = fases.find(f => f.id === e.fase_id)
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F0EEE8' }}>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#555' }}>{e.fecha}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {member && <div style={{ width: 16, height: 16, borderRadius: '50%', background: member.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, flexShrink: 0 }}>{member.initials}</div>}
                        <span>{member?.nombre ?? e._user_nombre ?? '—'}</span>
                      </div>
                    </td>
                    <td style={{ ...td, color: proy ? '#222' : '#999' }}>{proy?.codigo ?? e._proyecto_nombre ?? '—'}</td>
                    <td style={{ ...td, color: fase ? '#222' : '#999', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fase?.label ?? e._fase_label ?? '—'}</td>
                    <td style={{ ...td, color: '#888' }}>{e.hora_inicio}:00</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{e.horas}h</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── History ───────────────────────────────────────────────────────────────────

  function renderHistory() {
    if (loadingImported) return <div style={{ color: '#888', fontSize: 13 }}>Cargando...</div>
    if (!imported.length) return <div style={{ color: '#888', fontSize: 13 }}>No hay registros importados aún.</div>

    const byUser: Record<string, { user_nombre: string | null; byProject: Record<string, { proyecto_nombre: string | null; byFase: Record<string, { fase_label: string | null; horas: number }> }> }> = {}
    for (const e of imported) {
      const uk = e.user_id ?? e.user_nombre ?? '__unknown__'
      if (!byUser[uk]) byUser[uk] = { user_nombre: e.user_nombre, byProject: {} }
      const pk = e.proyecto_id ?? e.proyecto_nombre ?? '__unknown__'
      if (!byUser[uk].byProject[pk]) byUser[uk].byProject[pk] = { proyecto_nombre: e.proyecto_nombre, byFase: {} }
      const fk = e.fase_id ?? e.fase_label ?? '__unknown__'
      if (!byUser[uk].byProject[pk].byFase[fk]) byUser[uk].byProject[pk].byFase[fk] = { fase_label: e.fase_label, horas: 0 }
      byUser[uk].byProject[pk].byFase[fk].horas += e.horas ?? 0
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {Object.entries(byUser).map(([uk, ud]) => {
          const member = teamMembers.find(m => m.id === uk)
          const totalHoras = Object.values(ud.byProject).reduce((acc, pd) => acc + Object.values(pd.byFase).reduce((a, f) => a + f.horas, 0), 0)
          return (
            <div key={uk} style={{ background: '#fff', border: '1px solid #E0DED8', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#F7F6F2', borderBottom: '1px solid #E0DED8', display: 'flex', alignItems: 'center', gap: 10 }}>
                {member && <div style={{ width: 28, height: 28, borderRadius: '50%', background: member.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{member.initials}</div>}
                <span style={{ fontWeight: 700, fontSize: 13, color: '#222' }}>{ud.user_nombre ?? uk}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#666' }}>{totalHoras.toFixed(1)}h total</span>
              </div>
              <div style={{ padding: '8px 16px 12px' }}>
                {Object.entries(ud.byProject).map(([pk, pd]) => {
                  const proy = proyectos.find(p => p.id === pk)
                  const proyTotal = Object.values(pd.byFase).reduce((a, f) => a + f.horas, 0)
                  return (
                    <div key={pk} style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{proy?.codigo ?? pd.proyecto_nombre ?? pk}</span>
                        <span style={{ fontSize: 11, color: '#aaa' }}>—</span>
                        <span style={{ fontSize: 11, color: '#555' }}>{proy?.nombre ?? pd.proyecto_nombre ?? '(desconocido)'}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888' }}>{proyTotal.toFixed(1)}h</span>
                      </div>
                      {Object.entries(pd.byFase).map(([fk, fd]) => (
                        <div key={fk} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', background: '#F7F6F2', borderRadius: 4, marginBottom: 2 }}>
                          <span style={{ fontSize: 11, color: '#555' }}>{fd.fase_label ?? fk}</span>
                          <span style={{ fontSize: 11, color: '#333', fontWeight: 600 }}>{fd.horas.toFixed(1)}h</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#222', margin: 0, marginBottom: 4 }}>Time Tracker Translator</h2>
        <p style={{ fontSize: 13, color: '#777', margin: 0 }}>Importa registros de horas desde exportaciones CSV de Notion.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E0DED8', marginBottom: 24 }}>
        {(['upload', 'history'] as const).map(t => (
          <button key={t} onClick={() => { setActiveTab(t); if (t === 'history') loadHistory() }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: activeTab === t ? 600 : 400, color: activeTab === t ? '#222' : '#888', padding: '8px 16px', borderBottom: activeTab === t ? '2px solid #222' : '2px solid transparent', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            {t === 'upload' ? 'Importar CSV' : 'Historial'}
          </button>
        ))}
      </div>

      {activeTab === 'history' && renderHistory()}

      {activeTab === 'upload' && (
        <>
          {/* Step indicator */}
          {step !== 'upload' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 12 }}>
              {(['upload', 'resolve', 'preview'] as const).map((s, i) => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ padding: '2px 10px', borderRadius: 12, fontWeight: step === s ? 700 : 400, background: step === s ? '#222' : '#F0EEE8', color: step === s ? '#fff' : '#888' }}>
                    {i + 1}. {s === 'upload' ? 'CSV' : s === 'resolve' ? 'Resolución' : 'Confirmación'}
                  </span>
                  {i < 2 && <span style={{ color: '#ccc' }}>→</span>}
                </span>
              ))}
            </div>
          )}

          {/* Step: upload */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!csvContent ? (
                <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => document.getElementById('tt-file-input')?.click()}
                  style={{ border: '2px dashed #C8C5BE', borderRadius: 8, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: '#FAFAF8' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#999')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#C8C5BE')}>
                  <input id="tt-file-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 4 }}>Arrastra tu CSV aquí o haz clic</div>
                  <div style={{ fontSize: 12, color: '#999' }}>Formato limpio (user_nombre, proyecto_nombre, fase_label, horas) o CSV de Notion</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 6 }}>
                    <span style={{ fontSize: 20 }}>✅</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#065F46' }}>{fileName}</div>
                      <div style={{ fontSize: 11, color: '#059669' }}>
                        {csvContent.split('\n').filter(Boolean).length - 1} filas
                        {isCleanFormat(csvContent) ? ' · formato limpio detectado, no necesita IA' : ` · se procesarán en ${Math.ceil((csvContent.split('\n').filter(Boolean).length - 1) / CHUNK_SIZE)} lotes`}
                      </div>
                    </div>
                    <button onClick={() => { setCsvContent(''); setFileName(''); setParseError('') }} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#888', fontSize: 18 }}>×</button>
                  </div>

                  {parseError && <div style={{ padding: '8px 12px', background: '#FEE2E2', borderRadius: 6, fontSize: 12, color: '#991B1B' }}>{parseError}</div>}

                  <button onClick={handleParse} disabled={parsing} style={{ padding: '10px 20px', background: parsing ? '#888' : '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: parsing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, alignSelf: 'flex-start' }}>
                    {parsing
                      ? parseProgress.total > 0 ? `Procesando lote ${parseProgress.current} / ${parseProgress.total}...` : 'Preparando...'
                      : 'Interpretar →'}
                  </button>
                </>
              )}
              {importDone && (
                <div style={{ padding: '12px 16px', background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#065F46' }}>Importación completada</div>
                  <button onClick={() => { setImportDone(false); setActiveTab('history'); loadHistory() }}
                    style={{ marginTop: 8, padding: '6px 12px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                    Ver historial →
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'resolve' && renderResolveStep()}
          {step === 'preview' && renderPreviewStep()}
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MappingSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #E0DED8', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', background: '#F7F6F2', borderBottom: '1px solid #E0DED8' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>{count} entradas únicas</span>
      </div>
      <div style={{ padding: '4px 0' }}>{children}</div>
    </div>
  )
}

function MappingRow({ rawValue, subtitle, isAuto, resolved, horas, children }: { rawValue: string; subtitle?: string; isAuto: boolean; resolved: boolean; horas: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid #F7F6F2' }}>
      <div style={{ minWidth: 200, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>{rawValue}</span>
          {isAuto && <span style={{ fontSize: 10, padding: '1px 5px', background: '#D1FAE5', color: '#065F46', borderRadius: 3, fontWeight: 700 }}>AUTO</span>}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{subtitle}</div>}
      </div>
      <div style={{ fontSize: 14, color: '#C8C5BE' }}>→</div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {/* Hours at stake */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, minWidth: 72 }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 700,
          background: resolved ? '#D1FAE5' : '#FEF3C7',
          color: resolved ? '#065F46' : '#92400E',
          whiteSpace: 'nowrap',
        }}>
          {horas % 1 === 0 ? horas : horas.toFixed(1)}h
        </span>
        {!resolved && (
          <span style={{ fontSize: 10, color: '#D97706' }}>pendiente</span>
        )}
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }
const td: React.CSSProperties = { padding: '7px 10px', verticalAlign: 'middle' }
const selectStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid #C8C5BE', borderRadius: 6, fontSize: 12, color: '#333', background: '#fff', cursor: 'pointer' }
