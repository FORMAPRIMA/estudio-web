import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const body = await req.json() as {
    label:           string
    texto:           string
    entregables:     { grupo: string; items: string[] }[]
    semanas_default: string
    pago:            { label: string; pct: number }[]
  }

  const systemPrompt = `You are a professional translator for an architecture and interior design studio. Translate the following service content from Spanish to English. Return ONLY valid JSON with the same structure as the input (label, texto, entregables array, semanas_default, pago array). Keep all percentages (pct values) unchanged. Translate only text strings.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Translate this JSON from Spanish to English and return ONLY valid JSON:\n\n${JSON.stringify(body, null, 2)}`,
      },
    ],
    system: systemPrompt,
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  let translated: typeof body
  try {
    translated = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Translation response was not valid JSON', raw: text }, { status: 500 })
  }

  return NextResponse.json(translated)
}
