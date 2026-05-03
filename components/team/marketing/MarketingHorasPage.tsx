'use client'

import { useState } from 'react'
import { ProyectosInternosTab } from '@/components/team/proyectos/PlantillaManager'
import { MarketingMetricsTab } from '@/components/team/marketing/MarketingMetricsTab'
import type {
  ProyectoNegocio,
  SeccionNegocio,
  FaseNegocio,
  TeamMemberSimple,
} from '@/components/team/proyectos/PlantillaManager'

interface Props {
  currentUserId:    string
  currentUserRole:  'fp_partner' | 'fp_biz_dev'
  proyectosNegocio: ProyectoNegocio[]
  seccionesNegocio: SeccionNegocio[]
  fasesNegocio:     FaseNegocio[]
  teamMembers:      TeamMemberSimple[]
}

export function MarketingHorasPage({
  currentUserId,
  currentUserRole,
  proyectosNegocio,
  seccionesNegocio,
  fasesNegocio,
  teamMembers,
}: Props) {
  const [activeTab, setActiveTab] = useState<'estructura' | 'metricas'>('estructura')

  return (
    <div className="p-8 lg:p-10">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-2">
          Marketing · Time Tracker
        </p>
        <h1 className="text-3xl font-light text-ink tracking-tight mb-2">Horas</h1>
        <p className="text-sm font-light text-meta">
          Estructura y métricas del seguimiento de horas del equipo de marketing.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-ink/10 mb-8">
        {([
          { id: 'estructura' as const, label: 'Estructura' },
          { id: 'metricas'   as const, label: 'Métricas' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-[10px] tracking-widest uppercase font-light transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-ink border-ink'
                : 'text-meta border-transparent hover:text-ink hover:border-ink/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'estructura' && (
        <ProyectosInternosTab
          equipo="marketing"
          initialProyectos={proyectosNegocio}
          initialSecciones={seccionesNegocio}
          initialFases={fasesNegocio}
          teamMembers={teamMembers}
        />
      )}

      {activeTab === 'metricas' && (
        <MarketingMetricsTab
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          proyectosNegocio={proyectosNegocio}
          seccionesNegocio={seccionesNegocio}
          fasesNegocio={fasesNegocio}
          teamMembers={teamMembers}
        />
      )}
    </div>
  )
}
