'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { fmtFecha } from '@/lib/repasos/domain'
import type { RepasoProyectoResumen } from '@/lib/repasos/domain'
import { preparePlano, uploadPlano } from '@/lib/repasos/upload'
import type { PlanoPreparado } from '@/lib/repasos/upload'
import { createRepasoProyecto, deleteRepasoProyecto } from '@/app/actions/repasos'

interface Props {
  proyectos: RepasoProyectoResumen[]
}

interface Form {
  nombre: string
  direccion: string
  cliente: string
  constructora: string
  referencia: string
  notas: string
  planoNombre: string
}

const FORM_VACIO: Form = {
  nombre: '',
  direccion: '',
  cliente: '',
  constructora: '',
  referencia: '',
  notas: '',
  planoNombre: 'Planta general',
}

export default function RepasosIndex({ proyectos }: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState<Form>(FORM_VACIO)
  const [plano, setPlano] = useState<PlanoPreparado | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function elegirPlano(file: File | undefined) {
    if (!file) return
    setProcesando(true)
    setError(null)
    const prep = await preparePlano(file)
    setProcesando(false)
    if ('error' in prep) {
      setError(prep.error)
      return
    }
    setPlano(prep)
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setError('Ponle nombre al proyecto.')
      return
    }
    if (!plano) {
      setError('Sube el plano de distribución general.')
      return
    }
    setGuardando(true)
    setError(null)

    const up = await uploadPlano(plano)
    if ('error' in up) {
      setGuardando(false)
      setError(up.error)
      return
    }

    const res = await createRepasoProyecto({
      nombre: form.nombre,
      direccion: form.direccion,
      cliente: form.cliente,
      constructora: form.constructora,
      referencia: form.referencia,
      notas: form.notas,
      plano: {
        nombre: form.planoNombre,
        img_url: up.img_url,
        pdf_url: up.pdf_url,
        width: plano.width,
        height: plano.height,
      },
    })

    setGuardando(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    router.push(`/team/apps/repasos/${res.id}`)
  }

  async function borrar(id: string, nombre: string) {
    if (!confirm(`¿Borrar «${nombre}» con todos sus repasos? No se puede deshacer.`)) return
    setBorrando(id)
    const res = await deleteRepasoProyecto(id)
    setBorrando(null)
    if ('error' in res) setError(res.error)
    else router.refresh()
  }

  function cerrarModal() {
    const conDatos = form.nombre.trim() || plano
    if (conDatos && !confirm('¿Descartar el proyecto que estabas creando?')) return
    setAbierto(false)
    setForm(FORM_VACIO)
    setPlano(null)
    setError(null)
  }

  return (
    <div style={{ padding: '28px 20px 60px', maxWidth: 1100, margin: '0 auto' }}>
      <p
        style={{
          fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#1A1A1A99', marginBottom: 8,
        }}
      >
        Forma Prima · Apps
      </p>
      <div
        style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 14, marginBottom: 28, flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 26, fontWeight: 300, color: '#1A1A1A',
              margin: '0 0 4px', letterSpacing: '-0.02em',
            }}
          >
            Repasos de obra
          </h1>
          <p style={{ fontSize: 13, color: '#1A1A1A60', margin: 0, fontWeight: 300 }}>
            Marca los repasos sobre el plano, con foto, oficio y estado. Comparte lo que quieras
            con la constructora o el cliente.
          </p>
        </div>
        <button className="rp-btn rp-btn-accent" onClick={() => setAbierto(true)}>
          + Nuevo proyecto
        </button>
      </div>

      {proyectos.length === 0 ? (
        <div
          style={{
            border: '1px dashed #D8D5CE', borderRadius: 6,
            padding: '52px 24px', textAlign: 'center', background: '#fff',
          }}
        >
          <p style={{ fontSize: 30, margin: '0 0 12px' }}>📍</p>
          <p style={{ fontSize: 14, color: '#1A1A1A', margin: '0 0 6px', fontWeight: 400 }}>
            Todavía no hay proyectos
          </p>
          <p
            style={{
              fontSize: 12.5, color: '#1A1A1A70', margin: '0 auto 20px',
              fontWeight: 300, maxWidth: 400, lineHeight: 1.6,
            }}
          >
            Crea uno subiendo el plano de distribución general. Después podrás ir marcando
            los repasos directamente sobre el plano desde el móvil, en obra.
          </p>
          <button className="rp-btn rp-btn-accent" onClick={() => setAbierto(true)}>
            + Nuevo proyecto
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {proyectos.map((p) => {
            const total = p.detectados + p.programados + p.resueltos
            const pct = total ? Math.round((p.resueltos / total) * 100) : 0
            return (
              <div key={p.id} style={{ position: 'relative' }}>
                <Link href={`/team/apps/repasos/${p.id}`} className="rp-card">
                  <div
                    style={{
                      height: 128, background: '#F0EEE8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {p.plano_portada ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.plano_portada}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <span style={{ fontSize: 22, opacity: 0.4 }}>◱</span>
                    )}
                  </div>

                  <div style={{ padding: '14px 15px 16px' }}>
                    <p
                      style={{
                        fontSize: 13.5, fontWeight: 500, color: '#1A1A1A',
                        margin: '0 0 4px', letterSpacing: '-0.01em',
                      }}
                    >
                      {p.nombre}
                    </p>
                    <p
                      style={{
                        fontSize: 11, color: '#1A1A1A70', margin: '0 0 12px',
                        fontWeight: 300, minHeight: 15,
                      }}
                    >
                      {[p.direccion, p.cliente].filter(Boolean).join(' · ') || '—'}
                    </p>

                    <div style={{ display: 'flex', gap: 10, marginBottom: 11, flexWrap: 'wrap' }}>
                      <Contador n={p.detectados} label="detectados" color="#D85A30" />
                      <Contador n={p.programados} label="programados" color="#C4A532" />
                      <Contador n={p.resueltos} label="resueltos" color="#2D7D5A" />
                    </div>

                    <div
                      style={{
                        height: 3, borderRadius: 2, background: '#F0EEE8',
                        overflow: 'hidden', marginBottom: 9,
                      }}
                    >
                      <div style={{ width: `${pct}%`, height: '100%', background: '#2D7D5A' }} />
                    </div>

                    <p style={{ fontSize: 10, color: '#1A1A1A55', margin: 0 }}>
                      {total} repasos · {p.planos_count} {p.planos_count === 1 ? 'plano' : 'planos'} ·{' '}
                      {fmtFecha(p.created_at)}
                    </p>
                  </div>
                </Link>

                <button
                  onClick={() => borrar(p.id, p.nombre)}
                  aria-label="Borrar proyecto"
                  title="Borrar proyecto"
                  disabled={borrando === p.id}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 26, height: 26, borderRadius: 4,
                    border: 'none', background: 'rgba(26,26,26,0.6)',
                    color: '#fff', fontSize: 11, cursor: 'pointer', lineHeight: 1,
                  }}
                >
                  {borrando === p.id ? '…' : '✕'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {error && !abierto && (
        <p
          style={{
            fontSize: 12, color: '#B03A2E', marginTop: 18,
            padding: '10px 12px', borderRadius: 4,
            background: '#FDF4F2', border: '1px solid #F0D5CF',
          }}
        >
          {error}
        </p>
      )}

      {/* ── Modal de alta ── */}
      {abierto && (
        <div className="rp-backdrop" role="dialog" aria-modal="true">
          <div className="rp-modal">
            <div className="rp-modal-head">
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 400, color: '#1A1A1A', margin: 0 }}>
                  Nuevo proyecto
                </h2>
                <p style={{ fontSize: 10.5, color: '#1A1A1A60', margin: '5px 0 0', fontWeight: 300 }}>
                  Plano de distribución e información general
                </p>
              </div>
              <button
                onClick={cerrarModal}
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
              {/* Plano */}
              <div style={{ marginBottom: 20 }}>
                <label className="rp-label">Plano de distribución general (PDF o imagen)</label>

                {plano ? (
                  <div>
                    <div
                      style={{
                        border: '1px solid #E8E6E0', borderRadius: 4,
                        overflow: 'hidden', background: '#F8F7F4', marginBottom: 9,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={plano.previewUrl}
                        alt="Plano"
                        style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'contain' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, color: '#1A1A1A70', fontWeight: 300 }}>
                        {plano.width} × {plano.height} px
                        {plano.pdfFile ? ' · PDF original guardado' : ''}
                      </span>
                      <button
                        className="rp-btn rp-btn-ghost"
                        style={{ padding: '6px 10px', fontSize: 11 }}
                        onClick={() => fileRef.current?.click()}
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={procesando}
                    style={{
                      width: '100%', padding: '26px 16px',
                      border: '1px dashed #D8D5CE', borderRadius: 4,
                      background: '#FCFBF9', cursor: 'pointer',
                      fontSize: 12.5, color: '#1A1A1A80', fontWeight: 300,
                      fontFamily: 'inherit',
                    }}
                  >
                    {procesando ? 'Procesando el plano…' : '＋ Subir plano (PDF o imagen)'}
                  </button>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/*"
                  hidden
                  onChange={(e) => {
                    elegirPlano(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                <p style={{ fontSize: 10, color: '#1A1A1A55', margin: '8px 0 0', fontWeight: 300, lineHeight: 1.5 }}>
                  Si subes un PDF se usa la primera página. Podrás añadir más plantas después.
                </p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="rp-label">Nombre del plano</label>
                <input
                  className="rp-input"
                  value={form.planoNombre}
                  onChange={(e) => setForm({ ...form, planoNombre: e.target.value })}
                  placeholder="Planta general"
                />
              </div>

              <div style={{ height: 1, background: '#F0EEE8', margin: '4px 0 18px' }} />

              <div style={{ marginBottom: 16 }}>
                <label className="rp-label">Nombre del proyecto *</label>
                <input
                  className="rp-input"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej. Casa Claudio Coello 38"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="rp-label">Dirección</label>
                <input
                  className="rp-input"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  placeholder="Calle, número, población"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 150px' }}>
                  <label className="rp-label">Cliente</label>
                  <input
                    className="rp-input"
                    value={form.cliente}
                    onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                  />
                </div>
                <div style={{ flex: '1 1 150px' }}>
                  <label className="rp-label">Constructora</label>
                  <input
                    className="rp-input"
                    value={form.constructora}
                    onChange={(e) => setForm({ ...form, constructora: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="rp-label">Referencia interna</label>
                <input
                  className="rp-input"
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                  placeholder="Código del proyecto"
                />
              </div>

              <div>
                <label className="rp-label">Notas</label>
                <textarea
                  className="rp-textarea"
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Contexto de la obra, fase, lo que convenga."
                />
              </div>

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

            <div className="rp-modal-foot">
              <button className="rp-btn rp-btn-ghost" onClick={cerrarModal} disabled={guardando}>
                Cancelar
              </button>
              <button
                className="rp-btn rp-btn-primary"
                style={{ flex: 1 }}
                onClick={guardar}
                disabled={guardando || procesando}
              >
                {guardando ? 'Creando proyecto…' : 'Crear proyecto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Contador({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 10.5, color: '#1A1A1A80' }}>
        {n} {label}
      </span>
    </span>
  )
}
