'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ESTADOS,
  OFICIOS,
  PRIORIDADES,
  VISIBILIDADES,
  estadoColor,
  eventoTexto,
  fmtFechaHora,
  oficioColor,
  oficioLabel,
} from '@/lib/repasos/domain'
import type {
  Repaso,
  RepasoEstado,
  RepasoFotoTipo,
  RepasoPrioridad,
  RepasoVisibilidad,
} from '@/lib/repasos/domain'
import { uploadFoto } from '@/lib/repasos/upload'
import {
  createRepaso,
  createRepasoFoto,
  deleteRepaso,
  deleteRepasoFoto,
  updateRepaso,
} from '@/app/actions/repasos'

// Modal de alta/edición de un repaso.
//
// Reglas de la ventana (explícitas, no accidentales):
//  · NO se cierra al tocar fuera. En obra, con el móvil en una mano, el toque
//    fuera es constante y perder una foto recién hecha es inaceptable.
//  · Al cerrar con cambios pendientes pregunta: guardar / descartar / seguir.
//  · En alta, el borrador se guarda en localStorage: si el navegador mata la
//    pestaña (habitual en móvil al abrir la cámara) no se pierde nada.
//  · Las fotos de un repaso ya existente se aplican al instante, no al guardar:
//    la foto es el dato caro de recuperar.

interface FormState {
  oficio: string
  descripcion: string
  estado: RepasoEstado
  visibilidad: RepasoVisibilidad
  prioridad: RepasoPrioridad
  fecha_objetivo: string
  responsable: string
}

interface FotoState {
  id?: string
  url: string
  tipo: RepasoFotoTipo
}

interface Props {
  modo: 'create' | 'edit'
  proyectoId: string
  planoId: string
  punto: { x: number; y: number } | null
  repaso: Repaso | null
  numero: number
  onClose: () => void
  onSaved: (r: Repaso) => void
  onDeleted: (id: string) => void
  onMoverPin: (r: Repaso) => void
}

const FORM_VACIO: FormState = {
  oficio: 'otros',
  descripcion: '',
  estado: 'detectado',
  visibilidad: 'interno',
  prioridad: 'media',
  fecha_objetivo: '',
  responsable: '',
}

const draftKey = (proyectoId: string) => `rp:draft:${proyectoId}`

