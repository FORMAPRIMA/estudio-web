-- Fix warehouse_items.nivel_calidad CHECK to match proyectos.nivel_calidad
-- (master_piece with underscore, not masterpiece)

ALTER TABLE public.warehouse_items
  DROP CONSTRAINT IF EXISTS warehouse_items_nivel_calidad_check;

ALTER TABLE public.warehouse_items
  ADD CONSTRAINT warehouse_items_nivel_calidad_check
  CHECK (nivel_calidad IN ('functional', 'select', 'master_piece'));

-- Migrate any existing rows (unlikely, but safe)
UPDATE public.warehouse_items SET nivel_calidad = 'master_piece' WHERE nivel_calidad = 'masterpiece';

NOTIFY pgrst, 'reload schema';
