'use client'

// Teaser de Isla Creta para el equipo inmobiliario de Grupo RSA.
//
// No es la propuesta: su único objetivo es conseguir la reunión donde se
// presenta. Por eso enseña lo que sabemos hacer sin dar el trabajo hecho:
//   · la maqueta 3D real, en modo muestra (solo la manzana 1 responde; precio y
//     estado no viajan al navegador);
//   · la casa club y las casas tipo como servicios, sin diseño ni cifras;
//   · el estudio, la obra y el equipo;
//   · un final que pide una franja para la reunión (aviso + correo al equipo).
// Las visitas se registran como en el resto de propuestas (PIN, avisos, correo
// con el historial a quien la sigue).

import { useCallback, useEffect, useRef, useState } from 'react'
import { registrarEventoPropuestaWeb, progresoPropuestaWeb, solicitarReunionPropuestaWeb } from '@/app/actions/propuestasWeb'
import type { EscenaTeaser, Lote, Vista, PuntoLote } from './escena-isla-creta'
import { useMedicionSala } from '../medicionSala'

const A = '/propuestas/isla-creta-uk38g'

const SECCIONES = ['La isla en 3D', 'Maqueta comercial', 'Casa club', 'Casas tipo', 'El estudio', 'Obra seleccionada', 'Equipo', 'Reunión']

// El recorrido que ve el cliente: seis capítulos, siempre a la vista (cabecera
// e índice lateral), para que sepa dónde está y cuánto le queda.
const CAPITULOS: { titulo: string; secciones: number[] }[] = [
  { titulo: 'La isla en 3D', secciones: [0] },
  { titulo: 'Maqueta comercial', secciones: [1] },
  { titulo: 'Casa club', secciones: [2] },
  { titulo: 'Casas tipo', secciones: [3] },
  { titulo: 'Forma Prima', secciones: [4, 5, 6] },
  { titulo: 'Reunión', secciones: [7] },
]
const capituloDe = (seccion: number) => Math.max(0, CAPITULOS.findIndex((c) => c.secciones.includes(seccion)))

// Demostración guiada: tocar → ficha → girar → fin (o explorar libre).
type Guia = 'tocar' | 'ficha' | 'girar' | 'fin' | 'libre'
const PASOS_GUIA: Guia[] = ['tocar', 'ficha', 'girar']

const PASOS: { vista: Vista; eyebrow: string; titulo: string; texto: string }[] = [
  {
    vista: 'isla',
    eyebrow: 'Isla Creta · Samborondón',
    titulo: 'Así podría venderse Isla Creta.',
    texto: 'Una vista previa de la maqueta digital que proponemos para su equipo comercial: la isla entera, en 3D, en cualquier pantalla.',
  },
  {
    vista: 'manzana',
    eyebrow: 'Vista previa · Manzana 1',
    titulo: 'Cada lote, a un toque.',
    texto: 'Para esta vista previa hemos activado la manzana 1. En la maqueta completa, los 173 lotes muestran su superficie, su precio y su disponibilidad reales, conectados a su inventario.',
  },
  {
    vista: 'club',
    eyebrow: 'Casa club',
    titulo: 'El corazón de la isla.',
    texto: 'Aquí está el ámbito de la casa club. Su arquitectura está por diseñar, y nos gustaría diseñarla con ustedes.',
  },
]

const DIAS = [
  { corto: 'Mar', n: 13, largo: 'Martes' },
  { corto: 'Mié', n: 14, largo: 'Miércoles' },
  { corto: 'Jue', n: 15, largo: 'Jueves' },
  { corto: 'Vie', n: 16, largo: 'Viernes' },
]
// Ecuador (GMT−5) y Madrid (horario de verano hasta el 25 oct, GMT+2): 7 h.
// Mañana de Guayaquil = tarde laborable de Madrid.
const HORAS = [
  { gye: '08:30', mad: '15:30' },
  { gye: '09:30', mad: '16:30' },
  { gye: '10:30', mad: '17:30' },
  { gye: '11:30', mad: '18:30' },
]

const OBRAS = [
  { img: 'cc38-salon', nombre: 'Claudio Coello 38', lugar: 'Madrid', dato: '320 m²', grande: true },
  { img: 'mia-322-lounge', nombre: '322 SW 18th Rd', lugar: 'Miami', dato: '260 m²', grande: true },
  { img: 'airapi-sala', nombre: 'Airapi Memorial Park', lugar: 'Monterrey', dato: '2.300 m²' },
  { img: 'nwl-fachada', nombre: 'Colegio NWL', lugar: 'Querétaro', dato: '3.200 m²' },
  { img: 'columela6-comedor', nombre: 'Columela 6', lugar: 'Madrid', dato: '235 m²' },
  { img: 'jade-fachada', nombre: 'JADE Matcha Gallery', lugar: 'Madrid', dato: '50 m²' },
]

const EQUIPO = [
  { img: 'team-jose-lora', nombre: 'José Lora', rol: 'Socio fundador · Arquitecto' },
  { img: 'team-gabriela-hidalgo', nombre: 'Gabriela Hidalgo', rol: 'Socia fundadora · Arquitecta' },
  { img: 'team-jose-antonio', nombre: 'José Antonio', rol: 'Director de proyectos · Arquitecto' },
  { img: 'team-aitana', nombre: 'Aitana', rol: 'Arquitecta' },
  { img: 'team-daniel', nombre: 'Daniel', rol: 'Arquitecto' },
  { img: 'team-ariana', nombre: 'Ariana', rol: 'Diseñadora de interiores' },
  { img: 'team-ana-cristina', nombre: 'Ana Cristina', rol: 'Desarrollo de negocio y marketing' },
]

const fmtArea = (n: number) => n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function hayWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

// Diapositivas para Salas: los tres pasos de la maqueta y las siete secciones.
const DIAPOS = ['La isla', 'Cada lote', 'Casa club · maqueta', 'Maqueta comercial', 'Casa club', 'Casas tipo', 'El estudio', 'Obra seleccionada', 'Equipo', 'Reunión']

