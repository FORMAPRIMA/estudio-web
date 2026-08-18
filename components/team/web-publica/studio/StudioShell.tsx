'use client'

// Modo Diseño — carcasa del Studio.
//
// El sitio real se carga dentro de un <iframe> y toda la UI de edición vive
// FUERA de él. Tres razones: se puede simular el ancho de un móvil de verdad (no
// fingirlo con CSS), el chrome no se solapa nunca con el diseño que estás
// juzgando, y el código de edición no viaja al sitio público.
//
// Autoguardado: no hay botón de guardar. Cada ajuste se ve al instante en el
// canvas (preview optimista) y se persiste con debounce. El estado se dice en
// palabras, no con un spinner escondido.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  STUDIO_CHANNEL, STUDIO_VIEWPORTS, datosDeViewport, esMensaje,
  type MensajeAlCanvas, type MensajeAlStudio, type SeleccionBloque, type ViewportId,
} from '@/lib/web-publica-studio'
import { saveBlockEstilo, saveBlockTexto, setInterruptor } from '@/app/actions/web-design'
import type { BlockEstilo, BlockEstiloPatch } from '@/lib/web-publica'
import { Inspector } from './Inspector'

const INK = '#1A1A1A'
const ORANGE = '#D85A30'
const BORDER = '#F0EEE8'
const CREAM = '#F8F7F4'

export interface PaginaStudio {
  pagina: string
  label:  string
  ruta:   string
  /** ¿Tiene ya bloques cableados al Modo Diseño? */
  listo:  boolean
}

type Estado = 'limpio' | 'guardando' | 'guardado' | 'error'

