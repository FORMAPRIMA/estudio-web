import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import {
  computeParametricSchedule,
  formatScheduleDate,
  type ScheduleChapter,
  type ScheduleMilestone,
} from '@/lib/fp-execution/schedule'
import { snapToNextBusinessDay, addBusinessDays } from '@/lib/fp-execution/businessDays'

export const runtime = 'nodejs'
export const maxDuration = 120  // segundos: llamada a Claude (Sonnet puede tardar hasta ~30s) + render PDF

const BUCKET = 'fpe-planning'
// Sonnet 4.5 con sufijo de fecha (ID estable y válido en la API de Anthropic).
// La API NO acepta el alias 'claude-sonnet-4-6' — siempre requiere un model id dated.
const MODEL  = 'claude-sonnet-4-5-20250929'

// Configuración defensiva: si el modelo no responde, fallamos rápido y caemos al fallback
// determinista en vez de dejar la function reintentando hasta el timeout de Vercel.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 1,
  timeout: 45_000,
})

// ─────────────────────────────────────────────────────────────────────────────
// Estructura de la narrativa devuelta por la IA
// ─────────────────────────────────────────────────────────────────────────────
interface PlanningNarrative {
  resumen_ejecutivo: string
  narrativa_por_capitulo: Record<string, string>
  analisis_ruta_critica: string
  coordinacion: string
}

