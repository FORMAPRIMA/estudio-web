'use client'

import { useMemo } from 'react'
import type { QuinielaData } from '@/app/actions/quiniela'
import type { QuinielaPartido } from '@/lib/quiniela/config'
import { Q, labelStyle, pixelStyle, cardStyle } from '@/components/team/quiniela/theme'

const PALETA = [
  '#ffd23f', '#36f59a', '#34e3ff', '#9d7bff', '#ff9b5b', '#ff5b76',
  '#ff4d9d', '#5fa8ff', '#62e0b0', '#d98bff', '#5b7fa6', '#b0892f',
]

interface Premio {
  emoji: string
  titulo: string
  descripcion: string
  ganadores: string
  valor: string
}

export default function QuinielaStats({ data, nombresById, miJugadorId }: {
  data: QuinielaData
  nombresById: Map<string, string>
  miJugadorId: string | null
}) {
  const stats = useMemo(() => calcular(data), [data])

  return (
    <div style={{ animation: 'q-slideUp .35s ease both' }}>
      {/* ── Premios secundarios ── */}
      <div style={{ ...pixelStyle, fontSize: 10, color: Q.pink, margin: '4px 2px 5px' }}>🏅 PREMIOS HONORÍFICOS</div>
      <p style={{ fontSize: 11, color: Q.textMid, margin: '0 2px 14px' }}>
        Solo gloria y vergüenza. Se actualizan con cada partido cerrado.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 28 }}>
        {stats.premios.map(p => (
          <div key={p.titulo} style={{ display: 'flex', alignItems: 'center', gap: 12, ...cardStyle, padding: '11px 13px' }}>
            <span style={{ fontSize: 26, flex: 'none' }}>{p.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ ...labelStyle, fontSize: 10, color: Q.cyan }}>{p.titulo}</span>
              <p style={{ fontSize: 11, color: Q.textMid, marginTop: 3, lineHeight: 1.4 }}>{p.descripcion}</p>
            </div>
            <div style={{ textAlign: 'right', flex: 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: Q.text }}>{p.ganadores || '—'}</div>
              {p.valor && <div style={{ fontSize: 9, color: Q.gold, marginTop: 2 }}>{p.valor}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Evolución del puntaje (curvas) ── */}
      <div style={{ ...cardStyle, padding: 14, background: 'linear-gradient(160deg,#0f1838,#101733)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ ...labelStyle, fontSize: 10, color: Q.green }}>📈 EVOLUCIÓN DEL PUNTAJE</span>
        </div>
        <p style={{ fontSize: 10, color: Q.textMid, marginBottom: 10 }}>
          Puntos acumulados de cada jugador, jornada a jornada.
        </p>
        {stats.dias.length < 2 ? (
          <p style={{ fontSize: 12, color: Q.textDim }}>
            La gráfica aparece cuando haya al menos dos jornadas con partidos cerrados. Paciencia, que esto dura un mes. 🍿
          </p>
        ) : (
          <GraficaPuntos dias={stats.dias} puntosSeries={stats.puntosSeries} maxPuntos={stats.maxPuntos} nombresById={nombresById} miJugadorId={miJugadorId} />
        )}
      </div>

      {/* ── Carrera de puestos (posiciones) ── */}
      <div style={{ ...cardStyle, padding: 14, background: 'linear-gradient(160deg,#0f1838,#101733)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ ...labelStyle, fontSize: 10, color: Q.cyan }}>🏁 CARRERA DE PUESTOS</span>
        </div>
        <p style={{ fontSize: 10, color: Q.textMid, marginBottom: 10 }}>
          Posición en la tabla por jornada (solo puntos de partidos).
        </p>
        {stats.dias.length < 2 ? (
          <p style={{ fontSize: 12, color: Q.textDim }}>
            La gráfica aparece cuando haya al menos dos jornadas con partidos cerrados. Paciencia, que esto dura un mes. 🍿
          </p>
        ) : (
          <Grafica dias={stats.dias} series={stats.series} nombresById={nombresById} miJugadorId={miJugadorId} />
        )}
      </div>
    </div>
  )
}

// ── Gráfica de curvas: puntos acumulados por jugador ────────────────────────────

/** Catmull-Rom → Bézier para curvas suaves a través de los puntos. */
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
  const d = [`M ${pts[0][0]} ${pts[0][1]}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0]} ${p2[1]}`)
  }
  return d.join(' ')
}

function GraficaPuntos({ dias, puntosSeries, maxPuntos, nombresById, miJugadorId }: {
  dias: string[]
  puntosSeries: Map<string, number[]>
  maxPuntos: number
  nombresById: Map<string, string>
  miJugadorId: string | null
}) {
  const jugadores = Array.from(puntosSeries.keys())
  const W = 320, H = 200, PAD_L = 28, PAD_R = 12, PAD_T = 12, PAD_B = 28
  const techo = Math.max(maxPuntos, 1)
  const x = (i: number) => PAD_L + (dias.length === 1 ? 0 : (i * (W - PAD_L - PAD_R)) / (dias.length - 1))
  const y = (v: number) => PAD_T + (1 - v / techo) * (H - PAD_T - PAD_B)

  // Líneas de cuadrícula horizontales (5 niveles)
  const niveles = Array.from({ length: 5 }, (_, i) => Math.round((techo * i) / 4))

  // Orden por puntaje final (para leyenda y resaltado de cabeza)
  const ranking = jugadores
    .map(id => ({ id, total: puntosSeries.get(id)!.slice(-1)[0] ?? 0 }))
    .sort((a, b) => b.total - a.total)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <filter id="q-pglow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Cuadrícula + eje Y */}
        {niveles.map((nivel, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={y(nivel)} x2={W - PAD_R} y2={y(nivel)} stroke="rgba(255,255,255,.06)" strokeWidth={1} />
            <text x={PAD_L - 6} y={y(nivel) + 3} textAnchor="end" fontSize={8} fill={Q.textDim}>{nivel}</text>
          </g>
        ))}
        {/* Etiquetas de jornada (máx ~6 para no saturar) */}
        {dias.map((dia, i) => {
          const paso = Math.ceil(dias.length / 6)
          if (i % paso !== 0 && i !== dias.length - 1) return null
          return <text key={dia + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={8} fill={Q.textDim}>{dia}</text>
        })}

        {/* Curvas por jugador */}
        {jugadores.map((id, idx) => {
          const vals = puntosSeries.get(id)!
          const color = PALETA[idx % PALETA.length]
          const esYo = id === miJugadorId
          const pts: [number, number][] = vals.map((v, i) => [x(i), y(v)])
          return (
            <g key={id} opacity={esYo ? 1 : 0.7}>
              <path
                d={smoothPath(pts)}
                fill="none"
                stroke={color}
                strokeWidth={esYo ? 3 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={esYo ? 'url(#q-pglow)' : undefined}
              />
              {/* Punto final destacado */}
              {pts.length > 0 && (
                <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={esYo ? 4 : 2.8} fill={color} filter="url(#q-pglow)" />
              )}
            </g>
          )
        })}
      </svg>

      {/* Leyenda con puntaje actual, ordenada */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {ranking.map(({ id, total }) => {
          const idx = jugadores.indexOf(id)
          const esYo = id === miJugadorId
          return (
            <span key={id} style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: Q.text,
              background: esYo ? 'rgba(54,245,154,.12)' : 'rgba(255,255,255,.05)',
              border: `1px solid ${esYo ? 'rgba(54,245,154,.35)' : 'rgba(255,255,255,.1)'}`,
              borderRadius: 999, padding: '3px 9px',
            }}>
              <b style={{ color: PALETA[idx % PALETA.length] }}>●</b>
              {nombresById.get(id) || '—'}{esYo ? ' (tú)' : ''} · {total}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Cálculos ──────────────────────────────────────────────────────────────────

function calcular(data: QuinielaData) {
  const finalizados = data.partidos
    .filter(p => p.estado === 'finalizado')
    .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
  const predsPorPartido = new Map<string, typeof data.prediccionesReveladas>()
  for (const pred of data.prediccionesReveladas) {
    if (!predsPorPartido.has(pred.partido_id)) predsPorPartido.set(pred.partido_id, [])
    predsPorPartido.get(pred.partido_id)!.push(pred)
  }
  const nombre = (id: string) => data.jugadores.find(j => j.id === id)?.nombre || '—'

  // Medias de goles (mín. 3 predicciones para optar)
  const golesPorJugador = new Map<string, { total: number; n: number }>()
  for (const pred of data.prediccionesReveladas) {
    const g = golesPorJugador.get(pred.jugador_id) || { total: 0, n: 0 }
    g.total += pred.goles_local + pred.goles_visitante
    g.n++
    golesPorJugador.set(pred.jugador_id, g)
  }
  const medias = Array.from(golesPorJugador.entries())
    .filter(([, g]) => g.n >= 3)
    .map(([id, g]) => ({ id, media: g.total / g.n }))

  // Racha más larga de partidos seguidos puntuando
  const rachas = new Map<string, { actual: number; max: number }>()
  for (const partido of finalizados) {
    const preds = predsPorPartido.get(partido.id) || []
    for (const j of data.jugadores) {
      const r = rachas.get(j.id) || { actual: 0, max: 0 }
      const pred = preds.find(p => p.jugador_id === j.id)
      if (pred && (pred.puntos ?? 0) > 0) {
        r.actual++
        r.max = Math.max(r.max, r.actual)
      } else {
        r.actual = 0
      }
      rachas.set(j.id, r)
    }
  }

  function topDe<T>(items: T[], valor: (item: T) => number): T[] {
    const max = Math.max(...items.map(valor))
    return items.filter(i => valor(i) === max && max > 0)
  }
  const nombres = (ids: string[]) => ids.slice(0, 3).map(nombre).join(' · ')

  const premios: Premio[] = []
  const lb = data.leaderboard

  if (lb.some(r => r.exactos > 0)) {
    const top = topDe(lb, r => r.exactos)
    premios.push({
      emoji: '🎯', titulo: 'El francotirador',
      descripcion: 'Más marcadores exactos clavados.',
      ganadores: nombres(top.map(r => r.jugador_id)),
      valor: `${top[0].exactos} exactos`,
    })
  }
  const rachasArr = Array.from(rachas.entries()).map(([id, r]) => ({ id, max: r.max }))
  if (rachasArr.some(r => r.max >= 2)) {
    const top = topDe(rachasArr, r => r.max)
    premios.push({
      emoji: '🔥', titulo: 'En racha',
      descripcion: 'Más partidos seguidos puntuando.',
      ganadores: nombres(top.map(r => r.id)),
      valor: `${top[0].max} seguidos`,
    })
  }
  if (medias.length > 0) {
    const optimista = medias.reduce((a, b) => (b.media > a.media ? b : a))
    const cerrojo = medias.reduce((a, b) => (b.media < a.media ? b : a))
    premios.push({
      emoji: '🎉', titulo: 'El optimista',
      descripcion: 'Media de goles más alta en sus predicciones.',
      ganadores: nombre(optimista.id),
      valor: `${optimista.media.toFixed(1)} goles/partido`,
    })
    if (cerrojo.id !== optimista.id) {
      premios.push({
        emoji: '🧱', titulo: 'El cerrojo',
        descripcion: 'Media de goles más baja. Cree en el 0-0.',
        ganadores: nombre(cerrojo.id),
        valor: `${cerrojo.media.toFixed(1)} goles/partido`,
      })
    }
  }
  if (lb.length >= 4 && lb.some(r => r.total > 0)) {
    premios.push({
      emoji: '🥄', titulo: 'La cuchara de palo',
      descripcion: 'Farolillo rojo de la clasificación. Alguien tiene que serlo.',
      ganadores: lb[lb.length - 1].nombre,
      valor: `${lb[lb.length - 1].total} pts`,
    })
  }
  if (premios.length === 0) {
    premios.push({
      emoji: '⏳', titulo: 'Próximamente',
      descripcion: 'Los premios se desbloquean en cuanto se cierren los primeros partidos.',
      ganadores: '', valor: '',
    })
  }

  // ── Serie de posiciones por jornada (solo puntos de partidos) ──
  const porDia = new Map<string, QuinielaPartido[]>()
  for (const p of finalizados) {
    const dia = new Date(p.fecha_hora).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short', timeZone: 'Europe/Madrid',
    })
    if (!porDia.has(dia)) porDia.set(dia, [])
    porDia.get(dia)!.push(p)
  }
  const dias = Array.from(porDia.keys())
  const acumulado = new Map<string, number>(data.jugadores.map(j => [j.id, 0]))
  const series = new Map<string, number[]>(data.jugadores.map(j => [j.id, []]))
  // Serie de PUNTOS acumulados (valores reales, no posiciones) para la gráfica de curvas
  const puntosSeries = new Map<string, number[]>(data.jugadores.map(j => [j.id, []]))
  let maxPuntos = 0
  for (const dia of dias) {
    for (const partido of porDia.get(dia)!) {
      for (const pred of predsPorPartido.get(partido.id) || []) {
        acumulado.set(pred.jugador_id, (acumulado.get(pred.jugador_id) || 0) + (pred.puntos ?? 0))
      }
    }
    const orden = data.jugadores
      .slice()
      .sort((a, b) => (acumulado.get(b.id)! - acumulado.get(a.id)!) || a.nombre.localeCompare(b.nombre))
    orden.forEach((j, i) => series.get(j.id)!.push(i + 1))
    for (const j of data.jugadores) {
      const v = acumulado.get(j.id) || 0
      puntosSeries.get(j.id)!.push(v)
      if (v > maxPuntos) maxPuntos = v
    }
  }

  return { premios, dias, series, puntosSeries, maxPuntos }
}

// ── Gráfica SVG de posiciones ─────────────────────────────────────────────────

function Grafica({ dias, series, nombresById, miJugadorId }: {
  dias: string[]
  series: Map<string, number[]>
  nombresById: Map<string, string>
  miJugadorId: string | null
}) {
  const jugadores = Array.from(series.keys())
  const n = jugadores.length
  const W = 720, H = 60 + n * 24, PAD_X = 40, PAD_Y = 24
  const x = (i: number) => PAD_X + (dias.length === 1 ? 0 : (i * (W - 2 * PAD_X)) / (dias.length - 1))
  const y = (pos: number) => PAD_Y + ((pos - 1) * (H - 2 * PAD_Y)) / Math.max(n - 1, 1)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* Líneas de posición de fondo */}
        {Array.from({ length: n }, (_, i) => (
          <g key={i}>
            <line x1={PAD_X} y1={y(i + 1)} x2={W - PAD_X} y2={y(i + 1)} stroke="rgba(255,255,255,.06)" strokeWidth={1} />
            <text x={PAD_X - 8} y={y(i + 1) + 3} textAnchor="end" fontSize={10} fill={Q.textDim}>{i + 1}º</text>
          </g>
        ))}
        {/* Etiquetas de jornada */}
        {dias.map((dia, i) => (
          <text key={dia} x={x(i)} y={H - 4} textAnchor="middle" fontSize={9} fill={Q.textDim}>{dia}</text>
        ))}
        {/* Series */}
        {jugadores.map((id, idx) => {
          const posiciones = series.get(id)!
          const color = PALETA[idx % PALETA.length]
          const esYo = id === miJugadorId
          return (
            <g key={id}>
              <polyline
                points={posiciones.map((pos, i) => `${x(i)},${y(pos)}`).join(' ')}
                fill="none" stroke={color}
                strokeWidth={esYo ? 3 : 1.5}
                opacity={esYo ? 1 : 0.65}
              />
              {posiciones.map((pos, i) => (
                <circle key={i} cx={x(i)} cy={y(pos)} r={esYo ? 4 : 2.5} fill={color} />
              ))}
            </g>
          )
        })}
      </svg>
      {/* Leyenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        {jugadores.map((id, idx) => (
          <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: Q.textSoft, fontWeight: id === miJugadorId ? 700 : 400 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: PALETA[idx % PALETA.length], display: 'inline-block' }} />
            {nombresById.get(id) || '—'}
          </span>
        ))}
      </div>
      <p style={{ fontSize: 10, color: Q.textDim, marginTop: 10 }}>
        Posiciones según puntos de partidos acumulados al cierre de cada jornada (la escalera y el pichichi se suman al final).
      </p>
    </div>
  )
}
