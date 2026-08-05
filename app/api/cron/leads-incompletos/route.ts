import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { avisarParcialIncompleto } from '@/app/actions/contacto'
import type { ContactoParcial } from '@/lib/contacto'

// Vercel Cron — cada 15 min (vercel.json).
//
// Dos trabajos sobre la captura progresiva del formulario de contacto:
//   1. AVISAR: contactos con datos útiles que llevan >30 min parados sin enviar.
//      Es el lead recuperable con una llamada. Un aviso por contacto (flag
//      `avisado`), a Ana (biz dev) + contacto@, más un aviso interno en la plataforma.
//   2. PURGAR: borrar los parciales sin completar de más de 30 días. Es el
//      compromiso de retención que sostiene la base jurídica del autoguardado
//      (RGPD, medidas precontractuales); no es una limpieza opcional.

const MINUTOS_ESPERA = 30
const DIAS_RETENCION = 30

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const ahora = Date.now()
  const corte = new Date(ahora - MINUTOS_ESPERA * 60 * 1000).toISOString()
  const purga = new Date(ahora - DIAS_RETENCION * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Avisos ─────────────────────────────────────────────────────────────
  const { data: pendientes, error } = await admin
    .from('web_contacto_parcial')
    .select('*')
    .eq('completado', false)
    .eq('avisado', false)
    .lt('updated_at', corte)
    .limit(50)

  if (error) {
    // Migración web_contacto_parcial.sql sin aplicar: no es un fallo del cron.
    return NextResponse.json({ ok: true, nota: 'tabla no disponible', detalle: error.message })
  }

  let avisados = 0
  for (const fila of (pendientes ?? []) as ContactoParcial[]) {
    try {
      await avisarParcialIncompleto(fila)
      await admin.from('web_contacto_parcial').update({ avisado: true }).eq('id', fila.id)

      await admin.from('avisos').insert({
        titulo: `Contacto web a medias — ${fila.nombre ?? fila.email ?? 'sin nombre'}`,
        mensaje: `Alguien empezó el formulario de la web y no lo terminó. ${fila.email ?? fila.telefono ?? ''}`.trim()
          + ' · Sin correo enviado ni Espacio creado: si interesa, hay que contactar a mano desde Captación → Leads.',
        nivel: 'importante',
        visible_roles: ['fp_biz_dev', 'fp_partner'],
      })
      avisados++
    } catch (err) {
      console.error('[cron leads-incompletos] aviso:', err)
    }
  }

  // ── 2. Purga ──────────────────────────────────────────────────────────────
  const { data: borrados } = await admin
    .from('web_contacto_parcial')
    .delete()
    .eq('completado', false)
    .lt('created_at', purga)
    .select('id')

  return NextResponse.json({
    ok: true,
    revisados: pendientes?.length ?? 0,
    avisados,
    purgados: borrados?.length ?? 0,
  })
}
