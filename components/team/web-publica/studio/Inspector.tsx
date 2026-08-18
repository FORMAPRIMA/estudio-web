'use client'

// Modo Diseño — inspector del bloque seleccionado.
//
// Solo aparece cuando hay algo seleccionado, y solo ofrece los gestos que el
// esquema declara para ese bloque. Nada de campos CSS libres: el tamaño va por
// PASOS sobre el token del sistema, así el resultado siempre pertenece a la
// escala tipográfica del estudio y sigue siendo responsive.

import {
  ESCALA_MAX, ESCALA_MIN, escalaFactor,
  type AlignKey, type BlockEstilo, type BlockEstiloPatch, type PesoKey, type TrackKey,
} from '@/lib/web-publica'
import { datosDeViewport, type SeleccionBloque, type ViewportId } from '@/lib/web-publica-studio'

const INK = '#1A1A1A'
const ORANGE = '#D85A30'
const BORDER = '#F0EEE8'

const TRACKINGS: [TrackKey, string][] = [['tight', 'Justo'], ['normal', 'Normal'], ['wide', 'Ancho'], ['ultra', 'Ultra']]
const PESOS: [PesoKey, string][] = [[300, 'Light'], [400, 'Regular'], [700, 'Bold']]
const ALIGNS: [AlignKey, string][] = [['left', 'Izq.'], ['center', 'Centro'], ['right', 'Der.']]

