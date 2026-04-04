'use client'

import { useState, useTransition, useRef } from 'react'
import {
  uploadNomina,
  deleteNomina,
  saveFondoPeriodo,
  deleteFondoPeriodo,
  saveParticipacion,
  deleteParticipacion,
  getNominaSignedUrl,
} from '@/app/actions/area-interna'
import {
  createTeamMember,
  blockTeamMember,
  unblockTeamMember,
  updateTeamMemberProfile,
  updateTeamMemberEmail,
  resetTeamMemberPassword,
} from '@/app/actions/equipo'
import { updateMemberCosts } from '@/app/actions/finanzas'
import type { FondoPeriodo } from './FondoChart'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMember {
  id:                 string
  nombre:             string
  apellido:           string | null
  email:              string
  rol:                string
  avatar_url:         string | null
  fecha_contratacion: string | null
  telefono:           string | null
  direccion:          string | null
  fecha_nacimiento:   string | null
  notas:              string | null
  blocked:            boolean
  salario_mensual:    number | null
}

interface NominaRecord {
  id:        string
  user_id:   string
  periodo:   string
  pdf_path:  string
  pdf_url:   string
  created_at: string
  profiles?: { nombre: string; apellido: string | null; rol: string } | null
}

interface Participacion {
  id:                         string
  user_id:                    string
  porcentaje_participacion:   number
  fecha_inicio_participacion: string
  notas:                      string | null
  profiles?: { nombre: string; apellido: string | null; email: string; rol: string } | null
}

interface Props {
  allMembers:        TeamMember[]
  allParticipaciones: Participacion[]
  allNominas:        NominaRecord[]
  periodos:          FondoPeriodo[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtPeriodo(p: string) {
  const [y, m] = p.split('-')
  return `${MESES_ES[parseInt(m, 10) - 1]} ${y}`
}

function fmtMXN(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function memberName(m: { nombre: string; apellido: string | null }) {
  return `${m.nombre}${m.apellido ? ` ${m.apellido}` : ''}`
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid #E8E6E0', background: '#fff',
  fontSize: 13, color: '#1A1A1A', fontWeight: 300,
  outline: 'none', boxSizing: 'border-box',
}
const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' }
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 9, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: '#AAA', fontWeight: 300, marginBottom: 6,
}
const btnPrimary: React.CSSProperties = {
  background: '#1A1A1A', color: '#fff', border: 'none',
  padding: '9px 20px', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', fontWeight: 300, cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  background: 'none', color: '#888', border: '1px solid #E8E6E0',
  padding: '8px 16px', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', fontWeight: 300, cursor: 'pointer',
}

// ── Nóminas tab ───────────────────────────────────────────────────────────────

function NominasTab({ allMembers, allNominas }: { allMembers: TeamMember[]; allNominas: NominaRecord[] }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [selUserId, setSelUserId] = useState('')
  const [periodo,   setPeriodo]   = useState('')
  const [file,      setFile]      = useState<File | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingId,  setViewingId]  = useState<string | null>(null)

  const [nominas, setNominas] = useState<NominaRecord[]>(allNominas)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
  }

