import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Asistente IA del CRM de Business development. Sustituye a window.claude.complete del artifact:
// recibe un prompt autocontenido (que ya pide el formato de salida, normalmente JSON) y devuelve
// el texto de la respuesta. Los dos usos: (1) redactar hipótesis comercial de una empresa,
// (2) interpretar el Weekly Update en lenguaje natural. El componente conserva su fallback
// heurístico si esta ruta falla.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_biz_dev'].includes(profile.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { prompt } = await req.json() as { prompt?: string }
  if (!prompt?.trim()) return NextResponse.json({ error: 'Sin contenido' }, { status: 400 })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: 'Eres el asistente del CRM de Business Development de Forma Prima, estudio de arquitectura residencial high-end en Madrid. Sigue las instrucciones del mensaje al pie de la letra. Cuando se pida JSON, responde ÚNICAMENTE con JSON válido, sin markdown ni explicaciones.',
      messages: [{ role: 'user', content: prompt }],
    })
    const texto = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    return NextResponse.json({ texto })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error IA' }, { status: 500 })
  }
}
