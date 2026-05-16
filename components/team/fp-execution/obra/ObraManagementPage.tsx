'use client'

import React, { useState } from 'react'
import ObraDashboardTab from '@/components/team/fp-execution/obra/ObraDashboardTab'
import ObraPresupuestoTab from '@/components/team/fp-execution/obra/presupuesto/ObraPresupuestoTab'
import type { ObraBaselineSnapshot, ObraPhase, ObraMilestone } from '@/lib/fp-execution/obra'
import type { ObraChangeSession } from '@/lib/fp-execution/obra-presupuesto'

type SubTab = 'dashboard' | 'presupuesto'

export default function ObraManagementPage({
  projectId,
  obraStartedAt,
  obraFechaInicio,
  obraIniciadaAt,
  baselineSnapshot,
  phases,
  milestones,
  chapterNames,
  partnerNames,
  chapters,
  chapterDisciplines,
  disciplines,
  partnersList,
  obraUnits,
  obraLineItems,
  obraUnitPartners,
  obraSession,
  obraActas,
  obraAwaitingApproval,
  obraProjectClient,
  obraEpPayments = [],
}: {
  projectId:            string
  obraStartedAt:        string
  obraFechaInicio:      string | null
  obraIniciadaAt:       string | null
  baselineSnapshot:     ObraBaselineSnapshot | null
  phases:               ObraPhase[]
  milestones:           ObraMilestone[]
  chapterNames:         Record<string, string>
  partnerNames:         Record<string, string>
  chapters:             Array<{ id: string; nombre: string; orden: number }>
  chapterDisciplines:   Record<string, string | null>
  disciplines:          Array<{ id: string; nombre: string }>
  partnersList:         Array<{ id: string; nombre: string; email_contacto?: string | null; telefono?: string | null }>
  obraUnits:            unknown[]
  obraLineItems:        unknown[]
  obraUnitPartners:     { obra_unit_id: string; partner_id: string }[]
  obraSession:          ObraChangeSession | null
  obraActas:            unknown[]
  obraAwaitingApproval: unknown[]
  obraProjectClient:    { nombre: string; nif: string | null; email: string | null } | null
  obraEpPayments?:      unknown[]
}) {
  const [subTab, setSubTab] = useState<SubTab>('dashboard')

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 18,
        background: '#F0EEE8', borderRadius: 8, padding: 4,
        width: 'fit-content',
      }}>
        <SubTabBtn label="Dashboard"   active={subTab === 'dashboard'}   onClick={() => setSubTab('dashboard')} />
        <SubTabBtn label="Presupuesto" active={subTab === 'presupuesto'} onClick={() => setSubTab('presupuesto')} />
      </div>

      {subTab === 'dashboard' && (
        <ObraDashboardTab
          projectId={projectId}
          obraStartedAt={obraStartedAt}
          obraFechaInicio={obraFechaInicio}
          obraIniciadaAt={obraIniciadaAt}
          baselineSnapshot={baselineSnapshot}
          phases={phases}
          milestones={milestones}
          chapterNames={chapterNames}
          partnerNames={partnerNames}
        />
      )}

      {subTab === 'presupuesto' && (
        <ObraPresupuestoTab
          projectId={projectId}
          chapters={chapters}
          chapterDisciplines={chapterDisciplines}
          disciplines={disciplines}
          partners={partnersList}
          partnerNames={partnerNames}
          obraUnits={obraUnits}
          obraLineItems={obraLineItems}
          obraUnitPartners={obraUnitPartners}
          obraSession={obraSession}
          obraActas={obraActas}
          obraAwaitingApproval={obraAwaitingApproval}
          obraProjectClient={obraProjectClient}
          obraPhases={phases}
          chapterNames={chapterNames}
          obraEpPayments={obraEpPayments}
        />
      )}
    </div>
  )
}

function SubTabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', fontSize: 12, fontWeight: 600,
        borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: active ? '#fff' : 'transparent',
        color:      active ? '#1A1A1A' : '#888',
        boxShadow:  active ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
      }}
    >
      {label}
    </button>
  )
}
