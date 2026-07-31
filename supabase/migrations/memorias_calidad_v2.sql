-- ══════════════════════════════════════════════════════════════════════════════
-- Memorias de Calidades v2
--
-- 1. Catálogo global de estructura presupuestaria (capítulos → subcapítulos),
--    sembrado con la estructura real de nuestros presupuestos de obra
--    (11 capítulos / 53 subcapítulos, extraídos de Casa Claudio Coello 38).
-- 2. warehouse_items se desacopla de FP Execution: cuelga de un subcapítulo,
--    guarda PVP + coste y marca un único "Favorito FP" por subcapítulo × nivel.
-- 3. La memoria de ejecución se organiza por ESTANCIAS con snapshot por item.
-- 4. Se elimina proyecto_memoria_items (el flujo antiguo vía plantilla FPE).
--
-- Se vacía el warehouse a propósito: los 3 items existentes eran de prueba y
-- no tienen subcapítulo al que colgar.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Estructura presupuestaria ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.presupuesto_capitulos (
  id         uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero     int         NOT NULL UNIQUE,
  nombre     text        NOT NULL,
  orden      int         NOT NULL DEFAULT 0,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.presupuesto_subcapitulos (
  id          uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  capitulo_id uuid        NOT NULL REFERENCES public.presupuesto_capitulos(id) ON DELETE CASCADE,
  codigo      text        NOT NULL UNIQUE,
  nombre      text        NOT NULL,
  orden       int         NOT NULL DEFAULT 0,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presupuesto_subcapitulos_capitulo_idx
  ON public.presupuesto_subcapitulos (capitulo_id);

-- ── 2. Seed: estructura real de presupuesto ───────────────────────────────────

INSERT INTO public.presupuesto_capitulos (numero, nombre, orden) VALUES
  (1::int, 'DEMOLICIONES Y TRABAJOS PREVIOS'::text, 1::int),
  (2, 'REFUERZOS ESTRUCTURALES', 2),
  (3, 'ALBAÑILERIA', 3),
  (4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', 4),
  (5, 'CARPINTERIA MADERA', 5),
  (6, 'INSTALACIONES', 6),
  (7, 'PINTURAS Y REVESTIMIENTOS', 7),
  (8, 'EQUIPAMIENTO', 8),
  (9, 'COCINA', 9),
  (10, 'VARIOS', 10),
  (11, 'GASTOS GENERALES', 11)
ON CONFLICT (numero) DO NOTHING;

INSERT INTO public.presupuesto_subcapitulos (capitulo_id, codigo, nombre, orden)
SELECT c.id, v.codigo, v.nombre, v.orden
FROM (VALUES
  (1::int, '1_DYT_01'::text, 'Protecciones y actuaciones previas'::text, 1::int),
  (1, '1_DYT_02', 'Ventanas', 2),
  (1, '1_DYT_03', 'Cargas y transportes', 3),
  (2, '2_RE_01', 'Demoliciones - Fase de refuerzos', 4),
  (2, '2_RE_02', 'Estructura', 5),
  (2, '2_RE_03', 'Muros de carga', 6),
  (3, '3_ALB_01', 'Trasdosados de pladur', 7),
  (3, '3_ALB_02', 'Tabiqueria de pladur', 8),
  (3, '3_ALB_03', 'Falsos techos', 9),
  (3, '3_ALB_04', 'Foseados y tabicas', 10),
  (3, '3_ALB_05', 'Soleras y rellenos', 11),
  (3, '3_ALB_06', 'Ayudas albañileria', 12),
  (4, '4_CYV_01', 'Ventanas de madera', 13),
  (4, '4_CYV_02', 'Ventanas de PVC', 14),
  (4, '4_CYV_03', 'Persianas y estores', 15),
  (4, '4_CYV_04', 'Mamparas', 16),
  (4, '4_CYV_05', 'Espejos', 17),
  (5, '5_CM_01', 'Puertas de acceso a vivienda', 18),
  (5, '5_CM_02', 'Puertas de paso abatibles', 19),
  (5, '5_CM_03', 'Puertas de paso correderas', 20),
  (5, '5_CM_04', 'Armarios a medida', 21),
  (5, '5_CM_05', 'Muebles a medida', 22),
  (5, '5_CM_06', 'Walking closet master', 23),
  (5, '5_CM_07', 'Muebles de baño', 24),
  (5, '5_CM_08', 'Panelados y frisos', 25),
  (6, '6_INST_01', 'Fontanería y saneamiento', 26),
  (6, '6_INST_02', 'Ventilación', 27),
  (6, '6_INST_03', 'Calefacción y ACS', 28),
  (6, '6_INST_04', 'Aire acondicionado', 29),
  (6, '6_INST_05', 'Electricidad', 30),
  (6, '6_INST_06', 'Iluminación', 31),
  (6, '6_INST_07', 'Telecomunicaciones', 32),
  (6, '6_INST_08', 'Domótica', 33),
  (6, '6_INST_09', 'Sonido', 34),
  (7, '7_PYV_01', 'Pintura', 35),
  (7, '7_PYV_02', 'Solados y alicatados', 36),
  (7, '7_PYV_03', 'Tarima de madera', 37),
  (7, '7_PYV_04', 'Rodapie metalico', 38),
  (7, '7_PYV_05', 'Cornisas', 39),
  (7, '7_PYV_06', 'Terrazo', 40),
  (8, '8_EQ_01', 'Sanitarios', 41),
  (8, '8_EQ_02', 'Griferias y accesorios', 42),
  (8, '8_EQ_03', 'Mecanismos (Apagadores)', 43),
  (9, '9_COC_01', 'Mobiliario de cocina', 44),
  (9, '9_COC_02', 'Encimera, aplacado y fregadero', 45),
  (9, '9_COC_03', 'Electrodomesticos', 46),
  (9, '9_COC_04', 'Bar', 47),
  (9, '9_COC_05', 'Lavanderia', 48),
  (10, '10_VAR_01', 'Varios', 49),
  (11, '11_GG_01', 'Documentación y tramites (DR)', 50),
  (11, '11_GG_02', 'Gestión de residuos', 51),
  (11, '11_GG_03', 'Seguridad y salud', 52),
  (11, '11_GG_04', 'Limpieza de obra', 53)
) AS v(cap_num, codigo, nombre, orden)
JOIN public.presupuesto_capitulos c ON c.numero = v.cap_num
ON CONFLICT (codigo) DO NOTHING;

-- ── 3. Fuera el flujo antiguo (plantilla FPE) ─────────────────────────────────

DROP TABLE IF EXISTS public.proyecto_memoria_items;

-- ── 4. warehouse_items: desacople de FPE ──────────────────────────────────────

-- Vaciar antes de tocar el esquema (items de prueba sin subcapítulo)
DELETE FROM public.warehouse_items;

ALTER TABLE public.warehouse_items
  DROP COLUMN IF EXISTS template_line_item_id,
  DROP COLUMN IF EXISTS incluir_en_plantilla,
  ADD COLUMN IF NOT EXISTS subcapitulo_id uuid REFERENCES public.presupuesto_subcapitulos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS precio_coste   numeric(12,2),
  ADD COLUMN IF NOT EXISTS url_producto   text,
  ADD COLUMN IF NOT EXISTS es_favorito    boolean NOT NULL DEFAULT false;

-- precio_referencia → precio_pvp
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'warehouse_items' AND column_name = 'precio_referencia'
  ) THEN
    ALTER TABLE public.warehouse_items RENAME COLUMN precio_referencia TO precio_pvp;
  END IF;
END $$;

ALTER TABLE public.warehouse_items ALTER COLUMN subcapitulo_id SET NOT NULL;

DROP INDEX IF EXISTS public.warehouse_items_template_line_item_idx;

CREATE INDEX IF NOT EXISTS warehouse_items_subcapitulo_idx
  ON public.warehouse_items (subcapitulo_id);

-- Un único Favorito FP por subcapítulo × nivel de calidad
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_items_favorito_unico
  ON public.warehouse_items (subcapitulo_id, nivel_calidad)
  WHERE es_favorito AND activo;

-- ── 5. Memoria de ejecución: estancias ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.memoria_estancias (
  id          uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  proyecto_id uuid        NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  nombre      text        NOT NULL,
  orden       int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memoria_estancias_proyecto_idx
  ON public.memoria_estancias (proyecto_id);

CREATE TABLE IF NOT EXISTS public.memoria_estancia_items (
  id                   uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  estancia_id          uuid        NOT NULL REFERENCES public.memoria_estancias(id) ON DELETE CASCADE,
  warehouse_item_id    uuid        REFERENCES public.warehouse_items(id) ON DELETE SET NULL,
  subcapitulo_id       uuid        NOT NULL REFERENCES public.presupuesto_subcapitulos(id) ON DELETE RESTRICT,

  -- Snapshot del catálogo (editable por proyecto, independiente del warehouse)
  nombre               text        NOT NULL,
  nivel_calidad        text        CHECK (nivel_calidad IS NULL OR nivel_calidad IN ('functional', 'select', 'master_piece')),
  marca                text,
  modelo               text,
  referencia           text,
  descripcion          text,
  imagen_principal_url text,
  imagen_lifestyle_url text,
  ficha_tecnica_url    text,
  url_producto         text,
  acabados             text[]      NOT NULL DEFAULT '{}',

  -- Datos del proyecto
  acabado_seleccionado text,
  cantidad             numeric(10,2) NOT NULL DEFAULT 1,
  proveedor_id         uuid        REFERENCES public.proveedores(id) ON DELETE SET NULL,
  precio_pvp           numeric(12,2),
  precio_coste         numeric(12,2),
  moneda               text        NOT NULL DEFAULT 'EUR',
  notas                text,
  estado_compra        text        NOT NULL DEFAULT 'pendiente'
                       CHECK (estado_compra IN ('pendiente', 'pedido', 'en_transito', 'recibido', 'instalado')),
  orden                int         NOT NULL DEFAULT 0,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memoria_estancia_items_estancia_idx
  ON public.memoria_estancia_items (estancia_id);
CREATE INDEX IF NOT EXISTS memoria_estancia_items_proveedor_idx
  ON public.memoria_estancia_items (proveedor_id);

-- ── 6. RLS: solo service_role (todo pasa por Server Actions / API routes) ─────

ALTER TABLE public.presupuesto_capitulos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_subcapitulos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memoria_estancias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memoria_estancia_items    ENABLE ROW LEVEL SECURITY;

-- warehouse_items venía con políticas para authenticated; las retiramos:
-- ya no se lee ni escribe desde el navegador (solo Storage, que tiene las suyas).
DROP POLICY IF EXISTS "Authenticated can read warehouse items"   ON public.warehouse_items;
DROP POLICY IF EXISTS "Authenticated can manage warehouse items" ON public.warehouse_items;

-- Recargar el cache de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
