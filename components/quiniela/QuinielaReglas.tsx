'use client'

const C = { ink: '#1A1A1A', cream: '#F8F7F4', accent: '#D85A30', border: '#F0EEE8' }

export default function QuinielaReglas({ monto, onClose }: { monto: number; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: '#1A1A1AB0', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 6, maxWidth: 620, width: '100%',
          maxHeight: '85vh', overflowY: 'auto', padding: '32px 36px', position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
            fontSize: 18, cursor: 'pointer', color: '#1A1A1A60',
          }}
        >
          ✕
        </button>

        <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1A1A1A99', marginBottom: 6 }}>
          La Porra del Mundial 2026
        </p>
        <h2 style={{ fontSize: 22, fontWeight: 300, color: C.ink, marginBottom: 20 }}>Reglas del juego</h2>

        <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section>
            <h3 style={reglaTitulo}>1 · Entrada y bote</h3>
            <p>
              Cada jugador pone <strong>{monto.toFixed(0)} €</strong> de entrada. Todo va a un bote
              que se reparte al final del Mundial: <strong>70 % para el 1º, 20 % para el 2º y 10 % para el 3º</strong> de
              la clasificación. El pago es en mano; en la app solo se registra quién ha pagado.
            </p>
            <p style={{ marginTop: 6, background: '#D85A3010', border: '1px solid #D85A3030', borderRadius: 4, padding: '8px 12px', fontSize: 12 }}>
              ⚠️ Al registrarte te comprometes a pagar la entrada <strong>aunque luego no rellenes
              tus predicciones a tiempo</strong>. Apuntarse es apostar.
            </p>
          </section>

          <section>
            <h3 style={reglaTitulo}>2 · Predicciones de partidos</h3>
            <p>
              Predices el <strong>marcador exacto</strong> de cada partido. Puedes editar tu predicción
              hasta <strong>1 hora antes del inicio</strong>; después se bloquea. Tus predicciones son
              secretas: los demás solo las ven cuando el partido ya ha empezado.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={celdaTh}>Fase</th>
                  <th style={celdaTh}>Acertar resultado</th>
                  <th style={celdaTh}>Marcador exacto</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={celdaTd}>Fase de grupos</td><td style={celdaTd}>2 pts</td><td style={celdaTd}>5 pts</td></tr>
                <tr><td style={celdaTd}>Dieciseisavos y octavos</td><td style={celdaTd}>3 pts</td><td style={celdaTd}>7 pts</td></tr>
                <tr><td style={celdaTd}>Cuartos</td><td style={celdaTd}>4 pts</td><td style={celdaTd}>9 pts</td></tr>
                <tr><td style={celdaTd}>Semifinales</td><td style={celdaTd}>5 pts</td><td style={celdaTd}>11 pts</td></tr>
                <tr><td style={celdaTd}>3er puesto y Final</td><td style={celdaTd}>6 pts</td><td style={celdaTd}>13 pts</td></tr>
              </tbody>
            </table>
            <p style={{ marginTop: 8, fontSize: 12, color: '#1A1A1A80' }}>
              El marcador exacto ya incluye el acierto de resultado (no se suman). En grupos, "resultado"
              es el 1X2. En eliminatorias, "resultado" es acertar <strong>quién pasa de ronda</strong>, y el
              marcador cuenta al final de la prórroga (sin penaltis); si predices empate, eliges quién pasa
              en penaltis.
            </p>
          </section>

          <section>
            <h3 style={reglaTitulo}>3 · La escalera del campeón</h3>
            <p>
              En cinco momentos del torneo eliges quién será el <strong>campeón del Mundial</strong>.
              Cada pick es independiente y <strong>acumulable</strong>: cuanto antes aciertes, más vale.
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <li>Antes del Mundial (48 equipos) — <strong>60 pts</strong></li>
              <li>Tras la fase de grupos (32 equipos) — <strong>40 pts</strong></li>
              <li>Tras dieciseisavos (16 equipos) — <strong>28 pts</strong></li>
              <li>Tras octavos (8 equipos) — <strong>18 pts</strong></li>
              <li>Tras cuartos (4 equipos) — <strong>10 pts</strong></li>
            </ul>
            <p style={{ marginTop: 8, fontSize: 12, color: '#1A1A1A80' }}>
              Si sostienes al mismo equipo en las cinco ventanas y es campeón, sumas las cinco (156 pts).
              Si tu pick cae eliminado, en la siguiente ventana eliges otro entre los que siguen vivos.
            </p>
          </section>

          <section>
            <h3 style={reglaTitulo}>4 · Bonus Pichichi</h3>
            <p style={{ fontSize: 12 }}>
              Antes del primer partido eliges al <strong>máximo goleador del Mundial</strong>.
              Si aciertas: <strong>15 pts</strong>.
            </p>
          </section>

          <section>
            <h3 style={reglaTitulo}>5 · Clasificación y desempate</h3>
            <p style={{ fontSize: 12 }}>
              Gana quien más puntos sume (partidos + escalera + pichichi). En caso de empate:
              más marcadores exactos → más aciertos en eliminatorias.
            </p>
          </section>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 24, width: '100%', background: C.ink, color: '#fff', border: 'none',
            borderRadius: 4, padding: '12px', fontSize: 12, letterSpacing: '0.08em',
            textTransform: 'uppercase', fontWeight: 500, cursor: 'pointer',
          }}
        >
          Entendido
        </button>
      </div>
    </div>
  )
}

const reglaTitulo: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#D85A30', fontWeight: 500, marginBottom: 6,
}
const celdaTh: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', fontWeight: 500, fontSize: 11,
  color: '#1A1A1A70', textTransform: 'uppercase', letterSpacing: '0.06em',
}
const celdaTd: React.CSSProperties = {
  padding: '6px 8px', borderBottom: '1px solid #F8F7F4',
}
