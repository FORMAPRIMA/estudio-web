-- ─────────────────────────────────────────────────────────────────────────────
-- Área Interna FP — migración
-- Ejecutar en Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Nóminas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nominas (
  id          uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  periodo     text        NOT NULL,        -- 'YYYY-MM'  ej: '2025-01'
  pdf_url     text        NOT NULL,
  pdf_path    text        NOT NULL,        -- ruta en Storage (para borrar)
  uploaded_by uuid        REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, periodo)
);

ALTER TABLE public.nominas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nominas_select" ON public.nominas FOR SELECT
  USING (
    auth.uid() = user_id
    OR (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'fp_partner'
  );

CREATE POLICY "nominas_insert" ON public.nominas FOR INSERT
  WITH CHECK ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'fp_partner');

CREATE POLICY "nominas_update" ON public.nominas FOR UPDATE
  USING     ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'fp_partner');

CREATE POLICY "nominas_delete" ON public.nominas FOR DELETE
  USING     ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'fp_partner');


-- ── Fondo FP — periodos trimestrales ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fondo_fp_periodos (
  id               uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  periodo          text    NOT NULL UNIQUE, -- 'YYYY-Q1'  ej: '2024-Q4'
  valor_total      numeric NOT NULL,
  rendimiento_pct  numeric,                 -- retorno trimestral %
  notas            text,
  fecha_referencia date    NOT NULL,        -- último día del trimestre
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.fondo_fp_periodos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fondo_periodos_select" ON public.fondo_fp_periodos FOR SELECT
  USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) IN ('fp_team','fp_manager','fp_partner'));

CREATE POLICY "fondo_periodos_insert" ON public.fondo_fp_periodos FOR INSERT
  WITH CHECK ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'fp_partner');

CREATE POLICY "fondo_periodos_update" ON public.fondo_fp_periodos FOR UPDATE
  USING     ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'fp_partner');

CREATE POLICY "fondo_periodos_delete" ON public.fondo_fp_periodos FOR DELETE
  USING     ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'fp_partner');


-- ── Fondo FP — participaciones por usuario ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fondo_fp_participaciones (
  id                         uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id                    uuid    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  porcentaje_participacion   numeric NOT NULL DEFAULT 0,  -- % del fondo total
  fecha_inicio_participacion date    NOT NULL,
  notas                      text,
  created_at                 timestamptz DEFAULT now()
);

ALTER TABLE public.fondo_fp_participaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participaciones_select" ON public.fondo_fp_participaciones FOR SELECT
  USING (
    auth.uid() = user_id
    OR (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'fp_partner'
  );

CREATE POLICY "participaciones_insert" ON public.fondo_fp_participaciones FOR INSERT
  WITH CHECK ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'fp_partner');

CREATE POLICY "participaciones_update" ON public.fondo_fp_participaciones FOR UPDATE
  USING     ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'fp_partner');

CREATE POLICY "participaciones_delete" ON public.fondo_fp_participaciones FOR DELETE
  USING     ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'fp_partner');


-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORTANTE: Crear el bucket de Storage en el dashboard de Supabase:
--   Nombre: nominas
--   Visibilidad: privado (no público)
--   Tipos MIME permitidos: application/pdf
-- ─────────────────────────────────────────────────────────────────────────────
