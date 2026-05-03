-- ══════════════════════════════════════════════════════════════════════════════
-- F3: proyecto_memoria_items
--
-- Per-project snapshot of warehouse items. Created by copying warehouse_items
-- filtered by the project's nivel_calidad + incluir_en_plantilla = true.
--
-- estado_definicion lifecycle:
--   orientativo → shown in anteproyecto as brand options ("o similar")
--   confirmado   → specific product chosen in ejecutivo
--   descartado   → removed from presentation
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.proyecto_memoria_items (
  id                       uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  proyecto_id              uuid        NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  warehouse_item_id        uuid        REFERENCES public.warehouse_items(id) ON DELETE SET NULL,
  template_line_item_id    uuid        NOT NULL REFERENCES public.fpe_template_line_items(id) ON DELETE RESTRICT,

  -- Snapshot (editable per project, independent from warehouse after init)
  nombre                   text        NOT NULL,
  nivel_calidad            text        NOT NULL CHECK (nivel_calidad IN ('functional', 'select', 'master_piece')),
  marca                    text,
  modelo                   text,
  referencia               text,
  descripcion              text,
  imagen_principal_url     text,
  imagen_lifestyle_url     text,
  precio_referencia        numeric(12,2),
  moneda                   text        NOT NULL DEFAULT 'EUR',
  proveedor_preferente_id  uuid        REFERENCES public.proveedores(id) ON DELETE SET NULL,
  acabados                 text[]      NOT NULL DEFAULT '{}',

  -- Project-specific state
  estado_definicion        text        NOT NULL DEFAULT 'orientativo'
                           CHECK (estado_definicion IN ('orientativo', 'confirmado', 'descartado')),
  notas                    text,
  orden                    int         NOT NULL DEFAULT 0,

  activo                   boolean     NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS pmi_proyecto_idx ON public.proyecto_memoria_items (proyecto_id);
CREATE INDEX IF NOT EXISTS pmi_line_item_idx ON public.proyecto_memoria_items (template_line_item_id);
CREATE INDEX IF NOT EXISTS pmi_estado_idx ON public.proyecto_memoria_items (proyecto_id, estado_definicion) WHERE activo = true;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.proyecto_memoria_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read pmi"
  ON public.proyecto_memoria_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage pmi"
  ON public.proyecto_memoria_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass pmi"
  ON public.proyecto_memoria_items FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
