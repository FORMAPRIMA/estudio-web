-- ══════════════════════════════════════════════════════════════════════════════
-- FPE Partners — Seed v2 (discipline-based)
-- 19 execution partners distribuidos en las 9 disciplinas del sistema.
-- Todos comparten email jlorag@hotmail.com y tel +34 697880068
--
-- INSTRUCCIONES: ejecutar en Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 0. Limpiar datos anteriores ───────────────────────────────────────────────
-- La FK de fpe_partner_disciplines y fpe_partner_capabilities tiene ON DELETE CASCADE,
-- así que borrar los partners limpia todo en cascada.

DELETE FROM public.fpe_partners WHERE email_contacto = 'jlorag@hotmail.com';


-- ── 1. Insertar partners ───────────────────────────────────────────────────────

INSERT INTO public.fpe_partners (
  nombre, razon_social, nif_cif,
  contacto_nombre, email_contacto, email_notificaciones,
  telefono, ciudad, notas, activo
) VALUES

  -- ── Demolición y gestión de residuos ────────────────────────────────────────
  (
    'Derribos Vega',
    'Derribos y Gestión de Residuos Vega SL', 'B11100001',
    'Óscar Vega Lorente', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Especialistas en demolición selectiva, vaciado de interiores y gestión de residuos (REPs). Maquinaria propia. Tramitación de licencias de derribo incluida.',
    true
  ),
  (
    'Ramos Derribos y Saneamientos',
    'Ramos Derribos y Saneamientos SL', 'B11100002',
    'Eduardo Ramos Pizarro', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Demolición de tabiquería, levantado de solados y saneado de paramentos. Gestión punto limpio y documentación acreditativa de residuos. 12 años de experiencia en reformas de lujo.',
    true
  ),

  -- ── Estructura y obra gruesa ─────────────────────────────────────────────────
  (
    'Albañilería Gil & Hijos',
    'Albañilería Gil e Hijos SL', 'B11100003',
    'Tomás Gil Rodríguez', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Tabiquería de ladrillo, bloque de hormigón y yeso laminado. Trasdosados, techos continuos y pladur técnico. Empresa familiar con 20 años en obra de interiorismo premium.',
    true
  ),
  (
    'Construcciones Morales',
    'Construcciones Morales e Hijos SL', 'B11100004',
    'Ramón Morales Bravo', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Refuerzos estructurales, vigas metálicas, losas y obra gruesa en general. Certificados para intervenciones en edificios protegidos. Coordinación con dirección de obra.',
    true
  ),

  -- ── Instalaciones eléctricas ─────────────────────────────────────────────────
  (
    'Electricidad Castellano',
    'Electricidad y Domótica Castellano SL', 'B11100005',
    'Andrés Castellano Díaz', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Instalaciones eléctricas BT, cuadros de mando, domótica KNX y sistemas de iluminación integrada. Empresa instaladora autorizada categoría especialista.',
    true
  ),
  (
    'TecnoElec Madrid',
    'TecnoElec Instalaciones Madrid SL', 'B11100006',
    'Sergio Núñez Blanco', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Electricidad, telecomunicaciones y automatización residencial: Control4, Lutron, CCTV y seguridad perimetral. 15 años especializados en vivienda de alta gama.',
    true
  ),
  (
    'Iluminación e Integraciones Ruiz',
    'Iluminación e Integraciones Ruiz SL', 'B11100007',
    'Miguel Ruiz Fernández', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Electricidad con especialización en iluminación técnica y decorativa (Erco, iGuzzini, Flos). Diseño de esquemas de iluminación en coordinación con el interiorista.',
    true
  ),

  -- ── Fontanería y saneamiento ─────────────────────────────────────────────────
  (
    'Fontanería Serna',
    'Fontanería y Saneamiento Serna SL', 'B11100008',
    'Pedro Serna Vega', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Fontanería, saneamiento y gas natural. Suelos radiantes, calefacción centralizada y preparaciones de grifería de diseño. Empresa inscrita en el Registro de Instaladores de Gas.',
    true
  ),
  (
    'ClimaTec Soluciones HVAC',
    'ClimaTec Soluciones HVAC SL', 'B11100009',
    'Luis Herrero García', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Climatización VRV/VRF (Mitsubishi Electric, Daikin), ventilación mecánica controlada, recuperación de calor y fancoils ocultos. Empresa certificada F-Gas categoría I.',
    true
  ),

  -- ── Revestimientos y alicatados ──────────────────────────────────────────────
  (
    'Pavimentos Selectos Alcántara',
    'Pavimentos Selectos Alcántara SL', 'B11100010',
    'Roberto Alcántara Ruiz', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Colocación de porcelánico de gran formato, piedra natural, parquet y suelos técnicos. Especialistas en proyectos de interiorismo de lujo. Distribuidor oficial de Porcelanosa y Mapei.',
    true
  ),
  (
    'Cerámicas y Mármoles Romero',
    'Cerámicas y Mármoles Romero SL', 'B11100011',
    'Francisco Romero López', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Alicatados, revestimientos cerámicos y mármol travertino. Especialistas en colocación de piezas de gran formato, esquinas de vidrio y juntas de mínima expresión.',
    true
  ),
  (
    'Microcementos Torres',
    'Microcementos y Superficies Torres SL', 'B11100012',
    'Javier Torres Sanz', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Microcemento, terrazo a la veneciana, resinas epoxi y recubrimientos continuos. Aplicación en suelos, paredes y muebles. Referencias en hoteles boutique y viviendas de lujo.',
    true
  ),

  -- ── Carpintería de madera ────────────────────────────────────────────────────
  (
    'Carpintería Herrera & Asociados',
    'Carpintería Herrera & Asociados SL', 'B11100013',
    'Antonio Herrera Ríos', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Getafe',
    'Carpintería a medida: armarios encastrados, vestidores, cocinas, panelados y carpintería de obra. Fábrica propia en Getafe. Lacados en polvo, chapados y RAL.',
    true
  ),
  (
    'Ebanistería López',
    'Ebanistería Contemporánea López SL', 'B11100014',
    'Diego López Serrano', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Mobiliario de alta gama a medida: lacados en polvo, chapa de madera natural y pintados en colores especiales. Especializados en proyectos de interiorismo con memoria descriptiva detallada.',
    true
  ),

  -- ── Carpintería metálica y vidrio ────────────────────────────────────────────
  (
    'Metalistería Jiménez',
    'Carpintería y Metalistería Jiménez SL', 'B11100015',
    'Iván Jiménez Pons', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Puertas pivotantes de acero, escaleras, barandillas de vidrio laminado y perfiles de aluminio a medida. Diseño propio o siguiendo planos de arquitectura.',
    true
  ),
  (
    'Vidrios y Acristalamientos Mora',
    'Vidrios y Acristalamientos Mora SL', 'B11100016',
    'Raúl Mora Castro', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Mamparas de ducha a medida, tabiques de vidrio estructural, ventanas de aluminio RPT y claraboyas. Proveedor de Saint-Gobain y AGC. Obra en activo en edificios singulares.',
    true
  ),

  -- ── Pintura y remates ────────────────────────────────────────────────────────
  (
    'Pinturas Fernández',
    'Pinturas y Acabados Fernández SL', 'B11100017',
    'Tomás Fernández Cruz', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Pintura plástica y esmalte al agua, barnices al disolvente, papel pintado y acabados especiales: estuco veneciano, cal aérea, microcemento y pintura de tiza.',
    true
  ),
  (
    'Acabados Prieto',
    'Acabados Interiores Prieto SL', 'B11100018',
    'Alberto Prieto García', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Especialistas en acabados de lujo: boiserie lacada, techos de lamas, pintura mineral, guardavivos a inglete y cornisas. Trabajan exclusivamente con estudios de interiorismo premium.',
    true
  ),

  -- ── Equipamiento y mobiliario ────────────────────────────────────────────────
  (
    'Cocinas de Autor Madrid',
    'Cocinas de Autor Madrid SL', 'B11100019',
    'Elena Soto Molina', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Suministro e instalación de cocinas a medida con mobiliario de alta gama (Bulthaup, Siematic, Leicht). Coordinación con plomero y electricista. Electrodomésticos Miele y Gaggenau.',
    true
  )

