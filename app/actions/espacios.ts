'use server'

// Server actions del Espacio del cliente. Ver supabase/migrations/espacios.sql.
// Todo el acceso a BD usa el admin client (service_role) tras verificar permisos.

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Etapa } from '@/lib/espacio/theme'
import { sendEmail, wrapEmail } from '@/lib/email'
import { getPlantillaServicios } from '@/app/actions/plantillaPropuestas'
import { buildPropuestaVM, mapInteriorismoRatios, type PropuestaVM, type PropuestaRowLike } from '@/lib/propuestas/build'
import type { CronoServicio } from '@/lib/propuestas/cronograma'
import { buildContratoFromPropuesta } from '@/lib/contratos/buildFromPropuesta'

// Roles que gestionan captación (igual que leads/propuestas).
const CAPTACION_ROLES = ['fp_partner', 'fp_manager', 'fp_biz_dev']

async function requireCaptacion() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !CAPTACION_ROLES.includes(profile.rol as string)) {
    throw new Error('Sin permisos.')
  }
  return user
}

// Correo de bienvenida con el link único del Espacio (ES/EN). Mismo formato
// (wrapEmail) que el resto de correos de la plataforma.
async function enviarCorreoBienvenida(
  email: string,
  nombre: string,
  token: string,
  idioma: 'es' | 'en',
): Promise<boolean> {
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://internal.formaprima.es'}/espacio/${token}`
  const C = idioma === 'en'
    ? {
        subject: 'Your space at Forma Prima',
        hello: `Hello, ${nombre}`,
        intro: 'Thank you for your interest in Forma Prima. We have created your personal space: a single place to get to know us and to accompany you through every step of the process.',
        cta: 'Open my space',
        note: 'This link is yours and will remain the same throughout our entire relationship. Keep it safe.',
        sign: 'Kind regards,<br/><strong>The Forma Prima team</strong>',
      }
    : {
        subject: 'Tu espacio en Forma Prima',
        hello: `Hola, ${nombre}`,
        intro: 'Gracias por tu interés en Forma Prima. Hemos creado tu espacio personal: un único lugar donde conocernos y acompañarte en cada paso del proceso.',
        cta: 'Abrir mi espacio',
        note: 'Este enlace es tuyo y será siempre el mismo a lo largo de toda nuestra relación. Guárdalo.',
        sign: 'Un saludo,<br/><strong>El equipo de Forma Prima</strong>',
      }

  const body = `
    <h2 style="font-size:20px;font-weight:300;color:#1A1A1A;margin:0 0 8px;">${C.hello}</h2>
    <p style="font-size:13px;color:#555;margin:0 0 24px;line-height:1.6;">${C.intro}</p>
    <p style="margin:0 0 24px;">
      <a href="${link}" style="display:inline-block;background:#D85A30;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-size:14px;font-weight:500;">${C.cta}</a>
    </p>
    <p style="font-size:12px;color:#888;margin:0 0 20px;line-height:1.6;">${C.note}</p>
    <p style="font-size:13px;color:#555;margin:0;line-height:1.6;">${C.sign}</p>
  `
  const res = await sendEmail({ to: email, subject: C.subject, html: wrapEmail(body) })
  if (res.error) { console.error('[espacio] correo bienvenida:', res.error); return false }
  return true
}

// Aviso interno al equipo de captación (mismo patrón que marketing).
async function crearAvisoEspacio(
  titulo: string,
  contenido: string,
  nivel: 'informativo' | 'importante' = 'importante',
) {
  try {
    const admin = createAdminClient()
    await admin.from('avisos').insert({
      tipo: 'equipo',
      autor_id: null,
      titulo,
      contenido,
      nivel,
      fecha_activa: new Date().toISOString().slice(0, 10),
      visible_roles: ['fp_partner'],
    })
  } catch (e) {
    console.error('[espacio] crearAviso', e)
  }
}

export interface EspacioRow {
  id: string
  token: string
  nombre: string
  email: string | null
  lead_id: string | null
  cliente_id: string | null
  etapa: Etapa
  idioma: 'es' | 'en'
  pin_hash: string | null
  pin_set_at: string | null
  primer_acceso: string | null
  num_accesos: number | null
  accesos: { ts: string; ip: string; dispositivo: string }[] | null
  eventos: { tipo: string; ts: string; meta?: unknown }[] | null
  nota_interna: string | null
  created_at: string
}

