import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'

const client = new Anthropic()

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Auth: fp_partner only
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { descripcion } = await req.json() as { descripcion: string }
    if (!descripcion?.trim()) {
      return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
    }

    // Read CLAUDE.md from filesystem
    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md')
    let claudeMd = ''
    try {
      claudeMd = fs.readFileSync(claudeMdPath, 'utf-8')
    } catch {
      return NextResponse.json({ error: 'No se encontró CLAUDE.md en la raíz del proyecto.' }, { status: 500 })
    }

    // ── Step 1: Extract relevant sections from CLAUDE.md ─────────────────────

    const step1System = `
Eres un asistente técnico especializado en el proyecto "estudio-web" de Forma Prima.
Tu única tarea es analizar una solicitud de cambio o mejora, leer el CLAUDE.md completo del proyecto,
y extraer SOLO las secciones, tablas, rutas, componentes, patrones y convenciones que son
directamente relevantes para implementar ese cambio específico.

Devuelve ÚNICAMENTE el contexto filtrado y relevante — no más de 400 palabras.
No incluyas secciones que no sean relevantes. No añadas explicaciones.
Usa el mismo formato que tiene el CLAUDE.md original (encabezados, listas).
    `.trim()

    const step1Message = `
## Solicitud del usuario
${descripcion.trim()}

## CLAUDE.md completo
${claudeMd}
    `.trim()

    const step1 = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     step1System,
      messages:   [{ role: 'user', content: step1Message }],
    })

    const relevantContext = step1.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    // ── Step 2: Generate the full actionable prompt ───────────────────────────

    const step2System = `
Eres un ingeniero de software senior experto en el proyecto "estudio-web" de Forma Prima.
Tu tarea es generar un prompt extremadamente completo, preciso y autónomo para Claude Code,
que sea capaz de implementar la solicitud descrita sin necesidad de contexto adicional.

El prompt que generes debe:
1. Estar escrito directamente en segunda persona a Claude Code (como instrucción directa)
2. Mencionar los ficheros específicos a crear o modificar, con sus rutas completas
3. Describir exactamente qué implementar: comportamiento esperado, casos borde, estados de carga
4. Referenciar tablas de base de datos, server actions, componentes y patrones relevantes
5. Incluir convenciones de estilo y código del proyecto (inline styles, patrones de server action, etc.)
6. Ser exhaustivo: que Claude Code pueda ejecutarlo sin hacerte preguntas
7. Estar en español
8. NO incluir preámbulo ni explicaciones — empezar directamente con la instrucción

Al FINAL del prompt, añade siempre este párrafo separado por una línea en blanco:
"Una vez implementado el cambio, actualiza el archivo CLAUDE.md en la raíz del repositorio para reflejar cualquier nueva ruta, componente, tabla, convención o patrón que hayas añadido o modificado."
    `.trim()

    const step2Message = `
## Solicitud del usuario
${descripcion.trim()}

## Contexto relevante del proyecto (extraído del CLAUDE.md)
${relevantContext}
    `.trim()

    const step2 = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system:     step2System,
      messages:   [{ role: 'user', content: step2Message }],
    })

    const prompt = step2.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    return NextResponse.json({ prompt, relevantContext })
  } catch (err) {
    console.error('[mejoras/prompt-generator]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}
