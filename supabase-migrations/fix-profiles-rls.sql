-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: profiles RLS — fp_team/fp_manager solo ven su propia fila
-- Fix: fondo_fp_periodos — restringir a fp_manager+ (no fp_team)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Profiles ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "FP staff can view all profiles" ON public.profiles;

-- fp_team y fp_manager solo pueden ver su propia fila
CREATE POLICY "fp_team_manager can view own profile" ON public.profiles
  FOR SELECT USING (
    public.get_my_rol() IN ('fp_team', 'fp_manager')
    AND auth.uid() = id
  );

-- fp_partner puede ver todos los perfiles (necesario para AdminPanel)
CREATE POLICY "fp_partner can view all profiles" ON public.profiles
  FOR SELECT USING (
    public.get_my_rol() = 'fp_partner'
  );

-- 2. Fondo periodos ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "fondo_periodos_select" ON public.fondo_fp_periodos;

CREATE POLICY "fondo_periodos_select" ON public.fondo_fp_periodos
  FOR SELECT USING (
    public.get_my_rol() IN ('fp_manager', 'fp_partner')
  );
