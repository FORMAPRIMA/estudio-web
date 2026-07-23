'use client'

import {
  BEBIDAS, CAFETERIAS, mediaPorBebida, ticketMedioPorLocal, ticketMedioMercado,
  ventasMedia, UBICACION, type BebidaKey,
} from '@/lib/modelo-cafe/mercado'
import { C, panelStyle, h2Style } from './theme'

const eur1 = (n: number) => (n > 0
  ? `${(Math.round(n * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} €`
  : '—')

export default function MercadoTab({ nuestroTicket }: { nuestroTicket: number }) {
  const medias = mediaPorBebida()
  const tickets = ticketMedioPorLocal()
  const ticketMercado = ticketMedioMercado()
  const ventas = ventasMedia()
  const ticketDe = (nombre: string) => tickets.find((t) => t.nombre === nombre)?.ticket ?? 0

  return (
    <>
      {/* KPIs de posicionamiento */}
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Kpi label="Ticket café del mercado" value={eur1(ticketMercado)} sub="media de los locales del entorno" />
        <Kpi label="Nuestro ticket" value={eur1(nuestroTicket)} sub="café de especialidad to-go"
          tone={nuestroTicket <= ticketMercado ? 'g' : undefined} />
        <Kpi label="Ventas café/día (media)" value={`${Math.round(ventas.normal)}`} sub={`día normal · ${ventas.locales} locales con dato`} />
        <Kpi label="Renta calle Goya" value={`${UBICACION.rentaGoya} €/m²`} sub={`vacancy ${UBICACION.vacancy} % · ${UBICACION.posicionCalle}`} />
      </section>

      {/* Tabla de precios por bebida y local */}
      <section style={{ ...panelStyle, marginBottom: 16, overflowX: 'auto' }}>
        <h2 style={h2Style}>Precios de carta del entorno · por bebida</h2>
        <p style={{ fontSize: 12, color: C.soft, marginBottom: 14 }}>
          Precios tomados en visita de campo (julio 2026). La última columna es el <b>ticket medio de café</b> de
          cada local (media de sus bebidas core). La fila final es la media de mercado por bebida.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Cafetería</th>
              {BEBIDAS.map((b) => <th key={b.key} style={th}>{b.corta}</th>)}
              <th style={{ ...th, color: C.coffee }}>Ticket medio</th>
            </tr>
          </thead>
          <tbody>
            {CAFETERIAS.map((c) => (
              <tr key={c.nombre} style={{ background: c.destacada ? '#FBF4E2' : 'transparent' }}>
                <td style={{ ...td, textAlign: 'left' }}>
                  <span style={{ fontWeight: 600, color: C.ink }}>{c.nombre}</span>
                  {c.destacada && <span style={{ fontSize: 9, color: C.accent, marginLeft: 6 }}>● directo</span>}
                  <div style={{ fontSize: 10, color: C.faint }}>{c.zona} · {c.distancia}</div>
                </td>
                {BEBIDAS.map((b) => (
                  <td key={b.key} style={td}>{eur1(c.precios[b.key as BebidaKey] ?? 0)}</td>
                ))}
                <td style={{ ...td, fontWeight: 700, color: C.coffee }}>{eur1(ticketDe(c.nombre))}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: C.ink, borderTop: `1.5px solid ${C.ink}` }}>
                Media de mercado
              </td>
              {BEBIDAS.map((b) => (
                <td key={b.key} style={{ ...td, fontWeight: 600, borderTop: `1.5px solid ${C.ink}` }}>
                  {eur1(medias[b.key].media)}
                </td>
              ))}
              <td style={{ ...td, fontWeight: 700, color: C.coffee, borderTop: `1.5px solid ${C.ink}` }}>
                {eur1(ticketMercado)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Ventas reportadas por los baristas */}
      <section style={{ ...panelStyle }}>
        <h2 style={h2Style}>Volumen de ventas · lo que cuentan los baristas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {CAFETERIAS.filter((c) => c.ventasNormal != null).map((c) => (
            <div key={c.nombre} style={{
              border: `1px solid ${C.line}`, borderRadius: 6, padding: '14px 16px', background: C.bg,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{c.nombre}</div>
              <div style={{ fontSize: 10.5, color: C.faint, marginBottom: 10 }}>{c.zona}</div>
              <div style={{ display: 'flex', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: C.ink }}>{c.ventasNormal}</div>
                  <div style={{ fontSize: 10, color: C.faint }}>día normal</div>
                </div>
                {c.ventasAlto != null && c.ventasAlto !== c.ventasNormal && (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: C.green }}>{c.ventasAlto}</div>
                    <div style={{ fontSize: 10, color: C.faint }}>día bueno</div>
                  </div>
                )}
              </div>
              {c.ventasNota && (
                <div style={{ fontSize: 10.5, color: C.soft, marginTop: 10, lineHeight: 1.45 }}>{c.ventasNota}</div>
              )}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: C.faint, marginTop: 14, lineHeight: 1.55 }}>
          Datos aportados de viva voz por los baristas durante la visita; orientativos. Los locales sin cifra estaban
          cerrados o no la facilitaron, aunque sí se recogieron sus precios de carta (tabla superior).
        </p>
      </section>
    </>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'g' }) {
  return (
    <div style={{ ...panelStyle, flex: 1, minWidth: 190, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1, color: tone === 'g' ? C.green : C.ink }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

const th: React.CSSProperties = {
  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.faint,
  textAlign: 'right', padding: '8px 8px', borderBottom: `1.5px solid ${C.ink}`, whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  fontSize: 12, textAlign: 'right', padding: '9px 8px',
  borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap', color: C.soft,
}
