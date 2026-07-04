'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildContratoFromPropuesta } from '@/lib/contratos/buildFromPropuesta'
import { getPlantillaClausulas } from '@/app/actions/plantillaContratos'

const PATH = '/team/captacion/contratos'

// Avanza la etapa del Espacio del lead (si existe) sin retroceder. `extra` se
// aplica siempre (p.ej. cliente_id al firmar). Reusa el funnel; no duplica nada.
const ESPACIO_ETAPA_ORDER = ['bienvenida', 'propuesta', 'formalizacion', 'contrato', 'proyecto']
async function avanzarEspacioPorLead(
  admin: ReturnType<typeof createAdminClient>,
  leadId: string | null | undefined,
  etapa: 'contrato' | 'proyecto',
  extra: Record<string, unknown> = {},
) {
  try {
    if (!leadId) return
    const { data: esp } = await admin
      .from('espacios').select('id, etapa')
      .eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!esp) return
    const now = new Date().toISOString()
    const stampCol: Record<string, string> = { contrato: 'etapa_contrato_at', proyecto: 'etapa_proyecto_at' }
    const patch: Record<string, unknown> = { ...extra, updated_at: now }
    if (ESPACIO_ETAPA_ORDER.indexOf(esp.etapa as string) < ESPACIO_ETAPA_ORDER.indexOf(etapa)) {
      patch.etapa = etapa
      patch[stampCol[etapa]] = now
    }
    await admin.from('espacios').update(patch).eq('id', esp.id)
  } catch (e) {
    console.error('[avanzarEspacioPorLead]', e)
  }
}

async function requirePartner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_partner', 'fp_manager', 'fp_biz_dev'].includes(profile.rol)) throw new Error('Sin permisos.')
  return user
}

