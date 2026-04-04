'use client'

import { useState, useTransition } from 'react'
import {
  createTeamMember,
  blockTeamMember,
  unblockTeamMember,
  updateTeamMemberProfile,
  updateTeamMemberEmail,
  resetTeamMemberPassword,
} from '@/app/actions/equipo'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TeamMemberFull {
  id: string
  nombre: string
  apellido: string | null
  email: string
  rol: 'fp_team' | 'fp_manager' | 'fp_partner'
  avatar_url: string | null
  telefono: string | null
  direccion: string | null
  fecha_nacimiento: string | null
  fecha_contratacion: string | null
  notas: string | null
  blocked: boolean
}

interface Props {
  initialMembers: TeamMemberFull[]
  currentUserId: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  fp_team: 'Team',
  fp_manager: 'Manager',
  fp_partner: 'Partner',
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  fp_team:    { bg: '#1D9E7514', text: '#1D9E75', border: '#1D9E7530' },
  fp_manager: { bg: '#378ADD14', text: '#378ADD', border: '#378ADD30' },
  fp_partner: { bg: '#D85A3014', text: '#D85A30', border: '#D85A3030' },
}

const AVATAR_COLORS = ['#D85A30','#E8913A','#C9A227','#E6B820','#B8860B','#D4622A','#F0A500','#C07020']

const mkInitials = (nombre: string, apellido?: string | null) => {
  const first = nombre.trim()[0]?.toUpperCase() ?? ''
  const last = (apellido ?? '').trim()[0]?.toUpperCase() ?? ''
  return first + last || first
}

const fmtDate = (d: string | null) => {
  if (!d) return '—'
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

const fmtBirthday = (d: string | null) => {
  if (!d) return '—'
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Avatar({ member, size = 44, idx }: { member: TeamMemberFull; size?: number; idx: number }) {
  const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
  const initials = mkInitials(member.nombre, member.apellido)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', position: 'relative',
    }}>
      {member.avatar_url
        ? <img src={member.avatar_url} alt={member.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ color: '#fff', fontSize: size * 0.33, fontWeight: 700, letterSpacing: '0.01em' }}>{initials}</span>
      }
      {member.blocked && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: size * 0.35 }}>🚫</span>
        </div>
      )}
    </div>
  )
}

