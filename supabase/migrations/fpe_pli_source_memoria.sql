-- F5: Track which fpe_project_line_items were synced from a Memoria de Calidad
ALTER TABLE public.fpe_project_line_items
  ADD COLUMN IF NOT EXISTS source_memoria boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
