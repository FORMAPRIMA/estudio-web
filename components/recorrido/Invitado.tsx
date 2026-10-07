'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Plano from './Plano'
import type { PlanoHandle, RcPin } from './Plano'
import Story from './Story'
import VideoIntro from './VideoIntro'
import type { Diapositiva } from './Story'
import {
  ANTES_MIN, DESPUES_MIN, horaEvento, nombrePila, rangoEstancia, recorridoDe, slotAHora,
} from '@/lib/recorrido/domain'
import type { RcDetallePublico, RcEstado, RcPlano } from '@/lib/recorrido/domain'
import { abrirCanal, avisar, pedirVisita, pedirVisitas } from '@/lib/recorrido/directo'
import type { VisitaPublica } from '@/lib/recorrido/directo'

// Lo que ve el invitado al escanear su QR. La misma URL cambia con la hora:
// antes de su turno, la cuenta atrás; durante, la bienvenida y el directo de
// SU visita; después, las gracias y la casa entera para explorar.

export interface InvitadoProps {
  token: string
  invitado: { nombre: string; slot: string | null; grupo: string } | null
  detalles: RcDetallePublico[]
  plano: RcPlano
  ahoraServidor: number
}

type Fase = 'antes' | 'visita' | 'despues'
type Vista = 'directo' | 'plano' | 'explorar'

const FOTOS = ['cc38-3919', 'cc38-3887', 'cc38-4101', 'cc38-3943', 'cc38-3985']
const DIA_EVENTO_FIN = horaEvento('23:59')

function faseDe(slot: string | null, ahora: number): Fase {
  if (!slot) return ahora > DIA_EVENTO_FIN ? 'despues' : 'visita'
  const ini = horaEvento(slotAHora(slot))
  if (ahora < ini - ANTES_MIN * 60000) return 'antes'
  if (ahora <= ini + (30 + DESPUES_MIN) * 60000) return 'visita'
  return 'despues'
}