// ── Crear un Espacio (primer touchpoint, desde Leads) ────────────────────────
export async function createEspacio(
  nombre: string,
  email: string,
  notaInterna: string,
  idioma: 'es' | 'en' = 'es',
): Promise<{ token: string; emailSent: boolean } | { error: string }> {
  try {
    const user = await requireCaptacion()
    const admin = createAdminClient()

    // Creamos el lead ya, para que aparezca en el CRM desde el primer contacto y
    // el Espacio quede vinculado desde el inicio (el formulario luego lo enriquece).
    const { data: lead } = await admin
      .from('leads')
      .insert({
        nombre: nombre.trim(),
        email: email.trim() || null,
        origen: 'Espacio',
        estado_lead: 'nuevo',
        notas: notaInterna.trim() || null,
      })
      .select('id')
      .single()

    const { data, error } = await admin
      .from('espacios')
      .insert({
        nombre: nombre.trim(),
        email: email.trim() || null,
        lead_id: lead?.id ?? null,
        nota_interna: notaInterna.trim() || null,
        etapa: 'bienvenida',
        idioma: idioma === 'en' ? 'en' : 'es',
        created_by: user.id,
      })
      .select('token')
      .single()
    if (error) return { error: error.message }

    const lang = idioma === 'en' ? 'en' : 'es'
    const emailSent = email.trim()
      ? await enviarCorreoBienvenida(email.trim(), nombre.trim(), data.token as string, lang)
      : false

    revalidatePath('/team/captacion/leads')
    return { token: data.token as string, emailSent }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Lectura por token (uso interno del servidor: ruta /espacio/[token]) ───────
export async function getEspacioByToken(token: string): Promise<EspacioRow | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('espacios')
      .select('*')
      .eq('token', token)
      .single()
    if (error || !data) return null
    return data as unknown as EspacioRow
  } catch {
    return null
  }
}

// ── Tracking de acceso (no bloqueante) ───────────────────────────────────────
function parseDispositivo(ua: string): string {
  const isMobile = /Mobile|Android|iPhone/i.test(ua)
  const isTablet = /iPad|Tablet/i.test(ua)
  const device   = isTablet ? 'Tablet' : isMobile ? 'Móvil' : 'Escritorio'
  const browser  =
    /Edg\//i.test(ua)     ? 'Edge'    :
    /OPR\//i.test(ua)     ? 'Opera'   :
    /Chrome\//i.test(ua)  ? 'Chrome'  :
    /Firefox\//i.test(ua) ? 'Firefox' :
    /Safari\//i.test(ua)  ? 'Safari'  : 'Desconocido'
  return `${device} · ${browser}`
}

export async function registrarAccesoEspacio(token: string, ip: string, ua: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: row } = await admin
      .from('espacios')
      .select('id, primer_acceso, num_accesos, accesos, etapa')
      .eq('token', token)
      .single()
    if (!row) return
    const now     = new Date().toISOString()
    const accesos = (row.accesos as object[] | null) ?? []
    // Cada acceso se etiqueta con la etapa en que ocurre: así el termómetro del
    // lead cuenta solo la etapa actual (se "reinicia" al avanzar) sin perder el
    // histórico, que queda en el mismo array agrupable por etapa.
    const etapa = (row.etapa as string | null) ?? 'bienvenida'
    await admin
      .from('espacios')
      .update({
        primer_acceso: (row.primer_acceso as string | null) ?? now,
        num_accesos:   ((row.num_accesos as number) ?? 0) + 1,
        accesos:       [...accesos, { ts: now, ip, dispositivo: parseDispositivo(ua), etapa }],
        updated_at:    now,
      })
      .eq('id', row.id)
  } catch { /* swallow — non-blocking */ }
}

// ── Log de eventos de negocio (lectura de propuesta, aceptación, etc.) ────────
export async function registrarEventoEspacio(
  token: string,
  tipo: string,
  meta?: unknown,
): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: row } = await admin
      .from('espacios')
      .select('id, eventos')
      .eq('token', token)
      .single()
    if (!row) return
    const eventos = (row.eventos as object[] | null) ?? []
    await admin
      .from('espacios')
      .update({
        eventos:    [...eventos, { tipo, ts: new Date().toISOString(), meta }],
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
  } catch { /* swallow — non-blocking */ }
}

// ── Avanzar / forzar la etapa de un Espacio ──────────────────────────────────
const ETAPA_STAMP: Partial<Record<Etapa, string>> = {
  propuesta:     'etapa_propuesta_at',
  formalizacion: 'etapa_formalizacion_at',
  contrato:      'etapa_contrato_at',
  proyecto:      'etapa_proyecto_at',
}

