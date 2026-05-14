-- ============================================================================
-- fpe_carga_demolicion_riosrosas52.sql
--
-- Partidas de demolición del presupuesto ARMICO para Vivienda Ríos Rosas 52
-- (ref. 08-01-26). Solo añade partidas que no existían en el template.
--
-- Modificaciones sobre template existente:
--   - UPDATE: "Protecciones y limpiezas de tajos" (VARIOS) → nombre ampliado
--     para incluir referencia explícita a portal y ascensor.
--
-- Partidas nuevas (20):
--   CAP 10 - DEMOLICIONES:
--     · Retirada de mobiliario    → 2 partidas
--     · Sanitarios y cocina       → 2 partidas
--     · Fontanería y saneamiento  → 1 partida
--     · Pavimentos y revestimientos → 3 partidas
--     · Falsos techos             → 2 partidas
--     · Puertas                   → 1 partida
--     · Tabiquería                → 3 partidas
--     · Molduras y foseados       → 1 partida
--   CAP 100 - ELECTRICIDAD:
--     · Distribución y cableado   → 5 partidas
--
-- Omitidos intencionalmente:
--   01.01 Protección ascensor  → scope cubierto por "Protecciones de portal y
--                                ascensor. Limpiezas de tajos" en VARIOS
--   01.15 Contenedores         → ya existe en VARIOS ("Contenedores de escombro")
--   01.17 Pintura plástica     → ya cubierta en PINTURAS ("Pintura plástica de primera calidad")
--   01.23 Sum. y col. luminaria → scope cubierto por "Iluminación según plano
--                                de iluminación" en ELECTRICIDAD
--   01.24 IVA 21%              → no es partida de obra
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Actualizar nombre de partida existente en VARIOS
--    "Protecciones y limpiezas de tajos" → incluye portal y ascensor
-- ---------------------------------------------------------------------------

UPDATE public.fpe_template_line_items
SET
  nombre     = 'Protecciones de portal y ascensor. Limpiezas de tajos',
  descripcion = 'Tapado y protección de portal, ascensor, suelos y escalera de comunidad durante toda la obra. Limpieza de tajos durante obra y limpieza final de obra.'
WHERE nombre = 'Protecciones y limpiezas de tajos'
  AND unit_id IN (
    SELECT u.id
    FROM public.fpe_template_units u
    JOIN public.fpe_template_chapters c ON c.id = u.chapter_id
    WHERE c.orden = 180 AND u.nombre = 'Varios'
  );

-- ---------------------------------------------------------------------------
-- 2. Nuevas partidas
-- ---------------------------------------------------------------------------

