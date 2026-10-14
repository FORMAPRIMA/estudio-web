import { calcTotals, fmtMoneda, type Moneda, type PagoUSD } from '@/lib/facturasUtils'

/**
 * El cuerpo del correo de una factura, en un solo sitio.
 *
 * Lo comparten la emisión (`/api/facturas-emitidas/emit`) y el reenvío
 * (`/api/facturas-emitidas/[id]/reenviar`). Antes cada uno tenía su copia del
 * HTML y ya habían divergido: mismo correo, dos maquetas que se retocaban por
 * separado.
 *
 * El recordatorio de pago NO usa esta plantilla a propósito: es otro correo
 * (sin desglose de conceptos ni tabla de totales), y meterlo aquí obligaría a
 * llenar la función de condicionales para ahorrar poco.
 */

export interface FacturaEmailItem {
  descripcion:     string
  cantidad:        number
  precio_unitario: number
  subtotal:        number
}

export interface FacturaEmailBodyOpts {
  /** Nombre del destinatario, ya compuesto (varios clientes → "Ana y Luis"). */
  saludoNombre: string
  /**
   * La factura va dirigida a un proveedor (margen de obra, rappel de mobiliario).
   * Cambia el tratamiento a plural formal y, sobre todo, quita el enlace al
   * área de cliente: ese portal no es suyo y no debe verlo.
   */
  esParaProveedor: boolean
  /** Párrafo bajo el saludo. Acepta HTML (suele llevar <strong>). Vacío = sin párrafo. */
  introHtml?: string | null

  items:          FacturaEmailItem[]
  /**
   * Moneda de las líneas. En moneda extranjera los importes se pintan en ella y
   * `baseImponible`/`cuotaIva`/`total` (que llegan en euros) solo como contravalor.
   */
  moneda?:        Moneda | null
  /** Cambio BCE: unidades de `moneda` por 1 € y fecha del dato */
  cambio?:        { tipo: number; fecha: string } | null
  tipoIva:        number
  baseImponible:  number
  cuotaIva:       number
  tipoIrpf?:      number | null
  cuotaIrpf?:     number | null
  total:          number

  /** Datos bancarios del estudio. Sin IBAN, el bloque no se pinta. */
  banco?: {
    iban:         string | null
    banco_nombre: string | null
    banco_swift:  string | null
  } | null

  /** Cuenta USD (Wise). En una factura en USD sustituye al bloque del IBAN. */
  pagoUsd?: PagoUSD | null

  /**
   * Id de proyecto para el botón del área de cliente. Se ignora si
   * `esParaProveedor`, aunque venga informado.
   */
  ctaProyectoId?: string | null
}

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