export function StudioShell({ paginas }: { paginas: PaginaStudio[] }) {
  const [pagina, setPagina] = useState<PaginaStudio>(paginas[0])
  const [viewport, setViewport] = useState<ViewportId>('desktop')
  const [verLimpio, setVerLimpio] = useState(false)
  const [bloque, setBloque] = useState<SeleccionBloque | null>(null)
  const [estado, setEstado] = useState<Estado>('limpio')
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState({ w: 0, h: 0 })
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const vpDatos = datosDeViewport(viewport)
  const ancho = STUDIO_VIEWPORTS.find((v) => v.id === viewport)!.ancho

  // ── Escalado del canvas: el dispositivo se simula a su ancho real y se reduce
  //    para que quepa, en vez de estrecharlo (que daría un layout que no existe).
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setArea({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setArea({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const escala = area.w ? Math.min(1, (area.w - 48) / ancho) : 1
  const altoSimulado = escala ? (area.h - 48) / escala : 0

  const enviar = useCallback((msg: MensajeAlCanvas) => {
    try { iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin) } catch {}
  }, [])

  const marcar = (key: string, ms: number, fn: () => void) => {
    if (timers.current[key]) clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(fn, ms)
  }

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  // ── Mensajes del canvas ────────────────────────────────────────────────────
  useEffect(() => {
    const onMessage = async (ev: MessageEvent) => {
      const msg = esMensaje<MensajeAlStudio>(ev)
      if (!msg) return

      if (msg.type === 'listo') {
        // El canvas puede navegar solo (el nav del sitio funciona): el selector de
        // arriba sigue a la página que se está viendo, no al revés.
        const p = paginas.find((x) => x.ruta === msg.ruta)
        if (p && p.pagina !== pagina.pagina) setPagina(p)
        setBloque(null)
      } else if (msg.type === 'seleccion') {
        setBloque(msg.bloque)
      } else if (msg.type === 'deseleccion') {
        setBloque(null)
      } else if (msg.type === 'texto') {
        const { pagina: pg, seccion, clave, locale, valor } = msg
        marcar(`${msg.key}:texto`, 500, async () => {
          setEstado('guardando')
          const r = await saveBlockTexto(pg, seccion, clave, locale, vpDatos, valor)
          aplicarResultado(r)
        })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [paginas, pagina.pagina, vpDatos])

  function aplicarResultado(r: { success: true } | { error: string }) {
    if ('error' in r) { setEstado('error'); setError(r.error); return }
    setEstado('guardado'); setError(null)
    marcar('estado', 1600, () => setEstado('limpio'))
  }

  // ── Ajuste de estilo: preview inmediato + guardado con debounce ────────────
  const onPatch = useCallback((patch: BlockEstiloPatch) => {
    if (!bloque) return
    const { pagina: pg, seccion, clave, key } = bloque

    const estilo: BlockEstilo = { ...bloque.estilo }
    const propio: BlockEstilo = { ...bloque.propio }
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined) { delete (estilo as any)[k]; delete (propio as any)[k] }
      else { (estilo as any)[k] = v; (propio as any)[k] = v }
    }
    setBloque({ ...bloque, estilo, propio })
    enviar({ channel: STUDIO_CHANNEL, type: 'estilo-preview', key, estilo })

    marcar(`${key}:estilo`, 400, async () => {
      setEstado('guardando')
      aplicarResultado(await saveBlockEstilo(pg, seccion, clave, vpDatos, patch))
    })
  }, [bloque, enviar, vpDatos])

  const onReset = useCallback(async () => {
    if (!bloque) return
    setEstado('guardando')
    const r = await saveBlockEstilo(bloque.pagina, bloque.seccion, bloque.clave, vpDatos, {}, { reset: true })
    aplicarResultado(r)
    // Al volver al diseño original hay que repintar desde BD: el canvas no puede
    // adivinar el valor del token que estaba tapando el ajuste.
    if (!('error' in r)) { setBloque(null); setRecarga((n) => n + 1) }
  }, [bloque, vpDatos])

  const onMostrar = useCallback(async () => {
    if (!bloque?.interruptor) return
    const [seccion, clave] = bloque.interruptor.split('.')
    setEstado('guardando')
    const r = await setInterruptor(bloque.pagina, seccion, clave, 'si')
    aplicarResultado(r)
    if (!('error' in r)) { setBloque(null); setRecarga((n) => n + 1) }
  }, [bloque])

  useEffect(() => { enviar({ channel: STUDIO_CHANNEL, type: 'modo-limpio', limpio: verLimpio }) }, [verLimpio, enviar])

  const src = useMemo(() => `${pagina.ruta}?design=1`, [pagina.ruta])

  return (
    <div className="fp-studio" style={{ display: 'flex', flexDirection: 'column', background: CREAM }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .fp-studio { height: 100dvh; }
        @media (max-width: 1023px) { .fp-studio { height: calc(100dvh - 56px); } }
      ` }} />

      {/* ── Barra superior ─────────────────────────────────────────────────── */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 18px', height: 54,
        borderBottom: `1px solid ${BORDER}`, background: '#fff', flexShrink: 0 }}>
        <Link href="/team/marketing/web-publica"
          style={{ fontSize: 11.5, color: `${INK}99`, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          ← Web pública
        </Link>

        <div style={{ width: 1, height: 22, background: BORDER }} />

        {/* Páginas */}
        <div style={{ display: 'flex', gap: 3 }}>
          {paginas.map((p) => {
            const activa = p.pagina === pagina.pagina
            return (
              <button key={p.pagina} onClick={() => { setBloque(null); setPagina(p) }}
                title={p.listo ? undefined : 'Esta página aún no tiene bloques ajustables (se ve, pero no se edita)'}
                style={{
                  background: activa ? INK : 'none', color: activa ? '#fff' : `${INK}${p.listo ? 'AA' : '55'}`,
                  border: 'none', borderRadius: 3, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer',
                }}>
                {p.label}{!p.listo && <span style={{ opacity: 0.6 }}> ·</span>}
              </button>
            )
          })}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Estado del autoguardado, en palabras */}
          <span style={{ fontSize: 11, color: estado === 'error' ? '#B4402A' : `${INK}88`, minWidth: 96, textAlign: 'right' }}>
            {estado === 'guardando' && 'Guardando…'}
            {estado === 'guardado' && 'Guardado'}
            {estado === 'error' && 'No se guardó'}
          </span>

          {/* Viewports */}
          <div style={{ display: 'flex', gap: 3, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 2 }}>
            {STUDIO_VIEWPORTS.map((v) => {
              const activa = v.id === viewport
              return (
                <button key={v.id} onClick={() => { setBloque(null); setViewport(v.id) }}
                  style={{
                    background: activa ? INK : 'none', color: activa ? '#fff' : `${INK}99`,
                    border: 'none', borderRadius: 2, padding: '4px 9px', fontSize: 11, cursor: 'pointer',
                  }}>
                  {v.label}
                </button>
              )
            })}
          </div>

          <button onClick={() => setVerLimpio((v) => !v)}
            title="Esconde el chrome de edición para juzgar el diseño limpio"
            style={{
              background: verLimpio ? INK : 'none', color: verLimpio ? '#fff' : `${INK}99`,
              border: `1px solid ${verLimpio ? INK : BORDER}`, borderRadius: 3, padding: '5px 10px',
              fontSize: 11.5, cursor: 'pointer',
            }}>
            Ver limpio
          </button>

          <a href={pagina.ruta} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11.5, color: ORANGE, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Abrir ↗
          </a>
        </div>
      </header>

      {error && (
        <div style={{ background: '#FDF3F0', borderBottom: `1px solid #B4402A22`, color: '#8E3221',
          fontSize: 11.5, padding: '8px 18px' }}>
          {error}
        </div>
      )}

      {/* ── Canvas + inspector ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div ref={areaRef} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start',
          justifyContent: 'center', padding: 24, overflow: 'hidden' }}>
          <div style={{ width: ancho * escala, height: altoSimulado * escala, flexShrink: 0 }}>
            <iframe
              key={`${pagina.pagina}-${recarga}`}
              ref={iframeRef}
              src={src}
              title={`Canvas — ${pagina.label}`}
              style={{
                width: ancho, height: Math.max(320, altoSimulado), border: `1px solid ${BORDER}`,
                background: '#0D0D0D', display: 'block',
                transform: `scale(${escala})`, transformOrigin: 'top left',
                boxShadow: '0 18px 50px rgba(0,0,0,0.10)',
              }}
            />
          </div>
        </div>

        {bloque
          ? <Inspector bloque={bloque} viewport={viewport} onPatch={onPatch} onReset={onReset} onMostrar={onMostrar} />
          : <Vacio listo={pagina.listo} />}
      </div>
    </div>
  )
}

/** Panel en reposo: dice qué hacer sin gritar, y desaparece al seleccionar algo. */
function Vacio({ listo }: { listo: boolean }) {
  return (
    <aside style={{ width: 288, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, background: '#fff',
      padding: '18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: `${INK}80` }}>
        Modo Diseño
      </p>
      {listo ? (
        <>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: `${INK}CC` }}>
            Haz clic en un texto de la página para ajustarlo. Doble clic para reescribirlo.
          </p>
          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6, color: `${INK}88` }}>
            Los cambios se guardan solos y se ven en la web al instante. El idioma y el
            menú se cambian dentro de la propia página, como lo haría un visitante.
          </p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: `${INK}99` }}>
          Esta página todavía no tiene bloques ajustables: se puede ver, pero se edita en el
          CMS clásico. Estudio y Proyectos son los siguientes.
        </p>
      )}
    </aside>
  )
}
