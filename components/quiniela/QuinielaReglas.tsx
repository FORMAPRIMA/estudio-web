'use client'

import { Q, FONT, labelStyle, pixelStyle } from '@/components/team/quiniela/theme'

export default function QuinielaReglas({ monto, onClose }: { monto: number; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(5,7,15,.82)', backdropFilter: 'blur(4px)', zIndex: 1000,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONT.body,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="q-scroll"
        style={{
          background: Q.card, border: `1.5px solid rgba(52,227,255,.35)`, borderRadius: '22px 22px 0 0',
          maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '20px 18px 26px',
          position: 'relative', animation: 'q-slideUp .3s ease both', boxShadow: '0 -10px 40px rgba(0,0,0,.5)',
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 3, background: 'rgba(255,255,255,.18)', margin: '0 auto 16px' }} />
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: Q.textMid }}
        >
          ✕
        </button>

        <div style={{ ...labelStyle, color: Q.textMid, marginBottom: 6 }}>LA PORRA DEL MUNDIAL 2026</div>
        <h2 style={{ ...pixelStyle, fontSize: 14, color: Q.green, marginBottom: 20, textShadow: '0 0 12px rgba(54,245,154,.4)' }}>REGLAS DEL JUEGO</h2>

        <div style={{ fontSize: 13, color: Q.textSoft, lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section>
            <h3 style={reglaTitulo}>1 · ENTRADA Y BOTE</h3>
            <p>
              Cada jugador pone <strong style={{ color: Q.gold }}>{monto.toFixed(0)} €</strong> de entrada. Todo va a un bote
              que se reparte al final del Mundial: <strong style={{ color: Q.text }}>70 % para el 1º, 20 % para el 2º y 10 % para el 3º</strong> de
              la clasificación. El pago es en mano; en la app solo se registra quién ha pagado.
            </p>
            <p style={{ marginTop: 6, background: 'rgba(255,91,118,.1)', border: '1px solid rgba(255,91,118,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: Q.textSoft }}>
              ⚠️ Al registrarte te comprometes a pagar la entrada <strong style={{ color: Q.text }}>aunque luego no rellenes
              tus predicciones a tiempo</strong>. Apuntarse es apostar.
            </p>
          </section>

          <section>
            <h3 style={reglaTitulo}>2 · PREDICCIONES DE PARTIDOS</h3>
            <p>
              Predices el <strong style={{ color: Q.text }}>marcador exacto</strong> de cada partido. Puedes editar tu predicción
              hasta <strong style={{ color: Q.text }}>1 hora antes del inicio</strong>; después se bloquea. Tus predicciones son
              secretas: los demás solo las ven cuando el partido ya ha empezado.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${Q.border}` }}>
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
            <p style={{ marginTop: 8, fontSize: 12, color: Q.textMid }}>
              El marcador exacto ya incluye el acierto de resultado (no se suman). En grupos, &quot;resultado&quot;
              es el 1X2. En eliminatorias, &quot;resultado&quot; es acertar <strong style={{ color: Q.text }}>quién pasa de ronda</strong>, y el
              marcador cuenta al final de la prórroga (sin penaltis); si predices empate, eliges quién pasa
              en penaltis.
            </p>
          </section>

          <section>
            <h3 style={reglaTitulo}>3 · LA ESCALERA DEL CAMPEÓN</h3>
            <p>
              En cinco momentos del torneo eliges quién será el <strong style={{ color: Q.text }}>campeón del Mundial</strong>.
              Cada pick es independiente y <strong style={{ color: Q.text }}>acumulable</strong>: cuanto antes aciertes, más vale.
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <li>Antes del Mundial (48 equipos) — <strong style={{ color: Q.gold }}>60 pts</strong></li>
              <li>Tras la fase de grupos (32 equipos) — <strong style={{ color: Q.gold }}>40 pts</strong></li>
              <li>Tras dieciseisavos (16 equipos) — <strong style={{ color: Q.gold }}>28 pts</strong></li>
              <li>Tras octavos (8 equipos) — <strong style={{ color: Q.gold }}>18 pts</strong></li>
              <li>Tras cuartos (4 equipos) — <strong style={{ color: Q.gold }}>10 pts</strong></li>
            </ul>
            <p style={{ marginTop: 8, fontSize: 12, color: Q.textMid }}>
              Si sostienes al mismo equipo en las cinco ventanas y es campeón, sumas las cinco (156 pts).
              Si tu pick cae eliminado, en la siguiente ventana eliges otro entre los que siguen vivos.
            </p>
          </section>

          <section>
            <h3 style={reglaTitulo}>4 · BONUS PICHICHI</h3>
            <p style={{ fontSize: 12 }}>
              Antes del primer partido eliges al <strong style={{ color: Q.text }}>máximo goleador del Mundial</strong>.
              Si aciertas: <strong style={{ color: Q.gold }}>15 pts</strong>.
            </p>
          </section>

          <section>
            <h3 style={reglaTitulo}>5 · CLASIFICACIÓN Y DESEMPATE</h3>
            <p style={{ fontSize: 12 }}>
              Gana quien más puntos sume (partidos + escalera + pichichi). En caso de empate:
              más marcadores exactos → más aciertos en eliminatorias.
            </p>
          </section>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 24, width: '100%', ...pixelStyle, fontSize: 10, cursor: 'pointer', borderRadius: 12, padding: '13px',
            background: 'linear-gradient(180deg,#48ffa6,#23d985)', color: '#06210f', border: 0, boxShadow: '0 4px 0 #128a52',
          }}
        >
          ENTENDIDO
        </button>
      </div>
    </div>
  )
}

const reglaTitulo: React.CSSProperties = {
  ...labelStyle, fontSize: 11, color: Q.cyan, marginBottom: 6,
}
const celdaTh: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', fontWeight: 500, fontSize: 10,
  color: Q.textMid, textTransform: 'uppercase', letterSpacing: '0.06em',
}
const celdaTd: React.CSSProperties = {
  padding: '6px 8px', borderBottom: `1px solid ${Q.border}`, color: Q.textSoft,
}
