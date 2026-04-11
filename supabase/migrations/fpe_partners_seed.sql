-- ══════════════════════════════════════════════════════════════════════════════
-- FPE Partners — Datos de prueba
-- 16 execution partners de distintas disciplinas (varios por disciplina)
-- Todos comparten email jlorag@hotmail.com y tel +34 697880068
--
-- INSTRUCCIONES: ejecutar en Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Insertar partners ───────────────────────────────────────────────────────

INSERT INTO public.fpe_partners (
  nombre, razon_social, nif_cif,
  contacto_nombre, email_contacto, email_notificaciones,
  telefono, ciudad, notas, activo
) VALUES

  -- ── Demolición / Albañilería ─────────────────────────────────────────────
  (
    'Derribos y Reformas Pérez',
    'Derribos y Reformas Pérez SL', 'B12345678',
    'Manuel Pérez Gómez', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Especialistas en demolición selectiva, tabiquería de ladrillo y bloque, trasdosados y techos de pladur. 15 años de experiencia en obra de interiorismo de alta gama.',
    true
  ),
  (
    'Construcciones Álvarez e Hijos',
    'Construcciones Álvarez e Hijos SL', 'B23456789',
    'Carlos Álvarez Martín', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Empresa familiar de reformas integrales. Especialidad en tabiquería de yeso, trasdosados, falsos techos y obra húmeda en general.',
    true
  ),

  -- ── Pavimentos / Revestimientos ──────────────────────────────────────────
  (
    'Solados y Revestimientos Alcántara',
    'Solados y Revestimientos Alcántara SL', 'B34567890',
    'Roberto Alcántara Ruiz', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Especialistas en microcemento, porcelánico de gran formato, parquet y suelos técnicos. Proyectos de interiorismo de lujo y hoteles boutique.',
    true
  ),
  (
    'Cerámicas y Pavimentos Torres',
    'Cerámicas y Pavimentos Torres SL', 'B45678901',
    'Francisco Torres López', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Colocación de pavimentos y revestimientos cerámicos, naturales y técnicos. Certificación ISO 9001. Distribuidor oficial de Porcelanosa y Mapei.',
    true
  ),
  (
    'Pavimentos Premium Madrid',
    'Pavimentos Premium Madrid SL', 'B56789012',
    'Javier Moreno Sanz', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Especialistas en piedra natural, mármol travertino y superficies de lujo. Colocación manual y con robot. Referencias en proyectos de hasta 2.000 m².',
    true
  ),

  -- ── Electricidad ─────────────────────────────────────────────────────────
  (
    'Electricidad Castellano',
    'Electricidad Castellano SL', 'B67890123',
    'Andrés Castellano Díaz', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Instalaciones eléctricas BT, cuadros de mando, domótica KNX y sistemas audiovisuales integrados. Empresa instaladora autorizada categoría especialista.',
    true
  ),
  (
    'Instalaciones Eléctricas Ruiz',
    'Instalaciones Eléctricas Ruiz e Hijos SL', 'B78901234',
    'Miguel Ruiz Fernández', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Electricidad residencial y terciaria. Integración de iluminación técnica y decorativa (Erco, iGuzzini, Flos). 20 años de experiencia en Madrid.',
    true
  ),
  (
    'TecnoElectric Madrid',
    'TecnoElectric Madrid SL', 'B89012345',
    'Sergio Núñez Blanco', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Electricidad e instalaciones especiales: audio/vídeo distribuido, automatización residencial (Control4, Lutron), CCTV y seguridad perimetral.',
    true
  ),

  -- ── Fontanería / Climatización ────────────────────────────────────────────
  (
    'Instalaciones Hidráulicas Sánchez',
    'Instalaciones Hidráulicas Sánchez SL', 'B90123456',
    'Pedro Sánchez Vega', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Fontanería, saneamiento y gas natural. Especialistas en suelos radiantes, calefacción centralizada y instalaciones de lujo en vivienda.',
    true
  ),
  (
    'ClimaTec Instalaciones',
    'ClimaTec Instalaciones SL', 'B01234567',
    'Luis Herrero García', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Climatización VRV/VRF (Mitsubishi Electric, Daikin), ventilación mecánica controlada y recuperación de calor. Empresa certificada F-Gas categoría I.',
    true
  ),
  (
    'Fontanería y Clima Moreno',
    'Fontanería y Clima Moreno SL', 'B11223344',
    'Raúl Moreno Castro', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Empresa integral de fontanería y climatización. Especialidad en viviendas de alta gama, hoteles boutique y oficinas premium.',
    true
  ),

  -- ── Carpintería ──────────────────────────────────────────────────────────
  (
    'Carpintería Herrera & Asociados',
    'Carpintería Herrera & Asociados SL', 'B22334455',
    'Antonio Herrera Ríos', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Carpintería a medida: armarios encastrados, vestidores, cocinas, panelados y carpintería de obra. Fábrica propia en Getafe. Plazo medio 3 semanas.',
    true
  ),
  (
    'Ebanistería Contemporánea López',
    'Ebanistería Contemporánea López SL', 'B33445566',
    'Diego López Serrano', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Mobiliario de alta gama a medida. Lacados en polvo, chapados en madera natural y pintados en colores RAL. Especializados en proyectos de interiorismo de lujo.',
    true
  ),
  (
    'Carpintería y Metal Jiménez',
    'Carpintería y Metal Jiménez SL', 'B44556677',
    'Iván Jiménez Pons', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Carpintería de madera y metálica. Puertas pivotantes, escaleras, barandillas de acero y vidrio. Diseño propio o siguiendo planos de arquitectura.',
    true
  ),

  -- ── Pintura / Acabados ────────────────────────────────────────────────────
  (
    'Pinturas y Acabados Fernández',
    'Pinturas y Acabados Fernández SL', 'B55667788',
    'Tomás Fernández Cruz', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Pintura decorativa, esmaltes al agua, barnices y papel pintado. Acabados especiales: estuco veneciano, cal aérea, microcemento y pintura de tiza.',
    true
  ),
  (
    'Acabados Interiores Madrid',
    'Acabados Interiores Madrid SL', 'B66778899',
    'Alberto García Prieto', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Especialistas en acabados de lujo: boiserie lacada, techos de lamas, pintura mineral, guardavivos y cornisas. Trabajamos con arquitectos de interiores premium.',
    true
  )

