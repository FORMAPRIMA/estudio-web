// Salas · prospección: el dossier del estudio personalizado para cada lead, en
// formaprima.es/para/<token>. El enlace ES la llave (sin PIN): un token que no
// se adivina, revocable desde el panel y con caducidad opcional.
// Solo servidor (service_role). NO es 'use server'.

import { randomInt } from 'crypto'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Idioma, LeadPara, Perfil } from '@/lib/para/textos'

export const BUCKET_LOGOS = 'salas-logos'
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789'   // sin 0/o, 1/l/i: se dicta por teléfono

/** «Be Grand México» → «begrand-k7x2p». El nombre ayuda a reconocerlo; el sufijo lo hace inadivinable. */
export async function tokenNuevo(empresa: string | null, nombre: string): Promise<string> {
  const base = (empresa || nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, 'y').replace(/[^a-z0-9]+/g, '').slice(0, 18) || 'fp'
  const admin = createAdminClient()
  for (let k = 0; k < 20; k++) {
    let suf = ''
    for (let i = 0; i < 6; i++) suf += ALFABETO[randomInt(ALFABETO.length)]
    const token = `${base}-${suf}`
    const { count } = await admin.from('sala_leads').select('id', { count: 'exact', head: true }).eq('token', token)
    if (!count) return token
  }
  throw new Error('No se pudo generar el enlace.')
}

export interface Prospecto {
  leadId: string
  salaId: string
  salaSlug: string
  token: string
  lead: LeadPara
  logoModo: 'blanco' | 'original'
  logoPath: string | null
}

/** El lead de un enlace /para/<token>, si el enlace sigue vigente. */
export async function prospectoPorToken(token: string): Promise<Prospecto | null> {
  if (!/^[a-z0-9]{1,18}-[a-z0-9]{6}$/.test(token)) return null
  const admin = createAdminClient()
  const { data: l } = await admin.from('sala_leads')
    .select('id, sala_id, nombre, empresa, idioma, tratamiento, logo_path, logo_modo, estado, caduca_en, descartado_en')
    .eq('token', token).maybeSingle()
  if (!l || l.estado !== 'activo' || (l.caduca_en && Date.parse(l.caduca_en) < Date.now())) return null
  const { data: s } = await admin.from('sala_salas').select('id, slug, activa, tipo, perfil').eq('id', l.sala_id).maybeSingle()
  if (!s || !s.activa || s.tipo !== 'prospeccion') return null
  return {
    leadId: l.id, salaId: s.id, salaSlug: s.slug, token,
    logoModo: l.logo_modo === 'original' ? 'original' : 'blanco',
    logoPath: l.logo_path,
    lead: {
      nombre: nombreDePila(l.nombre),
      empresa: l.empresa || l.nombre,
      perfil: (s.perfil === 'constructora' ? 'constructora' : 'developer') as Perfil,
      idioma: (l.idioma === 'en' ? 'en' : 'es') as Idioma,
      logo: l.logo_path ? `/para/${token}/logo` : null,
    },
  }
}

/** «Juan Pérez García» → «Juan». Se saluda por el nombre de pila. */
export const nombreDePila = (n: string) => n.trim().split(/\s+/)[0] ?? n

// ── Logos ─────────────────────────────────────────────────────────────────────
// Del PNG que sube el panel salen dos versiones: la original (recortada y a un
// alto razonable) y una en blanco puro para los fondos oscuros del dossier. Quien
// lo sube elige cuál se ve; por defecto la blanca, que funciona con casi todo.

export const LOGO_MAX_BYTES = 3 * 1024 * 1024
const ALTO_LOGO = 240

export async function procesarLogo(entrada: Buffer): Promise<{ original: Buffer; blanco: Buffer; ancho: number; alto: number }> {
  const base = sharp(entrada, { density: 300 }).ensureAlpha()
  const meta = await base.metadata()
  if (!meta.width || !meta.height) throw new Error('No se ha podido leer la imagen.')
  // fondo blanco opaco (JPG, PNG sin transparencia) → se vuelve transparente
  const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true })
  const esquinas = [0, info.width - 1, (info.height - 1) * info.width, info.height * info.width - 1].map((i) => i * 4)
  const fondoBlanco = esquinas.every((o) => data[o + 3] > 250 && data[o] > 245 && data[o + 1] > 245 && data[o + 2] > 245)
  if (fondoBlanco) {
    for (let o = 0; o < data.length; o += 4) {
      const claro = Math.min(data[o], data[o + 1], data[o + 2])
      if (claro > 238) data[o + 3] = 0
      else if (claro > 200) data[o + 3] = Math.round(data[o + 3] * (238 - claro) / 38)
    }
  }
  const limpio = sharp(data, { raw: info }).png()
  const recortado = await sharp(await limpio.toBuffer()).trim({ threshold: 1 }).toBuffer()
  const original = await sharp(recortado).resize({ height: ALTO_LOGO, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer()
  const m2 = await sharp(original).metadata()
  // silueta blanca: se conserva solo el canal alfa
  const alfa = await sharp(original).ensureAlpha().extractChannel(3).toBuffer()
  const blanco = await sharp({ create: { width: m2.width!, height: m2.height!, channels: 3, background: '#ffffff' } })
    .joinChannel(alfa).png({ compressionLevel: 9 }).toBuffer()
  return { original, blanco, ancho: m2.width!, alto: m2.height! }
}

export async function guardarLogo(leadId: string, entrada: Buffer): Promise<string> {
  const { original, blanco } = await procesarLogo(entrada)
  const carpeta = `${leadId}/${Date.now()}`
  const st = createAdminClient().storage.from(BUCKET_LOGOS)
  for (const [nombre, buf] of [['original.png', original], ['blanco.png', blanco]] as const) {
    const { error } = await st.upload(`${carpeta}/${nombre}`, buf, { contentType: 'image/png', upsert: true })
    if (error) throw new Error(`No se pudo guardar el logo: ${error.message}`)
  }
  return carpeta
}

export async function leerLogo(carpeta: string, modo: 'blanco' | 'original'): Promise<Buffer | null> {
  const { data } = await createAdminClient().storage.from(BUCKET_LOGOS).download(`${carpeta}/${modo}.png`)
  return data ? Buffer.from(await data.arrayBuffer()) : null
}

export async function borrarLogo(carpeta: string): Promise<void> {
  await createAdminClient().storage.from(BUCKET_LOGOS).remove([`${carpeta}/original.png`, `${carpeta}/blanco.png`]).catch(() => {})
}
