import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { errorDeAcceso } from '@/lib/presupuestos-parametricos/guard'
import { prepararImagen, levantarModelo } from '@/lib/presupuestos-parametricos/maqueta/levantamiento'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST multipart: plano (imagen), m2, comunes ('1'|'0'), altura (opcional)
export async function POST(req: NextRequest) {
  const denegado = await errorDeAcceso()
  if (denegado) return NextResponse.json({ error: denegado }, { status: 403 })

  const form = await req.formData()
  const plano = form.get('plano')
  if (!(plano instanceof Blob)) return NextResponse.json({ error: 'Falta el plano.' }, { status: 400 })
  const m2 = Number(String(form.get('m2') ?? '').replace(',', '.'))
  const altura = Number(String(form.get('altura') ?? '').replace(',', '.'))

  try {
    const img = await prepararImagen(Buffer.from(await plano.arrayBuffer()))
    const { modelo } = await levantarModelo(img, {
      m2Construidos: Number.isFinite(m2) && m2 > 10 ? m2 : null,
      incluyeComunes: form.get('comunes') === '1',
      alturaLibre: Number.isFinite(altura) && altura >= 2 && altura <= 6 ? altura : null,
    })
    // La imagen normalizada vuelve al cliente: es el marco de coordenadas del modelo
    // y se reenvía en cada corrección.
    const jpg = await sharp(img.png).jpeg({ quality: 88 }).toBuffer()
    return NextResponse.json({ modelo, imagen: `data:image/jpeg;base64,${jpg.toString('base64')}` })
  } catch (e) {
    console.error('[maqueta/levantar]', e)
    const msg = e instanceof Error ? e.message : ''
    // Los errores de la API llegan como JSON crudo: a la persona solo le sirve saber que reintente.
    const legible = msg.startsWith('Sin escala') ? msg : 'La IA no ha podido levantar este plano. Vuelve a intentarlo; si se repite, avísanos.'
    return NextResponse.json({ error: legible }, { status: 500 })
  }
}
