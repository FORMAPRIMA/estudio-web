'use client'

import React, { useState } from 'react'
import ObraDashboardTab from '@/components/team/fp-execution/obra/ObraDashboardTab'
import type { ObraBaselineSnapshot, ObraPhase, ObraMilestone } from '@/lib/fp-execution/obra'

type SubTab = 'dashboard'

export default function ObraManagementPage({
  projectId,
  obraStartedAt,
  baselineSnapshot,
  phases,
  milestones,
  chapterNames,
}: {
  projectId:        string
  obraStartedAt:    string
  baselineSnapshot: ObraBaselineSnapshot | null
  phases:           ObraPhase[]
  milestones:       ObraMilestone[]
  chapterNames:     Record<string, string>
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
        <SubTabBtn label="Dashboard" active={subTab === 'dashboard'} onClick={() => setSubTab('dashboard')} />
      </div>

      {subTab === 'dashboard' && (
        <ObraDashboardTab
          projectId={projectId}
          obraStartedAt={obraStartedAt}
          baselineSnapshot={baselineSnapshot}
          phases={phases}
          milestones={milestones}
          chapterNames={chapterNames}
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