function RoleBadge({ rol }: { rol: string }) {
  const c = ROLE_COLORS[rol] ?? { bg: '#eee', text: '#888', border: '#ccc' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 3, background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {ROLE_LABELS[rol] ?? rol}
    </span>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AAA' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #E0DED8', borderRadius: 4, padding: '7px 10px',
  fontSize: 13, color: '#222', background: '#fff', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const btnPrimary: React.CSSProperties = {
  background: '#222', color: '#fff', border: 'none', borderRadius: 4,
  padding: '8px 18px', fontSize: 12, cursor: 'pointer', fontWeight: 500,
  letterSpacing: '0.02em', fontFamily: 'inherit',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent', color: '#555', border: '1px solid #DDD',
  borderRadius: 4, padding: '8px 18px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function EquipoPage({ initialMembers, currentUserId }: Props) {
  const [members, setMembers] = useState<TeamMemberFull[]>(initialMembers)
  const [selected, setSelected] = useState<TeamMemberFull | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()

  // ── Add modal state ──
  const [addForm, setAddForm] = useState({ nombre: '', apellido: '', email: '', password: '', rol: 'fp_team' as TeamMemberFull['rol'] })
  const [addError, setAddError] = useState('')

  // ── Detail panel state ──
  const [editForm, setEditForm] = useState<Partial<TeamMemberFull>>({})
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const [blockConfirm, setBlockConfirm] = useState(false)

  const openMember = (m: TeamMemberFull) => {
    setSelected(m)
    setEditForm({
      nombre: m.nombre,
      apellido: m.apellido ?? '',
      rol: m.rol,
      telefono: m.telefono ?? '',
      direccion: m.direccion ?? '',
      fecha_nacimiento: m.fecha_nacimiento ?? '',
      fecha_contratacion: m.fecha_contratacion ?? '',
      notas: m.notas ?? '',
    })
    setSaveError('')
    setSaveOk(false)
    setNewPassword('')
    setPwdMsg('')
    setNewEmail('')
    setEmailMsg('')
    setBlockConfirm(false)
  }

  const closePanel = () => { setSelected(null); setBlockConfirm(false) }

  // ── Actions ──

  const handleAdd = () => {
    setAddError('')
    if (!addForm.nombre.trim() || !addForm.email.trim() || !addForm.password.trim()) {
      setAddError('Nombre, email y contraseña son obligatorios.')
      return
    }
    startTransition(async () => {
      const res = await createTeamMember(addForm)
      if ('error' in res) { setAddError(res.error); return }
      // Optimistic: add placeholder, page will revalidate
      setShowAdd(false)
      setAddForm({ nombre: '', apellido: '', email: '', password: '', rol: 'fp_team' })
    })
  }

  const handleSave = () => {
    if (!selected) return
    setSaveError(''); setSaveOk(false)
    startTransition(async () => {
      const res = await updateTeamMemberProfile(selected.id, {
        nombre: (editForm.nombre ?? '').trim() || undefined,
        apellido: (editForm.apellido ?? '').trim() || undefined,
        rol: editForm.rol,
        telefono: (editForm.telefono ?? '').trim() || null,
        direccion: (editForm.direccion ?? '').trim() || null,
        fecha_nacimiento: editForm.fecha_nacimiento || null,
        fecha_contratacion: editForm.fecha_contratacion || null,
        notas: (editForm.notas ?? '').trim() || null,
      })
      if ('error' in res) { setSaveError(res.error); return }
      const updated: TeamMemberFull = { ...selected, ...editForm as TeamMemberFull }
      setSelected(updated)
      setMembers((prev) => prev.map((m) => m.id === selected.id ? updated : m))
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2500)
    })
  }

  const handlePasswordReset = () => {
    if (!selected || newPassword.length < 6) { setPwdMsg('Mínimo 6 caracteres.'); return }
    setPwdMsg('')
    startTransition(async () => {
      const res = await resetTeamMemberPassword(selected.id, newPassword)
      if ('error' in res) { setPwdMsg(res.error); return }
      setNewPassword('')
      setPwdMsg('✓ Contraseña actualizada.')
      setTimeout(() => setPwdMsg(''), 3000)
    })
  }

  const handleEmailUpdate = () => {
    if (!selected || !newEmail.trim()) { setEmailMsg('Introduce un email válido.'); return }
    setEmailMsg('')
    startTransition(async () => {
      const res = await updateTeamMemberEmail(selected.id, newEmail.trim())
      if ('error' in res) { setEmailMsg(res.error); return }
      const updated = { ...selected, email: newEmail.trim() }
      setSelected(updated)
      setMembers((prev) => prev.map((m) => m.id === selected.id ? updated : m))
      setNewEmail('')
      setEmailMsg('✓ Email actualizado.')
      setTimeout(() => setEmailMsg(''), 3000)
    })
  }

  const handleBlock = () => {
    if (!selected) return
    startTransition(async () => {
      const res = await blockTeamMember(selected.id)
      if ('error' in res) { setSaveError(res.error); return }
      const updated = { ...selected, blocked: true }
      setSelected(updated)
      setMembers((prev) => prev.map((m) => m.id === selected.id ? updated : m))
      setBlockConfirm(false)
    })
  }

  const handleUnblock = () => {
    if (!selected) return
    startTransition(async () => {
      const res = await unblockTeamMember(selected.id)
      if ('error' in res) { setSaveError(res.error); return }
      const updated = { ...selected, blocked: false }
      setSelected(updated)
      setMembers((prev) => prev.map((m) => m.id === selected.id ? updated : m))
    })
  }

  const selectedIdx = selected ? members.findIndex((m) => m.id === selected.id) : 0

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#F8F7F4', color: '#222' }}>

      {/* Header */}
      <div style={{ padding: '40px 40px 0' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 6, fontWeight: 600 }}>
          Área interna
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 200, color: '#1A1A1A', margin: 0, letterSpacing: '-0.01em' }}>Equipo</h1>
            <p style={{ fontSize: 13, color: '#AAA', margin: '4px 0 0', fontWeight: 300 }}>
              {members.length} {members.length === 1 ? 'miembro' : 'miembros'} · {members.filter(m => m.blocked).length} bloqueado{members.filter(m => m.blocked).length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setAddError('') }}
            style={btnPrimary}
          >
            + Añadir miembro
          </button>
        </div>
      </div>

      {/* Members grid — grouped by role */}
      <div style={{ padding: '0 40px 60px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {(['fp_partner', 'fp_manager', 'fp_team'] as const)
          .map((rol) => ({ rol, group: members.filter((m) => m.rol === rol) }))
          .filter(({ group }) => group.length > 0)
          .map(({ rol, group }) => (
            <div key={rol}>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#BBB', marginBottom: 12 }}>
                {ROLE_LABELS[rol]}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {group.map((m) => {
                  const idx = members.findIndex((x) => x.id === m.id)
                  return (
          <div
            key={m.id}
            onClick={() => openMember(m)}
            style={{
              background: '#fff', border: '1px solid #E8E6E0', borderRadius: 6,
              padding: '20px 20px 16px', cursor: 'pointer',
              opacity: m.blocked ? 0.6 : 1,
              transition: 'box-shadow 0.15s, opacity 0.15s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
              <Avatar member={m} size={44} idx={idx} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.nombre}{m.apellido ? ` ${m.apellido}` : ''}
                </div>
                <div style={{ fontSize: 11, color: '#AAA', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.email}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <RoleBadge rol={m.rol} />
              {m.blocked
                ? <span style={{ fontSize: 10, color: '#D85A30', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Bloqueado</span>
                : m.fecha_contratacion
                ? <span style={{ fontSize: 10, color: '#CCC' }}>desde {new Date(m.fecha_contratacion + 'T12:00:00').getFullYear()}</span>
                : null
              }
            </div>
          </div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>

      {/* ── Add member modal ── */}
      {showAdd && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }} onClick={() => setShowAdd(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: '#fff', borderRadius: 8, padding: 32, width: '90%', maxWidth: 480,
            zIndex: 101, boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 4, fontWeight: 600 }}>Nuevo miembro</p>
                <h2 style={{ fontSize: 20, fontWeight: 300, margin: 0, color: '#1A1A1A' }}>Añadir al equipo</h2>
              </div>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#AAA' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FieldRow label="Nombre *">
                  <input style={inputStyle} value={addForm.nombre} onChange={(e) => setAddForm(f => ({ ...f, nombre: e.target.value }))} placeholder="José" />
                </FieldRow>
                <FieldRow label="Apellido">
                  <input style={inputStyle} value={addForm.apellido} onChange={(e) => setAddForm(f => ({ ...f, apellido: e.target.value }))} placeholder="López" />
                </FieldRow>
              </div>
              <FieldRow label="Email *">
                <input style={inputStyle} type="email" value={addForm.email} onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="jose@formaprima.com" />
              </FieldRow>
              <FieldRow label="Contraseña temporal *">
                <input style={inputStyle} type="password" value={addForm.password} onChange={(e) => setAddForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
              </FieldRow>
              <FieldRow label="Rol">
                <select style={inputStyle} value={addForm.rol} onChange={(e) => setAddForm(f => ({ ...f, rol: e.target.value as TeamMemberFull['rol'] }))}>
                  <option value="fp_team">Team</option>
                  <option value="fp_manager">Manager</option>
                  <option value="fp_partner">Partner</option>
                </select>
              </FieldRow>
            </div>

            {addError && <p style={{ fontSize: 12, color: '#D85A30', marginTop: 12 }}>{addError}</p>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button style={btnGhost} onClick={() => setShowAdd(false)}>Cancelar</button>
              <button style={btnPrimary} onClick={handleAdd} disabled={isPending}>
                {isPending ? 'Creando...' : 'Crear miembro'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Detail slide-over panel ── */}
      {selected && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 200 }} onClick={closePanel} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 480,
            background: '#FAFAF8', zIndex: 201, overflowY: 'auto',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column',
          }}>

            {/* Panel header */}
            <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid #E8E6E0', background: '#fff', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Avatar member={selected} size={52} idx={selectedIdx} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.2 }}>
                    {selected.nombre}{selected.apellido ? ` ${selected.apellido}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#AAA', marginTop: 3 }}>{selected.email}</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <RoleBadge rol={selected.rol} />
                    {selected.blocked && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#D85A30', letterSpacing: '0.06em', textTransform: 'uppercase' }}>● Bloqueado</span>
                    )}
                    {selected.id === currentUserId && (
                      <span style={{ fontSize: 10, color: '#AAA', letterSpacing: '0.04em' }}>· Tú</span>
                    )}
                  </div>
                </div>
                <button onClick={closePanel} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#AAA', flexShrink: 0, lineHeight: 1 }}>×</button>
              </div>
            </div>

            {/* Panel body */}
            <div style={{ padding: '24px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>

              {/* Identidad */}
              <section>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 14 }}>Identidad</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <FieldRow label="Nombre">
                      <input style={inputStyle} value={editForm.nombre ?? ''} onChange={(e) => setEditForm(f => ({ ...f, nombre: e.target.value }))} />
                    </FieldRow>
                    <FieldRow label="Apellido">
                      <input style={inputStyle} value={editForm.apellido ?? ''} onChange={(e) => setEditForm(f => ({ ...f, apellido: e.target.value }))} />
                    </FieldRow>
                  </div>
                  <FieldRow label="Rol">
                    <select style={inputStyle} value={editForm.rol ?? selected.rol} onChange={(e) => setEditForm(f => ({ ...f, rol: e.target.value as TeamMemberFull['rol'] }))}>
                      <option value="fp_team">Team</option>
                      <option value="fp_manager">Manager</option>
                      <option value="fp_partner">Partner</option>
                    </select>
                  </FieldRow>
                  <FieldRow label="Email">
                    <input style={{ ...inputStyle, background: '#F8F7F4', color: '#AAA' }} value={selected.email} readOnly />
                    <span style={{ fontSize: 10, color: '#BBB', marginTop: 2 }}>Para cambiar el email usa la sección de acceso más abajo</span>
                  </FieldRow>
                </div>
              </section>

              {/* Contacto */}
              <section>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 14 }}>Contacto</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <FieldRow label="Teléfono">
                    <input style={inputStyle} value={editForm.telefono ?? ''} onChange={(e) => setEditForm(f => ({ ...f, telefono: e.target.value }))} placeholder="+34 600 000 000" />
                  </FieldRow>
                  <FieldRow label="Dirección">
                    <input style={inputStyle} value={editForm.direccion ?? ''} onChange={(e) => setEditForm(f => ({ ...f, direccion: e.target.value }))} placeholder="Calle, ciudad, código postal" />
                  </FieldRow>
                </div>
              </section>

              {/* Fechas */}
              <section>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 14 }}>Fechas</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FieldRow label="Cumpleaños">
                    <input style={inputStyle} type="date" value={editForm.fecha_nacimiento ?? ''} onChange={(e) => setEditForm(f => ({ ...f, fecha_nacimiento: e.target.value }))} />
                  </FieldRow>
                  <FieldRow label="Contratación">
                    <input style={inputStyle} type="date" value={editForm.fecha_contratacion ?? ''} onChange={(e) => setEditForm(f => ({ ...f, fecha_contratacion: e.target.value }))} />
                  </FieldRow>
                </div>
                {selected.fecha_nacimiento && (
                  <p style={{ fontSize: 11, color: '#AAA', marginTop: 8 }}>
                    🎂 {fmtBirthday(selected.fecha_nacimiento)} · 💼 en el equipo desde {fmtDate(selected.fecha_contratacion)}
                  </p>
                )}
              </section>

              {/* Notas */}
              <section>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 14 }}>Notas internas</p>
                <textarea
                  style={{ ...inputStyle, height: 90, resize: 'vertical' }}
                  value={editForm.notas ?? ''}
                  onChange={(e) => setEditForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Información relevante sobre este miembro (solo visible para partners)..."
                />
              </section>

              {/* Save */}
              <div>
                {saveError && <p style={{ fontSize: 12, color: '#D85A30', marginBottom: 8 }}>{saveError}</p>}
                {saveOk && <p style={{ fontSize: 12, color: '#1D9E75', marginBottom: 8 }}>✓ Cambios guardados.</p>}
                <button style={btnPrimary} onClick={handleSave} disabled={isPending}>
                  {isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E8E6E0' }} />

              {/* Email */}
              <section>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 14 }}>Cambiar email</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={selected.email}
                  />
                  <button style={{ ...btnPrimary, whiteSpace: 'nowrap' }} onClick={handleEmailUpdate} disabled={isPending}>
                    Actualizar
                  </button>
                </div>
                {emailMsg && (
                  <p style={{ fontSize: 12, marginTop: 8, color: emailMsg.startsWith('✓') ? '#1D9E75' : '#D85A30' }}>{emailMsg}</p>
                )}
              </section>

              {/* Contraseña */}
              <section>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 14 }}>Restablecer contraseña</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nueva contraseña..."
                  />
                  <button style={{ ...btnPrimary, whiteSpace: 'nowrap' }} onClick={handlePasswordReset} disabled={isPending}>
                    Establecer
                  </button>
                </div>
                {pwdMsg && (
                  <p style={{ fontSize: 12, marginTop: 8, color: pwdMsg.startsWith('✓') ? '#1D9E75' : '#D85A30' }}>{pwdMsg}</p>
                )}
              </section>

              <hr style={{ border: 'none', borderTop: '1px solid #E8E6E0' }} />

              {/* Bloqueo */}
              {selected.id !== currentUserId && (
                <section style={{ paddingBottom: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAA', marginBottom: 14 }}>Control de acceso</p>
                  {selected.blocked ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                        Este miembro está bloqueado y no puede iniciar sesión.
                      </p>
                      <button
                        style={{ ...btnPrimary, background: '#1D9E75', alignSelf: 'flex-start' }}
                        onClick={handleUnblock}
                        disabled={isPending}
                      >
                        {isPending ? 'Desbloqueando...' : '✓ Restaurar acceso'}
                      </button>
                    </div>
                  ) : !blockConfirm ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                        Bloquear el acceso impide que el usuario inicie sesión inmediatamente. Sus datos se conservan íntegros.
                      </p>
                      <button
                        style={{ ...btnGhost, borderColor: '#D85A30', color: '#D85A30', alignSelf: 'flex-start' }}
                        onClick={() => setBlockConfirm(true)}
                      >
                        Bloquear acceso
                      </button>
                    </div>
                  ) : (
                    <div style={{ background: '#FFF5F5', border: '1px solid #D85A3030', borderRadius: 6, padding: 16 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#D85A30', marginBottom: 6 }}>¿Confirmar bloqueo?</p>
                      <p style={{ fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 1.6 }}>
                        {selected.nombre} perderá el acceso de forma inmediata.
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={btnGhost} onClick={() => setBlockConfirm(false)}>Cancelar</button>
                        <button
                          style={{ ...btnPrimary, background: '#D85A30' }}
                          onClick={handleBlock}
                          disabled={isPending}
                        >
                          {isPending ? 'Bloqueando...' : 'Sí, bloquear'}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
