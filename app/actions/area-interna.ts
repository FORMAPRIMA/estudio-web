'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ── Auth helpers ─────────────────────────────────────────────────────────────

async function requireFP() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' as const }
  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || !['fp_team', 'fp_manager', 'fp_partner'].includes(profile.rol))
    return { error: 'Sin acceso.' as const }
  return { user, profile, supabase }
}

async function requirePartner() {
  const ctx = await requireFP()
  if ('error' in ctx) return ctx
  if (ctx.profile.rol !== 'fp_partner') return { error: 'Sin permisos de partner.' as const }
  return ctx
}

// ── Nóminas ──────────────────────────────────────────────────────────────────

export async function uploadNomina(formData: FormData) {
  const ctx = await requirePartner()
  if ('error' in ctx) return ctx

  const userId  = formData.get('userId')  as string | null
  const periodo = formData.get('periodo') as string | null
  const file    = formData.get('file')    as File   | null

  if (!userId || !periodo || !file) return { error: 'Datos incompletos.' }

  const admin       = createAdminClient()
  const storagePath = `${userId}/${periodo}.pdf`
  const arrayBuffer = await file.arrayBuffer()
  const buffer      = Buffer.from(arrayBuffer)

  const { error: upErr } = await admin.storage
    .from('nominas')
    .upload(storagePath, buffer, { upsert: true, contentType: 'application/pdf' })

  if (upErr) return { error: upErr.message }

  const { error: dbErr } = await ctx.supabase.from('nominas').upsert(
    {
      user_id:     userId,
      periodo,
      pdf_url:     '',        // regenerated on demand via getNominaSignedUrl
      pdf_path:    storagePath,
      uploaded_by: ctx.user.id,
    },
    { onConflict: 'user_id,periodo' },
  )
  if (dbErr) return { error: dbErr.message }

  revalidatePath('/team/area-interna')
  return { success: true }
}

export async function deleteNomina(nominaId: string) {
  const ctx = await requirePartner()
  if ('error' in ctx) return ctx

  const { data: nomina } = await ctx.supabase
    .from('nominas').select('pdf_path').eq('id', nominaId).single()
  if (!nomina) return { error: 'Nómina no encontrada.' }

  await ctx.supabase.storage.from('nominas').remove([nomina.pdf_path])
  const { error } = await ctx.supabase.from('nominas').delete().eq('id', nominaId)
  if (error) return { error: error.message }

  revalidatePath('/team/area-interna')
  return { success: true }
}

export async function getNominaSignedUrl(pdfPath: string) {
  const ctx = await requireFP()
  if ('error' in ctx) return ctx

  // Security: verify user owns this nómina (unless partner)
  if (ctx.profile.rol !== 'fp_partner') {
    const { data: nomina } = await ctx.supabase
      .from('nominas').select('user_id').eq('pdf_path', pdfPath).single()
    if (!nomina || nomina.user_id !== ctx.user.id)
      return { error: 'Sin acceso.' }
  }

  // Use admin client so storage RLS never interferes — ownership was already verified above
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('nominas')
    .createSignedUrl(pdfPath, 60 * 10) // 10 minutos

  if (error || !data) return { error: error?.message ?? 'Error al generar enlace.' }
  return { url: data.signedUrl }
}

// ── Fondo FP – periodos ──────────────────────────────────────────────────────

export async function saveFondoPeriodo(data: {
  periodo: string
  valor_total: number
  rendimiento_pct: number | null
  notas: string
  fecha_referencia: string
}) {
  const ctx = await requirePartner()
  if ('error' in ctx) return ctx

  const { error } = await ctx.supabase
    .from('fondo_fp_periodos')
    .upsert(data, { onConflict: 'periodo' })
  if (error) return { error: error.message }

  revalidatePath('/team/area-interna')
  return { success: true }
}

export async function deleteFondoPeriodo(id: string) {
  const ctx = await requirePartner()
  if ('error' in ctx) return ctx

  const { error } = await ctx.supabase.from('fondo_fp_periodos').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/team/area-interna')
  return { success: true }
}

// ── Fondo FP – participaciones ────────────────────────────────────────────────

export async function saveParticipacion(data: {
  user_id: string
  porcentaje_participacion: number
  fecha_inicio_participacion: string
  notas: string
}) {
  const ctx = await requirePartner()
  if ('error' in ctx) return ctx

  const { error } = await ctx.supabase
    .from('fondo_fp_participaciones')
    .upsert(data, { onConflict: 'user_id' })
  if (error) return { error: error.message }

  revalidatePath('/team/area-interna')
  return { success: true }
}

export async function deleteParticipacion(userId: string) {
  const ctx = await requirePartner()
  if ('error' in ctx) return ctx

  const { error } = await ctx.supabase
    .from('fondo_fp_participaciones').delete().eq('user_id', userId)
  if (error) return { error: error.message }

  revalidatePath('/team/area-interna')
  return { success: true }
}

// ── Admin – fetch all team members ───────────────────────────────────────────

export async function getTeamMembersForAdmin() {
  const ctx = await requirePartner()
  if ('error' in ctx) return ctx

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, nombre, apellido, email, rol, avatar_url, fecha_contratacion')
    .in('rol', ['fp_team', 'fp_manager', 'fp_partner'])
    .order('nombre')

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// ── Admin – all nóminas ───────────────────────────────────────────────────────

export async function getAllNominas() {
  const ctx = await requirePartner()
  if ('error' in ctx) return ctx

  const { data, error } = await ctx.supabase
    .from('nominas')
    .select('*, profiles(nombre, apellido, rol)')
    .order('periodo', { ascending: false })

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// ── Admin – all participaciones ───────────────────────────────────────────────

export async function getAllParticipaciones() {
  const ctx = await requirePartner()
  if ('error' in ctx) return ctx

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('fondo_fp_participaciones')
    .select('*, profiles(nombre, apellido, email, rol)')
    .order('created_at')

  if (error) return { error: error.message }
  return { data: data ?? [] }
}
