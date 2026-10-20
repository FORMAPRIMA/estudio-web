import { NextRequest, NextResponse } from 'next/server'
import { errorDeAcceso } from '@/lib/presupuestos-parametricos/guard'
import { prepararImagen, corregirModelo, type MensajeChat } from '@/lib/presupuestos-parametricos/maqueta/levantamiento'
import { aplicarOperaciones, type ModeloEstadoActual } from '@/lib/presupuestos-parametricos/maqueta/modelo'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST JSON: { imagen: dataURL, modelo, mensaje, historial }
export async function POST(req: NextRequest) {
  const denegado = await errorDeAcceso()
  if (denegado) return NextResponse.json({ error: denegado }, { status: 403 })

  const body = await req.json() as { imagen?: string; modelo?: ModeloEstadoActual; mensaje?: string; historial?: MensajeChat[] }
  const mensaje = body.mensaje?.trim()
  if (!body.imagen || !body.modelo || !mensaje) return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 })
  const b64 = body.imagen.split(',')[1] ?? ''

  try {
    const img = await prepararImagen(Buffer.from(b64, 'base64'))
    const { respuesta, operaciones } = await corregirModelo(img, body.modelo, mensaje, body.historial ?? [])
    const { modelo, errores } = aplicarOperaciones(body.modelo, operaciones)
    return NextResponse.json({ respuesta, operaciones, errores, modelo: operaciones.length ? modelo : body.modelo })
  } catch (e) {
    console.error('[maqueta/corregir]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo aplicar la corrección.' }, { status: 500 })
  }
}
