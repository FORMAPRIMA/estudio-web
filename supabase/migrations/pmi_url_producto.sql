-- F7: Direct purchase URL per memoria item
ALTER TABLE public.proyecto_memoria_items
  ADD COLUMN IF NOT EXISTS url_producto text;

NOTIFY pgrst, 'reload schema';
