'use client'

import { useState, useTransition, useRef } from 'react'
import FondoChart, { type FondoPeriodo } from './FondoChart'
import FondoTimeline from './FondoTimeline'
import type { Proyecto as FondoProyecto, Participacion as FondoParticipacion } from './FondoTimeline'
import { getNominaSignedUrl } from '@/app/actions/area-interna'
import { uploadAvatar, updateProfile, updatePassword } from '@/app/actions/profile'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CurrentUser {
  id:                 string
  email:              string
  nombre:             string
  apellido:           string | null
  rol:                'fp_team' | 'fp_manager' | 'fp_partner'
  fecha_contratacion: string | null
  avatar_url:         string | null
}

export interface Nomina {
  id:       string
  periodo:  string
  pdf_path: string
  pdf_url:  string
  created_at: string
}

export interface Participacion {
  id:                         string
  user_id:                    string
  porcentaje_participacion:   number
  fecha_inicio_participacion: string
  notas:                      string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtPeriodo(p: string): string {
  // '2025-03' → 'Marzo 2025'
  const [y, m] = p.split('-')
  return `${MESES_ES[parseInt(m, 10) - 1]} ${y}`
}

function fmtMXN(n: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n)
}

function calcSeniority(fecha: string): { años: number; meses: number; texto: string } {
  const inicio = new Date(fecha + 'T12:00:00')
  const ahora  = new Date()
  let años  = ahora.getFullYear()  - inicio.getFullYear()
  let meses = ahora.getMonth()     - inicio.getMonth()
  if (meses < 0) { años--; meses += 12 }
  const partes: string[] = []
  if (años  > 0) partes.push(`${años} ${años  === 1 ? 'año'   : 'años'}`)
  if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mes'  : 'meses'}`)
  return { años, meses, texto: partes.length ? partes.join(' y ') : 'Recién incorporado' }
}

interface VestingInfo {
  yearsInFund:    number
  monthsExtra:    number
  vestedPct:      number       // % accesible ahora
  accumulatedPct: number       // % acumulado durante cliff
  inCliff:        boolean
  label:          string
}

function calcVesting(fechaInicio: string): VestingInfo {
  const inicio = new Date(fechaInicio + 'T12:00:00')
  const ahora  = new Date()
  const diffMs = ahora.getTime() - inicio.getTime()
  const totalYears = diffMs / (1000 * 60 * 60 * 24 * 365.25)

  const yearsInFund  = Math.floor(totalYears)
  const monthsExtra  = Math.floor((totalYears - yearsInFund) * 12)
  const accumulated  = Math.min(yearsInFund * 25, 100) // 25%/año
  const inCliff      = totalYears < 3
  const vestedPct    = inCliff ? 0 : accumulated

  let label = ''
  if (inCliff)          label = `En período de cliff — desbloqueará el ${Math.ceil(3 - totalYears)} año${Math.ceil(3 - totalYears) !== 1 ? 's' : ''}`
  else if (vestedPct >= 100) label = 'Totalmente vested · 100% accesible'
  else                  label = `${vestedPct}% accesible · Cliff alcanzado`

  return { yearsInFund, monthsExtra, vestedPct, accumulatedPct: accumulated, inCliff, label }
}

// ── Seniority card ────────────────────────────────────────────────────────────

