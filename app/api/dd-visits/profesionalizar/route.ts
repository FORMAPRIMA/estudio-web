import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Genera texto profesional para informe a partir de la nota libre del técnico.
// La IA actúa como editor técnico, nunca como perito autónomo.
// El comentario original del técnico se preserva siempre en la BD.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const {
    comentario_tecnico,
    titulo,
    especialidad,
    zona_edificio,
    estado,
    riesgo,
    objetivo_revision,
    senales_alerta,
  } = await req.json()

  if (!comentario_tecnico?.trim()) {
    return NextResponse.json({ error: 'Sin comentario del técnico' }, { status: 400 })
  }

  const context = [
    titulo           ? `Título de la card: ${titulo}`                      : '',
    especialidad     ? `Especialidad: ${especialidad}`                     : '',
    zona_edificio    ? `Zona del edificio: ${zona_edificio}`               : '',
    estado           ? `Estado marcado: ${estado.replace(/_/g, ' ')}`      : '',
    riesgo           ? `Nivel de riesgo: ${riesgo.replace(/_/g, ' ')}`     : '',
    objetivo_revision ? `Objetivo de revisión: ${objetivo_revision}`       : '',
    senales_alerta   ? `Señales de alerta de referencia: ${senales_alerta}` : '',
  ].filter(Boolean).join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `Eres un redactor técnico especializado en edificación residencial y Due Diligence inmobiliaria.
Tu función es transformar notas de campo de técnicos en texto profesional para informes de Due Diligence Técnica No Invasiva.

REGLAS ESTRICTAS — NO negociables:
- Basa tu redacción EXCLUSIVAMENTE en el comentario del técnico y el contexto de la card.
- NO inventes causas técnicas no mencionadas por el técnico.
- NO inventes mediciones, normativa, CAPEX ni porcentajes.
- NO conviertas sospechas en afirmaciones definitivas.
- NO uses lenguaje alarmista.
- Mantén las incertidumbres del técnico: si dijo "no se pudo acceder", refleja exactamente eso.
- Si el técnico no vio algo, no afirmes que funciona correctamente.
- Una factura de mantenimiento NO equivale a instalación conforme.
- Una observación visual NO es un diagnóstico definitivo.

FÓRMULAS OBLIGATORIAS según el caso:
- "se observa" / "se aprecia" (para observaciones directas)
- "aparentemente" / "a simple vista" (para inferencias)
- "no fue posible verificar" / "no resultó accesible" (para limitaciones)
- "requiere confirmación documental" (para cuestiones pendientes)
- "recomendable revisar" / "se recomienda verificar" (para recomendaciones)
- "dentro del alcance visual de la visita" (para limitar el alcance)

ESTRUCTURA DEL TEXTO (máx 200 palabras):
1. Observación principal (qué se vio o no se pudo ver)
2. Posible impacto (SOLO si el técnico lo sugiere o el riesgo marcado lo justifica)
3. Recomendación preliminar (SOLO si aplica, en condicional)

FORMATO: Texto plano. Sin markdown. Sin asteriscos. Sin encabezados. Un único párrafo o dos párrafos cortos.`,
    messages: [{
      role: 'user',
      content: `CONTEXTO DE LA CARD:\n${context}\n\nCOMENTARIO DEL TÉCNICO:\n${comentario_tecnico.trim()}`,
    }],
  })

  const texto = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return NextResponse.json({ texto })
}