WITH partidas_data (chapter_orden, unit_nombre, partida_orden, partida_nombre, descripcion, unidad_medida, disciplina, fases) AS (
VALUES

-- ── CAP 10: DEMOLICIONES Y TRABAJOS PREVIOS ─────────────────────────────────

-- Retirada de mobiliario
(10, 'Retirada de mobiliario', 5,
  'Retirada de mobiliario de cocina',
  'Retirada por medios manuales de mobiliario de cocina existente, con retirada de restos y escombros a pie de carga, sin incluir transporte a vertedero',
  'ud', 'Demolición y gestión de residuos',
  ARRAY['Preparación y protecciones']),

(10, 'Retirada de mobiliario', 10,
  'Retirada de mobiliario de vivienda',
  'Retirada de mobiliario existente en vivienda por medios manuales, con retirada de restos a pie de carga, sin incluir transporte a vertedero',
  'ud', 'Demolición y gestión de residuos',
  ARRAY['Preparación y protecciones']),

-- Sanitarios y cocina
(10, 'Sanitarios y cocina', 5,
  'Desmontaje de mueble de baño con/sin recuperación',
  'Retirada de mueble de baño a pie de carga, sin incluir transporte a vertedero',
  'ud', 'Demolición y gestión de residuos',
  ARRAY['Preparación y protecciones']),

(10, 'Sanitarios y cocina', 10,
  'Levantado de aparatos sanitarios con/sin recuperación',
  'Levantado de aparatos sanitarios y accesorios por medios manuales, excepto bañeras y duchas, incluso limpieza y retirada de escombros a pie de carga, sin transporte a vertedero',
  'ud', 'Demolición y gestión de residuos',
  ARRAY['Preparación y protecciones']),

-- Fontanería y saneamiento
(10, 'Fontanería y saneamiento', 5,
  'Levantado de instalación de fontanería, saneamiento y electricidad',
  'Levantado por medios manuales de instalación de electricidad, fontanería y saneamiento existente, con retirada de escombros a pie de carga, sin incluir transporte a vertedero',
  'ud', 'Demolición y gestión de residuos',
  ARRAY['Preparación y protecciones', 'Demolición y vaciado']),

-- Pavimentos y revestimientos (ya tiene ordenes 5–20)
(10, 'Pavimentos y revestimientos', 25,
  'Demolición de solados y alicatados',
  'Demolición de solados de cualquier tipo y alicatado existente en paredes por medios manuales, incluso limpieza y retirada de escombros a pie de carga, sin transporte a vertedero',
  'm2', 'Demolición y gestión de residuos',
  ARRAY['Demolición y vaciado']),

(10, 'Pavimentos y revestimientos', 30,
  'Demolición de solados interiores',
  'Demolición de solados interiores de cualquier material por medios manuales, con retirada de escombros a pie de carga, sin incluir transporte a vertedero. Alternativa a las partidas específicas por material.',
  'm2', 'Demolición y gestión de residuos',
  ARRAY['Demolición y vaciado']),

(10, 'Pavimentos y revestimientos', 35,
  'Demolición de solera',
  'Demolición por medios manuales y mecánicos de solera existente hasta 7 cm, con retirada de escombros a pie de carga, sin incluir transporte a vertedero',
  'm2', 'Demolición y gestión de residuos',
  ARRAY['Demolición y vaciado']),

-- Falsos techos
(10, 'Falsos techos', 5,
  'Demolición de falsos techos',
  'Demolición por medios manuales y mecánicos de falsos techos existentes, con retirada de escombros a pie de carga, sin incluir transporte a vertedero',
  'm2', 'Demolición y gestión de residuos',
  ARRAY['Demolición y vaciado']),

(10, 'Falsos techos', 10,
  'Demolición de cornisa en falsos techos',
  'Demolición por medios manuales y mecánicos de cornisas existentes en falsos techos, con retirada de escombros a pie de carga, sin incluir transporte a vertedero',
  'ml', 'Demolición y gestión de residuos',
  ARRAY['Demolición y vaciado']),

-- Puertas
(10, 'Puertas', 5,
  'Demolición de carpinterías interiores',
  'Demolición por medios manuales de carpinterías interiores, con retirada de restos a pie de carga, sin incluir transporte a vertedero',
  'ud', 'Demolición y gestión de residuos',
  ARRAY['Demolición y vaciado']),

-- Tabiquería (ya tiene ordenes 5 y 10)
(10, 'Tabiquería', 15,
  'Demolición de tabiquerías interiores',
  'Demolición por medios manuales de tabiquerías interiores de cualquier tipo, con retirada de escombros a pie de carga, sin incluir transporte a vertedero',
  'm2', 'Demolición y gestión de residuos',
  ARRAY['Demolición y vaciado']),

(10, 'Tabiquería', 20,
  'Demolición de trasdosados interiores',
  'Demolición por medios manuales de trasdosados interiores de cualquier tipo, con retirada de escombros a pie de carga, sin incluir transporte a vertedero',
  'm2', 'Demolición y gestión de residuos',
  ARRAY['Demolición y vaciado']),

(10, 'Tabiquería', 25,
  'Remate de soleras y paramentos por demolición de tabiquerías',
  'Remate de soleras y paramentos tras demolición de tabiquerías',
  'ud', 'Demolición y gestión de residuos',
  ARRAY['Demolición y vaciado']),

-- Molduras y foseados
(10, 'Molduras y foseados', 5,
  'Demolición de rodapié',
  'Demolición y levantado por medios manuales de rodapié existente, con retirada de escombros a pie de carga, sin incluir transporte a vertedero',
  'ml', 'Demolición y gestión de residuos',
  ARRAY['Demolición y vaciado']),

-- ── CAP 100: ELECTRICIDAD ───────────────────────────────────────────────────
-- Armico incluyó estos trabajos en su scope. Se ubican en ELECTRICIDAD
-- del template general. "Suministro y colocación de luminaria" se omite
-- por quedar cubierta por "Iluminación según plano de iluminación".

(100, 'Distribución y cableado', 5,
  'Derivación individual monofásica 3x16 mm²',
  'Derivación individual monofásica en canalización entubada, conductores unipolares de cobre H07Z1-K 3x16 mm² + 1x1,5 mm², instalada en patinillo desde cuarto de contadores hasta cuadro general de vivienda',
  'ml', 'Electricidad',
  ARRAY['Canalizaciones y cableado']),

(100, 'Distribución y cableado', 10,
  'Circuitos generales entre cajas',
  'Instalación de líneas generales de circuitos de 1,5 mm², 2,5 mm², 4 mm² y 6 mm², en distribución desde cuadro eléctrico a cajas de registro de vivienda',
  'ud', 'Electricidad',
  ARRAY['Canalizaciones y cableado']),

(100, 'Distribución y cableado', 15,
  'Punto de luz sencillo',
  'Punto de luz sencillo con tubo PVC corrugado M20/GP5 y conductor de cobre 1,5 mm², incluyendo caja de mecanismo e interruptor',
  'ud', 'Electricidad',
  ARRAY['Canalizaciones y cableado', 'Conexionado y cuadro']),

(100, 'Distribución y cableado', 20,
  'Base de enchufe schuko',
  'Base de enchufe con toma de tierra lateral, tubo PVC corrugado M20/GP5, conductor de cobre 2,5 mm², base enchufe 10/16A (II+T.T.)',
  'ud', 'Electricidad',
  ARRAY['Canalizaciones y cableado', 'Conexionado y cuadro']),

(100, 'Distribución y cableado', 25,
  'Toma de datos/TV',
  'Toma para datos/televisión con canalización de PVC corrugado M20/GP5, caja de mecanismo y toma de televisión',
  'ud', 'Electricidad',
  ARRAY['Canalizaciones y cableado', 'Conexionado y cuadro'])

),

