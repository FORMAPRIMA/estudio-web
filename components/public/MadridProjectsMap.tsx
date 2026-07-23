'use client'

import { useEffect, useMemo, useState } from 'react'

// ── Proyectos de Madrid ─────────────────────────────────────────────────────
// `x`,`y` son porcentajes (0-100) sobre el mapa base (cuadrado). Calibrados sobre
// el mapa real con el modo calibración (?calibrar=1).
export interface MapMarker { n: number; name: string; x: number; y: number }

const MARKERS: MapMarker[] = [
  { n: 1,  name: 'General Oraá 54',      x: 60.4, y: 14.6 },
  { n: 2,  name: 'Narváez 7',            x: 68,   y: 45.3 },
  { n: 3,  name: 'Larra 16',             x: 21.8, y: 33.5 },
  { n: 4,  name: 'Almagro 44',           x: 39.3, y: 23.5 },
  { n: 5,  name: 'Huertas 25',           x: 24.9, y: 68.4 },
  { n: 6,  name: 'Columela 6',           x: 45.7, y: 50.5 },
  { n: 7,  name: 'Castelló 98',          x: 58.8, y: 18.5 },
  { n: 8,  name: 'Columela 3',           x: 48.6, y: 48.8 },
  { n: 9,  name: 'General Pardiñas 31',  x: 62.9, y: 37.1 },
  { n: 10, name: "O'Donnell 35",         x: 67.1, y: 49.1 },
  { n: 11, name: 'Lagasca 127',          x: 50.3, y: 13.9 },
  { n: 12, name: 'Lope de Rueda 46',     x: 64.8, y: 47.8 },
  { n: 13, name: 'Lope de Rueda 4',      x: 64.9, y: 44.1 },
  { n: 14, name: 'Villanueva 4',         x: 42.7, y: 46.7 },
  { n: 15, name: 'Doctor Castelo 15',    x: 64.1, y: 52   },
  { n: 16, name: 'Claudio Coello 116',   x: 50.1, y: 16.5 },
  { n: 17, name: 'Lagasca 94',           x: 49.7, y: 26.1 },
  { n: 18, name: 'Montalbán 10',         x: 41.3, y: 61.9 },
  { n: 19, name: 'Claudio Coello 38',    x: 48.4, y: 39.5 },
  { n: 20, name: 'Francisco Vitoria 4',  x: 70.5, y: 80.9 },
  { n: 21, name: 'Conde de Peñalver 31', x: 68.1, y: 33.7 },
  { n: 22, name: 'Ríos Rosas 52',        x: 30.9, y: 1.2  },
  { n: 23, name: 'García Paredes 78',    x: 34.6, y: 13   },
  { n: 24, name: 'Ferraz 36',            x: 0.8,  y: 64.8 },
  { n: 25, name: 'Fuente del Berro 12',  x: 76.4, y: 38   },
  { n: 26, name: 'Serrano 84',           x: 47.8, y: 23.8 },
  { n: 27, name: 'Lope de Hoyos 7',      x: 47,   y: 11.7 },
]

const MAP_SRC = '/wip/mapa-madrid.png'
const BG = '#f4f3f0'
const INK = '#1a1a1a'

// Edge fade: difumina el 8% exterior de cada lado (solo desktop) para que el
// mapa se disuelva en el fondo en vez de cortarse en un borde recto.
const FADE_MASK =
  'linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%), ' +
  'linear-gradient(to bottom, transparent 0, #000 8%, #000 92%, transparent 100%)'