ON CONFLICT DO NOTHING;


-- ── 2. Asignar disciplinas ────────────────────────────────────────────────────
-- Utiliza fpe_partner_disciplines (reemplaza fpe_partner_capabilities).
-- Referencia por nombre de disciplina para ser robusto ante cambios de UUID.

-- Demolición y gestión de residuos
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_disciplines d
WHERE p.nombre IN ('Derribos Vega', 'Ramos Derribos y Saneamientos')
  AND d.nombre = 'Demolición y gestión de residuos'
ON CONFLICT DO NOTHING;

-- Estructura y obra gruesa
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_disciplines d
WHERE p.nombre IN ('Albañilería Gil & Hijos', 'Construcciones Morales')
  AND d.nombre = 'Estructura y obra gruesa'
ON CONFLICT DO NOTHING;

-- Instalaciones eléctricas
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_disciplines d
WHERE p.nombre IN ('Electricidad Castellano', 'TecnoElec Madrid', 'Iluminación e Integraciones Ruiz')
  AND d.nombre = 'Instalaciones eléctricas'
ON CONFLICT DO NOTHING;

-- Fontanería y saneamiento
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_disciplines d
WHERE p.nombre IN ('Fontanería Serna', 'ClimaTec Soluciones HVAC')
  AND d.nombre = 'Fontanería y saneamiento'