export function Inspector({
  bloque, viewport, onPatch, onReset, onMostrar,
}: {
  bloque: SeleccionBloque
  viewport: ViewportId
  onPatch: (patch: BlockEstiloPatch) => void
  onReset: () => void
  onMostrar: () => void
}) {
  const est = bloque.estilo
  const enMovil = datosDeViewport(viewport) === 'mobile'
  const escala = est.escala ?? 0
  const puede = (g: string) => bloque.gestos.includes(g as never)

  /** ¿El valor que se ve viene heredado del escritorio en vez de ser propio? */
  const heredado = (campo: keyof BlockEstilo) =>
    enMovil && bloque.propio[campo] === undefined && est[campo] !== undefined

  return (
    <aside style={{ width: 288, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, background: '#fff',
      display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Identidad del bloque */}
      <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${BORDER}` }}>
        <p style={{ margin: 0, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: `${INK}80` }}>
          {bloque.seccionLabel}
        </p>
        <h2 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 500, color: INK, letterSpacing: '-0.01em' }}>
          {bloque.label}
        </h2>
        <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
          <Chip>{bloque.locale === 'en' ? 'Inglés' : 'Español'}</Chip>
          <Chip>{enMovil ? 'Solo móvil' : 'Escritorio'}</Chip>
        </div>
      </div>

      {/* Bloque apagado por un interruptor del CMS */}
      {bloque.oculto && (
        <div style={{ margin: '14px 18px 0', padding: '11px 12px', background: '#FFF7F3',
          border: `1px solid ${ORANGE}33`, borderRadius: 4 }}>
          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: `${INK}CC` }}>
            Este texto no se ve en la web: la portada está configurada como <strong>solo imagen</strong>.
            Lo estás viendo atenuado para poder ajustarlo antes de encenderlo.
          </p>
          {bloque.interruptor && (
            <button onClick={onMostrar}
              style={{ marginTop: 9, background: ORANGE, color: '#fff', border: 'none', borderRadius: 3,
                padding: '6px 11px', fontSize: 11, fontWeight: 500, cursor: 'pointer', letterSpacing: '0.02em' }}>
              Mostrar el texto en la web
            </button>
          )}
        </div>
      )}

      {enMovil && (
        <p style={{ margin: '14px 18px 0', fontSize: 11, lineHeight: 1.5, color: `${INK}88` }}>
          Lo que cambies aquí afecta <strong>solo al móvil</strong>. Lo que no toques sigue
          espejando el escritorio.
        </p>
      )}

      {/* Tamaño */}
      {puede('tamano') && (
        <Grupo label="Tamaño" nota={heredado('escala') ? 'Heredado del escritorio' : undefined}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Paso onClick={() => onPatch({ escala: Math.max(ESCALA_MIN, escala - 1) })} disabled={escala <= ESCALA_MIN}>−</Paso>
            <span style={{ minWidth: 52, textAlign: 'center', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: INK }}>
              {Math.round(escalaFactor(escala) * 100)}%
            </span>
            <Paso onClick={() => onPatch({ escala: Math.min(ESCALA_MAX, escala + 1) })} disabled={escala >= ESCALA_MAX}>+</Paso>
          </div>
          <input type="range" min={ESCALA_MIN} max={ESCALA_MAX} step={1} value={escala}
            onChange={(e) => onPatch({ escala: Number(e.target.value) })}
            style={{ width: '100%', marginTop: 12, accentColor: ORANGE }} />
          <p style={{ margin: '6px 0 0', fontSize: 10.5, color: `${INK}70`, lineHeight: 1.45 }}>
            Pasos sobre el tamaño del sistema. El texto sigue escalando con el ancho
            de la pantalla: esto ajusta la proporción, no un tamaño fijo.
          </p>
        </Grupo>
      )}

      {/* Tracking */}
      {puede('tracking') && (
        <Grupo label="Espaciado entre letras" nota={heredado('tracking') ? 'Heredado del escritorio' : undefined}>
          <Fila>
            <Opcion activa={est.tracking === undefined} onClick={() => onPatch({ tracking: null })}>Auto</Opcion>
            {TRACKINGS.map(([id, label]) => (
              <Opcion key={id} activa={est.tracking === id} onClick={() => onPatch({ tracking: id })}>{label}</Opcion>
            ))}
          </Fila>
        </Grupo>
      )}

      {/* Peso */}
      {puede('peso') && (
        <Grupo label="Peso" nota={heredado('peso') ? 'Heredado del escritorio' : undefined}>
          <Fila>
            <Opcion activa={est.peso === undefined} onClick={() => onPatch({ peso: null })}>Auto</Opcion>
            {PESOS.map(([id, label]) => (
              <Opcion key={id} activa={est.peso === id} onClick={() => onPatch({ peso: id })}>{label}</Opcion>
            ))}
          </Fila>
        </Grupo>
      )}

      {/* Alineación */}
      {puede('align') && (
        <Grupo label="Alineación" nota={heredado('align') ? 'Heredado del escritorio' : undefined}>
          <Fila>
            <Opcion activa={est.align === undefined} onClick={() => onPatch({ align: null })}>Auto</Opcion>
            {ALIGNS.map(([id, etiqueta]) => (
              <Opcion key={id} activa={est.align === id} onClick={() => onPatch({ align: id })}>{etiqueta}</Opcion>
            ))}
          </Fila>
        </Grupo>
      )}

      {/* Texto */}
      {puede('texto') && (
        <Grupo label="Texto">
          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: `${INK}99` }}>
            <strong style={{ color: INK }}>Doble clic</strong> sobre el texto en la página para
            escribirlo ahí mismo. <strong style={{ color: INK }}>Enter</strong> o{' '}
            <strong style={{ color: INK }}>Escape</strong> confirman.
          </p>
        </Grupo>
      )}

      <div style={{ marginTop: 'auto', padding: '14px 18px 20px', borderTop: `1px solid ${BORDER}` }}>
        <button onClick={onReset}
          style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 3, width: '100%',
            padding: '8px 10px', fontSize: 11.5, color: `${INK}AA`, cursor: 'pointer' }}>
          Volver al diseño original{enMovil ? ' (móvil)' : ''}
        </button>
      </div>
    </aside>
  )
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function Grupo({ label, nota, children }: { label: string; nota?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 18px', borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: `${INK}80` }}>{label}</p>
        {nota && <span style={{ fontSize: 9.5, color: `${INK}55`, letterSpacing: '0.02em' }}>{nota}</span>}
      </div>
      {children}
    </div>
  )
}

const Fila = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{children}</div>
)

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: `${INK}99`,
      border: `1px solid ${BORDER}`, borderRadius: 2, padding: '2px 6px' }}>{children}</span>
  )
}

function Opcion({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{
        background: activa ? INK : '#fff', color: activa ? '#fff' : `${INK}AA`,
        border: `1px solid ${activa ? INK : BORDER}`, borderRadius: 3, padding: '5px 9px',
        fontSize: 11, cursor: 'pointer', letterSpacing: '0.02em', minWidth: 34,
      }}>
      {children}
    </button>
  )
}

function Paso({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: 30, height: 30, borderRadius: 3, border: `1px solid ${BORDER}`, background: '#fff',
        color: disabled ? `${INK}33` : INK, fontSize: 15, lineHeight: '15px',
        cursor: disabled ? 'default' : 'pointer',
      }}>
      {children}
    </button>
  )
}