interface RequestBody {
  projectName: string
  direccion?: string | null
  ciudad?: string | null
  fechaInicio: string
  m2: number | null
  scheduleChapters: ScheduleChapter[]
  scheduleMilestones: ScheduleMilestone[]
  chapterDaysOverrides: Record<string, number | null>
  duracionFactor?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Construye el input estructurado que se manda a Claude
// (fechas reales calculadas a partir del schedule, no estimadas por la IA)
// ─────────────────────────────────────────────────────────────────────────────
function buildAiPayload(body: RequestBody) {
  const factor = typeof body.duracionFactor === 'number' && body.duracionFactor > 0 ? body.duracionFactor : 1.0
  const start = snapToNextBusinessDay(new Date(body.fechaInicio))
  const r = computeParametricSchedule(body.scheduleChapters, new Date(body.fechaInicio), body.m2, body.chapterDaysOverrides, factor)
  const endDate = r.totalDays > 0 ? addBusinessDays(start, Math.round(r.totalDays)) : null

  const milestoneNameById: Record<string, string> = {}
  for (const m of body.scheduleMilestones) milestoneNameById[m.id] = m.nombre

  const capsForAi = body.scheduleChapters
    .filter(ch => ch.phases.length > 0)
    .map(ch => {
      const phaseEntries = ch.phases.map(ph => r.phases[ph.id]).filter(Boolean)
      if (phaseEntries.length === 0) return null
      const chStart = new Date(Math.min(...phaseEntries.map(e => e.startDate.getTime())))
      const chEnd   = new Date(Math.max(...phaseEntries.map(e => e.endDate.getTime())))
      const days    = r.chapterDays[ch.id] ?? 0
      const achievesAll = Array.from(new Set(ch.phases.flatMap(p => p.achieves)))
        .map(mid => milestoneNameById[mid]).filter(Boolean)
      const requiresAll = Array.from(new Set(ch.phases.flatMap(p => p.requires)))
        .map(mid => milestoneNameById[mid]).filter(Boolean)
      return {
        id: ch.id,
        nombre: ch.nombre,
        fecha_inicio: formatScheduleDate(chStart),
        fecha_fin: formatScheduleDate(chEnd),
        dias_laborables: Math.round(days),
        fases: ch.phases
          .sort((a, b) => a.orden - b.orden)
          .map(ph => {
            const e = r.phases[ph.id]
            return {
              nombre: ph.nombre,
              fecha_inicio: e ? formatScheduleDate(e.startDate) : null,
              fecha_fin:    e ? formatScheduleDate(e.endDate)   : null,
              dias_laborables: e ? Math.round(e.durationDays) : 0,
              logra_hitos:    ph.achieves.map(mid => milestoneNameById[mid]).filter(Boolean),
              requiere_hitos: ph.requires.map(mid => milestoneNameById[mid]).filter(Boolean),
            }
          }),
        logra_hitos: achievesAll,
        requiere_hitos: requiresAll,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const milestonesForAi = body.scheduleMilestones
    .map(m => {
      const ends: Date[] = []
      for (const ch of body.scheduleChapters) {
        for (const ph of ch.phases) {
          if (ph.achieves.includes(m.id)) {
            const e = r.phases[ph.id]
            if (e) ends.push(e.endDate)
          }
        }
      }
      if (ends.length === 0) return null
      const date = new Date(Math.max(...ends.map(d => d.getTime())))
      return { nombre: m.nombre, fecha: formatScheduleDate(date) }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return {
    proyecto: {
      nombre: body.projectName,
      direccion: body.direccion ?? null,
      ciudad: body.ciudad ?? null,
      m2: body.m2,
      fecha_inicio: formatScheduleDate(start),
      fecha_fin_estimada: endDate ? formatScheduleDate(endDate) : null,
      duracion_dl: Math.round(r.totalDays),
      duracion_semanas: +(r.totalDays / 5).toFixed(1),
    },
    capitulos: capsForAi,
    hitos: milestonesForAi,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Llamada a Claude. Devuelve JSON estricto.
// Si falla por cualquier motivo, devolvemos null para que el caller use el fallback.
// ─────────────────────────────────────────────────────────────────────────────
async function generateNarrative(payload: ReturnType<typeof buildAiPayload>): Promise<PlanningNarrative | null> {
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: `Eres un director de obra senior con 25 años de experiencia en edificación residencial y reformas integrales, redactando un planning corporativo de Forma Prima (estudio de arquitectura y dirección facultativa con sede en Madrid).

REGLAS:
- Redacta en español de España, registro técnico-corporativo.
- Tono: declarativo, sobrio, sin adjetivos vacíos ni lenguaje comercial. Cero "innovador", "puntero", "sinergia".
- Usa fechas EXACTAS tal como aparecen en el payload — nunca las inventes ni redondees a meses.
- Cuando menciones duraciones, usa la unidad "días laborables" (DL) o semanas.
- Habla en futuro (la obra aún no se ha ejecutado) y siempre desde la perspectiva de la dirección facultativa de Forma Prima.
- Frases cortas, máximo 25 palabras. Párrafos de 3-5 frases.
- No uses markdown, asteriscos, encabezados ni listas — solo prosa.
- No menciones que eres una IA ni hagas meta-comentarios sobre el documento.

ESTRUCTURA OBLIGATORIA del JSON de salida:
{
  "resumen_ejecutivo": string (3-5 párrafos. Describe alcance, periodo, principales bloques de obra, hitos críticos y el papel de Forma Prima como dirección facultativa.),
  "narrativa_por_capitulo": { "<id-del-capitulo>": string } (2-3 frases por capítulo. Indica fechas, qué incluye y qué hitos desbloquea o requiere. NO repitas las tablas, aporta criterio.),
  "analisis_ruta_critica": string (3-4 párrafos. Identifica la secuencia más larga sin holgura, los puntos donde un retraso impactaría el plazo total, y los capítulos en paralelo si los hay.),
  "coordinacion": string (2-3 párrafos. Describe la cadencia de visitas, el papel de la dirección facultativa, el canal de comunicación con partners y el seguimiento de hitos.)
}

DEVUELVE EXCLUSIVAMENTE EL JSON. Sin texto antes ni después. Sin bloques de código.`,
      messages: [{
        role: 'user',
        content: `Redacta el planning narrativo para este proyecto. Las claves de "narrativa_por_capitulo" deben coincidir exactamente con los ids del array "capitulos".

PROYECTO (JSON):
${JSON.stringify(payload, null, 2)}`,
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    if (!text) return null

    // El modelo a veces envuelve en ```json ... ```. Limpiamos por si acaso.
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned) as PlanningNarrative
    if (!parsed?.resumen_ejecutivo || !parsed?.narrativa_por_capitulo) return null
    return parsed
  } catch (err) {
    console.error('[planning-pdf] generateNarrative error:', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback determinista: si la IA falla, generamos narrativa con plantilla.
// Mantiene el documento siempre generable.
// ─────────────────────────────────────────────────────────────────────────────
function fallbackNarrative(payload: ReturnType<typeof buildAiPayload>): PlanningNarrative {
  const p = payload.proyecto
  const numCaps = payload.capitulos.length
  const numHitos = payload.hitos.length

  const resumen = `Forma Prima asume la dirección facultativa de la obra ubicada en ${p.direccion ?? p.ciudad ?? 'el emplazamiento del proyecto'}. La intervención comprende ${numCaps} capítulos de ejecución y se desarrollará a lo largo de ${p.duracion_dl} días laborables, equivalentes a ${p.duracion_semanas} semanas. El inicio se prevé el ${p.fecha_inicio} y la finalización estimada el ${p.fecha_fin_estimada}. El planning contempla ${numHitos} hitos críticos que estructuran el avance de la obra y condicionan el inicio de fases dependientes.`

  const narrativaCaps: Record<string, string> = {}
  for (const ch of payload.capitulos) {
    const partes: string[] = []
    partes.push(`El capítulo de ${ch.nombre} arrancará el ${ch.fecha_inicio} y concluirá el ${ch.fecha_fin}, con una duración estimada de ${ch.dias_laborables} días laborables.`)
    if (ch.requiere_hitos.length > 0) {
      partes.push(`Su inicio queda condicionado al hito previo: ${ch.requiere_hitos.join(', ')}.`)
    }
    if (ch.logra_hitos.length > 0) {
      partes.push(`A su finalización se logran los hitos de ${ch.logra_hitos.join(', ')}.`)
    }
    narrativaCaps[ch.id] = partes.join(' ')
  }

  const ruta = `La ruta crítica del proyecto recorre los ${numCaps} capítulos en su secuencia natural. Cualquier desviación en los capítulos iniciales se trasladará linealmente al plazo total. La dirección facultativa supervisará especialmente la transición entre capítulos y la consecución de los hitos intermedios.`

  const coord = `Forma Prima coordinará la dirección facultativa de la obra desde su oficina en Madrid. Se prevé una cadencia mínima de una visita semanal en obra, con actas de visita firmadas y comunicadas a propiedad y constructora. El seguimiento de hitos se realizará en reuniones de coordinación mensuales o ad-hoc en función del estado de avance.`

  return {
    resumen_ejecutivo: resumen,
    narrativa_por_capitulo: narrativaCaps,
    analisis_ruta_critica: ruta,
    coordinacion: coord,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || !['fp_partner', 'fp_manager'].includes(profile.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = (await req.json()) as RequestBody
    if (!body?.projectName || !body?.fechaInicio || !Array.isArray(body?.scheduleChapters)) {
      return NextResponse.json({ error: 'Datos del planning incompletos.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1) Compute next version
    const { data: lastDoc } = await admin
      .from('fpe_planning_documents')
      .select('version')
      .eq('fpe_project_id', id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextVersion = (lastDoc?.version ?? 0) + 1

    // 2) Llamada a Claude (con fallback determinista)
    const aiPayload = buildAiPayload(body)
    const aiNarrative = await generateNarrative(aiPayload)
    const usedAi  = !!aiNarrative
    const narrative = aiNarrative ?? fallbackNarrative(aiPayload)

    // 3) Render PDF
    const reactPdf = await import('@react-pdf/renderer')
    const { buildPlanningElement } = await import('@/components/pdfs/PlanningPDF')

    const emittedAt = new Date()
    const element = buildPlanningElement({
      projectName: body.projectName,
      direccion: body.direccion ?? null,
      ciudad: body.ciudad ?? null,
      fechaInicio: body.fechaInicio,
      m2: typeof body.m2 === 'number' ? body.m2 : null,
      scheduleChapters: body.scheduleChapters,
      scheduleMilestones: body.scheduleMilestones ?? [],
      chapterDaysOverrides: body.chapterDaysOverrides ?? {},
      duracionFactor: typeof body.duracionFactor === 'number' && body.duracionFactor > 0 ? body.duracionFactor : 1.0,
      version: nextVersion,
      emittedAt,
      usedAi,
      narrative,
    })

    const buffer = await reactPdf.renderToBuffer(element as React.ReactElement)

    // 4) Subir a Storage (privado)
    const safeName = body.projectName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || 'Proyecto'
    const storagePath = `${id}/v${nextVersion}_${safeName}_${Date.now()}.pdf`
    const { error: stErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false })

    if (stErr) {
      console.error('[planning-pdf] storage upload error:', stErr)
      // No bloqueamos la descarga: devolvemos el PDF aunque no quede archivado.
    } else {
      // 5) Insertar fila en BD (solo si Storage tuvo éxito)
      const { error: dbErr } = await admin
        .from('fpe_planning_documents')
        .insert({
          fpe_project_id: id,
          version: nextVersion,
          emitted_by: user.id,
          scope_snapshot: aiPayload,
          narrative_snapshot: narrative,
          pdf_storage_path: storagePath,
          used_ai: usedAi,
          ai_model: usedAi ? MODEL : null,
        })
      if (dbErr) {
        console.error('[planning-pdf] insert error:', dbErr)
        await admin.storage.from(BUCKET).remove([storagePath])
      }
    }

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="Planning-v${nextVersion}-${safeName}.pdf"`,
        'Cache-Control':       'private, no-cache',
        'X-Planning-Version':  String(nextVersion),
        'X-Planning-Used-AI':  String(usedAi),
      },
    })
  } catch (err) {
    console.error('[fpe-projects/planning-pdf]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando planning' },
      { status: 500 }
    )
  }
}
