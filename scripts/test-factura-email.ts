/**
 * Verifica la plantilla compartida del correo de factura.
 *
 *   npx tsx scripts/test-factura-email.ts
 *
 * Lo que se comprueba no es la maqueta (eso se ve mirando un correo), sino las
 * reglas que no pueden fallar en silencio: que a un proveedor nunca se le cuele
 * el enlace al área de cliente, y que los bloques opcionales aparecen y
 * desaparecen cuando toca. No envía nada ni toca la base de datos.
 */
import { buildFacturaEmailBody } from '../lib/email/facturaBody'
import { repartirDestinatarios } from '../lib/email/destinatarios'

const items = [{ descripcion: 'Honorarios', cantidad: 1, precio_unitario: 1000, subtotal: 1000 }]
const base = {
  items, tipoIva: 21, baseImponible: 1000, cuotaIva: 210, total: 1210,
  banco: { iban: 'ES00 1234', banco_nombre: 'Banco X', banco_swift: 'XXXX' },
}

let fallos = 0
const check = (nombre: string, ok: boolean, detalle = '') => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${nombre}${detalle ? ' — ' + detalle : ''}`)
  if (!ok) fallos++
}

console.log('\nPlantilla del correo de factura')

const aCliente = buildFacturaEmailBody({
  ...base, saludoNombre: 'Ana', esParaProveedor: false,
  introHtml: 'Adjunta la factura <strong>F-99</strong>.', ctaProyectoId: 'proy-1',
})
check('cliente: tratamiento "Estimado/a"',      aCliente.includes('Estimado/a Ana,'))
check('cliente: ve el enlace al área',          aCliente.includes('Área de cliente'))
check('cliente: enlace al portal correcto',     aCliente.includes('/portal/proy-1'))
check('cliente: el intro conserva el HTML',     aCliente.includes('<strong>F-99</strong>'))
check('cliente: desglose de conceptos',         aCliente.includes('Honorarios'))
check('cliente: datos de pago con IBAN',        aCliente.includes('ES00 1234'))
check('cliente: sin fila de IRPF si no aplica', !aCliente.includes('Retención IRPF'))

const aProveedor = buildFacturaEmailBody({
  ...base, saludoNombre: 'REFORMAS ARMICO, S.L.', esParaProveedor: true,
  introHtml: 'Les informamos de la emisión.', ctaProyectoId: 'proy-1',
})
check('proveedor: tratamiento "Estimados"',     aProveedor.includes('Estimados REFORMAS'))
check('proveedor: SIN enlace al área',          !aProveedor.includes('Área de cliente'))
check('proveedor: SIN url del portal',          !aProveedor.includes('/portal/'),
      'aunque se le pase ctaProyectoId')

const conIrpf = buildFacturaEmailBody({
  ...base, saludoNombre: 'Ana', esParaProveedor: false, tipoIrpf: 15, cuotaIrpf: 150,
})
check('IRPF: aparece cuando hay retención',     conIrpf.includes('Retención IRPF (15%)'))

const sinBanco = buildFacturaEmailBody({
  ...base, banco: null, saludoNombre: 'Ana', esParaProveedor: false,
})
check('sin IBAN: no se pinta el bloque de pago', !sinBanco.includes('Datos de pago'))

const sinIntro = buildFacturaEmailBody({
  ...base, saludoNombre: 'Ana', esParaProveedor: false, introHtml: '   ',
})
check('intro vacío: no deja un párrafo suelto',
      (sinIntro.match(/<p style="margin:0 0 28px/g) ?? []).length === 0)

console.log('\nReparto de destinatarios')
const r1 = repartirDestinatarios({
  to: ['Ana@x.com', ' ana@x.com '], cc: ['ANA@x.com', 'socio@x.com'], bcc: ['socio@x.com'],
})
check('quita repetidos ignorando mayúsculas y espacios', r1.to.length === 1, JSON.stringify(r1.to))
check('TO gana a CC',  !r1.cc.some(e => e.toLowerCase() === 'ana@x.com'))
check('CC gana a BCC', r1.bcc.length === 0)
check('conserva el resto del CC', r1.cc.includes('socio@x.com'))

const r2 = repartirDestinatarios({ to: ['a@x.com', null, '', undefined], cc: [] })
check('descarta vacíos y nulos', r2.to.length === 1 && r2.cc.length === 0)

console.log(`\n${fallos === 0 ? '✅ Todo correcto' : `❌ ${fallos} fallo(s)`}\n`)
process.exit(fallos === 0 ? 0 : 1)
