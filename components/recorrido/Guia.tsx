'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Plano from './Plano'
import type { PlanoHandle, RcPin } from './Plano'
import Story from './Story'
import VideoIntro from './VideoIntro'
import SlideEquipo from './Equipo'
import type { Diapositiva } from './Story'
import { recorridoDe, slotAHora, nombrePila } from '@/lib/recorrido/domain'
import type { RcDetalle, RcEstado, RcPlano, RcVisita } from '@/lib/recorrido/domain'
import type { InvitadoVisita } from '@/lib/recorrido/data'
import { endVisita, getDetalles, getPanelGuia, startVisita, updateVisita } from '@/app/actions/recorrido'
import { abrirCanal } from '@/lib/recorrido/directo'
import { EVENTO } from '@/lib/open-house/evento'

// Modo guía (tablet o móvil del equipo). Elige su visita, recorre las stories y
// cada paso se emite en directo a los móviles de su grupo.

const CLAVE_VISITA = 'rc-guia-visita'
const PORTADAS = ['cc38-3919', 'cc38-3887', 'cc38-4101', 'cc38-3943']

function leerLS(k: string) { try { return localStorage.getItem(k) } catch { return null } }
function escribirLS(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* */ } }

export default function Guia({ inicial, plano, yo }: { inicial: RcDetalle[]; plano: RcPlano; yo: string }) {
  const [detalles, setDetalles] = useState(inicial)
  const [visitas, setVisitas] = useState<RcVisita[]>([])
  const [asistentes, setAsistentes] = useState<InvitadoVisita[]>([])
  const [presencia, setPresencia] = useState<Record<string, string>>({})
  const [visita, setVisita] = useState<RcVisita | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refrescarPanel = useCallback(async () => {
    const r = await getPanelGuia()
    if (r.ok) { setVisitas(r.data.visitas); setAsistentes(r.data.asistentes); setPresencia(r.data.presencia) }
  }, [])

  useEffect(() => {
    refrescarPanel()
    const t = window.setInterval(() => { if (!document.hidden) refrescarPanel() }, 15000)
    return () => window.clearInterval(t)
  }, [refrescarPanel])

  // Recuperar la visita si la tablet se recargó a mitad.
  useEffect(() => {
    const id = leerLS(CLAVE_VISITA)
    if (!id || visita) return
    const v = visitas.find((x) => x.id === id)
    if (v) setVisita(v)
  }, [visitas, visita])

  // Precarga de todas las fotos del recorrido: si el wifi cae a mitad, la tablet ya las tiene.
  useEffect(() => {
    const urls = detalles.flatMap((d) => d.fotos.map((f) => f.url))
    urls.forEach((u) => { const i = new Image(); i.decoding = 'async'; i.src = u })
  }, [detalles])

  async function empezar(slot: string | null) {
    setError(null)
    const fresh = await getDetalles()
    if (fresh.ok) setDetalles(fresh.data)
    const r = await startVisita(slot)
    if (!r.ok) { setError(r.error); return }
    escribirLS(CLAVE_VISITA, r.data.id)
    setVisita(r.data)
  }

  if (!visita) {
    return (
      <Selector
        yo={yo} visitas={visitas} asistentes={asistentes} presencia={presencia}
        onEmpezar={empezar} onRetomar={(v) => { escribirLS(CLAVE_VISITA, v.id); setVisita(v) }}
        error={error} hayRecorrido={recorridoDe(detalles).length > 0}
      />
    )
  }

  return (
    <EnVisita
      visita={visita}
      detalles={detalles}
      plano={plano}
      grupo={asistentes.filter((a) => visita.slot && a.slot === visita.slot)}
      presencia={presencia}
      onTerminar={async () => {
        await endVisita(visita.id)
        escribirLS(CLAVE_VISITA, null)
        setVisita(null)
        refrescarPanel()
      }}
    />
  )
}

// ─── Selector de visita ───────────────────────────────────────────────────────

