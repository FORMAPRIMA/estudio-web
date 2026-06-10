'use client'

import type { PropuestaVMServicio } from '@/lib/propuestas/build'

// Orden cronológico de las fases en el Gantt. Solo se pintan las que están en la
// propuesta (vm.servicios), así el cronograma es consciente del alcance ofertado.
const ORDER = ['anteproyecto', 'proyecto_ejecucion', 'interiorismo', 'direccion_obra', 'gestion_interiorismo'] as const

const META: Record<string, { label: string; color: string }> = {
  anteproyecto:         { label: 'Anteproyecto',            color: '#D85A30' },
  proyecto_ejecucion:   { label: 'Proyecto de ejecución',   color: '#C0572C' },
  interiorismo:         { label: 'Interiorismo',            color: '#B08D57' },
  direccion_obra:       { label: 'Ejecución de obra',       color: '#6B7280' },
  gestion_interiorismo: { label: 'Gestión de interiorismo', color: '#8A8170' },
}

// Extrae días hábiles de un texto de plazo. "12 días hábiles" → 12; "6–8 semanas"
// → media×5; sin número (p.ej. "Según programa de obra") → null (fase abierta).
function parseDias(s?: string): number | null {
  if (!s) return null
  const nums = s.match(/\d+(?:[.,]\d+)?/g)?.map(n => parseFloat(n.replace(',', '.'))) ?? []
  if (nums.length === 0) return null
  const v = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0]
  const lc = s.toLowerCase()
  if (lc.includes('semana') || lc.includes('week')) return Math.round(v * 5)
  if (lc.includes('mes') || lc.includes('month')) return Math.round(v * 21)
  return Math.round(v)
}

interface Bar {
  id: string
  label: string
  color: string
  start: number
  span: number
  open: boolean
  durLabel: string
}

export default function PropuestaCronograma({ servicios }: { servicios: PropuestaVMServicio[] }) {
  const byId = new Map(servicios.map(s => [s.id, s]))
  const present: string[] = ORDER.filter(id => byId.has(id))
  if (present.length === 0) return null

  const diasOf = (id: string) => parseDias(byId.get(id)?.semanas)
  const SMALL = 10 // ancho mínimo para una fase sin número

  const has = (id: string) => present.includes(id)
  const placed: Record<string, Bar> = {}
  const add = (id: string, start: number, span: number, open: boolean, durLabel: string) => {
    placed[id] = { id, label: META[id].label, color: META[id].color, start, span: Math.max(span, 6), open, durLabel }
  }

  // 1) Fases de diseño previas a obra, secuenciales: anteproyecto → proyecto de ejecución.
  let cursor = 0
  for (const id of ['anteproyecto', 'proyecto_ejecucion']) {
    if (!has(id)) continue
    const d = diasOf(id)
    const defined = !!(d && d > 0)
    const span = defined ? (d as number) : SMALL
    add(id, cursor, span, !defined, defined ? `≈ ${d} días háb.` : 'Por definir')
    cursor += span
  }
  const designEnd = cursor

  // 2) Obra: barra abierta (duración sin definir) que arranca tras el diseño.
  const interiDias = has('interiorismo') ? diasOf('interiorismo') : null
  const interiDefined = !!(interiDias && interiDias > 0)
  // La obra debe ser lo bastante larga para contener el solape de interiorismo + la cola de gestión.
  const nominalObra = Math.max(Math.round(designEnd * 0.8), Math.round((interiDias ?? 0) * 1.4), 30)
  const obraStart = designEnd
  const obraEnd = obraStart + nominalObra
  if (has('direccion_obra')) {
    add('direccion_obra', obraStart, nominalObra, true, 'Según proyecto de obra')
  }

  // 3) Interiorismo: SOLAPA la obra (arranca con la obra y corre su duración estimada).
  //    Si no hay obra, va secuencial tras el diseño.
  if (has('interiorismo')) {
    const span = interiDefined ? (interiDias as number) : SMALL
    if (has('direccion_obra')) {
      add('interiorismo', obraStart, span, !interiDefined, interiDefined ? `≈ ${interiDias} días háb.` : 'Por definir')
    } else {
      add('interiorismo', designEnd, span, !interiDefined, interiDefined ? `≈ ${interiDias} días háb.` : 'Por definir')
    }
  }

  // 4) Gestión de interiorismo: su FINAL coincide con el final de la obra (cola de obra).
  //    Sin obra, termina con el interiorismo.
  if (has('gestion_interiorismo')) {
    const interiEnd = placed['interiorismo'] ? placed['interiorismo'].start + placed['interiorismo'].span : designEnd
    const endRef = has('direccion_obra') ? obraEnd : interiEnd
    const startRef = has('direccion_obra') ? obraStart : designEnd
    const gestSpan = Math.max(Math.round((endRef - startRef) * 0.45), SMALL)
    add('gestion_interiorismo', Math.max(endRef - gestSpan, 0), gestSpan, true, 'Hasta fin de obra')
  }

  const bars: Bar[] = ORDER.filter(id => placed[id]).map(id => placed[id])
  const definedDias = ['anteproyecto', 'proyecto_ejecucion'].reduce((s, id) => s + (has(id) ? (diasOf(id) ?? 0) : 0), 0)
  const total = Math.max(...bars.map(b => b.start + b.span), 1)

  return (
    <section style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(40px, 6vw, 64px) 24px 0' }}>
      <span className="fp-section-label">Cronograma estimado</span>
      <div className="fp-card" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {bars.map(b => (
            <div key={b.id} className="fp-gantt-row">
              <div className="fp-gantt-label">
                <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>{b.label}</span>
                <span style={{ fontSize: 11, color: b.open ? '#A0968A' : '#888' }}>{b.durLabel}</span>
              </div>
              <div className="fp-gantt-track">
                <div
                  className={b.open ? 'fp-gantt-bar fp-gantt-bar-open' : 'fp-gantt-bar'}
                  style={{
                    left: `${(b.start / total) * 100}%`,
                    width: `${(b.span / total) * 100}%`,
                    ...(b.open
                      ? { ['--bar-color' as string]: b.color }
                      : { background: `linear-gradient(90deg, ${b.color}, ${b.color}D9)` }),
                  } as React.CSSProperties}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 14, borderTop: '1px solid #F0EEE8', flexWrap: 'wrap', gap: 8 }}>
          {definedDias > 0 && (
            <span style={{ fontSize: 12, color: '#555' }}>
              Hasta inicio de obra: <strong style={{ color: '#1A1A1A' }}>≈ {definedDias} días hábiles</strong>
            </span>
          )}
          <span style={{ fontSize: 11, color: '#AAA' }}>
            Cronograma orientativo · los plazos de obra se concretan al cerrar el proyecto de ejecución.
          </span>
        </div>
      </div>
    </section>
  )
}