export default function RepasoModal({
  modo,
  proyectoId,
  planoId,
  punto,
  repaso,
  numero,
  onClose,
  onSaved,
  onDeleted,
  onMoverPin,
}: Props) {
  const inicial: FormState = useMemo(
    () =>
      repaso
        ? {
            oficio: repaso.oficio,
            descripcion: repaso.descripcion ?? '',
            estado: repaso.estado,
            visibilidad: repaso.visibilidad,
            prioridad: repaso.prioridad,
            fecha_objetivo: repaso.fecha_objetivo ?? '',
            responsable: repaso.responsable ?? '',
          }
        : FORM_VACIO,
    [repaso]
  )

  const [form, setForm] = useState<FormState>(inicial)
  const [fotos, setFotos] = useState<FotoState[]>(repaso?.fotos ?? [])
  const [tipoFoto, setTipoFoto] = useState<RepasoFotoTipo>('antes')
  const [subiendo, setSubiendo] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarCierre, setConfirmarCierre] = useState(false)
  const [borradorRecuperado, setBorradorRecuperado] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const camaraRef = useRef<HTMLInputElement>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)

  const esNuevo = modo === 'create'
  const dirty =
    JSON.stringify(form) !== JSON.stringify(inicial) ||
    (esNuevo && fotos.length > 0)

  // ── Borrador local (solo en alta) ──────────────────────────────────────────

  useEffect(() => {
    if (!esNuevo) return
    try {
      const raw = localStorage.getItem(draftKey(proyectoId))
      if (!raw) return
      const draft = JSON.parse(raw) as { form: FormState; fotos: FotoState[] }
      if (draft.form) {
        setForm(draft.form)
        setFotos(draft.fotos ?? [])
        setBorradorRecuperado(true)
      }
    } catch {
      /* borrador ilegible: se ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!esNuevo) return
    if (!dirty) return
    try {
      localStorage.setItem(draftKey(proyectoId), JSON.stringify({ form, fotos }))
    } catch {
      /* cuota llena: no es crítico */
    }
  }, [esNuevo, dirty, form, fotos, proyectoId])

  const limpiarBorrador = () => {
    try {
      localStorage.removeItem(draftKey(proyectoId))
    } catch {
      /* noop */
    }
  }

  // ── Fotos ──────────────────────────────────────────────────────────────────

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    const lista = Array.from(files)
    setSubiendo((n) => n + lista.length)

    for (const file of lista) {
      const res = await uploadFoto(file)
      if ('error' in res) {
        setError(`No se pudo subir la foto: ${res.error}`)
      } else if (repaso) {
        // Repaso existente: se registra ya, sin esperar a Guardar.
        const reg = await createRepasoFoto(repaso.id, res.url, tipoFoto)
        if ('error' in reg) setError(reg.error)
        else setFotos((prev) => [...prev, { id: reg.foto.id, url: reg.foto.url, tipo: reg.foto.tipo }])
      } else {
        setFotos((prev) => [...prev, { url: res.url, tipo: tipoFoto }])
      }
      setSubiendo((n) => n - 1)
    }
  }

  async function quitarFoto(foto: FotoState, i: number) {
    if (foto.id) {
      const res = await deleteRepasoFoto(foto.id)
      if ('error' in res) {
        setError(res.error)
        return
      }
    }
    setFotos((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Guardar / borrar ───────────────────────────────────────────────────────

  async function guardar(): Promise<boolean> {
    setGuardando(true)
    setError(null)
    try {
      if (esNuevo) {
        if (!punto) {
          setError('Falta la posición en el plano.')
          return false
        }
        const res = await createRepaso({
          proyecto_id: proyectoId,
          plano_id: planoId,
          x: punto.x,
          y: punto.y,
          oficio: form.oficio,
          descripcion: form.descripcion,
          estado: form.estado,
          visibilidad: form.visibilidad,
          prioridad: form.prioridad,
          fecha_objetivo: form.fecha_objetivo || null,
          responsable: form.responsable,
          fotos: fotos.map((f) => ({ url: f.url, tipo: f.tipo })),
        })
        if ('error' in res) {
          setError(res.error)
          return false
        }
        limpiarBorrador()
        onSaved(res.repaso)
        return true
      }

      const res = await updateRepaso(repaso!.id, {
        oficio: form.oficio,
        descripcion: form.descripcion,
        estado: form.estado,
        visibilidad: form.visibilidad,
        prioridad: form.prioridad,
        fecha_objetivo: form.fecha_objetivo || null,
        responsable: form.responsable,
      })
      if ('error' in res) {
        setError(res.error)
        return false
      }
      onSaved(res.repaso)
      return true
    } finally {
      setGuardando(false)
    }
  }

  async function borrar() {
    if (!repaso) return
    setBorrando(true)
    const res = await deleteRepaso(repaso.id)
    setBorrando(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    onDeleted(repaso.id)
  }

  function intentarCerrar() {
    if (dirty) setConfirmarCierre(true)
    else {
      if (esNuevo) limpiarBorrador()
      onClose()
    }
  }

  const bloqueado = guardando || borrando || subiendo > 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="rp-backdrop" role="dialog" aria-modal="true">
      {/* Sin onClick en el backdrop: el cierre es SIEMPRE explícito. */}
      <div className="rp-modal">
        {/* Cabecera */}
        <div className="rp-modal-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: estadoColor(form.estado), color: '#fff',
                  fontSize: 10, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {numero}
              </span>
              <h2 style={{ fontSize: 15, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>
                {esNuevo ? 'Nuevo repaso' : repaso!.codigo}
              </h2>
            </div>
            <p style={{ fontSize: 10.5, color: '#1A1A1A60', margin: '5px 0 0', fontWeight: 300 }}>
              {esNuevo
                ? 'Punto marcado en el plano · sin guardar'
                : `${repaso!.autor_nombre ?? 'Equipo'} · ${fmtFechaHora(repaso!.created_at)}`}
            </p>
          </div>
          <button
            onClick={intentarCerrar}
            aria-label="Cerrar"
            style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 4,
              border: '1px solid #E2E0D9', background: '#fff',
              fontSize: 15, color: '#1A1A1A', cursor: 'pointer', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Cuerpo */}
        <div className="rp-modal-body">
          {borradorRecuperado && (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, padding: '9px 11px', borderRadius: 4, marginBottom: 14,
                background: '#FDF8EE', border: '1px solid #EFE2C4',
              }}
            >
              <span style={{ fontSize: 11.5, color: '#8A6220', fontWeight: 300 }}>
                Se recuperó un borrador sin guardar.
              </span>
              <button
                className="rp-btn rp-btn-ghost"
                style={{ padding: '6px 10px', fontSize: 11 }}
                onClick={() => {
                  setForm(FORM_VACIO)
                  setFotos([])
                  limpiarBorrador()
                  setBorradorRecuperado(false)
                }}
              >
                Empezar de cero
              </button>
            </div>
          )}

          {/* Fotos */}
          <div style={{ marginBottom: 18 }}>
            <label className="rp-label">Fotos del repaso</label>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                className="rp-btn rp-btn-accent"
                style={{ flex: 1 }}
                disabled={bloqueado}
                onClick={() => camaraRef.current?.click()}
              >
                📷 Tomar foto
              </button>
              <button
                className="rp-btn rp-btn-ghost"
                style={{ flex: 1 }}
                disabled={bloqueado}
                onClick={() => galeriaRef.current?.click()}
              >
                Galería
              </button>
            </div>

            <div className="rp-seg" style={{ marginBottom: 10 }}>
              {(['antes', 'despues'] as RepasoFotoTipo[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipoFoto(t)}
                  style={
                    tipoFoto === t
                      ? { background: '#1A1A1A', color: '#fff', borderColor: '#1A1A1A' }
                      : undefined
                  }
                >
                  {t === 'antes' ? 'Incidencia' : 'Resuelto (evidencia)'}
                </button>
              ))}
            </div>

            <input
              ref={camaraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                onFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <input
              ref={galeriaRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                onFiles(e.target.files)
                e.target.value = ''
              }}
            />

            {(fotos.length > 0 || subiendo > 0) && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                  gap: 8,
                }}
              >
                {fotos.map((f, i) => (
                  <div
                    key={f.url}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 4,
                      overflow: 'hidden',
                      background: '#F0EEE8',
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
                    <button
                      onClick={() => quitarFoto(f, i)}
                      aria-label="Quitar foto"
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 22, height: 22, borderRadius: '50%',
                        border: 'none', background: 'rgba(26,26,26,0.72)',
                        color: '#fff', fontSize: 11, cursor: 'pointer', lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {Array.from({ length: subiendo }).map((_, i) => (
                  <div
                    key={`up-${i}`}
                    style={{
                      aspectRatio: '1', borderRadius: 4, background: '#F0EEE8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#1A1A1A70',
                    }}
                  >
                    Subiendo…
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Descripción */}
          <div style={{ marginBottom: 16 }}>
            <label className="rp-label">Descripción del desperfecto</label>
            <textarea
              className="rp-textarea"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej. Rodapié desprendido en el encuentro con el paso a la cocina; falta sellado."
            />
          </div>

          {/* Oficio */}
          <div style={{ marginBottom: 16 }}>
            <label className="rp-label">Oficio</label>
            <select
              className="rp-select"
              value={form.oficio}
              onChange={(e) => setForm({ ...form, oficio: e.target.value })}
              style={{ borderLeft: `3px solid ${oficioColor(form.oficio)}` }}
            >
              {OFICIOS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div style={{ marginBottom: 16 }}>
            <label className="rp-label">Estado</label>
            <div className="rp-seg">
              {ESTADOS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setForm({ ...form, estado: e.id })}
                  style={
                    form.estado === e.id
                      ? { background: e.color, color: '#fff', borderColor: e.color }
                      : undefined
                  }
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visibilidad */}
          <div style={{ marginBottom: 16 }}>
            <label className="rp-label">Quién puede verlo</label>
            <div className="rp-seg">
              {VISIBILIDADES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setForm({ ...form, visibilidad: v.id })}
                  title={v.descripcion}
                  style={
                    form.visibilidad === v.id
                      ? { background: '#1A1A1A', color: '#fff', borderColor: '#1A1A1A' }
                      : undefined
                  }
                >
                  <span style={{ marginRight: 4 }}>{v.icon}</span>
                  {v.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: '#1A1A1A70', margin: '7px 0 0', fontWeight: 300, lineHeight: 1.5 }}>
              {VISIBILIDADES.find((v) => v.id === form.visibilidad)?.descripcion}
            </p>
          </div>

          {/* Prioridad */}
          <div style={{ marginBottom: 16 }}>
            <label className="rp-label">Prioridad</label>
            <div className="rp-seg">
              {PRIORIDADES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setForm({ ...form, prioridad: p.id })}
                  style={
                    form.prioridad === p.id
                      ? { background: p.color, color: '#fff', borderColor: p.color }
                      : undefined
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Responsable y fecha */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 150px' }}>
              <label className="rp-label">Responsable</label>
              <input
                className="rp-input"
                value={form.responsable}
                onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                placeholder="Gremio o persona"
              />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label className="rp-label">Fecha objetivo</label>
              <input
                className="rp-input"
                type="date"
                value={form.fecha_objetivo}
                onChange={(e) => setForm({ ...form, fecha_objetivo: e.target.value })}
              />
            </div>
          </div>

          {/* Acciones sobre el pin + historial */}
          {!esNuevo && repaso && (
            <>
              <button
                className="rp-btn rp-btn-ghost"
                style={{ width: '100%', marginBottom: 18 }}
                onClick={() => onMoverPin(repaso)}
              >
                ✥ Mover el pin en el plano
              </button>

              {repaso.resuelto_at && (
                <div
                  style={{
                    padding: '9px 11px', borderRadius: 4, marginBottom: 16,
                    background: '#F1F8F4', border: '1px solid #CFE5D8',
                  }}
                >
                  <p style={{ fontSize: 11, color: '#2D7D5A', margin: 0, fontWeight: 400 }}>
                    Resuelto por {repaso.resuelto_por ?? 'el equipo'} · {fmtFechaHora(repaso.resuelto_at)}
                  </p>
                </div>
              )}

              {repaso.eventos.length > 0 && (
                <div>
                  <label className="rp-label">Historial</label>
                  <div style={{ borderLeft: '1px solid #E8E6E0', paddingLeft: 12 }}>
                    {repaso.eventos.map((ev) => (
                      <div key={ev.id} style={{ position: 'relative', paddingBottom: 11 }}>
                        <span
                          style={{
                            position: 'absolute', left: -16, top: 5,
                            width: 7, height: 7, borderRadius: '50%',
                            background: '#D8D5CE',
                          }}
                        />
                        <p style={{ fontSize: 11.5, color: '#1A1A1A', margin: 0, fontWeight: 300 }}>
                          {eventoTexto(ev)}
                        </p>
                        <p style={{ fontSize: 10, color: '#1A1A1A55', margin: '2px 0 0' }}>
                          {fmtFechaHora(ev.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <p
              style={{
                fontSize: 11.5, color: '#B03A2E', marginTop: 14,
                padding: '9px 11px', borderRadius: 4,
                background: '#FDF4F2', border: '1px solid #F0D5CF',
              }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Pie */}
        <div className="rp-modal-foot">
          {!esNuevo && (
            <button
              className="rp-btn rp-btn-danger"
              disabled={bloqueado}
              onClick={borrar}
              style={{ flexShrink: 0 }}
            >
              {borrando ? '…' : 'Borrar'}
            </button>
          )}
          <button
            className="rp-btn rp-btn-ghost"
            disabled={bloqueado}
            onClick={intentarCerrar}
            style={{ flexShrink: 0 }}
          >
            Cerrar
          </button>
          <button
            className="rp-btn rp-btn-primary"
            style={{ flex: 1 }}
            disabled={bloqueado || (!dirty && !esNuevo)}
            onClick={async () => {
              const ok = await guardar()
              if (ok) onClose()
            }}
          >
            {guardando ? 'Guardando…' : subiendo > 0 ? 'Subiendo fotos…' : 'Guardar repaso'}
          </button>
        </div>

        {/* Confirmación de cierre con cambios pendientes */}
        {confirmarCierre && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: 'rgba(26,26,26,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
          >
            <div
              style={{
                background: '#fff', borderRadius: 6, padding: 20,
                maxWidth: 340, width: '100%',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              }}
            >
              <p style={{ fontSize: 14, color: '#1A1A1A', margin: '0 0 6px', fontWeight: 400 }}>
                Tienes cambios sin guardar
              </p>
              <p style={{ fontSize: 12, color: '#1A1A1A80', margin: '0 0 18px', fontWeight: 300, lineHeight: 1.5 }}>
                Si cierras sin guardar se perderá {esNuevo ? 'este repaso' : 'lo que has editado'}.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="rp-btn rp-btn-primary"
                  disabled={guardando}
                  onClick={async () => {
                    const ok = await guardar()
                    if (ok) onClose()
                    else setConfirmarCierre(false)
                  }}
                >
                  {guardando ? 'Guardando…' : 'Guardar y cerrar'}
                </button>
                <button
                  className="rp-btn rp-btn-ghost"
                  onClick={() => setConfirmarCierre(false)}
                >
                  Seguir editando
                </button>
                <button
                  className="rp-btn rp-btn-danger"
                  onClick={() => {
                    if (esNuevo) limpiarBorrador()
                    onClose()
                  }}
                >
                  Descartar cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox de foto */}
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
