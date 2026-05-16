-- ══════════════════════════════════════════════════════════════════════════════
-- FP Execution — separación entre "plataforma de obra activada" y "obra iniciada"
--
-- Contexto:
--   obra_management_started_at marca cuando el equipo abrió la plataforma de
--   gestión de obra (desde Dream Team). Eso NO significa que la obra haya
--   comenzado físicamente — entre la activación y el inicio real puede haber
--   semanas. La fecha planificada de inicio vive en fpe_projects.obra_fecha_inicio
--   (editable desde el dashboard de obra). Esta migración añade el flag manual
--   `obra_iniciada_at` para marcar el arranque físico de la obra.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.fpe_projects
  ADD COLUMN IF NOT EXISTS obra_iniciada_at timestamptz,
  ADD COLUMN IF NOT EXISTS obra_iniciada_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.fpe_projects.obra_iniciada_at IS
  'Timestamp del arranque físico de la obra (botón manual "Empezar obra" en el dashboard). NULL = obra aún no iniciada, en período entre activación de plataforma y arranque real.';

NOTIFY pgrst, 'reload schema';
