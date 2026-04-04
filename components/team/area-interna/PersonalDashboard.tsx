'use client'

import { useState, useTransition } from 'react'
import FondoChart, { type FondoPeriodo } from './FondoChart'
import FondoTimeline from './FondoTimeline'
import type { Proyecto as FondoProyecto, Participacion as FondoParticipacion } from './FondoTimeline'
import { getNominaSignedUrl } from '@/app/actions/area-interna'

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
      <div style={{ marginTop: vesting ? 28 : 0 }}>
        <FondoTimeline
          proyectos={proyectos}
          participaciones={allParticipaciones}
          isPartner={isPartner}
          allMembers={[]}
        />
      </div>
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
    </div>
  )
}
