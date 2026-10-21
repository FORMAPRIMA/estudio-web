'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { actualizarConfidencialSala, actualizarMiembroSala, crearMiembroSala, regenerarCodigoSala, type MiembroInput } from '@/app/actions/salas'
import { fecha, hace } from '@/lib/salas/metricas'
import { Modal } from './LeadForm'
import { Etiqueta } from './SalaPanel'
import { S, btn, card, eyebrow, input } from './theme'

export interface MiembroFila {
  id: string; nombre: string; email: string | null; empresa: string | null
  rol: 'propietario' | 'comercial'; activo: boolean; ultimoAcceso: string | null; salas: string[]
}
export interface SalaFila { id: string; nombre: string; confidencial: boolean; creadoPor: string | null }
export interface Registro { quien: string; sala: string | null; accion: string; detalle: string | null; at: string }

const ACCIONES: Record<string, string> = {
  entrar: 'entró al panel', crear_lead: 'creó el lead', editar_lead: 'editó el lead', revocar_lead: 'revocó el PIN de',
  reactivar_lead: 'reactivó el PIN de', renovar_pin: 'generó un PIN nuevo para', exportar_csv: 'exportó el CSV',
  crear_miembro: 'dio acceso a', editar_miembro: 'editó a', desactivar_miembro: 'desactivó a', regenerar_codigo: 'generó un código nuevo para',
  sala_confidencial: 'marcó como confidencial', sala_compartible: 'abrió al equipo',
}