ON CONFLICT DO NOTHING;

-- Revestimientos y alicatados
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_disciplines d
WHERE p.nombre IN ('Pavimentos Selectos Alcántara', 'Cerámicas y Mármoles Romero', 'Microcementos Torres')
  AND d.nombre = 'Revestimientos y alicatados'
ON CONFLICT DO NOTHING;

-- Carpintería de madera
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_disciplines d
WHERE p.nombre IN ('Carpintería Herrera & Asociados', 'Ebanistería López')
  AND d.nombre = 'Carpintería de madera'
ON CONFLICT DO NOTHING;

-- Carpintería metálica y vidrio
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_disciplines d
WHERE p.nombre IN ('Metalistería Jiménez', 'Vidrios y Acristalamientos Mora')
  AND d.nombre = 'Carpintería metálica y vidrio'
ON CONFLICT DO NOTHING;

-- Pintura y remates
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_disciplines d
WHERE p.nombre IN ('Pinturas Fernández', 'Acabados Prieto')
  AND d.nombre = 'Pintura y remates'
ON CONFLICT DO NOTHING;

-- Equipamiento y mobiliario
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Cocinas de Autor Madrid'
  AND d.nombre = 'Equipamiento y mobiliario'
ON CONFLICT DO NOTHING;

-- Partners con disciplinas múltiples:
-- ClimaTec cubre también climatización (metemos Fontanería+Climatización es la misma disciplina)
-- Construcciones Morales también puede hacer demolición
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Construcciones Morales'
  AND d.nombre = 'Demolición y gestión de residuos'
ON CONFLICT DO NOTHING;

-- Ebanistería López también hace equipamiento (mobiliario)
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_partners p
CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Ebanistería López'
  AND d.nombre = 'Equipamiento y mobiliario'
ON CONFLICT DO NOTHING;

COMMIT;


-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT
  p.nombre                         AS partner,
  p.ciudad                         AS ciudad,
  string_agg(d.nombre, ', ' ORDER BY d.orden) AS disciplinas
FROM public.fpe_partners p
LEFT JOIN public.fpe_partner_disciplines pd ON pd.partner_id = p.id
LEFT JOIN public.fpe_disciplines d          ON d.id = pd.discipline_id
WHERE p.email_contacto = 'jlorag@hotmail.com'
GROUP BY p.nombre, p.ciudad
ORDER BY p.nombre;
