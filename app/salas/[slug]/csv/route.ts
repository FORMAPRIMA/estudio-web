import { datosSala, esHostSalas, miembroActual, salaDe, auditar } from '@/lib/salas/panel'
import { resumenLeads, duracion } from '@/lib/salas/metricas'

// Exportación de los leads de una sala (con su actividad) a CSV para Excel.
export const dynamic = 'force-dynamic'

const celda = (v: unknown) => {
  const s = v == null ? '' : String(v)
  // Evita que Excel ejecute fórmulas que empiecen por = + - @
  const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[";\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  if (!esHostSalas()) return new Response('No disponible', { status: 404 })
  const m = await miembroActual()
  const sala = m ? await salaDe(m, params.slug) : null
  if (!m || !sala) return new Response('No disponible', { status: 404 })

  const d = await datosSala(sala.id)
  const filas = resumenLeads(d).map((r) => [
    r.lead.nombre, r.lead.empresa, r.lead.email, r.lead.telefono, r.lead.canal, r.lead.pin, r.lead.estado,
    d.miembros[r.lead.creadoPor ?? ''] ?? '', r.lead.createdAt.slice(0, 10),
    r.visitas, r.dias, r.ultima?.slice(0, 16).replace('T', ' ') ?? '', duracion(r.activoMs),
    `${Math.round(r.mejor * 100)} %`, r.final ? 'sí' : 'no', r.interes ? 'sí' : 'no', r.lugares.join(' | '), r.dispositivos.join(' | '), r.lead.notas,
  ])
  const cab = ['Nombre', 'Empresa', 'Email', 'Teléfono', 'Canal', 'PIN', 'Estado', 'Creado por', 'Alta', 'Visitas', 'Días distintos', 'Última visita (UTC)', 'Tiempo activo', 'Hasta dónde', 'Final', 'Interesado', 'Desde', 'Dispositivos', 'Notas']
  const csv = '﻿' + [cab, ...filas].map((f) => f.map(celda).join(';')).join('\r\n')
  await auditar(m.id, 'exportar_csv', sala.id)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${sala.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
