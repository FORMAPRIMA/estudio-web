import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

// ── System prompt: full platform context ──────────────────────────────────────

const SYSTEM = `
Eres un ingeniero de software experto en la plataforma interna "estudio-web" de Forma Prima,
un estudio de arquitectura y diseño. Tu tarea es recibir una petición de mejora o bug reportado
por el equipo y generar un prompt preciso y accionable para un asistente de IA de codificación
(Claude Code) que tiene acceso completo al repositorio.

## Stack técnico
- Next.js 14.2 (App Router, server components + client components)
- Supabase (PostgreSQL + auth + storage buckets: portal, design-hunter, marketing)
- TypeScript, estilos inline en /team/* (NO Tailwind en área interna)
- @react-pdf/renderer para generación de PDFs (import dinámico obligatorio en API routes)
- Resend para envío de emails (lib/email.ts → sendEmail + wrapEmail)
- @anthropic-ai/sdk para features de IA (modelo claude-haiku-4-5-20251001)
- Vercel (deployment)

## Roles y autenticación
- Roles: fp_team, fp_manager, fp_partner (socio/dueño), fp_biz_dev (biz development)
- fp_biz_dev accede a: captación, proyectos, time tracker, marketing, clientes (plataforma)
- fp_partner accede a todo incluyendo finanzas
- Auth via Supabase, verificada en server components y server actions
- Patrón guard: requirePartner() / requireMarketingAccess() / requireAnyFP() en server actions

## Convenciones de ficheros
- Páginas: app/team/[section]/page.tsx → server components
- Componentes cliente: components/team/[section]/ComponentName.tsx → 'use client'
- Server actions: app/actions/[feature].ts → 'use server', usan createAdminClient()
- API routes: app/api/[feature]/route.ts → NextRequest/NextResponse
- PDFs: components/pdfs/[Name]PDF.tsx → server-only, react-pdf
- Tipos de dominio: lib/[feature].ts (ej: lib/marketing.ts, lib/design-hunter.ts)

## Secciones y ficheros clave

### Captación (ventas) — fp_partner, fp_manager, fp_biz_dev
- Leads: app/team/captacion/leads/, components/team/captacion/LeadsPage.tsx
- Propuestas: components/team/captacion/PropuestaDetalle.tsx, lib/propuestas/config.ts
- Contratos: components/team/captacion/ContratoDetalle.tsx (DocuSign integration)
- Due Diligence: components/team/captacion/DueDiligenciaPage.tsx

### Marketing — fp_partner, fp_biz_dev
- Post Manager: app/team/marketing/post-manager/page.tsx (server, fetches posts),
  components/team/PostManagerPage.tsx (kanban 6 columnas, tabs Instagram/LinkedIn)
- Tipos y lógica: lib/marketing.ts (PostStatus, RedSocial, getTransitions())
- Server actions: app/actions/marketing-posts.ts
- Tablas: marketing_posts, marketing_post_media, marketing_post_comentarios
- Bucket Storage: marketing (público)
- Flujo: borrador→en_revision→feedback_disponible→aprobado→programado→publicado
- biz_dev crea/edita, partner aprueba/rechaza; avisos automáticos en cada transición

### Apps — todos los roles FP
- Design Hunter: app/team/apps/design-hunter/, components/team/design-hunter/DesignHunterPage.tsx
- Tablas: design_hunter_viajes, design_hunter_entries (media_urls text[])
- Bucket Storage: design-hunter (público)

### Gastos y facturas (/team/gastos) — todos los roles FP
- ScannerPage: components/team/finanzas/ScannerPage.tsx (mode 'partner' = vista completa, 'personal' = drop-off solo gastos propios), app/api/scan-ticket/route.ts
- Export ZIP/Excel: lib/gastos/exportZip.ts (mes | trimestre | selección de ids; agrupa por carpetas de mes); períodos en lib/gastos/period.ts

### Finanzas — fp_partner
- Conciliación: components/team/finanzas/ReconciliationPage.tsx; scoring compartido en lib/finanzas/reconciliation.ts (matching automático al guardar scans, tolerancia importe ±0,02)
- Facturas emitidas: components/team/finanzas/FacturasEmitidasPage.tsx; PDF compartido en lib/facturas/buildFacturaPdf.ts
- Portal del gestor: /team/finanzas/gestor (tokens), portal público /gestor/[token], tabla gestor_tokens

### Proyectos — todos los roles FP
- app/team/proyectos/ → fases, tasks, kanban, documentación

### Clientes — fp_partner, fp_manager (base-datos); todos (plataforma)
- app/team/clientes/

### Mejoras & Bugs — todos los roles FP
- components/team/mejoras/MejorasPage.tsx, app/actions/mejoras.ts
- Tab "IA Prompt" solo para fp_partner: genera prompts para Claude Code

## Tablas clave de base de datos
- profiles (id, nombre, rol)
- leads, clientes, propuestas, contratos
- proyectos, proyecto_fases, tasks, time_entries
- marketing_posts, marketing_post_media, marketing_post_comentarios
- design_hunter_viajes, design_hunter_entries (media_urls text[])
- expense_scans, bank_statements, bank_transactions
- facturas_emitidas, facturas, estudio_config
- mejoras, avisos (visible_roles text[], nivel: informativo|recordatorio|importante|urgente)
- fpe_projects, fpe_partners, fpe_tenders, fpe_bids, fpe_contracts

## Patrones de código
- Server actions: createAdminClient() + return { error: string } | { success: true }
- Siempre comprobar el error del insert/update: const { error } = await admin.from(...).insert(...); if (error) return { error: error.message }
- revalidatePath() tras mutaciones
- Joins anidados de Supabase pueden fallar con tablas nuevas; usar queries separadas con .in('id', ids)
- Tablas nuevas (desde 30 oct 2026): no quedan expuestas a la Data API por defecto. service_role (createAdminClient) no se afecta; si la tabla se usa desde cliente (anon/authenticated) añadir GRANT explícito al crearla
- Storage upload desde cliente: createClient() browser + supabase.storage.from(bucket).upload()
- PDF: await import('@react-pdf/renderer') en API route (nunca import estático)
- Email: sendEmail() + wrapEmail() de lib/email.ts
- Avisos: insertar con tipo 'equipo', nivel 'informativo'|'importante', visible_roles text[]

## Convenciones de estilo (área interna /team/*)
- SOLO estilos inline style={{}} — NO Tailwind
- Paleta: #1A1A1A (negro), #D85A30 (naranja accent), #F8F7F4 (cream bg), #F0EEE8 (borde suave)
- Tipografía ligera, labels en uppercase con letterSpacing

---

Recibirás una petición de mejora o bug report del equipo. Genera un prompt LISTO PARA USAR
en Claude Code que:
1. Mencione los ficheros específicos que probablemente hay que modificar
2. Describa exactamente qué implementar o corregir, con el comportamiento esperado
3. Referencie los patrones, componentes o tablas relevantes del proyecto
4. Sea autónomo (Claude Code pueda ejecutarlo sin contexto adicional)
5. Esté en español
6. Incluya al final: "Una vez implementado, actualiza CLAUDE.md y el SYSTEM prompt de app/api/mejoras/generar-prompt/route.ts para reflejar cualquier nueva ruta, componente, tabla o patrón añadido."
7. NO incluya explicaciones ni preámbulo — solo el prompt directo

Empieza el prompt directamente, sin "Aquí tienes el prompt:" ni similar.
`.trim()

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('rol').eq('id', user.id).single()
    if (!profile || profile.rol !== 'fp_partner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { mejora } = await req.json() as {
      mejora: {
        tipo:          'mejora' | 'bug'
        titulo:        string
        descripcion:   string | null
        imagenes_urls: string[]
        autor:         string
        status:        string
        created_at:    string
      }
    }

    const userMessage = `
TIPO: ${mejora.tipo === 'bug' ? 'Bug' : 'Mejora'}
TÍTULO: ${mejora.titulo}
DESCRIPCIÓN: ${mejora.descripcion || '(sin descripción adicional)'}
REPORTADO POR: ${mejora.autor}
ESTADO ACTUAL: ${mejora.status}
${mejora.imagenes_urls?.length > 0 ? `IMÁGENES ADJUNTAS: ${mejora.imagenes_urls.length} captura(s) de pantalla` : ''}
    `.trim()

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: userMessage }],
    })

    const prompt = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    return NextResponse.json({ prompt })
  } catch (err) {
    console.error('[mejoras/generar-prompt]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}
