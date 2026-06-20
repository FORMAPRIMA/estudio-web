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

      {/* ── Evolución de posiciones ── */}
      <div style={{ ...cardStyle, padding: 14, background: 'linear-gradient(160deg,#0f1838,#101733)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ ...labelStyle, fontSize: 10, color: Q.cyan }}>🏁 CARRERA DE PUNTOS</span>
        </div>
        <p style={{ fontSize: 10, color: Q.textMid, marginBottom: 10 }}>
          Posiciones por jornada (solo puntos de partidos).
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
  }

  return { premios, dias, series }
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
