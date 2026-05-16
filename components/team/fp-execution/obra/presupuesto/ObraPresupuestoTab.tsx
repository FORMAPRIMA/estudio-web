'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  buildPresupuestoView,
  presupuestoTotals,
  type ObraUnitRaw,
  type ObraLineItemRaw,
  type ObraChangeSession,
  type ObraActaRow,
  type UIPartida,
  type UIUnit,
  type UIChapter,
} from '@/lib/fp-execution/obra-presupuesto'
import {
  openObraChangeSession,
  cancelObraChangeSession,
  removeChangeLog,
} from '@/app/actions/fpe-obra-presupuesto'
import PresupuestoTable from './PresupuestoTable'
import EditPartidaModal from './EditPartidaModal'
import NewPartidaModal from './NewPartidaModal'
import NewUnitModal from './NewUnitModal'
import DeleteModal from './DeleteModal'
import CloseSessionModal from './CloseSessionModal'
import ActasList from './ActasList'

export default function ObraPresupuestoTab({
  projectId,
  chapters,
  partners,
  partnerNames,
  obraUnits,
  obraLineItems,
  obraUnitPartners,
  obraSession,
  obraActas,
}: {
  projectId:        string
  chapters:         Array<{ id: string; nombre: string; orden: number }>
  partners:         Array<{ id: string; nombre: string }>
  partnerNames:     Record<string, string>
  obraUnits:        unknown[]
  obraLineItems:    unknown[]
  obraUnitPartners: { obra_unit_id: string; partner_id: string }[]
  obraSession:      ObraChangeSession | null
  obraActas:        unknown[]
}) {
  const router = useRouter()

  // ── Construir vista efectiva ──────────────────────────────────────────────
  const view = useMemo(() => buildPresupuestoView({
    units:          obraUnits as ObraUnitRaw[],
    lineItems:      obraLineItems as ObraLineItemRaw[],
    unitPartners:   obraUnitPartners,
    partnerNames,
    chapters,
    pendingChanges: obraSession?.log ?? [],
  }), [obraUnits, obraLineItems, obraUnitPartners, partnerNames, chapters, obraSession])

  const { perChapter, grand } = useMemo(() => presupuestoTotals(view), [view])

  const session  = obraSession
  const editable = !!(session && session.status === 'open')
  const pendingCount = session?.log.length ?? 0

  // ── Modal state ───────────────────────────────────────────────────────────
  type EditModalCtx   = { kind: 'edit_partida'; p: UIPartida; u: UIUnit; ch: UIChapter }
  type NewPModalCtx   = { kind: 'new_partida'; u: UIUnit; ch: UIChapter }
  type NewUModalCtx   = { kind: 'new_unit'; ch: UIChapter }
  type DelModalCtx    = { kind: 'delete'; target: 'partida' | 'unit'; id: string; label: string; total: number }
  type CloseModalCtx  = { kind: 'close' }
  type ModalCtx       = EditModalCtx | NewPModalCtx | NewUModalCtx | DelModalCtx | CloseModalCtx | null
  const [modal, setModal] = useState<ModalCtx>(null)
  const closeModal = () => setModal(null)
  const onSaved   = () => { closeModal(); router.refresh() }

  // ── Session actions ───────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)
  const [highlightedActaIds, setHighlightedActaIds] = useState<string[]>([])

  const handleOpenSession = async () => {
    setBusy(true); setErr(null)
    const res = await openObraChangeSession(projectId)
    setBusy(false)
    if ('error' in res) { setErr(res.error); return }
    router.refresh()
  }

  const handleCancelSession = async () => {
    if (!session) return
    if (pendingCount > 0 && !confirm(`Hay ${pendingCount} cambio${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}. ¿Cancelar la sesión y descartarlos?`)) return
    setBusy(true); setErr(null)
    const res = await cancelObraChangeSession(session.id)
    setBusy(false)
    if ('error' in res) { setErr(res.error); return }
    router.refresh()
  }

  const handleUndoPending = async (logId: string) => {
    setBusy(true); setErr(null)
    const res = await removeChangeLog(logId)
    setBusy(false)
    if ('error' in res) { setErr(res.error); return }
    router.refresh()
  }

  const handleSessionClosed = (actaIds: string[]) => {
    setModal(null)
    setHighlightedActaIds(actaIds)
    router.refresh()
  }

  const handleSendToDocuSign = async (actaId: string) => {
    try {
      const res = await fetch(`/api/obra/actas/${actaId}/docusign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Error enviando a DocuSign: ${data.error ?? 'desconocido'}`)
        return
      }
      router.refresh()
    } catch (err) {
      alert(`Error enviando a DocuSign: ${err instanceof Error ? err.message : 'desconocido'}`)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Session control bar */}
      <div style={{
        background: editable ? '#FFF7ED' : '#fff',
        border: editable ? '1px solid #FED7AA' : '1px solid #E8E6E0',
        borderRadius: 8, padding: '12px 18px',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        {editable ? (
          <>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: '#9A3412', background: '#FED7AA', padding: '3px 8px', borderRadius: 4,
            }}>
              Sesión activa
            </span>
            <span style={{ fontSize: 12, color: '#9A3412', fontWeight: 600 }}>
              {pendingCount} cambio{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
            </span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              onClick={handleCancelSession}
              disabled={busy}
              style={{
                background: 'transparent', border: '1px solid #FED7AA', borderRadius: 6,
                padding: '7px 14px', fontSize: 11, fontWeight: 600, color: '#9A3412',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Cancelar sesión</button>
            <button
              type="button"
              onClick={() => setModal({ kind: 'close' })}
              disabled={busy || pendingCount === 0}
              style={{
                background: pendingCount === 0 ? '#CCC' : '#D85A30', border: 'none', borderRadius: 6,
                padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#fff',
                cursor: pendingCount === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >Cerrar y generar acta(s)</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>
              Presupuesto bloqueado. Inicia una sesión de cambios para modificar partidas o añadir nuevas.
            </span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              onClick={handleOpenSession}
              disabled={busy}
              style={{
                background: '#D85A30', color: '#fff', border: 'none', borderRadius: 7,
                padding: '8px 16px', fontSize: 12, fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
                boxShadow: '0 1px 4px rgba(216,90,48,0.3)',
              }}
            >{busy ? 'Abriendo…' : 'Iniciar sesión de cambios'}</button>
          </>
        )}
        {err && (
          <div style={{ width: '100%', color: '#DC2626', fontSize: 11 }}>{err}</div>
        )}
      </div>

      {/* Tabla */}
      <PresupuestoTable
        view={view}
        perChapter={perChapter}
        grand={grand}
        editable={editable}
        onEditPartida={(p, u, ch) => setModal({ kind: 'edit_partida', p, u, ch })}
        onAddPartida={(u, ch)     => setModal({ kind: 'new_partida', u, ch })}
        onAddUnit={(ch)           => setModal({ kind: 'new_unit', ch })}
        onDeletePartida={(p, u, _ch) => setModal({
          kind: 'delete', target: 'partida', id: p.id,
          label: `${u.nombre} · ${p.nombre}`,
          total: p.cantidad * p.precio_unitario,
        })}
        onDeleteUnit={(u, _ch) => {
          const ueTotal = u.partidas.filter(p => !p.is_deleted).reduce((a, p) => a + p.cantidad * p.precio_unitario, 0)
          setModal({
            kind: 'delete', target: 'unit', id: u.id,
            label: u.nombre,
            total: ueTotal,
          })
        }}
        onUndoPending={handleUndoPending}
      />

      {/* Actas list */}
      <ActasList
        actas={obraActas as ObraActaRow[]}
        onSendToDocuSign={handleSendToDocuSign}
        highlightedActaIds={highlightedActaIds}
      />

      {/* Modals */}
      {modal?.kind === 'edit_partida' && session && (
        <EditPartidaModal
          sessionId={session.id}
          partida={modal.p}
          unidadNombre={modal.u.nombre}
          capituloNombre={modal.ch.nombre}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
      {modal?.kind === 'new_partida' && session && (
        <NewPartidaModal
          sessionId={session.id}
          obraUnitId={modal.u.id}
          unidadNombre={modal.u.nombre}
          capituloNombre={modal.ch.nombre}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
      {modal?.kind === 'new_unit' && session && (
        <NewUnitModal
          sessionId={session.id}
          chapterId={modal.ch.id}
          chapterNombre={modal.ch.nombre}
          partners={partners}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
      {modal?.kind === 'delete' && session && (
        <DeleteModal
          sessionId={session.id}
          kind={modal.target}
          targetId={modal.id}
          targetLabel={modal.label}
          totalMonto={modal.total}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
      {modal?.kind === 'close' && session && (
        <CloseSessionModal
          sessionId={session.id}
          log={session.log}
          onClose={closeModal}
          onClosed={handleSessionClosed}
        />
      )}
    </div>
  )
}
