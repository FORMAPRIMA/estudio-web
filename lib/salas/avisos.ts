// Salas — avisos por correo cuando un lead hace algo que merece una llamada.
// Solo servidor. Los dispara la baliza (app/api/salas/t) y nunca bloquean la
// medición: cualquier fallo se registra y se sigue.
//
// Qué avisa (a quien creó el lead, con copia a las personas con rol de
// propiedad que tengan email), y cuántas veces:
//   · abierto  — primera vez que abre el dossier con su PIN ........ una vez
//   · vuelto   — vuelve tras 3 días o más sin entrar ............... cada vuelta (máx. 1 cada 12 h)
//   · final    — llega a la última diapositiva ..................... una vez
//   · interes  — pulsa «Me interesa» ............................... una vez
//   · reenvio  — su PIN se usa desde sitios/equipos distintos ...... una vez
// Cada aviso enviado queda como evento `aviso_<tipo>` de la sesión: así no se
// repite y se sabe cuándo se avisó.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, wrapEmail } from '@/lib/email'
import { repartirDestinatarios } from '@/lib/email/destinatarios'
import { reenvio, temperatura, NOMBRE_TEMPERATURA } from './metricas'
import { salasDe, type Miembro } from './panel'

export type TipoAviso = 'abierto' | 'vuelto' | 'final' | 'interes' | 'reenvio'
const UNA_VEZ: TipoAviso[] = ['abierto', 'final', 'interes', 'reenvio']
const VUELTA_DIAS = 3

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

interface Contexto {
  salaId: string
  salaSlug: string
  salaNombre: string
  leadId: string
  sesionId: string
}

/** Comprueba qué avisos tocan tras abrir una sesión nueva de un lead. */
export async function avisosAlAbrir(c: Contexto): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: ses } = await admin.from('sala_sesiones')
      .select('id, inicio, ultima, ciudad, pais, dispositivo, ip_trunc')
      .eq('lead_id', c.leadId).order('inicio', { ascending: false }).limit(200)
    const todas = ses ?? []
    const previas = todas.filter((s) => s.id !== c.sesionId)
    if (!previas.length) await avisar(c, 'abierto')
    else {
      const ultimaPrevia = Math.max(...previas.map((s) => Date.parse(s.ultima)))
      if (Date.now() - ultimaPrevia > VUELTA_DIAS * 864e5) await avisar(c, 'vuelto', `Llevaba ${Math.round((Date.now() - ultimaPrevia) / 864e5)} días sin entrar.`)
    }
    const r = reenvio(todas.map((s) => ({ ciudad: s.ciudad, pais: s.pais, dispositivo: s.dispositivo, ipTrunc: s.ip_trunc, inicio: s.inicio })))
    if (r.probable) await avisar(c, 'reenvio', r.motivo ?? undefined)
  } catch (e) {
    console.error('[salas] avisosAlAbrir', e)
  }
}

export async function avisoDe(c: Contexto, tipo: 'final' | 'interes'): Promise<void> {
  try { await avisar(c, tipo) } catch (e) { console.error('[salas] aviso', tipo, e) }
}

async function yaAvisado(leadId: string, tipo: TipoAviso): Promise<boolean> {
  const admin = createAdminClient()
  const { data: ses } = await admin.from('sala_sesiones').select('id').eq('lead_id', leadId).limit(500)
  const ids = (ses ?? []).map((s) => s.id)
  if (!ids.length) return false
  let q = admin.from('sala_eventos').select('id', { count: 'exact', head: true }).in('sesion_id', ids).eq('tipo', `aviso_${tipo}`)
  if (!UNA_VEZ.includes(tipo)) q = q.gte('at', new Date(Date.now() - 12 * 3600_000).toISOString())
  const { count } = await q
  return (count ?? 0) > 0
}

