-- ══════════════════════════════════════════════════════════════════════════════
-- Memorias de Calidades v3
--
-- 1. Un producto puede convivir en VARIOS niveles de calidad (`niveles_calidad`).
--    El Favorito FP deja de ser un booleano y pasa a tabla propia
--    (`warehouse_favoritos`) con PK (subcapitulo_id, nivel_calidad): así un mismo
--    producto puede ser el favorito de uno, de varios o de los tres niveles, y la
--    unicidad por hueco la sigue garantizando la base de datos.
-- 2. Precios con y sin IVA: `precio_pvp` es la base sin IVA, `precio_pvp_con_iva`
--    se calcula con `iva_pct` pero se puede sobrescribir a mano.
--
-- Preserva los productos ya dados de alta.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Multi-nivel en el warehouse ────────────────────────────────────────────

ALTER TABLE public.warehouse_items
  ADD COLUMN IF NOT EXISTS niveles_calidad text[] NOT NULL DEFAULT '{}';

-- Backfill desde el nivel único anterior
UPDATE public.warehouse_items
SET niveles_calidad = ARRAY[nivel_calidad]
WHERE cardinality(niveles_calidad) = 0
  AND nivel_calidad IS NOT NULL;

ALTER TABLE public.warehouse_items
  DROP CONSTRAINT IF EXISTS warehouse_items_niveles_calidad_check;

ALTER TABLE public.warehouse_items
  ADD CONSTRAINT warehouse_items_niveles_calidad_check CHECK (
    cardinality(niveles_calidad) BETWEEN 1 AND 3
    AND niveles_calidad <@ ARRAY['functional', 'select', 'master_piece']::text[]
  );

CREATE INDEX IF NOT EXISTS warehouse_items_niveles_idx
  ON public.warehouse_items USING gin (niveles_calidad);

-- ── 2. Favoritos FP en tabla propia ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.warehouse_favoritos (
  subcapitulo_id uuid        NOT NULL REFERENCES public.presupuesto_subcapitulos(id) ON DELETE CASCADE,
  nivel_calidad  text        NOT NULL CHECK (nivel_calidad IN ('functional', 'select', 'master_piece')),
  item_id        uuid        NOT NULL REFERENCES public.warehouse_items(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subcapitulo_id, nivel_calidad)
);

CREATE INDEX IF NOT EXISTS warehouse_favoritos_item_idx
  ON public.warehouse_favoritos (item_id);

-- Migrar los favoritos que hubiera marcados con el booleano
INSERT INTO public.warehouse_favoritos (subcapitulo_id, nivel_calidad, item_id)
SELECT w.subcapitulo_id, w.nivel_calidad, w.id
FROM public.warehouse_items w
WHERE w.es_favorito IS TRUE
  AND w.nivel_calidad IS NOT NULL
ON CONFLICT (subcapitulo_id, nivel_calidad) DO NOTHING;

DROP INDEX IF EXISTS public.warehouse_items_favorito_unico;

ALTER TABLE public.warehouse_items
  DROP COLUMN IF EXISTS es_favorito,
  DROP COLUMN IF EXISTS nivel_calidad;

-- ── 3. Precios con y sin IVA ──────────────────────────────────────────────────

ALTER TABLE public.warehouse_items
  ADD COLUMN IF NOT EXISTS iva_pct            numeric(5,2)  NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS precio_pvp_con_iva numeric(12,2);

-- El precio con IVA de lo ya cargado se deriva de la base
UPDATE public.warehouse_items
SET precio_pvp_con_iva = round(precio_pvp * (1 + iva_pct / 100), 2)
WHERE precio_pvp IS NOT NULL AND precio_pvp_con_iva IS NULL;

-- ── 4. Snapshot de la memoria de ejecución ────────────────────────────────────

ALTER TABLE public.memoria_estancia_items
  ADD COLUMN IF NOT EXISTS niveles_calidad    text[]        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS iva_pct            numeric(5,2)  NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS precio_pvp_con_iva numeric(12,2);

UPDATE public.memoria_estancia_items
SET niveles_calidad = ARRAY[nivel_calidad]
WHERE cardinality(niveles_calidad) = 0
  AND nivel_calidad IS NOT NULL;

UPDATE public.memoria_estancia_items
SET precio_pvp_con_iva = round(precio_pvp * (1 + iva_pct / 100), 2)
WHERE precio_pvp IS NOT NULL AND precio_pvp_con_iva IS NULL;

ALTER TABLE public.memoria_estancia_items
  DROP COLUMN IF EXISTS nivel_calidad;

ALTER TABLE public.memoria_estancia_items
  DROP CONSTRAINT IF EXISTS memoria_estancia_items_niveles_calidad_check;

ALTER TABLE public.memoria_estancia_items
  ADD CONSTRAINT memoria_estancia_items_niveles_calidad_check CHECK (
    niveles_calidad <@ ARRAY['functional', 'select', 'master_piece']::text[]
  );

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.warehouse_favoritos ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
