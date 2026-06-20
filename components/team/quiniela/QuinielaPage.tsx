'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  joinQuiniela, upsertPrediccion, upsertPickCampeon, updatePichichi,
  updateResultado, updatePartidoEquipos, updateVentanaActiva, updatePagado,
  updateQuinielaConfig, logoutJugadorExterno,
} from '@/app/actions/quiniela'
import type { QuinielaData } from '@/app/actions/quiniela'
import QuinielaReglas from '@/components/quiniela/QuinielaReglas'
import QuinielaOnboarding from '@/components/quiniela/QuinielaOnboarding'
import QuinielaChat from '@/components/quiniela/QuinielaChat'
import QuinielaStats from '@/components/quiniela/QuinielaStats'
import Confetti, { type ConfettiHandle } from '@/components/team/quiniela/Confetti'
import {
  Q, FONT, QUINIELA_KEYFRAMES, labelStyle, pixelStyle, cardStyle,
  avatarColor, iniciales, posColor, MEDALLAS,
} from '@/components/team/quiniela/theme'
import {
  PUNTOS_PARTIDO, PUNTOS_ESCALERA, PUNTOS_PICHICHI,
  VENTANA_LABELS, VENTANA_FASE_ELEGIBLE, FASE_LABELS, FASES_ORDEN,
  parseReparto, formatFechaPartido, prediccionBloqueada,
  getAperturaDeadlineMs, formatCountdown, BLOQUEO_PREDICCION_MS,
  calcPuntosPrediccion,
} from '@/lib/quiniela/config'
import type {
  QuinielaEquipo, QuinielaPartido, QuinielaFase, VentanaCampeon,
} from '@/lib/quiniela/config'

type Tab = 'home' | 'partidos' | 'clasificacion' | 'escalera' | 'stats' | 'bar' | 'admin'
type SaveState = 'sin_guardar' | 'guardando' | 'guardada' | 'error' | 'vacia'

const VENTANAS: VentanaCampeon[] = ['apertura', 'grupos', 'dieciseisavos', 'octavos', 'cuartos']

