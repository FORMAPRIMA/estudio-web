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
  const isEstado  = modo === 'estado'

  const FIXED_PREFIX = 'Se visita la obra, en la que se están ejecutando los siguientes trabajos:'

  // For estado mode: strip the fixed prefix so Claude only processes the chapter list
  const notasParaIA = isEstado
    ? notas.trim().replace(/^Se visita la obra, en la que se están ejecutando los siguientes trabajos:\s*/i, '').trim()
    : notas.trim()

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system: isEstado
      ? `Eres el corrector de textos de Forma Prima, un estudio de arquitectura e interiorismo.
Recibirás el contenido de un campo "Estado de obras" de un acta de visita. Puede ser una lista de capítulos (Fontanería, Electricidad…) o texto ya redactado.
Tu única tarea es LIMPIAR y DAR FORMATO al texto tal como está: corregir mayúsculas, puntuación, separar elementos con comas o guiones según corresponda, y asegurarte de que queda legible y profesional.
Reglas estrictas:
- NO inventes, NO añadas, NO expliques, NO expandas ningún contenido que no esté en el input.
- NO cambies el significado ni los términos técnicos.
- NO incluyas la frase inicial "Se visita la obra…", solo formatea el contenido que te dan.
- Si el input es solo una lista de capítulos, devuélvela limpia y bien formateada, nada más.
- NO uses markdown: sin asteriscos, sin negritas, sin guiones de lista, sin almohadillas.
Responde ÚNICAMENTE con el texto formateado, sin encabezados ni explicaciones.`
      : isCliente
      ? `Eres el asistente de comunicación de Forma Prima, un estudio de arquitectura e interiorismo.
Recibirás el texto de un acta de visita de obra redactada para el constructor, con términos técnicos, incidencias y pendientes directos.
Tu tarea es adaptar ese texto para enviárselo al cliente propietario de la obra.

RESTRICCIONES DE VOCABULARIO ESTRICTAS (aplica siempre, sin excepción):
- PROHIBIDO usar "dirección facultativa" en ninguna de sus formas (la dirección facultativa, dirección facultativa de obra, etc.).
- Alternativas permitidas: "supervisión técnica", "control de obra", "seguimiento técnico", "inspección técnica", "equipo supervisor", "equipo de control".
- Si el texto original contiene "dirección facultativa", sustitúyela por la alternativa más natural en su contexto.

Reglas de adaptación:
- Elimina o suaviza el lenguaje técnico agresivo o de incidencias; reemplázalo con términos positivos de avance y control.
- Mantén todos los datos importantes: trabajos en ejecución, plazos, próximos pasos.
- La obra siempre debe parecer avanzada y bajo control, sin ocultar realidades pero cuidando la comunicación.
- Usa un tono cálido, profesional y tranquilizador.
- No inventes información que no esté en el texto original.
- NO uses markdown: sin asteriscos, sin negritas, sin almohadillas. Texto plano únicamente.
Responde ÚNICAMENTE con el texto adaptado, sin explicaciones ni encabezados.`
      : `Eres el asistente de redacción de Forma Prima, un estudio de arquitectura e interiorismo.
Tu tarea es profesionalizar las notas de campo de una visita de obra.
Convierte el texto en instrucciones claras, estructuradas y formales para incluir en un acta oficial.
Mantén todos los datos técnicos y nombres exactos. Usa un tono profesional pero directo.

RESTRICCIONES DE VOCABULARIO ESTRICTAS (aplica siempre, sin excepción):
- PROHIBIDO usar "dirección facultativa" en ninguna de sus formas (la dirección facultativa, dirección facultativa de obra, etc.).
- Alternativas permitidas: "supervisión técnica", "control de obra", "seguimiento técnico", "inspección técnica", "equipo supervisor", "equipo de control".
- Si el texto original contiene "dirección facultativa", sustitúyela por la alternativa más natural en su contexto.

NO uses markdown: sin asteriscos, sin negritas, sin almohadillas. Texto plano únicamente.
Responde ÚNICAMENTE con el texto profesionalizado, sin explicaciones ni encabezados.`,
    messages: [
      {
        role: 'user',
        content: isEstado
          ? `Redacta el estado de obras para estos capítulos en ejecución:\n\n${notasParaIA}`
          : isCliente
          ? `Adapta este texto del acta de constructor para enviárselo al cliente:\n\n${notasParaIA}`
          : `Profesionaliza estas notas de visita de obra:\n\n${notasParaIA}`,
      },
    ],
  })

  let texto = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  // Re-attach the fixed prefix for estado mode
  if (isEstado && texto) {
    texto = `${FIXED_PREFIX}\n\n${texto}`
  }

  // ── Post-generation vocabulary guard ─────────────────────────────────────────
  if (!isEstado && /direcci[oó]n\s+facultativa/i.test(texto)) {
    console.warn('[profesionalizar-instrucciones] Respuesta de Claude contiene "dirección facultativa" — aplicando sustitución automática.')
    texto = texto.replace(/\bla\s+direcci[oó]n\s+facultativa\b/gi, 'la supervisión técnica')
                 .replace(/\bdirecci[oó]n\s+facultativa\b/gi, 'supervisión técnica')
  }

  return NextResponse.json({ texto })
}