export default function EquipoPanel({ yo, miembros, salas, registro }: {
  yo: string; miembros: MiembroFila[]; salas: SalaFila[]; registro: Registro[]
}) {
  const router = useRouter()
  const [form, setForm] = useState<MiembroFila | 'nuevo' | null>(null)
  const [codigo, setCodigo] = useState<{ nombre: string; codigo: string } | null>(null)

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <p style={eyebrow}>Equipo</p>
          <h1 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em', margin: '6px 0 0' }}>Quién entra al panel</h1>
          <p style={{ fontSize: 13, color: S.soft, margin: '6px 0 0' }}>Cada persona tiene su propio código. Los perfiles comerciales ven las salas que les asignes y las que crean ellos.</p>
        </div>
        <button onClick={() => setForm('nuevo')} style={btn()}>+ Dar acceso</button>
      </div>

      <div style={{ ...card, overflowX: 'auto', marginBottom: 28 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
          <thead>
            <tr style={{ color: S.soft, fontSize: 11, textAlign: 'left' }}>
              {['Persona', 'Rol', 'Salas', 'Último acceso', ''].map((h) => <th key={h} style={{ padding: '12px 16px', fontWeight: 500 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {miembros.map((x) => (
              <tr key={x.id} style={{ borderTop: `1px solid ${S.lineSoft}`, opacity: x.activo ? 1 : 0.55 }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 500 }}>{x.nombre}{x.id === yo && <span style={{ color: S.faint, fontWeight: 400 }}> · tú</span>}</div>
                  <div style={{ fontSize: 11.5, color: S.faint }}>{[x.empresa, x.email].filter(Boolean).join(' · ')}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {!x.activo ? <Etiqueta tono="rojo">sin acceso</Etiqueta> : x.rol === 'propietario' ? <Etiqueta tono="acento">propiedad</Etiqueta> : <Etiqueta>comercial</Etiqueta>}
                </td>
                <td style={{ padding: '12px 16px', color: S.soft, fontSize: 12.5 }}>
                  {x.rol === 'propietario' ? 'Todas' : salasVistas(x.id, x.salas, salas).map((s) => s.nombre).join(', ') || 'Ninguna'}
                </td>
                <td style={{ padding: '12px 16px', color: S.soft, fontSize: 12.5 }}>{hace(x.ultimoAcceso)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button onClick={() => setForm(x)} style={{ ...btn('ghost'), padding: '6px 12px' }}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SalasConfidenciales salas={salas} miembros={miembros} onCambio={() => router.refresh()} />

      <h2 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 10px' }}>Registro</h2>
      <div style={{ ...card, padding: '6px 0' }}>
        {registro.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 18px', fontSize: 12.5, borderTop: i ? `1px solid ${S.lineSoft}` : 0 }}>
            <span style={{ color: S.faint, minWidth: 110 }}>{fecha(r.at)}</span>
            <span><b style={{ fontWeight: 500 }}>{r.quien}</b> {ACCIONES[r.accion] ?? r.accion}{r.detalle ? ` ${r.detalle}` : ''}{r.sala ? <span style={{ color: S.faint }}> · {r.sala}</span> : null}</span>
          </div>
        ))}
        {!registro.length && <p style={{ padding: '12px 18px', margin: 0, fontSize: 13, color: S.soft }}>Sin actividad todavía.</p>}
      </div>

      {form && (
        <MiembroForm
          inicial={form === 'nuevo' ? null : form}
          esYo={form !== 'nuevo' && form.id === yo}
          salas={salas}
          onCerrar={() => setForm(null)}
          onCodigo={(c) => { setForm(null); setCodigo(c); router.refresh() }}
          onHecho={() => { setForm(null); router.refresh() }}
        />
      )}
      {codigo && (
        <Modal titulo={`Código de ${codigo.nombre}`} onCerrar={() => setCodigo(null)}>
          <p style={{ fontSize: 13, color: S.soft, margin: '0 0 14px', lineHeight: 1.5 }}>
            Es la única vez que se muestra: no se guarda en ningún sitio. Envíaselo junto con la dirección <b style={{ color: S.ink }}>salas.formaprima.es</b>.
          </p>
          <div style={{ fontSize: 34, fontWeight: 300, letterSpacing: '0.2em', textAlign: 'center', padding: '18px 0', background: S.bg, borderRadius: 8, fontVariantNumeric: 'tabular-nums' }}>
            {codigo.codigo.replace(/(\d{4})/, '$1 ')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button onClick={() => navigator.clipboard.writeText(`Acceso al panel de Forma Prima Salas: https://salas.formaprima.es\nTu código personal: ${codigo.codigo}`).catch(() => {})} style={btn('ghost')}>Copiar mensaje</button>
            <button onClick={() => setCodigo(null)} style={btn()}>Hecho</button>
          </div>
        </Modal>
      )}
    </>
  )
}

function MiembroForm({ inicial, esYo, salas, onCerrar, onCodigo, onHecho }: {
  inicial: MiembroFila | null; esYo: boolean; salas: SalaFila[]
  onCerrar: () => void; onCodigo: (c: { nombre: string; codigo: string }) => void; onHecho: () => void
}) {
  const [d, setD] = useState<MiembroInput & { activo: boolean }>({
    nombre: inicial?.nombre ?? '', email: inicial?.email ?? '', empresa: inicial?.empresa ?? '',
    rol: inicial?.rol ?? 'comercial', salas: (inicial?.salas ?? []).filter((id) => salas.some((s) => s.id === id && !s.confidencial)), activo: inicial?.activo ?? true,
  })
  const [error, setError] = useState('')
  const [isGuardando, setIsGuardando] = useState(false)

  const guardar = async () => {
    setError(''); setIsGuardando(true)
    const r = inicial ? await actualizarMiembroSala(inicial.id, d) : await crearMiembroSala(d)
    setIsGuardando(false)
    if (!r.ok) { setError(r.error); return }
    if (!inicial) onCodigo({ nombre: d.nombre, codigo: (r as unknown as { codigo: string }).codigo })
    else onHecho()
  }
  const nuevoCodigo = async () => {
    if (!inicial) return
    setIsGuardando(true)
    const r = await regenerarCodigoSala(inicial.id)
    setIsGuardando(false)
    if (!r.ok) { setError(r.error); return }
    onCodigo({ nombre: inicial.nombre, codigo: (r as unknown as { codigo: string }).codigo })
  }

  return (
    <Modal titulo={inicial ? `Editar · ${inicial.nombre}` : 'Dar acceso al panel'} onCerrar={onCerrar}>
      <form onSubmit={(e) => { e.preventDefault(); guardar() }} style={{ display: 'grid', gap: 14 }}>
        <label><span style={lab}>Nombre</span><input autoFocus value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} style={input} /></label>
        <div className="salas-2col" style={{ display: 'grid', gap: 12 }}>
          <label><span style={lab}>Empresa</span><input value={d.empresa ?? ''} onChange={(e) => setD({ ...d, empresa: e.target.value })} placeholder="p. ej. el fondo" style={input} /></label>
          <label><span style={lab}>Email</span><input type="email" value={d.email ?? ''} onChange={(e) => setD({ ...d, email: e.target.value })} style={input} /></label>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={lab}>Rol</legend>
          <div style={{ display: 'grid', gap: 8 }}>
            {([['comercial', 'Comercial', 'Crea leads y ve todos los de sus salas.'], ['propietario', 'Propiedad', 'Todo, incluido dar y quitar accesos.']] as const).map(([v, t, sub]) => (
              <label key={v} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: `1px solid ${d.rol === v ? S.ink : S.line}`, borderRadius: 6, cursor: esYo ? 'default' : 'pointer' }}>
                <input type="radio" name="rol" disabled={esYo} checked={d.rol === v} onChange={() => setD({ ...d, rol: v })} style={{ marginTop: 3, accentColor: S.ink }} />
                <span><span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>{t}</span><span style={{ fontSize: 12, color: S.soft }}>{sub}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        {d.rol === 'comercial' && (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={lab}>Salas que ve</legend>
            <div style={{ display: 'grid', gap: 6 }}>
              {salas.map((s) => {
                const suya = !!inicial && s.creadoPor === inicial.id
                const bloqueada = s.confidencial && !suya
                return (
                  <label key={s.id} title={bloqueada ? 'Confidencial: ábrela al equipo más abajo para poder asignarla.' : undefined}
                    style={{ display: 'flex', gap: 8, fontSize: 13.5, alignItems: 'center', cursor: bloqueada || suya ? 'default' : 'pointer', color: bloqueada ? S.faint : S.ink }}>
                    <input type="checkbox" disabled={bloqueada || suya} checked={suya || (!bloqueada && d.salas.includes(s.id))}
                      onChange={(e) => setD({ ...d, salas: e.target.checked ? [...d.salas, s.id] : d.salas.filter((x) => x !== s.id) })} style={{ accentColor: S.ink }} />
                    {s.nombre}
                    {suya ? <Etiqueta>la creó</Etiqueta> : s.confidencial ? <Etiqueta>confidencial</Etiqueta> : null}
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}
        {inicial && !esYo && (
          <label style={{ display: 'flex', gap: 8, fontSize: 13.5, alignItems: 'center' }}>
            <input type="checkbox" checked={d.activo} onChange={(e) => setD({ ...d, activo: e.target.checked })} style={{ accentColor: S.ink }} />
            Con acceso al panel
          </label>
        )}
        {error && <p role="alert" style={{ color: S.red, fontSize: 13, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          {inicial ? <button type="button" onClick={nuevoCodigo} disabled={isGuardando} style={btn('ghost')}>Generar código nuevo</button> : <span />}
          <span style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onCerrar} style={btn('ghost')}>Cancelar</button>
            <button type="submit" disabled={isGuardando} style={{ ...btn(), opacity: isGuardando ? 0.6 : 1 }}>{isGuardando ? 'Guardando…' : inicial ? 'Guardar' : 'Dar acceso'}</button>
          </span>
        </div>
      </form>
    </Modal>
  )
}

const lab = { display: 'block', fontSize: 12, color: S.soft, marginBottom: 5 } as const

/** Lo mismo que filtra el servidor (salasDe): asignadas y no confidenciales, más las suyas. */
function salasVistas(miembroId: string, asignadas: string[], salas: SalaFila[]) {
  return salas.filter((s) => s.creadoPor === miembroId || (asignadas.includes(s.id) && !s.confidencial))
}

function SalasConfidenciales({ salas, miembros, onCambio }: { salas: SalaFila[]; miembros: MiembroFila[]; onCambio: () => void }) {
  const [enCurso, setEnCurso] = useState<string | null>(null)
  const [error, setError] = useState('')
  const comerciales = miembros.filter((x) => x.rol === 'comercial' && x.activo)
  const cambiar = async (s: SalaFila) => {
    setError(''); setEnCurso(s.id)
    const r = await actualizarConfidencialSala(s.id, !s.confidencial)
    setEnCurso(null)
    if (!r.ok) { setError(r.error); return }
    onCambio()
  }
  return (
    <>
      <h2 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px' }}>Salas</h2>
      <p style={{ fontSize: 12.5, color: S.soft, margin: '0 0 10px' }}>
        Una sala confidencial no se puede asignar a ningún comercial; quien la creó la sigue viendo. Toda sala nueva nace confidencial.
      </p>
      <div style={{ ...card, overflowX: 'auto', marginBottom: 28 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
          <tbody>
            {salas.map((s, i) => {
              const ven = comerciales.filter((x) => salasVistas(x.id, x.salas, [s]).length).map((x) => x.nombre)
              return (
                <tr key={s.id} style={{ borderTop: i ? `1px solid ${S.lineSoft}` : 0 }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{s.nombre}</td>
                  <td style={{ padding: '12px 16px', color: S.soft, fontSize: 12.5 }}>{ven.length ? `También la ve: ${ven.join(', ')}` : 'Solo propiedad'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {s.confidencial ? <Etiqueta tono="acento">confidencial</Etiqueta> : <Etiqueta>abierta al equipo</Etiqueta>}
                    <button onClick={() => cambiar(s)} disabled={enCurso === s.id} style={{ ...btn('ghost'), padding: '6px 12px', marginLeft: 10, opacity: enCurso === s.id ? 0.6 : 1 }}>
                      {s.confidencial ? 'Abrir al equipo' : 'Marcar confidencial'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {error && <p role="alert" style={{ color: S.red, fontSize: 13, margin: 0, padding: '0 16px 12px' }}>{error}</p>}
      </div>
    </>
  )
}