export default function MadridProjectsMap({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [active, setActive] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  // Modo calibración: coloca los puntos clicando en orden. Solo con ?calibrar=1.
  const [calibrate, setCalibrate] = useState(false)
  const [placed, setPlaced] = useState<MapMarker[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setCalibrate(params.get('calibrar') === '1')
    const mq = window.matchMedia('(max-width: 780px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Esc para cerrar
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Al abrir, arranca sin selección; oculta el cursor personalizado de la landing.
  useEffect(() => {
    if (!open) { setActive(null); return }
    const c = document.getElementById('fp-cursor')
    if (!c) return
    const prev = c.style.display
    c.style.display = 'none'
    return () => { c.style.display = prev }
  }, [open])

  const markers = calibrate ? placed : MARKERS

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!calibrate) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10
    const next = MARKERS[placed.length]
    if (!next) return
    setPlaced(prev => [...prev, { ...next, x, y }])
  }

  const arrayText = useMemo(
    () =>
      placed
        .map(m => `  { n: ${m.n}, name: ${JSON.stringify(m.name)}, x: ${m.x}, y: ${m.y} },`)
        .join('\n'),
    [placed],
  )

  // Enfatiza/quita foco: en móvil sólo por tap; en desktop, hover.
  const setActiveHover = (n: number | null) => { if (!isMobile) setActive(n) }

  // ── Marcador ───────────────────────────────────────────────────────────────
  const renderPin = (m: MapMarker) => {
    const on = active === m.n
    const size = isMobile ? 22 : 26
    const labelBelow = m.y < 15
    return (
      <div
        key={m.n}
        className="fp-mm-pin"
        onMouseEnter={() => setActiveHover(m.n)}
        onMouseLeave={() => setActiveHover(null)}
        onClick={(e) => { if (!calibrate) { e.stopPropagation(); setActive(on ? null : m.n) } }}
        style={{
          position: 'absolute', left: `${m.x}%`, top: `${m.y}%`,
          transform: `translate(-50%,-50%) scale(${on ? 1.16 : 1})`,
          zIndex: on ? 30 : 5,
        }}
      >
        <span
          style={{
            position: 'absolute', left: '50%',
            ...(labelBelow
              ? { top: 'calc(100% + 9px)', transform: `translateX(-50%) translateY(${on ? 0 : -4}px)` }
              : { bottom: 'calc(100% + 9px)', transform: `translateX(-50%) translateY(${on ? 0 : 4}px)` }),
            whiteSpace: 'nowrap',
            fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
            color: INK,
            background: 'rgba(248,247,244,.94)',
            padding: '5px 9px', borderRadius: 3,
            boxShadow: '0 6px 20px -8px rgba(0,0,0,.4)',
            opacity: on ? 1 : 0,
            pointerEvents: 'none',
            transition: 'opacity .25s ease, transform .25s ease',
          }}
        >
          {m.name}
        </span>
        <span
          className="fp-mm-dot"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: size, height: size, borderRadius: '50%',
            fontSize: isMobile ? 9 : 10, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
            cursor: 'pointer',
            border: `1px solid ${on ? INK : 'rgba(26,26,26,.4)'}`,
            background: on ? INK : 'rgba(255,255,255,.78)',
            color: on ? '#fff' : 'rgba(26,26,26,.72)',
            boxShadow: on ? '0 8px 22px -8px rgba(0,0,0,.55)' : '0 2px 8px -4px rgba(0,0,0,.3)',
            backdropFilter: 'blur(2px)',
          }}
        >
          {m.n}
        </span>
      </div>
    )
  }

  // ── Fila de la lista ────────────────────────────────────────────────────────
  const renderRow = (m: MapMarker) => {
    const on = active === m.n
    return (
      <li key={m.n} style={{ breakInside: 'avoid' }}>
        <button
          className="fp-mm-row"
          onMouseEnter={() => setActiveHover(m.n)}
          onMouseLeave={() => setActiveHover(null)}
          onClick={() => setActive(on ? null : m.n)}
          style={{
            display: 'flex', alignItems: 'baseline', gap: 10, width: '100%',
            background: 'none', border: 'none', padding: isMobile ? '6px 0' : '3px 0',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            color: INK, opacity: on ? 1 : 0.44,
            fontSize: isMobile ? 12.5 : 12, letterSpacing: '.02em', fontWeight: on ? 600 : 400,
            textShadow: isMobile ? 'none' : '0 1px 6px rgba(244,243,240,.9)',
          }}
        >
          <span style={{ fontVariantNumeric: 'tabular-nums', width: 18, flex: 'none', opacity: .6, fontSize: 10 }}>
            {m.n}
          </span>
          <span style={{ whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{m.name}</span>
        </button>
      </li>
    )
  }

  return (
    <div
      aria-hidden={!open}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: BG,
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity .5s cubic-bezier(.4,0,.2,1)',
        fontFamily: 'var(--font-hanken), -apple-system, sans-serif',
        color: INK,
        overflow: 'hidden',
      }}
    >
      <style>{`
        .fp-mm-pin{ transition: transform .35s cubic-bezier(.2,.8,.2,1); }
        .fp-mm-dot{ transition: background .3s ease, color .3s ease, border-color .3s ease, box-shadow .3s ease; }
        .fp-mm-row{ transition: color .3s ease, opacity .3s ease; }
        .fp-mm-list::-webkit-scrollbar{ width:0; height:0; }
      `}</style>

      {/* Cerrar */}
      <button
        onClick={onClose}
        aria-label="Cerrar mapa"
        style={{
          position: 'absolute', top: 'clamp(18px,2.6vh,32px)', right: 'clamp(18px,3.2vw,42px)',
          zIndex: 40, display: 'flex', alignItems: 'center', gap: 8,
          background: isMobile ? 'rgba(255,255,255,.7)' : 'none',
          backdropFilter: isMobile ? 'blur(4px)' : undefined,
          border: 'none', borderRadius: 20, padding: isMobile ? '7px 13px' : 8, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 12, fontWeight: 500, letterSpacing: '.2em',
          textTransform: 'uppercase', color: INK, opacity: .8,
        }}
      >
        <span>Cerrar</span><span style={{ fontSize: 15, lineHeight: 1 }}>✕</span>
      </button>

      {isMobile ? (
        /* ═══ MÓVIL: mapa arriba, lista abajo ═══════════════════════════════ */
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Mapa */}
          <div style={{ flex: '0 0 54%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* título flotante */}
            <div style={{ position: 'absolute', top: 16, left: 20, zIndex: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14 }}>◍</span>
                <h2 style={{ margin: 0, fontSize: 26, fontWeight: 500, letterSpacing: '-.02em', lineHeight: 1 }}>Madrid</h2>
              </div>
              <p style={{ margin: '4px 0 0 21px', fontSize: 9, fontWeight: 500, letterSpacing: '.26em', textTransform: 'uppercase', opacity: .45 }}>
                {MARKERS.length} proyectos
              </p>
            </div>
            <div
              onClick={handleStageClick}
              style={{ position: 'relative', width: 'min(94vw, 48vh)', height: 'min(94vw, 48vh)', cursor: calibrate ? 'crosshair' : 'default' }}
            >
              {open && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={MAP_SRC} alt="Mapa de proyectos de Forma Prima en Madrid" draggable={false}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }} />
              )}
              {markers.map(renderPin)}
            </div>
          </div>
          {/* Lista */}
          <div style={{ flex: 1, minHeight: 0, borderTop: '1px solid rgba(26,26,26,.1)', background: '#faf9f6', padding: '16px 20px 20px', overflowY: 'auto' }}>
            <p style={{ margin: '0 0 12px', fontSize: 9, fontWeight: 500, letterSpacing: '.26em', textTransform: 'uppercase', opacity: .4 }}>
              Toca un proyecto para localizarlo
            </p>
            <ol className="fp-mm-list" style={{ listStyle: 'none', margin: 0, padding: 0, columns: 2, columnGap: 18 }}>
              {MARKERS.map(renderRow)}
            </ol>
          </div>
        </div>
      ) : (
        /* ═══ DESKTOP: mapa a pantalla completa + lista flotante ════════════ */
        <>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              onClick={handleStageClick}
              style={{ position: 'relative', width: 'min(100vh, 100vw)', height: 'min(100vh, 100vw)', cursor: calibrate ? 'crosshair' : 'default' }}
            >
              {open && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={MAP_SRC} alt="Mapa de proyectos de Forma Prima en Madrid" draggable={false}
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none',
                    WebkitMaskImage: FADE_MASK, maskImage: FADE_MASK,
                    WebkitMaskComposite: 'source-in', maskComposite: 'intersect',
                  }} />
              )}
              {markers.map(renderPin)}
            </div>
          </div>

          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 10,
            width: 'clamp(250px,32vw,400px)',
            padding: 'clamp(26px,4vh,54px) clamp(24px,3vw,46px)',
            display: 'flex', flexDirection: 'column', gap: 'clamp(16px,2.4vh,26px)',
            pointerEvents: 'none',
            background: `linear-gradient(to right, ${BG} 0%, rgba(244,243,240,.82) 46%, rgba(244,243,240,0) 100%)`,
          }}>
            <header>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>◍</span>
                <h2 style={{ margin: 0, fontSize: 'clamp(26px,3.4vw,40px)', fontWeight: 500, letterSpacing: '-.02em', lineHeight: 1 }}>Madrid</h2>
              </div>
              <p style={{ margin: '6px 0 0 24px', fontSize: 10, fontWeight: 500, letterSpacing: '.28em', textTransform: 'uppercase', opacity: .45 }}>
                {MARKERS.length} proyectos
              </p>
            </header>
            <ol className="fp-mm-list" style={{ listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto', pointerEvents: 'auto' }}>
              {MARKERS.map(renderRow)}
            </ol>
          </div>
        </>
      )}

      {/* ── Panel de calibración (solo ?calibrar=1) ───────────────────────── */}
      {calibrate && (
        <div style={{
          position: 'absolute', bottom: 16, right: 16, width: 300, zIndex: 50,
          background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: 14,
          boxShadow: '0 20px 60px -20px rgba(0,0,0,.4)', fontSize: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ letterSpacing: '.04em' }}>Calibrar · {placed.length}/{MARKERS.length}</strong>
            <button onClick={() => setPlaced([])} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
              Reiniciar
            </button>
          </div>
          <p style={{ margin: '0 0 8px', color: '#666', lineHeight: 1.4 }}>
            {placed.length < MARKERS.length
              ? `Clica: ${MARKERS[placed.length].n}. ${MARKERS[placed.length].name}`
              : '¡Completo! Copia el array y pásamelo.'}
          </p>
          <textarea
            readOnly
            value={arrayText}
            onFocus={e => e.currentTarget.select()}
            style={{ width: '100%', height: 110, fontFamily: 'monospace', fontSize: 10, border: '1px solid #eee', borderRadius: 4, padding: 8, resize: 'vertical' }}
          />
        </div>
      )}
    </div>
  )
}