function Selector({ yo, visitas, asistentes, presencia, onEmpezar, onRetomar, error, hayRecorrido }: {
  yo: string
  visitas: RcVisita[]
  asistentes: InvitadoVisita[]
  presencia: Record<string, string>
  onEmpezar: (slot: string | null) => void
  onRetomar: (v: RcVisita) => void
  error: string | null
  hayRecorrido: boolean
}) {
  const ahora = Date.now()
  const slots = EVENTO.horarios.map((t) => t.replace(':', ''))
  return (
    <div className="rc-app rc-oscuro">
      <div className="rc-selector rc-scroll">
        <header className="rc-selector-cab">
          <span className="rc-eyebrow">Open House · Claudio Coello 38</span>
          <h1 className="rc-serif">Hola, {nombrePila(yo)}.<br />¿Qué visita guías?</h1>
          <a className="rc-link" href="/recorrido">Volver al plano del equipo</a>
        </header>
        {!hayRecorrido && <p className="rc-aviso">Todavía no hay detalles marcados para el recorrido. Márcalos en Selección.</p>}
        {error && <p className="rc-aviso">{error}</p>}

        {visitas.length > 0 && (
          <section>
            <h2 className="rc-eyebrow rc-selector-h">En curso</h2>
            <div className="rc-turnos">
              {visitas.map((v) => (
                <button key={v.id} className="rc-turno is-vivo" onClick={() => onRetomar(v)}>
                  <span className="rc-turno-hora rc-serif">{v.slot ? slotAHora(v.slot) : 'Libre'}</span>
                  <span className="rc-turno-info"><span className="rc-vivo-dot" />{v.guia_nombre ?? 'Guía'} · retomar</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="rc-eyebrow rc-selector-h">Turnos del 8 de octubre</h2>
          <div className="rc-turnos">
            {slots.map((s) => {
              const grupo = asistentes.filter((a) => a.slot === s)
              const conectados = grupo.filter((a) => presencia[a.token] && ahora - Date.parse(presencia[a.token]) < 3 * 60 * 1000).length
              return (
                <button key={s} className={`rc-turno${grupo.length ? '' : ' is-vacio'}`} onClick={() => onEmpezar(s)}>
                  <span className="rc-turno-hora rc-serif">{slotAHora(s)}</span>
                  <span className="rc-turno-info">
                    {grupo.length
                      ? <>{grupo.map((a) => nombrePila(a.nombre)).join(', ')}{grupo.some((a) => a.exclusiva) && <em> · privada</em>}</>
                      : 'Sin reservas'}
                  </span>
                  {grupo.length > 0 && <span className="rc-turno-conn">{conectados}/{grupo.length} con el QR abierto</span>}
                </button>
              )
            })}
            <button className="rc-turno is-libre" onClick={() => onEmpezar(null)}>
              <span className="rc-turno-hora rc-serif">Libre</span>
              <span className="rc-turno-info">Visita sin turno (ensayo o imprevistos)</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

// ─── La visita ────────────────────────────────────────────────────────────────

function EnVisita({ visita, detalles, plano, grupo, presencia, onTerminar }: {
  visita: RcVisita
  detalles: RcDetalle[]
  plano: RcPlano
  grupo: InvitadoVisita[]
  presencia: Record<string, string>
  onTerminar: () => void
}) {
  const recorrido = useMemo(() => recorridoDe(detalles), [detalles])
  const diapositivas: Diapositiva[] = useMemo(
    () => [{ tipo: 'portada' }, { tipo: 'equipo' }, { tipo: 'video' }, ...recorrido.map((d) => ({ tipo: 'detalle' as const, d })), { tipo: 'fin' }],
    [recorrido]
  )
  const numeroDe = useMemo(() => new Map(recorrido.map((d, i) => [d.id, i + 1])), [recorrido])

  // Estado inicial: donde se quedó la visita (si se recargó la tablet).
  const inicialIdx = (() => {
    if (visita.modo === 'fin') return diapositivas.length - 1
    if (visita.modo === 'equipo') return 1
    if (visita.modo === 'video') return 2
    if (visita.modo === 'recorrido' && visita.detalle_id) {
      const i = recorrido.findIndex((d) => d.id === visita.detalle_id)
      if (i >= 0) return i + 3
    }
    return 0
  })()
  const [indice, setIndice] = useState(inicialIdx)
  const [foto, setFoto] = useState(0)
  // Momento en que arrancó el vídeo de introducción: los móviles se sincronizan con él.
  const [videoDesde, setVideoDesde] = useState<number | null>(null)
  useEffect(() => {
    // Solo la primera vez: al volver atrás se ve el fotograma congelado, no se relanza.
    if (diapositivas[indice]?.tipo === 'video') setVideoDesde((d) => d ?? Date.now())
  }, [indice]) // eslint-disable-line react-hooks/exhaustive-deps
  const [suelto, setSuelto] = useState<RcDetalle | null>(visita.modo === 'pregunta' ? detalles.find((d) => d.id === visita.detalle_id) ?? null : null)
  const [fotoSuelto, setFotoSuelto] = useState(0)
  const [verPlano, setVerPlano] = useState(false)
  const [verGrupo, setVerGrupo] = useState(false)
  const [confirmarFin, setConfirmarFin] = useState(false)
  const planoRef = useRef<PlanoHandle>(null)
  const canal = useRef<ReturnType<typeof abrirCanal> | null>(null)

  useEffect(() => {
    canal.current = abrirCanal(visita.id)
    return () => { canal.current?.cerrar(); canal.current = null }
  }, [visita.id])

  // Cada cambio sale al instante por el canal y se guarda (con un respiro) en BD.
  const estado: RcEstado = useMemo(() => {
    const at = Date.now()
    if (suelto) return { modo: 'pregunta', paso: indice, detalle_id: suelto.id, foto: fotoSuelto, at }
    const dia = diapositivas[indice]
    if (dia?.tipo === 'fin') return { modo: 'fin', paso: indice, detalle_id: null, at }
    if (dia?.tipo === 'equipo') return { modo: 'equipo', paso: indice, detalle_id: null, at }
    if (dia?.tipo === 'video') return { modo: 'video', paso: indice, detalle_id: null, desde: videoDesde ?? at, at }
    if (dia?.tipo === 'detalle') return { modo: 'recorrido', paso: indice, detalle_id: dia.d.id, foto, at }
    return { modo: 'inicio', paso: 0, detalle_id: null, at }
  }, [suelto, fotoSuelto, indice, foto, diapositivas, videoDesde])

  useEffect(() => {
    canal.current?.enviar(estado)
    const t = window.setTimeout(() => { updateVisita(visita.id, estado) }, 500)
    // Latido: reenvía el estado cada 8 s para quien acabe de abrir el QR.
    const lat = window.setInterval(() => canal.current?.enviar({ ...estado, at: Date.now() }), 8000)
    return () => { window.clearTimeout(t); window.clearInterval(lat) }
  }, [estado, visita.id])

  function irA(i: number) { setIndice(i); setFoto(0) }

  function abrirDesdePlano(id: string) {
    const n = numeroDe.get(id)
    setVerPlano(false)
    if (n) { setSuelto(null); irA(n + 2); return }
    const d = detalles.find((x) => x.id === id)
    if (d) { setSuelto(d); setFotoSuelto(0) }
  }

  const actualId = suelto?.id ?? (diapositivas[indice]?.tipo === 'detalle' ? (diapositivas[indice] as { d: { id: string } }).d.id : null)
  const pins: RcPin[] = detalles.map((d) => ({ id: d.id, x: d.x, y: d.y, numero: numeroDe.get(d.id) }))
  const ruta = recorrido.map((d) => ({ x: d.x, y: d.y }))
  const ahora = Date.now()
  const conectado = (t: string) => !!presencia[t] && ahora - Date.parse(presencia[t]) < 3 * 60 * 1000
  const nConectados = grupo.filter((a) => conectado(a.token)).length
  const hora = visita.slot ? slotAHora(visita.slot) : null

  useEffect(() => {
    if (verPlano && actualId) {
      const d = detalles.find((x) => x.id === actualId)
      if (d) window.setTimeout(() => planoRef.current?.focusPoint(d.x, d.y, 1.6), 60)
    }
  }, [verPlano]) // eslint-disable-line react-hooks/exhaustive-deps

  const minimapa = actualId ? (
    <button className="rc-minimapa" onClick={() => setVerPlano(true)} aria-label="Abrir plano">
      <Plano src={plano.url} imgW={plano.w} imgH={plano.h} pins={pins.filter((p) => p.id === actualId || p.numero)} vivoId={actualId} selectedId={actualId} ruta={ruta} tema="oscuro" estatico margen={0.92} />
    </button>
  ) : null

  const portada = (
    <div className="rc-portada">
      <img className="rc-portada-img" src={`/open-house/cc38/assets/${PORTADAS[0]}.webp`} alt="" />
      <div className="rc-portada-txt">
        <img className="rc-portada-logo" src="/open-house/cc38/assets/isotipo-light.png" alt="Forma Prima" />
        <span className="rc-eyebrow">Open House{hora ? ` · ${hora}` : ''}</span>
        <h1 className="rc-serif">Claudio<br />Coello 38</h1>
        {grupo.length > 0 && (
          <p className="rc-portada-nombres">
            {grupo.map((a, i) => (
              <span key={a.token}>{i > 0 && (i === grupo.length - 1 ? ' y ' : ', ')}<span className={conectado(a.token) ? 'is-conn' : ''}>{nombrePila(a.nombre)}</span></span>
            ))}
          </p>
        )}
        <p className="rc-portada-pista">Toca a la derecha para empezar →</p>
      </div>
    </div>
  )

  const fin = (
    <div className="rc-portada rc-portada-fin">
      <img className="rc-portada-img" src={`/open-house/cc38/assets/${PORTADAS[2]}.webp`} alt="" />
      <div className="rc-portada-txt">
        <span className="rc-eyebrow">Fin del recorrido</span>
        <h1 className="rc-serif">Gracias por<br />venir</h1>
        <p className="rc-portada-pista">Los invitados conservan el recorrido en su móvil.</p>
      </div>
    </div>
  )

  return (
    <div className="rc-app rc-oscuro rc-guia">
      {suelto ? (
        <Story
          diapositivas={[{ tipo: 'detalle', d: suelto }]} indice={0} onIndice={() => {}}
          foto={fotoSuelto} onFoto={setFotoSuelto} tema="oscuro" total={recorrido.length}
          suelto="Pregunta · fuera del recorrido" mostrarNotas esquina={minimapa}
          pie={
            <div className="rc-pie-guia">
              <button className="rc-btn rc-btn-claro" onClick={() => setSuelto(null)}>← Volver al recorrido</button>
              <button className="rc-btn rc-btn-ghost" onClick={() => setVerPlano(true)}>Plano</button>
            </div>
          }
        />
      ) : (
        <Story
          diapositivas={diapositivas} indice={indice} onIndice={irA} foto={foto} onFoto={setFoto}
          tema="oscuro" total={recorrido.length} mostrarNotas portada={portada} fin={fin} esquina={minimapa}
          equipo={<SlideEquipo />} video={<VideoIntro modo="guia" desde={videoDesde} onRepetir={() => setVideoDesde(Date.now())} />}
          pie={
            <div className="rc-pie-guia">
              <button className="rc-btn rc-btn-ghost" onClick={() => setVerPlano(true)}>Plano</button>
              <button className="rc-btn rc-btn-ghost" onClick={() => setVerGrupo(true)}>
                <span className="rc-vivo-dot" />{hora ?? 'Libre'} · {nConectados}/{grupo.length || '—'}
              </button>
              <button className="rc-btn rc-btn-ghost" onClick={() => setConfirmarFin(true)}>Terminar</button>
            </div>
          }
        />
      )}

      {verPlano && (
        <div className="rc-capa">
          <div className="rc-capa-cab">
            <div>
              <span className="rc-eyebrow">Plano · toca cualquier punto</span>
              <p className="rc-serif">Numerados: recorrido · Puntos: resto de detalles</p>
            </div>
            <button className="rc-btn rc-btn-claro rc-btn-sm" onClick={() => setVerPlano(false)}>Cerrar</button>
          </div>
          <div className="rc-capa-plano">
            <Plano ref={planoRef} src={plano.url} imgW={plano.w} imgH={plano.h} pins={pins} vivoId={actualId} selectedId={actualId} ruta={ruta} tema="oscuro" onSelectPin={abrirDesdePlano} />
          </div>
        </div>
      )}

      {verGrupo && (
        <div className="rc-capa rc-capa-centro" onClick={() => setVerGrupo(false)}>
          <div className="rc-tarjeta" onClick={(e) => e.stopPropagation()}>
            <span className="rc-eyebrow">Visita {hora ?? 'libre'}</span>
            <p className="rc-serif rc-tarjeta-tit">Tu grupo</p>
            {grupo.length === 0 && <p className="rc-tarjeta-txt">Sin invitados asignados a este turno.</p>}
            <ul className="rc-grupo-lista">
              {grupo.map((a) => (
                <li key={a.token}>
                  <span className={`rc-estado-dot${conectado(a.token) ? ' is-on' : ''}`} />
                  <span>{a.nombre}</span>
                  <small>{conectado(a.token) ? 'siguiendo en su móvil' : presencia[a.token] ? 'abrió el QR' : 'sin abrir'}</small>
                </li>
              ))}
            </ul>
            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setVerGrupo(false)}>Cerrar</button>
          </div>
        </div>
      )}

      {confirmarFin && (
        <div className="rc-capa rc-capa-centro">
          <div className="rc-tarjeta">
            <p className="rc-serif rc-tarjeta-tit">¿Terminar la visita?</p>
            <p className="rc-tarjeta-txt">Los móviles del grupo pasarán a «Gracias por venir» y podrán seguir explorando la casa.</p>
            <button className="rc-btn rc-btn-bronce" onClick={() => { setConfirmarFin(false); setSuelto(null); irA(diapositivas.length - 1); window.setTimeout(onTerminar, 900) }}>Terminar</button>
            <button className="rc-link" onClick={() => setConfirmarFin(false)}>Seguir</button>
          </div>
        </div>
      )}
    </div>
  )
}
