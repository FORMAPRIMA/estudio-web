// Correo «tu visita guiada empieza en 30 minutos» con el enlace de la visita.
// Solo servidor. Lo lanza el cron /api/cron/recorrido-aviso cada 5 minutos la
// tarde del evento; rc_correos garantiza un único envío por invitado.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { leerTodo } from '@/lib/open-house/datos'
import { slotPorId } from '@/lib/open-house/evento'
import { horaEvento } from './domain'

const TIPO = 'aviso-30'
/** Se envía cuando faltan como mucho 32 min (el cron pasa cada 5) y nunca con la visita ya empezada. */
const VENTANA_MIN = 32
const BASE = 'https://formaprima.es'

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const primero = (n: string) => n.trim().split(/\s+/)[0] ?? ''

export function enlaceVisita(token: string) { return `${BASE}/cc38/${token}/visita` }

export function correoAviso(nombre: string, token: string, hora: string, fin: string): { asunto: string; html: string } {
  const url = enlaceVisita(token)
  const asunto = `Tu visita guiada empieza a las ${hora} · Claudio Coello 38`
  const serif = `font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;`
  const sans = `font-family:'Hanken Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;`
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(asunto)}</title>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500&family=Cormorant+Garamond:ital,wght@1,400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f5f1ec;${sans}color:#161616;">
<div style="display:none;max-height:0;overflow:hidden;">Tu enlace de visita guiada: ábrelo al llegar y te acompañará por la casa.</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f1ec;padding:28px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background:#f7f5f2;">
  <tr><td style="padding:0;">
    <img src="${BASE}/open-house/cc38/assets/cc38-3919-correo.jpg" alt="Claudio Coello 38" width="560" style="display:block;width:100%;height:auto;border:0;">
  </td></tr>
  <tr><td style="padding:40px 40px 8px;">
    <p style="margin:0 0 18px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7a746e;">Open House · Claudio Coello 38</p>
    <p style="margin:0 0 6px;${serif}font-size:40px;line-height:1.05;color:#161616;">${esc(primero(nombre))}, tu visita<br>empieza a las ${esc(hora)}</p>
    <p style="margin:22px 0 0;font-size:15px;line-height:1.65;font-weight:300;color:#5f5953;">
      Este es tu <strong style="font-weight:500;color:#161616;">enlace de visita guiada</strong>. Ábrelo al llegar: mientras recorres la casa con nuestro equipo, cada detalle que te contemos aparecerá en tu móvil, y podrás volver a él cuando quieras.
    </p>
  </td></tr>
  <tr><td style="padding:30px 40px 10px;">
    <table cellpadding="0" cellspacing="0" role="presentation"><tr>
      <td style="background:#8c6a55;border-radius:999px;">
        <a href="${url}" style="display:inline-block;padding:16px 30px;${sans}font-size:14px;letter-spacing:.06em;color:#ffffff;text-decoration:none;">Abrir mi visita guiada →</a>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:26px 40px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #e9e5e0;">
      <tr>
        <td style="padding:18px 0 0;font-size:13px;line-height:1.6;color:#5f5953;">
          <span style="font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:#a39d96;">Cuándo</span><br>
          Hoy, jueves 8 de octubre · ${esc(hora)}–${esc(fin)}
        </td>
        <td style="padding:18px 0 0;font-size:13px;line-height:1.6;color:#5f5953;">
          <span style="font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:#a39d96;">Dónde</span><br>
          Claudio Coello 38, 2º dcha.
        </td>
      </tr>
    </table>
    <p style="margin:22px 0 0;font-size:12.5px;line-height:1.6;color:#a39d96;">Al llegar, indica tu nombre en portería. Si el botón no funciona, copia este enlace:<br><a href="${url}" style="color:#8c6a55;word-break:break-all;">${url}</a></p>
  </td></tr>
  <tr><td style="padding:22px 40px 30px;background:#161616;">
    <img src="${BASE}/open-house/cc38/assets/isotipo-light.png" alt="Forma Prima" height="22" style="display:block;height:22px;width:auto;border:0;margin:0 0 10px;">
    <p style="margin:0;font-size:11px;line-height:1.6;color:#7a746e;">Forma Prima · <a href="mailto:contacto@formaprima.es" style="color:#c9a68c;text-decoration:none;">contacto@formaprima.es</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
  return { asunto, html }
}

export interface ResultadoAviso { enviados: string[]; pendientes: string[]; errores: string[] }

/** Envía el aviso a quien tenga la visita dentro de los próximos 32 min. Con `simular`, solo lista. */
export async function enviarAvisos(ahora = Date.now(), simular = false): Promise<ResultadoAviso> {
  const admin = createAdminClient()
  const todo = await leerTodo()
  const { data: ya } = await admin.from('rc_correos').select('token').eq('tipo', TIPO)
  const enviadosAntes = new Set((ya ?? []).map((x: { token: string }) => x.token))
  const out: ResultadoAviso = { enviados: [], pendientes: [], errores: [] }

  for (const g of todo.groups) {
    if (!g.booking) continue
    const s = slotPorId(g.booking.slot)
    if (!s) continue
    const falta = (horaEvento(s.t) - ahora) / 60000
    for (const m of g.members) {
      if (!g.booking.att.includes(m.id) || !/@/.test(m.email) || enviadosAntes.has(m.token)) continue
      const etiqueta = `${s.t} · ${m.name} <${m.email}>`
      if (falta > VENTANA_MIN || falta <= 0) { out.pendientes.push(etiqueta); continue }
      if (simular) { out.enviados.push(`(simulado) ${etiqueta}`); continue }
      // Reservar el envío primero: si otra ejecución ya lo hizo, la PK lo impide.
      const { error: e1 } = await admin.from('rc_correos').insert({ token: m.token, tipo: TIPO })
      if (e1) continue
      const { asunto, html } = correoAviso(m.name, m.token, s.t, s.end)
      const r = await sendEmail({ to: m.email, subject: asunto, html })
      if (r.error) {
        out.errores.push(`${etiqueta}: ${r.error}`)
        await admin.from('rc_correos').update({ error: r.error }).eq('token', m.token).eq('tipo', TIPO)
      } else out.enviados.push(etiqueta)
    }
  }
  return out
}