  const upload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selUserId || !periodo || !file) return
    setLoading(true); setError(null); setSuccess(false)

    const formData = new FormData()
    formData.append('userId',  selUserId)
    formData.append('periodo', periodo)
    formData.append('file',    file)

    const res = await uploadNomina(formData)
    if ('error' in res) { setError(res.error ?? null); setLoading(false); return }

    setSuccess(true)
    setFile(null); setPeriodo(''); if (fileRef.current) fileRef.current.value = ''
    window.location.reload()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta nómina?')) return
    setDeletingId(id)
    await deleteNomina(id)
    setNominas(prev => prev.filter(n => n.id !== id))
    setDeletingId(null)
  }

  const openNomina = async (nomina: NominaRecord) => {
    setViewingId(nomina.id)
    const res = await getNominaSignedUrl(nomina.pdf_path)
    setViewingId(null)
    if ('error' in res) { alert(res.error); return }
    window.open((res as any).url, '_blank', 'noopener,noreferrer')
  }

  // Group by user
  const byUser: Record<string, NominaRecord[]> = {}
  for (const n of nominas) {
    const key = n.user_id
    if (!byUser[key]) byUser[key] = []
    byUser[key].push(n)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Upload form */}
      <div style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '24px 28px' }}>
        <p style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#BBB', fontWeight: 300, marginBottom: 20 }}>
          Subir nómina
        </p>
        <form onSubmit={upload} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, alignItems: 'end' }} className="ap-nominas-form">
          <div>
            <label style={labelSt}>Empleado</label>
            <select value={selUserId} onChange={e => setSelUserId(e.target.value)} required style={selectSt}>
              <option value="">Seleccionar…</option>
              {allMembers.map(m => (
                <option key={m.id} value={m.id}>{memberName(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelSt}>Período (mes)</label>
            <input
              type="month" value={periodo}
              onChange={e => setPeriodo(e.target.value.replace('-', '-').slice(0, 7))}
              required style={inputSt}
            />
          </div>
          <div>
            <label style={labelSt}>Archivo PDF</label>
            <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} required style={{ ...inputSt, padding: '6px 12px', cursor: 'pointer' }} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={loading || !selUserId || !periodo || !file} style={{ ...btnPrimary, opacity: loading || !selUserId || !periodo || !file ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Subiendo…' : 'Subir nómina'}
            </button>
            {error   && <p style={{ fontSize: 11, color: '#C04828', fontWeight: 300 }}>{error}</p>}
            {success && <p style={{ fontSize: 11, color: '#1D9E75', fontWeight: 300 }}>Nómina subida correctamente.</p>}
          </div>
        </form>
      </div>

      {/* List grouped by user */}
      {allMembers.filter(m => byUser[m.id]?.length).map(m => (
        <div key={m.id} style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '20px 28px' }}>
          <p style={{ fontSize: 11, color: '#555', fontWeight: 300, marginBottom: 14 }}>{memberName(m)}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {(byUser[m.id] ?? []).map(n => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', background: '#FAFAF8',
              }}>
                <p style={{ fontSize: 13, color: '#444', fontWeight: 300 }}>{fmtPeriodo(n.periodo)}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openNomina(n)} disabled={viewingId === n.id} style={btnGhost}>
                    {viewingId === n.id ? '…' : 'Ver'}
                  </button>
                  <button onClick={() => handleDelete(n.id)} disabled={deletingId === n.id}
                    style={{ ...btnGhost, color: '#C04828', borderColor: '#F0D0C8' }}>
                    {deletingId === n.id ? '…' : 'Eliminar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Fondo tab ─────────────────────────────────────────────────────────────────

function FondoTab({ periodos: initialPeriodos }: { periodos: FondoPeriodo[] }) {
  const [periodos,  setPeriodos]  = useState<FondoPeriodo[]>(initialPeriodos)
  const [form, setForm] = useState({
    periodo: '', valor_total: '', rendimiento_pct: '', notas: '', fecha_referencia: '',
  })
  const [loading,  setLoading]   = useState(false)
  const [error,    setError]     = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId,  setEditingId]  = useState<string | null>(null)

  const resetForm = () => setForm({ periodo: '', valor_total: '', rendimiento_pct: '', notas: '', fecha_referencia: '' })

  const startEdit = (p: FondoPeriodo) => {
    setEditingId(p.id)
    setForm({
      periodo:         p.periodo,
      valor_total:     p.valor_total.toString(),
      rendimiento_pct: p.rendimiento_pct?.toString() ?? '',
      notas:           p.notas ?? '',
      fecha_referencia: p.fecha_referencia,
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    const res = await saveFondoPeriodo({
      periodo:         form.periodo.trim(),
      valor_total:     parseFloat(form.valor_total),
      rendimiento_pct: form.rendimiento_pct ? parseFloat(form.rendimiento_pct) : null,
      notas:           form.notas.trim(),
      fecha_referencia: form.fecha_referencia,
    })
    if ('error' in res) { setError(res.error ?? null); setLoading(false); return }
    resetForm(); setEditingId(null)
    window.location.reload()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este período?')) return
    setDeletingId(id)
    await deleteFondoPeriodo(id)
    setPeriodos(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
  }

  const fmtQ = (p: string) => {
    const [y, q] = p.split('-')
    const LABELS: Record<string,string> = { 'Q1': 'Ene–Mar', 'Q2': 'Abr–Jun', 'Q3': 'Jul–Sep', 'Q4': 'Oct–Dic' }
    return `${q} ${y} (${LABELS[q] ?? ''})`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Form */}
      <div style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '24px 28px' }}>
        <p style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#BBB', fontWeight: 300, marginBottom: 20 }}>
          {editingId ? 'Editar período' : 'Agregar período trimestral'}
        </p>
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'end' }}>
          <div>
            <label style={labelSt}>Período</label>
            <input value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value.toUpperCase() }))}
              placeholder="2025-Q1" required pattern="\d{4}-Q[1-4]" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Fecha referencia</label>
            <input type="date" value={form.fecha_referencia} onChange={e => setForm(f => ({ ...f, fecha_referencia: e.target.value }))} required style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Valor total (€ EUR)</label>
            <input type="number" value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))}
              required min={0} style={inputSt} placeholder="1000000" />
          </div>
          <div>
            <label style={labelSt}>Rendimiento trimestral (%)</label>
            <input type="number" value={form.rendimiento_pct} onChange={e => setForm(f => ({ ...f, rendimiento_pct: e.target.value }))}
              step="0.01" style={inputSt} placeholder="+3.5" />
          </div>
          <div style={{ gridColumn: '2 / -1' }}>
            <label style={labelSt}>Notas</label>
            <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} style={inputSt} placeholder="Proyectos activos, contexto…" />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Guardando…' : (editingId ? 'Actualizar' : 'Agregar período')}
            </button>
            {editingId && (
              <button type="button" onClick={() => { resetForm(); setEditingId(null) }} style={btnGhost}>Cancelar</button>
            )}
            {error && <p style={{ fontSize: 11, color: '#C04828', fontWeight: 300 }}>{error}</p>}
          </div>
        </form>
      </div>

      {/* Period list */}
      {periodos.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #ECEAE6', overflow: 'hidden' }}>
          {periodos.slice().reverse().map((p, i) => (
            <div key={p.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
              gap: 16, alignItems: 'center',
              padding: '13px 24px',
              borderBottom: i < periodos.length - 1 ? '1px solid #F0EEE8' : 'none',
              background: editingId === p.id ? '#FAFAF8' : '#fff',
            }}>
              <div>
                <p style={{ fontSize: 9, color: '#AAA', fontWeight: 300, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Período</p>
                <p style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 300 }}>{fmtQ(p.periodo)}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: '#AAA', fontWeight: 300, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Valor total</p>
                <p style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 300 }}>{fmtMXN(p.valor_total)}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: '#AAA', fontWeight: 300, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rendimiento</p>
                <p style={{ fontSize: 13, fontWeight: 300, color: p.rendimiento_pct != null ? (p.rendimiento_pct >= 0 ? '#1D9E75' : '#D85A30') : '#AAA' }}>
                  {p.rendimiento_pct != null ? `${p.rendimiento_pct > 0 ? '+' : ''}${p.rendimiento_pct}%` : '—'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => startEdit(p)} style={btnGhost}>Editar</button>
                <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                  style={{ ...btnGhost, color: '#C04828', borderColor: '#F0D0C8' }}>
                  {deletingId === p.id ? '…' : '×'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Participaciones tab ───────────────────────────────────────────────────────

function ParticipacionesTab({
  allMembers,
  allParticipaciones: initialParts,
}: {
  allMembers:          TeamMember[]
  allParticipaciones:  Participacion[]
}) {
  const [parts, setParts] = useState<Participacion[]>(initialParts)
  const [form, setForm] = useState({
    user_id: '', porcentaje: '', fecha_inicio: '', notas: '',
  })
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [loading,  setLoading]   = useState(false)
  const [error,    setError]     = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const totalAsignado = parts.reduce((s, p) => s + p.porcentaje_participacion, 0)

  const startEdit = (p: Participacion) => {
    setEditingUserId(p.user_id)
    setForm({
      user_id:     p.user_id,
      porcentaje:  p.porcentaje_participacion.toString(),
      fecha_inicio: p.fecha_inicio_participacion,
      notas:       p.notas ?? '',
    })
  }

  const resetForm = () => {
    setForm({ user_id: '', porcentaje: '', fecha_inicio: '', notas: '' })
    setEditingUserId(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    const res = await saveParticipacion({
      user_id:                    form.user_id,
      porcentaje_participacion:   parseFloat(form.porcentaje),
      fecha_inicio_participacion: form.fecha_inicio,
      notas:                      form.notas.trim(),
    })
    if ('error' in res) { setError(res.error ?? null); setLoading(false); return }
    resetForm()
    window.location.reload()
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('¿Eliminar participación de este usuario?')) return
    setDeletingId(userId)
    await deleteParticipacion(userId)
    setParts(prev => prev.filter(p => p.user_id !== userId))
    setDeletingId(null)
  }

  const memberById = Object.fromEntries(allMembers.map(m => [m.id, m]))
  const unassigned = allMembers.filter(m => !parts.some(p => p.user_id === m.id) || editingUserId === m.id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Total summary */}
      <div style={{ display: 'flex', gap: 1 }}>
        {[
          { label: 'Participación asignada', value: `${totalAsignado.toFixed(1)}%`, color: totalAsignado > 100 ? '#D85A30' : '#1A1A1A' },
          { label: 'Disponible', value: `${Math.max(0, 100 - totalAsignado).toFixed(1)}%`, color: '#888' },
          { label: 'Participantes', value: parts.length.toString(), color: '#1A1A1A' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '16px 20px', flex: 1 }}>
            <p style={{ fontSize: 9, color: '#AAA', fontWeight: 300, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 200, color: k.color, letterSpacing: '-0.02em' }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Participation bar */}
      {parts.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '16px 24px' }}>
          <p style={{ fontSize: 9, color: '#AAA', fontWeight: 300, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Distribución del fondo</p>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
            {parts.map((p, i) => {
              const colors = ['#D85A30','#E6B820','#1D9E75','#378ADD','#C9A227','#8B5CF6']
              return (
                <div key={p.user_id} title={`${memberById[p.user_id] ? memberName(memberById[p.user_id]) : p.user_id}: ${p.porcentaje_participacion}%`}
                  style={{ width: `${p.porcentaje_participacion}%`, background: colors[i % colors.length], minWidth: 2 }} />
              )
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 10 }}>
            {parts.map((p, i) => {
              const colors = ['#D85A30','#E6B820','#1D9E75','#378ADD','#C9A227','#8B5CF6']
              const m = memberById[p.user_id]
              return (
                <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, background: colors[i % colors.length], borderRadius: 2 }} />
                  <p style={{ fontSize: 10, color: '#666', fontWeight: 300 }}>
                    {m ? memberName(m) : '—'} <span style={{ color: '#AAA' }}>{p.porcentaje_participacion}%</span>
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Form */}
      <div style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '24px 28px' }}>
        <p style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#BBB', fontWeight: 300, marginBottom: 20 }}>
          {editingUserId ? 'Editar participación' : 'Agregar participación'}
        </p>
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'end' }}>
          <div>
            <label style={labelSt}>Empleado</label>
            <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} required disabled={!!editingUserId} style={selectSt}>
              <option value="">Seleccionar…</option>
              {(editingUserId
                ? allMembers.filter(m => m.id === editingUserId)
                : unassigned
              ).map(m => (
                <option key={m.id} value={m.id}>{memberName(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelSt}>Participación (%)</label>
            <input type="number" value={form.porcentaje} onChange={e => setForm(f => ({ ...f, porcentaje: e.target.value }))}
              required min={0} max={100} step={0.1} style={inputSt} placeholder="15.0" />
          </div>
          <div>
            <label style={labelSt}>Fecha de inicio en el fondo</label>
            <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} required style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Notas</label>
            <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} style={inputSt} placeholder="Opcional…" />
          </div>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Guardando…' : (editingUserId ? 'Actualizar' : 'Agregar')}
            </button>
            {editingUserId && <button type="button" onClick={resetForm} style={btnGhost}>Cancelar</button>}
            {error && <p style={{ fontSize: 11, color: '#C04828', fontWeight: 300 }}>{error}</p>}
          </div>
        </form>
      </div>

      {/* Existing participations */}
      {parts.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #ECEAE6', overflow: 'hidden' }}>
          {parts.map((p, i) => {
            const m = memberById[p.user_id]
            return (
              <div key={p.user_id} style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 150px auto',
                gap: 16, alignItems: 'center',
                padding: '13px 24px',
                borderBottom: i < parts.length - 1 ? '1px solid #F0EEE8' : 'none',
              }}>
                <p style={{ fontSize: 13, color: '#333', fontWeight: 300 }}>
                  {m ? memberName(m) : p.user_id}
                </p>
                <p style={{ fontSize: 18, fontWeight: 200, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
                  {p.porcentaje_participacion}%
                </p>
                <p style={{ fontSize: 11, color: '#AAA', fontWeight: 300 }}>
                  Desde {new Date(p.fecha_inicio_participacion + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => startEdit(p)} style={btnGhost}>Editar</button>
                  <button onClick={() => handleDelete(p.user_id)} disabled={deletingId === p.user_id}
                    style={{ ...btnGhost, color: '#C04828', borderColor: '#F0D0C8' }}>
                    {deletingId === p.user_id ? '…' : '×'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Equipo tab ────────────────────────────────────────────────────────────────

const ROLE_LABELS_EQ: Record<string, string> = {
  fp_team: 'Team', fp_manager: 'Manager', fp_partner: 'Partner',
}
const ROLE_COLORS_EQ: Record<string, { bg: string; text: string; border: string }> = {
  fp_team:    { bg: '#1D9E7514', text: '#1D9E75', border: '#1D9E7530' },
  fp_manager: { bg: '#378ADD14', text: '#378ADD', border: '#378ADD30' },
  fp_partner: { bg: '#D85A3014', text: '#D85A30', border: '#D85A3030' },
}
const AVATAR_PALETTE = ['#D85A30','#E8913A','#C9A227','#E6B820','#B8860B','#D4622A','#F0A500','#C07020']

function mkInitialsEq(nombre: string, apellido?: string | null) {
  return [(nombre.trim()[0] ?? ''), (apellido?.trim()[0] ?? '')].join('').toUpperCase()
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function EquipoTab({ allMembers: initialMembers }: { allMembers: TeamMember[] }) {
  const [members,     setMembers]     = useState<TeamMember[]>(initialMembers)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [, startTransition]           = useTransition()

  // ── Edit form state ──
  const [editForm, setEditForm] = useState<Partial<TeamMember> & { newEmail?: string; newPassword?: string }>({})
  const [editMsg,  setEditMsg]  = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [saving,   setSaving]   = useState(false)

  // ── Add form state ──
  const [addForm,  setAddForm]  = useState({ nombre: '', apellido: '', email: '', password: '', rol: 'fp_team' as 'fp_team' | 'fp_manager' | 'fp_partner' })
  const [addMsg,   setAddMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [adding,   setAdding]   = useState(false)

  const openRow = (m: TeamMember) => {
    if (expandedId === m.id) { setExpandedId(null); return }
    setExpandedId(m.id)
    setEditForm({
      nombre:             m.nombre,
      apellido:           m.apellido ?? '',
      rol:                m.rol,
      telefono:           m.telefono ?? '',
      direccion:          m.direccion ?? '',
      fecha_nacimiento:   m.fecha_nacimiento ?? '',
      fecha_contratacion: m.fecha_contratacion ?? '',
      notas:              m.notas ?? '',
      salario_mensual:    m.salario_mensual ?? undefined,
      newEmail:           m.email,
      newPassword:        '',
    })
    setEditMsg(null)
  }

  const handleSave = async (m: TeamMember) => {
    setSaving(true); setEditMsg(null)

    // Update profile fields
    const res = await updateTeamMemberProfile(m.id, {
      nombre:             (editForm.nombre ?? '').trim() || undefined,
      apellido:           (editForm.apellido ?? '').trim() || undefined,
      rol:                editForm.rol,
      telefono:           (editForm.telefono ?? '').trim() || null,
      direccion:          (editForm.direccion ?? '').trim() || null,
      fecha_nacimiento:   editForm.fecha_nacimiento || null,
      fecha_contratacion: editForm.fecha_contratacion || null,
      notas:              (editForm.notas ?? '').trim() || null,
    })
    if ('error' in res) { setEditMsg({ type: 'err', text: res.error }); setSaving(false); return }

    // Update salary via finanzas action (also snapshots to salarios_historia)
    const nuevoSalario = editForm.salario_mensual != null
      ? Number(editForm.salario_mensual)
      : null
    if (nuevoSalario !== m.salario_mensual) {
      const res4 = await updateMemberCosts(m.id, { salario_mensual: nuevoSalario })
      if ('error' in res4) { setEditMsg({ type: 'err', text: res4.error }); setSaving(false); return }
    }

    // Update email if changed
    if (editForm.newEmail && editForm.newEmail !== m.email) {
      const res2 = await updateTeamMemberEmail(m.id, editForm.newEmail)
      if ('error' in res2) { setEditMsg({ type: 'err', text: res2.error }); setSaving(false); return }
    }

    // Update password if provided
    if (editForm.newPassword && editForm.newPassword.length >= 6) {
      const res3 = await resetTeamMemberPassword(m.id, editForm.newPassword)
      if ('error' in res3) { setEditMsg({ type: 'err', text: res3.error }); setSaving(false); return }
    }

    const updated: TeamMember = {
      ...m,
      nombre:             (editForm.nombre ?? m.nombre).trim(),
      apellido:           (editForm.apellido ?? '').trim() || null,
      rol:                editForm.rol ?? m.rol,
      telefono:           (editForm.telefono ?? '').trim() || null,
      direccion:          (editForm.direccion ?? '').trim() || null,
      fecha_nacimiento:   editForm.fecha_nacimiento || null,
      fecha_contratacion: editForm.fecha_contratacion || null,
      notas:              (editForm.notas ?? '').trim() || null,
      salario_mensual:    nuevoSalario,
      email:              editForm.newEmail ?? m.email,
    }
    setMembers(prev => prev.map(x => x.id === m.id ? updated : x))
    setEditMsg({ type: 'ok', text: 'Guardado correctamente.' })
    setSaving(false)
  }

  const handleBlock = async (m: TeamMember) => {
    if (!confirm(`¿${m.blocked ? 'Desbloquear' : 'Bloquear'} a ${m.nombre}?`)) return
    const res = m.blocked ? await unblockTeamMember(m.id) : await blockTeamMember(m.id)
    if ('error' in res) { setEditMsg({ type: 'err', text: res.error }); return }
    setMembers(prev => prev.map(x => x.id === m.id ? { ...x, blocked: !x.blocked } : x))
    setEditMsg({ type: 'ok', text: m.blocked ? 'Usuario desbloqueado.' : 'Usuario bloqueado.' })
  }

  const handleAdd = async () => {
    if (!addForm.nombre.trim() || !addForm.email.trim() || !addForm.password.trim()) {
      setAddMsg({ type: 'err', text: 'Nombre, email y contraseña son obligatorios.' }); return
    }
    setAdding(true); setAddMsg(null)
    const res = await createTeamMember(addForm)
    if ('error' in res) { setAddMsg({ type: 'err', text: res.error }); setAdding(false); return }
    setAddMsg({ type: 'ok', text: 'Miembro creado. Recarga para ver el cambio.' })
    setAdding(false)
    setShowAdd(false)
    setAddForm({ nombre: '', apellido: '', email: '', password: '', rol: 'fp_team' })
  }

  const ROL_ORDER: Record<string, number> = { fp_partner: 0, fp_manager: 1, fp_team: 2 }
  const sorted = [...members].sort((a, b) => (ROL_ORDER[a.rol] ?? 3) - (ROL_ORDER[b.rol] ?? 3) || a.nombre.localeCompare(b.nombre))

  const thSt: React.CSSProperties = {
    padding: '9px 14px', fontSize: 9, fontWeight: 300,
    letterSpacing: '0.14em', textTransform: 'uppercase', color: '#AAA',
    textAlign: 'left', borderBottom: '1px solid #ECEAE6', whiteSpace: 'nowrap',
  }
  const tdSt: React.CSSProperties = {
    padding: '12px 14px', fontSize: 12, color: '#333', fontWeight: 300,
    borderBottom: '1px solid #F5F3EF', verticalAlign: 'middle',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, color: '#AAA', fontWeight: 300 }}>
          {members.length} {members.length === 1 ? 'persona' : 'personas'} en el equipo
        </p>
        <button onClick={() => { setShowAdd(v => !v); setAddMsg(null) }} style={btnPrimary}>
          {showAdd ? 'Cancelar' : '+ Nuevo miembro'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '20px 24px' }}>
          <p style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#BBB', fontWeight: 300, marginBottom: 16 }}>
            Nuevo miembro
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            {[
              { key: 'nombre',   label: 'Nombre *',   ph: 'José' },
              { key: 'apellido', label: 'Apellido',    ph: 'Lora' },
              { key: 'email',    label: 'Email *',     ph: 'jose@formaprima.mx' },
              { key: 'password', label: 'Contraseña *', ph: '········', type: 'password' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelSt}>{f.label}</label>
                <input
                  type={f.type ?? 'text'}
                  value={(addForm as any)[f.key]}
                  onChange={e => setAddForm(v => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  style={inputSt}
                />
              </div>
            ))}
            <div>
              <label style={labelSt}>Rol</label>
              <select value={addForm.rol} onChange={e => setAddForm(v => ({ ...v, rol: e.target.value as any }))} style={selectSt}>
                <option value="fp_team">FP Team</option>
                <option value="fp_manager">FP Manager</option>
                <option value="fp_partner">FP Partner</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={handleAdd} disabled={adding} style={{ ...btnPrimary, opacity: adding ? 0.5 : 1 }}>
              {adding ? 'Creando…' : 'Crear miembro'}
            </button>
            {addMsg && (
              <p style={{ fontSize: 11, fontWeight: 300, color: addMsg.type === 'ok' ? '#1D9E75' : '#C04828' }}>
                {addMsg.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #ECEAE6', overflow: 'hidden' }} className="ap-table-wrap">
        <div className="ap-table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAF8' }}>
              <th style={thSt}>Nombre</th>
              <th style={thSt}>Email</th>
              <th style={thSt}>Rol</th>
              <th style={thSt}>Salario mensual</th>
              <th style={thSt}>Teléfono</th>
              <th style={thSt}>Contratación</th>
              <th style={thSt}>Estado</th>
              <th style={{ ...thSt, textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, idx) => {
              const rc = ROLE_COLORS_EQ[m.rol] ?? { bg: '#eee', text: '#888', border: '#ccc' }
              const isExpanded = expandedId === m.id
              return (
                <>
                  <tr
                    key={m.id}
                    onClick={() => openRow(m)}
                    style={{
                      cursor: 'pointer',
                      background: isExpanded ? '#FAFAF8' : '#fff',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Nombre + avatar */}
                    <td style={tdSt}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: m.avatar_url ? '#F0EEE8' : AVATAR_PALETTE[idx % AVATAR_PALETTE.length],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden',
                        }}>
                          {m.avatar_url
                            ? <img src={m.avatar_url} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>{mkInitialsEq(m.nombre, m.apellido)}</span>
                          }
                        </div>
                        <span style={{ fontWeight: 300 }}>
                          {m.nombre}{m.apellido ? ` ${m.apellido}` : ''}
                          {m.blocked && <span style={{ marginLeft: 6, fontSize: 10, color: '#C04828' }}>bloqueado</span>}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdSt, color: '#888' }}>{m.email}</td>
                    <td style={tdSt}>
                      <span style={{
                        fontSize: 9, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
                        padding: '2px 7px', background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`,
                      }}>
                        {ROLE_LABELS_EQ[m.rol] ?? m.rol}
                      </span>
                    </td>
                    <td style={{ ...tdSt, color: m.salario_mensual ? '#1A1A1A' : '#CCC' }}>
                      {m.salario_mensual != null
                        ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(m.salario_mensual)
                        : '—'}
                    </td>
                    <td style={{ ...tdSt, color: '#888' }}>{m.telefono ?? '—'}</td>
                    <td style={{ ...tdSt, color: '#888' }}>{fmtDate(m.fecha_contratacion)}</td>
                    <td style={tdSt}>
                      <span style={{
                        fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: m.blocked ? '#C04828' : '#1D9E75', fontWeight: 300,
                      }}>
                        {m.blocked ? 'Bloqueado' : 'Activo'}
                      </span>
                    </td>
                    <td style={{ ...tdSt, textAlign: 'right', color: '#CCC', fontSize: 10 }}>
                      {isExpanded ? '▴' : '▾'}
                    </td>
                  </tr>

                  {/* Expanded edit row */}
                  {isExpanded && (
                    <tr key={`${m.id}-edit`}>
                      <td colSpan={7} style={{ padding: '20px 24px', background: '#FAFAF8', borderBottom: '1px solid #ECEAE6' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }} className="ap-expand-grid">
                          {[
                            { key: 'nombre',            label: 'Nombre *' },
                            { key: 'apellido',           label: 'Apellido' },
                            { key: 'telefono',           label: 'Teléfono' },
                            { key: 'direccion',          label: 'Dirección' },
                            { key: 'fecha_nacimiento',   label: 'Fecha nacimiento', type: 'date' },
                            { key: 'fecha_contratacion', label: 'Fecha contratación', type: 'date' },
                            { key: 'newEmail',           label: 'Email' },
                            { key: 'newPassword',        label: 'Nueva contraseña', type: 'password', ph: 'Mín. 6 caracteres' },
                            { key: 'salario_mensual',    label: 'Salario mensual (costo empresa)', type: 'number', ph: '0' },
                          ].map(f => (
                            <div key={f.key}>
                              <label style={labelSt}>{f.label}</label>
                              <input
                                type={f.type ?? 'text'}
                                value={(editForm as any)[f.key] ?? ''}
                                onChange={e => setEditForm(v => ({ ...v, [f.key]: e.target.value }))}
                                placeholder={f.ph ?? ''}
                                style={inputSt}
                              />
                            </div>
                          ))}
                          <div>
                            <label style={labelSt}>Rol</label>
                            <select value={editForm.rol ?? m.rol} onChange={e => setEditForm(v => ({ ...v, rol: e.target.value }))} style={selectSt}>
                              <option value="fp_team">FP Team</option>
                              <option value="fp_manager">FP Manager</option>
                              <option value="fp_partner">FP Partner</option>
                            </select>
                          </div>
                          <div style={{ gridColumn: '2 / -1' }}>
                            <label style={labelSt}>Notas</label>
                            <input value={editForm.notas ?? ''} onChange={e => setEditForm(v => ({ ...v, notas: e.target.value }))} style={inputSt} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <button onClick={() => handleSave(m)} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
                            {saving ? 'Guardando…' : 'Guardar'}
                          </button>
                          <button onClick={() => handleBlock(m)}
                            style={{ ...btnGhost, color: m.blocked ? '#1D9E75' : '#C04828', borderColor: m.blocked ? '#1D9E7540' : '#F0D0C8' }}>
                            {m.blocked ? 'Desbloquear' : 'Bloquear'}
                          </button>
                          <button onClick={() => setExpandedId(null)} style={btnGhost}>Cerrar</button>
                          {editMsg && (
                            <p style={{ fontSize: 11, fontWeight: 300, color: editMsg.type === 'ok' ? '#1D9E75' : '#C04828' }}>
                              {editMsg.text}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'equipo',          label: 'Equipo'         },
  { id: 'nominas',         label: 'Nóminas'        },
  { id: 'fondo',           label: 'Fondo FP'       },
  { id: 'participaciones', label: 'Participaciones' },
] as const

type TabId = typeof TABS[number]['id']

export default function AdminPanel({ allMembers, allParticipaciones, allNominas, periodos }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('equipo')

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Section header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 9, color: '#CCC', fontWeight: 300, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
          Panel de administración
        </p>
        <p style={{ fontSize: 13, color: '#AAA', fontWeight: 300 }}>
          Gestión de equipo, nóminas, fondo de retención y participaciones.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ECEAE6', marginBottom: 24 }} className="ap-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: 'none', border: 'none',
              padding: '10px 20px 11px',
              fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
              fontWeight: 300, cursor: 'pointer',
              color: activeTab === t.id ? '#1A1A1A' : '#BBB',
              borderBottom: activeTab === t.id ? '2px solid #1A1A1A' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'equipo'          && <EquipoTab allMembers={allMembers as TeamMember[]} />}
      {activeTab === 'nominas'         && <NominasTab allMembers={allMembers} allNominas={allNominas} />}
      {activeTab === 'fondo'           && <FondoTab periodos={periodos} />}
      {activeTab === 'participaciones' && <ParticipacionesTab allMembers={allMembers} allParticipaciones={allParticipaciones} />}
    </div>
  )
}