export interface Honorario {
  seccion:             string
  descripcion:         string
  importe:             number
  fecha_pago_acordada: string | null
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createContrato(
  contactoId?: string | null,
  source: 'lead' | 'cliente' = 'lead'
): Promise<{ id: string } | { error: string }> {
  try {
    const user = await requirePartner()
    const admin = createAdminClient()

    // Auto-generate contract number: C-YYYY-NNN
    const year = new Date().getFullYear()
    const { data: lastRow } = await admin
      .from('contratos')
      .select('numero')
      .ilike('numero', `C-${year}-%`)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastN = lastRow?.numero
      ? parseInt(lastRow.numero.split('-')[2] ?? '0', 10)
      : 0
    const numero = `C-${year}-${String(lastN + 1).padStart(3, '0')}`

    // Pre-fill studio config + snapshot de cláusulas desde la plantilla de origen
    const { data: cfg } = await admin.from('estudio_config').select('*').eq('id', 1).single()
    const clausulasPlantilla = await getPlantillaClausulas()

    // Pre-fill contacto data (lead or cliente)
    let contactoData: Record<string, string | null> = {}
    const table = source === 'lead' ? 'leads' : 'clientes'
    const idField = source === 'lead' ? 'lead_id' : 'cliente_id'
    if (contactoId) {
      const { data: contacto } = await admin
        .from(table)
        .select('nombre, apellidos, empresa, nif_cif, email, telefono, direccion, ciudad, codigo_postal, pais')
        .eq('id', contactoId)
        .single()
      if (contacto) {
        const fullName = [contacto.nombre, contacto.apellidos].filter(Boolean).join(' ')
        contactoData = {
          cliente_nombre:    contacto.empresa ? fullName : contacto.nombre,
          cliente_apellidos: contacto.apellidos ?? null,
          cliente_empresa:   contacto.empresa   ?? null,
          cliente_nif:       contacto.nif_cif   ?? null,
          cliente_email:     contacto.email     ?? null,
          cliente_telefono:  contacto.telefono  ?? null,
          cliente_direccion: contacto.direccion ?? null,
          cliente_ciudad:    contacto.ciudad    ?? null,
          cliente_cp:        (contacto as any).codigo_postal ?? null,
          cliente_pais:      contacto.pais      ?? null,
        }
      }
    }

    const { data, error } = await admin
      .from('contratos')
      .insert({
        numero,
        [idField]:        contactoId ?? null,
        emisor_nombre:    cfg?.nombre      ?? null,
        emisor_nif:       cfg?.nif         ?? null,
        emisor_direccion: cfg?.direccion   ?? null,
        emisor_ciudad:    cfg?.ciudad      ?? null,
        emisor_cp:        cfg?.codigo_postal ?? null,
        emisor_email:     cfg?.email       ?? null,
        emisor_telefono:  cfg?.telefono    ?? null,
        honorarios:       [],
        status:           'borrador',
        created_by:       user.id,
        contenido:        { clausulas: clausulasPlantilla },
        ...contactoData,
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: data.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// Asocia un contrato suelto a un lead o cliente (desde el tablero, sin editor).
// Rellena los datos del cliente igual que al crearlo desde un contacto.
export async function asociarContrato(
  id: string,
  contactoId: string,
  source: 'lead' | 'cliente'
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()

    const table = source === 'lead' ? 'leads' : 'clientes'
    const { data: contacto } = await admin
      .from(table)
      .select('nombre, apellidos, empresa, nif_cif, email, telefono, direccion, ciudad, codigo_postal, pais')
      .eq('id', contactoId)
      .single()

    const patch: Record<string, unknown> = {
      lead_id:    source === 'lead'    ? contactoId : null,
      cliente_id: source === 'cliente' ? contactoId : null,
    }
    if (contacto) {
      const fullName = [contacto.nombre, contacto.apellidos].filter(Boolean).join(' ')
      Object.assign(patch, {
        cliente_nombre:    contacto.empresa ? fullName : contacto.nombre,
        cliente_apellidos: contacto.apellidos ?? null,
        cliente_empresa:   contacto.empresa   ?? null,
        cliente_nif:       contacto.nif_cif   ?? null,
        cliente_email:     contacto.email     ?? null,
        cliente_telefono:  contacto.telefono  ?? null,
        cliente_direccion: contacto.direccion ?? null,
        cliente_ciudad:    contacto.ciudad    ?? null,
        cliente_cp:        (contacto as any).codigo_postal ?? null,
        cliente_pais:      contacto.pais      ?? null,
      })
    }

    const { error } = await admin.from('contratos').update(patch).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function updateContrato(
  id: string,
  data: Partial<{
    // Studio
    emisor_nombre:    string | null
    emisor_nif:       string | null
    emisor_direccion: string | null
    emisor_ciudad:    string | null
    emisor_cp:        string | null
    emisor_email:     string | null
    emisor_telefono:  string | null
    // Client
    cliente_nombre:    string | null
    cliente_apellidos: string | null
    cliente_empresa:   string | null
    cliente_nif:       string | null
    cliente_email:     string | null
    cliente_telefono:  string | null
    cliente_direccion: string | null
    cliente_ciudad:    string | null
    cliente_cp:        string | null
    cliente_pais:      string | null
    // Project
    proyecto_nombre:     string | null
    proyecto_direccion:  string | null
    proyecto_tipo:       string | null
    proyecto_superficie: number | null
    proyecto_codigo:     string | null
    // Contract
    honorarios:  Honorario[]
    status:      string
    fecha_envio: string | null
    fecha_firma: string | null
    notas:       string | null
    contenido:   Record<string, unknown>
  }>
): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('contratos').update(data).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    revalidatePath(`${PATH}/${id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function createContratoFromPropuesta(
  propuestaId: string,
  tipoCliente: 'fisica' | 'juridica' = 'fisica'
): Promise<{ id: string } | { error: string }> {
  try {
    const user  = await requirePartner()
    const admin = createAdminClient()

    const res = await buildContratoFromPropuesta(admin, propuestaId, tipoCliente, user.id)
    if ('error' in res) return res

    // El Espacio del lead (si existe) avanza a la etapa Contrato.
    await avanzarEspacioPorLead(admin, res.leadId, 'contrato')

    revalidatePath(PATH)
    return { id: res.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

export async function deleteContrato(id: string): Promise<{ success: true } | { error: string }> {
  try {
    await requirePartner()
    const admin = createAdminClient()
    const { error } = await admin.from('contratos').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

// ── Firmar contrato → genera proyecto, cliente y facturación ─────────────────

// ── Cálculo de fechas de pago a partir de la fecha de firma ──────────────────
// Las fases comprometidas (anteproyecto → proyecto de ejecución → interiorismo)
// corren en días hábiles desde la firma. Los hitos de cada fase se reparten:
// "a la firma" → día de la firma; último hito → fin de fase; intermedios →
// proporcional. Fases sin plazo numérico (obra, gestión) → sin fecha (avance).

function parseDiasHabiles(s?: string | null): number | null {
  if (!s) return null
  const nums = s.match(/\d+(?:[.,]\d+)?/g)?.map(n => parseFloat(n.replace(',', '.'))) ?? []
  if (nums.length === 0) return null
  const v = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0]
  const lc = s.toLowerCase()
  if (lc.includes('semana') || lc.includes('week')) return Math.round(v * 5)
  if (lc.includes('mes') || lc.includes('month')) return Math.round(v * 21)
  return Math.round(v)
}

function addBusinessDays(startISO: string, days: number): string {
  const d = new Date(`${startISO}T12:00:00`)
  let remaining = Math.round(days)
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) remaining--
  }
  return d.toISOString().split('T')[0]
}

/** Para cada línea de honorarios devuelve su fecha de pago calculada (o null). */
function calcFechasPagoDesdefirma(
  honorarios: Honorario[],
  servicios: { id: string; label: string; semanas?: string }[],
  firmaISO: string,
): (string | null)[] {
  // Ventana [inicio, fin] de cada fase con plazo definido, en días hábiles desde la firma
  const ranges: Record<string, { start: number; end: number }> = {}
  let cursor = 0
  for (const sid of ['anteproyecto', 'proyecto_ejecucion'] as const) {
    const svc = servicios.find(s => s.id === sid)
    if (!svc) continue
    const d = parseDiasHabiles(svc.semanas)
    if (!d || d <= 0) continue
    ranges[svc.label] = { start: cursor, end: cursor + d }
    cursor += d
  }
  // Interiorismo arranca al terminar el proyecto de ejecución (o lo que haya antes)
  const inte = servicios.find(s => s.id === 'interiorismo')
  if (inte) {
    const d = parseDiasHabiles(inte.semanas)
    if (d && d > 0) ranges[inte.label] = { start: cursor, end: cursor + d }
  }

  // Agrupar hitos por sección preservando el orden de aparición
  const grupos = new Map<string, number[]>()
  honorarios.forEach((h, i) => {
    const arr = grupos.get(h.seccion) ?? []
    arr.push(i)
    grupos.set(h.seccion, arr)
  })

  const out: (string | null)[] = honorarios.map(() => null)
  grupos.forEach((idxs, seccion) => {
    const range = ranges[seccion]
    idxs.forEach((hIdx, pos) => {
      const h = honorarios[hIdx]
      const esALaFirma = (h.descripcion ?? '').toLowerCase().includes('firma')
      if (esALaFirma) { out[hIdx] = firmaISO; return }
      if (!range) return // fase sin plazo definido → ligada a avance, sin fecha
      const frac = idxs.length === 1 ? 1 : pos / (idxs.length - 1)
      const dias = range.start + (range.end - range.start) * frac
      out[hIdx] = addBusinessDays(firmaISO, dias)
    })
  })
  return out
}

async function _firmarContratoInternal(
  contratoId: string,
  callerUserId: string,
): Promise<{ proyectoId: string; clienteId: string } | { error: string }> {
  const admin = createAdminClient()

  // 1. Load the full contract
  const { data: c, error: cErr } = await admin
    .from('contratos')
    .select('*')
    .eq('id', contratoId)
    .single()

  if (cErr || !c) return { error: 'Contrato no encontrado.' }
  if (c.status === 'firmado') return { error: 'El contrato ya está firmado.' }

  const honorarios: Honorario[] = c.honorarios ?? []

  // Use the contrato's created_by for project ownership; fall back to caller
  const projectOwnerUserId = (c.created_by as string | null) ?? callerUserId

  // 2. Create client in clientes
  const clienteNombre = c.cliente_empresa
    ? [c.cliente_nombre, c.cliente_apellidos].filter(Boolean).join(' ') || c.cliente_empresa
    : c.cliente_nombre ?? 'Cliente'

  const { data: nuevoCliente, error: cliErr } = await admin
    .from('clientes')
    .insert({
      nombre:                c.cliente_nombre    ?? clienteNombre,
      apellidos:             c.cliente_apellidos ?? null,
      empresa:               c.cliente_empresa   ?? null,
      nif_cif:               c.cliente_nif       ?? null,
      email:                 c.cliente_email     ?? null,
      telefono:              c.cliente_telefono  ?? null,
      direccion:             c.cliente_direccion ?? null,
      ciudad:                c.cliente_ciudad    ?? null,
      codigo_postal:         c.cliente_cp        ?? null,
      pais:                  c.cliente_pais      ?? null,
      direccion_facturacion: c.cliente_direccion ?? null,
    })
    .select('id')
    .single()

  if (cliErr || !nuevoCliente) return { error: `Error creando cliente: ${cliErr?.message}` }
  const clienteId = nuevoCliente.id

  // 3. Mark lead as "ganado" if linked
  if (c.lead_id) {
    await admin.from('leads').update({ estado_lead: 'ganado' }).eq('id', c.lead_id)
  }

  // 4. Create project
  const slug = `${(c.proyecto_nombre ?? 'proyecto').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`
  const { data: nuevoProyecto, error: pErr } = await admin
    .from('proyectos')
    .insert({
      nombre:             c.proyecto_nombre    ?? 'Nuevo proyecto',
      codigo:             ((c.proyecto_codigo ?? '').toUpperCase() || null)?.slice(0, 5) ?? null,
      direccion:          c.proyecto_direccion ?? null,
      ubicacion:          c.proyecto_direccion ?? '-',
      cliente_id:         clienteId,
      status:             'activo',
      año:                new Date().getFullYear(),
      tipologia:          c.proyecto_tipo ?? '-',
      superficie_diseno:  c.proyecto_superficie ?? null,
      slug,
      estado:             'activo',
      created_by:         projectOwnerUserId,
    })
    .select('id')
    .single()

  if (pErr || !nuevoProyecto) return { error: `Error creando proyecto: ${pErr?.message}` }
  const proyectoId = nuevoProyecto.id

  // 5. Link client to project in junction table
  await admin.from('proyecto_clientes').insert({
    proyecto_id: proyectoId,
    cliente_id:  clienteId,
    rol:         'titular',
  })

  // 6. Create billing lines (facturas) from honorarios
  const SECCION_NORM: Record<string, string> = {
    'Anteproyecto':               'Anteproyecto',
    'Proyecto de Ejecución':      'Proyecto de ejecución',
    'Proyecto de ejecución':      'Proyecto de ejecución',
    'Dirección Estética de Obra': 'Obra',
    'Obra':                       'Obra',
    'Proyecto de Interiorismo':   'Interiorismo',
    'Gestión de Interiorismo':    'Interiorismo',
    'Interiorismo':               'Interiorismo',
    'Post Venta':                 'Post venta',
    'Post venta':                 'Post venta',
  }

  if (honorarios.length > 0) {
    // Fechas de pago derivadas del día de firma + plazos comprometidos por fase.
    // Una fecha puesta a mano en el contrato siempre gana al cálculo.
    const hoyISO = new Date().toISOString().split('T')[0]
    const serviciosContrato = ((c.contenido?.servicios ?? []) as { id: string; label: string; semanas?: string }[])
    const fechasCalculadas = calcFechasPagoDesdefirma(honorarios, serviciosContrato, hoyISO)

    const { error: facturasErr } = await admin.from('facturas').insert(
      honorarios.map((h, i) => ({
        proyecto_id:         proyectoId,
        seccion:             SECCION_NORM[h.seccion] ?? h.seccion,
        concepto:            h.descripcion || h.seccion,
        monto:               h.importe,
        fecha_pago_acordada: h.fecha_pago_acordada ?? fechasCalculadas[i],
        status:              'acordada_contrato',
        clientes_ids:        [clienteId],
      }))
    )
    if (facturasErr) console.error('Error creando facturas:', facturasErr.message)
  }

  // 7. Create project phases based on contracted services
  const serviciosContratados: string[] = ((c.contenido?.servicios ?? []) as { id: string }[]).map(s => s.id)
  const { data: todasFases } = await admin
    .from('catalogo_fases')
    .select('id, label, seccion, orden')
    .order('orden')

  if (todasFases && todasFases.length > 0) {
    const faseIdsToAdd = new Set<string>()

    for (const fase of todasFases) {
      const label   = (fase.label   ?? '').toLowerCase()
      const seccion = (fase.seccion ?? '').toLowerCase()

      if (seccion.includes('post') || label.includes('post venta')) {
        faseIdsToAdd.add(fase.id); continue
      }
      if (serviciosContratados.includes('anteproyecto') && seccion.includes('anteproyecto')) {
        if (!label.includes('visitas de venta') && !label.includes('visual lab')) {
          faseIdsToAdd.add(fase.id)
        }
        continue
      }
      if (serviciosContratados.includes('proyecto_ejecucion') &&
          (seccion.includes('ejecutivo') || seccion.includes('ejecuci') ||
           (label.includes('documentaci') && label.includes('econ')))) {
        faseIdsToAdd.add(fase.id); continue
      }
      if (serviciosContratados.includes('direccion_obra') &&
          (seccion.includes('obra') || (label.includes('control') && label.includes('entrega')))) {
        faseIdsToAdd.add(fase.id); continue
      }
      if (serviciosContratados.includes('interiorismo')) {
        if (label.includes('proyecto de interiorismo') ||
            label.includes('diseño 3d') ||
            label.includes('render')) {
          faseIdsToAdd.add(fase.id); continue
        }
      }
      if (serviciosContratados.includes('gestion_interiorismo')) {
        if (label.includes('gesti') && label.includes('interiorismo')) {
          faseIdsToAdd.add(fase.id); continue
        }
      }
    }

    if (faseIdsToAdd.size > 0) {
      await admin.from('proyecto_fases').insert(
        Array.from(faseIdsToAdd).map(faseId => ({
          proyecto_id:  proyectoId,
          fase_id:      faseId,
          responsables: [],
          fase_status:  'en_espera',
        }))
      )
    }
  }

  // 8. Mark contract as firmado and link to project/client.
  // La fecha del contrato es "viva" hasta este momento (el PDF pinta el día en que
  // el cliente lo abre); fecha_firma la congela: los renders posteriores la usan.
  await admin.from('contratos').update({
    status:      'firmado',
    fecha_firma: new Date().toISOString().split('T')[0],
    proyecto_id: proyectoId,
    cliente_id:  clienteId,
  }).eq('id', contratoId)

  // Puente lead → cliente: vinculamos el cliente al Espacio. Por ahora el Espacio
  // se queda en la etapa "contrato" (firmado); la cara de Proyecto queda en pausa
  // hasta que repensemos las fases. (Pasar 'contrato' no retrocede ni avanza la
  // etapa actual, solo aplica el cliente_id.)
  await avanzarEspacioPorLead(admin, c.lead_id as string | null, 'contrato', { cliente_id: clienteId })

  revalidatePath(PATH)
  revalidatePath(`${PATH}/${contratoId}`)
  revalidatePath('/team/proyectos')
  revalidatePath('/team/clientes/base-datos')
  revalidatePath('/team/finanzas/facturacion/control')

  return { proyectoId, clienteId }
}

export async function firmarContrato(
  contratoId: string
): Promise<{ proyectoId: string; clienteId: string } | { error: string }> {
  try {
    const user = await requirePartner()
    return _firmarContratoInternal(contratoId, user.id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

/** Admin version — called from DocuSign webhook (no user session required) */
export async function firmarContratoAdmin(
  contratoId: string
): Promise<{ proyectoId: string; clienteId: string } | { error: string }> {
  try {
    return _firmarContratoInternal(contratoId, 'system')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