async function avisar(c: Contexto, tipo: TipoAviso, extra?: string): Promise<void> {
  if (await yaAvisado(c.leadId, tipo)) return
  const admin = createAdminClient()
  // Se marca antes de enviar: dos balizas casi simultáneas no mandan dos correos.
  await admin.from('sala_eventos').insert({ sesion_id: c.sesionId, tipo: `aviso_${tipo}` })

  const [{ data: lead }, { data: sesion }, { data: propietarios }, { data: todas }] = await Promise.all([
    admin.from('sala_leads').select('nombre, empresa, telefono, email, creado_por, lead_captacion_id').eq('id', c.leadId).single(),
    admin.from('sala_sesiones').select('ciudad, pais, dispositivo').eq('id', c.sesionId).single(),
    admin.from('sala_miembros').select('email').eq('rol', 'propietario').eq('activo', true),
    admin.from('sala_sesiones').select('inicio, ultima, activo_ms, max_slide, total_slides, final').eq('lead_id', c.leadId),
  ])
  if (!lead) return
  const { data: creador } = lead.creado_por
    ? await admin.from('sala_miembros').select('id, nombre, email, empresa, rol, activo').eq('id', lead.creado_por).maybeSingle()
    : { data: null }
  // El aviso solo llega a quien creó el lead si todavía puede ver la sala (una
  // sala que pasa a confidencial deja de avisar a los comerciales).
  const creadorVe = !!creador?.activo && (creador.rol === 'propietario' || (await salasDe(creador as Miembro)).some((s) => s.id === c.salaId))
  const dest = repartirDestinatarios({
    to: [creadorVe ? creador!.email : null],
    cc: (propietarios ?? []).map((p) => p.email),
  })
  if (!dest.to.length && dest.cc.length) { dest.to = [dest.cc[0]]; dest.cc = dest.cc.slice(1) }
  if (!dest.to.length) return

  const ss = todas ?? []
  const t = temperatura({
    visitas: ss.length,
    dias: new Set(ss.map((s) => String(s.inicio).slice(0, 10))).size,
    ultima: ss.length ? ss.map((s) => s.ultima).sort().pop()! : null,
    activoMs: ss.reduce((a, s) => a + (s.activo_ms ?? 0), 0),
    mejor: Math.max(0, ...ss.map((s) => (s.total_slides ? (s.max_slide + 1) / s.total_slides : 0))),
    final: ss.some((s) => s.final),
    interes: !!lead.lead_captacion_id || tipo === 'interes',
  })
  const nombre = lead.nombre as string
  const titulo: Record<TipoAviso, string> = {
    abierto: `${nombre} ha abierto el dossier de ${c.salaNombre}`,
    vuelto: `${nombre} ha vuelto al dossier de ${c.salaNombre}`,
    final: `${nombre} ha visto el dossier de ${c.salaNombre} hasta el final`,
    interes: `${nombre} ha pulsado «Me interesa» en ${c.salaNombre}`,
    reenvio: `${nombre} parece haber compartido su PIN de ${c.salaNombre}`,
  }
  const consejo: Record<TipoAviso, string> = {
    abierto: 'Es la primera vez que entra. Dale un rato y pregúntale qué le ha parecido.',
    vuelto: 'Vuelve después de unos días: suele ser el momento de proponer una visita.',
    final: 'Ha recorrido el dossier entero. Buen momento para llamarle.',
    interes: 'Ha pedido que le contactemos. Llámale hoy.',
    reenvio: 'Hay más gente mirando el piso. Pregúntale si quiere organizar una visita con quien le acompañe.',
  }
  const donde = [[sesion?.ciudad, sesion?.pais].filter(Boolean).join(', '), sesion?.dispositivo].filter(Boolean).join(' · ')
  const ficha = `https://salas.formaprima.es/${c.salaSlug}/lead/${c.leadId}`
  const fila = (k: string, v?: string | null) => (v ? `<tr><td style="padding:4px 16px 4px 0;color:#777;">${k}</td><td style="padding:4px 0;">${esc(v)}</td></tr>` : '')

  const r = await sendEmail({
    to: dest.to,
    cc: dest.cc.length ? dest.cc : undefined,
    subject: titulo[tipo],
    html: wrapEmail(`
      <p style="margin:0 0 6px;font-size:16px;"><strong>${esc(titulo[tipo])}</strong></p>
      <p style="margin:0 0 18px;color:#555;">${esc(extra ? `${extra} ` : '')}${esc(consejo[tipo])}</p>
      <table style="font-size:14px;border-collapse:collapse;margin:0 0 18px;">
        ${fila('Temperatura', `${NOMBRE_TEMPERATURA[t.nivel]} · ${t.puntos}/100`)}
        ${fila('Visitas', String(ss.length))}
        ${fila('Desde', donde)}
        ${fila('Empresa', lead.empresa)}
        ${fila('Teléfono', lead.telefono)}
        ${fila('Email', lead.email)}
      </table>
      <p style="margin:0;"><a href="${ficha}">Ver su ficha en Salas</a></p>
    `),
  })
  if (r.error) console.error('[salas] email aviso', r.error)
}
