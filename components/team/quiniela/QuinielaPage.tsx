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

const C = {
  ink: '#1A1A1A',
  cream: '#F8F7F4',
  accent: '#D85A30',
  border: '#F0EEE8',
  green: '#3D8B5F',
}

type Tab = 'partidos' | 'clasificacion' | 'escalera' | 'stats' | 'admin'
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
  const [tab, setTab] = useState<Tab>('partidos')
  const [isJoining, setIsJoining] = useState(false)
  const [verReglas, setVerReglas] = useState(false)
  const [onboardingCerrado, setOnboardingCerrado] = useState(false)

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
    if ('success' in result) router.refresh()
  }

  async function handleLogout() {
    await logoutJugadorExterno()
    router.refresh()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'partidos', label: 'Partidos' },
    { key: 'clasificacion', label: 'Clasificación' },
    { key: 'escalera', label: 'Mi escalera' },
    { key: 'stats', label: 'Stats' },
    ...(isPartner ? [{ key: 'admin' as Tab, label: 'Admin' }] : []),
  ]

  return (
    <div style={{ padding: esExterno ? '32px 20px' : '40px 48px', maxWidth: 1100, margin: esExterno ? '0 auto' : undefined }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1A1A1A99', marginBottom: 8 }}>
            Forma Prima · Mundial 2026
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 300, color: C.ink, marginBottom: 4, letterSpacing: '-0.02em' }}>
            La Porra del Mundial <span style={{ fontSize: 22 }}>⚽</span>
          </h1>
          <p style={{ fontSize: 13, color: '#1A1A1A60', fontWeight: 300 }}>
            {miNombre ? <>Hola, <strong style={{ fontWeight: 500 }}>{miNombre}</strong> · </> : null}
            <button
              onClick={() => setVerReglas(true)}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: C.accent, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Ver reglas
            </button>
            {esExterno && (
              <>
                {' · '}
                <button
                  onClick={handleLogout}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: '#1A1A1A60', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Salir
                </button>
              </>
            )}
          </p>
        </div>
        <div style={{
          background: C.ink, color: '#fff', borderRadius: 4, padding: '14px 20px',
          display: 'flex', gap: 24, alignItems: 'center',
        }}>
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff80', marginBottom: 2 }}>Bote</p>
            <p style={{ fontSize: 22, fontWeight: 500 }}>{bote.toFixed(0)} €</p>
          </div>
          <div style={{ width: 1, height: 32, background: '#ffffff25' }} />
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff80', marginBottom: 2 }}>Reparto</p>
            <p style={{ fontSize: 12, fontWeight: 300 }}>
              🥇 {(bote * reparto[0] / 100).toFixed(0)}€ · 🥈 {(bote * (reparto[1] || 0) / 100).toFixed(0)}€ · 🥉 {(bote * (reparto[2] || 0) / 100).toFixed(0)}€
            </p>
          </div>
        </div>
      </div>

      {/* ── Join banner (solo staff FP que aún no se apuntó) ── */}
      {!data.soyParticipante && !esExterno && (
        <div style={{
          marginTop: 24, background: '#D85A3010', border: `1px solid #D85A3030`,
          borderRadius: 4, padding: '16px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <p style={{ fontSize: 13, color: C.ink }}>
            Aún no estás dentro. Entrada: <strong>{monto.toFixed(0)} €</strong> — al apuntarte te
            comprometes a pagarla aunque no rellenes tus predicciones a tiempo.
          </p>
          <button
            onClick={handleJoin}
            disabled={isJoining}
            style={{
              background: C.accent, color: '#fff', border: 'none', borderRadius: 4,
              padding: '10px 22px', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
              fontWeight: 500, cursor: 'pointer', opacity: isJoining ? 0.6 : 1,
            }}
          >
            {isJoining ? 'Entrando…' : 'Apuntarme'}
          </button>
        </div>
      )}

      {/* ── Chat ── */}
      <QuinielaChat
        comentarios={data.comentarios}
        reacciones={data.reacciones}
        nombresById={nombresById}
        miJugadorId={miJugadorId}
        esPartner={isPartner}
        onChanged={() => router.refresh()}
      />

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginTop: 32, borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              padding: '10px 16px', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
              fontWeight: tab === t.key ? 500 : 300,
              color: tab === t.key ? C.ink : '#1A1A1A70',
              borderBottom: tab === t.key ? `2px solid ${C.accent}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        {tab === 'partidos' && (
          <PartidosTab data={data} equiposById={equiposById} nombresById={nombresById} miJugadorId={miJugadorId} ahora={ahora} />
        )}
        {tab === 'clasificacion' && (
          <ClasificacionTab data={data} bote={bote} reparto={reparto} miJugadorId={miJugadorId} equiposById={equiposById} />
        )}
        {tab === 'escalera' && (
          <EscaleraTab data={data} equiposById={equiposById} nombresById={nombresById} miJugadorId={miJugadorId} ahora={ahora} onChanged={() => router.refresh()} />
        )}
        {tab === 'stats' && (
          <QuinielaStats data={data} nombresById={nombresById} miJugadorId={miJugadorId} />
        )}
        {tab === 'admin' && isPartner && (
          <AdminTab data={data} equiposById={equiposById} onChanged={() => router.refresh()} />
        )}
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
      <span style={{ fontSize: 20, lineHeight: 1 }}>{equipo?.bandera || '⏳'}</span>
      <span style={{
        fontSize: 13, fontWeight: 400, color: equipo ? C.ink : '#1A1A1A50',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {equipo?.nombre || etiqueta || 'Por definir'}
      </span>
    </div>
  )
}

// ── Tab: Partidos ─────────────────────────────────────────────────────────────

function PartidosTab({ data, equiposById, nombresById, miJugadorId, ahora }: {
  data: QuinielaData
  equiposById: Map<string, QuinielaEquipo>
  nombresById: Map<string, string>
  miJugadorId: string | null
  ahora: number
}) {
  const [fase, setFase] = useState<QuinielaFase>('grupos')
  const [diasAbiertos, setDiasAbiertos] = useState<Record<string, boolean>>({})

  const partidos = data.partidos.filter(p => p.fase === fase)
  const visibles = partidos

  const predichos = partidos.filter(p =>
    data.misPredicciones.some(pred => pred.partido_id === p.id)
  ).length

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FASES_ORDEN.map(f => (
            <button
              key={f}
              onClick={() => setFase(f)}
              style={{
                background: fase === f ? C.ink : '#fff',
                color: fase === f ? '#fff' : '#1A1A1A90',
                border: `1px solid ${fase === f ? C.ink : C.border}`,
                borderRadius: 20, padding: '6px 14px', fontSize: 11, cursor: 'pointer',
                fontWeight: fase === f ? 500 : 300,
              }}
            >
              {FASE_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#1A1A1A60', marginBottom: 6 }}>
        {FASE_LABELS[fase]}: acierto de {fase === 'grupos' ? 'resultado' : 'quién pasa'}{' '}
        <strong>{PUNTOS_PARTIDO[fase].resultado} pts</strong> · marcador exacto{' '}
        <strong>{PUNTOS_PARTIDO[fase].exacto} pts</strong>
        {fase !== 'grupos' && ' · marcador al final de la prórroga, sin penaltis'}
        . Las predicciones se cierran <strong>1 hora antes</strong> de cada partido.
      </p>
      {miJugadorId && (
        <p style={{ fontSize: 11, color: predichos === partidos.length ? C.green : C.accent, marginBottom: 20 }}>
          Has guardado {predichos} de {partidos.length} predicciones de esta fase.
        </p>
      )}

      {visibles.length === 0 && (
        <p style={{ fontSize: 13, color: '#1A1A1A50', padding: '32px 0' }}>
          No hay partidos en esta fase.
        </p>
      )}

      {Array.from(porDia.entries()).map(([dia, partidosDia]) => {
        // Días con todo terminado salen colapsados por defecto; clic en el día para plegar/desplegar
        const todosTerminados = partidosDia.every(p => p.estado === 'finalizado')
        const abierto = diasAbiertos[dia] ?? !todosTerminados
        return (
          <div key={dia} style={{ marginBottom: abierto ? 28 : 10 }}>
            <button
              onClick={() => setDiasAbiertos(prev => ({ ...prev, [dia]: !abierto }))}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: abierto ? 10 : 0,
              }}
            >
              <span style={{
                fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#1A1A1A70', fontWeight: 500,
              }}>
                {abierto ? '▾' : '▸'} {dia}
              </span>
              <span style={{ fontSize: 10, color: '#1A1A1A45' }}>
                {partidosDia.length} {partidosDia.length === 1 ? 'partido' : 'partidos'}
                {todosTerminados && ' · ✓ jugados'}
              </span>
            </button>
            {abierto && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {partidosDia.map(p => (
                  <MatchCard
                    key={p.id}
                    partido={p}
                    equiposById={equiposById}
                    nombresById={nombresById}
                    data={data}
                    miJugadorId={miJugadorId}
                    ahora={ahora}
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

function MatchCard({ partido, equiposById, nombresById, data, miJugadorId, ahora }: {
  partido: QuinielaPartido
  equiposById: Map<string, QuinielaEquipo>
  nombresById: Map<string, string>
  data: QuinielaData
  miJugadorId: string | null
  ahora: number
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

  return (
    <div style={{ background: '#fff', borderRadius: 4, border: `1px solid ${saveState === 'error' ? '#D85A3060' : C.border}`, padding: '14px 18px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: 16, alignItems: 'center' }}>
        <EquipoLabel equipo={local} etiqueta={partido.etiqueta_local} align="right" />

        {/* Centro: resultado o inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', minWidth: 110 }}>
          {empezado ? (
            <span style={{ fontSize: 17, fontWeight: 500, color: C.ink, letterSpacing: '0.05em', textAlign: 'center' }}>
              {partido.estado === 'finalizado'
                ? `${partido.goles_local} – ${partido.goles_visitante}`
                : live
                  ? <>
                      {live.gl} – {live.gv}
                      <span style={{ display: 'block', fontSize: 10, color: C.accent, fontWeight: 500, marginTop: 2 }}>
                        🔴 {live.minuto || 'en juego'}
                      </span>
                    </>
                  : <span style={{ color: C.accent, fontSize: 13 }}>🔴 En juego</span>}
            </span>
          ) : puedoPredecirlo ? (
            <>
              <input
                type="number" min={0} max={20} value={golesL}
                onChange={e => { setGolesL(e.target.value); onCambio(e.target.value, golesV, quePasa) }}
                style={scoreInputStyle}
              />
              <span style={{ color: '#1A1A1A40', fontSize: 13 }}>–</span>
              <input
                type="number" min={0} max={20} value={golesV}
                onChange={e => { setGolesV(e.target.value); onCambio(golesL, e.target.value, quePasa) }}
                style={scoreInputStyle}
              />
            </>
          ) : bloqueado && miPred ? (
            <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A80' }}>
              🔒 {miPred.goles_local} – {miPred.goles_visitante}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: '#1A1A1A40' }}>{bloqueado ? '🔒 Cerrado' : `${hora}h`}</span>
          )}
        </div>

        <EquipoLabel equipo={visitante} etiqueta={partido.etiqueta_visitante} />

        {/* Estado derecho: botón guardar + estado */}
        <div style={{ textAlign: 'right', minWidth: 110 }}>
          {empezado ? (
            <MiPuntuacion partido={partido} data={data} live={live} />
          ) : puedoPredecirlo ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <button
                onClick={() => guardar(golesL, golesV, quePasa)}
                disabled={saveState === 'guardando' || saveState === 'guardada' || saveState === 'vacia'}
                style={{
                  background: saveState === 'guardada' ? '#3D8B5F12' : saveState === 'sin_guardar' || saveState === 'error' ? C.accent : '#fff',
                  color: saveState === 'guardada' ? C.green : saveState === 'sin_guardar' || saveState === 'error' ? '#fff' : '#1A1A1A60',
                  border: `1px solid ${saveState === 'guardada' ? '#3D8B5F40' : saveState === 'sin_guardar' || saveState === 'error' ? C.accent : C.border}`,
                  borderRadius: 4, padding: '6px 14px', fontSize: 11, fontWeight: 500,
                  cursor: saveState === 'sin_guardar' || saveState === 'error' ? 'pointer' : 'default',
                }}
              >
                {saveState === 'guardando' ? 'Guardando…'
                  : saveState === 'guardada' ? '✓ Guardada'
                  : saveState === 'error' ? 'Reintentar'
                  : saveState === 'sin_guardar' ? 'Guardar'
                  : 'Sin predicción'}
              </button>
              <p style={{ fontSize: 9, color: cierraPronto ? C.accent : '#1A1A1A40', fontWeight: cierraPronto ? 500 : 400 }}>
                {hora}h · 🕐 cierra en {formatCountdown(cierreMs)}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 11, color: '#1A1A1A50' }}>
              {hora}h
              {bloqueado && !empezado ? ' · 🔒' : ''}
              {bloqueado && !miPred ? ' · sin predicción' : ''}
              {!bloqueado && cierreMs > 0 ? ` · cierra en ${formatCountdown(cierreMs)}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Empate en eliminatoria: elegir quién pasa */}
      {!bloqueado && puedoPredecirlo && empateElim && local && visitante && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: '#1A1A1A70' }}>¿Quién pasa?</span>
          {[local, visitante].map(eq => (
            <button
              key={eq.id}
              onClick={() => { setQuePasa(eq.id); guardar(golesL, golesV, eq.id) }}
              style={{
                background: quePasa === eq.id ? C.ink : '#fff',
                color: quePasa === eq.id ? '#fff' : C.ink,
                border: `1px solid ${quePasa === eq.id ? C.ink : C.border}`,
                borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer',
              }}
            >
              {eq.bandera} {eq.nombre}
            </button>
          ))}
        </div>
      )}

      {saveError && (
        <p style={{ fontSize: 11, color: C.accent, marginTop: 8, textAlign: 'center' }}>{saveError}</p>
      )}

      {/* Qué está en juego: análisis de predicciones del partido bloqueado */}
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

      {/* Predicciones reveladas (desde que el partido se bloquea, 1 h antes) */}
      {bloqueado && prediccionesPartido.length > 0 && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <button
            onClick={() => setVerPredicciones(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#1A1A1A60', padding: 0 }}
          >
            {verPredicciones ? '▾' : '▸'} Predicciones de la porra ({prediccionesPartido.length})
          </button>
          {verPredicciones && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {prediccionesPartido.map(pred => (
                <span key={pred.id} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 20,
                  background: pred.jugador_id === miJugadorId ? '#D85A3015' : C.cream,
                  border: `1px solid ${pred.jugador_id === miJugadorId ? '#D85A3040' : C.border}`,
                  color: C.ink,
                }}>
                  {nombresById.get(pred.jugador_id) || '—'} · {pred.goles_local}-{pred.goles_visitante}
                  {partido.estado === 'finalizado' ? (
                    <strong style={{ color: (pred.puntos ?? 0) > 0 ? C.green : '#1A1A1A40', marginLeft: 6 }}>
                      +{pred.puntos ?? 0}
                    </strong>
                  ) : live ? (
                    <span style={{ color: (puntosProvisionales(pred) ?? 0) > 0 ? C.green : '#1A1A1A40', marginLeft: 6, fontSize: 10 }}>
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
    <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
      <button
        onClick={() => setAbierto(v => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.accent, fontWeight: 500, padding: 0 }}
      >
        {abierto ? '▾' : '▸'} ⚡ Qué está en juego
      </button>
      {abierto && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filas.map(f => (
            <p key={f.label} style={{ fontSize: 11, color: C.ink, lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 600 }}>{f.label}</strong>
              <span style={{ color: '#1A1A1A50' }}> (+{pts.resultado}, exacto +{pts.exacto})</span>
              {' → '}
              {f.gente.length ? f.gente.join(' · ') : <span style={{ color: '#1A1A1A40' }}>nadie</span>}
            </p>
          ))}
          {sinPrediccion.length > 0 && (
            <p style={{ fontSize: 11, color: '#1A1A1A50' }}>
              😴 Sin mojarse: {sinPrediccion.join(' · ')}
            </p>
          )}
          {esEliminatoria && [local, visitante].map(eq => {
            const riesgo = escaleraEnRiesgo(eq.id)
            if (!riesgo.length) return null
            return (
              <p key={eq.id} style={{ fontSize: 11, color: C.accent }}>
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
  if (!miPred) return <p style={{ fontSize: 11, color: '#1A1A1A40' }}>Sin predicción</p>
  const provisional = partido.estado !== 'finalizado' && live
    ? calcPuntosPrediccion(
        { ...partido, goles_local: live.gl, goles_visitante: live.gv, equipo_que_pasa_id: null },
        miPred
      )
    : null
  return (
    <div>
      <p style={{ fontSize: 11, color: '#1A1A1A60' }}>Tú: {miPred.goles_local}-{miPred.goles_visitante}</p>
      {partido.estado === 'finalizado' ? (
        <p style={{
          fontSize: 13, fontWeight: 500, marginTop: 2,
          color: (miPred.puntos ?? 0) > 0 ? C.green : '#1A1A1A40',
        }}>
          +{miPred.puntos ?? 0} pts
        </p>
      ) : provisional !== null ? (
        <p style={{
          fontSize: 11, fontWeight: 500, marginTop: 2,
          color: provisional > 0 ? C.green : '#1A1A1A40',
        }}>
          +{provisional} si queda así
        </p>
      ) : null}
    </div>
  )
}

const scoreInputStyle: React.CSSProperties = {
  width: 44, height: 36, textAlign: 'center', fontSize: 15, fontWeight: 500,
  border: `1px solid #E5E2DA`, borderRadius: 4, color: '#1A1A1A',
  background: '#FDFDFC', outline: 'none',
}

// ── Tab: Clasificación ────────────────────────────────────────────────────────

function ClasificacionTab({ data, bote, reparto, miJugadorId, equiposById }: {
  data: QuinielaData
  bote: number
  reparto: number[]
  miJugadorId: string | null
  equiposById: Map<string, QuinielaEquipo>
}) {
  const medallas = ['🥇', '🥈', '🥉']
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
    <div>
      {data.leaderboard.length === 0 && (
        <p style={{ fontSize: 13, color: '#1A1A1A50' }}>Todavía no hay jugadores.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.leaderboard.map((row, i) => {
          const esYo = row.jugador_id === miJugadorId
          const premio = i < reparto.length ? bote * reparto[i] / 100 : 0
          const abierto = expandido === row.jugador_id
          return (
            <div key={row.jugador_id}>
              <div
                onClick={() => setExpandido(abierto ? null : row.jugador_id)}
                style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr auto auto 18px', gap: 16, alignItems: 'center',
                  background: esYo ? '#D85A3008' : '#fff',
                  border: `1px solid ${esYo ? '#D85A3030' : C.border}`,
                  borderRadius: abierto ? '4px 4px 0 0' : 4, padding: '14px 18px', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: i < 3 ? 18 : 13, fontWeight: 500, color: '#1A1A1A70', textAlign: 'center' }}>
                  {i < 3 ? medallas[i] : i + 1}
                </span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: esYo ? 500 : 400, color: C.ink }}>
                    {row.nombre} {esYo && <span style={{ fontSize: 10, color: C.accent }}>(tú)</span>}
                    {!row.pagado && (
                      <span style={{ fontSize: 9, marginLeft: 8, padding: '2px 8px', borderRadius: 20, background: '#D85A3015', color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        pendiente de pago
                      </span>
                    )}
                  </p>
                  <p style={{ fontSize: 10, color: '#1A1A1A50', marginTop: 2 }}>
                    Partidos {row.puntos_partidos} · Escalera {row.puntos_escalera} · Pichichi {row.puntos_pichichi} · {row.exactos} exactos
                  </p>
                </div>
                {premio > 0 ? (
                  <span style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>{premio.toFixed(0)} €</span>
                ) : <span />}
                <span style={{ fontSize: 18, fontWeight: 500, color: C.ink, minWidth: 60, textAlign: 'right' }}>
                  {row.total} <span style={{ fontSize: 10, fontWeight: 300, color: '#1A1A1A50' }}>pts</span>
                </span>
                <span style={{ fontSize: 10, color: '#1A1A1A40', textAlign: 'center', transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
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
      <p style={{ fontSize: 10, color: '#1A1A1A50', marginTop: 16 }}>
        Toca un jugador para ver su historial partido a partido. Desempate: total → marcadores
        exactos → aciertos en eliminatorias. El reparto del bote es {reparto.join(' / ')} % entre los tres primeros.
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
      <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 4px 4px', background: '#FBFAF8', padding: '12px 18px' }}>
        <p style={{ fontSize: 11, color: '#1A1A1A50' }}>Aún no hay partidos cerrados.</p>
      </div>
    )
  }
  return (
    <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 4px 4px', background: '#FBFAF8', padding: '8px 18px 12px', display: 'flex', flexDirection: 'column' }}>
      {finalizados.map(p => {
        const pred = preds?.get(p.id)
        const pts = pred?.puntos ?? 0
        const exacto = pred && pred.goles_local === p.goles_local && pred.goles_visitante === p.goles_visitante
        return (
          <div key={p.id} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center',
            padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontSize: 11,
          }}>
            <span style={{ color: C.ink }}>
              <span style={{ color: '#1A1A1A40', marginRight: 6 }}>#{p.numero}</span>
              {cod(p.equipo_local_id)} {p.goles_local}–{p.goles_visitante} {cod(p.equipo_visitante_id)}
            </span>
            <span style={{ color: pred ? '#1A1A1A70' : '#1A1A1A35' }}>
              {pred ? `tú: ${pred.goles_local}–${pred.goles_visitante}` : 'sin pronóstico'}
            </span>
            <span style={{
              minWidth: 70, textAlign: 'right', fontWeight: 500,
              color: pts > 0 ? C.green : '#1A1A1A35',
            }}>
              {pts > 0 ? `+${pts} pts` : '0'}{exacto && <span title="marcador exacto"> 🎯</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Mi escalera ──────────────────────────────────────────────────────────

function EscaleraTab({ data, equiposById, nombresById, miJugadorId, ahora, onChanged }: {
  data: QuinielaData
  equiposById: Map<string, QuinielaEquipo>
  nombresById: Map<string, string>
  miJugadorId: string | null
  ahora: number
  onChanged: () => void
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
    else onChanged()
  }

  async function handlePichichi() {
    setPichichiState('saving')
    const result = await updatePichichi(pichichi)
    setPichichiState('error' in result ? 'error' : 'saved')
  }

  if (!data.soyParticipante) {
    return <p style={{ fontSize: 13, color: '#1A1A1A50' }}>Apúntate a la porra para hacer tus picks de campeón.</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 32, alignItems: 'start' }}>
      {/* Escalera */}
      <div>
        <p style={{ fontSize: 11, color: '#1A1A1A60', marginBottom: 16, lineHeight: 1.6 }}>
          Un pick de campeón por ventana, <strong>independiente y acumulable</strong>: si sostienes
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
                background: '#fff', borderRadius: 4, padding: '16px 20px',
                border: `1px solid ${activa ? '#D85A3050' : C.border}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60' }}>
                      {VENTANA_LABELS[ventana]}
                      {activa && (
                        <span style={{ color: C.accent, marginLeft: 8 }}>
                          ● abierta{ventana === 'apertura' && ` · 🕐 cierra en ${formatCountdown(cierreAperturaMs)}`}
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 14, marginTop: 6, color: C.ink }}>
                      {equipo
                        ? <>{equipo.bandera} {equipo.nombre} {acierto && <strong style={{ color: C.green }}>✓ ¡Campeón!</strong>}</>
                        : <span style={{ color: '#1A1A1A40' }}>{activa ? 'Elige tu campeón ↓' : 'Sin pick'}</span>}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                    color: acierto ? C.green : '#1A1A1A70',
                  }}>
                    {acierto ? `+${PUNTOS_ESCALERA[ventana]}` : PUNTOS_ESCALERA[ventana]} pts
                  </span>
                </div>
                {activa && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                    {elegibles.length === 0 && (
                      <p style={{ fontSize: 11, color: '#1A1A1A50' }}>Esperando a que se definan los cruces…</p>
                    )}
                    {elegibles.map(eq => (
                      <button
                        key={eq.id}
                        onClick={() => handlePick(ventana, eq.id)}
                        disabled={isSavingPick}
                        style={{
                          background: miPick?.equipo_id === eq.id ? C.ink : '#fff',
                          color: miPick?.equipo_id === eq.id ? '#fff' : C.ink,
                          border: `1px solid ${miPick?.equipo_id === eq.id ? C.ink : C.border}`,
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
        {pickError && <p style={{ fontSize: 11, color: C.accent, marginTop: 10 }}>{pickError}</p>}
      </div>

      {/* Columna derecha: pichichi + picks de la porra */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 4, padding: '16px 20px', border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 10 }}>
            Bonus Pichichi · {PUNTOS_PICHICHI} pts
            {aperturaAbierta && (
              <span style={{ color: C.accent, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                🕐 cierra en {formatCountdown(cierreAperturaMs)}
              </span>
            )}
          </p>
          {!aperturaAbierta ? (
            <p style={{ fontSize: 13, color: C.ink }}>
              {miJugador?.pichichi
                ? <>⚽ {miJugador.pichichi}</>
                : <span style={{ color: '#1A1A1A40' }}>No elegiste pichichi (cerrado).</span>}
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={pichichi}
                onChange={e => { setPichichi(e.target.value); setPichichiState('idle') }}
                placeholder="Máximo goleador del Mundial…"
                style={{
                  flex: 1, border: `1px solid #E5E2DA`, borderRadius: 4, padding: '8px 12px',
                  fontSize: 12, outline: 'none', color: C.ink, background: '#FDFDFC',
                }}
              />
              <button
                onClick={handlePichichi}
                disabled={pichichiState === 'saving'}
                style={{
                  background: C.ink, color: '#fff', border: 'none', borderRadius: 4,
                  padding: '8px 14px', fontSize: 11, cursor: 'pointer',
                }}
              >
                {pichichiState === 'saving' ? '…' : pichichiState === 'saved' ? '✓' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 4, padding: '16px 20px', border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 10 }}>
            Picks de la porra
          </p>
          {aperturaAbierta ? (
            <p style={{ fontSize: 12, color: '#1A1A1A50' }}>
              Se revelan cuando se cierre la ventana inicial. 🤫
            </p>
          ) : (
            VENTANAS.map(ventana => {
              const picks = data.picksRevelados.filter(p => p.ventana === ventana)
              if (picks.length === 0) return null
              return (
                <div key={ventana} style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 10, color: '#1A1A1A50', marginBottom: 6 }}>{VENTANA_LABELS[ventana]}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {picks.map(pick => {
                      const eq = equiposById.get(pick.equipo_id)
                      return (
                        <span key={pick.id} style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 20,
                          background: C.cream, border: `1px solid ${C.border}`, color: C.ink,
                        }}>
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
    </div>
  )
}

// ── Tab: Admin ────────────────────────────────────────────────────────────────

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Config */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
                  background: ventanaActiva === v ? C.accent : '#fff',
                  color: ventanaActiva === v ? '#fff' : C.ink,
                  border: `1px solid ${ventanaActiva === v ? C.accent : C.border}`,
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
                background: j.pagado ? '#3D8B5F12' : '#fff',
                border: `1px solid ${j.pagado ? '#3D8B5F50' : C.border}`,
                borderRadius: 20, padding: '6px 14px', fontSize: 11, cursor: 'pointer',
                color: j.pagado ? C.green : '#1A1A1A70',
              }}
            >
              {j.pagado ? '✓' : '○'} {j.nombre}{j.user_id ? '' : ' (ext)'}
            </button>
          ))}
        </div>
      </div>

      {/* Resultados y cruces */}
      <div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {FASES_ORDEN.map(f => (
            <button
              key={f}
              onClick={() => setFase(f)}
              style={{
                background: fase === f ? C.ink : '#fff',
                color: fase === f ? '#fff' : '#1A1A1A90',
                border: `1px solid ${fase === f ? C.ink : C.border}`,
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
    <div style={{ background: '#fff', borderRadius: 4, border: `1px solid ${C.border}`, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: '#1A1A1A50', minWidth: 90 }}>
          #{partido.numero} · {dia} {hora}h
        </span>

        {/* Cruces sin resolver: asignar equipos */}
        {esEliminatoria && (!local || !visitante) ? (
          <>
            <select value={localId} onChange={e => setLocalId(e.target.value)} style={adminSelectStyle}>
              <option value="">{partido.etiqueta_local || 'Local'}</option>
              {equipos.map(e => <option key={e.id} value={e.id}>{e.bandera} {e.nombre}</option>)}
            </select>
            <span style={{ fontSize: 11, color: '#1A1A1A40' }}>vs</span>
            <select value={visitanteId} onChange={e => setVisitanteId(e.target.value)} style={adminSelectStyle}>
              <option value="">{partido.etiqueta_visitante || 'Visitante'}</option>
              {equipos.map(e => <option key={e.id} value={e.id}>{e.bandera} {e.nombre}</option>)}
            </select>
            <button onClick={handleEquipos} style={adminButtonStyle}>Asignar</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: C.ink, minWidth: 140, textAlign: 'right' }}>
              {local?.bandera} {local?.nombre || partido.etiqueta_local}
            </span>
            <input type="number" min={0} value={golesL} onChange={e => setGolesL(e.target.value)} style={{ ...scoreInputStyle, width: 40, height: 30 }} />
            <span style={{ color: '#1A1A1A40' }}>–</span>
            <input type="number" min={0} value={golesV} onChange={e => setGolesV(e.target.value)} style={{ ...scoreInputStyle, width: 40, height: 30 }} />
            <span style={{ fontSize: 12, color: C.ink, minWidth: 140 }}>
              {visitante?.bandera} {visitante?.nombre || partido.etiqueta_visitante}
            </span>
            {esEliminatoria && empate && local && visitante && (
              <select value={quePasa || ''} onChange={e => setQuePasa(e.target.value || null)} style={adminSelectStyle}>
                <option value="">¿Quién pasó?</option>
                <option value={local.id}>{local.nombre}</option>
                <option value={visitante.id}>{visitante.nombre}</option>
              </select>
            )}
            <button onClick={handleResultado} disabled={estado === 'saving'} style={{ ...adminButtonStyle, background: C.ink, color: '#fff' }}>
              {estado === 'saving' ? '…' : partido.estado === 'finalizado' ? 'Recalcular' : 'Cerrar partido'}
            </button>
            {partido.estado === 'finalizado' && <span style={{ fontSize: 10, color: C.green }}>✓ finalizado</span>}
            {estado === 'error' && <span style={{ fontSize: 10, color: C.accent }}>{errorMsg}</span>}
          </>
        )}
      </div>
    </div>
  )
}

const adminCardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 4, border: `1px solid #F0EEE8`, padding: '14px 18px', minWidth: 220,
}
const adminCardTitleStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A60', marginBottom: 10,
}
const adminInputStyle: React.CSSProperties = {
  border: `1px solid #E5E2DA`, borderRadius: 4, padding: '7px 10px', fontSize: 12,
  outline: 'none', color: '#1A1A1A', background: '#FDFDFC', width: 150,
}
const adminButtonStyle: React.CSSProperties = {
  background: '#fff', border: `1px solid #F0EEE8`, borderRadius: 4, padding: '7px 12px',
  fontSize: 11, cursor: 'pointer', color: '#1A1A1A',
}
const adminSelectStyle: React.CSSProperties = {
  border: `1px solid #E5E2DA`, borderRadius: 4, padding: '6px 8px', fontSize: 11,
  outline: 'none', color: '#1A1A1A', background: '#FDFDFC', maxWidth: 180,
}
