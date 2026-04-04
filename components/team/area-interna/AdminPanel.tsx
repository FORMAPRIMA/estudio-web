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
  uploadTeamMemberAvatar,
} from '@/app/actions/equipo'
import { updateMemberCosts } from '@/app/actions/finanzas'
import type { FondoPeriodo } from './FondoChart'
import FondoTimeline from './FondoTimeline'
import type { Proyecto as FondoProyecto } from './FondoTimeline'

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
  seniority:          string | null
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
  proyectos:         FondoProyecto[]
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
  const fileRef      = useRef<HTMLInputElement>(null)
  const [nominas,    setNominas]    = useState<NominaRecord[]>(allNominas)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingId,  setViewingId]  = useState<string | null>(null)

  // Upload form state — one form, shown per-card inline
  const [uploadForId, setUploadForId] = useState<string | null>(null)
  const [periodo,     setPeriodo]     = useState('')
  const [file,        setFile]        = useState<File | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [uploadMsg,   setUploadMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const uploadFileRef = useRef<HTMLInputElement>(null)

  const ROL_ORDER: Record<string, number> = { fp_partner: 0, fp_manager: 1, fp_team: 2 }
  const sortedMembers = [...allMembers].sort(
    (a, b) => (ROL_ORDER[a.rol] ?? 3) - (ROL_ORDER[b.rol] ?? 3) || a.nombre.localeCompare(b.nombre)
  )

  // Group by user_id, sorted by period descending
  const byUser: Record<string, NominaRecord[]> = {}
  for (const n of nominas) {
    if (!byUser[n.user_id]) byUser[n.user_id] = []
    byUser[n.user_id].push(n)
  }
  for (const uid of Object.keys(byUser)) {
    byUser[uid].sort((a, b) => b.periodo.localeCompare(a.periodo))
  }

  const openUpload = (userId: string) => {
    setUploadForId(userId); setPeriodo(''); setFile(null); setUploadMsg(null)
    if (uploadFileRef.current) uploadFileRef.current.value = ''
  }
  const closeUpload = () => { setUploadForId(null); setUploadMsg(null) }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadForId || !periodo || !file) return
    setLoading(true); setUploadMsg(null)
    const formData = new FormData()
    formData.append('userId',  uploadForId)
    formData.append('periodo', periodo)
    formData.append('file',    file)
    const res = await uploadNomina(formData)
    if ('error' in res) { setUploadMsg({ type: 'err', text: res.error ?? 'Error al subir' }); setLoading(false); return }
    setUploadMsg({ type: 'ok', text: 'Nómina subida.' })
    setLoading(false)
    // Optimistic: reload to get proper id/url from server
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

  // Hidden file input shared across all cards
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input ref={uploadFileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
        onChange={e => setFile(e.target.files?.[0] ?? null)} />

      {sortedMembers.map((m, idx) => {
        const memberNominas = byUser[m.id] ?? []
        const rc = ROLE_COLORS_EQ[m.rol] ?? { bg: '#eee', text: '#888', border: '#ccc' }
        const isUploading = uploadForId === m.id

        return (
          <div key={m.id} style={{ background: '#fff', border: '1px solid #ECEAE6', borderRadius: 4 }}>
            {/* Card header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 24px', borderBottom: memberNominas.length > 0 || isUploading ? '1px solid #F5F3EF' : 'none',
              gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                  background: m.avatar_url ? '#F0EEE8' : AVATAR_PALETTE[idx % AVATAR_PALETTE.length],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {m.avatar_url
                    ? <img src={m.avatar_url} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{mkInitialsEq(m.nombre, m.apellido)}</span>
                  }
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 300, color: '#1A1A1A', margin: 0 }}>
                    {memberName(m)}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <span style={{
                      fontSize: 8, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
                      padding: '1px 6px', background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`,
                    }}>
                      {ROLE_LABELS_EQ[m.rol] ?? m.rol}
                    </span>
                    {memberNominas.length > 0 && (
                      <span style={{ fontSize: 10, color: '#BBB', fontWeight: 300 }}>
                        {memberNominas.length} nómina{memberNominas.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => isUploading ? closeUpload() : openUpload(m.id)}
                style={{
                  ...btnGhost,
                  color: isUploading ? '#AAA' : '#1A1A1A',
                  borderColor: isUploading ? '#E8E6E0' : '#1A1A1A',
                  fontSize: 9, padding: '6px 14px',
                }}
              >
                {isUploading ? 'Cancelar' : '+ Subir nómina'}
              </button>
            </div>

            {/* Upload form (inline per card) */}
            {isUploading && (
              <form onSubmit={handleUpload} style={{ padding: '16px 24px', borderBottom: memberNominas.length > 0 ? '1px solid #F5F3EF' : 'none', background: '#FAFAF8' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }} className="ap-nominas-form">
                  <div>
                    <label style={labelSt}>Período (mes)</label>
                    <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} required style={{ ...inputSt, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={labelSt}>Archivo PDF</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => uploadFileRef.current?.click()}
                        style={{ ...btnGhost, whiteSpace: 'nowrap', fontSize: 9, padding: '8px 14px' }}
                      >
                        {file ? '✓ ' + file.name.slice(0, 24) + (file.name.length > 24 ? '…' : '') : 'Elegir PDF'}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading || !periodo || !file}
                    style={{ ...btnPrimary, opacity: loading || !periodo || !file ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                    {loading ? 'Subiendo…' : 'Subir'}
                  </button>
                </div>
                {uploadMsg && (
                  <p style={{ fontSize: 11, color: uploadMsg.type === 'ok' ? '#1D9E75' : '#C04828', fontWeight: 300, marginTop: 10 }}>
                    {uploadMsg.text}
                  </p>
                )}
              </form>
            )}

            {/* Nóminas list */}
            {memberNominas.length > 0 ? (
              <div>
                {memberNominas.map((n, ni) => (
                  <div key={n.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 24px',
                    borderBottom: ni < memberNominas.length - 1 ? '1px solid #F5F3EF' : 'none',
                    gap: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                        {n.periodo}
                      </span>
                      <span style={{ fontSize: 13, color: '#333', fontWeight: 300 }}>
                        {fmtPeriodo(n.periodo)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => openNomina(n)} disabled={viewingId === n.id}
                        style={{ ...btnGhost, fontSize: 9, padding: '5px 14px' }}>
                        {viewingId === n.id ? '…' : 'Ver PDF'}
                      </button>
                      <button onClick={() => handleDelete(n.id)} disabled={deletingId === n.id}
                        style={{ ...btnGhost, fontSize: 9, padding: '5px 14px', color: '#C04828', borderColor: '#F0D0C8' }}>
                        {deletingId === n.id ? '…' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !isUploading ? (
              <div style={{ padding: '20px 24px' }}>
                <p style={{ fontSize: 12, color: '#CCC', fontWeight: 300 }}>Sin nóminas subidas</p>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// ── Fondo tab ─────────────────────────────────────────────────────────────────

function FondoTab({ periodos, participaciones, allMembers, proyectos }: {
  periodos:          FondoPeriodo[]
  participaciones:   Participacion[]
  allMembers:        TeamMember[]
  proyectos:         FondoProyecto[]
}) {
  return (
    <FondoTimeline
      proyectos={proyectos}
      participaciones={participaciones}
      isPartner={true}
      allMembers={allMembers.map(m => ({
        id:        m.id,
        nombre:    m.nombre,
        apellido:  m.apellido,
        avatar_url: m.avatar_url,
        rol:       m.rol,
      }))}
    />
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

const SENIORITY_OPTIONS = [
  { value: 'junior', label: 'Junior',      rate: 60  },
  { value: 'semi',   label: 'Semi-senior', rate: 100 },
  { value: 'senior', label: 'Senior',      rate: 100 },
  { value: 'lead',   label: 'Lead',        rate: 150 },
  { value: 'socio',  label: 'Socio/a',     rate: 150 },
]

function seniorityRate(s: string | null): number | null {
  if (!s) return null
  return SENIORITY_OPTIONS.find(o => o.value === s)?.rate ?? null
}

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

  // ── Avatar upload ──
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarForId,  setAvatarForId]  = useState<string | null>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !avatarForId) return
    setAvatarLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await uploadTeamMemberAvatar(avatarForId, formData)
    if ('error' in res) { setEditMsg({ type: 'err', text: res.error }); setAvatarLoading(false); return }
    setMembers(prev => prev.map(x => x.id === avatarForId ? { ...x, avatar_url: res.url } : x))
    setAvatarLoading(false)
    setAvatarForId(null)
    e.target.value = ''
  }

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
      seniority:          m.seniority ?? '',
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

    // Update salary + seniority via finanzas action (also snapshots salary to historia)
    const nuevoSalario  = editForm.salario_mensual != null ? Number(editForm.salario_mensual) : null
    const nuevoSeniority = (editForm.seniority as string | undefined)?.trim() || null
    if (nuevoSalario !== m.salario_mensual || nuevoSeniority !== m.seniority) {
      const res4 = await updateMemberCosts(m.id, { salario_mensual: nuevoSalario, seniority: nuevoSeniority })
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
      seniority:          nuevoSeniority,
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

      {/* Hidden avatar file input */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarUpload}
      />

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #ECEAE6' }} className="ap-table-wrap">
        <div className="ap-table-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAF8' }}>
              <th style={thSt}>Nombre</th>
              <th style={thSt}>Email</th>
              <th style={thSt}>Rol</th>
              <th style={thSt}>Seniority</th>
              <th style={{ ...thSt, textAlign: 'right' }}>€/h</th>
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
                    <td style={tdSt}>
                      {m.seniority
                        ? <span style={{ fontSize: 11, color: '#555', fontWeight: 300 }}>
                            {SENIORITY_OPTIONS.find(o => o.value === m.seniority)?.label ?? m.seniority}
                          </span>
                        : <span style={{ color: '#CCC' }}>—</span>
                      }
                    </td>
                    <td style={{ ...tdSt, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {seniorityRate(m.seniority) != null
                        ? <span style={{ fontSize: 12, color: '#1A1A1A', fontWeight: 400 }}>€{seniorityRate(m.seniority)}</span>
                        : <span style={{ color: '#CCC' }}>—</span>
                      }
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
                      <td colSpan={10} style={{ padding: '20px 24px', background: '#FAFAF8', borderBottom: '1px solid #ECEAE6' }}>
                        {/* Avatar upload */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                          <div
                            onClick={() => { setAvatarForId(m.id); setTimeout(() => avatarInputRef.current?.click(), 0) }}
                            style={{ position: 'relative', width: 52, height: 52, borderRadius: '50%', cursor: 'pointer', flexShrink: 0, overflow: 'hidden', background: AVATAR_PALETTE[idx % AVATAR_PALETTE.length] }}
                            title="Cambiar foto"
                          >
                            {m.avatar_url
                              ? <img src={m.avatar_url} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: 16, color: '#fff', fontWeight: 600 }}>{mkInitialsEq(m.nombre, m.apellido)}</span>
                                </div>
                            }
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.38)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
                            >
                              <span style={{ color: '#fff', fontSize: 16, opacity: 0 }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0' }}
                              >✎</span>
                            </div>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, color: '#888', fontWeight: 300, margin: 0 }}>
                              {avatarLoading && avatarForId === m.id ? 'Subiendo foto…' : 'Haz clic en el avatar para cambiar la foto'}
                            </p>
                            <p style={{ fontSize: 10, color: '#CCC', fontWeight: 300, margin: '2px 0 0' }}>JPG, PNG · máx 5 MB</p>
                          </div>
                        </div>
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
                          <div>
                            <label style={labelSt}>Seniority</label>
                            <select
                              value={(editForm.seniority as string) ?? ''}
                              onChange={e => setEditForm(v => ({ ...v, seniority: e.target.value }))}
                              style={selectSt}
                            >
                              <option value="">Sin asignar</option>
                              {SENIORITY_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={labelSt}>Precio hora comercial</label>
                            <div style={{
                              ...inputSt, background: '#F5F3EF', color: '#888',
                              display: 'flex', alignItems: 'center', gap: 6, cursor: 'default',
                            }}>
                              {seniorityRate((editForm.seniority as string) || null) != null
                                ? <>
                                    <span style={{ fontSize: 14, fontWeight: 400, color: '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>
                                      €{seniorityRate((editForm.seniority as string) || null)}
                                    </span>
                                    <span style={{ fontSize: 10, color: '#AAA' }}>/hora</span>
                                  </>
                                : <span style={{ color: '#CCC', fontSize: 12 }}>Selecciona un seniority</span>
                              }
                            </div>
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

export default function AdminPanel({ allMembers, allParticipaciones, allNominas, periodos, proyectos }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('equipo')

  return (
    <div>
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
      {activeTab === 'fondo'           && <FondoTab periodos={periodos} participaciones={allParticipaciones} allMembers={allMembers} proyectos={proyectos} />}
      {activeTab === 'participaciones' && <ParticipacionesTab allMembers={allMembers} allParticipaciones={allParticipaciones} />}
    </div>
  )
}