export default function TeaserIslaCreta({ slug, medir = false }: { slug: string; medir?: boolean }) {
  // Sala: tiempo activo por diapositiva, demostración (3d), reunión (interes), final.
  const { alSlide, alVida, alEvento } = useMedicionSala(slug, medir)
  const lienzo = useRef<HTMLDivElement>(null)
  const escenario = useRef<HTMLElement>(null)
  const escena = useRef<EscenaTeaser | null>(null)
  const reunion = useRef<HTMLElement>(null)
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [paso, setPaso] = useState(0)
  const pasoRef = useRef(0)
  pasoRef.current = paso
  const [carga, setCarga] = useState(0)
  const [listo, setListo] = useState(false)
  const [sin3d, setSin3d] = useState<string | null>(null)
  const [explorando, setExplorando] = useState(false)
  const [lote, setLote] = useState<Lote | null>(null)
  const [toast, setToast] = useState(false)
  const [activos, setActivos] = useState(23)
  const [total, setTotal] = useState(173)
  const [cabSolida, setCabSolida] = useState(false)
  const [indiceClaro, setIndiceClaro] = useState(false)
  const [guia, setGuia] = useState<Guia>('tocar')
  const [demoVista, setDemoVista] = useState(false)
  const [capitulo, setCapitulo] = useState(0)
  const [avance, setAvance] = useState(0)
  const [tactil, setTactil] = useState(false)
  const capa = useRef<HTMLDivElement>(null)
  const guiaRef = useRef<Guia>('tocar')
  // Desde qué paso del relato se lanzó la demostración: al terminarla se sigue
  // por el siguiente, sin saltarse "Cada lote" ni la casa club.
  const origenDemo = useRef(0)
  guiaRef.current = guia

  // ── Visita: abierta, hasta dónde llega, y final ───────────────────────────
  useEffect(() => { registrarEventoPropuestaWeb(slug, 'abierta').catch(() => {}) }, [slug])

  // Salas: qué diapositiva cruza la mitad de la pantalla, y señales de vida.
  useEffect(() => {
    if (!medir) return
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue
        const d = (e.target as HTMLElement).dataset
        const i = d.paso !== undefined ? Number(d.paso) : 2 + Number(d.seccion)
        alSlide(i, DIAPOS.length, DIAPOS[i])
      }
    }, { rootMargin: '-50% 0px -50% 0px' })
    document.querySelectorAll('[data-paso], [data-seccion]:not([data-seccion="0"])').forEach((n) => io.observe(n))
    const vida = () => alVida()
    const ev = ['scroll', 'pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const
    ev.forEach((t) => addEventListener(t, vida, { passive: true }))
    return () => { io.disconnect(); ev.forEach((t) => removeEventListener(t, vida)) }
  }, [medir, alSlide, alVida])
  useEffect(() => {
    let max = -1, finalEnviado = false
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue
        const i = Number((e.target as HTMLElement).dataset.seccion)
        if (i > max) { max = i; progresoPropuestaWeb(slug, i, SECCIONES.length, SECCIONES[i]).catch(() => {}) }
        if (i === SECCIONES.length - 1 && !finalEnviado) { finalEnviado = true; registrarEventoPropuestaWeb(slug, 'final').catch(() => {}) }
      }
    }, { threshold: 0.35 })
    document.querySelectorAll('[data-seccion]').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [slug])

  // Capítulo actual: la sección que cruza la mitad de la pantalla.
  useEffect(() => {
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) if (e.isIntersecting) setCapitulo(capituloDe(Number((e.target as HTMLElement).dataset.seccion)))
    }, { rootMargin: '-50% 0px -50% 0px' })
    document.querySelectorAll('[data-seccion]').forEach((n) => io.observe(n))
    setTactil(matchMedia('(pointer: coarse)').matches)
    return () => io.disconnect()
  }, [])

  // Pasada la maqueta, la cabecera lleva fondo: si no, el logo blanco se pierde
  // sobre las secciones claras.
  useEffect(() => {
    const f = () => {
      const st = escenario.current
      if (st) setCabSolida(scrollY > st.offsetTop + st.offsetHeight - 72)
      // Índice lateral: lee el tono de la sección que tiene detrás.
      const bajo = document.elementsFromPoint(innerWidth - 30, innerHeight / 2).find((n) => (n as HTMLElement).dataset?.tono) as HTMLElement | undefined
      setIndiceClaro(bajo?.dataset.tono === 'claro')
      const max = document.documentElement.scrollHeight - innerHeight
      setAvance(max > 0 ? Math.min(1, scrollY / max) : 0)
    }
    f()
    addEventListener('scroll', f, { passive: true })
    addEventListener('resize', f)
    return () => { removeEventListener('scroll', f); removeEventListener('resize', f) }
  }, [])

  // Entrada de cada sección, con la receta de las otras propuestas
  // (components/propuesta/animaciones.ts): bloques escalonados que suben,
  // imágenes que aparecen y se asientan desde 1,05 y cifras que cuentan.
  // Cada sección se anima una sola vez, al entrar.
  useEffect(() => {
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) if (e.isIntersecting) { animarSeccion(e.target as HTMLElement); io.unobserve(e.target) }
    }, { threshold: 0.12 })
    document.querySelectorAll('[data-seccion]:not([data-seccion="0"])').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])

  // ── Maqueta 3D ────────────────────────────────────────────────────────────
  useEffect(() => {
    const cont = lienzo.current
    if (!cont) return
    if (!hayWebGL()) { setSin3d('Este navegador no muestra 3D. En la reunión les enseñamos la maqueta en vivo.'); return }
    let viva = true
    const nav = navigator as Navigator & { deviceMemory?: number }
    const ligera = matchMedia('(pointer: coarse)').matches || innerWidth < 900 || (nav.deviceMemory ?? 8) <= 4
    import('./escena-isla-creta').then(({ crearEscena }) => crearEscena({
      contenedor: cont,
      base: `/propuesta/${slug}/maqueta`,
      ligera,
      onProgreso: (f) => viva && setCarga(f),
      onLote: (l) => {
        if (!viva) return
        setLote(l)
        if (l && guiaRef.current === 'tocar') setGuia('ficha')
      },
      onGiro: () => {
        if (viva && guiaRef.current === 'girar') setTimeout(() => guiaRef.current === 'girar' && setGuia('fin'), 1400)
      },
      onBloqueado: () => {
        if (!viva) return
        setToast(true)
        if (toastT.current) clearTimeout(toastT.current)
        toastT.current = setTimeout(() => setToast(false), 2600)
      },
      onError: (m) => viva && setSin3d(m),
    })).then((e) => {
      if (!viva) { e.destruir(); return }
      escena.current = e
      setActivos(e.activos)
      setTotal(e.total)
      setListo(true)
    }).catch(() => {})
    return () => {
      viva = false
      escena.current?.destruir()
      escena.current = null
      if (toastT.current) clearTimeout(toastT.current)
    }
  }, [slug])

  // Paso del relato según el scroll: cada texto mueve la cámara.
  useEffect(() => {
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) if (e.isIntersecting) setPaso(Number((e.target as HTMLElement).dataset.paso))
    }, { rootMargin: '-45% 0px -45% 0px' })
    document.querySelectorAll('[data-paso]').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])
  useEffect(() => { if (listo && !explorando) escena.current?.vista(PASOS[paso].vista) }, [paso, listo, explorando])

  // Fuera de pantalla no se pinta: el resto de la página va fluida.
  useEffect(() => {
    const st = escenario.current
    if (!st) return
    const io = new IntersectionObserver(([e]) => escena.current?.pausar(!e.isIntersecting), { threshold: 0 })
    io.observe(st)
    return () => io.disconnect()
  }, [listo])

  const explorar = useCallback((activo: boolean) => {
    setExplorando(activo)
    setLote(null)
    if (activo) { setGuia('tocar'); origenDemo.current = pasoRef.current; alEvento('3d', 'demostración') }
    escena.current?.explorar(activo)
    escena.current?.pausar(false)
    document.documentElement.style.overflow = activo ? 'hidden' : ''
  }, [alEvento])
  useEffect(() => {
    if (!explorando) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') explorar(false) }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [explorando, explorar])
  useEffect(() => () => { document.documentElement.style.overflow = '' }, [])

  // Marcadores sobre los lotes activos: siguen a la cámara en cada fotograma.
  useEffect(() => {
    if (!explorando || !listo) return
    let raf = 0
    const mover = () => {
      raf = requestAnimationFrame(mover)
      const c = capa.current, e = escena.current
      if (!c || !e) return
      const pts: PuntoLote[] = e.puntos()
      for (const p of pts) {
        const el = c.querySelector<HTMLElement>(`[data-lote="${p.id}"]`)
        if (!el) continue
        el.style.transform = `translate(${p.x}px,${p.y}px)`
        el.style.visibility = p.visible ? 'visible' : 'hidden'
      }
    }
    raf = requestAnimationFrame(mover)
    return () => cancelAnimationFrame(raf)
  }, [explorando, listo])

  const irA = (seccion: number) => {
    if (explorando) explorar(false)
    const el = document.querySelector(`[data-seccion="${seccion}"]`)
    if (!el) return
    // La maqueta es larga (tres pasos): su capítulo empieza arriba del todo.
    const y = seccion === 0 ? 0 : (el as HTMLElement).getBoundingClientRect().top + scrollY
    scrollTo({ top: y, behavior: 'smooth' })
  }
  const irAPaso = (i: number) => {
    const el = document.querySelector<HTMLElement>(`[data-paso="${i}"]`)
    if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: 'smooth' })
  }
  // Siguiente parada al terminar la demostración: el próximo paso del relato
  // de la maqueta; si ya era el último, la primera sección de la propuesta.
  const siguienteTrasDemo = origenDemo.current + 1
  const destinoDemo = siguienteTrasDemo < PASOS.length ? PASOS[siguienteTrasDemo].titulo.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase()) : 'la maqueta comercial'
  useEffect(() => { if (guia === 'fin' || guia === 'libre') setDemoVista(true) }, [guia])
  const terminarDemo = () => {
    explorar(false)
    setTimeout(() => (siguienteTrasDemo < PASOS.length ? irAPaso(siguienteTrasDemo) : irA(1)), 80)
  }
  const salirDemo = () => explorar(false)
  const lotesActivos = listo && escena.current ? escena.current.puntos().map((p) => p.id) : []
  const guiaId = escena.current?.loteGuia

  const irAReunion = () => {
    if (explorando) explorar(false)
    reunion.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="ict">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Pantalla de carga: llega con el HTML (sin esperar a three.js) y se va
          cuando la isla está lista. */}
      <div className={`ict-splash${listo || sin3d ? ' fuera' : ''}`} role="status" aria-live="polite" aria-hidden={listo || !!sin3d}>
        <div className="ict-splash-logos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/propuestas/logo-fp.png" alt="Forma Prima" className="fp" />
          <i aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/logo-rsa-claro.png`} alt="Grupo RSA" className="rsa" />
        </div>
        <div className="ict-splash-pie">
          <span>Isla Creta · Preparando la maqueta 3D</span>
          <div className="ict-barra"><i style={{ transform: `scaleX(${Math.max(0.03, carga)})` }} /></div>
          <small>{Math.round(carga * 100)} %</small>
        </div>
      </div>

      <header className={`ict-top${cabSolida ? ' solida' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className="ict-logos">
          <img src="/propuestas/logo-fp.png" alt="Forma Prima" className="ict-logo" />
          <i aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${A}/logo-rsa-claro.png`} alt="Grupo RSA" className="ict-logo-rsa" />
        </span>
        <div className="ict-cap" aria-live="polite">
          <b>{String(capitulo + 1).padStart(2, '0')}</b><span>/ 0{CAPITULOS.length}</span><em>{CAPITULOS[capitulo].titulo}</em>
        </div>
        <button type="button" className="ict-btn ict-btn-claro ict-btn-s ict-top-cta" onClick={irAReunion}>Agendar reunión</button>
        <i className="ict-avance" style={{ transform: `scaleX(${avance})` }} aria-hidden="true" />
      </header>

      {/* Atajo fijo a la reunión: acompaña todo el recorrido. Se aparta durante la
          demostración (taparía la guía) y en la propia sección de reunión. */}
      <button type="button" className={`ict-cta${explorando || capitulo === CAPITULOS.length - 1 ? ' fuera' : ''}`} onClick={irAReunion} tabIndex={explorando ? -1 : 0}>
        <i aria-hidden="true" />
        <span>Agendar reunión con <b>FORMA PRIMA</b></span>
        <em aria-hidden="true">→</em>
      </button>

      <nav className={`ict-indice${explorando ? ' fuera' : ''}${indiceClaro ? ' sobre-claro' : ''}`} aria-label="Capítulos">
        {CAPITULOS.map((c, i) => (
          <button key={c.titulo} type="button" className={i === capitulo ? 'on' : i < capitulo ? 'visto' : ''} onClick={() => irA(c.secciones[0])}>
            <span>{c.titulo}</span><i />
          </button>
        ))}
      </nav>

      {/* ── 1 · La isla en 3D ─────────────────────────────────────────────── */}
      <section ref={escenario} className="ict-stage" data-seccion={0} data-tono="oscuro" aria-label="Maqueta interactiva de Isla Creta">
        <div className={`ict-sticky${explorando ? ' full' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={`ict-poster${listo && !sin3d ? ' fuera' : ''}`} src={`${A}/portada.webp`} alt="" />
          <div ref={lienzo} className="ict-canvas" />
          {!explorando && <div className="ict-velo" />}


          {sin3d && <div className="ict-carga"><span>{sin3d}</span></div>}

          {explorando && (
            <>
              {/* Marcadores: el lote guía, grande y con su "Toque aquí"; el resto, puntos dorados. */}
              <div ref={capa} className="ict-marcas">
                {lotesActivos.map((id) => (
                  <button key={id} type="button" data-lote={id}
                    className={`ict-marca${id === guiaId && guia === 'tocar' ? ' guia' : ''}${lote?.id === id ? ' sel' : ''}`}
                    onClick={() => escena.current?.seleccionarLote(id)} aria-label={`Lote ${id}`}>
                    <i />
                    {id === guiaId && guia === 'tocar' && <span>Toque aquí</span>}
                  </button>
                ))}
              </div>

              <div className="ict-xbar">
                <div className="ict-xinfo">
                  <span className="ict-sello">Demostración · vista previa</span>
                  <span className="ict-leyenda"><i className="on" />{activos} lotes activos<i className="off" />{total - activos} en la versión completa</span>
                </div>
                <button type="button" className="ict-salir" onClick={salirDemo}>Salir <span aria-hidden="true">×</span></button>
              </div>

              {lote && (
                <div className={`ict-ficha${guia === 'ficha' ? ' guiada' : ''}`} role="dialog" aria-label={`Lote ${lote.id}`}>
                  <div className="ict-ficha-cab">
                    <span>{lote.tipo === 'unifamiliar' ? 'Lote unifamiliar' : 'Lote multifamiliar'}</span>
                    {guia !== 'ficha' && <button type="button" onClick={() => escena.current?.deseleccionar()} aria-label="Cerrar ficha">Cerrar</button>}
                  </div>
                  <div className="ict-ficha-id">{lote.id}</div>
                  <div className="ict-ficha-sub">{lote.label}</div>
                  <dl>
                    <div><dt>Superficie</dt><dd>{fmtArea(lote.area)} <small>m²</small></dd></div>
                    <div><dt>Uso</dt><dd className="t">{lote.tipo === 'unifamiliar' ? 'Unifamiliar' : 'Multifamiliar'}</dd></div>
                    <div><dt>Precio</dt><dd className="bloq">xxx.xxx <small>USD</small></dd></div>
                    <div><dt>Estado</dt><dd className="t bloq">Por conectar</dd></div>
                  </dl>
                  {guia === 'ficha' ? (
                    <div className="ict-coach-pie">
                      <Pasos actual={1} />
                      <p><strong>Esta es la ficha del lote.</strong> En la maqueta completa, con precio y disponibilidad reales de su inventario.</p>
                      <button type="button" className="ict-btn ict-btn-oro" onClick={() => { escena.current?.deseleccionar(); setGuia('girar') }}>Siguiente <span aria-hidden="true">→</span></button>
                    </div>
                  ) : (
                    <p>Precio, estado y disponibilidad se conectan a su inventario en la maqueta completa.</p>
                  )}
                </div>
              )}

              {guia === 'tocar' && !lote && (
                <div className="ict-coach" role="status">
                  <Pasos actual={0} />
                  <h3>Toque el lote señalado</h3>
                  <p>Los puntos dorados son los lotes activos de esta vista previa. Puede tocar cualquiera.</p>
                  <button type="button" className="ict-link" onClick={() => guiaId && escena.current?.seleccionarLote(guiaId)}>Mostrármelo</button>
                </div>
              )}
              {guia === 'girar' && (
                <div className="ict-coach" role="status">
                  <Pasos actual={2} />
                  <div className="ict-gesto" aria-hidden="true"><i /></div>
                  <h3>Gire la isla</h3>
                  <p>{tactil ? 'Arrastre con un dedo para girar. Pellizque para acercarse.' : 'Arrastre para girar. Use la rueda para acercarse.'}</p>
                  <button type="button" className="ict-link" onClick={() => setGuia('fin')}>Saltar</button>
                </div>
              )}
              {guia === 'fin' && (
                <div className="ict-coach fin" role="status">
                  <span className="ict-coach-ok" aria-hidden="true">✓</span>
                  <h3>Así funcionaría con los {total} lotes.</h3>
                  <p>Sigamos con el recorrido por la isla.</p>
                  <div className="ict-coach-botones">
                    <button type="button" className="ict-btn ict-btn-oro" onClick={terminarDemo}>Continuar: {destinoDemo} <span aria-hidden="true">→</span></button>
                    <button type="button" className="ict-link" onClick={() => setGuia('libre')}>Seguir explorando</button>
                  </div>
                </div>
              )}
              {guia === 'libre' && !lote && (
                <div className="ict-libre">
                  <span>Toque cualquier punto dorado</span>
                  <button type="button" className="ict-btn ict-btn-oro ict-btn-s" onClick={terminarDemo}>Continuar: {destinoDemo} →</button>
                </div>
              )}
              <div className={`ict-toast${toast ? ' on' : ''}`} role="status">Este lote se activa en la maqueta completa</div>
            </>
          )}

          {!explorando && paso === 0 && (
            <button type="button" className="ict-bajar" onClick={() => irAPaso(1)} aria-label="Siguiente">
              <span>{tactil ? 'Deslice para continuar' : 'Baje para continuar'}</span><i aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="ict-pasos">
          {PASOS.map((p, i) => (
            <div key={p.vista} className="ict-paso" data-paso={i}>
              <div className={`ict-card${paso === i ? ' on' : ''}`}>
                <div className="ict-card-cab">
                  <span className="ict-eyebrow">{p.eyebrow}</span>
                  <span className="ict-contador">{i + 1} / {PASOS.length}</span>
                </div>
                {i === 0 ? <h1>{p.titulo}</h1> : <h2>{p.titulo}</h2>}
                <p>{p.texto}</p>
                {i === 1 && <span className="ict-leyenda"><i className="on" />{activos} lotes activos<i className="off" />{total - activos} por activar</span>}
                <div className="ict-card-botones">
                  {/* La demostración vive solo en el paso de los lotes: es lo que
                      demuestra. El paso 1 presenta la isla y lleva hasta ahí. */}
                  {i === 0 && (
                    <button type="button" className="ict-btn ict-btn-claro" onClick={() => irAPaso(1)}>
                      Empezar el recorrido <span aria-hidden="true">↓</span>
                    </button>
                  )}
                  {i === 1 && listo && !demoVista && (
                    <>
                      <button type="button" className="ict-btn ict-btn-oro" onClick={() => explorar(true)}>
                        Pruébelo: toque un lote <span aria-hidden="true">→</span>
                      </button>
                      <span className="ict-dura">1 minuto · 3 pasos</span>
                    </>
                  )}
                  {i === 1 && demoVista && (
                    <>
                      <span className="ict-hecha"><b aria-hidden="true">✓</b> Demostración vista</span>
                      <button type="button" className="ict-btn ict-btn-oro" onClick={() => irAPaso(2)}>
                        Continuar: la casa club <span aria-hidden="true">↓</span>
                      </button>
                      <button type="button" className="ict-link ict-link-claro" onClick={() => explorar(true)}>Repetirla</button>
                    </>
                  )}
                  {i === 2 && (
                    <button type="button" className="ict-btn ict-btn-claro" onClick={() => irA(1)}>
                      Ver lo que proponemos <span aria-hidden="true">↓</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2 · Maqueta comercial ─────────────────────────────────────────── */}
      <section className="ict-sec ict-claro" data-seccion={1} data-tono="claro">
        <div className="ict-wrap">
          <div className="ict-cab ict-rev">
            <span className="ict-eyebrow">Maqueta digital comercial</span>
            <h2>Una sola herramienta para todo el ciclo de venta.</h2>
          </div>
          <div className="ict-tres ict-rev">
            <div><span className="ict-num">01</span><h3>Sala de ventas</h3><p>La isla a pantalla completa, con el estado de cada lote al día. El cliente elige sobre la maqueta, no sobre un plano.</p></div>
            <div><span className="ict-num">02</span><h3>Visita con tablet</h3><p>El asesor recorre la isla con el comprador y abre la ficha de cada lote en el lugar donde está.</p></div>
            <div><span className="ict-num">03</span><h3>Un enlace por comprador</h3><p>Cada interesado recibe su enlace y vuelve a la isla desde casa. Su equipo sabe quién la abre y qué lotes mira.</p></div>
          </div>
          <div className="ict-par ict-rev">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="ict-marco"><img src={`${A}/tm-maqueta-digital.webp`} alt="Maqueta comercial de FP Visual Lab con la ficha de una vivienda" loading="lazy" /></span>
              <figcaption>FP Visual Lab · maqueta comercial de una torre residencial</figcaption>
            </figure>
            <div className="ict-lista">
              <span className="ict-eyebrow">En la maqueta completa</span>
              <ul>
                <li>Los 173 lotes, vinculados a su inventario</li>
                <li>Precio y disponibilidad actualizados</li>
                <li>Filtros por superficie, precio y ubicación</li>
                <li>Recorridos y renders de la isla</li>
                <li>Casa club y casas tipo dentro de la maqueta</li>
              </ul>
            </div>
          </div>
        </div>
        <Siguiente onClick={() => irA(2)} titulo="Casa club" />
      </section>

      {/* ── 3 · Casa club ─────────────────────────────────────────────────── */}
      <section className="ict-sec ict-oscuro" data-seccion={2} data-tono="oscuro">
        <div className="ict-wrap">
          <div className="ict-cab ict-rev">
            <span className="ict-eyebrow">Casa club</span>
            <h2>Del primer trazo a la obra terminada.</h2>
            <p>Proponemos diseñar la casa club con un solo equipo de principio a fin: arquitectura e interiorismo en las mismas manos, y presencia en obra hasta la entrega.</p>
          </div>
          {/* Moodboard: atmósfera, no diseño. La casa club está por proyectar. */}
          <div className="ict-galeria ict-rev">
            {[
              ['club-entrada', 'Acceso abierto al paisaje, con piedra, madera y agua'],
              ['club-piscina', 'Piscina y terraza bajo grandes voladizos'],
              ['club-gimnasio', 'Gimnasio volcado al jardín'],
              ['club-spa', 'Spa con patio ajardinado'],
            ].map(([f, alt], i) => (
              <figure key={f} className={i === 0 ? 'grande' : ''}>
                <span className="ict-marco"><img src={`${A}/${f}.webp`} alt={alt} loading="lazy" /></span>
                <figcaption>{alt}</figcaption>
              </figure>
            ))}
          </div>
          <p className="ict-pie ict-rev">Imágenes de inspiración · No representan el diseño final de la casa club</p>
          <div className="ict-tres ict-fases ict-rev">
            <div><span className="ict-num">01</span><h3>Anteproyecto</h3><p>Programa, concepto y volumetría: la idea completa de la casa club, para decidir pronto y con criterio.</p></div>
            <div><span className="ict-num">02</span><h3>Proyecto de ejecución</h3><p>Planos constructivos, detalles y coordinación de ingenierías: todo lo que la constructora necesita para levantarla.</p></div>
            <div><span className="ict-num">03</span><h3>Supervisión de obra</h3><p>Visitas, control de calidad y respuesta a la obra hasta la entrega.</p></div>
          </div>
        </div>
        <Siguiente onClick={() => irA(3)} titulo="Casas tipo" />
      </section>

      {/* ── 4 · Casas tipo ────────────────────────────────────────────────── */}
      <section className="ict-sec ict-papel" data-seccion={3} data-tono="claro">
        <div className="ict-wrap ict-par ict-par-texto">
          <div className="ict-lista ict-rev">
            <span className="ict-eyebrow">Propuesta · Cuatro casas tipo</span>
            <h2>Diseñaremos la casa que el comprador puede construir.</h2>
            <p>Un lote se vende mejor cuando se ve la casa. Como parte de esta propuesta, diseñaríamos con su equipo cuatro casas tipo a nivel de anteproyecto: distintas superficies y programas, un mismo lenguaje para toda la isla.</p>
          </div>
          <div className="ict-lista ict-rev">
            <span className="ict-eyebrow">Lo que entregaríamos por cada casa</span>
            <ul>
              <li>Plantas de distribución, fachadas y cuadro de áreas</li>
              <li>Serie de renders fotorrealistas, exteriores e interiores</li>
              <li>Vídeo render de la casa</li>
              <li>Maqueta digital propia de la tipología</li>
              <li>Recorrido virtual por sus espacios</li>
              <li>Cada casa, sobre su lote en la maqueta de la isla</li>
            </ul>
            <p className="ict-nota">Material pensado para vender: sala de ventas, redes, dossier y el enlace de cada comprador.</p>
          </div>
        </div>
        {/* Referencias: la idea de cuatro villas distintas con un mismo lenguaje. No son el diseño. */}
        <div className="ict-wrap">
          <p className="ict-intro-villas ict-rev">Como punto de partida, cuatro direcciones de referencia:</p>
          <div className="ict-villas">
            {[
              ['villa-1', 'Dirección 1', 'Volumen alto en madera sobre zócalo de piedra'],
              ['villa-2', 'Dirección 2', 'Planta baja acristalada abierta a la piscina'],
              ['villa-3', 'Dirección 3', 'Pabellón central con patio de acceso'],
              ['villa-4', 'Dirección 4', 'Gran voladizo y porche de llegada'],
            ].map(([f, t, d]) => (
              <figure key={f} className="ict-rev">
                <span className="ict-marco"><img src={`${A}/${f}.webp`} alt={`${t}: ${d}`} loading="lazy" /></span>
                <figcaption><strong>{t}</strong> {d}</figcaption>
              </figure>
            ))}
          </div>
          <p className="ict-pie ict-rev">Imágenes de referencia · Cuatro direcciones posibles para el lenguaje de la isla. No son diseños de Isla Creta: las casas se definirán con su equipo, según el perfil de comprador.</p>
        </div>
        <Siguiente onClick={() => irA(4)} titulo="Forma Prima" />
      </section>

      {/* ── 5 · El estudio ────────────────────────────────────────────────── */}
      <section className="ict-sec ict-claro" data-seccion={4} data-tono="claro">
        <div className="ict-wrap">
          <div className="ict-estudio ict-rev">
            <div>
              <span className="ict-eyebrow">Forma Prima</span>
              <h2 className="ict-manifiesto">Un estudio de arquitectura e interiorismo que diseña el proyecto completo.</h2>
              <p>Trabajamos desde Madrid con proyectos en España, Estados Unidos, México y Ecuador. El mismo equipo lleva cada proyecto de principio a fin: dibuja el edificio, resuelve su detalle constructivo, diseña sus interiores y entrega los planos con los que la constructora lo levanta.</p>
            </div>
            <dl className="ict-cifras">
              <div><dt data-cuenta="60" data-pre="+">+60</dt><dd>proyectos de arquitectura e interiorismo</dd></div>
              <div><dt data-cuenta="4">4</dt><dd>países · España, EE. UU., México y Ecuador</dd></div>
              <div><dt data-cuenta="1">1</dt><dd>equipo para todas las fases</dd></div>
            </dl>
          </div>
          <div className="ict-cuatro ict-rev">
            <div><h3>Arquitectura</h3><p>Anteproyecto, proyecto de ejecución, coordinación de ingenierías y supervisión de obra.</p></div>
            <div><h3>Interiorismo</h3><p>Áreas comunes y amenidades, materialidad y detalle.</p></div>
            <div><h3>Producto residencial</h3><p>Mix de unidades, superficie vendible y estándares repetibles.</p></div>
            <div><h3>FP Visual Lab</h3><p>Maquetas digitales, renders, recorridos y dossiers de venta.</p></div>
          </div>
        </div>
      </section>

      {/* ── 6 · Obra seleccionada ─────────────────────────────────────────── */}
      <section className="ict-sec ict-claro ict-sec-junta" data-seccion={5} data-tono="claro">
        <div className="ict-wrap">
          <div className="ict-cab-fila ict-rev">
            <h2>Obra seleccionada</h2>
            <span>2021–2026</span>
          </div>
          <div className="ict-obras">
            {OBRAS.map((o) => (
              <figure key={o.img} className={`ict-rev${o.grande ? ' grande' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="ict-marco"><img src={`${A}/${o.img}.webp`} alt={o.nombre} loading="lazy" /></span>
                <figcaption><span>{o.nombre} <em>{o.lugar}</em></span><em data-cuenta={parseInt(o.dato.replace(/\D/g, ''), 10)} data-suf=" m²">{o.dato}</em></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7 · Equipo ────────────────────────────────────────────────────── */}
      <section className="ict-sec ict-oscuro" data-seccion={6} data-tono="oscuro">
        <div className="ict-wrap">
          <div className="ict-cab ict-rev">
            <span className="ict-eyebrow">Equipo</span>
            <h2>Quiénes estarían en el proyecto.</h2>
            <p>Arquitectura, interiorismo y visualización en un mismo equipo, con los socios fundadores al frente.</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="ict-marco ict-rev"><img className="ict-foto-equipo" src={`${A}/equipo-fp.webp`} alt="Equipo de Forma Prima" loading="lazy" /></span>
          <div className="ict-equipo">
            {EQUIPO.map((p) => (
              <div key={p.img} className="ict-rev">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="ict-marco"><img src={`${A}/${p.img}.webp`} alt={p.nombre} loading="lazy" /></span>
                <strong>{p.nombre}</strong>
                <span>{p.rol}</span>
              </div>
            ))}
          </div>
        </div>
        <Siguiente onClick={() => irA(7)} titulo="Reunión" />
      </section>

      {/* ── 8 · Reunión ───────────────────────────────────────────────────── */}
      <section ref={reunion} className="ict-sec ict-verde" data-seccion={7} data-tono="oscuro">
        <div className="ict-wrap ict-reunion">
          <div className="ict-rev">
            <span className="ict-eyebrow">Siguiente paso</span>
            <h2>La propuesta completa, en 45 minutos.</h2>
            <p>Por videollamada les presentamos el alcance de cada servicio, la maqueta en vivo, los honorarios y el calendario.</p>
            <ul>
              <li>Maqueta digital comercial</li>
              <li>Casa club: anteproyecto, ejecución y supervisión</li>
              <li>Cuatro casas tipo</li>
              <li>Honorarios y calendario</li>
            </ul>
          </div>
          <Reserva slug={slug} alPedir={() => alEvento('interes', 'reunión')} />
        </div>
      </section>

      <footer className="ict-footer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/propuestas/logo-fp.png" alt="Forma Prima" />
        <span>Vista previa conceptual · Superficies del plano de lotificación · Viviendas, vegetación y entorno ilustrativos · Confidencial para Grupo RSA</span>
      </footer>
    </div>
  )
}

const EASE = 'cubic-bezier(.16,1,.3,1)'

function animarSeccion(sec: HTMLElement) {
  const bloques = Array.from(sec.querySelectorAll<HTMLElement>('.ict-rev'))
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { bloques.forEach((b) => b.classList.add('in')); return }
  const retardo = new Map<Element, number>()
  bloques.forEach((b, i) => {
    const d = 120 + Math.min(i, 14) * 90
    retardo.set(b, d)
    const titulo = !!b.querySelector('h2') || /^H\d$/.test(b.tagName)
    b.classList.add('in')
    b.animate(
      [{ opacity: 0, transform: `translate3d(0,${titulo ? 28 : 16}px,0)` }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
      { duration: titulo ? 1400 : 1200, delay: d, easing: EASE, fill: 'backwards' },
    )
  })
  const retardoDe = (el: Element) => { let n: Element | null = el; while (n && n !== sec) { if (retardo.has(n)) return retardo.get(n)!; n = n.parentElement } return 200 }

  // Imágenes: telón de opacidad y asentamiento lento de la escala (dentro de su marco).
  sec.querySelectorAll<HTMLImageElement>('.ict-marco img').forEach((img, k) => {
    const d = retardoDe(img) + k * 60
    img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1800, delay: d, easing: 'cubic-bezier(.33,0,.2,1)', fill: 'backwards' })
    img.animate([{ transform: 'scale3d(1.06,1.06,1)' }, { transform: 'scale3d(1,1,1)' }], { duration: 3200, delay: d, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' })
  })

  // Cifras que suben desde cero (+60, 4, 1, 2.300 m²…), con números de ancho fijo.
  sec.querySelectorAll<HTMLElement>('[data-cuenta]').forEach((el) => {
    const fin = Number(el.dataset.cuenta), pre = el.dataset.pre ?? '', suf = el.dataset.suf ?? ''
    const fmt = (v: number) => pre + Math.round(v).toLocaleString('es-ES', { useGrouping: fin >= 1000 ? 'always' : false } as Intl.NumberFormatOptions) + suf
    const original = el.textContent
    const d = retardoDe(el) + 250, dur = Math.min(2600, 1600 + Math.log10(fin + 1) * 180)
    el.style.fontVariantNumeric = 'tabular-nums'
    el.textContent = fmt(0)
    let t0: number | null = null
    const paso = (t: number) => {
      if (t0 === null) t0 = t + d
      const p = Math.min(1, Math.max(0, (t - t0) / dur))
      el.textContent = fmt(fin * (1 - Math.pow(1 - p, 4)))
      if (p < 1) requestAnimationFrame(paso)
      else { el.textContent = original; el.style.fontVariantNumeric = '' }
    }
    requestAnimationFrame(paso)
  })
}

function Pasos({ actual }: { actual: number }) {
  return (
    <div className="ict-pasos-guia" aria-label={`Paso ${actual + 1} de ${PASOS_GUIA.length}`}>
      <span>Paso {actual + 1} de {PASOS_GUIA.length}</span>
      <div>{PASOS_GUIA.map((g, i) => <i key={g} className={i < actual ? 'hecho' : i === actual ? 'on' : ''} />)}</div>
    </div>
  )
}

function Siguiente({ titulo, onClick }: { titulo: string; onClick: () => void }) {
  return (
    <div className="ict-wrap">
      <button type="button" className="ict-siguiente" onClick={onClick}>
        <span>Siguiente</span><strong>{titulo}</strong><i aria-hidden="true">↓</i>
      </button>
    </div>
  )
}

function Reserva({ slug, alPedir }: { slug: string; alPedir: () => void }) {
  const [dia, setDia] = useState<number | null>(null)
  const [hora, setHora] = useState<number | null>(null)
  const [nombre, setNombre] = useState('')
  const [cargo, setCargo] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [web, setWeb] = useState('')
  const [privacidad, setPrivacidad] = useState(false)
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'hecho'>('idle')
  const [error, setError] = useState('')

  const franja = dia !== null && hora !== null
    ? `${DIAS[dia].largo} ${DIAS[dia].n} oct · ${HORAS[hora].gye} Guayaquil / ${HORAS[hora].mad} Madrid`
    : ''

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!franja) { setError('Elija un día y una hora.'); return }
    setEstado('enviando')
    setError('')
    const r = await solicitarReunionPropuestaWeb(slug, { web, franja, nombre, cargo, email, telefono, privacidad }).catch(() => ({ ok: false, error: 'No se ha podido enviar. Inténtelo de nuevo.' }))
    if (r.ok) { setEstado('hecho'); alPedir() }
    else { setEstado('idle'); setError(r.error ?? 'No se ha podido enviar. Inténtelo de nuevo.') }
  }

  if (estado === 'hecho') {
    return (
      <div className="ict-hecho" role="status">
        <span className="ict-eyebrow">Solicitud recibida</span>
        <strong>{DIAS[dia!].largo} {DIAS[dia!].n} de octubre, {HORAS[hora!].gye} en Guayaquil ({HORAS[hora!].mad} en Madrid)</strong>
        <p>Les confirmamos por correo, con el enlace de la videollamada, en menos de 24 horas.</p>
      </div>
    )
  }

  return (
    <form className="ict-form" onSubmit={enviar}>
      <fieldset>
        <legend>Elijan el día · semana del 13 de octubre</legend>
        <div className="ict-dias">
          {DIAS.map((d, i) => (
            <button key={d.n} type="button" aria-pressed={dia === i} className={dia === i ? 'on' : ''} onClick={() => setDia(i)}>
              <span>{d.corto}</span><b>{d.n}</b>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Hora de Guayaquil · entre paréntesis, Madrid</legend>
        <div className="ict-horas">
          {HORAS.map((h, i) => (
            <button key={h.gye} type="button" aria-pressed={hora === i} className={hora === i ? 'on' : ''} onClick={() => setHora(i)}>
              {h.gye} <span>({h.mad})</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="ict-campos">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" aria-label="Nombre" autoComplete="name" required />
        <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo" aria-label="Cargo" autoComplete="organization-title" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo" aria-label="Correo" type="email" autoComplete="email" required />
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono (opcional)" aria-label="Teléfono" type="tel" autoComplete="tel" />
        <input value={web} onChange={(e) => setWeb(e.target.value)} className="ict-trampa" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </div>
      <label className="ict-check">
        <input type="checkbox" checked={privacidad} onChange={(e) => setPrivacidad(e.target.checked)} />
        <span>Acepto la <a href="https://formaprima.es/privacidad" target="_blank" rel="noopener">política de privacidad</a>. Usaremos estos datos solo para organizar la reunión.</span>
      </label>
      {error && <p className="ict-error" role="alert">{error}</p>}
      <button type="submit" className="ict-btn ict-btn-claro" disabled={estado === 'enviando'}>
        {estado === 'enviando' ? 'Enviando…' : 'Solicitar reunión'}
      </button>
      <p className="ict-alt">¿Ninguna franja les viene bien? Escríbannos a <a href="mailto:contacto@formaprima.es?subject=Reuni%C3%B3n%20Isla%20Creta">contacto@formaprima.es</a></p>
    </form>
  )
}

const CSS = `
html,body{background:#0d0d0d!important;margin:0;}
/* Scroll por slides: cada paso de la maqueta y cada sección son un punto de
   anclaje. Las secciones más altas que la pantalla se recorren por dentro
   (comportamiento estándar de scroll-snap con áreas mayores que la vista). */
html{scroll-snap-type:y mandatory;overflow-anchor:none;}
html:has(.ict-sticky.full){scroll-snap-type:none;}
.ict-paso,.ict-sec{scroll-snap-align:start;}
.ict-footer{scroll-snap-align:end;}
.ict{--negro:#0d0d0d;--blanco:#fbfbfa;--papel:#f4f3f0;--tinta:#141414;--salvia:#8fa596;--verde:#2f4238;--oro:#e2b45a;
  font-family:'Hanken Grotesk',sans-serif;color:var(--blanco);background:var(--negro);-webkit-font-smoothing:antialiased;overflow-x:clip;}
.ict *{box-sizing:border-box;}
.ict img{max-width:100%;display:block;}
.ict h1,.ict h2,.ict h3{margin:0;font-weight:200;letter-spacing:-.035em;text-wrap:balance;}
.ict p{margin:0;text-wrap:pretty;}
.ict-eyebrow{display:block;font-family:'Newsreader',serif;font-style:italic;font-size:17px;font-weight:400;letter-spacing:0;color:var(--salvia);margin-bottom:16px;}
.ict-btn{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 26px;white-space:nowrap;border:0;font-family:inherit;font-size:15px;font-weight:500;cursor:pointer;transition:background .25s,color .25s;}
.ict-btn-s{height:40px;padding:0 18px;font-size:14px;}
.ict-btn-claro{background:var(--blanco);color:var(--tinta);}
@media (hover:hover){.ict-btn-claro:hover{background:var(--salvia);}}
.ict-btn:disabled{opacity:.5;cursor:default;}

.ict-top{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;justify-content:space-between;align-items:center;padding:16px clamp(16px,4vw,48px);pointer-events:none;}
.ict-top>*{pointer-events:auto;}
.ict-top{transition:background .35s,padding .35s;}
.ict-top.solida{background:rgba(13,13,13,.86);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding-top:10px;padding-bottom:10px;}
.ict-logo{height:18px;width:auto;}
.ict-logos{display:flex;align-items:center;gap:12px;}
.ict-logos i{width:1px;height:22px;background:rgba(251,251,250,.4);}
.ict-logo-rsa{height:28px;width:auto;}
.ict-splash{position:fixed;inset:0;z-index:100;background:#0d0d0d;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;padding:24px;transition:opacity .9s ease .2s,visibility 0s linear 1.1s;}
.ict-splash.fuera{opacity:0;visibility:hidden;pointer-events:none;}
.ict-splash-logos{display:flex;align-items:center;gap:clamp(20px,4vw,36px);animation:ict-sube 1.2s cubic-bezier(.16,1,.3,1) both;}
.ict-splash-logos .fp{height:clamp(22px,3.4vw,32px);width:auto;}
.ict-splash-logos .rsa{height:clamp(48px,7vw,68px);width:auto;}
.ict-splash-logos i{width:1px;height:clamp(40px,6vw,56px);background:rgba(251,251,250,.35);}
.ict-splash-pie{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(300px,70vw);font-size:13px;font-weight:300;color:rgba(251,251,250,.7);animation:ict-sube 1.2s cubic-bezier(.16,1,.3,1) .25s both;}
.ict-splash-pie small{font-size:12px;opacity:.6;font-variant-numeric:tabular-nums;}

/* Escenario 3D: lienzo fijo mientras pasan tres textos por encima */
.ict-stage{position:relative;background:#24302b;}
.ict-sticky{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;z-index:1;}
.ict-sticky.full{position:fixed;inset:0;height:100%;z-index:60;}
.ict-canvas{position:absolute;inset:0;touch-action:pan-y;}
.ict-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity 1.2s ease;}
.ict-poster.fuera{opacity:0;}
.ict-velo{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(13,13,13,.55) 0,rgba(13,13,13,0) 22%,rgba(13,13,13,0) 45%,rgba(13,13,13,.78) 100%);}
.ict-carga{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:14px;font-size:14px;font-weight:300;color:rgba(251,251,250,.85);text-align:center;width:min(320px,80vw);background:rgba(13,13,13,.45);padding:18px 22px;backdrop-filter:blur(6px);}
.ict-barra{width:100%;height:1px;background:rgba(251,251,250,.25);}
.ict-barra i{display:block;height:100%;background:var(--blanco);transform-origin:0 50%;transition:transform .3s;}
.ict-explorar{position:absolute;left:50%;bottom:calc(28px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:3;box-shadow:0 10px 30px rgba(0,0,0,.25);}
.ict-scroll{position:absolute;right:clamp(16px,4vw,48px);bottom:40px;font-size:13px;color:rgba(251,251,250,.7);transition:opacity .4s;display:none;}

.ict-pasos{position:relative;z-index:2;margin-top:-100vh;margin-top:-100svh;pointer-events:none;}
.ict-paso{min-height:100vh;min-height:100svh;display:flex;align-items:flex-start;padding:84px 16px 0;}
.ict-card{pointer-events:auto;max-width:520px;padding:22px 22px 24px;background:rgba(13,13,13,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);opacity:.25;transform:translateY(12px);transition:opacity .6s,transform .6s;}
.ict-card.on{opacity:1;transform:none;}
.ict-card h1{font-size:clamp(36px,9vw,76px);line-height:1;}
.ict-card h2{font-size:clamp(32px,8vw,60px);line-height:1.02;}
.ict-card p{margin-top:16px;font-size:16px;font-weight:300;line-height:1.55;color:rgba(251,251,250,.82);}
.ict-leyenda{display:flex;flex-wrap:wrap;align-items:center;gap:8px 8px;margin-top:16px;font-size:13px;color:rgba(251,251,250,.8);}
.ict-leyenda i{width:10px;height:10px;display:inline-block;}
.ict-leyenda i.on{background:var(--oro);}
.ict-leyenda i.off{background:#8f948a;margin-left:10px;}

/* Modo explorar */
.ict-xbar{position:absolute;top:0;left:0;right:0;z-index:3;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:14px 16px;background:linear-gradient(180deg,rgba(13,13,13,.7),rgba(13,13,13,0));}
.ict-xinfo{display:flex;flex-direction:column;gap:6px;}
.ict-xinfo .ict-leyenda{margin:0;font-size:12px;}
.ict-sello{align-self:flex-start;font-size:11px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--oro);}
.ict-pista{position:absolute;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);font-size:13px;color:var(--tinta);background:rgba(251,251,250,.92);padding:10px 16px;white-space:nowrap;pointer-events:none;}
.ict-toast{position:absolute;left:50%;top:50%;transform:translate(-50%,-40%);opacity:0;transition:all .3s;background:var(--blanco);color:var(--tinta);padding:12px 18px;font-size:14px;pointer-events:none;white-space:nowrap;z-index:4;}
.ict-toast.on{opacity:1;transform:translate(-50%,-50%);}
.ict-ficha{position:absolute;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:4;background:var(--blanco);color:var(--tinta);padding:18px 20px 16px;animation:ict-sube .35s ease-out both;}
.ict-ficha-cab{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--verde);}
.ict-ficha-cab button{background:none;border:0;font-family:inherit;font-size:13px;letter-spacing:0;text-transform:none;font-weight:400;color:var(--tinta);opacity:.6;cursor:pointer;padding:0;}
.ict-ficha-id{margin-top:6px;font-size:34px;font-weight:200;letter-spacing:-.03em;}
.ict-ficha-sub{font-size:14px;color:rgba(20,20,20,.6);}
.ict-ficha dl{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;margin:14px 0 0;padding-top:12px;border-top:1px solid rgba(20,20,20,.14);}
.ict-ficha dt{font-size:12px;color:rgba(20,20,20,.55);}
.ict-ficha dd{margin:2px 0 0;font-size:24px;font-weight:300;}
.ict-ficha dd.t{font-size:16px;font-weight:400;padding-top:5px;}
.ict-ficha dd small{font-size:13px;color:rgba(20,20,20,.55);}
.ict-ficha dd.bloq{color:rgba(20,20,20,.35);}
.ict-ficha p{margin-top:12px;padding-top:10px;border-top:1px solid rgba(20,20,20,.14);font-size:12px;line-height:1.45;color:rgba(20,20,20,.6);}

/* Guía: cabecera de capítulo, índice lateral, marcadores y pasos */
.ict-cap{display:none;align-items:baseline;gap:6px;font-size:13px;color:rgba(251,251,250,.85);}
.ict-cap b{font-weight:500;}
.ict-cap span{opacity:.5;}
.ict-cap em{font-style:normal;margin-left:8px;}
.ict-avance{position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--oro);transform-origin:0 50%;transition:transform .15s linear;}
.ict-indice{display:none;}
.ict-card-cab{display:flex;flex-direction:row-reverse;justify-content:flex-end;align-items:baseline;gap:14px;}
.ict-card-cab .ict-eyebrow{margin-bottom:16px;}
.ict-contador{font-size:12px;font-weight:500;letter-spacing:.14em;color:rgba(251,251,250,.6);}
.ict-card-botones{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;margin-top:22px;}
.ict-dura{font-size:13px;color:rgba(251,251,250,.65);}
.ict-hecha{display:inline-flex;align-items:center;gap:8px;width:100%;font-size:14px;color:rgba(251,251,250,.85);}
.ict-hecha b{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#5f8a5a;color:#fff;font-size:12px;}
.ict-link-claro{margin-top:0;color:var(--blanco);}
.ict-btn-oro{background:var(--oro);color:var(--tinta);}
@media (hover:hover){.ict-btn-oro:hover{background:#f0c878;}}
.ict-bajar{position:absolute;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:3;display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:0;color:var(--blanco);font-family:inherit;font-size:13px;cursor:pointer;}
.ict-bajar i{width:22px;height:34px;border:1.5px solid rgba(251,251,250,.8);border-radius:12px;position:relative;}
.ict-bajar i::after{content:'';position:absolute;left:50%;top:7px;width:3px;height:7px;margin-left:-1.5px;border-radius:2px;background:var(--blanco);animation:ict-rueda 1.6s ease-in-out infinite;}
@keyframes ict-rueda{0%{transform:translateY(0);opacity:1}70%{transform:translateY(11px);opacity:0}100%{opacity:0}}

.ict-marcas{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;}
.ict-marca{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;padding:0;border:0;background:none;pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.ict-marca i{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:var(--oro);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);}
.ict-marca i::after{content:'';position:absolute;inset:-8px;border-radius:50%;border:2px solid var(--oro);animation:ict-latido 1.8s ease-out infinite;}
.ict-marca.sel i{background:#fff;border-color:var(--oro);}
.ict-marca.guia i{width:28px;height:28px;margin:-14px 0 0 -14px;}
.ict-marca.guia i::after{inset:-14px;border-width:3px;}
.ict-marca span{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);white-space:nowrap;background:var(--oro);color:var(--tinta);font-family:inherit;font-size:14px;font-weight:600;padding:8px 12px;box-shadow:0 6px 18px rgba(0,0,0,.3);animation:ict-flota 1.6s ease-in-out infinite;}
.ict-marca span::after{content:'';position:absolute;left:50%;top:100%;margin-left:-6px;border:6px solid transparent;border-top-color:var(--oro);}
@keyframes ict-latido{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.8);opacity:0}}
@keyframes ict-flota{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-5px)}}

.ict-salir{white-space:nowrap;flex:none;background:rgba(13,13,13,.55);color:var(--blanco);border:1px solid rgba(251,251,250,.5);height:40px;padding:0 16px;font-family:inherit;font-size:14px;cursor:pointer;backdrop-filter:blur(6px);}
.ict-coach{position:absolute;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:4;background:var(--blanco);color:var(--tinta);padding:20px 22px 20px;box-shadow:0 18px 50px rgba(0,0,0,.35);animation:ict-sube .4s ease-out both;}
.ict-coach h3{font-size:28px;font-weight:300;letter-spacing:-.025em;line-height:1.1;margin-top:12px!important;}
.ict-coach p{margin-top:8px;font-size:15px;font-weight:300;line-height:1.5;color:rgba(20,20,20,.72);}
.ict-coach.fin h3{margin-top:8px!important;}
.ict-coach-ok{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:var(--verde);color:#fff;font-size:17px;}
.ict-coach-botones{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px;margin-top:18px;}
.ict-pasos-guia{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--verde);}
.ict-pasos-guia div{display:flex;gap:6px;}
.ict-pasos-guia i{width:26px;height:3px;background:rgba(20,20,20,.15);}
.ict-pasos-guia i.hecho{background:var(--verde);}
.ict-pasos-guia i.on{background:var(--oro);}
.ict-link{background:none;border:0;padding:0;margin-top:12px;font-family:inherit;font-size:14px;color:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer;opacity:.75;}
.ict-coach-botones .ict-link{margin-top:0;}
.ict-coach-pie{margin-top:14px;padding-top:14px;border-top:1px solid rgba(20,20,20,.14);}
.ict-coach-pie p{margin:10px 0 14px!important;padding:0!important;border:0!important;font-size:14px!important;color:rgba(20,20,20,.75)!important;}
.ict-ficha.guiada{box-shadow:0 18px 50px rgba(0,0,0,.35);}
.ict-gesto{position:relative;width:64px;height:40px;margin-top:12px;}
.ict-gesto::before{content:'';position:absolute;left:4px;right:4px;top:50%;height:2px;margin-top:-1px;background:rgba(20,20,20,.15);}
.ict-gesto i{position:absolute;top:50%;left:0;width:22px;height:22px;margin-top:-11px;border-radius:50%;background:var(--oro);box-shadow:0 0 0 6px rgba(226,180,90,.3);animation:ict-arrastre 1.8s ease-in-out infinite;}
@keyframes ict-arrastre{0%,100%{transform:translateX(0)}50%{transform:translateX(42px)}}
.ict-libre{position:absolute;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:4;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;background:rgba(13,13,13,.72);backdrop-filter:blur(8px);padding:12px 14px;font-size:14px;}

.ict-siguiente{display:flex;align-items:center;gap:14px;width:100%;margin-top:72px;padding:22px 0 0;border:0;border-top:1px solid color-mix(in srgb,currentColor 22%,transparent);background:none;color:inherit;font-family:inherit;cursor:pointer;text-align:left;}
.ict-siguiente span{font-size:13px;opacity:.55;}
.ict-siguiente strong{font-size:22px;font-weight:300;letter-spacing:-.02em;flex:1;}
.ict-siguiente i{font-style:normal;width:44px;height:44px;border-radius:50%;border:1px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:18px;transition:background .25s,color .25s;}
@media (hover:hover){.ict-siguiente:hover i{background:var(--oro);border-color:var(--oro);color:var(--tinta);}}

.ict-cta{position:fixed;z-index:45;left:16px;right:16px;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:center;gap:12px;height:54px;padding:0 22px;border:0;background:var(--blanco);color:var(--tinta);font-family:inherit;font-size:15px;font-weight:400;cursor:pointer;box-shadow:0 12px 34px rgba(0,0,0,.32);transition:transform .45s cubic-bezier(.16,1,.3,1),opacity .3s,background .25s;}
.ict-cta b{font-weight:600;letter-spacing:.06em;}
.ict-cta i{width:8px;height:8px;border-radius:50%;background:#5f8a5a;box-shadow:0 0 0 0 rgba(95,138,90,.6);animation:ict-vivo 2s ease-out infinite;flex:none;}
.ict-cta em{font-style:normal;font-size:17px;transition:transform .25s;}
.ict-cta.fuera{transform:translateY(140%);opacity:0;pointer-events:none;}
@media (hover:hover){.ict-cta:hover{background:var(--oro);}.ict-cta:hover em{transform:translateX(4px);}}
@keyframes ict-vivo{0%{box-shadow:0 0 0 0 rgba(95,138,90,.6)}100%{box-shadow:0 0 0 10px rgba(95,138,90,0)}}
.ict-top-cta{display:none;}
.ict-bajar{bottom:calc(84px + env(safe-area-inset-bottom))!important;}
.ict-footer{padding-bottom:calc(92px + env(safe-area-inset-bottom))!important;}

/* Secciones */
.ict-sec{position:relative;z-index:3;padding:88px 0;}
.ict-sec-junta{padding-top:0;}
.ict-wrap{max-width:1320px;margin:0 auto;padding:0 20px;}
.ict-claro{background:var(--blanco);color:var(--tinta);}
.ict-papel{background:var(--papel);color:var(--tinta);}
.ict-oscuro{background:var(--negro);}
.ict-verde{background:var(--verde);}
.ict-claro .ict-eyebrow,.ict-papel .ict-eyebrow{color:var(--verde);}
.ict-cab{max-width:760px;margin-bottom:48px;}
.ict-cab h2,.ict-lista h2,.ict-reunion h2{font-size:clamp(34px,6vw,64px);line-height:1.02;}
.ict-cab p{margin-top:20px;font-size:17px;font-weight:300;line-height:1.6;opacity:.78;}
.ict-num{display:block;font-family:'Newsreader',serif;font-style:italic;font-size:18px;opacity:.6;margin-bottom:10px;}
.ict-tres{display:grid;gap:28px;}
.ict-tres>div{border-top:1px solid currentColor;border-color:color-mix(in srgb,currentColor 22%,transparent);padding-top:18px;}
.ict-tres h3,.ict-cuatro h3{font-size:24px;font-weight:300;letter-spacing:-.02em;}
.ict-tres p,.ict-cuatro p{margin-top:10px;font-size:16px;font-weight:300;line-height:1.55;opacity:.72;}
.ict-par{display:grid;gap:36px;margin-top:64px;align-items:end;}
.ict-par figure{margin:0;}
.ict-par figure img{width:100%;aspect-ratio:4/3;object-fit:cover;}
.ict-par-inv{margin-top:0;}
.ict-par-texto{margin-top:0;}
.ict-par-inv figure img{aspect-ratio:4/5;object-fit:cover;}
.ict figcaption{margin-top:10px;font-size:13px;opacity:.55;}
.ict-lista p{margin-top:20px;font-size:17px;font-weight:300;line-height:1.6;opacity:.75;}
.ict-lista ul,.ict-reunion ul{list-style:none;margin:24px 0 0;padding:0;border-top:1px solid color-mix(in srgb,currentColor 22%,transparent);}
.ict-lista li,.ict-reunion li{padding:13px 0;border-bottom:1px solid color-mix(in srgb,currentColor 22%,transparent);font-size:17px;font-weight:300;}
.ict-galeria{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.ict-galeria figure{margin:0;}
.ict-galeria figure.grande{grid-column:1 / -1;}
.ict-galeria img{width:100%;aspect-ratio:4/3;object-fit:cover;}
.ict-galeria figure.grande img{aspect-ratio:16/9;}
.ict-galeria figcaption{display:none;}
.ict-galeria figure:last-child{grid-column:1 / -1;}
.ict-galeria figure:last-child img{aspect-ratio:16/9;}
.ict-nota{margin-top:16px!important;font-size:15px!important;opacity:.7;}
.ict-intro-villas{margin-top:56px!important;font-size:15px;opacity:.7;}
.ict-villas{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px;}
.ict-villas figure{margin:0;}
.ict-villas img{width:100%;aspect-ratio:1/1;object-fit:cover;}
.ict-villas figcaption{font-size:13px;line-height:1.4;}
.ict-villas figcaption strong{display:block;font-weight:500;opacity:1;}
.ict-pie{margin-top:10px;font-size:13px;opacity:.55;}
.ict-pie.ict-rev.in{opacity:.55;}
.ict-villas + .ict-pie{margin-top:20px;}
.ict-fases{margin-top:56px;}

.ict-estudio{display:grid;gap:40px;}
.ict-manifiesto{font-size:clamp(30px,4.6vw,52px)!important;line-height:1.1;}
.ict-estudio p{margin-top:22px;max-width:660px;font-size:17px;font-weight:300;line-height:1.6;opacity:.75;}
.ict-cifras{margin:0;align-self:end;}
.ict-cifras div{display:flex;align-items:baseline;gap:18px;padding:16px 0;border-top:1px solid rgba(20,20,20,.16);}
.ict-cifras div:last-child{border-bottom:1px solid rgba(20,20,20,.16);}
.ict-cifras dt{font-size:44px;font-weight:200;letter-spacing:-.03em;min-width:84px;}
.ict-cifras dd{margin:0;font-size:15px;font-weight:300;opacity:.7;}
.ict-cuatro{display:grid;gap:24px;margin-top:64px;}
.ict-cuatro>div{border-top:1px solid rgba(20,20,20,.16);padding-top:16px;}
.ict-cuatro h3{font-size:20px;}
.ict-cuatro p{font-size:15px;}

.ict-cab-fila{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding-top:56px;border-top:1px solid rgba(20,20,20,.16);margin-bottom:28px;}
.ict-cab-fila h2{font-size:clamp(30px,4.6vw,48px);}
.ict-cab-fila span{font-size:14px;opacity:.55;}
.ict-obras{display:grid;gap:24px 16px;}
.ict-obras figure{margin:0;}
.ict-obras img{width:100%;aspect-ratio:4/3;object-fit:cover;}
.ict-obras figcaption{display:flex;justify-content:space-between;gap:12px;font-size:14px;opacity:1;}
.ict-obras em{font-style:normal;opacity:.55;}

.ict-foto-equipo{width:100%;aspect-ratio:16/9;object-fit:cover;object-position:center 40%;}
.ict-equipo{display:grid;grid-template-columns:repeat(2,1fr);gap:24px 14px;margin-top:32px;}
.ict-equipo img{width:100%;aspect-ratio:4/5;object-fit:cover;object-position:center top;margin-bottom:10px;filter:grayscale(.15);}
.ict-equipo strong{display:block;font-size:15px;font-weight:400;}
.ict-equipo span{display:block;margin-top:3px;font-size:13px;font-weight:300;line-height:1.4;opacity:.6;}

.ict-reunion{display:grid;gap:48px;}
.ict-reunion p{margin-top:20px;font-size:17px;font-weight:300;line-height:1.6;opacity:.8;}
.ict-form{display:flex;flex-direction:column;gap:26px;}
.ict-form fieldset{border:0;margin:0;padding:0;}
.ict-form legend{padding:0;margin-bottom:12px;font-size:14px;opacity:.8;}
.ict-dias{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
.ict-dias button,.ict-horas button{background:transparent;color:var(--blanco);border:1px solid rgba(251,251,250,.4);font-family:inherit;cursor:pointer;transition:border-color .2s;}
.ict-dias button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:12px 12px 10px;}
.ict-dias button span{font-size:13px;}
.ict-dias button b{font-size:28px;font-weight:300;}
.ict-horas{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
.ict-horas button{height:48px;font-size:16px;}
.ict-horas button span{font-size:13px;opacity:.65;}
@media (hover:hover){.ict-dias button:hover,.ict-horas button:hover{border-color:var(--blanco);}}
.ict-dias button.on,.ict-horas button.on{background:var(--blanco);color:var(--tinta);border-color:var(--blanco);}
.ict-campos{display:grid;gap:6px 18px;}
.ict-campos input{height:50px;background:transparent;border:0;border-bottom:1px solid rgba(251,251,250,.45);color:var(--blanco);font-family:inherit;font-size:17px;font-weight:300;outline:none;padding:0;border-radius:0;}
.ict-campos input::placeholder{color:rgba(251,251,250,.5);}
.ict-campos input:focus{border-bottom-color:var(--blanco);}
.ict-trampa{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;}
.ict-check{display:flex;gap:12px;align-items:flex-start;font-size:13px;font-weight:300;line-height:1.5;opacity:.85;cursor:pointer;}
.ict-check input{margin-top:3px;width:16px;height:16px;accent-color:var(--blanco);flex:none;}
.ict-check a,.ict-alt a{color:inherit;text-underline-offset:3px;}
.ict-form .ict-btn{align-self:flex-start;}
.ict-error{font-size:14px;color:#f1b7a6;}
.ict-alt{font-size:13px!important;opacity:.65!important;margin-top:0!important;}
.ict-hecho{border-top:1px solid rgba(251,251,250,.5);padding-top:20px;animation:ict-sube .4s ease-out both;}
.ict-hecho strong{display:block;font-size:clamp(24px,3vw,32px);font-weight:300;letter-spacing:-.02em;line-height:1.25;}

.ict-footer{position:relative;z-index:3;background:var(--negro);display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px;padding:28px 20px calc(28px + env(safe-area-inset-bottom));}
.ict-footer img{height:15px;width:auto;opacity:.7;}
.ict-footer span{font-size:12px;font-weight:300;opacity:.5;}

.ict-rev{opacity:0;}
.ict-rev.in{opacity:1;}
.ict-marco{display:block;overflow:hidden;}
.ict-marco img{transform-origin:50% 50%;}
@keyframes ict-sube{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}

/* Móvil: la maqueta manda. Guía, ficha y barra superior condensadas al mínimo
   legible; lo explicativo se queda en escritorio. */
@media (max-width:719px){
  .ict-xbar{padding:10px 12px;align-items:center;}
  .ict-xinfo{gap:3px;}
  .ict-sello{font-size:10px;letter-spacing:.18em;}
  .ict-xinfo .ict-leyenda{font-size:11px;gap:4px 6px;}
  .ict-xinfo .ict-leyenda i{width:8px;height:8px;}
  .ict-salir{height:32px;padding:0 12px;font-size:13px;}
  .ict-marca span{font-size:12px;padding:5px 9px;bottom:40px;}
  .ict-coach,.ict-libre{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));padding:11px 14px 12px;}
  .ict-coach h3{font-size:18px;margin-top:6px!important;letter-spacing:-.015em;}
  .ict-coach p{display:none;}
  .ict-coach .ict-link{margin-top:6px;font-size:13px;}
  .ict-gesto{display:none;}
  .ict-coach-ok{width:22px;height:22px;font-size:12px;float:left;margin:2px 8px 0 0;}
  .ict-coach.fin h3{margin-top:0!important;}
  .ict-coach-botones{margin-top:10px;gap:8px 14px;}
  .ict-coach .ict-btn,.ict-ficha .ict-btn,.ict-libre .ict-btn{height:40px;padding:0 16px;font-size:14px;}
  .ict-pasos-guia{font-size:10px;letter-spacing:.14em;}
  .ict-pasos-guia i{width:16px;}
  .ict-ficha{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));padding:11px 14px 12px;}
  .ict-ficha-cab{font-size:10px;letter-spacing:.14em;}
  .ict-ficha-id{margin-top:2px;font-size:22px;line-height:1.1;}
  .ict-ficha-sub{display:none;}
  .ict-ficha dl{grid-template-columns:repeat(4,auto);justify-content:space-between;gap:4px 10px;margin-top:8px;padding-top:8px;}
  .ict-ficha dt{font-size:10px;}
  .ict-ficha dd{font-size:14px;white-space:nowrap;}
  .ict-ficha dd.t{font-size:13px;padding-top:2px;}
  .ict-ficha dd small{font-size:9px;}
  .ict-ficha > p{display:none;}
  .ict-coach-pie{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding-top:10px;}
  .ict-coach-pie p{display:none;}
  .ict-coach-pie .ict-pasos-guia{flex-direction:column;align-items:flex-start;gap:5px;}
  .ict-libre{padding:8px 10px;font-size:13px;}
  .ict-toast{font-size:13px;padding:10px 14px;}
}
@media (min-width:720px){
  .ict-tres{grid-template-columns:repeat(3,1fr);}
  .ict-cuatro{grid-template-columns:repeat(2,1fr);}
  .ict-horas{grid-template-columns:repeat(4,1fr);}
  .ict-campos{grid-template-columns:1fr 1fr;}
  .ict-obras{grid-template-columns:repeat(2,1fr);}
  .ict-equipo{grid-template-columns:repeat(4,1fr);}
  .ict-ficha{left:auto;right:24px;top:96px;bottom:auto;width:360px;}
  .ict-galeria{gap:16px;}
  .ict-villas{grid-template-columns:repeat(4,1fr);gap:16px;}
  .ict-galeria figcaption{display:block;}
}
@media (min-width:1024px){
  .ict-wrap{padding:0 56px;}
  .ict-sec{padding:128px 0;}
  .ict-sec-junta{padding-top:0;}
  .ict-paso{align-items:center;padding:0 56px;}
  .ict-card{background:none;backdrop-filter:none;-webkit-backdrop-filter:none;padding:0;}
  .ict-card p{font-size:18px;}
  .ict-velo{background:linear-gradient(90deg,rgba(13,13,13,.78) 0,rgba(13,13,13,.35) 38%,rgba(13,13,13,0) 60%),linear-gradient(180deg,rgba(13,13,13,.4) 0,rgba(13,13,13,0) 18%);}
  .ict-cta{left:auto;right:32px;bottom:32px;}
  .ict-bajar{bottom:32px!important;}
  .ict-footer{padding-bottom:32px!important;}
  .ict-cap{display:flex;position:absolute;left:50%;transform:translateX(-50%);}
  .ict-indice{display:flex;flex-direction:column;gap:14px;position:fixed;right:24px;top:50%;transform:translateY(-50%);z-index:35;transition:opacity .3s;}
  .ict-indice.fuera{opacity:0;pointer-events:none;}
  .ict-indice button{display:flex;align-items:center;justify-content:flex-end;gap:12px;background:none;border:0;padding:2px 0;cursor:pointer;font-family:inherit;color:#fbfbfa;transition:color .35s;text-shadow:0 1px 6px rgba(0,0,0,.35);}
  .ict-indice.sobre-claro button{color:var(--tinta);text-shadow:none;}
  .ict-indice span{font-size:12px;opacity:0;transform:translateX(6px);transition:all .25s;white-space:nowrap;}
  .ict-indice i{width:8px;height:8px;border-radius:50%;border:1px solid currentColor;transition:all .25s;}
  .ict-indice button.visto i{background:currentColor;opacity:.6;}
  .ict-indice button.on i{background:currentColor;transform:scale(1.4);}
  .ict-indice button.on span,.ict-indice button:hover span{opacity:1;transform:none;}
  .ict-coach,.ict-libre{left:56px;right:auto;bottom:48px;width:420px;}
  .ict-card h1{font-size:clamp(48px,5.4vw,80px);}
  .ict-par{grid-template-columns:1.25fr 1fr;gap:72px;}
  .ict-par-inv{grid-template-columns:1fr 1.1fr;}
  .ict-estudio{grid-template-columns:1.7fr 1fr;gap:96px;}
  .ict-cuatro{grid-template-columns:repeat(4,1fr);}
  .ict-obras{grid-template-columns:repeat(6,1fr);}
  .ict-obras figure{grid-column:span 2;}
  .ict-obras figure.grande{grid-column:span 3;}
  .ict-obras figure.grande img{aspect-ratio:16/11;}
  .ict-equipo{grid-template-columns:repeat(7,1fr);}
  .ict-reunion{grid-template-columns:1fr 1.25fr;gap:96px;}
  .ict-galeria{grid-template-columns:repeat(3,1fr);}
  .ict-galeria figure:last-child{grid-column:auto;}
  .ict-galeria figure:last-child img{aspect-ratio:4/3;}
  .ict-galeria figure.grande img{aspect-ratio:21/9;}
  .ict-xbar{padding:20px 56px;}
  .ict-footer{padding:32px 56px;}
}
@media (prefers-reduced-motion:reduce){
  .ict-rev,.ict-card{transition:none;opacity:1;transform:none;}
  .ict-poster,.ict-ficha,.ict-hecho{transition:none;animation:none;}
}
`
