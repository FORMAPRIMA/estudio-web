import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

interface ContenidoActa {
  titulo: string
  estado_obras: string
  instrucciones: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { contenido, idioma } = await req.json() as { contenido: ContenidoActa; idioma: string }

    if (idioma !== 'en') {
      return NextResponse.json({ error: 'Solo se traduce al inglés (idioma must be "en")' }, { status: 400 })
    }

    if (!contenido || typeof contenido !== 'object') {
      return NextResponse.json({ error: 'Contenido inválido' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are a professional translator for Forma Prima, an architecture and interior design studio.
Translate construction site visit report content from Spanish to English.
Maintain a professional, formal and technical tone.
Preserve proper nouns (project names, company names, people names) exactly as they are.
Do NOT add any explanation or commentary. Return ONLY a valid JSON object with the exact same keys as the input.`,
      messages: [{
        role: 'user',
        content: `Translate the following JSON content to English. Return ONLY the JSON object, no markdown fences, no explanation:\n\n${JSON.stringify(contenido, null, 2)}`,
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    // Strip possible markdown fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()

    let translated: ContenidoActa
    try {
      translated = JSON.parse(cleaned)
    } catch {
      console.error('[traducir-acta] Failed to parse Claude response:', cleaned)
      return NextResponse.json({ error: 'Error al parsear la respuesta de traducción' }, { status: 500 })
    }

    return NextResponse.json({ contenido: translated })
  } catch (err) {
    console.error('[traducir-acta]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}