export default function Invitado({ token, invitado, detalles, plano, ahoraServidor }: InvitadoProps) {
  // Reloj del servidor: el del móvil puede ir desajustado.
  const desfase = useRef(ahoraServidor - Date.now())
  const [ahora, setAhora] = useState(ahoraServidor)
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now() + desfase.current), 1000)
    return () => window.clearInterval(t)
  }, [])

  // ?fase=antes|visita|despues fuerza una pantalla (ensayos). Se lee tras montar para no romper la hidratación.
  const [forzada, setForzada] = useState<Fase | null>(null)
  useEffect(() => { setForzada(new URLSearchParams(window.location.search).get('fase') as Fase | null) }, [])
  const fase: Fase = forzada && ['antes', 'visita', 'despues'].includes(forzada) ? forzada : faseDe(invitado?.slot ?? null, ahora)

  const recorrido = useMemo(() => recorridoDe(detalles), [detalles])
  const numeroDe = useMemo(() => new Map(recorrido.map((d, i) => [d.id, i + 1])), [recorrido])
  const porId = useMemo(() => new Map(detalles.map((d) => [d.id, d])), [detalles])
  const diapositivas: Diapositiva[] = useMemo(
    () => [{ tipo: 'portada' }, { tipo: 'video' }, ...recorrido.map((d) => ({ tipo: 'detalle' as const, d })), { tipo: 'fin' }],
    [recorrido]
  )

  // ── Visitas en curso y la mía ──────────────────────────────────────────────
  const [visitas, setVisitas] = useState<VisitaPublica[]>([])
  const [elegida, setElegida] = useState<string | null>(null)
  const refrescarVisitas = useCallback(async () => { setVisitas(await pedirVisitas()) }, [])
  useEffect(() => {
    if (fase !== 'visita') return
    refrescarVisitas()
    const t = window.setInterval(() => { if (!document.hidden) refrescarVisitas() }, 10000)
    return () => window.clearInterval(t)
  }, [fase, refrescarVisitas])

  const miVisita: VisitaPublica | null = useMemo(() => {
    if (elegida) return visitas.find((v) => v.id === elegida) ?? null
    const mias = visitas.filter((v) => invitado?.slot && v.slot === invitado.slot)
    return mias[0] ?? null
  }, [visitas, elegida, invitado])

  // ── Estado del directo ─────────────────────────────────────────────────────
  const [directo, setDirecto] = useState<RcEstado | null>(null)
  useEffect(() => {
    if (!miVisita) { setDirecto(null); return }
    setDirecto((d) => (d && d.at >= miVisita.at ? d : { modo: miVisita.modo, paso: miVisita.paso, detalle_id: miVisita.detalle_id, at: miVisita.at }))
    // El canal manda (llega en orden y con el reloj del guía). El estado guardado
    // solo se consulta si el canal lleva más de 12 s callado: el guía late cada 8.
    let ultimoCanal = 0
    const canal = abrirCanal(miVisita.id, (e) => { ultimoCanal = Date.now(); setDirecto(e) })
    const t = window.setInterval(async () => {
      if (document.hidden || Date.now() - ultimoCanal < 12000) return
      const v = await pedirVisita(miVisita.id)
      if (v) setDirecto((d) => (d && d.modo === v.modo && d.detalle_id === v.detalle_id ? d : { modo: v.modo, paso: v.paso, detalle_id: v.detalle_id, at: v.at }))
    }, 5000)
    return () => { canal.cerrar(); window.clearInterval(t) }
  }, [miVisita?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Presencia: el guía ve quién sigue la visita en su móvil.
  useEffect(() => {
    if (!token) return
    avisar(token, 'presencia', { visita_id: miVisita?.id ?? null })
    const t = window.setInterval(() => { if (!document.hidden) avisar(token, 'presencia', { visita_id: miVisita?.id ?? null }) }, 45000)
    return () => window.clearInterval(t)
  }, [token, miVisita?.id])

  // ── Navegación propia (desenganchado del directo) ──────────────────────────
  const [vista, setVista] = useState<Vista>('directo')
  const [idxPropio, setIdxPropio] = useState(0)
  const [fotoPropia, setFotoPropia] = useState(0)
  const [suelto, setSuelto] = useState<RcDetallePublico | null>(null)
  const [fotoSuelto, setFotoSuelto] = useState(0)
  const [bienvenida, setBienvenida] = useState(true)
  const planoRef = useRef<PlanoHandle>(null)

  // Índice y foto que marca el guía.
  const idxDirecto = useMemo(() => {
    if (!directo) return 0
    if (directo.modo === 'fin') return diapositivas.length - 1
    if (directo.modo === 'video') return 1
    if (directo.modo === 'recorrido' && directo.detalle_id) {
      const i = recorrido.findIndex((d) => d.id === directo.detalle_id)
      if (i >= 0) return i + 2
    }
    if (directo.modo === 'pregunta') return Math.min(directo.paso, diapositivas.length - 1)
    return 0
  }, [directo, recorrido, diapositivas.length])
  const preguntaDirecto = directo?.modo === 'pregunta' && directo.detalle_id ? porId.get(directo.detalle_id) ?? null : null

  const siguiendo = vista === 'directo' && !!miVisita && fase === 'visita'
  const directoAvanzo = useRef<number>(0)
  const [aviso, setAviso] = useState(false)
  useEffect(() => {
    if (!directo) return
    if (directoAvanzo.current && !siguiendo) setAviso(true)
    directoAvanzo.current = directo.at
  }, [directo?.detalle_id, directo?.modo]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (siguiendo) setAviso(false) }, [siguiendo])

  // Cuando el guía arranca, la bienvenida da paso al directo sola.
  useEffect(() => { if (directo && directo.modo !== 'inicio') setBienvenida(false) }, [directo?.modo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Qué detalle se está viendo (para la traza de interés).
  const vistoId = (() => {
    if (siguiendo) return preguntaDirecto?.id ?? (diapositivas[idxDirecto]?.tipo === 'detalle' ? (diapositivas[idxDirecto] as { d: RcDetallePublico }).d.id : null)
    if (suelto) return suelto.id
    if (vista === 'explorar') return diapositivas[idxPropio]?.tipo === 'detalle' ? (diapositivas[idxPropio] as { d: RcDetallePublico }).d.id : null
    return null
  })()
  useEffect(() => {
    if (!vistoId || !token) return
    const t = window.setTimeout(() => avisar(token, 'vista', { detalle_id: vistoId }), 2500)
    return () => window.clearTimeout(t)
  }, [vistoId, token])

  function abrirDetalle(id: string) {
    const n = numeroDe.get(id)
    if (n) { setSuelto(null); setIdxPropio(n + 1); setFotoPropia(0); setVista('explorar'); return }
    const d = porId.get(id)
    if (d) { setSuelto(d); setFotoSuelto(0); setVista('explorar') }
  }

  function volverAlDirecto() { setSuelto(null); setVista('directo') }

  const pins: RcPin[] = detalles.map((d) => ({ id: d.id, x: d.x, y: d.y, numero: numeroDe.get(d.id) }))
  const ruta = recorrido.map((d) => ({ x: d.x, y: d.y }))
  const nombre = invitado ? nombrePila(invitado.nombre) : ''
  const hora = invitado?.slot ? slotAHora(invitado.slot) : null

  // ── Pantallas ──────────────────────────────────────────────────────────────

  if (fase === 'antes' && invitado?.slot) {
    const falta = Math.max(0, horaEvento(slotAHora(invitado.slot)) - ahora)
    const d = Math.floor(falta / 86400000)
    const h = Math.floor((falta % 86400000) / 3600000)
    const m = Math.floor((falta % 3600000) / 60000)
    const s = Math.floor((falta % 60000) / 1000)
    return (
      <div className="rc-app rc-claro">
        <div className="rc-hero">
          <img className="rc-hero-img" src={`/open-house/cc38/assets/${FOTOS[1]}.webp`} alt="" />
          <div className="rc-hero-txt">
            <img className="rc-hero-logo" src="/open-house/cc38/assets/isotipo-light.png" alt="Forma Prima" />
            <span className="rc-eyebrow">Open House · Claudio Coello 38</span>
            <h1 className="rc-serif">{nombre ? `${nombre}, te` : 'Te'} esperamos<br />a las {hora}</h1>
            <div className="rc-cuenta">
              {d > 0 && <span><b>{d}</b><small>días</small></span>}
              <span><b>{String(h).padStart(2, '0')}</b><small>horas</small></span>
              <span><b>{String(m).padStart(2, '0')}</b><small>min</small></span>
              <span><b>{String(s).padStart(2, '0')}</b><small>seg</small></span>
            </div>
            <p className="rc-hero-nota">Jueves 8 de octubre · Claudio Coello 38, 2º dcha.<br />Este mismo enlace te acompañará durante la visita.</p>
            <a className="rc-btn rc-btn-claro" href={`/cc38/${token}?pase=1`}>Ver mi invitación</a>
          </div>
        </div>
      </div>
    )
  }

  const despues = fase === 'despues' || (!!directo && directo.modo === 'fin' && miVisita?.terminada)

  // Bienvenida (al escanear el QR en la puerta, antes de que el guía arranque).
  if (fase === 'visita' && bienvenida && vista === 'directo' && (!directo || directo.modo === 'inicio')) {
    const enMarcha = visitas.filter((v) => v.id !== miVisita?.id)
    return (
      <div className="rc-app rc-claro">
        <div className="rc-hero">
          <img className="rc-hero-img rc-kenburns" src={`/open-house/cc38/assets/${FOTOS[0]}.webp`} alt="" />
          <div className="rc-hero-txt">
            <img className="rc-hero-logo" src="/open-house/cc38/assets/isotipo-light.png" alt="Forma Prima" />
            <span className="rc-eyebrow">Open House{hora ? ` · ${hora}` : ''}</span>
            <h1 className="rc-serif">{nombre ? `Hola, ${nombre}.` : 'Bienvenidos.'}</h1>
            <p className="rc-serif rc-hero-sub">Te damos la bienvenida a Claudio Coello 38</p>
            {miVisita ? (
              <p className="rc-hero-nota"><span className="rc-vivo-dot" />{miVisita.guia ? `${miVisita.guia} te guiará` : 'Tu visita está a punto de empezar'}. Esta pantalla seguirá el recorrido.</p>
            ) : (
              <p className="rc-hero-nota">Cuando empiece tu visita, esta pantalla seguirá al guía por la casa: cada detalle, en tu mano.</p>
            )}
            <div className="rc-hero-acc">
              <button className="rc-btn rc-btn-claro" onClick={() => setBienvenida(false)}>{miVisita ? 'Entrar' : 'Ver la casa mientras tanto'}</button>
              <button className="rc-btn rc-btn-ghost rc-btn-luz" onClick={() => { setBienvenida(false); setVista('plano') }}>Plano</button>
            </div>
            {!miVisita && enMarcha.length > 0 && !invitado?.slot && (
              <div className="rc-unirse">
                <span className="rc-eyebrow">Visitas en marcha</span>
                {enMarcha.map((v) => (
                  <button key={v.id} onClick={() => { setElegida(v.id); setBienvenida(false) }}>
                    <span className="rc-vivo-dot" />{v.slot ? slotAHora(v.slot) : 'Visita'}{v.guia ? ` · con ${v.guia}` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const pieComun = (
    <nav className="rc-tabbar">
      {fase === 'visita' && miVisita && !despues && (
        <button className={vista === 'directo' ? 'is-on' : ''} onClick={volverAlDirecto}><span className="rc-vivo-dot" />Directo</button>
      )}
      <button className={vista === 'explorar' && !suelto ? 'is-on' : ''} onClick={() => { setSuelto(null); setVista('explorar'); if (idxPropio === 0 && siguiendo) setIdxPropio(idxDirecto) }}>Recorrido</button>
      <button className={vista === 'plano' ? 'is-on' : ''} onClick={() => setVista('plano')}>Plano</button>
    </nav>
  )

  const fin = (
    <div className="rc-portada rc-portada-claro">
      <img className="rc-portada-img" src={`/open-house/cc38/assets/${FOTOS[2]}.webp`} alt="" />
      <div className="rc-portada-txt">
        <img className="rc-portada-logo" src="/open-house/cc38/assets/isotipo-light.png" alt="Forma Prima" />
        <span className="rc-eyebrow">Claudio Coello 38</span>
        <h1 className="rc-serif">Gracias por<br />venir{nombre ? `, ${nombre}` : ''}</h1>
        <p className="rc-portada-pista">Este enlace es tuyo: vuelve a la casa cuando quieras.</p>
        <div className="rc-hero-acc">
          <a className="rc-btn rc-btn-claro" href={`mailto:contacto@formaprima.es?subject=${encodeURIComponent('Open House · Claudio Coello 38')}`}>Hablar con el estudio</a>
        </div>
      </div>
    </div>
  )

  const portada = (
    <div className="rc-portada rc-portada-claro">
      <img className="rc-portada-img" src={`/open-house/cc38/assets/${FOTOS[0]}.webp`} alt="" />
      <div className="rc-portada-txt">
        <img className="rc-portada-logo" src="/open-house/cc38/assets/isotipo-light.png" alt="Forma Prima" />
        <span className="rc-eyebrow">Open House{hora ? ` · ${hora}` : ''}</span>
        <h1 className="rc-serif">Claudio<br />Coello 38</h1>
        <p className="rc-portada-pista">{recorrido.length} paradas · desliza para recorrerlas</p>
      </div>
    </div>
  )

  // Después de la visita, sin directo: la casa para explorar.
  const verDirecto = siguiendo && !despues

  return (
    <div className="rc-app rc-claro rc-invitado">
      {vista === 'plano' ? (
        <div className="rc-inv-plano">
          <div className="rc-inv-plano-cab">
            <span className="rc-eyebrow">Claudio Coello 38 · 2º dcha.</span>
            <p className="rc-serif">Toca cualquier punto</p>
          </div>
          <div className="rc-inv-plano-area">
            <Plano ref={planoRef} src={plano.url} imgW={plano.w} imgH={plano.h} pins={pins} ruta={ruta} tema="claro"
              vivoId={verDirecto || (siguiendo && directo) ? (preguntaDirecto?.id ?? (diapositivas[idxDirecto] as { d?: RcDetallePublico })?.d?.id ?? null) : null}
              onSelectPin={abrirDetalle} />
          </div>
          <Indice detalles={detalles} numeroDe={numeroDe} onAbrir={abrirDetalle} />
        </div>
      ) : verDirecto && preguntaDirecto ? (
        <Story diapositivas={[{ tipo: 'detalle', d: preguntaDirecto }]} indice={0} onIndice={() => {}}
          foto={Math.min(directo?.foto ?? 0, Math.max(0, preguntaDirecto.fotos.length - 1))} onFoto={() => setVista('explorar')}
          tema="claro" total={recorrido.length} suelto="En directo · pregunta de la visita" />
      ) : verDirecto ? (
        <Story diapositivas={diapositivas} indice={idxDirecto}
          onIndice={(i) => { setIdxPropio(i); setFotoPropia(0); setVista('explorar') }}
          foto={Math.min(directo?.foto ?? 0, 20)} onFoto={(f) => { setIdxPropio(idxDirecto); setFotoPropia(f); setVista('explorar') }}
          tema="claro" total={recorrido.length} portada={portada} fin={fin}
          video={<VideoIntro modo="invitado" desde={directo?.desde ?? directo?.at ?? null} />}
          esquina={<span className="rc-chip-vivo"><span className="rc-vivo-dot" />En directo</span>} />
      ) : suelto ? (
        <Story diapositivas={[{ tipo: 'detalle', d: suelto }]} indice={0} onIndice={() => {}}
          foto={fotoSuelto} onFoto={setFotoSuelto} tema="claro" total={recorrido.length}
          suelto="Detalle de la casa"
          esquina={<button className="rc-chip-cerrar" onClick={() => { setSuelto(null); setVista('plano') }}>Plano</button>} />
      ) : (
        <Story diapositivas={diapositivas} indice={idxPropio} onIndice={(i) => { setIdxPropio(i); setFotoPropia(0) }}
          foto={fotoPropia} onFoto={setFotoPropia} tema="claro" total={recorrido.length} portada={portada} fin={fin}
          video={<VideoIntro modo="invitado" />} />
      )}

      {!verDirecto && miVisita && fase === 'visita' && !despues && (
        <button className={`rc-volver-directo${aviso ? ' is-aviso' : ''}`} onClick={volverAlDirecto}>
          <span className="rc-vivo-dot" />{aviso ? 'El guía ha avanzado · volver' : 'Volver al directo'}
        </button>
      )}

      {pieComun}
    </div>
  )
}

function Indice({ detalles, numeroDe, onAbrir }: { detalles: RcDetallePublico[]; numeroDe: Map<string, number>; onAbrir: (id: string) => void }) {
  const grupos = useMemo(() => {
    const m = new Map<string, RcDetallePublico[]>()
    detalles.forEach((d) => { const k = d.estancia || 'La casa'; m.set(k, [...(m.get(k) ?? []), d]) })
    return Array.from(m.entries()).sort((a, b) => rangoEstancia(a[0]) - rangoEstancia(b[0]))
  }, [detalles])
  return (
    <div className="rc-indice">
      {grupos.map(([e, ds]) => (
        <section key={e}>
          <h3 className="rc-eyebrow">{e}</h3>
          <div className="rc-indice-fila">
            {ds.map((d) => (
              <button key={d.id} onClick={() => onAbrir(d.id)} className="rc-indice-item">
                {d.fotos[0] ? <img src={d.fotos[0].url} alt="" loading="lazy" /> : <span className="rc-indice-vacia" />}
                {numeroDe.get(d.id) && <em>{numeroDe.get(d.id)}</em>}
                <span>{d.titulo}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
