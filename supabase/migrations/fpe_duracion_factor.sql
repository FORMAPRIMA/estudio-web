-- ─────────────────────────────────────────────────────────────────────────────
-- FP Execution: factor global de duración por proyecto
--
-- Multiplicador opcional (default 1.0 = 100 %) que escala proporcionalmente los
-- días laborables computados de cada capítulo. Solo aplica a los capítulos cuya
-- duración proviene de la interpolación por m² — los capítulos con override
-- manual quedan blindados y se respetan tal cual.
--
-- Afecta solo al cronograma del proyecto. No toca el template ni los
-- chapter_settings individuales.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE fpe_projects
  ADD COLUMN IF NOT EXISTS duracion_factor numeric NOT NULL DEFAULT 1.0;

NOTIFY pgrst, 'reload schema';
