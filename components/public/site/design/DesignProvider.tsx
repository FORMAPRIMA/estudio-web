'use client'

// Modo Diseño — lado canvas (dentro del sitio).
//
// Este provider envuelve TODO el sitio, pero en modo lectura no hace nada: no
// pinta nada, no escucha nada y `Editable` es un passthrough. Solo se despierta
// cuando se cumplen las tres condiciones a la vez:
//   1. el servidor dijo que quien mira es socio o biz dev (`canDesign`),
//   2. la URL trae ?design=1 (o ya se activó en esta pestaña),
//   3. estamos dentro de un iframe → el Studio está al otro lado escuchando.
// Así el visitante de formaprima.es no descarga ni ejecuta nada de esto.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  contentKey, estiloPropio, pickEstilo,
  type BlockEstilo, type ContentMap, type Locale,
} from '@/lib/web-publica'
import {
  STUDIO_CHANNEL, esMensaje,
  type MensajeAlCanvas, type MensajeAlStudio, type SeleccionBloque,
} from '@/lib/web-publica-studio'
import { useSite } from '../SiteProvider'

interface DesignCtx {
  /** El Modo Diseño está en marcha (canvas dentro del Studio). */
  active:    boolean
  /** Modo Ver: se esconde todo el chrome para juzgar el diseño limpio. */
  limpio:    boolean
  /** Hay un bloque en edición de texto (los componentes pausan animaciones). */
  editing:   boolean
  selected:  string | null
  /** Previews de estilo en vivo que manda el inspector, sin pasar por BD. */
  overrides: Record<string, BlockEstilo>
  seleccionar: (b: SeleccionBloque | null) => void
  setEditing:  (v: boolean) => void
  enviarTexto: (m: { key: string; pagina: string; seccion: string; clave: string; locale: Locale; valor: string }) => void
}

const Ctx = createContext<DesignCtx>({
  active: false, limpio: false, editing: false, selected: null, overrides: {},
  seleccionar: () => {}, setEditing: () => {}, enviarTexto: () => {},
})

export function useDesign() { return useContext(Ctx) }

/**
 * Estilo efectivo de un bloque: lo guardado en BD, o el preview en vivo del
 * inspector si lo hay. Los componentes del sitio llaman a esto en vez de a
 * `pickEstilo` y el ajuste se ve al instante mientras se arrastra el control.
 */
export function useEstilo(map: ContentMap, seccion: string, clave: string): BlockEstilo {
  const { mobile } = useSite()
  const { overrides } = useDesign()
  const base = pickEstilo(map, seccion, clave, { mobile })
  return overrides[`${seccion}.${clave}`] ?? base
}

/**
 * Lo que este bloque tiene guardado en el viewport que se está mirando, sin
 * heredar. Sirve para que el inspector distinga «esto lo ajustaste en móvil» de
 * «esto viene del escritorio», que es la diferencia entre editar y creer editar.
 */
export function usePropio(map: ContentMap, seccion: string, clave: string): BlockEstilo {
  const { mobile } = useSite()
  return estiloPropio(map[contentKey(seccion, clave)], mobile ? 'mobile' : 'desktop')
}

const SS_KEY = 'fp_design_mode'

export function DesignProvider({ canDesign, children }: { canDesign: boolean; children: React.ReactNode }) {
  const [active, setActive] = useState(false)
  const [limpio, setLimpio] = useState(false)
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, BlockEstilo>>({})
  const enviado = useRef(false)

  // ── Activación ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canDesign) return
    if (window.parent === window) return          // sin Studio al otro lado no hay nada que hacer
    const url = new URL(window.location.href)
    let on = url.searchParams.get('design') === '1'
    // La activación se recuerda en la pestaña: navegar dentro del canvas con los
    // <Link> del sitio pierde la query, y el Modo Diseño no debe morir por eso.
    try {
      if (on) window.sessionStorage.setItem(SS_KEY, '1')
      else if (window.sessionStorage.getItem(SS_KEY) === '1') on = true
    } catch {}
    setActive(on)
  }, [canDesign])

  const post = useCallback((msg: MensajeAlStudio) => {
    try { window.parent.postMessage(msg, window.location.origin) } catch {}
  }, [])

  // ── Canvas listo: el Studio sincroniza su selector de página con esta ruta ──
  useEffect(() => {
    if (!active || enviado.current) return
    enviado.current = true
    post({ channel: STUDIO_CHANNEL, type: 'listo', ruta: window.location.pathname })
  }, [active, post])

  // ── Mensajes del Studio ────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return
    const onMessage = (ev: MessageEvent) => {
      const msg = esMensaje<MensajeAlCanvas>(ev)
      if (!msg) return
      if (msg.type === 'estilo-preview') {
        setOverrides((prev) => ({ ...prev, [msg.key]: msg.estilo }))
      } else if (msg.type === 'deseleccionar') {
        setSelected(null); setEditing(false)
      } else if (msg.type === 'modo-limpio') {
        setLimpio(msg.limpio)
        if (msg.limpio) { setSelected(null); setEditing(false) }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [active])

  // ── Deseleccionar: clic en el vacío o Escape ────────────────────────────────
  useEffect(() => {
    if (!active) return
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement | null
      if (t?.closest('[data-fp-edit]')) return
      setSelected(null); setEditing(false)
      post({ channel: STUDIO_CHANNEL, type: 'deseleccion' })
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      setSelected(null); setEditing(false)
      post({ channel: STUDIO_CHANNEL, type: 'deseleccion' })
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [active, post])

  const seleccionar = useCallback((b: SeleccionBloque | null) => {
    if (!b) {
      setSelected(null)
      post({ channel: STUDIO_CHANNEL, type: 'deseleccion' })
      return
    }
    setSelected(b.key)
    post({ channel: STUDIO_CHANNEL, type: 'seleccion', bloque: b })
  }, [post])

  const enviarTexto = useCallback((m: { key: string; pagina: string; seccion: string; clave: string; locale: Locale; valor: string }) => {
    post({ channel: STUDIO_CHANNEL, type: 'texto', ...m })
  }, [post])

  const setEditingBridged = useCallback((v: boolean) => {
    setEditing(v)
    post({ channel: STUDIO_CHANNEL, type: 'editando', editando: v })
  }, [post])

  const value = useMemo<DesignCtx>(() => ({
    active, limpio, editing, selected, overrides,
    seleccionar, setEditing: setEditingBridged, enviarTexto,
  }), [active, limpio, editing, selected, overrides, seleccionar, setEditingBridged, enviarTexto])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
