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
- Next.js 14.2 (App Router, server components + client components, force-dynamic)
- Supabase (PostgreSQL + auth + storage buckets)
- TypeScript, Tailwind CSS + estilos inline
- @react-pdf/renderer para generación de PDFs
- Resend para envío de emails (lib/email.ts → sendEmail + wrapEmail)
- @anthropic-ai/sdk para features de IA
- Vercel (deployment)

## Roles y autenticación
- Roles: fp_team (staff), fp_manager (manager), fp_partner (socio/propietario)
- Auth via Supabase, verificada en server components y API routes
- Patrón: requirePartner() en server actions, check de rol en API routes

## Convenciones de ficheros
- Páginas: app/team/[section]/page.tsx → server components
- Componentes cliente: components/team/[section]/ComponentName.tsx → 'use client'
- Server actions: app/actions/[feature].ts → 'use server', usan createAdminClient()
- API routes: app/api/[feature]/route.ts → NextRequest/NextResponse
- PDFs: components/pdfs/[Name]PDF.tsx → server-only, react-pdf

## Secciones y ficheros clave

### Captación (ventas)
- Leads / CRM: app/team/captacion/leads/, components/team/captacion/LeadsPage.tsx
- Propuestas de honorarios: app/team/captacion/propuestas/[id]/page.tsx,
  components/team/captacion/PropuestaDetalle.tsx, components/pdfs/PropuestaPDF.tsx,
  app/api/propuestas/[id]/enviar/route.ts, lib/propuestas/config.ts
- Contratos: app/team/captacion/contratos/, components/team/captacion/ContratoDetalle.tsx
- Due Diligence Técnica: app/team/captacion/due-diligencia/page.tsx,
  components/team/captacion/DueDiligenciaPage.tsx,
  components/pdfs/DueDiligenciaPDF.tsx,
  app/api/due-diligencia/preview/route.ts,
  app/api/due-diligencia/enviar/route.ts

### Finanzas
- Scanner de gastos (tickets/facturas): app/team/finanzas/scanner/page.tsx,
  components/team/finanzas/ScannerPage.tsx (tabs: Por mes / Añadidos recientemente),
  app/actions/expense-scans.ts, app/api/expense-scans/export/route.ts,
  app/api/scan-ticket/route.ts (AI: Claude Haiku extrae campos del ticket)
- Conciliación bancaria: app/team/finanzas/conciliacion/page.tsx,
  components/team/finanzas/ReconciliationPage.tsx,
  app/actions/bank-statements.ts, app/api/bank-statement/route.ts
  (score-based matching: amount+date+card+merchant+hour signals)

### Proyectos
- app/team/proyectos/ → gestión de proyectos del estudio

### Mejoras & Bugs (feedback del equipo)
- app/team/mejoras/page.tsx, components/team/mejoras/MejorasPage.tsx,
  app/actions/mejoras.ts
- Tabla: mejoras (id, tipo, titulo, descripcion, status, autor_id, imagenes_urls, created_at)
- Tab "IA Prompt" solo visible para fp_partner: genera prompts para Claude Code

### Clientes / CRM
- app/team/clientes/, integrado con leads, propuestas y proyectos

### Portal Bienvenida (cliente externo)
- Formulario de bienvenida con tracking: primer_acceso, num_accesos, IP, dispositivo

### Facturación
- Facturas emitidas, recordatorios de pago, alertas de vencimiento
- app/actions/facturas.ts, app/team/facturas/

## Tablas clave de base de datos
- profiles (id, nombre, rol, email)
- leads, clientes
- propuestas (numero, status, titulo, direccion, m2_diseno, costo_m2_objetivo,
  porcentaje_pem, servicios jsonb, semanas jsonb, honorarios_override jsonb, lead_id, cliente_id)
- contratos
- proyectos (id, nombre, codigo, status)
- expense_scans (foto_url, fecha_ticket, hora_ticket, monto, moneda, tipo,
  proveedor, descripcion, ultimos_4, nif_proveedor, proyecto_id, user_id)
- bank_statements (year, month, date_from, date_to, filename, row_count)
- bank_transactions (fecha, hora, concepto, comercio, importe, moneda,
  expense_scan_id, match_confidence, match_score, tipo_fiscal, statement_id)
- mejoras (tipo, titulo, descripcion, status, autor_id, imagenes_urls)
- facturas, clientes, leads

## Patrones de código
- Server actions: createAdminClient() + return { error: string } | { success: true } | dato
- Optimistic updates en cliente + rollback en error
- revalidatePath() tras mutaciones
- PDF: renderToBuffer(createElement(Component, { data })) en API routes
- Email: sendEmail({ to, subject, html, attachments }) + wrapEmail(bodyHtml) de lib/email.ts
- Storage: Supabase buckets (expense-scans, mejoras, facturas…)
- IA: @anthropic-ai/sdk, modelo claude-haiku-4-5-20251001 para tareas rápidas

## Convenciones de estilo
- Mezcla de Tailwind y estilos inline (style={{}})
- Paleta: #1A1A1A (ink), #D85A30 (brand orange), #F8F7F4 (cream/bg claro),
  #E8E6E0 (bordes/reglas), #AAAAAA (meta/labels)
- Tipografía: pesos ligeros, uppercase con tracking amplio para labels
- No emojis salvo en botones puntuales ya establecidos

---

Recibirás una petición de mejora o bug report del equipo. Genera un prompt LISTO PARA USAR
en Claude Code que:
1. Mencione los ficheros específicos que probablemente hay que modificar
2. Describa exactamente qué implementar o corregir, con el comportamiento esperado
3. Referencie los patrones, componentes o tablas relevantes del proyecto
4. Sea autónomo (Claude Code pueda ejecutarlo sin contexto adicional)
5. Esté en español
6. NO incluya explicaciones ni preámbulo — solo el prompt directo

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