export function buildFacturaEmailBody(o: FacturaEmailBodyOpts): string {
  const showIrpf = !!o.tipoIrpf && !!o.cuotaIrpf && o.cuotaIrpf > 0
  const extranjera = !!o.moneda && o.moneda !== 'EUR' && !!o.cambio
  const fmt = (n: number) => fmtMoneda(n, extranjera ? o.moneda! : 'EUR')
  const tm  = extranjera ? calcTotals(o.items, o.tipoIva, o.tipoIrpf) : null
  const baseVista  = tm?.base_imponible ?? o.baseImponible
  const ivaVista   = tm?.cuota_iva      ?? o.cuotaIva
  const irpfVista  = tm?.cuota_irpf     ?? o.cuotaIrpf ?? 0
  const totalVista = tm?.total          ?? o.total
  const [cy, cm, cd] = (o.cambio?.fecha ?? '').split('-')
  const saludo   = o.esParaProveedor ? 'Estimados' : 'Estimado/a'
  // El portal es del cliente: un proveedor nunca ve ese botón.
  const mostrarCTA = !o.esParaProveedor && !!o.ctaProyectoId

  const itemsRows = o.items.map(item => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#3A3A3A;line-height:1.4;">${item.descripcion}</td>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#888;text-align:right;white-space:nowrap;padding-left:16px;">${item.cantidad} × ${fmt(item.precio_unitario)}</td>
        <td style="padding:9px 0;border-bottom:1px solid #F0EEE8;font-size:13px;color:#3A3A3A;text-align:right;white-space:nowrap;padding-left:16px;font-weight:600;">${fmt(item.subtotal)}</td>
      </tr>`).join('')

  return `
      <p style="margin:0 0 22px;font-size:22px;font-weight:300;color:#1A1A1A;line-height:1.3;">${saludo} ${o.saludoNombre},</p>

      ${o.introHtml?.trim()
        ? `<p style="margin:0 0 28px;font-size:14px;color:#555555;line-height:1.75;">${o.introHtml.trim()}</p>`
        : ''}

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
        <thead>
          <tr>
            <td style="padding:6px 0;border-bottom:1.5px solid #1A1A1A;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#AAAAAA;">Concepto</td>
            <td style="padding:6px 0;border-bottom:1.5px solid #1A1A1A;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#AAAAAA;text-align:right;padding-left:16px;">Detalle</td>
            <td style="padding:6px 0;border-bottom:1.5px solid #1A1A1A;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#AAAAAA;text-align:right;padding-left:16px;">Importe</td>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr><td width="45%"></td><td>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:12px;color:#AAAAAA;">Base imponible</td>
              <td style="padding:6px 0;font-size:12px;color:#555;text-align:right;">${fmt(baseVista)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:12px;color:#AAAAAA;">IVA (${o.tipoIva}%)</td>
              <td style="padding:6px 0;font-size:12px;color:#555;text-align:right;">${fmt(ivaVista)}</td>
            </tr>
            ${showIrpf ? `
            <tr>
              <td style="padding:6px 0;font-size:12px;color:#AAAAAA;">Retención IRPF (${o.tipoIrpf}%)</td>
              <td style="padding:6px 0;font-size:12px;color:#555;text-align:right;">−${fmt(irpfVista)}</td>
            </tr>` : ''}
            <tr><td colspan="2" style="padding:4px 0 0;"><div style="height:1px;background:#E6E4DF;"></div></td></tr>
            <tr>
              <td style="padding:10px 16px;background:#1A1A1A;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#F0EDE8;">Total a pagar</td>
              <td style="padding:10px 16px;background:#1A1A1A;font-size:17px;font-weight:700;color:#ffffff;text-align:right;letter-spacing:-0.3px;">${fmt(totalVista)}</td>
            </tr>
            ${extranjera ? `
            <tr>
              <td colspan="2" style="padding:8px 0 0;font-size:11px;color:#AAAAAA;text-align:right;">Contravalor ${eur(o.total)} · cambio BCE ${cd}/${cm}/${cy}: 1 € = ${o.cambio!.tipo.toLocaleString('es-ES', { maximumFractionDigits: 6 })} ${o.moneda}</td>
            </tr>` : ''}
          </table>
        </td></tr>
      </table>

      ${o.moneda === 'USD' && o.pagoUsd ? `
      <div style="background:#F8F7F4;border-left:3px solid #D85A30;padding:16px 20px;margin-bottom:32px;">
        <p style="margin:0 0 10px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#AAAAAA;">Payment details · USD</p>
        <p style="margin:0 0 6px;font-size:13px;color:#3A3A3A;">Bank transfer (ACH or wire) from the US</p>
        ${o.pagoUsd.titular ? `<p style="margin:0 0 4px;font-size:13px;color:#555555;">Account holder: ${o.pagoUsd.titular}</p>` : ''}
        ${o.pagoUsd.banco ? `<p style="margin:0 0 4px;font-size:13px;color:#555555;">Bank: ${o.pagoUsd.banco}</p>` : ''}
        <p style="margin:0 0 4px;font-size:13px;color:#555555;font-family:'Courier New',monospace;">Routing number: ${o.pagoUsd.routing}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#555555;font-family:'Courier New',monospace;">Account number: ${o.pagoUsd.cuenta}${o.pagoUsd.tipo_cuenta ? ` (${o.pagoUsd.tipo_cuenta})` : ''}</p>
        ${o.pagoUsd.swift ? `<p style="margin:0;font-size:12px;color:#888888;">From outside the US (SWIFT): <span style="font-family:'Courier New',monospace;">${o.pagoUsd.swift}</span></p>` : ''}
      </div>` : o.banco?.iban ? `
      <div style="background:#F8F7F4;border-left:3px solid #D85A30;padding:16px 20px;margin-bottom:32px;">
        <p style="margin:0 0 10px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#AAAAAA;">Datos de pago</p>
        ${o.banco.banco_nombre ? `<p style="margin:0 0 5px;font-size:13px;color:#3A3A3A;font-weight:600;">${o.banco.banco_nombre}</p>` : ''}
        <p style="margin:0 0 4px;font-size:13px;color:#555555;font-family:'Courier New',monospace;">IBAN: ${o.banco.iban}</p>
        ${o.banco.banco_swift ? `<p style="margin:0;font-size:12px;color:#888888;font-family:'Courier New',monospace;">SWIFT/BIC: ${o.banco.banco_swift}</p>` : ''}
      </div>` : ''}

      ${mostrarCTA ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td style="background:#1A1A1A;padding:24px 28px;">
            <div style="height:2px;background:#D85A30;margin-bottom:20px;opacity:0.7;"></div>
            <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#666060;">Área de cliente</p>
            <p style="margin:0 0 18px;font-size:15px;font-weight:300;color:#F0EDE8;line-height:1.5;">Consulta el avance de tu proyecto,<br/>documentación y facturas en un solo lugar.</p>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://portal.formaprima.es'}/portal/${o.ctaProyectoId}" style="display:inline-block;background:#D85A30;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;text-decoration:none;padding:12px 28px;">
              Acceder a mi área &rarr;
            </a>
          </td>
        </tr>
      </table>` : ''}

      <p style="margin:0 0 6px;font-size:14px;color:#555555;line-height:1.75;">Quedamos a su disposición para cualquier consulta.</p>
      <p style="margin:0;font-size:14px;color:#555555;line-height:1.75;">
        Un cordial saludo,<br/><strong style="color:#1A1A1A;">Equipo Forma Prima</strong>
      </p>
    `
}
