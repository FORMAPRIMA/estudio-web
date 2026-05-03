-- ══════════════════════════════════════════════════════════════════════════════
-- Memorias de Calidad — F1: Warehouse
--
-- Catálogo global de productos vinculado a la jerarquía FPE existente
-- (fpe_template_chapters > fpe_template_units > fpe_template_line_items).
--
-- Cada item tiene un nivel de calidad (functional|select|masterpiece) y forma
-- parte por defecto de la "plantilla implícita" de ese nivel.
--
-- Una misma partida FPE puede tener múltiples items en el mismo nivel
-- (las "marcas orientativas" del anteproyecto: Roca, Duravit, etc.).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.warehouse_items (
  id                       uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_line_item_id    uuid        NOT NULL REFERENCES public.fpe_template_line_items(id) ON DELETE RESTRICT,

  nombre                   text        NOT NULL,
  nivel_calidad            text        NOT NULL CHECK (nivel_calidad IN ('functional', 'select', 'masterpiece')),

  -- Identificación comercial (nullable para items genéricos sin marca, ej. "Pladur 100/48 con LR40")
  marca                    text,
  modelo                   text,
  referencia               text,

  -- Contenido editorial
  descripcion              text,
  imagen_principal_url     text,           -- foto de producto (ficha)
  imagen_lifestyle_url     text,           -- foto en ambiente (lookbook)
  imagenes_adicionales     text[]      NOT NULL DEFAULT '{}',
  ficha_tecnica_url        text,

  -- Comercial
  precio_referencia        numeric(12,2),
  moneda                   text        NOT NULL DEFAULT 'EUR',
  proveedor_preferente_id  uuid        REFERENCES public.proveedores(id) ON DELETE SET NULL,

  -- Físico / variantes
  acabados                 text[]      NOT NULL DEFAULT '{}',
  dimensiones              jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Datos específicos del tipo de partida (wattage, capacidad, etc.)
  data                     jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Clasificación / búsqueda
  tags                     text[]      NOT NULL DEFAULT '{}',

  -- Flags
  incluir_en_plantilla     boolean     NOT NULL DEFAULT true,   -- aparece en plantilla por defecto del nivel
  activo                   boolean     NOT NULL DEFAULT true,

  -- Auditoría
  created_by               uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS warehouse_items_template_line_item_idx
  ON public.warehouse_items (template_line_item_id);

CREATE INDEX IF NOT EXISTS warehouse_items_nivel_idx
  ON public.warehouse_items (nivel_calidad) WHERE activo = true;

CREATE INDEX IF NOT EXISTS warehouse_items_proveedor_idx
  ON public.warehouse_items (proveedor_preferente_id);

CREATE INDEX IF NOT EXISTS warehouse_items_tags_idx
  ON public.warehouse_items USING gin (tags);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read warehouse items"
  ON public.warehouse_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage warehouse items"
  ON public.warehouse_items FOR ALL TO authenticated USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass warehouse_items"
  ON public.warehouse_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Storage bucket: warehouse (imágenes y fichas técnicas, público) ──────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('warehouse', 'warehouse', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS: authenticated users can upload, public read

DROP POLICY IF EXISTS "Authenticated can upload to warehouse" ON storage.objects;
CREATE POLICY "Authenticated can upload to warehouse"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'warehouse');

DROP POLICY IF EXISTS "Authenticated can update warehouse objects" ON storage.objects;
CREATE POLICY "Authenticated can update warehouse objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'warehouse');

DROP POLICY IF EXISTS "Authenticated can delete warehouse objects" ON storage.objects;
CREATE POLICY "Authenticated can delete warehouse objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'warehouse');

DROP POLICY IF EXISTS "Public can read warehouse objects" ON storage.objects;
CREATE POLICY "Public can read warehouse objects"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'warehouse');

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
