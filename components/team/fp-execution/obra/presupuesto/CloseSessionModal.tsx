'use client'

import React, { useMemo, useState } from 'react'
import { ModalShell } from './EditPartidaModal'
import { closeObraChangeSession, type PhaseImpactInput } from '@/app/actions/fpe-obra-presupuesto'
import type { ObraChangeLogRow } from '@/lib/fp-execution/obra-presupuesto'
import type { ObraPhase } from '@/lib/fp-execution/obra'

export default function CloseSessionModal({
  sessionId,
  log,
  projectClient,
  obraPhases,
  chapterNames,
  onClose,
  onClosed,
}: {
  sessionId:     string
  log:           ObraChangeLogRow[]
  projectClient: { nombre: string; nif: string | null; email: string | null } | null
  obraPhases:    ObraPhase[]
  chapterNames:  Record<string, string>
  onClose:       () => void
  onClosed:      (actaIds: string[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)
  const [stage, setStage] = useState<'sending'|null>(null)

  const summary = useMemo(() => {
    const cliente = log.filter(l => l.destino_acta === 'cliente')
    const interna = log.filter(l => l.destino_acta === 'interna')
    return {
      cliente: { count: cliente.length, total: cliente.reduce((a, l) => a + Number(l.delta_monto), 0) },
      interna: { count: interna.length, total: interna.reduce((a, l) => a + Number(l.delta_monto), 0) },
    }
  }, [log])

  const hasCliente = summary.cliente.count > 0
  const hasInterna = summary.interna.count > 0
  const canSendCliente = hasCliente && !!projectClient?.email
  const blockingClienteIssue = hasCliente && !projectClient?.email

  // ── Wizard step ─────────────────────────────────────────────────────────────
  // 'cliente'  — disclaimer cliente (skipped si no hay acta cliente)
  // 'impactos' — pantalla de impacto en plazos (siempre)
  const [step, setStep] = useState<'cliente' | 'impactos'>(hasCliente ? 'cliente' : 'impactos')

  // Fases candidatas: las que estén en capítulos donde viven partidas tocadas
  const touchedChapterIds = useMemo(() => {
    // Los logs tienen parent_id (UE id para new_partida/edit_partida; chapter_id
    // para new_unit). Necesitamos cruzar con obra_units para extraer el chapter
    // pero aquí solo tenemos los logs y las phases. Como aproximación: usamos
    // todas las fases del proyecto (ordenadas por capítulo). El usuario filtra.
    const ids = new Set<string>()
    for (const ph of obraPhases) if (ph.chapter_id) ids.add(ph.chapter_id)
    return ids
  }, [obraPhases])

  const candidatePhases = useMemo(() => {
    return obraPhases
      .filter(ph => ph.chapter_id && touchedChapterIds.has(ph.chapter_id))
      .sort((a, b) => {
        const chA = chapterNames[a.chapter_id ?? ''] ?? ''
        const chB = chapterNames[b.chapter_id ?? ''] ?? ''
        if (chA !== chB) return chA.localeCompare(chB)
        return a.orden - b.orden
      })
  }, [obraPhases, touchedChapterIds, chapterNames])

  const [affectsPlanning, setAffectsPlanning] = useState<'no' | 'yes'>('no')
  const [phaseDeltas, setPhaseDeltas] = useState<Record<string, string>>({})

  const phaseImpactsTotal = useMemo(() => {
    if (affectsPlanning === 'no') return 0
    let t = 0
    for (const v of Object.values(phaseDeltas)) {
      const n = Number(v)
      if (Number.isFinite(n)) t += n
    }
    return t
  }, [phaseDeltas, affectsPlanning])

  const phaseImpacts: PhaseImpactInput[] = useMemo(() => {
    if (affectsPlanning === 'no') return []
    return Object.entries(phaseDeltas)
      .map(([id, v]) => ({ obra_phase_id: id, extra_dias: Math.trunc(Number(v)) }))
      .filter(im => Number.isFinite(im.extra_dias) && im.extra_dias !== 0)
  }, [phaseDeltas, affectsPlanning])

  const handleConfirm = async () => {
    if (blockingClienteIssue) {
      setErr('No hay email del cliente para enviar el acta. Configura el cliente del proyecto vinculado antes de cerrar.')
      return
    }
    setBusy(true); setErr(null); setStage('sending')

    const closeRes = await closeObraChangeSession(sessionId, phaseImpacts)
    if ('error' in closeRes) {
      setBusy(false); setStage(null)
      setErr(closeRes.error); return
    }

    if (closeRes.acta_cliente_id && canSendCliente) {
      try {
        const res = await fetch(`/api/obra/actas/${closeRes.acta_cliente_id}/docusign`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({}),
        })
        const data = await res.json()
        if (!res.ok) {
          setBusy(false); setStage(null)
          setErr(`Sesión cerrada y actas generadas, pero falló el envío a DocuSign: ${data.error ?? 'desconocido'}. Reintenta desde la lista de actas.`)
          setTimeout(() => onClosed(closeRes.acta_ids), 2000)
          return
        }
      } catch (e) {
        setBusy(false); setStage(null)
        setErr(`Sesión cerrada pero DocuSign falló: ${e instanceof Error ? e.message : 'desconocido'}`)
        setTimeout(() => onClosed(closeRes.acta_ids), 2000)
        return
      }
    }

    onClosed(closeRes.acta_ids)
  }

  const subtitle = step === 'cliente'
    ? 'Paso 1 de 2 · Datos de envío al cliente'
    : `${hasCliente ? 'Paso 2 de 2 · ' : ''}Impacto en plazos`

  return (
    <ModalShell
      title="Cerrar sesión de cambios"
      subtitle={subtitle}
      onClose={onClose}
    >
      {log.length === 0 ? (
        <div style={{ fontSize: 12, color: '#888', padding: '12px 0' }}>
          No hay cambios en esta sesión. Cancela la sesión en su lugar.
        </div>
      ) : step === 'cliente' ? (
        <ClientStep
          summary={summary}
          projectClient={projectClient}
        />
      ) : (
        <ImpactStep
          affectsPlanning={affectsPlanning}
          setAffectsPlanning={setAffectsPlanning}
          phaseDeltas={phaseDeltas}
          setPhaseDeltas={setPhaseDeltas}
          candidatePhases={candidatePhases}
          chapterNames={chapterNames}
          phaseImpactsTotal={phaseImpactsTotal}
          gateInfo={hasCliente
            ? 'Estos cambios se aplicarán al cronograma vivo cuando el cliente firme el acta.'
            : 'Estos cambios se aplicarán al cronograma vivo inmediatamente al cerrar la sesión.'}
          summary={summary}
        />
      )}

      {err && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
          padding: '8px 12px', marginTop: 14, fontSize: 12, color: '#DC2626',
        }}>{err}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button
          type="button"
          onClick={step === 'impactos' && hasCliente ? () => setStep('cliente') : onClose}
          disabled={busy}
          style={{
            background: 'none', border: '1px solid #E8E6E0', borderRadius: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#666',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >{step === 'impactos' && hasCliente ? '← Atrás' : 'Volver'}</button>

        {step === 'cliente' ? (
          <button
            type="button"
            onClick={() => setStep('impactos')}
            disabled={blockingClienteIssue}
            style={{
              background: blockingClienteIssue ? '#CCC' : '#1A1A1A',
              color: '#fff', border: 'none', borderRadius: 6,
              padding: '8px 18px', fontSize: 12, fontWeight: 700,
              cursor: blockingClienteIssue ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >Siguiente →</button>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={log.length === 0 || busy || blockingClienteIssue}
            style={{
              background: (log.length === 0 || blockingClienteIssue) ? '#CCC' : '#D85A30',
              color: '#fff', border: 'none', borderRadius: 6,
              padding: '8px 18px', fontSize: 12, fontWeight: 700,
              cursor: (log.length === 0 || blockingClienteIssue) ? 'not-allowed' : (busy ? 'wait' : 'pointer'),
              fontFamily: 'inherit',
            }}
          >
            {busy
              ? (stage === 'sending' ? 'Aplicando y enviando…' : 'Aplicando…')
              : hasCliente
                ? 'Confirmar, generar y enviar a firma'
                : 'Confirmar y generar acta(s)'}
          </button>
        )}
      </div>
    </ModalShell>
  )
}

// ── Step 1: datos de envío al cliente ────────────────────────────────────────
function ClientStep({
  summary, projectClient,
}: {
  summary: { cliente: { count: number; total: number }; interna: { count: number; total: number } }
  projectClient: { nombre: string; nif: string | null; email: string | null } | null
}) {
  return (
    <>
      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.55, marginBottom: 14 }}>
        Se generará la acta cliente y se enviará a la propiedad para firma vía DocuSign. Hasta que el cliente firme,
        los cambios cliente aparecerán como “pendiente aprobación” en la tabla y los pagos al EP relacionados quedarán en
        “pendiente aprobación”. Si hay cambios internos, esos se aplicarán inmediatamente.
      </div>

      {summary.interna.count > 0 && (
        <SummaryCard kind="interna" count={summary.interna.count} total={summary.interna.total} />
      )}
      <SummaryCard kind="cliente" count={summary.cliente.count} total={summary.cliente.total} />

      <div style={{
        marginTop: 14,
        background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
        padding: '14px 16px',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#1E40AF', marginBottom: 8,
        }}>
          Acta cliente — datos de envío
        </div>
        {projectClient?.email ? (
          <>
            <div style={{ fontSize: 12, color: '#1A1A1A', marginBottom: 6 }}>
              <strong>{projectClient.nombre}</strong>
              {projectClient.nif && (
                <span style={{ color: '#666', marginLeft: 8 }}>· NIF {projectClient.nif}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#1A1A1A', fontFamily: 'monospace' }}>
              📧 {projectClient.email}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#9A3412', lineHeight: 1.5 }}>
            ⚠ No se encontró el email del cliente. Configura el cliente del proyecto vinculado
            antes de cerrar, o cancela la sesión.
          </div>
        )}
      </div>
    </>
  )
}

// ── Step 2: impacto en plazos ─────────────────────────────────────────────────
function ImpactStep({
  affectsPlanning, setAffectsPlanning,
  phaseDeltas, setPhaseDeltas,
  candidatePhases, chapterNames,
  phaseImpactsTotal, gateInfo,
  summary,
}: {
  affectsPlanning: 'no' | 'yes'
  setAffectsPlanning: (v: 'no' | 'yes') => void
  phaseDeltas: Record<string, string>
  setPhaseDeltas: React.Dispatch<React.SetStateAction<Record<string, string>>>
  candidatePhases: ObraPhase[]
  chapterNames: Record<string, string>
  phaseImpactsTotal: number
  gateInfo: string
  summary: { cliente: { count: number; total: number }; interna: { count: number; total: number } }
}) {
  return (
    <>
      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.55, marginBottom: 14 }}>
        {summary.cliente.count > 0 && (
          <>Acta cliente: {summary.cliente.count} cambios · </>
        )}
        {summary.interna.count > 0 && (
          <>Acta interna: {summary.interna.count} cambios · </>
        )}
        <span style={{ color: '#888' }}>{gateInfo}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <RadioBtn
          label="Sin impacto en duración"
          active={affectsPlanning === 'no'}
          color="#1A1A1A"
          onClick={() => setAffectsPlanning('no')}
        />
        <RadioBtn
          label="Sí, afecta plazos"
          active={affectsPlanning === 'yes'}
          color="#D85A30"
          onClick={() => setAffectsPlanning('yes')}
        />
      </div>

      {affectsPlanning === 'yes' && (
        <div style={{
          border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 110px 110px',
            gap: 8, padding: '8px 14px', background: '#FAFAF8',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#888',
          }}>
            <div>Capítulo · Fase</div>
            <div style={{ textAlign: 'right' }}>Duración actual</div>
            <div style={{ textAlign: 'right' }}>± días háb.</div>
          </div>
          {candidatePhases.length === 0 && (
            <div style={{ padding: '14px 14px', fontSize: 11, color: '#888' }}>
              No hay fases candidatas para los capítulos afectados.
            </div>
          )}
          {candidatePhases.map(ph => {
            const chName = chapterNames[ph.chapter_id ?? ''] ?? '—'
            const dur = ph.planned_duration_dias ?? 0
            return (
              <div key={ph.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 110px 110px',
                gap: 8, padding: '8px 14px',
                borderTop: '1px solid #F0EEE8', alignItems: 'center',
              }}>
                <div style={{ fontSize: 11.5 }}>
                  <div style={{ color: '#888', fontSize: 10 }}>{chName}</div>
                  <div style={{ color: '#1A1A1A', fontWeight: 500 }}>{ph.nombre}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: '#666', fontVariantNumeric: 'tabular-nums' }}>
                  {dur} días háb.
                </div>
                <div>
                  <input
                    type="number"
                    step="1"
                    placeholder="0"
                    value={phaseDeltas[ph.id] ?? ''}
                    onChange={e => setPhaseDeltas(s => ({ ...s, [ph.id]: e.target.value }))}
                    style={{
                      width: '100%', padding: '6px 8px', fontSize: 12,
                      border: '1px solid #E8E6E0', borderRadius: 5,
                      fontFamily: 'inherit', textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </div>
              </div>
            )
          })}
          {phaseImpactsTotal !== 0 && (
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 14,
              padding: '10px 14px', background: '#FAFAF8',
              borderTop: '2px solid #1A1A1A',
              fontSize: 12, fontWeight: 700, color: phaseImpactsTotal > 0 ? '#D85A30' : '#059669',
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: '#888', fontWeight: 500 }}>Total acumulado:</span>
              <span>{phaseImpactsTotal >= 0 ? '+' : ''}{phaseImpactsTotal} días háb.</span>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function RadioBtn({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px', fontSize: 12, fontWeight: 600,
        borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
        background: active ? color : '#F8F7F4',
        color:      active ? '#fff' : '#666',
        border:     `1px solid ${active ? color : '#E8E6E0'}`,
      }}
    >
      {label}
    </button>
  )
}

function SummaryCard({ kind, count, total }: { kind: 'cliente' | 'interna'; count: number; total: number }) {
  const isPositive = total > 0
  const color   = isPositive ? '#D85A30' : total < 0 ? '#059669' : '#888'
  return (
    <div style={{
      border: '1px solid #E8E6E0', borderLeftWidth: 3, borderLeftColor: kind === 'cliente' ? '#378ADD' : '#7C3AED',
      borderRadius: 6, padding: '10px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888' }}>
          Acta {kind}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginTop: 2 }}>
          {count} cambio{count !== 1 ? 's' : ''}
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {total >= 0 ? '+' : ''}{total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
      </div>
    </div>
  )
}