function SeniorityCard({ user }: { user: CurrentUser }) {
  if (!user.fecha_contratacion) {
    return (
      <div style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '24px 28px' }}>
        <p style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#BBB', fontWeight: 300, marginBottom: 14 }}>
          Antigüedad en el estudio
        </p>
        <p style={{ fontSize: 12, color: '#AAA', fontWeight: 300 }}>Sin fecha de contratación registrada.</p>
      </div>
    )
  }

  const { años, meses, texto } = calcSeniority(user.fecha_contratacion)
  const pct = Math.min((años + meses / 12) / 10 * 100, 100) // progress toward 10 years

  const milestones = [1, 3, 5, 10]
  const nextMilestone = milestones.find(m => m > años + meses / 12) ?? null

  return (
    <div style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '24px 28px' }}>
      <p style={{
        fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: '#BBB', fontWeight: 300, marginBottom: 18,
      }}>
        Antigüedad en el estudio
      </p>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 40, fontWeight: 200, color: '#1A1A1A', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {años > 0 ? años : meses}
            <span style={{ fontSize: 16, fontWeight: 300, color: '#888', marginLeft: 6 }}>
              {años > 0 ? (años === 1 ? 'año' : 'años') : (meses === 1 ? 'mes' : 'meses')}
            </span>
          </p>
          {años > 0 && meses > 0 && (
            <p style={{ fontSize: 12, color: '#AAA', fontWeight: 300, marginTop: 4 }}>
              y {meses} {meses === 1 ? 'mes' : 'meses'}
            </p>
          )}
          <p style={{ fontSize: 11, color: '#888', fontWeight: 300, marginTop: 10 }}>
            Incorporación:{' '}
            {new Date(user.fecha_contratacion + 'T12:00:00').toLocaleDateString('es-ES', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
        </div>

        {/* Ring visual */}
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          <svg viewBox="0 0 72 72" width="72" height="72">
            <circle cx="36" cy="36" r="28" fill="none" stroke="#F0EEE8" strokeWidth="6" />
            <circle
              cx="36" cy="36" r="28" fill="none"
              stroke="#D85A30" strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 28 * pct / 100} ${2 * Math.PI * 28 * (1 - pct / 100)}`}
              strokeDashoffset={2 * Math.PI * 28 * 0.25}
              strokeLinecap="round"
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <p style={{ fontSize: 9, color: '#888', fontWeight: 300, textAlign: 'center', lineHeight: 1.3 }}>
              de<br />10 años
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3, background: '#F0EEE8', borderRadius: 2, overflow: 'hidden', marginBottom: 12,
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'linear-gradient(90deg, #E6B820, #D85A30)',
          borderRadius: 2, transition: 'width 0.6s ease',
        }} />
      </div>

      {nextMilestone && (
        <p style={{ fontSize: 10, color: '#AAA', fontWeight: 300 }}>
          Próximo hito: <span style={{ color: '#888' }}>{nextMilestone} año{nextMilestone !== 1 ? 's' : ''}</span>
        </p>
      )}
    </div>
  )
}

// ── Nóminas section ───────────────────────────────────────────────────────────

function NominasSection({ nominas }: { nominas: Nomina[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const openNomina = async (nomina: Nomina) => {
    setLoadingId(nomina.id)
    const result = await getNominaSignedUrl(nomina.pdf_path)
    setLoadingId(null)
    if ('error' in result) { alert(result.error); return }
    window.open((result as any).url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '24px 28px' }}>
      <p style={{
        fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: '#BBB', fontWeight: 300, marginBottom: 20,
      }}>
        Mis nóminas
      </p>

      {nominas.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#CCC', fontWeight: 300 }}>
            No hay nóminas disponibles aún.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {nominas.map(n => (
            <div
              key={n.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px',
                background: '#FAFAF8',
                borderRadius: 2,
                transition: 'background 0.1s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* PDF icon */}
                <div style={{
                  width: 28, height: 34, background: '#F0EEE8', borderRadius: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="13" height="16" viewBox="0 0 13 16" fill="none">
                    <rect x="0.5" y="0.5" width="12" height="15" rx="1.5" stroke="#D0CCC4" />
                    <path d="M3 6h7M3 8.5h7M3 11h4" stroke="#D0CCC4" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 300 }}>
                    {fmtPeriodo(n.periodo)}
                  </p>
                  <p style={{ fontSize: 10, color: '#BBB', fontWeight: 300, marginTop: 1 }}>
                    Subida {new Date(n.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <button
                onClick={() => openNomina(n)}
                disabled={loadingId === n.id}
                style={{
                  background: 'none', border: '1px solid #E8E6E0',
                  padding: '5px 14px', fontSize: 9,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: '#888', fontWeight: 300, cursor: 'pointer',
                  transition: 'all 0.15s',
                  opacity: loadingId === n.id ? 0.5 : 1,
                }}
              >
                {loadingId === n.id ? 'Cargando…' : 'Ver PDF'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vesting timeline ──────────────────────────────────────────────────────────

function VestingTimeline({ vesting }: { vesting: VestingInfo }) {
  const { yearsInFund, monthsExtra, vestedPct, accumulatedPct, inCliff } = vesting

  const totalProgress = Math.min((yearsInFund + monthsExtra / 12) / 4, 1) // 4 years = full vest
  const cliffPos = 3 / 4 // cliff at year 3 of 4

  const milestones = [
    { year: 0, label: 'Inicio', pct: '0%' },
    { year: 1, label: 'Año 1', pct: '25%' },
    { year: 2, label: 'Año 2', pct: '50%' },
    { year: 3, label: 'Año 3', pct: '75%', isCliff: true },
    { year: 4, label: 'Año 4', pct: '100%' },
  ]

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#BBB', fontWeight: 300 }}>
          Calendario de vesting
        </p>
        <p style={{ fontSize: 10, color: inCliff ? '#E6B820' : '#1D9E75', fontWeight: 300 }}>
          {vesting.label}
        </p>
      </div>

      {/* Timeline bar */}
      <div style={{ position: 'relative', height: 8, marginBottom: 28 }}>
        {/* Track */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
          background: '#F0EEE8', borderRadius: 4,
        }} />

        {/* Accumulated progress (during cliff = amber) */}
        {inCliff && (
          <div style={{
            position: 'absolute', top: 0, left: 0, height: '100%',
            width: `${totalProgress * 100}%`,
            background: 'linear-gradient(90deg, #E6B820, #F0A500)',
            borderRadius: 4, transition: 'width 0.6s ease',
          }} />
        )}

        {/* Vested progress (post-cliff = green) */}
        {!inCliff && (
          <>
            {/* Cliff achieved zone: amber from 0 to cliff */}
            <div style={{
              position: 'absolute', top: 0, left: 0, height: '100%',
              width: `${cliffPos * 100}%`,
              background: '#E6B820',
              borderRadius: 4,
            }} />
            {/* Vested beyond cliff: green */}
            <div style={{
              position: 'absolute', top: 0, left: `${cliffPos * 100}%`, height: '100%',
              width: `${Math.max(0, (totalProgress - cliffPos)) * 100}%`,
              background: '#1D9E75',
              borderRadius: 4, transition: 'width 0.6s ease',
            }} />
          </>
        )}

        {/* Cliff marker */}
        <div style={{
          position: 'absolute', top: -4, left: `${cliffPos * 100}%`,
          transform: 'translateX(-50%)',
          width: 2, height: 16, background: '#D85A30',
        }}>
          <div style={{
            position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
            fontSize: 8, color: '#D85A30', fontWeight: 400, letterSpacing: '0.1em',
            whiteSpace: 'nowrap', textTransform: 'uppercase',
          }}>
            Cliff
          </div>
        </div>

        {/* Current position marker */}
        {totalProgress > 0 && totalProgress < 1 && (
          <div style={{
            position: 'absolute', top: -3, left: `${totalProgress * 100}%`,
            transform: 'translateX(-50%)',
            width: 14, height: 14, borderRadius: '50%',
            background: '#fff',
            border: `2px solid ${inCliff ? '#E6B820' : '#1D9E75'}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          }} />
        )}
      </div>

      {/* Milestone labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {milestones.map(m => {
          const reached = (yearsInFund + monthsExtra / 12) >= m.year
          return (
            <div key={m.year} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', margin: '0 auto 5px',
                background: reached ? (m.isCliff && !inCliff ? '#D85A30' : (inCliff ? '#E6B820' : '#1D9E75')) : '#E0DED8',
                border: m.isCliff ? `1px solid #D85A30` : 'none',
              }} />
              <p style={{ fontSize: 8, color: reached ? '#888' : '#CCC', fontWeight: 300, marginBottom: 2 }}>
                {m.label}
              </p>
              <p style={{
                fontSize: 8, fontWeight: 400,
                color: reached ? (m.isCliff ? '#D85A30' : (inCliff ? '#E6B820' : '#1D9E75')) : '#DDD',
              }}>
                {m.pct}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Fondo FP section ──────────────────────────────────────────────────────────

function FondoSection({
  periodos,
  participacion,
  proyectos,
  allParticipaciones,
  isPartner,
}: {
  periodos:           FondoPeriodo[]
  participacion:      Participacion | null
  proyectos:          FondoProyecto[]
  allParticipaciones: FondoParticipacion[]
  isPartner:          boolean
}) {
  const vesting = participacion
    ? calcVesting(participacion.fecha_inicio_participacion)
    : null

  return (
    <div style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '24px 28px' }}>
      <p style={{
        fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: '#BBB', fontWeight: 300, marginBottom: 20,
      }}>
        Fondo de retención FP
      </p>

      {/* Vesting timeline */}
      {vesting && <VestingTimeline vesting={vesting} />}

      {/* No participation message */}
      {!participacion && (
        <div style={{ marginTop: 20, marginBottom: 20, padding: '14px 18px', background: '#FAFAF8', border: '1px dashed #E0DED8' }}>
          <p style={{ fontSize: 11, color: '#AAA', fontWeight: 300 }}>
            Aún no tienes participación asignada en el fondo. Consulta con un partner para más información.
          </p>
        </div>
      )}

      {/* Fund Timeline */}
      <div style={{ marginTop: vesting ? 28 : 0, position: 'relative', overflow: 'hidden', borderRadius: 6 }}>
        <FondoTimeline
          proyectos={proyectos}
          participaciones={allParticipaciones}
          isPartner={isPartner}
          allMembers={[]}
        />
        {/* Work in Progress overlay */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20,
          background: 'repeating-linear-gradient(135deg, rgba(248,247,244,0.55) 0px, rgba(248,247,244,0.55) 18px, rgba(232,230,224,0.35) 18px, rgba(232,230,224,0.35) 36px)',
        }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 21 }}>
          <div style={{ transform: 'rotate(-18deg)', background: '#1A1A1A', color: '#fff', padding: '10px 64px', fontSize: 10, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: '0 2px 24px rgba(0,0,0,0.18)' }}>
            Work in Progress
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mi Cuenta section ─────────────────────────────────────────────────────────

