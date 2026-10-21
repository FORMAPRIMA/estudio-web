import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'
import { datosSala, type Miembro, salasDe } from '@/lib/salas/panel'
import { NOMBRE_TEMPERATURA, duracion, resumenLeads } from '@/lib/salas/metricas'

// Vercel Cron — cada día a las 07:00 UTC (vercel.json).
// Resumen de Salas de las últimas 24 h para cada persona del panel con email:
// qué leads han entrado (con su temperatura), cuántas visitas anónimas y qué
// leads nuevos se han dado de alta. Si no ha pasado nada, no se envía.

export const dynamic = 'force-dynamic'
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  const secret = auth?.startsWith('Bearer ') ? auth.slice(7) : req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: miembros } = await admin.from('sala_miembros').select('id, nombre, email, empresa, rol').eq('activo', true).not('email', 'is', null)
  const desde = Date.now() - 24 * 3600_000
  const cache = new Map<string, Awaited<ReturnType<typeof datosSala>>>()
  let enviados = 0

  for (const m of (miembros ?? []) as Miembro[]) {
    const bloques: string[] = []
    for (const s of await salasDe(m)) {
      if (!cache.has(s.id)) cache.set(s.id, await datosSala(s.id))
      const d = cache.get(s.id)!
      const recientes = d.sesiones.filter((x) => Date.parse(x.inicio) > desde && x.totalSlides > 0)
      const nuevos = d.leads.filter((l) => Date.parse(l.createdAt) > desde)
      // Prospección: enviados hace más de 5 días que no se han abierto (un recordatorio
      // para quien los creó; los propietarios lo ven en todas).
      const conAlguna = new Set(d.sesiones.map((x) => x.leadId).filter(Boolean))
      const sinAbrir = s.tipo !== 'prospeccion' ? [] : d.leads.filter((l) =>
        l.estado === 'activo' && !l.descartadoEn && l.enviadoEn && Date.now() - Date.parse(l.enviadoEn) > 5 * 864e5 &&
        !conAlguna.has(l.id) && (m.rol === 'propietario' || l.creadoPor === m.id))
      const seguimiento = sinAbrir.length ? `
        <p style="margin:10px 0 4px;color:#B03A2E;font-size:13px;">Sin abrir tras 5 días: buen momento para un seguimiento.</p>
        <p style="margin:0;font-size:13px;">${sinAbrir.map((l) => `<a href="https://salas.formaprima.es/${s.slug}/lead/${l.id}" style="color:#1A1A1A;">${esc(l.empresa || l.nombre)}</a>`).join(' · ')}</p>` : ''
      if (!recientes.length && !nuevos.length && !seguimiento) continue
      const conVisita = new Set(recientes.map((x) => x.leadId).filter(Boolean))
      const leads = resumenLeads(d).filter((r) => conVisita.has(r.lead.id)).sort((a, b) => b.temperatura.puntos - a.temperatura.puntos)
      const anon = recientes.filter((x) => !x.leadId).length
      const filas = leads.map((r) => `
        <tr style="border-top:1px solid #E8E6E0;">
          <td style="padding:7px 10px 7px 0;"><a href="https://salas.formaprima.es/${s.slug}/lead/${r.lead.id}" style="color:#1A1A1A;">${esc(r.lead.nombre)}</a>${r.reenvio.probable ? ' <span style="color:#D85A30;">· PIN compartido</span>' : ''}</td>
          <td style="padding:7px 10px;">${NOMBRE_TEMPERATURA[r.temperatura.nivel]}</td>
          <td style="padding:7px 10px;">${r.visitas} visitas · ${duracion(r.activoMs)}</td>
          <td style="padding:7px 0 7px 10px;color:#888;">${esc(r.lugares.slice(0, 2).join(' · '))}</td>
        </tr>`).join('')
      bloques.push(`
        <h3 style="margin:22px 0 6px;font-size:15px;">${esc(s.nombre)}</h3>
        <p style="margin:0 0 8px;color:#555;font-size:13px;">${leads.length} ${leads.length === 1 ? 'lead ha entrado' : 'leads han entrado'} · ${anon} ${anon === 1 ? 'visita anónima' : 'visitas anónimas'}${nuevos.length ? ` · ${nuevos.length} ${nuevos.length === 1 ? 'lead nuevo' : 'leads nuevos'}` : ''}</p>
        ${filas ? `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;">${filas}</table>` : ''}${seguimiento}`)
    }
    if (!bloques.length || !m.email) continue
    const r = await sendEmail({
      to: m.email,
      subject: 'Salas · resumen de las últimas 24 h',
      html: wrapEmail(`
        <p style="margin:0 0 4px;font-size:16px;">Hola, ${esc(m.nombre.split(' ')[0])}.</p>
        <p style="margin:0;color:#555;">Esto es lo que ha pasado en tus dossiers en las últimas 24 horas.</p>
        ${bloques.join('')}
        <p style="margin:24px 0 0;"><a href="https://salas.formaprima.es">Abrir Salas</a></p>
      `),
    })
    if (r.error) console.error('[salas] resumen', m.email, r.error)
    else enviados++
  }
  return NextResponse.json({ ok: true, enviados })
}
