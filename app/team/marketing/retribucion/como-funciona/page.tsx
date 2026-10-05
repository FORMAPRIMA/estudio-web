import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getAccesoRetribucion } from '@/lib/retribucion-data'
import { ORIGENES, PLAN, calcular, eur, pct, r2 } from '@/lib/retribucion'
import { T, card, eyebrow } from '@/components/team/marketing/retribucion/theme'

export const metadata = { title: 'Cómo se calcula la retribución · Marketing' }

// Todo lo que sale aquí se lee de lib/retribucion.ts: si cambian los tramos o
// los coeficientes, esta guía se actualiza sola.

export default async function Page() {
  const acceso = await getAccesoRetribucion()
  if (!acceso) redirect('/team/dashboard')

  const ej = { honorarios: 40000, obra: 250000, margenPct: 5, descuento: false }
  const ejPropio = calcular({ ...ej, origen: 'orig' })
  const ejInbound = calcular({ ...ej, origen: 'funnel' })
  const nf = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 2 })

  return (
    <div style={{ padding: 'clamp(24px, 4vw, 40px) clamp(16px, 4vw, 48px) 72px', maxWidth: 860, color: T.ink }}>
      <Link href="/team/marketing/retribucion" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft, textDecoration: 'none' }}>
        ← Volver a Retribución
      </Link>

      <p style={{ ...eyebrow, margin: '24px 0 8px' }}>Guía</p>
      <h1 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em', margin: '0 0 12px', lineHeight: 1.15 }}>
        Cómo se calcula tu retribución variable
      </h1>
      <p style={{ fontSize: 14, color: T.soft, lineHeight: 1.6, margin: '0 0 28px', fontWeight: 300 }}>
        Por cada proyecto que entra al estudio gracias a tu trabajo cobras una comisión. Depende de tres cosas:
        <b style={{ color: T.ink, fontWeight: 500 }}> cuánto factura el estudio</b> por ese proyecto,
        <b style={{ color: T.ink, fontWeight: 500 }}> de dónde viene el cliente</b> y
        <b style={{ color: T.ink, fontWeight: 500 }}> cuándo paga</b>.
      </p>

      <div style={{ ...card, background: T.ink, borderColor: T.ink, color: '#fff', marginBottom: 36 }}>
        <p style={{ ...eyebrow, color: '#FFFFFF90' }}>En una línea</p>
        <p style={{ fontSize: 17, fontWeight: 300, margin: '8px 0 0', lineHeight: 1.5 }}>
          Comisión = <b style={{ fontWeight: 500 }}>escala por tramos</b> sobre lo que factura el estudio ×
          <b style={{ fontWeight: 500 }}> porcentaje según el origen</b> del cliente
        </p>
      </div>

      <Paso n={1} titulo="Qué cuenta: lo que factura el estudio">
        <p style={p}>
          Se suman los <b>honorarios de proyecto</b> (arquitectura e interiorismo) y el <b>margen que se lleva el estudio
          sobre la obra</b>, si la gestionamos nosotros. Del presupuesto de obra solo cuenta ese margen, normalmente
          un {pct(PLAN.margenObraDefecto)}, porque es lo que de verdad ingresa el estudio. Todo sin IVA.
        </p>
        <p style={p}>
          Hay un <b>mínimo de {eur(PLAN.minimo)}</b>: si el proyecto no llega, no genera comisión, venga de donde venga
          el cliente. A partir de ahí comisiona desde el primer euro.
        </p>
        <p style={p}>
          Y un tope de <b>{eur(PLAN.tope)}</b> por proyecto: lo que pase de ahí no genera comisión.
        </p>
      </Paso>

      <Paso n={2} titulo="La escala: cada tramo a su porcentaje">
        <p style={p}>
          Funciona como los tramos de la renta: los primeros euros comisionan más, y cada tramo se calcula
          solo con su porcentaje. Que un proyecto sea grande nunca hace que cobres menos por los primeros euros.
        </p>
        <Tabla
          cab={['Tramo de lo facturado', 'Comisión', 'Máximo del tramo']}
          filas={PLAN.tramos.map((t) => [`De ${eur(t.desde)} a ${eur(t.hasta)}`, pct(t.pct * 100), eur((t.hasta - t.desde) * t.pct)])}
          pie={['Proyecto en el tope', '', eur(PLAN.tramos.reduce((a, t) => a + (t.hasta - t.desde) * t.pct, 0))]}
        />
      </Paso>

      <Paso n={3} titulo="El origen del cliente">
        <p style={p}>
          La escala da el máximo posible. Después se multiplica según cuánto ha dependido de ti que el cliente llegue.
          El origen se elige al registrar el proyecto.
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {ORIGENES.map((o) => (
            <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 14, alignItems: 'start', padding: '12px 14px', border: `1px solid ${T.line}`, borderRadius: 4, background: T.panel }}>
              <span style={{ fontSize: 20, fontWeight: 300, color: o.coef === 0 ? T.faint : T.ink, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(o.coef * 100)} %
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{o.nombre}</span>
                <span style={{ display: 'block', fontSize: 12, color: T.soft }}>{o.corto}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: T.faint, marginTop: 2 }}>Ej.: {o.ejemplo}</span>
              </span>
            </div>
          ))}
        </div>
      </Paso>

      <Paso n={4} titulo="Cuándo se cobra">
        <p style={p}>
          La comisión no se paga entera al firmar. Se va ganando <b>al mismo ritmo que el estudio cobra al cliente</b>:
          si los honorarios se cobran en 4 plazos, tu comisión por honorarios también se reparte en esos 4 meses.
          Lo mismo con el margen de obra.
        </p>
        <p style={p}>
          Lo que se acumula en cada <b>trimestre</b> se paga en la <b>nómina del mes siguiente</b> al cierre:
          lo de enero a marzo, en la de abril; lo de abril a junio, en la de julio, y así.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginTop: 6 }}>
          {[['T1', 'ene–mar', 'abril'], ['T2', 'abr–jun', 'julio'], ['T3', 'jul–sep', 'octubre'], ['T4', 'oct–dic', 'enero']].map(([t, r, n]) => (
            <div key={t} style={{ border: `1px solid ${T.line}`, borderRadius: 4, padding: '10px 10px', background: T.panel, textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{t}</span>
              <span style={{ display: 'block', fontSize: 11, color: T.soft }}>{r}</span>
              <span style={{ display: 'block', fontSize: 11, color: T.accent, marginTop: 4 }}>→ nómina de {n}</span>
            </div>
          ))}
        </div>
      </Paso>

      <Paso n={5} titulo="Un ejemplo completo">
        <p style={p}>
          Una reforma con <b>{eur(ej.honorarios)}</b> de honorarios y <b>{eur(ej.obra)}</b> de obra con un margen del {pct(ej.margenPct)}.
        </p>
        <div style={{ ...card, padding: '14px 18px' }}>
          <Linea k="Honorarios" v={eur(ejPropio.honorarios)} />
          <Linea k={`Margen de obra (${pct(ej.margenPct)} de ${eur(ej.obra)})`} v={eur(ejPropio.margenObra)} />
          <Linea k="Lo que cuenta" v={eur(ejPropio.base)} fuerte />
          {ejPropio.tramos.filter((t) => t.importe > 0).map((t, i) => (
            <Linea key={i} k={`${eur(t.importe)} al ${pct(t.pct * 100)}`} v={eur(r2(t.comision), true)} />
          ))}
          <Linea k="Escala" v={eur(r2(ejPropio.escala), true)} fuerte />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
          <Resultado titulo="Si el cliente lo has captado tú" calc={`${eur(r2(ejPropio.escala), true)} × ${nf(ejPropio.coef)}`} total={eur(r2(ejPropio.total), true)} />
          <Resultado titulo="Si llegó por la web y lo cerraste tú" calc={`${eur(r2(ejInbound.escala), true)} × ${nf(ejInbound.coef)}`} total={eur(r2(ejInbound.total), true)} />
        </div>
      </Paso>

      <Paso n={6} titulo="Casos especiales">
        <ul style={{ ...p, paddingLeft: 18, margin: 0 }}>
          <li style={{ marginBottom: 8 }}>
            <b>Descuentos.</b> Si se da al cliente un descuento por encima del límite sin la autorización de los socios,
            la comisión de ese proyecto se multiplica por {nf(PLAN.penalizacionDescuento)}. Lo marcan los socios.
          </li>
          <li style={{ marginBottom: 8 }}>
            <b>Cambios en el proyecto.</b> Si cambian los honorarios, la obra o los plazos de cobro, se edita el proyecto y
            el cálculo y el calendario de pagos se rehacen solos.
          </li>
          <li style={{ marginBottom: 8 }}>
            <b>Clientes del estudio.</b> Se registran igual para que conste tu trabajo, aunque su comisión sea 0 €.
          </li>
          <li>
            <b>Importes brutos.</b> Todo lo que ves es bruto y sin IVA. La nómina final la calcula la gestoría.
          </li>
        </ul>
      </Paso>

      <p style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.6, marginTop: 36, borderTop: `1px solid ${T.line}`, paddingTop: 16 }}>
        Esta página resume el plan para que se entienda fácilmente. Lo que vale legalmente es el anexo de tu contrato.
        Si algo no cuadra, pregunta a Gabriela o a José.
      </p>

      <div style={{ marginTop: 20 }}>
        <Link href="/team/marketing/retribucion" style={{
          display: 'inline-block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500,
          textDecoration: 'none', background: T.ink, color: '#fff', padding: '11px 18px', borderRadius: 4,
        }}>
          Ir a mis proyectos →
        </Link>
      </div>
    </div>
  )
}

