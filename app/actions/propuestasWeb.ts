'use server'

// Propuestas de honorarios publicadas como página (/propuesta/<slug>).
// El cliente no tiene cuenta: su llave es el PIN, que deja una cookie firmada.
// Cada paso relevante (abrirla, llegar al final, aceptarla) avisa al equipo.

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, wrapEmail } from '@/lib/email'
import { TEAM_EMAIL, getPartnersCC } from '@/lib/email/destinatarios'
import { getPropuestaWeb, type PropuestaWeb } from '@/lib/propuestas/registro'
import { propuestaCookieName, propuestaCookieValue, pinCorrecto } from '@/lib/propuestas/acceso'

const FP_ROLES = ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev']
const URL_BASE = 'https://formaprima.es/propuesta'

function autorizada(slug: string): PropuestaWeb | null {
  const p = getPropuestaWeb(slug)
  if (!p) return null
  const ok = cookies().get(propuestaCookieName(slug))?.value === propuestaCookieValue(slug)
  return ok ? p : null
}

/** ¿La está mirando alguien del estudio con sesión? Entonces no es el cliente. */
async function esEquipo(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
    return !!data?.rol && FP_ROLES.includes(data.rol as string)
  } catch {
    return false
  }
}

async function crearAviso(titulo: string, contenido: string, nivel: 'informativo' | 'importante') {
  try {
    const { error } = await createAdminClient().from('avisos').insert({
      tipo: 'equipo',
      autor_id: null,
      titulo,
      contenido,
      nivel,
      fecha_activa: new Date().toISOString().slice(0, 10),
      visible_roles: ['fp_partner'],
    })
    if (error) console.error('[propuesta-web] crearAviso', error.message)
  } catch (e) {
    console.error('[propuesta-web] crearAviso', e)
  }
}

export async function desbloquearPropuestaWeb(slug: string, pin: string): Promise<{ ok: boolean }> {
  const p = getPropuestaWeb(slug)
  if (!p || !pinCorrecto(pin.trim(), p.pin)) {
    // Un PIN de 4 cifras se prueba entero en poco tiempo si se responde al instante.
    await new Promise((r) => setTimeout(r, 900))
    return { ok: false }
  }
  cookies().set(propuestaCookieName(slug), propuestaCookieValue(slug), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/propuesta/${slug}`,
    maxAge: 60 * 60 * 24 * 90,
  })
  return { ok: true }
}

type Evento = 'abierta' | 'final'

/** Avisa al equipo de que el cliente abrió la propuesta o llegó al final. Una vez cada 12 h. */
export async function registrarEventoPropuestaWeb(slug: string, evento: Evento): Promise<void> {
  const p = autorizada(slug)
  if (!p || (evento !== 'abierta' && evento !== 'final')) return
  if (await esEquipo()) return

  const marca = `${propuestaCookieName(slug)}_${evento}`
  if (cookies().get(marca)) return
  cookies().set(marca, '1', { httpOnly: true, sameSite: 'lax', path: `/propuesta/${slug}`, maxAge: 60 * 60 * 12 })

  if (evento === 'abierta') {
    await crearAviso(
      `${p.cliente} ha abierto su propuesta`,
      `Propuesta de honorarios de ${p.proyecto}. ${URL_BASE}/${p.slug}`,
      'informativo',
    )
  } else {
    await crearAviso(
      `${p.cliente} ha visto la propuesta hasta el final`,
      `Propuesta de honorarios de ${p.proyecto}. Buen momento para llamarle.`,
      'informativo',
    )
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** El cliente acepta la propuesta desde la última diapositiva. */
export async function aceptarPropuestaWeb(slug: string, comentario: string): Promise<{ ok: boolean; error?: string }> {
  const p = autorizada(slug)
  if (!p) return { ok: false, error: 'La sesión ha caducado. Vuelve a abrir el enlace.' }

  const prueba = await esEquipo()
  const nota = comentario.trim().slice(0, 2000)
  const cuando = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })

  await crearAviso(
    `${prueba ? '[Prueba] ' : ''}${p.cliente} ha ACEPTADO la propuesta de ${p.proyecto}`,
    nota ? `Comentario: «${nota}»` : 'Sin comentarios. Toca preparar la firma y el primer pago.',
    'importante',
  )

  const cc = await getPartnersCC().catch(() => [] as string[])
  const r = await sendEmail({
    to: TEAM_EMAIL,
    cc: cc.filter((e) => e !== TEAM_EMAIL),
    subject: `${prueba ? '[Prueba] ' : ''}✓ ${p.cliente} acepta la propuesta de ${p.proyecto}`,
    html: wrapEmail(`
      <p style="margin:0 0 16px;font-size:16px;"><strong>${esc(p.cliente)}</strong> ha aceptado la propuesta de honorarios de <strong>${esc(p.proyecto)}</strong>.</p>
      <p style="margin:0 0 16px;color:#555;">${esc(cuando)}${prueba ? ' · aceptación hecha con una sesión del equipo (prueba)' : ''}</p>
      ${nota ? `<p style="margin:0 0 16px;padding:12px 16px;background:#F2F2F0;border-left:2px solid #8fa596;">${esc(nota)}</p>` : ''}
      <p style="margin:0 0 8px;">Siguiente paso: enviar la propuesta a firma y el cobro del 50% del anteproyecto.</p>
      <p style="margin:0;"><a href="${URL_BASE}/${p.slug}">${URL_BASE}/${p.slug}</a></p>
    `),
  })
  if (r.error) console.error('[propuesta-web] email aceptación', r.error)

  return { ok: true }
}
