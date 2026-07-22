import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Traducción asistida ES→EN para el CMS de la web pública. El resultado alimenta
// el textbox EN pero queda editable por quien nutre el CMS: es un punto de partida,
// no una traducción final. Preámbulo fijo para fijar SIEMPRE el tono editorial.
const SYSTEM = `You are the in-house English copywriter for Forma Prima, a high-end architecture and interior design studio.
Translate the provided Spanish website copy into English AT AN EDITORIAL LEVEL: refined, confident, understated luxury — never literal, never marketing-cliché, never robotic. Preserve the meaning, register and rhythm of the original as brand voice, not word-for-word.
Rules:
- Return ONLY the translated text. No quotes, no notes, no explanation.
- Keep proper nouns, project names and the brand name "Forma Prima" unchanged.
- Preserve line breaks and any basic markdown (**, *, lists) if present.
- If the input is a single short label or eyebrow, keep it equally short and punchy.`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { texto } = (await req.json()) as { texto?: string }
  if (!texto || !texto.trim()) return NextResponse.json({ error: 'Texto vacío' }, { status: 400 })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: 'user', content: texto }],
    })
    const traduccion = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    if (!traduccion) return NextResponse.json({ error: 'Sin traducción' }, { status: 500 })
    return NextResponse.json({ traduccion })
  } catch (err) {
    console.error('[web-publica] traducir:', err)
    return NextResponse.json({ error: 'No se pudo traducir.' }, { status: 500 })
  }
}