export async function setEtapaEspacio(
  espacioId: string,
  etapa: Etapa,
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { etapa, updated_at: now }
    const stampCol = ETAPA_STAMP[etapa]
    if (stampCol) patch[stampCol] = now
    const { error } = await admin.from('espacios').update(patch).eq('id', espacioId)
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Envío del formulario de Bienvenida (público, sin auth) ───────────────────
// Crea el lead y lo vincula al Espacio. Idempotente: si el Espacio ya tiene lead,
// no lo duplica. Mantiene la misma firma que submitBienvenidaForm para reusar el
// componente BienvenidaPage.
export async function submitEspacioBienvenida(
  token: string,
  formData: {
    nombre: string
    apellidos: string
    email: string
    telefono: string
    empresa?: string
    interes?: string
    notas?: string
  },
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    const { data: espacio } = await admin
      .from('espacios')
      .select('id, lead_id')
      .eq('token', token)
      .single()
    if (!espacio) return { error: 'Este enlace no es válido.' }

    const leadFields = {
      nombre:    formData.nombre.trim(),
      apellidos: formData.apellidos.trim() || null,
      email:     formData.email.trim() || null,
      telefono:  formData.telefono.trim() || null,
      empresa:   formData.empresa?.trim() || null,
      interes:   formData.interes?.trim() || null,
    }

    let leadId = (espacio as { lead_id: string | null }).lead_id
    if (leadId) {
      // El lead ya existe (creado al iniciar el proceso): lo enriquecemos.
      await admin.from('leads').update(leadFields).eq('id', leadId)
    } else {
      const { data: lead, error: leadError } = await admin
        .from('leads')
        .insert({ ...leadFields, notas: formData.notas?.trim() || null, origen: 'Espacio (bienvenida)', estado_lead: 'nuevo' })
        .select('id')
        .single()
      if (leadError) return { error: leadError.message }
      leadId = lead.id as string
    }

    await admin
      .from('espacios')
      .update({
        lead_id: leadId,
        nombre:  formData.nombre.trim() || undefined,
        email:   formData.email.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (espacio as { id: string }).id)

    await crearAvisoEspacio(
      `Formulario completado — ${leadFields.nombre}`,
      `${leadFields.nombre}${leadFields.email ? ` (${leadFields.email})` : ''} ha rellenado el formulario de su Espacio. Revísalo en Captación › Leads.`,
    )

    revalidatePath('/team/captacion/leads')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Propuesta activa del Espacio (vista comercial) ───────────────────────────
// La propuesta más reciente del lead del Espacio en estado enviada/aceptada.
async function fetchPropuestaActiva(leadId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('propuestas')
    .select('*')
    .eq('lead_id', leadId)
    .in('status', ['enviada', 'aceptada'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getEspacioPropuesta(
  token: string,
): Promise<{ vm: PropuestaVM; status: string; propuestaId: string } | null> {
  try {
    const espacio = await getEspacioByToken(token)
    if (!espacio?.lead_id) return null
    const propuesta = await fetchPropuestaActiva(espacio.lead_id)
    if (!propuesta) return null

    const admin = createAdminClient()
    const [serviciosPlantilla, { data: ratiosFases }] = await Promise.all([
      getPlantillaServicios(),
      admin
        .from('catalogo_fases')
        .select('id, label, seccion, ratio')
        .eq('seccion', 'Interiorismo')
        .order('orden'),
    ])
    const ratios = mapInteriorismoRatios(ratiosFases ?? [])

    const vm = buildPropuestaVM(propuesta as unknown as PropuestaRowLike, serviciosPlantilla, ratios)
    // Propuesta sin servicios = aún no está lista para mostrar al cliente.
    if (vm.servicios.length === 0) return null
    return { vm, status: propuesta.status as string, propuestaId: propuesta.id as string }
  } catch {
    return null
  }
}

// ── Aceptar la oferta (cliente) → avanza a Formalización ─────────────────────
export async function aceptarPropuestaEspacio(
  token: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    const espacio = await getEspacioByToken(token)
    if (!espacio?.lead_id) return { error: 'No hay propuesta asociada.' }
    const propuesta = await fetchPropuestaActiva(espacio.lead_id)
    if (!propuesta) return { error: 'No hay propuesta para aceptar.' }

    const now = new Date().toISOString()
    await admin.from('propuestas').update({ status: 'aceptada' }).eq('id', propuesta.id)
    await admin
      .from('espacios')
      .update({ etapa: 'formalizacion', etapa_formalizacion_at: now, updated_at: now })
      .eq('id', espacio.id)

    await registrarEventoEspacio(token, 'propuesta_aceptada', { propuestaId: propuesta.id })
    await crearAvisoEspacio(
      `Propuesta aceptada — ${espacio.nombre}`,
      `${espacio.nombre} ha aceptado la propuesta de honorarios. Toca pedir/confirmar datos y preparar el contrato.`,
    )
    revalidatePath('/team/captacion/propuestas')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Formalización: captura progresiva de datos del firmante ──────────────────
export interface FormalizacionLead {
  nombre: string | null
  apellidos: string | null
  email: string | null
  telefono: string | null
  tipo_facturacion: string | null
  documento_identidad: string | null
  fecha_nacimiento: string | null
  empresa: string | null
  nif_cif: string | null
  direccion: string | null
  ciudad: string | null
  codigo_postal: string | null
  pais: string | null
  direccion_facturacion: string | null
}

export async function getEspacioFormalizacion(
  token: string,
): Promise<{ completado: boolean; lead: FormalizacionLead } | null> {
  try {
    const espacio = await getEspacioByToken(token)
    if (!espacio?.lead_id) return null
    const completado = (espacio.eventos ?? []).some(e => e.tipo === 'datos_completados')

    const admin = createAdminClient()
    const { data: lead } = await admin
      .from('leads')
      .select('nombre, apellidos, email, telefono, tipo_facturacion, documento_identidad, fecha_nacimiento, empresa, nif_cif, direccion, ciudad, codigo_postal, pais, direccion_facturacion')
      .eq('id', espacio.lead_id)
      .single()
    if (!lead) return null
    return { completado, lead: lead as unknown as FormalizacionLead }
  } catch {
    return null
  }
}

export async function submitFormalizacion(
  token: string,
  data: Partial<FormalizacionLead>,
): Promise<{ success: true } | { error: string }> {
  try {
    const admin = createAdminClient()
    const espacio = await getEspacioByToken(token)
    if (!espacio?.lead_id) return { error: 'No se encontró el proceso.' }

    const clean = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)
    await admin
      .from('leads')
      .update({
        tipo_facturacion:      clean(data.tipo_facturacion),
        nombre:                clean(data.nombre) ?? undefined,
        apellidos:             clean(data.apellidos),
        documento_identidad:   clean(data.documento_identidad),
        fecha_nacimiento:      clean(data.fecha_nacimiento),
        telefono:              clean(data.telefono),
        empresa:               clean(data.empresa),
        nif_cif:               clean(data.nif_cif),
        direccion:             clean(data.direccion),
        ciudad:                clean(data.ciudad),
        codigo_postal:         clean(data.codigo_postal),
        pais:                  clean(data.pais),
        direccion_facturacion: clean(data.direccion_facturacion),
      })
      .eq('id', espacio.lead_id)

    await registrarEventoEspacio(token, 'datos_completados', { tipo: data.tipo_facturacion })

    // Al recibir los datos fiscales generamos automáticamente el contrato en
    // BORRADOR desde la propuesta aceptada y avanzamos el Espacio a 'contrato'.
    // No se envía solo: el equipo lo revisa y lo envía desde el tablero de Leads.
    let contratoGenerado = false
    try {
      const [{ data: propuesta }, { data: contratoExistente }] = await Promise.all([
        admin.from('propuestas').select('id')
          .eq('lead_id', espacio.lead_id)
          .in('status', ['aceptada', 'enviada'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        admin.from('contratos').select('id').eq('lead_id', espacio.lead_id).limit(1).maybeSingle(),
      ])
      if (propuesta && !contratoExistente) {
        const tipoCliente = data.tipo_facturacion === 'empresa' ? 'juridica' : 'fisica'
        const res = await buildContratoFromPropuesta(admin, propuesta.id as string, tipoCliente, null)
        if (!('error' in res)) {
          contratoGenerado = true
          const now = new Date().toISOString()
          await admin.from('espacios')
            .update({ etapa: 'contrato', etapa_contrato_at: now, updated_at: now })
            .eq('id', espacio.id)
        }
      }
    } catch (e) {
      console.error('[submitFormalizacion] auto-contrato', e)
    }

    await crearAvisoEspacio(
      `Datos de firmante recibidos — ${espacio.nombre}`,
      contratoGenerado
        ? `${espacio.nombre} ha completado sus datos de formalización. El contrato se ha generado en borrador: revísalo y envíalo desde Captación › Leads.`
        : `${espacio.nombre} ha completado sus datos de formalización. Ya puedes preparar el contrato.`,
    )
    revalidatePath('/team/captacion/leads')
    revalidatePath('/team/captacion/contratos')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Contrato del Espacio (estado + acceso al firmado) ────────────────────────
export interface EspacioContrato {
  numero: string | null
  status: string
  pdfFirmadoUrl: string | null
  fechaFirma: string | null
  fechaContrato: string | null
  hasPropuesta: boolean
  // Servicios del contrato (alcance firmado) con importes por hito, para pintar
  // el cronograma de fases y el flujo de pagos en la etapa Contrato.
  servicios: CronoServicio[]
}

export async function getEspacioContrato(token: string): Promise<EspacioContrato | null> {
  try {
    const espacio = await getEspacioByToken(token)
    if (!espacio?.lead_id) return null
    const admin = createAdminClient()

    const { data: contrato } = await admin
      .from('contratos')
      // OJO: contratos NO tiene columna fecha_contrato (el PDF la deriva en runtime);
      // como fecha de referencia pre-firma usamos fecha_envio.
      .select('numero, status, pdf_firmado_url, fecha_firma, fecha_envio, contenido, honorarios')
      .eq('lead_id', espacio.lead_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!contrato) return null

    const { data: propuesta } = await admin
      .from('propuestas')
      .select('id')
      .eq('lead_id', espacio.lead_id)
      .in('status', ['enviada', 'aceptada'])
      .limit(1)
      .maybeSingle()

    // Servicios del contenido del contrato, hidratando el importe de cada hito de
    // pago desde la tabla de honorarios (que es la fuente firmada de los importes).
    type RawServicio = { id: string; label: string; semanas?: string; pago?: { label: string; pct: number }[] }
    type RawHonorario = { seccion: string; descripcion: string; importe: number }
    const rawServicios = ((contrato.contenido as { servicios?: RawServicio[] } | null)?.servicios ?? [])
    const honorarios = (contrato.honorarios ?? []) as RawHonorario[]
    const usados = new Set<number>()
    const servicios: CronoServicio[] = rawServicios.map(srv => ({
      id:      srv.id,
      label:   srv.label,
      semanas: srv.semanas ?? '',
      pago:    (srv.pago ?? []).map(p => {
        const idx = honorarios.findIndex((h, i) => !usados.has(i) && h.seccion === srv.label && h.descripcion === p.label)
        if (idx >= 0) usados.add(idx)
        return { label: p.label, pct: p.pct, importe: idx >= 0 ? honorarios[idx].importe : 0 }
      }),
    }))

    return {
      numero:        (contrato.numero as string) ?? null,
      status:        (contrato.status as string) ?? 'borrador',
      pdfFirmadoUrl: (contrato.pdf_firmado_url as string) ?? null,
      fechaFirma:    (contrato.fecha_firma as string) ?? null,
      fechaContrato: (contrato.fecha_envio as string) ?? null,
      hasPropuesta:  !!propuesta,
      servicios,
    }
  } catch {
    return null
  }
}

// ── Proyectos del Espacio (multi-proyecto en el mismo link) ──────────────────
export interface EspacioProyecto {
  id: string
  nombre: string
  codigo: string | null
  imagen_url: string | null
  status: string | null
}

export async function getEspacioProyectos(
  token: string,
): Promise<{ clienteId: string; proyectos: EspacioProyecto[] } | null> {
  try {
    const espacio = await getEspacioByToken(token)
    if (!espacio?.cliente_id) return null
    const admin = createAdminClient()

    const SELECT = 'id, nombre, codigo, imagen_url, status'
    const [{ data: directos }, { data: links }] = await Promise.all([
      admin.from('proyectos').select(SELECT).eq('cliente_id', espacio.cliente_id),
      admin.from('proyecto_clientes').select('proyecto_id').eq('cliente_id', espacio.cliente_id),
    ])

    const linkIds = (links ?? []).map(l => l.proyecto_id as string)
    let viaJunction: EspacioProyecto[] = []
    if (linkIds.length) {
      const { data } = await admin.from('proyectos').select(SELECT).in('id', linkIds)
      viaJunction = (data ?? []) as unknown as EspacioProyecto[]
    }

    const map = new Map<string, EspacioProyecto>()
    const all = ((directos ?? []) as unknown as EspacioProyecto[]).concat(viaJunction)
    for (const p of all) map.set(p.id, p)
    return { clienteId: espacio.cliente_id, proyectos: Array.from(map.values()) }
  } catch {
    return null
  }
}

// ── Borrar Espacios (gestión interna) ────────────────────────────────────────
export async function deleteEspacios(ids: string[]): Promise<{ success: true } | { error: string }> {
  try {
    await requireCaptacion()
    const admin = createAdminClient()
    const { error } = await admin.from('espacios').delete().in('id', ids)
    if (error) return { error: error.message }
    revalidatePath('/team/captacion/leads')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}
