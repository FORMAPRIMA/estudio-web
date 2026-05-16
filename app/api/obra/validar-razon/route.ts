import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// ══════════════════════════════════════════════════════════════════════════════
// Validación de la razón de un cambio de presupuesto (gestión de obra).
//
// Llama a Claude Haiku para detectar si la justificación es real o sólo
// "relleno" para pasar el filtro de 40 caracteres. Devuelve:
//   { valid: true }                            → razón suficiente
//   { valid: false, suggestion: '...' }       → razón insuficiente; sugerencia
//   { valid: true, ai_unavailable: true }     → la API falló, dejamos pasar
//                                                 (fallback graceful — la razón
//                                                 ya pasó la validación de longitud)
//
// El cliente debe interpretar `valid` como gate de UI. Si false, muestra la
// sugerencia y bloquea el guardado. Si true (incluso con ai_unavailable),
// procede a logear el cambio.
// ══════════════════════════════════════════════════════════════════════════════

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

interface Body {
  reason:  string
  context: string  // descripción libre de lo que se cambia (p.ej. "edición de cantidad de pavimento de gres en cocina")
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const body = await req.json() as Body
    const reason  = (body.reason ?? '').trim()
    const context = (body.context ?? '').trim().slice(0, 500)

    if (reason.length < 40) {
      return NextResponse.json({ valid: false, suggestion: 'La razón debe tener al menos 40 caracteres concretos.' })
    }

    // Fallback graceful: si no hay API key configurada, aceptamos.
    if (!client) {
      return NextResponse.json({ valid: true, ai_unavailable: true })
    }

    try {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `Eres un validador de justificaciones de cambios en presupuesto de obra de Forma Prima.

Te paso (a) el contexto del cambio que se está haciendo y (b) la razón que el usuario ha escrito.

Tu tarea: decidir si la razón es una JUSTIFICACIÓN REAL del cambio (responde "VALID") o es relleno/genérico/sin sentido (responde "INVALID").

Una razón VÁLIDA cumple TODAS estas condiciones:
- Aporta información concreta sobre POR QUÉ se está haciendo el cambio.
- Es coherente con el contexto.
- No es texto sin sentido, ni caracteres repetidos, ni "porque sí", ni "asdfasdf", ni copy-paste vacío.

Una razón INVÁLIDA es relleno: "asdf asdf asdf", "porque me lo pidieron y ya está", o texto que no explica nada concreto aunque tenga muchos caracteres.

Responde EXCLUSIVAMENTE en formato JSON:
{"valid": true} o
{"valid": false, "suggestion": "<una frase breve indicando qué le falta a la razón>"}

Sin markdown, sin explicaciones extras, sólo el JSON.`,
        messages: [
          {
            role: 'user',
            content: `Contexto del cambio: ${context || '(sin contexto)'}\n\nRazón escrita por el usuario:\n${reason}`,
          },
        ],
      })

      const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{"valid":true}'
      // Parse JSON robustly
      let parsed: { valid: boolean; suggestion?: string } = { valid: true }
      try {
        // Strip code fences if any
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
        parsed = JSON.parse(cleaned)
      } catch {
        // If we can't parse, default to valid (don't block the user)
        return NextResponse.json({ valid: true, ai_unavailable: true })
      }

      if (parsed.valid === false && parsed.suggestion) {
        return NextResponse.json({ valid: false, suggestion: parsed.suggestion })
      }
      return NextResponse.json({ valid: true })
    } catch (aiErr) {
      console.warn('[validar-razon] Claude API falló, aplicando fallback:', aiErr)
      return NextResponse.json({ valid: true, ai_unavailable: true })
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, { status: 500 })
  }
}
