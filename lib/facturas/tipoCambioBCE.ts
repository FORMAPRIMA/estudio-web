import type { Moneda } from '@/lib/facturasUtils'

/**
 * Tipo de cambio de referencia del Banco Central Europeo para una fecha.
 *
 * Es el que vale para Hacienda en una factura en moneda extranjera. El BCE lo
 * publica los días laborables hacia las 16:00 CET; para fines de semana,
 * festivos o una mañana antes de publicarse se usa el último disponible, por
 * eso se pide una ventana de días y se toma la última observación.
 *
 * Devuelve unidades de `moneda` por 1 € (1 € = 1,1195 $) y la fecha del dato.
 * Sin dato no hay factura: nunca se inventa un cambio.
 */
export async function tipoCambioBCE(
  fecha: string,
  moneda: Exclude<Moneda, 'EUR'> = 'USD',
): Promise<{ tipo: number; fecha: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error(`Fecha no válida: ${fecha}`)

  const fin    = new Date(`${fecha}T00:00:00Z`)
  const inicio = new Date(fin.getTime() - 14 * 86_400_000)
  const url = 'https://data-api.ecb.europa.eu/service/data/EXR/'
    + `D.${moneda}.EUR.SP00.A?format=csvdata`
    + `&startPeriod=${inicio.toISOString().slice(0, 10)}&endPeriod=${fecha}`

  let csv: string
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    csv = await res.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`No se pudo consultar el tipo de cambio del BCE (${msg}). Prueba de nuevo en un momento.`)
  }

  const lineas = csv.trim().split('\n')
  const cab    = lineas[0]?.split(',') ?? []
  const iFecha = cab.indexOf('TIME_PERIOD')
  const iValor = cab.indexOf('OBS_VALUE')
  const obs = lineas.slice(1)
    .map(l => l.split(','))
    .map(c => ({ fecha: c[iFecha], tipo: Number(c[iValor]) }))
    .filter(o => o.fecha && o.fecha <= fecha && Number.isFinite(o.tipo) && o.tipo > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const ultimo = obs[obs.length - 1]
  if (iFecha < 0 || iValor < 0 || !ultimo) {
    throw new Error(`El BCE no tiene tipo de cambio ${moneda} para el ${fecha}.`)
  }
  return ultimo
}
