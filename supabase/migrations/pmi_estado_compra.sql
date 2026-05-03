-- F6: Procurement status for confirmed proyecto_memoria_items
ALTER TABLE public.proyecto_memoria_items
  ADD COLUMN IF NOT EXISTS estado_compra text
    NOT NULL DEFAULT 'pendiente'
    CHECK (estado_compra IN ('pendiente', 'pedido', 'en_transito', 'recibido', 'instalado'));

NOTIFY pgrst, 'reload schema';
