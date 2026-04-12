-- ══════════════════════════════════════════════════════════════════════════════
-- FPE Reset 1 — Disciplinas
-- Limpia las disciplinas anteriores y recrea las 24 definitivas.
-- Orden de ejecución: 1º este archivo, 2º fpe_reset_2_template, 3º fpe_reset_3_partners
--
-- INSTRUCCIONES: Supabase Dashboard → SQL Editor → Ejecutar
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Limpiar todo lo dependiente de disciplinas ────────────────────────────────
-- fpe_partner_disciplines y fpe_partner_capabilities tienen ON DELETE CASCADE desde partners,
-- pero fpe_disciplines → partner_disciplines también tiene CASCADE.
-- Limpiamos partner_disciplines aquí para evitar sorpresas.
DELETE FROM public.fpe_partner_disciplines;
DELETE FROM public.fpe_disciplines;

-- ── Insertar 24 disciplinas definitivas ──────────────────────────────────────

INSERT INTO public.fpe_disciplines (nombre, descripcion, color, orden) VALUES

  -- ── Construcción ───────────────────────────────────────────────────────────
  ('Albañilería',
   'Tabiquería, trasdosados, techos, soleras y ayudas a otros gremios',
   '#92400E', 10),

  ('Demolición y gestión de residuos',
   'Derribo selectivo, levantados, retirada de mobiliario y gestión de escombros a vertedero',
   '#6B7280', 20),

  ('Fontanería',
   'Fontanería, saneamiento y agua caliente sanitaria (ACS)',
   '#0369A1', 30),

  ('Electricidad',
   'Instalación eléctrica en baja tensión, iluminación y telecomunicaciones',
   '#D97706', 40),

  ('Gas',
   'Instalación interior de gas natural o propano',
   '#DC2626', 50),

  ('Climatización',
   'Climatización (A/C, VRV/VRF) y calefacción (suelo radiante, fancoils)',
   '#0891B2', 60),

  ('Ventilación',
   'Ventilación mecánica controlada (VMC) y extracción forzada',
   '#6366F1', 70),

  ('Carpintería de madera',
   'Puertas, armarios a medida, panelados y carpintería interior de madera',
   '#B45309', 80),

  ('Carpintería exterior',
   'Ventanas, balconeras y carpintería de fachada en aluminio, PVC o madera',
   '#374151', 90),

  ('Cerrajería',
   'Mamparas, espejos, barandillas y elementos de acero o vidrio a medida',
   '#4B5563', 100),

  ('Mármolista',
   'Encimeras, aplacados y solados de piedra natural, mármol y cuarzo compacto',
   '#7C3AED', 110),

  ('Pintura',
   'Pintura plástica, esmaltes, papeles pintados y acabados decorativos especiales',
   '#DB2777', 120),

  ('Instalador de tarima',
   'Suministro y colocación de tarima de madera maciza o ingeniería',
   '#A16207', 130),

  ('Instalador de cornisas',
   'Colocación de cornisas, molduras decorativas y perfiles de escayola o poliuretano',
   '#9D174D', 140),

  -- ── Equipamiento y proveedores especializados ──────────────────────────────
  ('Equipamiento de ventanas',
   'Persianas, estores, screens y sistemas de oscurecimiento (motorizados o manuales)',
   '#065F46', 150),

  ('Equipamiento domótica',
   'Sistemas de automatización del hogar (KNX, Control4, Lutron, Zigbee)',
   '#1D4ED8', 160),

  ('Equipamiento de sonido',
   'Sistemas de audio multiroom, altavoces empotrados y equipamiento AV',
   '#4338CA', 170),

  ('Equipamiento de cocina',
   'Muebles de cocina, electrodomésticos y accesorios de equipamiento de cocina',
   '#B91C1C', 180),

  ('Equipamiento exterior (pérgolas)',
   'Pérgolas bioclimáticas, toldos y cubiertas para terrazas y jardines',
   '#166534', 190),

  ('Equipamiento exterior (barandillas)',
   'Barandillas de terraza en aluminio, acero, vidrio o madera',
   '#1F2937', 200),

  ('Proveedor de acabados',
   'Suministro de solados, alicatados y revestimientos cerámicos o de resina',
   '#059669', 210),

  ('Proveedor de piedra natural',
   'Suministro de mármol, granito, travertino y otras piedras naturales',
   '#6D28D9', 220),

  ('Proveedor de griferías y accesorios',
   'Suministro de griferías, sanitarios y accesorios de baño y cocina',
   '#0E7490', 230),

  ('Proveedor de mecanismos eléctricos',
   'Suministro de mecanismos (interruptores, enchufes, reguladores) y embellecedores',
   '#92400E', 240)

ON CONFLICT DO NOTHING;

COMMIT;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT orden, nombre, color FROM public.fpe_disciplines ORDER BY orden;
