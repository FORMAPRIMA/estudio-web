import type { SupabaseClient } from '@supabase/supabase-js'

// ¿Es alguien del estudio? Para rutas que solo comprobaban "hay sesión": con
// el registro abierto en Supabase, una sesión no demuestra ser del equipo
// (cualquiera puede crearse una cuenta de cliente).
const FP_ROLES = ['fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev']

export async function esDelEquipo(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('rol').eq('id', userId).single()
  return !!data?.rol && FP_ROLES.includes(data.rol as string)
}
