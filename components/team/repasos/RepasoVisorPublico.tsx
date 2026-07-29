'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  estadoColor,
  estadoLabel,
  fmtFecha,
  numeroDeCodigo,
  oficioLabel,
} from '@/lib/repasos/domain'
import type { Repaso } from '@/lib/repasos/domain'

// Visor de repasos del portal externo (cliente y constructora).
//
// La foto es la protagonista: ocupa toda la ficha y los datos van montados
// encima, no debajo. Quien mira esto está comparando lo que ve en su casa u obra
// con lo que le señalamos, así que el orden de importancia es foto > descripción
// > estado, y todo lo demás es secundario.
//
// Se abre con UN solo toque, desde el pin del plano o desde la lista, y de ahí se
// puede recorrer el resto de repasos sin volver atrás.

interface Props {
  /** Repasos en el mismo orden en que se ven en la lista. */
  repasos: Repaso[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  onVerEnPlano: (repaso: Repaso) => void
}

const SWIPE_MIN = 55

export default function RepasoVisorPublico({
  repasos,
  index,
  onIndex,
  onClose,
  onVerEnPlano,
}: Props) {
  const repaso = repasos[index]
  const [foto, setFoto] = useState(0)
  const [datosVisibles, setDatosVisibles] = useState(true)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  const ir = useCallback(
    (delta: number) => {
      const siguiente = index + delta
      if (siguiente < 0 || siguiente >= repasos.length) return
      onIndex(siguiente)
    },
    [index, repasos.length, onIndex]
  )

  // Al cambiar de repaso se vuelve a su primera foto y se muestran los datos.
  useEffect(() => {
    setFoto(0)
    setDatosVisibles(true)
  }, [repaso?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') ir(1)
      if (e.key === 'ArrowLeft') ir(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ir, onClose])

  if (!repaso) return null

  const fotos = repaso.fotos
  const actual = fotos[Math.min(foto, Math.max(0, fotos.length - 1))]
  const color = estadoColor(repaso.estado)

  return (
    <div className="rp-visor" role="dialog" aria-modal="true">
      <div className="rp-visor-card">
        {/* ── Foto ── */}
        <div
          className="rp-visor-foto"
          onPointerDown={(e) => {
            swipe.current = { x: e.clientX, y: e.clientY }
          }}
          onPointerUp={(e) => {
            const inicio = swipe.current
            swipe.current = null
            if (!inicio) return
            // Si el toque cae en un control, no hacemos nada: ocultar los datos
            // desmontaría el botón antes de que llegase su click (y «Ver dónde
            // está en el plano» no llegaba a ejecutarse nunca).
            if ((e.target as HTMLElement).closest('button')) return
            const dx = e.clientX - inicio.x
            const dy = e.clientY - inicio.y
            // Arrastre horizontal = cambiar de repaso; toque limpio = mostrar u
            // ocultar los datos para ver la foto sin nada encima.
            if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
              ir(dx < 0 ? 1 : -1)
            } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
              setDatosVisibles((v) => !v)
            }
          }}
        >
          {actual ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={actual.url} alt={`Repaso ${repaso.codigo}`} className="rp-visor-img" />
          ) : (
            <div className="rp-visor-sinfoto">
              <p style={{ fontSize: 30, margin: '0 0 12px', opacity: 0.5 }}>◻</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', margin: 0, fontWeight: 300 }}>
                Este repaso no tiene fotografía
              </p>
            </div>
          )}

          {/* Estado y código, siempre visibles sobre la foto */}
          <div className="rp-visor-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                className="rp-visor-num"
                style={{ background: color }}
                title={repaso.codigo}
              >
                {numeroDeCodigo(repaso.codigo)}
              </span>
              <span className="rp-visor-estado" style={{ background: color }}>
                {estadoLabel(repaso.estado)}
              </span>
            </div>
            <button className="rp-visor-cerrar" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>

          {/* Selector de fotos: con incidencia y evidencia de resuelto, el
              contraste entre las dos es lo más informativo que hay. */}
          {fotos.length > 1 && datosVisibles && (
            <div className="rp-visor-fotos">
              {fotos.map((f, i) => (
                <button
                  key={f.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    setFoto(i)
                  }}
                  className={`rp-visor-tab${i === foto ? ' rp-visor-tab-on' : ''}`}
                >
                  {f.tipo === 'despues' ? 'Resuelto' : 'Incidencia'}
                  {fotos.filter((x) => x.tipo === f.tipo).length > 1 ? ` ${i + 1}` : ''}
                </button>
              ))}
            </div>
          )}

          {/* Datos montados sobre la foto */}
          {datosVisibles && (
            <div className="rp-visor-info">
              <p className="rp-visor-desc">
                {repaso.descripcion || 'Sin descripción.'}
              </p>
              <div className="rp-visor-meta">
                <span className="rp-visor-oficio">{oficioLabel(repaso.oficio)}</span>
                <span>{repaso.codigo}</span>
                {repaso.responsable && <span>{repaso.responsable}</span>}
                {repaso.resuelto_at ? (
                  <span>Resuelto el {fmtFecha(repaso.resuelto_at)}</span>
                ) : (
                  <span>Detectado el {fmtFecha(repaso.created_at)}</span>
                )}
              </div>
              <button
                className="rp-visor-plano"
                onClick={(e) => {
                  e.stopPropagation()
                  onVerEnPlano(repaso)
                }}
              >
                Ver dónde está en el plano
              </button>
            </div>
          )}
        </div>

        {/* ── Navegación entre repasos ── */}
        <div className="rp-visor-nav">
          <button onClick={() => ir(-1)} disabled={index === 0} aria-label="Repaso anterior">
            ‹ Anterior
          </button>
          <span className="rp-visor-contador">
            {index + 1} de {repasos.length}
          </span>
          <button
            onClick={() => ir(1)}
            disabled={index >= repasos.length - 1}
            aria-label="Repaso siguiente"
          >
            Siguiente ›
          </button>
        </div>
      </div>
    </div>
  )
}
