'use client'

import { useState, useEffect } from 'react'
import ReauthGate, { checkAuthCache, setAuthCache } from './ReauthGate'
import PersonalDashboard, { type CurrentUser, type Nomina, type Participacion } from './PersonalDashboard'
import AdminPanel from './AdminPanel'
import type { FondoPeriodo } from './FondoChart'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FondoProyecto {
  id:               string
  fondo_id:         string
  nombre:           string
  descripcion:      string | null
  monto_invertido:  number
  fecha_inversion:  string
  monto_retornado:  number | null
  fecha_retorno:    string | null
}

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
  id:         string
  user_id:    string
  periodo:    string
  pdf_path:   string
  pdf_url:    string
  created_at: string
  profiles?:  { nombre: string; apellido: string | null; rol: string } | null
}

interface Participacion2 {
  id:                         string
  user_id:                    string
  porcentaje_participacion:   number
  fecha_inicio_participacion: string
  notas:                      string | null
  profiles?: { nombre: string; apellido: string | null; email: string; rol: string } | null
}

interface Props {
  currentUser:          CurrentUser
  initialNominas:       Nomina[]
  initialPeriodos:      FondoPeriodo[]
  initialParticipacion: Participacion | null
  allMembers:           TeamMember[]
  allParticipaciones:   Participacion2[]
  allNominas:           NominaRecord[]
  allProyectos:         FondoProyecto[]
}

// ── Role labels & colors ──────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  fp_team:    'FP Team',
  fp_manager: 'FP Manager',
  fp_partner: 'FP Partner',
}

const ROLE_COLORS: Record<string, string> = {
  fp_team:    '#1D9E75',
  fp_manager: '#378ADD',
  fp_partner: '#D85A30',
}

const AVATAR_COLORS = ['#D85A30','#E8913A','#C9A227','#E6B820','#B8860B','#D4622A','#F0A500','#C07020']

// ── Component ─────────────────────────────────────────────────────────────────

export default function AreaInternaPage({
  currentUser,
  initialNominas,
  initialPeriodos,
  initialParticipacion,
  allMembers,
  allParticipaciones,
  allNominas,
  allProyectos,
}: Props) {
  const [authed,    setAuthed]    = useState(false)
  const [ready,     setReady]     = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard')

  useEffect(() => {
    if (checkAuthCache(currentUser.id)) setAuthed(true)
    setReady(true)
  }, [currentUser.id])

  if (!ready) return null

  if (!authed) {
    return (
      <ReauthGate
        userEmail={currentUser.email}
        userId={currentUser.id}
        onVerified={() => { setAuthCache(currentUser.id); setAuthed(true) }}
      />
    )
  }

  const isPartner = currentUser.rol === 'fp_partner'
  const roleColor = ROLE_COLORS[currentUser.rol] ?? '#888'
  const initials  = [currentUser.nombre, currentUser.apellido]
    .filter(Boolean).map(s => s![0].toUpperCase()).join('')

  return (
    <div style={{ minHeight: '100vh', background: '#F2F2F0' }} className="ai-page">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #ECEAE6',
        padding: '0 32px',
        position: 'sticky', top: 0, zIndex: 10,
      }} className="ai-header">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: 64,
        }} className="ai-header-inner">
          {/* Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} className="ai-identity">
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: roleColor, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
            }}>
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt={currentUser.nombre}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{initials}</span>
              )}
            </div>
            <div>
              <p style={{
                fontSize: 16, fontWeight: 300, color: '#1A1A1A',
                letterSpacing: '-0.01em', lineHeight: 1.2,
              }}>
                {currentUser.nombre}{currentUser.apellido ? ` ${currentUser.apellido}` : ''}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{
                  fontSize: 9, fontWeight: 500, letterSpacing: '0.08em',
                  textTransform: 'uppercase', padding: '2px 7px', borderRadius: 2,
                  background: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}30`,
                }}>
                  {ROLE_LABELS[currentUser.rol] ?? currentUser.rol}
                </span>
                <span style={{ fontSize: 9, color: '#CCC' }}>·</span>
                <span style={{ fontSize: 9, color: '#AAA', fontWeight: 300, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Área Interna FP
                </span>
              </div>
            </div>
          </div>

          {/* Tab toggle (partner only) */}
          {isPartner && (
            <div style={{ display: 'flex', border: '1px solid #ECEAE6', overflow: 'hidden' }} className="ai-tabs">
              {(['dashboard', 'admin'] as const).map((t, i) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    background: activeTab === t ? '#1A1A1A' : '#fff',
                    color:      activeTab === t ? '#fff'    : '#888',
                    border:     'none',
                    borderRight: i === 0 ? '1px solid #ECEAE6' : 'none',
                    padding:    '8px 22px',
                    fontSize:   10, letterSpacing: '0.12em',
                    textTransform: 'uppercase', fontWeight: 300,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {t === 'dashboard' ? 'Mi Dashboard' : 'Administración'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '32px' }} className="ai-content">
        {activeTab === 'dashboard' ? (
          <PersonalDashboard
            currentUser={currentUser}
            initialNominas={initialNominas}
            initialPeriodos={initialPeriodos}
            initialParticipacion={initialParticipacion}
            allParticipaciones={allParticipaciones as any}
            allProyectos={allProyectos}
          />
        ) : (
          <AdminPanel
            allMembers={allMembers as any}
            allParticipaciones={allParticipaciones as any}
            allNominas={allNominas as any}
            periodos={initialPeriodos}
            proyectos={allProyectos}
          />
        )}
      </div>

      {/* ── Footer security note ─────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #ECEAE6', padding: '16px 32px', background: '#fff', marginTop: 16 }} className="ai-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L10 3V6.5C10 8.8 8.2 10.8 6 11C3.8 10.8 2 8.8 2 6.5V3L6 1Z"
              stroke="#CCC" strokeWidth="1" fill="none" />
            <path d="M4 6l1.5 1.5L8 4.5" stroke="#CCC" strokeWidth="1" strokeLinecap="round" />
          </svg>
          <p style={{ fontSize: 10, color: '#CCC', fontWeight: 300 }}>
            Área protegida — información personal y confidencial — sesión verificada activa
          </p>
        </div>
      </div>

    </div>
  )
}
