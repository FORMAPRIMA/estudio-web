'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  canAccessPresupuestosParametricos,
  SERIE_INDICE,
  type ObraReferencia,
  type IndicePunto,
  type Capitulo,
  type TipoReforma,
  type EstadoObra,
  type ObraMedicion,
  type NivelCalidad,
  type AjusteINE,
  ajusteINE,
} from '@/lib/presupuestos-parametricos/domain'
import { calcularRatios, type DocumentoObra, type ResultadoRatios } from '@/lib/presupuestos-parametricos/ingesta/ratios'
import { calcularInversion, PARAMETROS_INVERSION, type Inversion } from '@/lib/presupuestos-parametricos/inversion'

const PATH = '/team/apps/presupuestos-parametricos'

async function requirePresupuestosAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sin sesión activa.')
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !canAccessPresupuestosParametricos(profile.rol)) throw new Error('Sin permisos.')
  return { userId: user.id }
}

type Result = { success: true } | { error: string }

export type PanelData = {
  /** false si la migración presupuestos_parametricos.sql aún no está aplicada. */
  isMigrado: boolean
  obras: (ObraReferencia & { partidas: number; importe_partidas: number })[]
  capitulos: Capitulo[]
  indice: IndicePunto[]
}

export async function getPanelData(): Promise<PanelData> {
  await requirePresupuestosAccess()
  const admin = createAdminClient()

  const [obras, capitulos, indice] = await Promise.all([
    admin.from('pp_obras').select('*').order('fecha_presupuesto', { ascending: false }),
    admin.from('presupuesto_capitulos').select('id, numero, nombre, orden').eq('activo', true).order('orden'),
    admin.from('pp_indices').select('serie, periodo, valor, provisional').eq('serie', SERIE_INDICE).order('periodo'),
  ])

  if (obras.error) {
    return { isMigrado: false, obras: [], capitulos: (capitulos.data ?? []) as Capitulo[], indice: [] }
  }

  const lista = (obras.data ?? []) as ObraReferencia[]
  const ids = lista.map(o => o.id)
  const resumen = new Map<string, { partidas: number; importe: number }>()
  if (ids.length) {
    const { data: partidas } = await admin.from('pp_obra_partidas').select('obra_id, importe').in('obra_id', ids)
    for (const p of partidas ?? []) {
      const r = resumen.get(p.obra_id) ?? { partidas: 0, importe: 0 }
      r.partidas += 1
      r.importe += Number(p.importe) || 0
      resumen.set(p.obra_id, r)
    }
  }

  return {
    isMigrado: true,
    obras: lista.map(o => ({
      ...o,
      partidas: resumen.get(o.id)?.partidas ?? 0,
      importe_partidas: resumen.get(o.id)?.importe ?? 0,
    })),
    capitulos: (capitulos.data ?? []) as Capitulo[],
    indice: (indice.data ?? []) as IndicePunto[],
  }
}

export type ObraInput = {
  nombre: string
  direccion?: string | null
  constructor?: string | null
  fecha_presupuesto: string
  tipo_reforma: TipoReforma
  importe_documento?: number | null
  descuento_margen_pct?: number
  notas?: string | null
}