const ROLE_LABELS_PD: Record<string, string> = {
  fp_team: 'FP Team', fp_manager: 'FP Manager', fp_partner: 'FP Partner',
}
const ROLE_COLORS_PD: Record<string, string> = {
  fp_team: '#1D9E75', fp_manager: '#378ADD', fp_partner: '#D85A30',
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function MiCuentaSection({ user, onAvatarChange }: { user: CurrentUser; onAvatarChange?: (url: string) => void }) {
  const roleColor = ROLE_COLORS_PD[user.rol] ?? '#888'
  const initials  = [user.nombre, user.apellido].filter(Boolean).map(s => s![0].toUpperCase()).join('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Avatar
  const [savedAvatar,  setSavedAvatar]  = useState<string | null>(user.avatar_url)
  const [pendingFile,  setPendingFile]  = useState<File | null>(null)
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarMsg,    setAvatarMsg]    = useState<{ ok: boolean; text: string } | null>(null)
  const displayAvatar = previewUrl ?? savedAvatar

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file); setPreviewUrl(URL.createObjectURL(file)); setAvatarMsg(null)
  }
  const handleSaveAvatar = async () => {
    if (!pendingFile) return
    setAvatarSaving(true); setAvatarMsg(null)
    const bytes = new Uint8Array(await pendingFile.arrayBuffer())
    const result = await uploadAvatar(bytes, pendingFile.name, pendingFile.type)
    if ('error' in result) {
      setAvatarMsg({ ok: false, text: result.error })
    } else {
      setSavedAvatar(result.url); setPendingFile(null); setPreviewUrl(null)
      setAvatarMsg({ ok: true, text: 'Foto guardada correctamente.' })
      onAvatarChange?.(result.url)
    }
    setAvatarSaving(false)
  }

  // Nombre
  const [nombre,      setNombre]      = useState(user.nombre + (user.apellido ? ` ${user.apellido}` : ''))
  const [nombreSaving, setNombreSaving] = useState(false)
  const [nombreMsg,    setNombreMsg]    = useState<{ ok: boolean; text: string } | null>(null)
  const handleNombre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return
    setNombreSaving(true); setNombreMsg(null)
    const result = await updateProfile(nombre.trim())
    setNombreMsg('error' in result ? { ok: false, text: result.error } : { ok: true, text: 'Nombre actualizado.' })
    setNombreSaving(false)
  }

  // Password
  const [pw,       setPw]       = useState({ new: '', confirm: '' })
  const [showNew,  setShowNew]  = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg,    setPwMsg]    = useState<{ ok: boolean; text: string } | null>(null)
  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPwMsg(null)
    if (pw.new.length < 6) { setPwMsg({ ok: false, text: 'Mínimo 6 caracteres.' }); return }
    if (pw.new !== pw.confirm) { setPwMsg({ ok: false, text: 'Las contraseñas no coinciden.' }); return }
    setPwSaving(true)
    const result = await updatePassword(pw.new)
    setPwMsg('error' in result ? { ok: false, text: result.error } : { ok: true, text: 'Contraseña actualizada.' })
    if (!('error' in result)) setPw({ new: '', confirm: '' })
    setPwSaving(false)
  }

  const inputSt: React.CSSProperties = {
    width: '100%', border: '1px solid #E8E6E0', padding: '8px 12px',
    fontSize: 13, fontWeight: 300, color: '#1A1A1A', background: '#fff',
    outline: 'none', boxSizing: 'border-box',
  }
  const labelSt: React.CSSProperties = {
    display: 'block', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
    color: '#BBB', fontWeight: 300, marginBottom: 6,
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: '#BBB', fontWeight: 300, marginBottom: 16,
  }
  const btnPrimary: React.CSSProperties = {
    background: '#1A1A1A', color: '#fff', border: 'none',
    padding: '8px 18px', fontSize: 9, letterSpacing: '0.14em',
    textTransform: 'uppercase', fontWeight: 300, cursor: 'pointer',
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #ECEAE6', padding: '24px 28px' }}>
      <p style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#BBB', fontWeight: 300, marginBottom: 24 }}>
        Mi cuenta
      </p>

      {/* ── Avatar ── */}
      <p style={sectionTitle}>Foto de perfil</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            background: roleColor, overflow: 'hidden', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {displayAvatar
            ? <img src={displayAvatar} alt={user.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#fff', fontSize: 20, fontWeight: 300 }}>{initials}</span>
          }
        </div>
        <div>
          <p style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 300, marginBottom: 2 }}>
            {user.nombre}{user.apellido ? ` ${user.apellido}` : ''}
          </p>
          <p style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: roleColor, fontWeight: 400, marginBottom: 8 }}>
            {ROLE_LABELS_PD[user.rol] ?? user.rol}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ fontSize: 10, color: '#AAA', fontWeight: 300, background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {displayAvatar ? 'Cambiar foto' : 'Subir foto'}
          </button>
        </div>
      </div>
      {pendingFile && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <button onClick={handleSaveAvatar} disabled={avatarSaving} style={{ ...btnPrimary, opacity: avatarSaving ? 0.5 : 1 }}>
            {avatarSaving ? 'Guardando…' : 'Guardar foto'}
          </button>
          <button onClick={() => { setPendingFile(null); setPreviewUrl(null) }}
            style={{ fontSize: 10, color: '#AAA', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Cancelar
          </button>
        </div>
      )}
      {avatarMsg && (
        <p style={{ fontSize: 11, fontWeight: 300, color: avatarMsg.ok ? '#1D9E75' : '#C04828', marginBottom: 8 }}>
          {avatarMsg.text}
        </p>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

      <div style={{ borderTop: '1px solid #ECEAE6', margin: '20px 0' }} />

      {/* ── Datos ── */}
      <p style={sectionTitle}>Datos</p>
      <form onSubmit={handleNombre} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
        <div>
          <label style={labelSt}>Nombre completo</label>
          <input
            value={nombre}
            onChange={e => { setNombre(e.target.value); setNombreMsg(null) }}
            placeholder="Tu nombre"
            style={inputSt}
          />
        </div>
        <div>
          <label style={labelSt}>Correo electrónico</label>
          <input
            value={user.email}
            disabled
            style={{ ...inputSt, background: '#FAFAF8', color: '#AAA', cursor: 'not-allowed' }}
          />
          <p style={{ fontSize: 9, color: '#CCC', fontWeight: 300, marginTop: 4 }}>El correo no se puede modificar desde aquí.</p>
        </div>
        {nombreMsg && (
          <p style={{ fontSize: 11, fontWeight: 300, color: nombreMsg.ok ? '#1D9E75' : '#C04828' }}>{nombreMsg.text}</p>
        )}
        <div>
          <button type="submit" disabled={nombreSaving || !nombre.trim()} style={{ ...btnPrimary, opacity: (nombreSaving || !nombre.trim()) ? 0.5 : 1 }}>
            {nombreSaving ? 'Guardando…' : 'Guardar nombre'}
          </button>
        </div>
      </form>

      <div style={{ borderTop: '1px solid #ECEAE6', margin: '20px 0' }} />

      {/* ── Contraseña ── */}
      <p style={sectionTitle}>Contraseña</p>
      <form onSubmit={handlePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
        <div>
          <label style={labelSt}>Nueva contraseña</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showNew ? 'text' : 'password'}
              value={pw.new}
              onChange={e => { setPw(p => ({ ...p, new: e.target.value })); setPwMsg(null) }}
              placeholder="Mínimo 6 caracteres"
              style={{ ...inputSt, paddingRight: 38 }}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowNew(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#AAA', padding: 0, lineHeight: 1 }}>
              <EyeIcon open={showNew} />
            </button>
          </div>
        </div>
        <div>
          <label style={labelSt}>Confirmar contraseña</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showConf ? 'text' : 'password'}
              value={pw.confirm}
              onChange={e => { setPw(p => ({ ...p, confirm: e.target.value })); setPwMsg(null) }}
              placeholder="Repite la contraseña"
              style={{ ...inputSt, paddingRight: 38 }}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowConf(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#AAA', padding: 0, lineHeight: 1 }}>
              <EyeIcon open={showConf} />
            </button>
          </div>
        </div>
        {pwMsg && (
          <p style={{ fontSize: 11, fontWeight: 300, color: pwMsg.ok ? '#1D9E75' : '#C04828' }}>{pwMsg.text}</p>
        )}
        <div>
          <button type="submit" disabled={pwSaving || !pw.new || !pw.confirm} style={{ ...btnPrimary, opacity: (pwSaving || !pw.new || !pw.confirm) ? 0.5 : 1 }}>
            {pwSaving ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  currentUser:          CurrentUser
  initialNominas:       Nomina[]
  initialPeriodos:      FondoPeriodo[]
  initialParticipacion: Participacion | null
  allParticipaciones:   FondoParticipacion[]
  allProyectos:         FondoProyecto[]
}

export default function PersonalDashboard({
  currentUser,
  initialNominas,
  initialPeriodos,
  initialParticipacion,
  allParticipaciones,
  allProyectos,
}: Props) {
  const isPartner = currentUser.rol === 'fp_partner'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }} className="pd-root">
      <SeniorityCard user={currentUser} />
      <NominasSection nominas={initialNominas} />
      <FondoSection
        periodos={initialPeriodos}
        participacion={initialParticipacion}
        proyectos={allProyectos}
        allParticipaciones={allParticipaciones}
        isPartner={isPartner}
      />
      <MiCuentaSection user={currentUser} />
    </div>
  )
}
