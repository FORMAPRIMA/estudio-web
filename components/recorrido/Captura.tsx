'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Plano from './Plano'
import Visor from './Visor'
import type { PlanoHandle, RcPin } from './Plano'
import {
  CATEGORIAS, ESTANCIAS, rangoEstancia, recorridoDe,
} from '@/lib/recorrido/domain'
import type { RcDetalle, RcPlano } from '@/lib/recorrido/domain'
import {
  createDetalle, deleteDetalle, getDetalles, mergeDetalle, setOrdenRecorrido, setPlano, updateDetalle,
} from '@/app/actions/recorrido'
import { subirFoto, subirPlano } from '@/lib/recorrido/upload'
import type { FotoSubida } from '@/lib/recorrido/upload'

// App del equipo para el Open House: subir detalles sobre el plano (hoy, en el
// piso, desde el móvil) y montar el recorrido del guía (Selección).

interface Borrador {
  id: string | null
  x: number
  y: number
  titulo: string
  estancia: string
  categoria: string
  texto: string
  notas_guia: string
  destacado: boolean
  fotos: FotoSubida[]
}

const CLAVE_BORRADOR = 'rc-borrador-v1'
const CLAVE_ESTANCIA = 'rc-ultima-estancia'

function aBorrador(d: RcDetalle): Borrador {
  return {
    id: d.id, x: d.x, y: d.y, titulo: d.titulo, estancia: d.estancia ?? '', categoria: d.categoria ?? '',
    texto: d.texto ?? '', notas_guia: d.notas_guia ?? '', destacado: d.destacado,
    fotos: d.fotos.map((f) => ({ url: f.url, w: f.w ?? 0, h: f.h ?? 0 })),
  }
}

function leerLS(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function escribirLS(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* privado */ } }

