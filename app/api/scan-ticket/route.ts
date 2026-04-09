import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TIPOS = [
  'taxi_transporte',
  'restaurante_comida',
  'alojamiento',
  'material_oficina',
  'software_suscripcion',
  'gasto_proyecto',
  'factura_proveedor',
  'otro',
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { imageUrl } = await req.json() as { imageUrl: string }
  if (!imageUrl) return NextResponse.json({ error: 'Sin imagen' }, { status: 400 })

  // Download the image to pass as base64 to Claude
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) return NextResponse.json({ error: 'No se pudo obtener la imagen' }, { status: 400 })
  const imgBuffer = await imgRes.arrayBuffer()
  const base64 = Buffer.from(imgBuffer).toString('base64')
  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
  const mediaType = contentType.startsWith('image/') ? contentType : 'image/jpeg'

  const today = new Date().toISOString().split('T')[0]

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `Eres un asistente de gestión de gastos de una empresa de arquitectura llamada Forma Prima.
Analiza imágenes de tickets y facturas y extrae su información en JSON.
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones.
Formato exacto:
{
  "fecha_ticket": "YYYY-MM-DD or null",
  "monto": number or null,
  "moneda": "EUR",
  "tipo": one of [${TIPOS.map(t => `"${t}"`).join(', ')}],
  "proveedor": "nombre del establecimiento/empresa or null",
  "descripcion": "descripción breve del gasto (max 80 chars) or null"
}
Reglas:
- fecha_ticket: extrae la fecha del ticket. Si no es clara, usa null.
- monto: el importe TOTAL del ticket en número (sin símbolo). Usa null si no está claro.
- moneda: casi siempre EUR. Si ves otro símbolo, ponlo (USD, GBP…).
- tipo: elige el más apropiado de la lista. "gasto_proyecto" para materiales/servicios de obra.
- proveedor: nombre del restaurante, empresa, taxi app, etc.
- descripcion: qué se compró o el concepto principal.`,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Analiza este ticket/factura y extrae los datos. Fecha de referencia: ${today}.`,
          },
        ],
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'

  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    return NextResponse.json({ data: parsed, raw })
  } catch {
    return NextResponse.json({ error: 'No se pudo interpretar la respuesta de la IA.', raw }, { status: 422 })
  }
}
