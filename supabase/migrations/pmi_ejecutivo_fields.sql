-- F4: Ejecutivo fields for proyecto_memoria_items
-- cantidad, ubicaciones, acabado_seleccionado are filled in during the
-- Ejecutivo phase when a specific product is confirmed and sized.

ALTER TABLE public.proyecto_memoria_items
  ADD COLUMN IF NOT EXISTS cantidad             numeric(10,2),
  ADD COLUMN IF NOT EXISTS ubicaciones          text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS acabado_seleccionado text;

NOTIFY pgrst, 'reload schema';