-- Insertar partidas
inserted_line_items AS (
  INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo, discipline_id)
  SELECT
    u.id,
    pd.partida_nombre,
    NULLIF(pd.descripcion, ''),
    pd.unidad_medida,
    pd.partida_orden,
    true,
    d.id
  FROM partidas_data pd
  JOIN public.fpe_template_chapters c ON c.orden = pd.chapter_orden
  JOIN public.fpe_template_units u    ON u.chapter_id = c.id AND u.nombre = pd.unit_nombre
  LEFT JOIN public.fpe_disciplines d  ON d.nombre = pd.disciplina
  RETURNING id, unit_id, nombre
),

-- Mapear partidas a capítulos para cruzar con fases
mapped_partidas AS (
  SELECT ili.id AS line_item_id, c.id AS chapter_id, pd.fases
  FROM inserted_line_items ili
  JOIN public.fpe_template_units u ON u.id = ili.unit_id
  JOIN public.fpe_template_chapters c ON c.id = u.chapter_id
  JOIN partidas_data pd
    ON  pd.partida_nombre  = ili.nombre
    AND pd.chapter_orden   = c.orden
    AND pd.unit_nombre     = u.nombre
),

-- Fases únicas por capítulo
unique_phases AS (
  SELECT DISTINCT ON (chapter_id, nombre) id, chapter_id, nombre
  FROM public.fpe_template_phases
  ORDER BY chapter_id, nombre, id
)

-- Vincular partidas con fases
INSERT INTO public.fpe_template_phase_line_items (phase_id, line_item_id)
SELECT DISTINCT up.id, mp.line_item_id
FROM mapped_partidas mp
CROSS JOIN LATERAL unnest(mp.fases) AS fase_nombre
JOIN unique_phases up ON up.chapter_id = mp.chapter_id AND up.nombre = fase_nombre;

NOTIFY pgrst, 'reload schema';

COMMIT;
