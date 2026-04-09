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

  // Download the file to pass as base64 to Claude
  const fileRes = await fetch(imageUrl)
  if (!fileRes.ok) return NextResponse.json({ error: 'No se pudo obtener el archivo' }, { status: 400 })
  const fileBuffer = await fileRes.arrayBuffer()
  const base64 = Buffer.from(fileBuffer).toString('base64')
  const contentType = fileRes.headers.get('content-type') ?? 'image/jpeg'
  const isPdf = contentType.includes('pdf') || imageUrl.toLowerCase().endsWith('.pdf')

  const today = new Date().toISOString().split('T')[0]

  const itemShape = `{
  "fecha_ticket": "YYYY-MM-DD or null",
  "hora_ticket": "HH:MM or null",
  "monto": number or null,
  "moneda": "EUR",
  "tipo": one of [${TIPOS.map(t => `"${t}"`).join(', ')}],
  "proveedor": "nombre del establecimiento/empresa or null",
  "descripcion": "descripción breve del gasto (max 80 chars) or null"
}`

  const commonRules = `Reglas por campo:
- fecha_ticket: fecha del ticket/factura. Usa null si no está clara.
- hora_ticket: hora de la compra en formato HH:MM (24h). Extráela si aparece en el ticket. Usa null si no está visible.
- monto: importe TOTAL en número (sin símbolo). Usa null si no está claro.
- moneda: casi siempre EUR. Si ves otro símbolo, ponlo (USD, GBP…).
- tipo: elige el más apropiado de la lista. "gasto_proyecto" para materiales/servicios de obra.
- proveedor: nombre del restaurante, empresa, taxi app, etc.
- descripcion: qué se compró o el concepto principal.`

  const imageSystemPrompt = `Eres un asistente de gestión de gastos de una empresa de arquitectura llamada Forma Prima.
Analiza la imagen del ticket o factura y extrae su información.
Responde ÚNICAMENTE con un array JSON de UN elemento, sin texto adicional, sin markdown, sin explicaciones.
Formato exacto:
[${itemShape}]
${commonRules}`

  const pdfSystemPrompt = `Eres un asistente de gestión de gastos de una empresa de arquitectura llamada Forma Prima.
Analiza TODAS las páginas del PDF y determina cuántos documentos distintos contiene.

REGLA FUNDAMENTAL:
- Si todas las páginas pertenecen al MISMO ticket o factura (aunque sean varias páginas): devuelve un array con UN solo objeto.
- Si el PDF agrupa VARIOS tickets o facturas diferentes (ej: paquete de recibos, varios albaranes): devuelve un array con UN objeto por cada documento distinto, en orden de aparición.

Responde ÚNICAMENTE con un array JSON válido, sin texto adicional, sin markdown, sin explicaciones.
Formato exacto (uno o varios elementos):
[${itemShape}]
${commonRules}`

  // Build content block depending on file type
  const fileContent = isPdf
    ? {
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf' as const,
          data: base64,
        },
      }
    : {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: (contentType.startsWith('image/') ? contentType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: base64,
        },
      }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: isPdf ? pdfSystemPrompt : imageSystemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          fileContent as any,
          {
            type: 'text',
            text: isPdf
              ? `Analiza este PDF, determina si contiene uno o varios documentos distintos, y extrae los datos. Fecha de referencia: ${today}.`
              : `Analiza este ticket/factura y extrae los datos. Fecha de referencia: ${today}.`,
          },
        ],
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'

  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    // Normalise: always return { items: [...] }
    const items = Array.isArray(parsed) ? parsed : [parsed]
    return NextResponse.json({ items, raw })
  } catch {
    return NextResponse.json({ error: 'No se pudo interpretar la respuesta de la IA.', raw }, { status: 422 })
  }
}
