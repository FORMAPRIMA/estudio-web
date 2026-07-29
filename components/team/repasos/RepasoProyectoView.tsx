'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import PlanoCanvas from './PlanoCanvas'
import type { PlanoCanvasHandle, PlanoPin } from './PlanoCanvas'
import RepasosList, { RepasosFiltros } from './RepasosList'
import RepasoModal from './RepasoModal'
import RepasoLinksModal from './RepasoLinksModal'
import {
  ESTADOS,
  FILTROS_VACIOS,
  aplicaFiltros,
  estadoColor,
  numeroDeCodigo,
  oficioLabel,
} from '@/lib/repasos/domain'
import type {
  Repaso,
  RepasoAudiencia,
  RepasoFiltros,
  RepasoPlano,
  RepasoProyecto,
  RepasoToken,
} from '@/lib/repasos/domain'
import { preparePlano, uploadPlano } from '@/lib/repasos/upload'
import { createRepasoPlano, moveRepaso } from '@/app/actions/repasos'

// Visor de repasos de un proyecto. El mismo componente sirve para el equipo
// (modo 'interno', con edición) y para los enlaces externos (modo 'presentacion',
// solo lectura). Los repasos que una audiencia externa no debe ver ya vienen
// filtrados desde el servidor: aquí nunca llegan.

type Placing =
  | { tipo: 'nuevo' }
  | { tipo: 'mover'; repaso: Repaso }
  | null

type ModalState =
  | { tipo: 'create'; punto: { x: number; y: number } }
  | { tipo: 'edit'; repaso: Repaso }
  | null

type Snap = 'collapsed' | 'half' | 'full'

interface Props {
  proyecto: RepasoProyecto
  planos: RepasoPlano[]
  repasos: Repaso[]
  modo: 'interno' | 'presentacion'
  audiencia?: RepasoAudiencia
  tokens?: RepasoToken[]
}

const SHEET_COLLAPSED = 62

