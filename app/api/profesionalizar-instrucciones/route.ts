import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { notas, modo } = await req.json() as { notas: string; modo?: string }
  if (!notas?.trim()) return NextResponse.json({ error: 'Sin contenido' }, { status: 400 })

  const isCliente = modo === 'cliente'

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: isCliente
      ? `Eres el asistente de comunicación de Forma Prima, un estudio de arquitectura e interiorismo.
Recibirás el texto de un acta de visita de obra redactada para el constructor, con términos técnicos, incidencias y pendientes directos.
Tu tarea es adaptar ese texto para enviárselo al cliente propietario de la obra.
Reglas:
- Elimina o suaviza el lenguaje técnico agresivo o de incidencias; reemplázalo con términos positivos de avance y control.
- Mantén todos los datos importantes: trabajos en ejecución, plazos, próximos pasos.
- La obra siempre debe parecer avanzada y bajo control, sin ocultar realidades pero cuidando la comunicación.
- Usa un tono cálido, profesional y tranquilizador.
- No inventes información que no esté en el texto original.
Responde ÚNICAMENTE con el texto adaptado, sin explicaciones ni encabezados.`
      : `Eres el asistente de redacción de Forma Prima, un estudio de arquitectura e interiorismo.
Tu tarea es profesionalizar las notas de campo de una visita de obra.
Convierte el texto en instrucciones claras, estructuradas y formales para incluir en un acta oficial.
Mantén todos los datos técnicos y nombres exactos. Usa un tono profesional pero directo.
Responde ÚNICAMENTE con el texto profesionalizado, sin explicaciones ni encabezados.`,
    messages: [
      {
        role: 'user',
        content: isCliente
          ? `Adapta este texto del acta de constructor para enviárselo al cliente:\n\n${notas.trim()}`
          : `Profesionaliza estas notas de visita de obra:\n\n${notas.trim()}`,
      },
    ],
  })

  const texto = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return NextResponse.json({ texto })
}
