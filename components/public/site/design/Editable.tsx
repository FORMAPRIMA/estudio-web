'use client'

// Modo Diseño — envoltorio de un bloque editable del sitio.
//
// En modo lectura devuelve los hijos tal cual (coste cero, cero markup extra).
// En Modo Diseño se convierte en objetivo de selección y, con doble clic, en un
// campo de texto que escribe con la tipografía real del sitio: no hay una "vista
// de editor" distinta de la web, es la web.
//
// Un clic selecciona (el inspector aparece en el Studio, fuera del iframe).
// Doble clic edita el texto. Escape sale. Al salir se guarda.

import { useEffect, useRef, useState } from 'react'
import { buscarCampo, gestosDe, CONTENT_SCHEMA } from '@/lib/web-publica-schema'
import { useSite } from '../SiteProvider'
import { useDesign } from './DesignProvider'
import type { SeleccionBloque } from '@/lib/web-publica-studio'
import type { BlockEstilo } from '@/lib/web-publica'

const CHROME = '#D85A30'   // naranja FP: el chrome de edición es de la plataforma,
                           // nunca del sitio (cuya paleta es gris/crema)

interface Props {
  pagina:  string
  seccion: string
  clave:   string
  children: React.ReactNode
  /** Estilo guardado del bloque, para que el inspector abra con los valores reales. */
  estilo?:  BlockEstilo
  propio?:  BlockEstilo
  /** El bloque está apagado por un interruptor del CMS y la web no lo muestra. */
  oculto?:  boolean
  /** Interruptor que lo encendería: `${seccion}.${clave}`. */
  interruptor?: string
  /** Texto plano actual (lo que se guarda si se edita). Por defecto, los hijos si son string. */
  valor?:   string
}

export function Editable({
  pagina, seccion, clave, children, estilo = {}, propio = {}, oculto = false, interruptor, valor,
}: Props) {
  const { locale } = useSite()
  const design = useDesign()
  const key = `${seccion}.${clave}`
  const campo = buscarCampo(pagina, seccion, clave)
  const gestos = campo ? gestosDe(campo) : []
  const editable = design.active && gestos.length > 0
  const seleccionado = design.selected === key

  const ref = useRef<HTMLSpanElement>(null)
  const [editando, setEditando] = useState(false)
  // Al entrar en edición congelamos el texto: mientras se escribe, React no debe
  // volver a pintar este nodo (un re-render del padre borraría lo tecleado).
  const congelado = useRef<string>('')
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const texto = valor ?? (typeof children === 'string' ? children : '')

  useEffect(() => {
    if (!seleccionado && editando) salir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado])

  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current) }, [])

  if (!editable) return <>{children}</>

  function payload(): SeleccionBloque {
    const seccionLabel = CONTENT_SCHEMA.find((p) => p.pagina === pagina)
      ?.sections.find((s) => s.seccion === seccion)?.label ?? seccion
    return {
      key, pagina, seccion, clave,
      label: campo?.label ?? clave,
      seccionLabel,
      gestos, estilo, propio, locale, oculto, interruptor,
    }
  }

  function emitir(inmediato = false) {
    const el = ref.current
    if (!el) return
    // contentEditable mete espacios duros (\u00A0) al teclear: se normalizan antes
    // de guardar, o el copy de la web acabaría lleno de ellos.
    const nuevo = (el.innerText ?? '').replace(/\u00A0/g, ' ').trim()
    if (nuevo === texto) return
    if (debounce.current) clearTimeout(debounce.current)
    const enviar = () => design.enviarTexto({ key, pagina, seccion, clave, locale, valor: nuevo })
    if (inmediato) enviar()
    else debounce.current = setTimeout(enviar, 450)
  }

  function entrar() {
    if (!gestos.includes('texto')) return
    congelado.current = ref.current?.innerText ?? texto
    setEditando(true)
    design.setEditing(true)
    requestAnimationFrame(() => ref.current?.focus())
  }

  function salir() {
    if (debounce.current) { clearTimeout(debounce.current); debounce.current = null }
    emitir(true)
    setEditando(false)
    design.setEditing(false)
  }

  const chrome = design.limpio
    ? {}
    : {
        outline: seleccionado ? `1.5px solid ${CHROME}` : '1px dashed rgba(216,90,48,0.45)',
        outlineOffset: 3,
        borderRadius: 2,
        cursor: editando ? 'text' : 'pointer',
      }

  return (
    <span
      ref={ref}
      data-fp-edit={key}
      contentEditable={editando}
      suppressContentEditableWarning
      spellCheck={editando}
      onClick={(e) => { e.stopPropagation(); if (!editando) design.seleccionar(payload()) }}
      onDoubleClick={(e) => { e.stopPropagation(); entrar() }}
      onInput={() => emitir()}
      onBlur={() => { if (editando) salir() }}
      onKeyDown={(e) => {
        if (!editando) return
        e.stopPropagation()                       // Escape lo gestionamos aquí, no el provider
        if (e.key === 'Escape') { e.preventDefault(); ref.current?.blur() }
        // Los bloques del sitio son de una línea salvo los `rich`: Enter confirma
        // en vez de meter un salto que rompería la composición del titular.
        if (e.key === 'Enter' && !(campo?.tipo === 'rich' && e.shiftKey)) {
          e.preventDefault(); ref.current?.blur()
        }
      }}
      // Pegar SIEMPRE en texto plano: si no, un copiar/pegar de Word mete su
      // propio HTML con fuentes y tamaños y se lleva por delante la tipografía.
      onPaste={(e) => {
        if (!editando) return
        e.preventDefault()
        const t = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ')
        document.execCommand('insertText', false, t)
      }}
      style={{
        display: 'inline-block',
        position: 'relative',
        // Atenuado, pero legible sobre una foto: si no se lee, no se puede juzgar.
        opacity: oculto ? 0.55 : undefined,
        ...chrome,
      }}
    >
      {editando ? congelado.current : children}

      {seleccionado && !design.limpio && !editando && (
        <span
          aria-hidden
          style={{
            position: 'absolute', top: -20, left: -1, zIndex: 30,
            background: CHROME, color: '#fff', fontSize: 9.5, lineHeight: '14px',
            letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
            padding: '0 5px', borderRadius: 2, whiteSpace: 'nowrap', pointerEvents: 'none',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}
        >
          {campo?.label ?? clave}{oculto ? ' · oculto' : ''}
        </span>
      )}
    </span>
  )
}