export default function RepasoProyectoView({
  proyecto,
  planos,
  repasos,
  modo,
  audiencia,
  tokens = [],
}: Props) {
  const router = useRouter()
  const interno = modo === 'interno'

  const [planoId, setPlanoId] = useState(planos[0]?.id ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<RepasoFiltros>(FILTROS_VACIOS)
  const [placing, setPlacing] = useState<Placing>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [linksOpen, setLinksOpen] = useState(false)
  const [snap, setSnap] = useState<Snap>('collapsed')
  const [sheetH, setSheetH] = useState<number | null>(null)
  const [dragSheet, setDragSheet] = useState(false)
  const [subiendoPlano, setSubiendoPlano] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const canvasRef = useRef<PlanoCanvasHandle>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const mainH = useRef(0)
  const sheetInit = useRef(false)
  const planoInputRef = useRef<HTMLInputElement>(null)
  const sheetDrag = useRef<{ y: number; h: number } | null>(null)

  const plano = planos.find((p) => p.id === planoId) ?? planos[0]

  // Un plano sin dimensiones guardadas (subido antes de medirlo) se asume A3 apaisado.
  const imgW = plano?.width || 1600
  const imgH = plano?.height || Math.round((1600 * 297) / 420)

  const delPlano = useMemo(
    () => repasos.filter((r) => r.plano_id === plano?.id),
    [repasos, plano?.id]
  )

  const visibles = useMemo(
    () => delPlano.filter((r) => aplicaFiltros(r, filtros)),
    [delPlano, filtros]
  )

  const pins: PlanoPin[] = useMemo(
    () =>
      delPlano.map((r) => ({
        id: r.id,
        x: r.x,
        y: r.y,
        numero: numeroDeCodigo(r.codigo),
        codigo: r.codigo,
        color: estadoColor(r.estado),
        dimmed: !visibles.some((v) => v.id === r.id),
      })),
    [delPlano, visibles]
  )

  const selected = delPlano.find((r) => r.id === selectedId) ?? null

  // ── Medida del área principal (para los topes del bottom sheet) ─────────────

  useLayoutEffect(() => {
    const el = mainRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      mainH.current = entry.contentRect.height
      // Solo la primera medida fija la altura: si no, cada cambio de viewport
      // (barra del navegador, teclado) replegaría el sheet.
      if (!sheetInit.current) {
        sheetInit.current = true
        setSheetH(SHEET_COLLAPSED)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const snapTargets = useCallback(() => {
    const h = mainH.current || 600
    return { collapsed: SHEET_COLLAPSED, half: Math.round(h * 0.46), full: Math.round(h * 0.9) }
  }, [])

  const goSnap = useCallback(
    (s: Snap) => {
      setSnap(s)
      setSheetH(snapTargets()[s])
    },
    [snapTargets]
  )

  // ── Selección ───────────────────────────────────────────────────────────────

  const seleccionarDesdePlano = (id: string) => {
    // Segundo toque sobre el pin ya seleccionado = abrir la ficha.
    if (id === selectedId) {
      const r = delPlano.find((x) => x.id === id)
      if (r) setModal({ tipo: 'edit', repaso: r })
      return
    }
    setSelectedId(id)
    if (snap === 'collapsed') goSnap('half')
  }

  const seleccionarDesdeLista = (id: string) => {
    setSelectedId(id)
    const r = delPlano.find((x) => x.id === id)
    if (r) canvasRef.current?.focusPoint(r.x, r.y)
  }

  const abrirRepaso = (id: string) => {
    const r = delPlano.find((x) => x.id === id)
    if (r) setModal({ tipo: 'edit', repaso: r })
  }

  // ── Modo colocación ─────────────────────────────────────────────────────────

  const empezarNuevo = () => {
    setPlacing({ tipo: 'nuevo' })
    setGhost(null)
    setSelectedId(null)
    goSnap('collapsed')
  }

  const cancelarColocacion = () => {
    setPlacing(null)
    setGhost(null)
  }

  async function confirmarPosicion() {
    if (!ghost || !placing) return
    if (placing.tipo === 'nuevo') {
      const punto = ghost
      setPlacing(null)
      setGhost(null)
      setModal({ tipo: 'create', punto })
      return
    }
    const r = placing.repaso
    const res = await moveRepaso(r.id, ghost.x, ghost.y, plano.id)
    setPlacing(null)
    setGhost(null)
    if ('error' in res) setAviso(res.error)
    else router.refresh()
  }

  // ── Planos ──────────────────────────────────────────────────────────────────

  async function anadirPlano(file: File | undefined) {
    if (!file) return
    setSubiendoPlano(true)
    setAviso(null)
    const prep = await preparePlano(file)
    if ('error' in prep) {
      setSubiendoPlano(false)
      setAviso(prep.error)
      return
    }
    const up = await uploadPlano(prep)
    if ('error' in up) {
      setSubiendoPlano(false)
      setAviso(up.error)
      return
    }
    const res = await createRepasoPlano(proyecto.id, {
      nombre: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Plano',
      img_url: up.img_url,
      pdf_url: up.pdf_url,
      width: prep.width,
      height: prep.height,
    })
    setSubiendoPlano(false)
    if ('error' in res) setAviso(res.error)
    else {
      setPlanoId(res.plano.id)
      router.refresh()
    }
  }

  // ── Cierre del modal con refresco ───────────────────────────────────────────

  const cerrarModal = () => setModal(null)

  const trasGuardar = (r: Repaso) => {
    setSelectedId(r.id)
    router.refresh()
  }

  const trasBorrar = () => {
    setSelectedId(null)
    setModal(null)
    router.refresh()
  }

  // Aviso efímero
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  // ── Panel de lista (compartido por sidebar y sheet) ──────────────────────────

  const contadores = ESTADOS.map((e) => ({
    ...e,
    n: delPlano.filter((r) => r.estado === e.id).length,
  }))

  const panelLista = (
    <>
      <RepasosFiltros repasos={delPlano} filtros={filtros} setFiltros={setFiltros} modo={modo} />
      <RepasosList
        repasos={delPlano}
        filtros={filtros}
        numeroDe={(id) => numeroDeCodigo(delPlano.find((r) => r.id === id)?.codigo ?? '')}
        selectedId={selectedId}
        onSelect={seleccionarDesdeLista}
        onOpen={abrirRepaso}
        modo={modo}
      />
    </>
  )

  if (!plano) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#1A1A1A80', fontWeight: 300 }}>
          Este proyecto no tiene ningún plano cargado.
        </p>
      </div>
    )
  }

  return (
    <div className={`rp-shell${interno ? '' : ' rp-shell-public'}`}>
      {/* ── Cabecera ── */}
      <header
        style={{
          flexShrink: 0,
          background: '#fff',
          borderBottom: '1px solid #E8E6E0',
          padding: '10px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {interno ? (
            <Link
              href="/team/apps/repasos"
              aria-label="Volver"
              style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: 4,
                border: '1px solid #E2E0D9', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none', color: '#1A1A1A', fontSize: 14,
              }}
            >
              ←
            </Link>
          ) : (
            <span
              style={{
                fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
                color: '#1A1A1A99', flexShrink: 0,
              }}
            >
              Forma Prima
            </span>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontSize: 14.5, fontWeight: 400, color: '#1A1A1A', margin: 0,
                letterSpacing: '-0.01em', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {proyecto.nombre}
            </h1>
            <p
              style={{
                fontSize: 10.5, color: '#1A1A1A70', margin: '2px 0 0', fontWeight: 300,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {interno
                ? [proyecto.direccion, proyecto.cliente].filter(Boolean).join(' · ') || 'Repasos de obra'
                : `Repasos de obra${audiencia === 'constructora' ? ' · constructora' : ''}`}
            </p>
          </div>

          {interno && (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                className="rp-btn rp-btn-ghost"
                onClick={() => planoInputRef.current?.click()}
                disabled={subiendoPlano}
                style={{ padding: '8px 10px', fontSize: 11 }}
                title="Añadir otro plano o planta"
              >
                {subiendoPlano ? '…' : '+ Plano'}
              </button>
              <button
                className="rp-btn rp-btn-primary"
                onClick={() => setLinksOpen(true)}
                style={{ padding: '8px 12px', fontSize: 11 }}
              >
                Compartir
              </button>
            </div>
          )}
        </div>

        {/* Plantas + contadores */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginTop: 9, overflowX: 'auto',
          }}
          className="rp-chips"
        >
          {planos.length > 1 &&
            planos.map((p) => (
              <button
                key={p.id}
                className={`rp-chip${p.id === plano.id ? ' rp-chip-active' : ''}`}
                onClick={() => {
                  setPlanoId(p.id)
                  setSelectedId(null)
                  cancelarColocacion()
                }}
              >
                {p.nombre}
              </button>
            ))}

          <div style={{ display: 'flex', gap: 9, marginLeft: planos.length > 1 ? 4 : 0, flexShrink: 0 }}>
            {contadores.map((c) => (
              <span
                key={c.id}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#1A1A1A80' }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color }} />
                {c.n} {c.label.toLowerCase()}
              </span>
            ))}
          </div>
        </div>

        <input
          ref={planoInputRef}
          type="file"
          accept="application/pdf,image/*"
          hidden
          onChange={(e) => {
            anadirPlano(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </header>

      {/* ── Cuerpo ── */}
      <div className="rp-main" ref={mainRef}>
        <div className="rp-canvas-wrap">
          <PlanoCanvas
            ref={canvasRef}
            src={plano.img_url}
            imgW={imgW}
            imgH={imgH}
            pins={pins}
            selectedId={selectedId}
            onSelectPin={seleccionarDesdePlano}
            placing={!!placing}
            ghost={ghost}
            onPlace={(p) => setGhost(p)}
            onBackgroundTap={() => setSelectedId(null)}
          />

          {/* Banner del modo colocación */}
          {placing && (
            <div
              style={{
                position: 'absolute', top: 10, left: 10, right: 10, zIndex: 20,
                background: 'rgba(26,26,26,0.92)', color: '#fff',
                borderRadius: 4, padding: '10px 13px',
                display: 'flex', alignItems: 'center', gap: 10,
                backdropFilter: 'blur(6px)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 300, flex: 1, lineHeight: 1.4 }}>
                {ghost
                  ? 'Arrastra el punto para ajustarlo y confirma la posición.'
                  : placing.tipo === 'mover'
                    ? `Toca la nueva posición de ${placing.repaso.codigo}.`
                    : 'Toca el plano para situar el repaso.'}
              </span>
            </div>
          )}

          {/* Barra inferior del modo colocación */}
          {placing && (
            <div
              style={{
                position: 'absolute', left: 10, right: 10, bottom: 14, zIndex: 26,
                display: 'flex', gap: 8,
              }}
            >
              <button className="rp-btn rp-btn-ghost" onClick={cancelarColocacion} style={{ flexShrink: 0 }}>
                Cancelar
              </button>
              <button
                className="rp-btn rp-btn-accent"
                style={{ flex: 1 }}
                disabled={!ghost}
                onClick={confirmarPosicion}
              >
                {ghost ? 'Confirmar posición' : 'Toca el plano…'}
              </button>
            </div>
          )}

          {/* FAB */}
          {interno && !placing && !modal && (
            <button className="rp-fab" onClick={empezarNuevo}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Agregar repaso
            </button>
          )}

          {/* Chip del repaso seleccionado (móvil, sheet plegado) */}
          {selected && snap === 'collapsed' && !placing && (
            <button
              onClick={() => setModal({ tipo: 'edit', repaso: selected })}
              style={{
                position: 'absolute', left: 10, top: 10, zIndex: 20,
                maxWidth: 'calc(100% - 20px)',
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid #E2E0D9', borderRadius: 4,
                padding: '8px 11px', textAlign: 'left', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span
                style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: estadoColor(selected.estado), color: '#fff',
                  fontSize: 9.5, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {numeroDeCodigo(selected.codigo)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#1A1A1A' }}>
                  {selected.codigo}
                </span>
                <span
                  style={{
                    display: 'block', fontSize: 11, color: '#1A1A1A90',
                    fontWeight: 300, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 210,
                  }}
                >
                  {selected.descripcion || 'Sin descripción'}
                </span>
              </span>
            </button>
          )}

          {aviso && (
            <div
              style={{
                position: 'absolute', left: 10, right: 10, top: 10, zIndex: 40,
                background: '#B03A2E', color: '#fff', borderRadius: 4,
                padding: '10px 13px', fontSize: 11.5, fontWeight: 300,
              }}
            >
              {aviso}
            </div>
          )}

          {/* Bottom sheet (móvil) */}
          <div
            className="rp-sheet"
            style={{
              height: sheetH ?? SHEET_COLLAPSED,
              transition: dragSheet ? 'none' : undefined,
            }}
          >
            <div
              className="rp-sheet-handle"
              onPointerDown={(e) => {
                ;(e.target as Element).setPointerCapture?.(e.pointerId)
                sheetDrag.current = { y: e.clientY, h: sheetH ?? SHEET_COLLAPSED }
                setDragSheet(true)
              }}
              onPointerMove={(e) => {
                if (!sheetDrag.current) return
                const dy = sheetDrag.current.y - e.clientY
                const max = snapTargets().full
                setSheetH(Math.min(max, Math.max(SHEET_COLLAPSED, sheetDrag.current.h + dy)))
              }}
              onPointerUp={() => {
                if (!sheetDrag.current) return
                sheetDrag.current = null
                setDragSheet(false)
                const t = snapTargets()
                const h = sheetH ?? SHEET_COLLAPSED
                const closest = (['collapsed', 'half', 'full'] as Snap[]).reduce((best, s) =>
                  Math.abs(t[s] - h) < Math.abs(t[best] - h) ? s : best
                )
                goSnap(closest)
              }}
              onClick={() => {
                if (dragSheet) return
                goSnap(snap === 'collapsed' ? 'half' : snap === 'half' ? 'full' : 'collapsed')
              }}
            >
              <span />
            </div>

            <div
              onClick={() => snap === 'collapsed' && goSnap('half')}
              style={{
                padding: '0 14px 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: snap === 'collapsed' ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 12, color: '#1A1A1A', fontWeight: 400 }}>
                {visibles.length === delPlano.length
                  ? `${delPlano.length} repasos`
                  : `${visibles.length} de ${delPlano.length} repasos`}
              </span>
              <span style={{ fontSize: 10.5, color: '#1A1A1A60' }}>
                {snap === 'collapsed' ? 'Ver lista ↑' : 'Ocultar ↓'}
              </span>
            </div>

            <div className="rp-sheet-body">{panelLista}</div>
          </div>
        </div>

        {/* Panel lateral (desktop) */}
        <aside className="rp-side">
          <div className="rp-side-body">{panelLista}</div>
        </aside>
      </div>

      {/* ── Modales ── */}
      {modal && interno && (
        <RepasoModal
          modo={modal.tipo}
          proyectoId={proyecto.id}
          planoId={plano.id}
          punto={modal.tipo === 'create' ? modal.punto : null}
          repaso={modal.tipo === 'edit' ? modal.repaso : null}
          numero={
            modal.tipo === 'edit'
              ? numeroDeCodigo(modal.repaso.codigo)
              : delPlano.length + 1
          }
          onClose={cerrarModal}
          onSaved={trasGuardar}
          onDeleted={trasBorrar}
          onMoverPin={(r) => {
            setModal(null)
            setPlacing({ tipo: 'mover', repaso: r })
            setGhost({ x: r.x, y: r.y })
            goSnap('collapsed')
          }}
        />
      )}

      {modal && !interno && modal.tipo === 'edit' && (
        <RepasoDetallePublico repaso={modal.repaso} onClose={cerrarModal} />
      )}

      {linksOpen && interno && (
        <RepasoLinksModal
          proyectoId={proyecto.id}
          proyectoNombre={proyecto.nombre}
          tokens={tokens}
          repasos={repasos}
          onClose={() => setLinksOpen(false)}
          onChange={() => router.refresh()}
        />
      )}
    </div>
  )
}

// ─── Ficha de solo lectura (modo presentación) ─────────────────────────────────

function RepasoDetallePublico({ repaso, onClose }: { repaso: Repaso; onClose: () => void }) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const estado = ESTADOS.find((e) => e.id === repaso.estado)

  return (
    <div className="rp-backdrop" role="dialog" aria-modal="true">
      <div className="rp-modal">
        <div className="rp-modal-head">
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>
              {repaso.codigo}
            </h2>
            <p style={{ fontSize: 10.5, color: '#1A1A1A60', margin: '5px 0 0', fontWeight: 300 }}>
              {estado?.label}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 4,
              border: '1px solid #E2E0D9', background: '#fff',
              fontSize: 15, cursor: 'pointer', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div className="rp-modal-body">
          {repaso.fotos.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 8, marginBottom: 18,
              }}
            >
              {repaso.fotos.map((f) => (
                <div
                  key={f.id}
                  style={{
                    position: 'relative', aspectRatio: '1', borderRadius: 4,
                    overflow: 'hidden', background: '#F0EEE8',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt=""
                    onClick={() => setLightbox(f.url)}
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      display: 'block', cursor: 'zoom-in',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute', left: 4, bottom: 4,
                      fontSize: 9, padding: '2px 5px', borderRadius: 3,
                      background: f.tipo === 'despues' ? '#2D7D5AE0' : '#1A1A1AB0',
                      color: '#fff',
                    }}
                  >
                    {f.tipo === 'despues' ? 'Resuelto' : 'Incidencia'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p
            style={{
              fontSize: 13.5, color: '#1A1A1A', lineHeight: 1.6,
              fontWeight: 300, margin: '0 0 18px',
            }}
          >
            {repaso.descripcion || 'Sin descripción.'}
          </p>

          <dl style={{ margin: 0, display: 'grid', gap: 10 }}>
            <Dato label="Oficio" valor={repaso.oficio} oficio />
            <Dato label="Estado" valor={estado?.label ?? repaso.estado} />
            {repaso.responsable && <Dato label="Responsable" valor={repaso.responsable} />}
          </dl>
        </div>

        <div className="rp-modal-foot">
          <button className="rp-btn rp-btn-primary" style={{ flex: 1 }} onClick={onClose}>
            Cerrar
          </button>
        </div>

        {lightbox && (
          <div
            onClick={() => setLightbox(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              background: 'rgba(10,10,10,0.94)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16, cursor: 'zoom-out',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function Dato({ label, valor, oficio }: { label: string; valor: string; oficio?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <dt style={{ fontSize: 11, color: '#1A1A1A70', fontWeight: 300 }}>{label}</dt>
      <dd style={{ fontSize: 12, color: '#1A1A1A', margin: 0, fontWeight: 400, textAlign: 'right' }}>
        {oficio ? oficioLabel(valor) : valor}
      </dd>
    </div>
  )
}
