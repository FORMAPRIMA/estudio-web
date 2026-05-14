-- ─────────────────────────────────────────────────────────────────────────────
-- FP Execution: cronograma basado en días con interpolación por m²
--
-- Reemplaza el sistema de duracion_pct (% del total) por un rango de días por
-- capítulo (min para 80m², max para 300m²). Cada proyecto tiene su m² de
-- construcción y el algoritmo interpola linealmente. Override opcional por
-- proyecto+capítulo para casos especiales.
--
-- duracion_pct (capítulos) y duracion_obra_semanas (proyectos) se mantienen en
-- BD por compatibilidad, pero el algoritmo nuevo los ignora.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Rango de días estimados por capítulo en plantilla
ALTER TABLE fpe_template_chapters
  ADD COLUMN IF NOT EXISTS duracion_dias_min numeric,
  ADD COLUMN IF NOT EXISTS duracion_dias_max numeric;

-- 2. m² de construcción por proyecto
ALTER TABLE fpe_projects
  ADD COLUMN IF NOT EXISTS m2_construccion numeric;

-- 3. Override de días por capítulo dentro de un proyecto concreto
ALTER TABLE fpe_project_chapter_settings
  ADD COLUMN IF NOT EXISTS duracion_dias_override numeric;

NOTIFY pgrst, 'reload schema';