ON CONFLICT DO NOTHING;


-- ── 2. Asignar capacidades — nombres exactos del template seed ───────────────
--
-- UEs disponibles (de fpe_template_seed.sql):
--   Cap 1 · Demolición y Obra Seca:
--     1.1  Demolición y Vaciado
--     1.2  Tabiquería y Trasdosados
--   Cap 2 · Instalaciones:
--     2.1  Instalación Eléctrica y Domótica
--     2.2  Fontanería y Saneamiento
--     2.3  Climatización y Ventilación
--   Cap 3 · Pavimentos y Revestimientos:
--     3.1  Pavimentos
--     3.2  Revestimientos
--   Cap 4 · Carpintería:
--     4.1  Carpintería de Obra a Medida
--     4.2  Puertas Interiores
--   Cap 5 · Acabados Finales:
--     5.1  Pintura y Acabados Decorativos
--     5.2  Sanitarios y Equipamiento de Baño
-- ─────────────────────────────────────────────────────────────────────────────

-- Demolición / Albañilería → UEs 1.1 y 1.2
INSERT INTO public.fpe_partner_capabilities (partner_id, unit_id)
SELECT p.id, u.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_template_units u
WHERE p.nombre IN ('Derribos y Reformas Pérez', 'Construcciones Álvarez e Hijos')
  AND u.nombre IN ('Demolición y Vaciado', 'Tabiquería y Trasdosados')
ON CONFLICT DO NOTHING;

-- Pavimentos / Revestimientos → UEs 3.1 y 3.2
INSERT INTO public.fpe_partner_capabilities (partner_id, unit_id)
SELECT p.id, u.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_template_units u
WHERE p.nombre IN ('Solados y Revestimientos Alcántara', 'Cerámicas y Pavimentos Torres', 'Pavimentos Premium Madrid')
  AND u.nombre IN ('Pavimentos', 'Revestimientos')
ON CONFLICT DO NOTHING;

-- Electricidad → UE 2.1
INSERT INTO public.fpe_partner_capabilities (partner_id, unit_id)
SELECT p.id, u.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_template_units u
WHERE p.nombre IN ('Electricidad Castellano', 'Instalaciones Eléctricas Ruiz', 'TecnoElectric Madrid')
  AND u.nombre IN ('Instalación Eléctrica y Domótica')
ON CONFLICT DO NOTHING;

-- Fontanería / Climatización → UEs 2.2, 2.3 y 5.2
INSERT INTO public.fpe_partner_capabilities (partner_id, unit_id)
SELECT p.id, u.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_template_units u
WHERE p.nombre IN ('Instalaciones Hidráulicas Sánchez', 'ClimaTec Instalaciones', 'Fontanería y Clima Moreno')
  AND u.nombre IN ('Fontanería y Saneamiento', 'Climatización y Ventilación', 'Sanitarios y Equipamiento de Baño')
ON CONFLICT DO NOTHING;

-- Carpintería → UEs 4.1 y 4.2
INSERT INTO public.fpe_partner_capabilities (partner_id, unit_id)
SELECT p.id, u.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_template_units u
WHERE p.nombre IN ('Carpintería Herrera & Asociados', 'Ebanistería Contemporánea López', 'Carpintería y Metal Jiménez')
  AND u.nombre IN ('Carpintería de Obra a Medida', 'Puertas Interiores')
ON CONFLICT DO NOTHING;

-- Pintura / Acabados → UE 5.1
INSERT INTO public.fpe_partner_capabilities (partner_id, unit_id)
SELECT p.id, u.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_template_units u
WHERE p.nombre IN ('Pinturas y Acabados Fernández', 'Acabados Interiores Madrid')
  AND u.nombre IN ('Pintura y Acabados Decorativos')
ON CONFLICT DO NOTHING;

COMMIT;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT
  p.nombre                           AS partner,
  p.ciudad                           AS ciudad,
  COUNT(pc.unit_id)                  AS capacidades
FROM public.fpe_partners p
LEFT JOIN public.fpe_partner_capabilities pc ON pc.partner_id = p.id
WHERE p.email_contacto = 'jlorag@hotmail.com'
GROUP BY p.nombre, p.ciudad
ORDER BY p.nombre;