const p = { fontSize: 13.5, lineHeight: 1.65, color: '#1A1A1ACC', margin: '0 0 12px' } as const

function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: T.accent, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{String(n).padStart(2, '0')}</span>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>{titulo}</h2>
      </div>
      {children}
    </section>
  )
}

function Tabla({ cab, filas, pie }: { cab: string[]; filas: string[][]; pie?: string[] }) {
  const cell = (i: number) => ({ padding: '10px 14px', textAlign: (i === 0 ? 'left' : 'right') as 'left' | 'right', fontVariantNumeric: 'tabular-nums' as const })
  return (
    <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 420 }}>
        <thead>
          <tr style={{ color: T.soft, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {cab.map((c, i) => <th key={i} style={{ ...cell(i), fontWeight: 500 }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, j) => (
            <tr key={j} style={{ borderTop: `1px solid ${T.lineSoft}` }}>{f.map((c, i) => <td key={i} style={cell(i)}>{c}</td>)}</tr>
          ))}
          {pie && (
            <tr style={{ borderTop: `1px solid ${T.line}`, fontWeight: 600 }}>{pie.map((c, i) => <td key={i} style={cell(i)}>{c}</td>)}</tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Linea({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12.5, fontWeight: fuerte ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>
      <span style={{ color: fuerte ? T.ink : T.soft }}>{k}</span><span>{v}</span>
    </div>
  )
}

function Resultado({ titulo, calc, total }: { titulo: string; calc: string; total: string }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 6, padding: '14px 16px', background: T.panel }}>
      <p style={{ fontSize: 11.5, color: T.soft, margin: 0 }}>{titulo}</p>
      <p style={{ fontSize: 24, fontWeight: 300, margin: '6px 0 2px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{total}</p>
      <p style={{ fontSize: 11, color: T.faint, margin: 0 }}>{calc}</p>
    </div>
  )
}