export default function Captura({ inicial, plano: planoInicial, usuario }: { inicial: RcDetalle[]; plano: RcPlano; usuario: string }) {
  const [detalles, setDetalles] = useState<RcDetalle[]>(inicial)
  const [plano, setPlanoState] = useState<RcPlano>(planoInicial)
  const [tab, setTab] = useState<'plano' | 'seleccion'>('plano')
  const [placing, setPlacing] = useState(false)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const [editando, setEditando] = useState<Borrador | null>(null)
  const [selId, setSelId] = useState<string | null>(null)
  // Ficha de consulta (revisar sin editar) y visor de fotos a pantalla completa.
  const [ficha, setFicha] = useState<string | null>(null)
  const [visor, setVisor] = useState<{ fotos: string[]; i: number; titulo?: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [verSolo, setVerSolo] = useState<'todos' | 'mios'>('todos')
  const [reubicando, setReubicando] = useState<Borrador | null>(null)
  const planoRef = useRef<PlanoHandle>(null)

  const refrescar = useCallback(async () => {
    const r = await getDetalles()
    if (r.ok) setDetalles(r.data)
  }, [])

  // Lo que suben los demás aparece solo (todos están subiendo a la vez en el piso).
  useEffect(() => {
    const t = window.setInterval(() => { if (!document.hidden) refrescar() }, 15000)
    return () => window.clearInterval(t)
  }, [refrescar])

  // Si la cámara mató la pestaña a mitad de un alta, se recupera el borrador.
  useEffect(() => {
    const raw = leerLS(CLAVE_BORRADOR)
    if (!raw) return
    try {
      const b = JSON.parse(raw) as Borrador
      if (b && typeof b.x === 'number') { setEditando(b); setAviso('Hemos recuperado el detalle que estabas subiendo.') }
    } catch { escribirLS(CLAVE_BORRADOR, null) }
  }, [])

  useEffect(() => { if (!aviso) return; const t = window.setTimeout(() => setAviso(null), 3800); return () => window.clearTimeout(t) }, [aviso])

  const recorrido = useMemo(() => recorridoDe(detalles), [detalles])
  const numeroDe = useMemo(() => new Map(recorrido.map((d, i) => [d.id, i + 1])), [recorrido])

  const pins: RcPin[] = useMemo(() => detalles.map((d) => ({
    id: d.id, x: d.x, y: d.y, numero: numeroDe.get(d.id),
    apagado: verSolo === 'mios' && d.autor_nombre !== usuario,
  })), [detalles, numeroDe, verSolo, usuario])

  function empezarAlta() {
    setTab('plano')
    setSelId(null)
    setGhost(null)
    setPlacing(true)
  }

  function confirmarPosicion() {
    if (!ghost) return
    if (reubicando) {
      setEditando({ ...reubicando, x: ghost.x, y: ghost.y })
      setReubicando(null)
      setPlacing(false)
      setGhost(null)
      return
    }
    const ultima = leerLS(CLAVE_ESTANCIA) ?? ''
    setEditando({ id: null, x: ghost.x, y: ghost.y, titulo: '', estancia: ultima, categoria: '', texto: '', notas_guia: '', destacado: false, fotos: [] })
    setPlacing(false)
    setGhost(null)
  }

  async function guardado(msg: string) {
    escribirLS(CLAVE_BORRADOR, null)
    setEditando(null)
    setAviso(msg)
    await refrescar()
  }

  // ─── Selección ──────────────────────────────────────────────────────────────

  async function guardarOrden(ids: string[]) {
    // Optimista: el orden se ve al instante y se guarda detrás.
    setDetalles((ds) => ds.map((d) => {
      const i = ids.indexOf(d.id)
      return i >= 0 ? { ...d, destacado: true, orden: (i + 1) * 10 } : d
    }))
    const r = await setOrdenRecorrido(ids)
    if (!r.ok) { setAviso(r.error); refrescar() }
  }

  function mover(id: string, delta: number) {
    const ids = recorrido.map((d) => d.id)
    const i = ids.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    guardarOrden(ids)
  }

  async function alternarDestacado(d: RcDetalle) {
    setDetalles((ds) => ds.map((x) => (x.id === d.id ? { ...x, destacado: !d.destacado, orden: d.destacado ? x.orden : 1e6 } : x)))
    const r = await updateDetalle(d.id, { destacado: !d.destacado })
    if (!r.ok) setAviso(r.error)
    refrescar()
  }

  function ordenarPorEstancias() {
    const ids = [...recorrido]
      .sort((a, b) => rangoEstancia(a.estancia) - rangoEstancia(b.estancia) || a.orden - b.orden)
      .map((d) => d.id)
    guardarOrden(ids)
    setAviso('Recorrido ordenado por estancias.')
  }

  async function cambiarPlano(file: File) {
    setAviso('Subiendo plano…')
    try {
      const p = await subirPlano(file)
      const r = await setPlano(p)
      if (!r.ok) throw new Error(r.error)
      setPlanoState(p)
      setAviso('Plano actualizado.')
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo subir el plano.')
    }
  }

  const resto = detalles.filter((d) => !d.destacado)
  const restoPorEstancia = useMemo(() => {
    const m = new Map<string, RcDetalle[]>()
    resto.forEach((d) => { const k = d.estancia || 'Sin estancia'; m.set(k, [...(m.get(k) ?? []), d]) })
    return Array.from(m.entries()).sort((a, b) => rangoEstancia(a[0]) - rangoEstancia(b[0]))
  }, [resto])

  return (
    <div className="rc-app rc-oscuro">
      <header className="rc-cab">
        <div className="rc-cab-marca">
          <span className="rc-eyebrow">Open House · CC38</span>
          <span className="rc-cab-titulo">El recorrido</span>
        </div>
        <nav className="rc-tabs">
          <button className={tab === 'plano' ? 'is-on' : ''} onClick={() => setTab('plano')}>Plano</button>
          <button className={tab === 'seleccion' ? 'is-on' : ''} onClick={() => { setTab('seleccion'); setPlacing(false) }}>
            Selección <em>{recorrido.length}</em>
          </button>
          <a href="/recorrido/guia">Guía ↗</a>
        </nav>
      </header>

      {tab === 'plano' && (
        <main className="rc-main">
          <Plano
            ref={planoRef}
            src={plano.url} imgW={plano.w} imgH={plano.h}
            pins={pins}
            selectedId={selId}
            ruta={recorrido.map((d) => ({ x: d.x, y: d.y }))}
            placing={placing}
            ghost={ghost}
            onPlace={setGhost}
            onSelectPin={(id) => {
              if (placing) return
              const d = detalles.find((x) => x.id === id)
              if (d) { setSelId(id); setFicha(id) }
            }}
            onBackgroundTap={() => setSelId(null)}
          />

        </main>
      )}

      {tab === 'plano' && (
        <footer className="rc-barra-inf">
          {placing ? (
            <>
              <p className="rc-barra-msg">{ghost ? 'Arrastra el punto para afinar · pellizca para acercar' : 'Toca el plano donde está el detalle'}</p>
              <div className="rc-barra-acc">
                <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => {
                  setPlacing(false); setGhost(null)
                  if (reubicando) { setEditando(reubicando); setReubicando(null) }
                }}>Cancelar</button>
                <button className="rc-btn rc-btn-bronce rc-btn-sm" disabled={!ghost} onClick={confirmarPosicion}>Confirmar posición</button>
              </div>
            </>
          ) : (
            <>
              <div className="rc-contador">
                <span><b>{detalles.length}</b> detalles · <b>{recorrido.length}</b> en recorrido</span>
                <button className="rc-filtro" onClick={() => setVerSolo((v) => (v === 'todos' ? 'mios' : 'todos'))}>
                  {verSolo === 'todos' ? 'Ver solo los míos' : 'Ver todos'}
                </button>
              </div>
              <button className="rc-fab" onClick={empezarAlta}><span>+</span> Nuevo detalle</button>
            </>
          )}
        </footer>
      )}

      {tab === 'seleccion' && (
        <main className="rc-main rc-scroll">
          <section className="rc-sel">
            <div className="rc-sel-cab">
              <div>
                <h2 className="rc-serif">El recorrido</h2>
                <p>Lo que el guía cuenta en orden, como stories. Usa las flechas para ordenarlo.</p>
              </div>
              <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={ordenarPorEstancias} disabled={recorrido.length < 2}>
                Ordenar por estancias
              </button>
            </div>
            {recorrido.length === 0 && (
              <p className="rc-vacio">Marca con ☆ los detalles que deben estar en la narrativa principal.</p>
            )}
            <ol className="rc-lista">
              {recorrido.map((d, i) => (
                <li key={d.id} className="rc-fila">
                  <span className="rc-fila-num">{i + 1}</span>
                  <Miniatura d={d} onVer={(f) => setVisor(f)} />
                  <button className="rc-fila-txt" onClick={() => setFicha(d.id)}>
                    <span className="rc-fila-tit">{d.titulo || 'Sin título'}</span>
                    <span className="rc-fila-meta">{[d.estancia, d.categoria].filter(Boolean).join(' · ') || '—'}</span>
                  </button>
                  <div className="rc-fila-acc">
                    <button onClick={() => mover(d.id, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                    <button onClick={() => mover(d.id, 1)} disabled={i === recorrido.length - 1} aria-label="Bajar">↓</button>
                    <button className="is-star" onClick={() => alternarDestacado(d)} aria-label="Quitar del recorrido">★</button>
                  </div>
                </li>
              ))}
            </ol>

            <h3 className="rc-sel-sub">Resto de detalles <em>{resto.length}</em></h3>
            <p className="rc-sel-nota">Siguen en el plano: el guía y los invitados pueden abrirlos cuando surja una pregunta.</p>
            {restoPorEstancia.map(([estancia, ds]) => (
              <div key={estancia} className="rc-grupo">
                <h4 className="rc-eyebrow">{estancia}</h4>
                <ul className="rc-lista">
                  {ds.map((d) => (
                    <li key={d.id} className="rc-fila">
                      <Miniatura d={d} onVer={(f) => setVisor(f)} />
                      <button className="rc-fila-txt" onClick={() => setFicha(d.id)}>
                        <span className="rc-fila-tit">{d.titulo || 'Sin título'}</span>
                        <span className="rc-fila-meta">{[d.categoria, d.autor_nombre].filter(Boolean).join(' · ')}</span>
                      </button>
                      <div className="rc-fila-acc">
                        <button onClick={() => alternarDestacado(d)} aria-label="Añadir al recorrido">☆</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="rc-ajustes">
              <label className="rc-btn rc-btn-ghost rc-btn-sm">
                Cambiar plano (PDF o imagen)
                <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) cambiarPlano(f); e.target.value = '' }} />
              </label>
            </div>
          </section>
        </main>
      )}

      {editando && (
        <Editor
          inicial={editando}
          detalles={detalles}
          onCerrar={() => { escribirLS(CLAVE_BORRADOR, null); setEditando(null) }}
          onGuardado={guardado}
          onMover={(b) => {
            // Reubicar: se cierra la ficha, se coloca el punto y al confirmar vuelve.
            escribirLS(CLAVE_BORRADOR, JSON.stringify(b))
            setEditando(null)
            setTab('plano')
            setGhost({ x: b.x, y: b.y })
            setPlacing(true)
            setReubicando(b)
          }}
          onAviso={setAviso}
          onVerFotos={(fotos, i) => setVisor({ fotos, i, titulo: editando.titulo })}
        />
      )}

      {ficha && !editando && (() => {
        // Orden de consulta: el del recorrido y después el resto por estancia (como Selección).
        const orden = [...recorrido, ...restoPorEstancia.flatMap(([, ds]) => ds)]
        const i = orden.findIndex((x) => x.id === ficha)
        const d = orden[i]
        if (!d) return null
        return (
          <Ficha
            d={d}
            numero={numeroDe.get(d.id)}
            onCerrar={() => { setFicha(null); setSelId(null) }}
            onEditar={() => setEditando(aBorrador(d))}
            onVer={(fi) => setVisor({ fotos: d.fotos.map((f) => f.url), i: fi, titulo: d.titulo })}
            onAnterior={i > 0 ? () => { setFicha(orden[i - 1].id); setSelId(orden[i - 1].id) } : undefined}
            onSiguiente={i < orden.length - 1 ? () => { setFicha(orden[i + 1].id); setSelId(orden[i + 1].id) } : undefined}
            posicion={`${i + 1} / ${orden.length}`}
          />
        )
      })()}

      {visor && <Visor fotos={visor.fotos} inicio={visor.i} titulo={visor.titulo} onCerrar={() => setVisor(null)} />}

      {aviso && <div className="rc-toast">{aviso}</div>}
    </div>
  )

}

function Miniatura({ d, onVer }: { d: RcDetalle; onVer?: (v: { fotos: string[]; i: number; titulo?: string }) => void }) {
  const f = d.fotos[0]
  if (!f) return <span className="rc-mini rc-mini-vacia">—</span>
  if (!onVer) return <img className="rc-mini" src={f.url} alt="" loading="lazy" />
  return (
    <button className="rc-mini-btn" onClick={() => onVer({ fotos: d.fotos.map((x) => x.url), i: 0, titulo: d.titulo })} aria-label="Ver foto">
      <img className="rc-mini" src={f.url} alt="" loading="lazy" />
      {d.fotos.length > 1 && <em>{d.fotos.length}</em>}
    </button>
  )
}

// ─── Ficha de consulta ────────────────────────────────────────────────────────
// Lo que se abre al tocar un pin o una fila: revisar el detalle (foto grande,
// texto, autor) sin entrar a editar, y pasar al anterior / siguiente.

function Ficha({ d, numero, posicion, onCerrar, onEditar, onVer, onAnterior, onSiguiente }: {
  d: RcDetalle
  numero?: number
  posicion: string
  onCerrar: () => void
  onEditar: () => void
  onVer: (i: number) => void
  onAnterior?: () => void
  onSiguiente?: () => void
}) {
  const [i, setI] = useState(0)
  useEffect(() => { setI(0) }, [d.id])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea')) return
      if (document.querySelector('.rc-visor, .rc-hoja')) return  // manda el visor o el editor abierto encima
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowRight' && onSiguiente) onSiguiente()
      if (e.key === 'ArrowLeft' && onAnterior) onAnterior()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onCerrar, onAnterior, onSiguiente])
  const foto = d.fotos[i]
  return (
    <div className="rc-ficha" role="dialog" aria-label={d.titulo}>
      <div className="rc-ficha-cab">
        <button className="rc-link" onClick={onCerrar}>Cerrar</button>
        <span className="rc-eyebrow">{posicion}</span>
        <button className="rc-btn rc-btn-bronce rc-btn-sm" onClick={onEditar}>Editar</button>
      </div>
      <div className="rc-ficha-cuerpo">
        {foto ? (
          <button className="rc-ficha-foto" onClick={() => onVer(i)} aria-label="Ver foto a pantalla completa">
            <img src={foto.url} alt={d.titulo} />
            <span className="rc-ficha-zoom">⤢ Ver en grande</span>
          </button>
        ) : (
          <div className="rc-ficha-foto rc-ficha-sinfoto">Sin foto</div>
        )}
        {d.fotos.length > 1 && (
          <div className="rc-ficha-tiras">
            {d.fotos.map((f, j) => (
              <button key={f.id} className={j === i ? 'is-on' : ''} onClick={() => setI(j)}><img src={f.url} alt="" loading="lazy" /></button>
            ))}
          </div>
        )}
        <div className="rc-ficha-meta">
          {numero && <span className="rc-ficha-num">{numero}</span>}
          <span className="rc-eyebrow">{[d.estancia, d.categoria].filter(Boolean).join(' · ') || 'Sin estancia'}</span>
        </div>
        <h2 className="rc-serif rc-ficha-tit">{d.titulo || 'Sin título'}</h2>
        {d.texto ? <p className="rc-ficha-txt">{d.texto}</p> : <p className="rc-ficha-txt rc-ficha-vacio">Sin texto para los invitados.</p>}
        {d.notas_guia && (
          <div className="rc-story-notas">
            <span className="rc-eyebrow">Solo para el guía</span>
            <p>{d.notas_guia}</p>
          </div>
        )}
        <p className="rc-ficha-autor">Subido por {d.autor_nombre ?? '—'}</p>
      </div>
      <div className="rc-ficha-pie">
        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={onAnterior} disabled={!onAnterior}>‹ Anterior</button>
        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={onSiguiente} disabled={!onSiguiente}>Siguiente ›</button>
      </div>
    </div>
  )
}

// ─── Ficha de alta / edición ──────────────────────────────────────────────────

function Editor({ inicial, detalles, onCerrar, onGuardado, onMover, onAviso, onVerFotos }: {
  inicial: Borrador
  detalles: RcDetalle[]
  onCerrar: () => void
  onGuardado: (msg: string) => void
  onMover: (b: Borrador) => void
  onAviso: (m: string) => void
  onVerFotos: (fotos: string[], i: number) => void
}) {
  const [b, setB] = useState<Borrador>(inicial)
  const [subiendo, setSubiendo] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [puliendo, setPuliendo] = useState(false)
  const [deshacer, setDeshacer] = useState<{ titulo: string; texto: string } | null>(null)
  const [uniendo, setUniendo] = useState(false)
  const [confirmarCierre, setConfirmarCierre] = useState(false)
  const sucio = JSON.stringify(b) !== JSON.stringify(inicial)

  // Borrador a salvo en cada cambio: abrir la cámara del móvil puede matar la pestaña.
  useEffect(() => { escribirLS(CLAVE_BORRADOR, JSON.stringify(b)) }, [b])

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }))

  async function anadirFotos(files: FileList | null) {
    if (!files?.length) return
    const lista = Array.from(files)
    setSubiendo((n) => n + lista.length)
    await Promise.all(lista.map(async (f) => {
      try {
        const foto = await subirFoto(f)
        setB((x) => ({ ...x, fotos: [...x.fotos, foto] }))
      } catch (e) {
        onAviso(e instanceof Error ? `Foto: ${e.message}` : 'No se pudo subir una foto.')
      } finally {
        setSubiendo((n) => n - 1)
      }
    }))
  }

  function moverFoto(i: number, delta: number) {
    setB((x) => {
      const f = [...x.fotos]
      const j = i + delta
      if (j < 0 || j >= f.length) return x
      ;[f[i], f[j]] = [f[j], f[i]]
      return { ...x, fotos: f }
    })
  }

  async function pulir() {
    if (!b.texto.trim() && !b.titulo.trim()) { onAviso('Escribe o dicta primero unas notas.'); return }
    setPuliendo(true)
    try {
      const r = await fetch('/api/recorrido/pulir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: b.titulo, notas: b.texto, estancia: b.estancia, categoria: b.categoria }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Error')
      setDeshacer({ titulo: b.titulo, texto: b.texto })
      setB((x) => ({ ...x, titulo: j.titulo || x.titulo, texto: j.texto || x.texto }))
    } catch (e) {
      onAviso(e instanceof Error ? e.message : 'No se pudo pulir el texto.')
    } finally {
      setPuliendo(false)
    }
  }

  async function guardar() {
    if (subiendo > 0) { onAviso('Espera a que terminen de subir las fotos.'); return }
    if (!b.titulo.trim() && !b.fotos.length) { onAviso('Pon al menos un título o una foto.'); return }
    setGuardando(true)
    if (b.estancia) escribirLS(CLAVE_ESTANCIA, b.estancia)
    const datos = {
      x: b.x, y: b.y, titulo: b.titulo, estancia: b.estancia || null, categoria: b.categoria || null,
      texto: b.texto, notas_guia: b.notas_guia, destacado: b.destacado, fotos: b.fotos,
    }
    const r = b.id ? await updateDetalle(b.id, datos) : await createDetalle(datos)
    setGuardando(false)
    if (!r.ok) { onAviso(r.error); return }
    onGuardado(b.id ? 'Detalle actualizado.' : 'Detalle guardado en el plano.')
  }

  async function eliminar() {
    if (!b.id) { onCerrar(); return }
    if (!window.confirm('¿Eliminar este detalle y sus fotos del recorrido?')) return
    const r = await deleteDetalle(b.id)
    if (!r.ok) { onAviso(r.error); return }
    onGuardado('Detalle eliminado.')
  }

  async function unirCon(destinoId: string) {
    if (!b.id) return
    const r = await mergeDetalle(b.id, destinoId)
    if (!r.ok) { onAviso(r.error); return }
    onGuardado('Detalles unidos.')
  }

  const candidatos = detalles
    .filter((d) => d.id !== b.id)
    .sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))
    .slice(0, 12)

  return (
    <div className="rc-hoja" role="dialog" aria-modal="true">
      <div className="rc-hoja-cab">
        <button className="rc-link" onClick={() => (sucio ? setConfirmarCierre(true) : onCerrar())}>Cerrar</button>
        <span className="rc-eyebrow">{b.id ? 'Editar detalle' : 'Nuevo detalle'}</span>
        <button className="rc-btn rc-btn-bronce rc-btn-sm" onClick={guardar} disabled={guardando || subiendo > 0}>
          {guardando ? 'Guardando…' : subiendo > 0 ? `Subiendo ${subiendo}…` : 'Guardar'}
        </button>
      </div>

      <div className="rc-hoja-cuerpo">
        <div className="rc-campo">
          <span>Fotos{b.fotos.length ? ` · ${b.fotos.length}` : ''}</span>
          {(b.fotos.length > 0 || subiendo > 0) && (
            <div className="rc-fotos">
              {b.fotos.map((f, i) => (
                <figure key={f.url} className="rc-foto">
                  <img src={f.url} alt="" onClick={() => onVerFotos(b.fotos.map((x) => x.url), i)} style={{ cursor: 'zoom-in' }} />
                  {i === 0 && <span className="rc-foto-portada">Portada</span>}
                  <button className="rc-foto-quitar" onClick={() => set('fotos', b.fotos.filter((_, j) => j !== i))} aria-label="Eliminar foto">✕</button>
                  {b.fotos.length > 1 && (
                    <div className="rc-foto-acc">
                      <button onClick={() => moverFoto(i, -1)} disabled={i === 0} aria-label="Mover antes">‹</button>
                      <button onClick={() => moverFoto(i, 1)} disabled={i === b.fotos.length - 1} aria-label="Mover después">›</button>
                    </div>
                  )}
                </figure>
              ))}
              {Array.from({ length: subiendo }).map((_, i) => <div key={`s${i}`} className="rc-foto rc-foto-cargando"><span /></div>)}
            </div>
          )}
          <div className="rc-foto-botones">
            <label className="rc-foto-add">
              <span className="rc-foto-add-ico">◎</span> Hacer foto
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { anadirFotos(e.target.files); e.target.value = '' }} />
            </label>
            <label className="rc-foto-add">
              <span className="rc-foto-add-ico">▦</span> Subir desde galería
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { anadirFotos(e.target.files); e.target.value = '' }} />
            </label>
          </div>
          {b.id && <small>Los cambios en las fotos se aplican al pulsar Guardar.</small>}
        </div>

        <label className="rc-campo">
          <span>Título</span>
          <input value={b.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ej. Sofá Marenco tapizado en bouclé" maxLength={140} />
        </label>

        <div className="rc-campo">
          <span>Estancia</span>
          <div className="rc-chips">
            {ESTANCIAS.map((e) => (
              <button key={e} className={b.estancia === e ? 'is-on' : ''} onClick={() => set('estancia', b.estancia === e ? '' : e)}>{e}</button>
            ))}
          </div>
        </div>

        <div className="rc-campo">
          <span>Categoría</span>
          <div className="rc-chips">
            {CATEGORIAS.map((c) => (
              <button key={c} className={b.categoria === c ? 'is-on' : ''} onClick={() => set('categoria', b.categoria === c ? '' : c)}>{c}</button>
            ))}
          </div>
        </div>

        <label className="rc-campo">
          <span>Texto para los invitados</span>
          <textarea
            value={b.texto} onChange={(e) => set('texto', e.target.value)} rows={5}
            placeholder="Escribe o dicta con el micrófono del teclado: qué es, de quién, por qué lo elegimos…"
          />
        </label>
        <div className="rc-pulir">
          <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={pulir} disabled={puliendo}>
            {puliendo ? 'Puliendo…' : '✦ Pulir con IA'}
          </button>
          {deshacer && (
            <button className="rc-link" onClick={() => { setB((x) => ({ ...x, ...deshacer })); setDeshacer(null) }}>Deshacer</button>
          )}
        </div>

        <label className="rc-campo rc-campo-guia">
          <span>Notas solo para el guía</span>
          <textarea
            value={b.notas_guia} onChange={(e) => set('notas_guia', e.target.value)} rows={3}
            placeholder="Anécdotas de obra, proveedor, plazo, lo que no va en el texto público…"
          />
          <small>Nunca se muestran a los invitados.</small>
        </label>

        <label className="rc-switch">
          <input type="checkbox" checked={b.destacado} onChange={(e) => set('destacado', e.target.checked)} />
          <span className="rc-switch-ui" />
          <span>En el recorrido principal</span>
        </label>

        <div className="rc-hoja-pie">
          <button className="rc-link" onClick={() => onMover(b)}>Mover en el plano</button>
          {b.id && <button className="rc-link" onClick={() => setUniendo((v) => !v)}>Unir con otro (duplicado)</button>}
          <button className="rc-link rc-link-peligro" onClick={eliminar}>{b.id ? 'Eliminar' : 'Descartar'}</button>
        </div>

        {uniendo && (
          <div className="rc-unir">
            <p>Este detalle se unirá al que elijas: sus fotos y textos pasan al otro.</p>
            <ul>
              {candidatos.map((d) => (
                <li key={d.id}>
                  <button onClick={() => unirCon(d.id)}>
                    <Miniatura d={d} />
                    <span>{d.titulo || 'Sin título'}<small>{d.estancia ?? ''}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {confirmarCierre && (
        <div className="rc-confirmar">
          <div>
            <p>Tienes cambios sin guardar.</p>
            <button className="rc-btn rc-btn-bronce" onClick={() => { setConfirmarCierre(false); guardar() }}>Guardar</button>
            <button className="rc-btn rc-btn-ghost" onClick={onCerrar}>Descartar</button>
            <button className="rc-link" onClick={() => setConfirmarCierre(false)}>Seguir editando</button>
          </div>
        </div>
      )}
    </div>
  )
}