function limpiarObra(input: ObraInput) {
  const nombre = input.nombre?.trim()
  if (!nombre) throw new Error('La obra necesita un nombre.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha_presupuesto ?? '')) throw new Error('Falta la fecha del presupuesto.')
  const pct = Number(input.descuento_margen_pct ?? 0)
  if (!Number.isFinite(pct) || pct < 0 || pct >= 1) throw new Error('El % de margen incluido debe estar entre 0 y 100.')
  return {
    nombre,
    direccion: input.direccion?.trim() || null,
    constructor: input.constructor?.trim() || null,
    fecha_presupuesto: input.fecha_presupuesto,
    tipo_reforma: input.tipo_reforma === 'parcial' ? 'parcial' : 'integral',
    importe_documento: input.importe_documento ?? null,
    descuento_margen_pct: pct,
    notas: input.notas?.trim() || null,
  }
}

export async function createObra(input: ObraInput): Promise<{ id: string } | { error: string }> {
  try {
    const { userId } = await requirePresupuestosAccess()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('pp_obras')
      .insert({ ...limpiarObra(input), created_by: userId })
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { id: data.id }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateObra(id: string, input: ObraInput): Promise<Result> {
  try {
    await requirePresupuestosAccess()
    const admin = createAdminClient()
    const { error } = await admin
      .from('pp_obras')
      .update({ ...limpiarObra(input), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateObraEstado(id: string, estado: EstadoObra): Promise<Result> {
  try {
    await requirePresupuestosAccess()
    const admin = createAdminClient()
    const { error } = await admin
      .from('pp_obras')
      .update({
        estado,
        publicada_at: estado === 'publicada' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath(PATH)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteObra(id: string): Promise<Result> {
  try {
    await requirePresupuestosAccess()
    const admin = createAdminClient()
    const { data: obra } = await admin.from('pp_obras').select('pdf_path').eq('id', id).single()
    const { error } = await admin.from('pp_obras').delete().eq('id', id)
    if (error) return { error: error.message }
    if (obra?.pdf_path) await admin.storage.from('pp-presupuestos').remove([obra.pdf_path])
    revalidatePath(PATH)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ── Ficha de una obra ────────────────────────────────────────────────────────

export type DocumentoGuardado = {
  etiqueta: string; constructor: string | null; fecha: string; total_sin_iva: number | null
  provisional: boolean; nota: string | null; pdf_path: string | null; paginas: number
  control: { codigo: string; nombre: string; resumen: number; extraido: number; diferencia: number; cuadra: boolean }[]
  avisos: string[]
}

export type ObraDetalle = {
  obra: ObraReferencia & { maqueta: unknown; version_fichas: string | null }
  documentos: (DocumentoGuardado & { ajuste: AjusteINE; url: string | null })[]
  mediciones: ObraMedicion[]
  capitulos: (Capitulo & { nivel: NivelCalidad | null; nivel_ia: NivelCalidad | null; justificacion: string | null })[]
  partidas: (DocumentoObra['partidas'][number] & { documento: number; reparto: { parte: string; pct: number; origen: string; confianza: number | null; motivo: string | null }[] })[]
  ratios: ResultadoRatios
  inversion: Inversion
  planoUrl: string | null
}

export async function getObraDetalle(id: string): Promise<ObraDetalle | null> {
  await requirePresupuestosAccess()
  const admin = createAdminClient()
  const [obraR, medR, capR, nivR, parR, indR] = await Promise.all([
    admin.from('pp_obras').select('*').eq('id', id).maybeSingle(),
    admin.from('pp_obra_mediciones').select('*').eq('obra_id', id),
    admin.from('presupuesto_capitulos').select('id, numero, nombre, orden').eq('activo', true).order('orden'),
    admin.from('pp_obra_capitulos').select('capitulo_id, nivel_calidad, nivel_propuesto_ia, justificacion_ia').eq('obra_id', id),
    admin.from('pp_obra_partidas').select('*').eq('obra_id', id).order('orden'),
    admin.from('pp_indices').select('serie, periodo, valor, provisional').eq('serie', SERIE_INDICE).order('periodo'),
  ])
  if (obraR.error) throw new Error(obraR.error.message)
  if (!obraR.data) return null
  const obra = obraR.data
  const partidasDb = parR.data ?? []
  const ids = partidasDb.map(p => p.id)
  const repartoDb = ids.length ? (await admin.from('pp_partida_reparto').select('*').in('partida_id', ids)).data ?? [] : []
  const repartoDe = new Map<string, typeof repartoDb>()
  for (const r of repartoDb) repartoDe.set(r.partida_id, [...(repartoDe.get(r.partida_id) ?? []), r])

  const firmar = async (path: string | null) =>
    path ? (await admin.storage.from('pp-presupuestos').createSignedUrl(path, 3600)).data?.signedUrl ?? null : null
  const indice = (indR.data ?? []) as IndicePunto[]
  const guardados = ((obra.extraccion as { documentos?: DocumentoGuardado[] } | null)?.documentos ?? [])
  const documentos = await Promise.all(guardados.map(async d => ({ ...d, ajuste: ajusteINE(d.fecha, indice), url: await firmar(d.pdf_path) })))

  const partidas = partidasDb.map(p => ({
    codigo: p.codigo_origen, capitulo_codigo: p.capitulo_codigo_origen, capitulo: p.capitulo_origen ?? '', subcapitulo: p.subcapitulo_origen,
    descripcion: p.descripcion, unidad: p.unidad, medicion: p.medicion == null ? null : Number(p.medicion),
    precio: p.precio_unitario == null ? null : Number(p.precio_unitario), importe: Number(p.importe), pagina: p.pagina ?? 0, es_margen: !!p.es_margen,
    documento: p.documento ?? 0,
    reparto: (repartoDe.get(p.id) ?? []).map(r => ({ parte: r.parte, pct: Number(r.pct), origen: r.origen, confianza: r.confianza == null ? null : Number(r.confianza), motivo: r.motivo })),
  }))

  const mediciones = (medR.data ?? []) as ObraMedicion[]
  const valores = Object.fromEntries(mediciones.map(m => [m.variable, m.valor_num ?? m.valor_texto]))
  const docsCalculo: DocumentoObra[] = (documentos.length ? documentos : [{ etiqueta: obra.nombre, fecha: obra.fecha_presupuesto, ajuste: ajusteINE(obra.fecha_presupuesto, indice), provisional: false }]).map((d, di) => {
    const propias = partidas.filter(p => p.documento === di)
    return {
      etiqueta: d.etiqueta, fecha: d.fecha, factorINE: d.ajuste.factor, provisional: d.provisional,
      descuentoMargenPct: Number(obra.descuento_margen_pct) || 0,
      partidas: propias,
      asignaciones: propias.map((p, i) => ({ i, reparto: p.reparto.map(r => ({ parte: r.parte, pct: r.pct })), confianza: p.reparto[0]?.confianza ?? 0, motivo: null })),
    }
  })
  const ratios = calcularRatios(valores, docsCalculo)
  const sys = ratios.propiedad.find(p => p.codigo === 'prop_seguridad_salud')?.importe ?? 0
  const otros = ratios.propiedad.filter(p => p.codigo === 'prop_otros').map(p => ({ concepto: p.nombre, importe: p.importe, conIva: false }))
  const inversion = calcularInversion(ratios.totales.obra, { ...PARAMETROS_INVERSION, seguridadSalud: sys, otros })

  const niveles = new Map((nivR.data ?? []).map(n => [n.capitulo_id, n]))
  return {
    obra: obra as ObraDetalle['obra'],
    documentos, mediciones, partidas, ratios, inversion,
    capitulos: ((capR.data ?? []) as Capitulo[]).filter(c => niveles.has(c.id)).map(c => {
      const n = niveles.get(c.id)!
      return { ...c, nivel: n.nivel_calidad, nivel_ia: n.nivel_propuesto_ia, justificacion: n.justificacion_ia }
    }),
    planoUrl: await firmar(obra.maqueta_imagen_path),
  }
}

export async function updateNivelCapitulo(obraId: string, capituloId: string, nivel: NivelCalidad | null): Promise<Result> {
  try {
    await requirePresupuestosAccess()
    const admin = createAdminClient()
    const { error } = await admin.from('pp_obra_capitulos').update({ nivel_calidad: nivel }).eq('obra_id', obraId).eq('capitulo_id', capituloId)
    if (error) return { error: error.message }
    revalidatePath(`${PATH}/obras/${obraId}`)
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