/** Reloj compartido: re-renderiza cada 30 s para countdowns y bloqueos en vivo */
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export default function QuinielaPage({
  data, isPartner, esExterno,
}: {
  data: QuinielaData
  isPartner: boolean
  esExterno: boolean
}) {
  const router = useRouter()
  const ahora = useNow()
  const [tab, setTab] = useState<Tab>('home')
  const [isJoining, setIsJoining] = useState(false)
  const [verReglas, setVerReglas] = useState(false)
  const [onboardingCerrado, setOnboardingCerrado] = useState(false)
  const confettiRef = useRef<ConfettiHandle>(null)
  const fireConfetti = (n?: number) => confettiRef.current?.fire(n)

  const miJugadorId = data.miJugadorId
  const deadlineApertura = getAperturaDeadlineMs(data.config, data.partidos)
  const aperturaAbierta = data.config['ventana_activa'] === 'apertura'
    && deadlineApertura !== null && ahora < deadlineApertura
  const miJugador = data.jugadores.find(j => j.id === miJugadorId)
  const pickApertura = data.misPicks.find(p => p.ventana === 'apertura')
  // Modal de picks urgentes: nada más entrar, mientras falte alguno y la ventana siga abierta
  const mostrarOnboarding = !!miJugadorId && aperturaAbierta && !onboardingCerrado
    && (!pickApertura || !miJugador?.pichichi)

  // Refresco suave para que chat y resultados se actualicen solos
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60000)
    return () => clearInterval(id)
  }, [router])

  // Confetti de bienvenida y al ir a clasificación/inicio
  useEffect(() => {
    if (tab === 'home' || tab === 'clasificacion') {
      const t = setTimeout(() => fireConfetti(100), 400)
      return () => clearTimeout(t)
    }
  }, [tab])

  const equiposById = useMemo(
    () => new Map(data.equipos.map(e => [e.id, e])),
    [data.equipos]
  )
  const nombresById = useMemo(
    () => new Map(data.jugadores.map(j => [j.id, j.nombre])),
    [data.jugadores]
  )

  const monto = parseFloat(data.config['monto_entrada'] || '20') || 20
  const reparto = parseReparto(data.config['reparto'])
  const bote = data.jugadores.length * monto
  const miNombre = miJugadorId ? nombresById.get(miJugadorId) : null

  async function handleJoin() {
    setIsJoining(true)
    const result = await joinQuiniela()
    setIsJoining(false)
    if ('success' in result) { fireConfetti(120); router.refresh() }
  }

  async function handleLogout() {
    await logoutJugadorExterno()
    router.refresh()
  }

  const navItems: { key: Tab; label: string; icon: string }[] = [
    { key: 'home', label: 'Inicio', icon: '🏠' },
    { key: 'partidos', label: 'Partidos', icon: '⚽' },
    { key: 'clasificacion', label: 'Tabla', icon: '🏆' },
    { key: 'escalera', label: 'Escalera', icon: '🪜' },
    { key: 'stats', label: 'Stats', icon: '📊' },
    { key: 'bar', label: 'Bar', icon: '💬' },
    ...(isPartner ? [{ key: 'admin' as Tab, label: 'Admin', icon: '🛠️' }] : []),
  ]

  return (
    <div style={{ background: Q.bg, minHeight: '100vh', fontFamily: FONT.body, color: Q.text }}>
      <style>{QUINIELA_KEYFRAMES}</style>
      <div style={{
        position: 'relative', maxWidth: 480, margin: '0 auto', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', background: '#0a0e1c',
        boxShadow: '0 0 80px rgba(0,0,0,.5)',
      }}>
        <Confetti ref={confettiRef} />

        {/* ── Header ── */}
        <div style={{
          position: 'relative', zIndex: 20, padding: '20px 16px 12px',
          background: 'linear-gradient(180deg,#0e1430,#0a0e1c)',
          borderBottom: `1px solid ${Q.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>⚽</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ ...pixelStyle, fontSize: 11, color: Q.green, textShadow: '0 0 12px rgba(54,245,154,.4)' }}>
                  LA PORRA
                </span>
                <span style={{ ...labelStyle, fontSize: 7, color: Q.textDimmer }}>FORMA PRIMA · MUNDIAL 2026</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setVerReglas(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, ...labelStyle, fontSize: 8,
                  color: Q.cyan, background: 'rgba(52,227,255,.1)', border: '1px solid rgba(52,227,255,.3)',
                  borderRadius: 999, padding: '6px 10px', cursor: 'pointer',
                }}
              >
                📖 Reglas
              </button>
              {esExterno && (
                <button
                  onClick={handleLogout}
                  style={{
                    ...labelStyle, fontSize: 8, color: Q.textMid, background: Q.cardHi,
                    border: `1px solid ${Q.borderHi}`, borderRadius: 999, padding: '6px 10px', cursor: 'pointer',
                  }}
                >
                  Salir
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Join banner (solo staff FP que aún no se apuntó) ── */}
        {!data.soyParticipante && !esExterno && (
          <div style={{
            margin: '12px 14px 0', background: 'rgba(54,245,154,.07)',
            border: '1px solid rgba(54,245,154,.3)', borderRadius: 14, padding: '14px 16px',
          }}>
            <p style={{ fontSize: 12, color: Q.textSoft, lineHeight: 1.5, marginBottom: 12 }}>
              Aún no estás dentro. Entrada: <strong style={{ color: Q.gold }}>{monto.toFixed(0)} €</strong> — al
              apuntarte te comprometes a pagarla aunque no rellenes tus predicciones a tiempo.
            </p>
            <button
              onClick={handleJoin}
              disabled={isJoining}
              style={{
                width: '100%', ...pixelStyle, fontSize: 11, color: '#06210f',
                background: 'linear-gradient(180deg,#48ffa6,#23d985)', border: 0, borderRadius: 12,
                padding: '12px', cursor: 'pointer', opacity: isJoining ? 0.6 : 1,
                boxShadow: '0 4px 0 #128a52, 0 0 22px rgba(54,245,154,.4)',
              }}
            >
              {isJoining ? 'ENTRANDO…' : 'APUNTARME ▸'}
            </button>
          </div>
        )}

        {/* ── Contenido scroll ── */}
        <div className="q-scroll" style={{ position: 'relative', zIndex: 10, flex: 1, overflowY: 'auto', padding: '14px 14px 96px' }}>
          {tab === 'home' && (
            <HomeTab data={data} equiposById={equiposById} miJugadorId={miJugadorId} miNombre={miNombre} bote={bote} ahora={ahora} setTab={setTab} />
          )}
          {tab === 'partidos' && (
            <PartidosTab data={data} equiposById={equiposById} nombresById={nombresById} miJugadorId={miJugadorId} ahora={ahora} fireConfetti={fireConfetti} />
          )}
          {tab === 'clasificacion' && (
            <ClasificacionTab data={data} bote={bote} reparto={reparto} miJugadorId={miJugadorId} equiposById={equiposById} />
          )}
          {tab === 'escalera' && (
            <EscaleraTab data={data} equiposById={equiposById} nombresById={nombresById} miJugadorId={miJugadorId} ahora={ahora} onChanged={() => router.refresh()} fireConfetti={fireConfetti} />
          )}
          {tab === 'stats' && (
            <QuinielaStats data={data} nombresById={nombresById} miJugadorId={miJugadorId} />
          )}
          {tab === 'bar' && (
            <QuinielaChat
              comentarios={data.comentarios}
              reacciones={data.reacciones}
              nombresById={nombresById}
              miJugadorId={miJugadorId}
              esPartner={isPartner}
              onChanged={() => router.refresh()}
            />
          )}
          {tab === 'admin' && isPartner && (
            <AdminTab data={data} equiposById={equiposById} onChanged={() => router.refresh()} />
          )}
        </div>

        {/* ── Bottom nav ── */}
        <div style={{
          position: 'sticky', bottom: 0, zIndex: 40, display: 'flex',
          background: '#0c1226', borderTop: `1px solid ${Q.border}`, padding: '2px 2px 6px',
        }}>
          {navItems.map(n => {
            const activo = tab === n.key
            return (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  background: 'transparent', border: 0, cursor: 'pointer', padding: '7px 0 4px',
                }}
              >
                <span style={{
                  height: 3, width: 18, borderRadius: 2,
                  background: activo ? Q.green : 'transparent',
                  boxShadow: activo ? `0 0 8px ${Q.green}` : 'none',
                }} />
                <span style={{ fontSize: 17, lineHeight: 1, filter: activo ? 'drop-shadow(0 0 6px rgba(54,245,154,.5))' : 'grayscale(.4) opacity(.8)' }}>
                  {n.icon}
                </span>
                <span style={{ ...labelStyle, fontSize: 7, color: activo ? Q.green : Q.textDimmer }}>{n.label}</span>
              </button>
            )
          })}
        </div>

        {/* Scanlines CRT */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 90, pointerEvents: 'none', background: 'repeating-linear-gradient(rgba(255,255,255,.02) 0 1px, transparent 1px 3px)' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 90, pointerEvents: 'none', boxShadow: 'inset 0 0 90px rgba(0,0,0,.55)' }} />
      </div>

      {verReglas && <QuinielaReglas monto={monto} onClose={() => setVerReglas(false)} />}
      {mostrarOnboarding && deadlineApertura && (
        <QuinielaOnboarding
          equipos={data.equipos}
          pickActualId={pickApertura?.equipo_id ?? null}
          pichichiActual={miJugador?.pichichi ?? null}
          deadlineMs={deadlineApertura}
          ahora={ahora}
          onClose={() => setOnboardingCerrado(true)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  )
}

// ── Podio (reutilizado en Inicio y Clasificación) ───────────────────────────────

function Podio({ leaderboard }: { leaderboard: QuinielaData['leaderboard'] }) {
  const top = leaderboard.slice(0, 3)
  if (top.length === 0) return null
  // Slots en orden visual (2º, 1º, 3º), cada uno apunta a su posición real
  const slots = [
    { rank: 1, medal: '🥈', av: 46, h: 96, delay: '.12s' },
    { rank: 0, medal: '🥇', av: 56, h: 128, delay: '0s' },
    { rank: 2, medal: '🥉', av: 42, h: 74, delay: '.24s' },
  ].filter(s => top[s.rank])

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 16, paddingTop: 10 }}>
      {slots.map(m => {
        const row = top[m.rank]
        const rank = m.rank
        const color = posColor(rank)
        return (
          <div key={row.jugador_id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 24, animation: `q-floaty 2.6s ease-in-out infinite`, animationDelay: m.delay }}>{m.medal}</div>
            <div style={{
              width: m.av, height: m.av, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...pixelStyle, fontSize: rank === 0 ? 15 : 13, color: '#0a0e1c', background: color,
              border: '2px solid rgba(255,255,255,.25)', boxShadow: `0 0 18px ${color}66`, margin: '5px 0 6px',
            }}>
              {iniciales(row.nombre)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: Q.text, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 96 }}>
              {row.nombre}
            </div>
            <div style={{ ...pixelStyle, fontSize: 9, color, marginTop: 4 }}>{row.total}pts</div>
            <div style={{
              width: '100%', height: m.h, marginTop: 8, borderRadius: '8px 8px 0 0',
              background: `linear-gradient(180deg,${color},transparent)`, border: '1px solid rgba(255,255,255,.1)', borderBottom: 0,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 7,
              transformOrigin: 'bottom', animation: `q-rise .6s cubic-bezier(.2,1.2,.4,1) both`, animationDelay: m.delay,
            }}>
              <span style={{ ...pixelStyle, fontSize: 13, color: '#0a0e1c' }}>{rank + 1}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Inicio ─────────────────────────────────────────────────────────────────

function HomeTab({ data, equiposById, miJugadorId, miNombre, bote, ahora, setTab }: {
  data: QuinielaData
  equiposById: Map<string, QuinielaEquipo>
  miJugadorId: string | null
  miNombre: string | null | undefined
  bote: number
  ahora: number
  setTab: (t: Tab) => void
}) {
  const miIndex = data.leaderboard.findIndex(r => r.jugador_id === miJugadorId)
  const miRow = miIndex >= 0 ? data.leaderboard[miIndex] : null
  const lider = data.leaderboard[0]
  const aLider = miRow && lider ? lider.total - miRow.total : 0

  // Próximo partido: el primero no finalizado con kickoff aún por venir
  const proximo = data.partidos
    .filter(p => p.estado !== 'finalizado')
    .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())[0]
  const proxLocal = proximo?.equipo_local_id ? equiposById.get(proximo.equipo_local_id) : undefined
  const proxVisitante = proximo?.equipo_visitante_id ? equiposById.get(proximo.equipo_visitante_id) : undefined
  const cierreMs = proximo ? new Date(proximo.fecha_hora).getTime() - BLOQUEO_PREDICCION_MS - ahora : 0

  return (
    <div style={{ animation: 'q-slideUp .35s ease both' }}>
      {/* Saludo + posición */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px 16px', gap: 12 }}>
        <div>
          <div style={{ ...labelStyle, fontSize: 9, color: Q.textMid }}>MUNDIAL 2026</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: Q.text, marginTop: 4 }}>
            {miNombre ? <>¡Hola, {miNombre}! 👋</> : '¡Bienvenido! 👋'}
          </div>
        </div>
        {miRow && (
          <div style={{ textAlign: 'center', background: 'rgba(54,245,154,.1)', border: '1px solid rgba(54,245,154,.4)', borderRadius: 11, padding: '7px 11px', flex: 'none' }}>
            <div style={{ ...pixelStyle, fontSize: 13, color: Q.green }}>{miIndex + 1}º</div>
            <div style={{ fontSize: 9, color: Q.textDim, marginTop: 3 }}>
              {miIndex === 0 ? '¡líder!' : `a ${aLider} del oro`}
            </div>
          </div>
        )}
      </div>

      {/* Podio */}
      {data.leaderboard.length > 0 && (
        <>
          <div style={{ ...pixelStyle, fontSize: 12, color: Q.gold, textAlign: 'center', marginBottom: 3, textShadow: '0 0 14px rgba(255,210,63,.4)' }}>🏆 EL PODIO</div>
          <div style={{ textAlign: 'center', fontSize: 10, color: Q.textDim, marginBottom: 6 }}>
            Top 3 del bote · <b style={{ color: Q.gold }}>{bote.toFixed(0)}€</b> en juego
          </div>
          <Podio leaderboard={data.leaderboard} />
        </>
      )}

      {/* Chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <StatChip icon="📍" valor={miRow ? `${miIndex + 1}º` : '—'} label="Posición" color={Q.cyan} />
        <StatChip icon="🎯" valor={miRow ? String(miRow.exactos) : '0'} label="Exactos" color={Q.green} />
        <StatChip icon="💰" valor={`${bote.toFixed(0)}€`} label="Bote" color={Q.gold} />
      </div>

      {/* Próximo partido */}
      {proximo && proxLocal && proxVisitante ? (
        <button
          onClick={() => setTab('partidos')}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: 'linear-gradient(160deg,#15224a,#0f1838)', border: '1.5px solid rgba(54,245,154,.3)',
            borderRadius: 16, padding: 14, marginBottom: 9,
            boxShadow: '0 0 24px rgba(54,245,154,.1), 0 6px 0 rgba(0,0,0,.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
            <span style={{ ...labelStyle, color: Q.green }}>⭐ PRÓXIMO PARTIDO</span>
            <span style={{ ...labelStyle, color: Q.pink, background: 'rgba(255,91,118,.14)', border: '1px solid rgba(255,91,118,.4)', borderRadius: 999, padding: '4px 9px' }}>
              🔒 {formatCountdown(cierreMs)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 11 }}>
            <span style={{ fontSize: 26 }}>{proxLocal.bandera}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: Q.text }}>{proxLocal.codigo}</span>
            <span style={{ ...pixelStyle, fontSize: 10, color: Q.textDim }}>VS</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: Q.text }}>{proxVisitante.codigo}</span>
            <span style={{ fontSize: 26 }}>{proxVisitante.bandera}</span>
          </div>
          <div style={{ textAlign: 'center', ...pixelStyle, fontSize: 9, color: Q.green }}>TOCA PARA PREDECIR ▸</div>
        </button>
      ) : (
        <div style={{ ...cardStyle, padding: 14, marginBottom: 9, textAlign: 'center', fontSize: 12, color: Q.textMid }}>
          No hay partidos próximos por ahora.
        </div>
      )}

      <button
        onClick={() => setTab('clasificacion')}
        style={{
          width: '100%', cursor: 'pointer', background: Q.card, border: `1px solid ${Q.borderHi}`,
          borderRadius: 13, padding: 13, color: Q.textSoft, ...labelStyle, fontSize: 10,
        }}
      >
        VER CLASIFICACIÓN COMPLETA ▸
      </button>
    </div>
  )
}

function StatChip({ icon, valor, label, color }: { icon: string; valor: string; label: string; color: string }) {
  return (
    <div style={{ flex: 1, background: Q.card, border: `1px solid ${Q.border}`, borderRadius: 12, padding: '11px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 17 }}>{icon}</div>
      <div style={{ ...pixelStyle, fontSize: 12, color, marginTop: 5 }}>{valor}</div>
      <div style={{ ...labelStyle, fontSize: 7, color: Q.textDim, marginTop: 5 }}>{label.toUpperCase()}</div>
    </div>
  )
}

// ── Equipo chip ───────────────────────────────────────────────────────────────

function EquipoLabel({ equipo, etiqueta, align = 'left' }: {
  equipo: QuinielaEquipo | undefined
  etiqueta: string | null
  align?: 'left' | 'right'
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
      flexDirection: align === 'right' ? 'row-reverse' : 'row',
    }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{equipo?.bandera || '⏳'}</span>
      <span style={{
        fontSize: 12, fontWeight: 600, color: equipo ? Q.text : Q.textDim,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {equipo?.nombre || etiqueta || 'Por definir'}
      </span>
    </div>
  )
}

// ── Tab: Partidos ─────────────────────────────────────────────────────────────

function PartidosTab({ data, equiposById, nombresById, miJugadorId, ahora, fireConfetti }: {
  data: QuinielaData
  equiposById: Map<string, QuinielaEquipo>
  nombresById: Map<string, string>
  miJugadorId: string | null
  ahora: number
  fireConfetti: (n?: number) => void
}) {
  const [fase, setFase] = useState<QuinielaFase>('grupos')
  const [diasAbiertos, setDiasAbiertos] = useState<Record<string, boolean>>({})

  const partidos = data.partidos.filter(p => p.fase === fase)
  const visibles = partidos

  const predichos = partidos.filter(p =>
    data.misPredicciones.some(pred => pred.partido_id === p.id)
  ).length
  const pct = partidos.length ? Math.round((predichos / partidos.length) * 100) : 0

  // Agrupar por día (zona Madrid)
  const porDia = new Map<string, QuinielaPartido[]>()
  for (const p of visibles) {
    const dia = new Date(p.fecha_hora).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid',
    })
    if (!porDia.has(dia)) porDia.set(dia, [])
    porDia.get(dia)!.push(p)
  }

  return (
    <div style={{ animation: 'q-slideUp .35s ease both' }}>
      {/* Progreso */}
      {miJugadorId && (
        <div style={{ ...cardStyle, padding: '13px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
            <span style={{ ...labelStyle }}>TUS PREDICCIONES · {FASE_LABELS[fase]}</span>
            <span style={{ ...pixelStyle, fontSize: 11, color: Q.green }}>
              {predichos}<span style={{ color: Q.textDim, fontSize: 9 }}> / {partidos.length}</span>
            </span>
          </div>
          <div style={{ height: 9, borderRadius: 6, background: '#070b18', overflow: 'hidden', border: '1px solid rgba(255,255,255,.05)' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: 'linear-gradient(90deg,#36f59a,#34e3ff)', boxShadow: '0 0 10px rgba(54,245,154,.6)' }} />
          </div>
        </div>
      )}

      {/* Chips de fase */}
      <div className="q-scroll" style={{ display: 'flex', gap: 7, overflowX: 'auto', margin: '0 -2px 14px', padding: '0 2px 2px' }}>
        {FASES_ORDEN.map(f => {
          const activa = fase === f
          return (
            <button
              key={f}
              onClick={() => setFase(f)}
              style={{
                flex: 'none', ...labelStyle, fontSize: 9, padding: '7px 11px', borderRadius: 9, cursor: 'pointer',
                border: `1px solid ${activa ? 'rgba(54,245,154,.5)' : Q.border}`,
                background: activa ? 'rgba(54,245,154,.14)' : Q.card,
                color: activa ? Q.green : Q.textMid,
              }}
            >
              {FASE_LABELS[f]}
            </button>
          )
        })}
      </div>

      <p style={{ fontSize: 10, color: Q.textMid, marginBottom: 14, lineHeight: 1.5 }}>
        Acierto de {fase === 'grupos' ? 'resultado' : 'quién pasa'}{' '}
        <strong style={{ color: Q.green }}>{PUNTOS_PARTIDO[fase].resultado} pts</strong> · marcador exacto{' '}
        <strong style={{ color: Q.gold }}>{PUNTOS_PARTIDO[fase].exacto} pts</strong>
        {fase !== 'grupos' && ' · al final de la prórroga, sin penaltis'}
        . Cierran <strong style={{ color: Q.pink }}>1 h antes</strong> de cada partido.
      </p>

      {visibles.length === 0 && (
        <p style={{ fontSize: 13, color: Q.textDim, padding: '32px 0', textAlign: 'center' }}>
          No hay partidos en esta fase.
        </p>
      )}

      {Array.from(porDia.entries()).map(([dia, partidosDia]) => {
        const todosTerminados = partidosDia.every(p => p.estado === 'finalizado')
        const abierto = diasAbiertos[dia] ?? !todosTerminados
        return (
          <div key={dia} style={{ marginBottom: abierto ? 22 : 10 }}>
            <button
              onClick={() => setDiasAbiertos(prev => ({ ...prev, [dia]: !abierto }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8, marginBottom: abierto ? 10 : 0 }}
            >
              <span style={{ ...labelStyle, fontSize: 9, color: Q.textMid }}>
                {abierto ? '▾' : '▸'} {dia}
              </span>
              <span style={{ fontSize: 9, color: Q.textDim }}>
                {partidosDia.length} {partidosDia.length === 1 ? 'partido' : 'partidos'}
                {todosTerminados && ' · ✓'}
              </span>
            </button>
            {abierto && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {partidosDia.map(p => (
                  <MatchCard
                    key={p.id}
                    partido={p}
                    equiposById={equiposById}
                    nombresById={nombresById}
                    data={data}
                    miJugadorId={miJugadorId}
                    ahora={ahora}
                    fireConfetti={fireConfetti}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MatchCard({ partido, equiposById, nombresById, data, miJugadorId, ahora, fireConfetti }: {
  partido: QuinielaPartido
  equiposById: Map<string, QuinielaEquipo>
  nombresById: Map<string, string>
  data: QuinielaData
  miJugadorId: string | null
  ahora: number
  fireConfetti: (n?: number) => void
}) {
  const local = partido.equipo_local_id ? equiposById.get(partido.equipo_local_id) : undefined
  const visitante = partido.equipo_visitante_id ? equiposById.get(partido.equipo_visitante_id) : undefined
  const miPred = data.misPredicciones.find(p => p.partido_id === partido.id)

  const [golesL, setGolesL] = useState<string>(miPred ? String(miPred.goles_local) : '')
  const [golesV, setGolesV] = useState<string>(miPred ? String(miPred.goles_visitante) : '')
  const [quePasa, setQuePasa] = useState<string | null>(miPred?.equipo_que_pasa_id ?? null)
  const [saveState, setSaveState] = useState<SaveState>(miPred ? 'guardada' : 'vacia')
  const [saveError, setSaveError] = useState('')
  const [verPredicciones, setVerPredicciones] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const empezado = partido.estado === 'finalizado' || new Date(partido.fecha_hora).getTime() <= ahora
  const bloqueado = empezado || prediccionBloqueada(partido.fecha_hora, ahora)
  const esEliminatoria = partido.fase !== 'grupos'
  const puedoPredecirlo = data.soyParticipante && !bloqueado && !!local && !!visitante
  const { hora } = formatFechaPartido(partido.fecha_hora)
  // Tiempo restante hasta el cierre de la predicción (1 h antes del kickoff)
  const cierreMs = new Date(partido.fecha_hora).getTime() - BLOQUEO_PREDICCION_MS - ahora
  const cierraPronto = cierreMs > 0 && cierreMs < 3 * 3600 * 1000

  function valida(l: string, v: string): { gl: number; gv: number } | null {
    const gl = parseInt(l, 10)
    const gv = parseInt(v, 10)
    if (isNaN(gl) || isNaN(gv) || gl < 0 || gv < 0) return null
    return { gl, gv }
  }

  async function guardar(l: string, v: string, qp: string | null) {
    if (timerRef.current) clearTimeout(timerRef.current)
    const parsed = valida(l, v)
    if (!parsed) { setSaveState('sin_guardar'); setSaveError('Rellena los dos marcadores.'); return }
    if (esEliminatoria && parsed.gl === parsed.gv && !qp) {
      setSaveState('sin_guardar'); setSaveError('Con empate, elige quién pasa.'); return
    }
    setSaveState('guardando')
    setSaveError('')
    const result = await upsertPrediccion({
      partidoId: partido.id,
      golesLocal: parsed.gl,
      golesVisitante: parsed.gv,
      equipoQuePasaId: parsed.gl === parsed.gv ? qp : null,
    })
    if ('error' in result) {
      setSaveState('error')
      setSaveError(result.error)
    } else {
      setSaveState('guardada')
      setSaveError('')
      fireConfetti(60)
    }
  }

  function onCambio(nuevoL: string, nuevoV: string, nuevoQuePasa: string | null) {
    setSaveState('sin_guardar')
    setSaveError('')
    if (timerRef.current) clearTimeout(timerRef.current)
    // Autosave con debounce; el botón Guardar fuerza el guardado inmediato
    timerRef.current = setTimeout(() => { guardar(nuevoL, nuevoV, nuevoQuePasa) }, 900)
  }

  const prediccionesPartido = data.prediccionesReveladas.filter(p => p.partido_id === partido.id)
  const empateElim = esEliminatoria && golesL !== '' && golesL === golesV

  // Marcador en vivo del cron + puntos provisionales "si queda así"
  const live = partido.estado !== 'finalizado' ? data.liveScores[partido.id] : undefined
  const puntosProvisionales = (pred: { goles_local: number; goles_visitante: number; equipo_que_pasa_id: string | null }) =>
    live
      ? calcPuntosPrediccion(
          { ...partido, goles_local: live.gl, goles_visitante: live.gv, equipo_que_pasa_id: null },
          pred
        )
      : null

  const destacado = puedoPredecirlo && cierraPronto
  return (
    <div style={{
      background: destacado ? 'linear-gradient(160deg,#15224a,#0f1838)' : Q.card,
      borderRadius: 14,
      border: `1px solid ${saveState === 'error' ? 'rgba(255,91,118,.5)' : destacado ? 'rgba(54,245,154,.3)' : Q.border}`,
      padding: '13px 14px',
      boxShadow: destacado ? '0 0 24px rgba(54,245,154,.08)' : 'none',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }}>
        <EquipoLabel equipo={local} etiqueta={partido.etiqueta_local} align="right" />

        {/* Centro: resultado o inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', minWidth: 96 }}>
          {empezado ? (
            <span style={{ ...pixelStyle, fontSize: 15, color: Q.text, textAlign: 'center' }}>
              {partido.estado === 'finalizado'
                ? `${partido.goles_local}–${partido.goles_visitante}`
                : live
                  ? <>
                      {live.gl}–{live.gv}
                      <span style={{ display: 'block', ...labelStyle, fontSize: 8, color: Q.pink, marginTop: 3 }}>
                        🔴 {live.minuto || 'EN JUEGO'}
                      </span>
                    </>
                  : <span style={{ color: Q.pink, fontSize: 12 }}>🔴 En juego</span>}
            </span>
          ) : puedoPredecirlo ? (
            <>
              <input
                type="number" min={0} max={20} value={golesL}
                onChange={e => { setGolesL(e.target.value); onCambio(e.target.value, golesV, quePasa) }}
                style={scoreInputStyle}
              />
              <span style={{ color: Q.textDim, fontSize: 13 }}>–</span>
              <input
                type="number" min={0} max={20} value={golesV}
                onChange={e => { setGolesV(e.target.value); onCambio(golesL, e.target.value, quePasa) }}
                style={scoreInputStyle}
              />
            </>
          ) : bloqueado && miPred ? (
            <span style={{ ...pixelStyle, fontSize: 13, color: Q.textMid }}>
              🔒 {miPred.goles_local}–{miPred.goles_visitante}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: Q.textDim }}>{bloqueado ? '🔒' : `${hora}h`}</span>
          )}
        </div>

        <EquipoLabel equipo={visitante} etiqueta={partido.etiqueta_visitante} />
      </div>

      {/* Fila inferior: estado / guardar */}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {empezado ? (
          <MiPuntuacion partido={partido} data={data} live={live} />
        ) : puedoPredecirlo ? (
          <>
            <p style={{ fontSize: 9, color: cierraPronto ? Q.pink : Q.textDim, fontWeight: cierraPronto ? 600 : 400 }}>
              {hora}h · 🕐 cierra en {formatCountdown(cierreMs)}
            </p>
            <button
              onClick={() => guardar(golesL, golesV, quePasa)}
              disabled={saveState === 'guardando' || saveState === 'guardada' || saveState === 'vacia'}
              style={{
                ...(saveState === 'guardada'
                  ? { background: 'rgba(54,245,154,.1)', color: Q.green, border: '1px solid rgba(54,245,154,.5)' }
                  : saveState === 'sin_guardar' || saveState === 'error'
                    ? { background: 'linear-gradient(180deg,#48ffa6,#23d985)', color: '#06210f', border: 0, boxShadow: '0 3px 0 #128a52' }
                    : { background: Q.cardHi, color: Q.textDim, border: `1px solid ${Q.border}` }),
                borderRadius: 10, padding: '8px 14px', ...labelStyle, fontSize: 9,
                cursor: saveState === 'sin_guardar' || saveState === 'error' ? 'pointer' : 'default',
              }}
            >
              {saveState === 'guardando' ? 'GUARDANDO…'
                : saveState === 'guardada' ? '✓ GUARDADA'
                : saveState === 'error' ? 'REINTENTAR'
                : saveState === 'sin_guardar' ? 'GUARDAR ▸'
                : 'SIN PREDICCIÓN'}
            </button>
          </>
        ) : (
          <p style={{ fontSize: 10, color: Q.textDim }}>
            {hora}h
            {bloqueado && !empezado ? ' · 🔒' : ''}
            {bloqueado && !miPred ? ' · sin predicción' : ''}
            {!bloqueado && cierreMs > 0 ? ` · cierra en ${formatCountdown(cierreMs)}` : ''}
          </p>
        )}
      </div>

      {/* Empate en eliminatoria: elegir quién pasa */}
      {!bloqueado && puedoPredecirlo && empateElim && local && visitante && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: Q.textMid }}>¿Quién pasa?</span>
          {[local, visitante].map(eq => (
            <button
              key={eq.id}
              onClick={() => { setQuePasa(eq.id); guardar(golesL, golesV, eq.id) }}
              style={{
                background: quePasa === eq.id ? Q.green : Q.cardHi,
                color: quePasa === eq.id ? '#06210f' : Q.textSoft,
                border: `1px solid ${quePasa === eq.id ? Q.green : Q.border}`,
                borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer',
              }}
            >
              {eq.bandera} {eq.nombre}
            </button>
          ))}
        </div>
      )}

      {saveError && (
        <p style={{ fontSize: 11, color: Q.pink, marginTop: 8, textAlign: 'center' }}>{saveError}</p>
      )}

      {/* Qué está en juego */}
      {bloqueado && partido.estado !== 'finalizado' && local && visitante && prediccionesPartido.length > 0 && (
        <StakesPanel
          partido={partido}
          local={local}
          visitante={visitante}
          predicciones={prediccionesPartido}
          nombresById={nombresById}
          data={data}
        />
      )}

      {/* Predicciones reveladas */}
      {bloqueado && prediccionesPartido.length > 0 && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${Q.border}`, paddingTop: 10 }}>
          <button
            onClick={() => setVerPredicciones(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: Q.cyan, padding: 0, fontWeight: 600 }}
          >
            {verPredicciones ? '▾' : '▸'} ver porra ({prediccionesPartido.length})
          </button>
          {verPredicciones && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {prediccionesPartido.map(pred => (
                <span key={pred.id} style={{
                  fontSize: 10, padding: '4px 10px', borderRadius: 20,
                  background: pred.jugador_id === miJugadorId ? 'rgba(54,245,154,.12)' : Q.cardHi,
                  border: `1px solid ${pred.jugador_id === miJugadorId ? 'rgba(54,245,154,.4)' : Q.border}`,
                  color: Q.textSoft,
                }}>
                  {nombresById.get(pred.jugador_id) || '—'} · {pred.goles_local}-{pred.goles_visitante}
                  {partido.estado === 'finalizado' ? (
                    <strong style={{ color: (pred.puntos ?? 0) > 0 ? Q.green : Q.textDim, marginLeft: 6 }}>
                      +{pred.puntos ?? 0}
                    </strong>
                  ) : live ? (
                    <span style={{ color: (puntosProvisionales(pred) ?? 0) > 0 ? Q.green : Q.textDim, marginLeft: 6, fontSize: 9 }}>
                      +{puntosProvisionales(pred)}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StakesPanel({ partido, local, visitante, predicciones, nombresById, data }: {
  partido: QuinielaPartido
  local: QuinielaEquipo
  visitante: QuinielaEquipo
  predicciones: { jugador_id: string; goles_local: number; goles_visitante: number; equipo_que_pasa_id: string | null }[]
  nombresById: Map<string, string>
  data: QuinielaData
}) {
  const [abierto, setAbierto] = useState(false)
  const esEliminatoria = partido.fase !== 'grupos'
  const pts = PUNTOS_PARTIDO[partido.fase]

  // Agrupar predicciones por desenlace
  const nombre = (id: string) => nombresById.get(id) || '—'
  const conLocal: string[] = [], empate: string[] = [], conVisitante: string[] = []
  for (const p of predicciones) {
    const etiqueta = `${nombre(p.jugador_id)} (${p.goles_local}-${p.goles_visitante})`
    if (p.goles_local > p.goles_visitante) conLocal.push(etiqueta)
    else if (p.goles_visitante > p.goles_local) conVisitante.push(etiqueta)
    else if (esEliminatoria && p.equipo_que_pasa_id === local.id) conLocal.push(etiqueta + ' 🥅')
    else if (esEliminatoria && p.equipo_que_pasa_id === visitante.id) conVisitante.push(etiqueta + ' 🥅')
    else empate.push(etiqueta)
  }
  const sinPrediccion = data.jugadores
    .filter(j => !predicciones.some(p => p.jugador_id === j.id))
    .map(j => j.nombre)

  // En eliminatorias: quién pierde su escalera del campeón si cae cada equipo
  const escaleraEnRiesgo = (equipoId: string) => {
    const porJugador = new Map<string, number>()
    for (const pick of data.picksRevelados.filter(p => p.equipo_id === equipoId)) {
      porJugador.set(pick.jugador_id, (porJugador.get(pick.jugador_id) || 0) + PUNTOS_ESCALERA[pick.ventana])
    }
    return Array.from(porJugador.entries()).map(([id, p]) => `${nombre(id)} (${p} pts)`)
  }

  const filas = esEliminatoria
    ? [
        { label: `Pasa ${local.bandera} ${local.nombre}`, gente: conLocal },
        { label: `Pasa ${visitante.bandera} ${visitante.nombre}`, gente: conVisitante },
      ]
    : [
        { label: `Gana ${local.bandera} ${local.nombre}`, gente: conLocal },
        { label: 'Empate', gente: empate },
        { label: `Gana ${visitante.bandera} ${visitante.nombre}`, gente: conVisitante },
      ]

  return (
    <div style={{ marginTop: 10, borderTop: `1px solid ${Q.border}`, paddingTop: 10 }}>
      <button
        onClick={() => setAbierto(v => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: Q.gold, fontWeight: 600, padding: 0 }}
      >
        {abierto ? '▾' : '▸'} ⚡ Qué está en juego
      </button>
      {abierto && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filas.map(f => (
            <p key={f.label} style={{ fontSize: 11, color: Q.textSoft, lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 600, color: Q.text }}>{f.label}</strong>
              <span style={{ color: Q.textDim }}> (+{pts.resultado}, exacto +{pts.exacto})</span>
              {' → '}
              {f.gente.length ? f.gente.join(' · ') : <span style={{ color: Q.textDim }}>nadie</span>}
            </p>
          ))}
          {sinPrediccion.length > 0 && (
            <p style={{ fontSize: 11, color: Q.textDim }}>
              😴 Sin mojarse: {sinPrediccion.join(' · ')}
            </p>
          )}
          {esEliminatoria && [local, visitante].map(eq => {
            const riesgo = escaleraEnRiesgo(eq.id)
            if (!riesgo.length) return null
            return (
              <p key={eq.id} style={{ fontSize: 11, color: Q.gold }}>
                🏆 Si cae {eq.bandera} {eq.nombre}, pierden su campeón: {riesgo.join(' · ')}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MiPuntuacion({ partido, data, live }: {
  partido: QuinielaPartido
  data: QuinielaData
  live?: { gl: number; gv: number; minuto: string }
}) {
  const miPred = data.misPredicciones.find(p => p.partido_id === partido.id)
  if (!miPred) return <p style={{ fontSize: 11, color: Q.textDim }}>Sin predicción</p>
  const provisional = partido.estado !== 'finalizado' && live
    ? calcPuntosPrediccion(
        { ...partido, goles_local: live.gl, goles_visitante: live.gv, equipo_que_pasa_id: null },
        miPred
      )
    : null
  const exacto = partido.estado === 'finalizado'
    && miPred.goles_local === partido.goles_local && miPred.goles_visitante === partido.goles_visitante
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: Q.textMid }}>Tú: <b style={{ color: Q.textSoft }}>{miPred.goles_local}-{miPred.goles_visitante}</b></span>
      {partido.estado === 'finalizado' ? (
        exacto ? (
          <span style={{ ...pixelStyle, fontSize: 8, color: '#06210f', background: 'linear-gradient(180deg,#ffe066,#ffc31f)', borderRadius: 7, padding: '5px 8px', boxShadow: '0 0 12px rgba(255,210,63,.5)' }}>
            +{miPred.puntos ?? 0} 🎯 EXACTO
          </span>
        ) : (
          <span style={{ ...labelStyle, fontSize: 9, color: (miPred.puntos ?? 0) > 0 ? Q.green : Q.textDim, background: (miPred.puntos ?? 0) > 0 ? 'rgba(54,245,154,.12)' : 'rgba(255,255,255,.05)', borderRadius: 7, padding: '4px 7px' }}>
            +{miPred.puntos ?? 0} pts
          </span>
        )
      ) : provisional !== null ? (
        <span style={{ fontSize: 10, fontWeight: 600, color: provisional > 0 ? Q.green : Q.textDim }}>
          +{provisional} si queda así
        </span>
      ) : null}
    </div>
  )
}

const scoreInputStyle: React.CSSProperties = {
  width: 44, height: 38, textAlign: 'center', fontFamily: FONT.pixel, fontSize: 15,
  border: `1px solid rgba(54,245,154,.4)`, borderRadius: 8, color: Q.green,
  background: '#10233a', outline: 'none',
}

// ── Tab: Clasificación ────────────────────────────────────────────────────────

function ClasificacionTab({ data, bote, reparto, miJugadorId, equiposById }: {
  data: QuinielaData
  bote: number
  reparto: number[]
  miJugadorId: string | null
  equiposById: Map<string, QuinielaEquipo>
}) {
  const [expandido, setExpandido] = useState<string | null>(null)

  // Partidos finalizados ordenados, para el detalle por jugador
  const finalizados = useMemo(
    () => data.partidos
      .filter(p => p.estado === 'finalizado')
      .sort((a, b) => a.numero - b.numero),
    [data.partidos]
  )
  // Predicciones reveladas indexadas por jugador → partido
  const predsByJugador = useMemo(() => {
    const m = new Map<string, Map<string, typeof data.prediccionesReveladas[number]>>()
    for (const pred of data.prediccionesReveladas) {
      if (!m.has(pred.jugador_id)) m.set(pred.jugador_id, new Map())
      m.get(pred.jugador_id)!.set(pred.partido_id, pred)
    }
    return m
  }, [data.prediccionesReveladas])

  return (
    <div style={{ animation: 'q-slideUp .35s ease both' }}>
      {/* Bote */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg,#2a1f08,#1a1530)', border: '1.5px solid rgba(255,210,63,.35)', borderRadius: 18, padding: 14, marginBottom: 18, overflow: 'hidden', boxShadow: '0 0 30px rgba(255,210,63,.1)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(110deg,transparent 30%,rgba(255,210,63,.12) 50%,transparent 70%)', backgroundSize: '200% 100%', animation: 'q-shine 3.5s infinite' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ ...labelStyle, color: '#d9b84a' }}>EL BOTE</div>
            <div style={{ ...pixelStyle, fontSize: 30, color: Q.gold, textShadow: '0 0 18px rgba(255,210,63,.5)', marginTop: 6 }}>{bote.toFixed(0)}€</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', fontSize: 11 }}>
            <span style={{ color: Q.gold }}>🥇 {(bote * reparto[0] / 100).toFixed(0)}€</span>
            <span style={{ color: Q.textSoft }}>🥈 {(bote * (reparto[1] || 0) / 100).toFixed(0)}€</span>
            <span style={{ color: Q.orange }}>🥉 {(bote * (reparto[2] || 0) / 100).toFixed(0)}€</span>
          </div>
        </div>
        <div style={{ position: 'relative', marginTop: 10, fontSize: 10, color: '#b09a55' }}>
          Reparto {reparto.join(' / ')} % entre los tres primeros
        </div>
      </div>

      {data.leaderboard.length === 0 && (
        <p style={{ fontSize: 13, color: Q.textDim }}>Todavía no hay jugadores.</p>
      )}

      {/* Podio */}
      {data.leaderboard.length > 0 && <Podio leaderboard={data.leaderboard} />}

      {/* Tabla */}
      <div style={{ ...labelStyle, fontSize: 10, color: Q.textMid, margin: '8px 2px 9px' }}>TABLA COMPLETA</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {data.leaderboard.map((row, i) => {
          const esYo = row.jugador_id === miJugadorId
          const premio = i < reparto.length ? bote * reparto[i] / 100 : 0
          const abierto = expandido === row.jugador_id
          return (
            <div key={row.jugador_id}>
              <div
                onClick={() => setExpandido(abierto ? null : row.jugador_id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer',
                  background: esYo ? 'rgba(54,245,154,.08)' : Q.card,
                  border: `1px solid ${esYo ? 'rgba(54,245,154,.4)' : Q.border}`,
                  borderRadius: abierto ? '12px 12px 0 0' : 12, padding: '9px 11px',
                }}
              >
                <div style={{ width: 26, textAlign: 'center', ...pixelStyle, fontSize: 11, color: posColor(i), flex: 'none' }}>
                  {i < 3 ? MEDALLAS[i] : String(i + 1)}
                </div>
                <div style={{ width: 30, height: 30, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', ...pixelStyle, fontSize: 9, color: '#0a0e1c', background: avatarColor(i) }}>
                  {iniciales(row.nombre)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: Q.text }}>
                    {row.nombre} {esYo && <span style={{ fontSize: 10, color: Q.cyan, fontWeight: 600 }}>(tú)</span>}
                  </div>
                  <div style={{ fontSize: 9, color: Q.textDimmer, marginTop: 1 }}>
                    P {row.puntos_partidos} · E {row.puntos_escalera} · 🎯 {row.exactos}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flex: 'none' }}>
                  <span style={{ ...pixelStyle, fontSize: 11, color: Q.green }}>{row.total}</span>
                  {premio > 0 ? (
                    <span style={{ fontSize: 8, color: Q.gold }}>{premio.toFixed(0)}€</span>
                  ) : !row.pagado ? (
                    <span style={{ fontSize: 8, color: Q.orange, background: 'rgba(255,155,91,.12)', borderRadius: 5, padding: '2px 5px' }}>PDTE PAGO</span>
                  ) : <span style={{ fontSize: 8, color: Q.textDim }}>pts</span>}
                </div>
                <span style={{ fontSize: 10, color: Q.textDim, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
              </div>
              {abierto && (
                <DetalleJugador
                  finalizados={finalizados}
                  preds={predsByJugador.get(row.jugador_id)}
                  equiposById={equiposById}
                />
              )}
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 10, color: Q.textDim, marginTop: 12, lineHeight: 1.5 }}>
        Toca un jugador para ver su historial. Desempate: total → marcadores exactos → aciertos en eliminatorias.
      </p>
    </div>
  )
}

// Historial partido a partido de un jugador (solo partidos finalizados)
function DetalleJugador({ finalizados, preds, equiposById }: {
  finalizados: QuinielaPartido[]
  preds: Map<string, QuinielaData['prediccionesReveladas'][number]> | undefined
  equiposById: Map<string, QuinielaEquipo>
}) {
  const cod = (id: string | null) => (id && equiposById.get(id)?.codigo) || '¿?'
  if (finalizados.length === 0) {
    return (
      <div style={{ border: `1px solid ${Q.border}`, borderTop: 'none', borderRadius: '0 0 12px 12px', background: Q.cardAlt, padding: '12px 14px' }}>
        <p style={{ fontSize: 11, color: Q.textDim }}>Aún no hay partidos cerrados.</p>
      </div>
    )
  }
  return (
    <div style={{ border: `1px solid ${Q.border}`, borderTop: 'none', borderRadius: '0 0 12px 12px', background: Q.cardAlt, padding: '6px 14px 10px', display: 'flex', flexDirection: 'column' }}>
      {finalizados.map(p => {
        const pred = preds?.get(p.id)
        const pts = pred?.puntos ?? 0
        const exacto = pred && pred.goles_local === p.goles_local && pred.goles_visitante === p.goles_visitante
        return (
          <div key={p.id} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center',
            padding: '7px 0', borderBottom: `1px solid ${Q.border}`, fontSize: 11,
          }}>
            <span style={{ color: Q.textSoft }}>
              <span style={{ color: Q.textDim, marginRight: 6 }}>#{p.numero}</span>
              {cod(p.equipo_local_id)} {p.goles_local}–{p.goles_visitante} {cod(p.equipo_visitante_id)}
            </span>
            <span style={{ color: pred ? Q.textMid : Q.textDim }}>
              {pred ? `tú: ${pred.goles_local}–${pred.goles_visitante}` : 'sin pronóstico'}
            </span>
            <span style={{ minWidth: 60, textAlign: 'right', fontWeight: 600, color: pts > 0 ? Q.green : Q.textDim }}>
              {pts > 0 ? `+${pts}` : '0'}{exacto && <span title="marcador exacto"> 🎯</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Mi escalera ──────────────────────────────────────────────────────────

function EscaleraTab({ data, equiposById, nombresById, miJugadorId, ahora, onChanged, fireConfetti }: {
  data: QuinielaData
  equiposById: Map<string, QuinielaEquipo>
  nombresById: Map<string, string>
  miJugadorId: string | null
  ahora: number
  onChanged: () => void
  fireConfetti: (n?: number) => void
}) {
  const ventanaActiva = data.config['ventana_activa'] as VentanaCampeon | 'cerrada' | null
  const campeonId = data.config['campeon_id']
  const [pickError, setPickError] = useState('')
  const [isSavingPick, setIsSavingPick] = useState(false)

  const miJugador = data.jugadores.find(j => j.id === miJugadorId)
  const [pichichi, setPichichi] = useState(miJugador?.pichichi || '')
  const [pichichiState, setPichichiState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const deadlineApertura = getAperturaDeadlineMs(data.config, data.partidos)
  const aperturaAbierta = deadlineApertura !== null && ahora < deadlineApertura
  const cierreAperturaMs = deadlineApertura !== null ? deadlineApertura - ahora : 0

  // Equipos elegibles para la ventana activa
  function equiposElegibles(ventana: VentanaCampeon): QuinielaEquipo[] {
    const fase = VENTANA_FASE_ELEGIBLE[ventana]
    if (!fase) return data.equipos
    const ids = new Set<string>()
    for (const p of data.partidos.filter(pt => pt.fase === fase)) {
      if (p.equipo_local_id) ids.add(p.equipo_local_id)
      if (p.equipo_visitante_id) ids.add(p.equipo_visitante_id)
    }
    return data.equipos.filter(e => ids.has(e.id))
  }

  async function handlePick(ventana: VentanaCampeon, equipoId: string) {
    setIsSavingPick(true)
    setPickError('')
    const result = await upsertPickCampeon({ ventana, equipoId })
    setIsSavingPick(false)
    if ('error' in result) setPickError(result.error)
    else { fireConfetti(70); onChanged() }
  }

  async function handlePichichi() {
    setPichichiState('saving')
    const result = await updatePichichi(pichichi)
    setPichichiState('error' in result ? 'error' : 'saved')
  }

  if (!data.soyParticipante) {
    return <p style={{ fontSize: 13, color: Q.textDim }}>Apúntate a la porra para hacer tus picks de campeón.</p>
  }

  return (
    <div style={{ animation: 'q-slideUp .35s ease both' }}>
      <div style={{ ...pixelStyle, fontSize: 11, color: Q.cyan, margin: '4px 2px 4px', textShadow: '0 0 12px rgba(52,227,255,.4)' }}>🪜 CAMINO AL TÍTULO</div>
      <p style={{ fontSize: 11, color: Q.textMid, margin: '0 2px 16px', lineHeight: 1.5 }}>
        Un pick de campeón por ventana, <strong style={{ color: Q.text }}>independiente y acumulable</strong>: si sostienes
        al mismo equipo desde el día 1 hasta cuartos y es campeón, sumas las cinco ventanas
        ({Object.values(PUNTOS_ESCALERA).reduce((a, b) => a + b, 0)} pts).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {VENTANAS.map(ventana => {
          const miPick = data.misPicks.find(p => p.ventana === ventana)
          const equipo = miPick ? equiposById.get(miPick.equipo_id) : undefined
          const activa = ventanaActiva === ventana && (ventana !== 'apertura' || aperturaAbierta)
          const acierto = campeonId && miPick?.equipo_id === campeonId
          const elegibles = activa ? equiposElegibles(ventana) : []
          return (
            <div key={ventana} style={{
              background: acierto ? 'linear-gradient(135deg,#2a1f08,#231836)' : Q.card, borderRadius: 14, padding: '14px 16px',
              border: `1px solid ${activa ? 'rgba(54,245,154,.5)' : acierto ? 'rgba(255,210,63,.4)' : Q.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...labelStyle, color: Q.textMid }}>
                    {VENTANA_LABELS[ventana]}
                    {activa && (
                      <span style={{ color: Q.green, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                        ● abierta{ventana === 'apertura' && ` · 🕐 ${formatCountdown(cierreAperturaMs)}`}
                      </span>
                    )}
                  </p>
                  <p style={{ fontSize: 14, marginTop: 6, color: Q.text }}>
                    {equipo
                      ? <>{equipo.bandera} {equipo.nombre} {acierto && <strong style={{ color: Q.gold }}>✓ ¡Campeón!</strong>}</>
                      : <span style={{ color: Q.textDim }}>{activa ? 'Elige tu campeón ↓' : 'Sin pick'}</span>}
                  </p>
                </div>
                <span style={{ ...pixelStyle, fontSize: 9, whiteSpace: 'nowrap', color: acierto ? Q.gold : Q.textMid }}>
                  {acierto ? `+${PUNTOS_ESCALERA[ventana]}` : PUNTOS_ESCALERA[ventana]}pts
                </span>
              </div>
              {activa && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                  {elegibles.length === 0 && (
                    <p style={{ fontSize: 11, color: Q.textDim }}>Esperando a que se definan los cruces…</p>
                  )}
                  {elegibles.map(eq => (
                    <button
                      key={eq.id}
                      onClick={() => handlePick(ventana, eq.id)}
                      disabled={isSavingPick}
                      style={{
                        background: miPick?.equipo_id === eq.id ? Q.green : Q.cardHi,
                        color: miPick?.equipo_id === eq.id ? '#06210f' : Q.textSoft,
                        border: `1px solid ${miPick?.equipo_id === eq.id ? Q.green : Q.border}`,
                        borderRadius: 20, padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                        opacity: isSavingPick ? 0.6 : 1,
                      }}
                    >
                      {eq.bandera} {eq.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {pickError && <p style={{ fontSize: 11, color: Q.pink, marginTop: 10 }}>{pickError}</p>}

      {/* Pichichi */}
      <div style={{ ...cardStyle, padding: '14px 16px', marginTop: 16 }}>
        <p style={{ ...labelStyle, color: Q.purple, marginBottom: 10 }}>
          ⚽ BONUS PICHICHI · {PUNTOS_PICHICHI} PTS
          {aperturaAbierta && (
            <span style={{ color: Q.pink, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
              🕐 {formatCountdown(cierreAperturaMs)}
            </span>
          )}
        </p>
        {!aperturaAbierta ? (
          <p style={{ fontSize: 13, color: Q.text }}>
            {miJugador?.pichichi
              ? <>⚽ {miJugador.pichichi}</>
              : <span style={{ color: Q.textDim }}>No elegiste pichichi (cerrado).</span>}
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={pichichi}
              onChange={e => { setPichichi(e.target.value); setPichichiState('idle') }}
              placeholder="Máximo goleador del Mundial…"
              style={inputDark}
            />
            <button
              onClick={handlePichichi}
              disabled={pichichiState === 'saving'}
              style={{ background: Q.green, color: '#06210f', border: 'none', borderRadius: 10, padding: '8px 14px', ...labelStyle, fontSize: 9, cursor: 'pointer' }}
            >
              {pichichiState === 'saving' ? '…' : pichichiState === 'saved' ? '✓' : 'GUARDAR'}
            </button>
          </div>
        )}
      </div>

      {/* Picks de la porra */}
      <div style={{ ...cardStyle, padding: '14px 16px', marginTop: 12 }}>
        <p style={{ ...labelStyle, color: Q.textMid, marginBottom: 10 }}>PICKS DE LA PORRA</p>
        {aperturaAbierta ? (
          <p style={{ fontSize: 12, color: Q.textDim }}>Se revelan cuando se cierre la ventana inicial. 🤫</p>
        ) : (
          VENTANAS.map(ventana => {
            const picks = data.picksRevelados.filter(p => p.ventana === ventana)
            if (picks.length === 0) return null
            return (
              <div key={ventana} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 10, color: Q.textDim, marginBottom: 6 }}>{VENTANA_LABELS[ventana]}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {picks.map(pick => {
                    const eq = equiposById.get(pick.equipo_id)
                    return (
                      <span key={pick.id} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: Q.cardHi, border: `1px solid ${Q.border}`, color: Q.textSoft }}>
                        {nombresById.get(pick.jugador_id) || '—'} · {eq?.bandera} {eq?.codigo}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Tab: Admin (reskin ligero, lógica intacta) ──────────────────────────────────

function AdminTab({ data, equiposById, onChanged }: {
  data: QuinielaData
  equiposById: Map<string, QuinielaEquipo>
  onChanged: () => void
}) {
  const [fase, setFase] = useState<QuinielaFase>('grupos')
  const [monto, setMonto] = useState(data.config['monto_entrada'] || '20')
  const [pichichiGanador, setPichichiGanador] = useState(data.config['pichichi_ganador'] || '')
  const ventanaActiva = data.config['ventana_activa'] || 'apertura'

  const partidos = data.partidos.filter(p => p.fase === fase)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'q-slideUp .35s ease both' }}>
      {/* Config */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={adminCardStyle}>
          <p style={adminCardTitleStyle}>Entrada (€)</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={monto} onChange={e => setMonto(e.target.value)} style={adminInputStyle} />
            <button
              onClick={async () => { await updateQuinielaConfig('monto_entrada', monto); onChanged() }}
              style={adminButtonStyle}
            >Guardar</button>
          </div>
        </div>
        <div style={adminCardStyle}>
          <p style={adminCardTitleStyle}>Ventana de pick activa</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([...VENTANAS, 'cerrada'] as (VentanaCampeon | 'cerrada')[]).map(v => (
              <button
                key={v}
                onClick={async () => { await updateVentanaActiva(v); onChanged() }}
                style={{
                  ...adminButtonStyle,
                  background: ventanaActiva === v ? Q.green : Q.cardHi,
                  color: ventanaActiva === v ? '#06210f' : Q.textSoft,
                  border: `1px solid ${ventanaActiva === v ? Q.green : Q.border}`,
                }}
              >
                {v === 'cerrada' ? 'Cerrada' : VENTANA_LABELS[v as VentanaCampeon]}
              </button>
            ))}
          </div>
        </div>
        <div style={adminCardStyle}>
          <p style={adminCardTitleStyle}>Cierre picks iniciales (campeón + pichichi)</p>
          <AperturaDeadlineInput valorActual={data.config['apertura_deadline']} onChanged={onChanged} />
        </div>
        <div style={adminCardStyle}>
          <p style={adminCardTitleStyle}>Pichichi ganador (al acabar)</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={pichichiGanador}
              onChange={e => setPichichiGanador(e.target.value)}
              placeholder="Nombre exacto del jugador"
              style={adminInputStyle}
            />
            <button
              onClick={async () => { await updateQuinielaConfig('pichichi_ganador', pichichiGanador); onChanged() }}
              style={adminButtonStyle}
            >Guardar</button>
          </div>
        </div>
      </div>

      {/* Pagos */}
      <div>
        <p style={adminCardTitleStyle}>Pagos ({data.jugadores.filter(j => j.pagado).length}/{data.jugadores.length})</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {data.jugadores.map(j => (
            <button
              key={j.id}
              onClick={async () => { await updatePagado(j.id, !j.pagado); onChanged() }}
              style={{
                background: j.pagado ? 'rgba(54,245,154,.12)' : Q.cardHi,
                border: `1px solid ${j.pagado ? 'rgba(54,245,154,.5)' : Q.border}`,
                borderRadius: 20, padding: '6px 14px', fontSize: 11, cursor: 'pointer',
                color: j.pagado ? Q.green : Q.textSoft,
              }}
            >
              {j.pagado ? '✓' : '○'} {j.nombre}{j.user_id ? '' : ' (ext)'}
            </button>
          ))}
        </div>
      </div>

      {/* Resultados y cruces */}
      <div>
        <div className="q-scroll" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {FASES_ORDEN.map(f => (
            <button
              key={f}
              onClick={() => setFase(f)}
              style={{
                background: fase === f ? Q.green : Q.cardHi,
                color: fase === f ? '#06210f' : Q.textSoft,
                border: `1px solid ${fase === f ? Q.green : Q.border}`,
                borderRadius: 20, padding: '6px 14px', fontSize: 11, cursor: 'pointer',
              }}
            >
              {FASE_LABELS[f]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {partidos.map(p => (
            <AdminMatchRow key={p.id} partido={p} equipos={data.equipos} equiposById={equiposById} onChanged={onChanged} />
          ))}
        </div>
      </div>
    </div>
  )
}

function AperturaDeadlineInput({ valorActual, onChanged }: {
  valorActual: string | null
  onChanged: () => void
}) {
  // datetime-local trabaja en hora local del navegador
  const toLocal = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const [valor, setValor] = useState(toLocal(valorActual))
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        type="datetime-local"
        value={valor}
        onChange={e => setValor(e.target.value)}
        style={{ ...adminInputStyle, width: 200 }}
      />
      <button
        onClick={async () => {
          if (!valor) return
          await updateQuinielaConfig('apertura_deadline', new Date(valor).toISOString())
          onChanged()
        }}
        style={adminButtonStyle}
      >Guardar</button>
    </div>
  )
}

function AdminMatchRow({ partido, equipos, equiposById, onChanged }: {
  partido: QuinielaPartido
  equipos: QuinielaEquipo[]
  equiposById: Map<string, QuinielaEquipo>
  onChanged: () => void
}) {
  const local = partido.equipo_local_id ? equiposById.get(partido.equipo_local_id) : undefined
  const visitante = partido.equipo_visitante_id ? equiposById.get(partido.equipo_visitante_id) : undefined
  const [golesL, setGolesL] = useState(partido.goles_local != null ? String(partido.goles_local) : '')
  const [golesV, setGolesV] = useState(partido.goles_visitante != null ? String(partido.goles_visitante) : '')
  const [quePasa, setQuePasa] = useState<string | null>(partido.equipo_que_pasa_id)
  const [localId, setLocalId] = useState(partido.equipo_local_id || '')
  const [visitanteId, setVisitanteId] = useState(partido.equipo_visitante_id || '')
  const [estado, setEstado] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const esEliminatoria = partido.fase !== 'grupos'
  const empate = golesL !== '' && golesL === golesV
  const { dia, hora } = formatFechaPartido(partido.fecha_hora)

  async function handleResultado() {
    const gl = parseInt(golesL, 10)
    const gv = parseInt(golesV, 10)
    if (isNaN(gl) || isNaN(gv)) return
    setEstado('saving')
    const result = await updateResultado({
      partidoId: partido.id, golesLocal: gl, golesVisitante: gv,
      equipoQuePasaId: empate ? quePasa : null,
    })
    if ('error' in result) { setEstado('error'); setErrorMsg(result.error) }
    else { setEstado('saved'); setErrorMsg(''); onChanged() }
  }

  async function handleEquipos() {
    setEstado('saving')
    const result = await updatePartidoEquipos({
      partidoId: partido.id,
      equipoLocalId: localId || null,
      equipoVisitanteId: visitanteId || null,
    })
    if ('error' in result) { setEstado('error'); setErrorMsg(result.error) }
    else { setEstado('saved'); setErrorMsg(''); onChanged() }
  }

  return (
    <div style={{ background: Q.card, borderRadius: 12, border: `1px solid ${Q.border}`, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: Q.textDim, minWidth: 90 }}>
          #{partido.numero} · {dia} {hora}h
        </span>

        {/* Cruces sin resolver: asignar equipos */}
        {esEliminatoria && (!local || !visitante) ? (
          <>
            <select value={localId} onChange={e => setLocalId(e.target.value)} style={adminSelectStyle}>
              <option value="">{partido.etiqueta_local || 'Local'}</option>
              {equipos.map(e => <option key={e.id} value={e.id}>{e.bandera} {e.nombre}</option>)}
            </select>
            <span style={{ fontSize: 11, color: Q.textDim }}>vs</span>
            <select value={visitanteId} onChange={e => setVisitanteId(e.target.value)} style={adminSelectStyle}>
              <option value="">{partido.etiqueta_visitante || 'Visitante'}</option>
              {equipos.map(e => <option key={e.id} value={e.id}>{e.bandera} {e.nombre}</option>)}
            </select>
            <button onClick={handleEquipos} style={adminButtonStyle}>Asignar</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: Q.text, minWidth: 120, textAlign: 'right' }}>
              {local?.bandera} {local?.nombre || partido.etiqueta_local}
            </span>
            <input type="number" min={0} value={golesL} onChange={e => setGolesL(e.target.value)} style={{ ...adminScoreStyle }} />
            <span style={{ color: Q.textDim }}>–</span>
            <input type="number" min={0} value={golesV} onChange={e => setGolesV(e.target.value)} style={{ ...adminScoreStyle }} />
            <span style={{ fontSize: 12, color: Q.text, minWidth: 120 }}>
              {visitante?.bandera} {visitante?.nombre || partido.etiqueta_visitante}
            </span>
            {esEliminatoria && empate && local && visitante && (
              <select value={quePasa || ''} onChange={e => setQuePasa(e.target.value || null)} style={adminSelectStyle}>
                <option value="">¿Quién pasó?</option>
                <option value={local.id}>{local.nombre}</option>
                <option value={visitante.id}>{visitante.nombre}</option>
              </select>
            )}
            <button onClick={handleResultado} disabled={estado === 'saving'} style={{ ...adminButtonStyle, background: Q.green, color: '#06210f', border: 0 }}>
              {estado === 'saving' ? '…' : partido.estado === 'finalizado' ? 'Recalcular' : 'Cerrar partido'}
            </button>
            {partido.estado === 'finalizado' && <span style={{ fontSize: 10, color: Q.green }}>✓ finalizado</span>}
            {estado === 'error' && <span style={{ fontSize: 10, color: Q.pink }}>{errorMsg}</span>}
          </>
        )}
      </div>
    </div>
  )
}

const inputDark: React.CSSProperties = {
  flex: 1, border: `1px solid ${Q.borderHi}`, borderRadius: 10, padding: '9px 12px',
  fontSize: 13, outline: 'none', color: Q.text, background: Q.cardHi, fontFamily: FONT.body,
}
const adminCardStyle: React.CSSProperties = {
  background: Q.card, borderRadius: 12, border: `1px solid ${Q.border}`, padding: '14px 16px', minWidth: 220,
}
const adminCardTitleStyle: React.CSSProperties = {
  ...labelStyle, fontSize: 9, marginBottom: 10,
}
const adminInputStyle: React.CSSProperties = {
  border: `1px solid ${Q.borderHi}`, borderRadius: 8, padding: '7px 10px', fontSize: 12,
  outline: 'none', color: Q.text, background: Q.cardHi, width: 150, fontFamily: FONT.body,
}
const adminScoreStyle: React.CSSProperties = {
  width: 40, height: 30, textAlign: 'center', fontSize: 14, color: Q.text,
  border: `1px solid ${Q.borderHi}`, borderRadius: 8, background: Q.cardHi, outline: 'none',
}
const adminButtonStyle: React.CSSProperties = {
  background: Q.cardHi, border: `1px solid ${Q.border}`, borderRadius: 8, padding: '7px 12px',
  fontSize: 11, cursor: 'pointer', color: Q.textSoft,
}
const adminSelectStyle: React.CSSProperties = {
  border: `1px solid ${Q.borderHi}`, borderRadius: 8, padding: '6px 8px', fontSize: 11,
  outline: 'none', color: Q.text, background: Q.cardHi, maxWidth: 180,
}
