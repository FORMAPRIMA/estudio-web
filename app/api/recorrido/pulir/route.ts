import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { esDelEquipo } from '@/lib/auth/equipo'

// Convierte las notas rápidas del equipo en obra en el texto que leerá el
// invitado (y el guía) en el recorrido del Open House.

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SISTEMA = `Eres el editor de textos de Forma Prima, estudio de arquitectura e interiorismo de Madrid.
Recibes las notas rápidas (a veces dictadas por voz) que alguien del equipo ha tomado sobre un detalle de la vivienda de Claudio Coello 38: una pieza de mobiliario, un material, una carpintería, una luminaria, una solución constructiva…
Escribe el texto que verán clientes muy importantes en su móvil durante un Open House.

Tono: el de una revista de arquitectura de primer nivel. Sobrio, cálido, preciso. Frases cortas. Nada de adjetivos vacíos ("espectacular", "increíble", "único"), nada de tono comercial ni de exclamaciones.
Extensión: entre 2 y 4 frases (máximo unas 70 palabras).
Reglas:
- Conserva todos los datos concretos: marcas, diseñadores, materiales, medidas, procedencia, oficios, años.
- No inventes datos que no estén en las notas.
- No menciones precios ni proveedores salvo que la nota sea claramente pública (un diseñador o una marca sí se mencionan).
- Corrige errores de dictado evidentes.
- Texto plano, sin markdown, sin comillas envolventes.
Responde SOLO con un JSON: {"titulo": "...", "texto": "..."}. El título es corto (2-6 palabras), en minúscula salvo nombres propios, sin punto final; si las notas ya traen un título bueno, respétalo.`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  if (!(await esDelEquipo(supabase, user.id))) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { titulo, notas, estancia, categoria } = (await req.json()) as {
    titulo?: string; notas?: string; estancia?: string; categoria?: string
  }
  if (!notas?.trim() && !titulo?.trim()) return NextResponse.json({ error: 'Sin contenido' }, { status: 400 })

  const entrada = [
    titulo?.trim() && `Título provisional: ${titulo.trim()}`,
    estancia && `Estancia: ${estancia}`,
    categoria && `Categoría: ${categoria}`,
    `Notas: ${(notas ?? '').trim().slice(0, 3000)}`,
  ].filter(Boolean).join('\n')

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SISTEMA,
      messages: [{ role: 'user', content: entrada }],
    })
    const raw = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
    const out = JSON.parse(json) as { titulo?: string; texto?: string }
    return NextResponse.json({ titulo: (out.titulo ?? '').trim(), texto: (out.texto ?? '').trim() })
  } catch (e) {
    console.error('[recorrido/pulir]', e)
    return NextResponse.json({ error: 'No se pudo pulir el texto' }, { status: 502 })
  }
}
