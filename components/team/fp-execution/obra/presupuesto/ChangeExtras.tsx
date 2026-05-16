'use client'

import React from 'react'

// ══════════════════════════════════════════════════════════════════════════════
// ChangeExtras
//
// Bloque reusable con campos adicionales que cualquier cambio puede emitir
// hacia el EP / al template del proyecto:
//
//   - reflectToPartner: ¿reflejar el delta económico al EP?
//   - addToTemplate:    ¿promover esta UE/partida al template del proyecto?
//
// Lo usan EditPartidaModal, NewPartidaModal y NewUnitModal.
// ══════════════════════════════════════════════════════════════════════════════

export interface ExtrasValue {
  reflectToPartner: boolean
  addToTemplate:    boolean
}

export const emptyExtras: ExtrasValue = {
  reflectToPartner: false,
  addToTemplate:    false,
}

export default function ChangeExtras({
  value,
  onChange,
  partnerNombre,
  showAddToTemplate = false,
  templateBlocked   = false,
  templateBlockedReason,
  templateLabel     = 'También añadir esta partida al template de proyectos',
}: {
  value:                 ExtrasValue
  onChange:              (v: ExtrasValue) => void
  partnerNombre:         string | null
  showAddToTemplate?:    boolean
  templateBlocked?:      boolean
  templateBlockedReason?: string
  templateLabel?:        string
}) {
  const update = (patch: Partial<ExtrasValue>) => onChange({ ...value, ...patch })

  return (
    <div style={{
      background: '#FAFAF8', border: '1px solid #E8E6E0', borderRadius: 7,
      padding: '10px 14px', marginTop: 6, marginBottom: 14,
    }}>
      {/* Reflect to partner */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: partnerNombre ? 'pointer' : 'not-allowed', opacity: partnerNombre ? 1 : 0.5 }}>
        <input
          type="checkbox"
          checked={value.reflectToPartner}
          disabled={!partnerNombre}
          onChange={e => update({ reflectToPartner: e.target.checked })}
          style={{ marginTop: 2 }}
        />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>
            Reflejar el delta económico al execution partner{partnerNombre ? ` (${partnerNombre})` : ''}
          </div>
          <div style={{ fontSize: 10.5, color: '#666', marginTop: 3, lineHeight: 1.45 }}>
            Si marcas, el delta se acumulará como pago de modificación en el último hito del EP.
            Déjalo sin marcar si es un cambio interno que no le repercute (margen para la constructora).
          </div>
        </div>
      </label>

      {/* Add to template */}
      {showAddToTemplate && (
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 12,
          cursor: templateBlocked ? 'not-allowed' : 'pointer',
          opacity: templateBlocked ? 0.5 : 1,
        }}>
          <input
            type="checkbox"
            checked={value.addToTemplate && !templateBlocked}
            disabled={templateBlocked}
            onChange={e => update({ addToTemplate: e.target.checked })}
            style={{ marginTop: 2 }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>
              {templateLabel}
            </div>
            {templateBlocked && templateBlockedReason && (
              <div style={{ fontSize: 10.5, color: '#9A3412', marginTop: 3, lineHeight: 1.45 }}>
                {templateBlockedReason}
              </div>
            )}
            {!templateBlocked && (
              <div style={{ fontSize: 10.5, color: '#666', marginTop: 3, lineHeight: 1.45 }}>
                Quedará disponible para futuros proyectos sin tener que volver a crearla.
              </div>
            )}
          </div>
        </label>
      )}
    </div>
  )
}
