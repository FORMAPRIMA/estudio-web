import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

// Claude only extracts raw text — ID matching is done locally in the frontend
interface ClaudeRow {
  user_nombre: string | null
  proyecto_nombre: string | null
  fase_label: string | null
  horas: number | null
  fecha: string | null   // ISO YYYY-MM-DD
  notas: string | null
}

// ── System prompt (minimal — no IDs, just extraction) ─────────────────────────

const SYSTEM_PROMPT = `Eres un asistente que extrae información de registros de horas de trabajo en formato CSV.

Para cada fila del CSV debes extraer:
- user_nombre: nombre de la persona que registró las horas (string o null)
- proyecto_nombre: nombre del proyecto (string o null)
- fase_label: nombre de la fase, tarea o categoría de trabajo (string o null)
- horas: número decimal de horas trabajadas (number o null)
- fecha: fecha en formato YYYY-MM-DD (null si no puedes determinar el año, intenta inferir mes y día del contexto)
- notas: descripción o notas adicionales (string o null)

Devuelve SOLO un array JSON válido, sin markdown, sin texto adicional.
El array debe tener exactamente una entrada por cada fila de datos (sin contar la cabecera).`

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    console.log('[translator] POST start')
    const supabase = await createClient()
    console.log('[translator] supabase created')
    const { data: { user } } = await supabase.auth.getUser()
    console.log('[translator] user:', user?.id ?? 'none')
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    console.log('[translator] apiKey present:', !!apiKey)
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })

    const body = await req.json() as { csvContent: string }
    const { csvContent } = body
    console.log('[translator] csvContent lines:', csvContent?.split('\n').length)

    if (!csvContent?.trim()) {
      return NextResponse.json({ error: 'CSV vacío' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })
    console.log('[translator] calling Claude...')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: csvContent,
        },
      ],
    })

    console.log('[translator] Claude responded, stop_reason:', message.stop_reason)
    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed: ClaudeRow[]
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/im, '')
        .replace(/\s*```\s*$/im, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse Claude response:', rawText)
      return NextResponse.json({
        error: `Error parseando respuesta de IA: ${rawText.slice(0, 300)}`,
        raw: rawText,
      }, { status: 500 })
    }

    return NextResponse.json({ rows: parsed })
  } catch (err) {
    console.error('time-tracker-translator error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
