-- ══════════════════════════════════════════════════════════════════════════════
-- F2: Presentation metadata for Memorias de Calidad
--
-- Adds client-facing editorial fields to FPE chapters and units so the
-- Memorias de Calidad lookbook has its own labels, descriptions and cover
-- images independent of the internal FP Execution names.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.fpe_template_chapters
  ADD COLUMN IF NOT EXISTS label_cliente       text,
  ADD COLUMN IF NOT EXISTS descripcion_cliente text,
  ADD COLUMN IF NOT EXISTS imagen_portada_url  text;

ALTER TABLE public.fpe_template_units
  ADD COLUMN IF NOT EXISTS label_cliente       text,
  ADD COLUMN IF NOT EXISTS descripcion_cliente text,
  ADD COLUMN IF NOT EXISTS imagen_portada_url  text;

NOTIFY pgrst, 'reload schema';
