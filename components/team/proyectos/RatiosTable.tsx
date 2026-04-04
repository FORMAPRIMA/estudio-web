'use client'

import { useState } from 'react'
import { updateFaseRatio } from '@/app/actions/ratios'
import type { CatalogoFase } from '@/lib/types'

const SECTION_ORDER = ['Anteproyecto', 'Proyecto de ejecución', 'Obra', 'Interiorismo', 'Post venta']

export default function RatiosTable({ fases }: { fases: CatalogoFase[] }) {
  const [ratios, setRatios] = useState<Record<string, string>>(
    Object.fromEntries(fases.map(f => [f.id, f.ratio?.toString() ?? '0']))
  )
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSave = async (faseId: string) => {
    const val = parseFloat(ratios[faseId])
    if (isNaN(val) || val < 0) {
      setErrors(e => ({ ...e, [faseId]: 'Valor inválido' }))
      return
    }
    setSaving(s => ({ ...s, [faseId]: true }))
    setErrors(e => ({ ...e, [faseId]: '' }))
    const result = await updateFaseRatio(faseId, val)
    setSaving(s => ({ ...s, [faseId]: false }))
    if (result.error) {
      setErrors(e => ({ ...e, [faseId]: result.error! }))
    } else {
      setSaved(s => ({ ...s, [faseId]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [faseId]: false })), 2000)
    }
  }

  const fasesBySection = SECTION_ORDER.map(sec => ({
    seccion: sec,
    items: fases.filter(f => f.seccion === sec).sort((a, b) => a.orden - b.orden),
  })).filter(g => g.items.length > 0)

  return (
    <div className="p-8 lg:p-10">
      <div className="mb-8">
        <p className="text-[10px] tracking-widest uppercase font-light text-meta mb-2">Área interna</p>
        <h1 className="text-3xl font-light text-ink tracking-tight">Ratios objetivo</h1>
        <p className="text-sm font-light text-meta mt-2">
          Horas por m² de diseño por fase. Se aplican al agregar fases a un proyecto.
        </p>
      </div>

      <div className="space-y-8 max-w-2xl">
        {fasesBySection.map(group => (
          <div key={group.seccion}>
            <p className="text-[9px] tracking-widest uppercase font-light text-meta/50 mb-3">
              {group.seccion}
            </p>
            <div className="border border-ink/10">
              {/* Header */}
              <div className="grid grid-cols-[2rem_1fr_10rem_6rem] gap-4 px-4 py-2 border-b border-ink/8 bg-ink/[0.015]">
                <p className="text-[8px] tracking-widest uppercase font-light text-meta/50">F</p>
                <p className="text-[8px] tracking-widest uppercase font-light text-meta/50">Fase</p>
                <p className="text-[8px] tracking-widest uppercase font-light text-meta/50 text-right">Ratio (h/m²)</p>
                <p className="text-[8px] tracking-widest uppercase font-light text-meta/50"></p>
              </div>

              {group.items.map((fase, i) => (
                <div
                  key={fase.id}
                  className={`grid grid-cols-[2rem_1fr_10rem_6rem] gap-4 items-center px-4 py-3 ${
                    i < group.items.length - 1 ? 'border-b border-ink/6' : ''
                  }`}
                >
                  <span className="text-[10px] tracking-widest uppercase font-light text-meta">
                    F{fase.numero}
                  </span>
                  <span className="text-sm font-light text-ink">{fase.label}</span>
                  <div className="flex justify-end">
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={ratios[fase.id]}
                      onChange={e => setRatios(r => ({ ...r, [fase.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleSave(fase.id)}
                      className="w-28 text-right text-sm font-light text-ink border border-ink/15 px-2 py-1 bg-cream focus:outline-none focus:border-ink/40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSave(fase.id)}
                      disabled={saving[fase.id]}
                      className="text-[9px] tracking-widest uppercase font-light text-meta hover:text-ink transition-colors disabled:opacity-40"
                    >
                      {saving[fase.id] ? '…' : saved[fase.id] ? '✓' : 'Guardar'}
                    </button>
                    {errors[fase.id] && (
                      <span className="text-[9px] text-red-500">{errors[fase.id]}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
