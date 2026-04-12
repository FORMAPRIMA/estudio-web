-- ══════════════════════════════════════════════════════════════════════════════
-- FPE Reset 3 — Partners
-- Limpia los partners anteriores y crea 18 placeholders coherentes con las 24
-- disciplinas del sistema. Todos con jlorag@hotmail.com y +34 697880068.
--
-- INSTRUCCIONES: Ejecutar DESPUÉS de fpe_reset_1_disciplines y fpe_reset_2_template
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 0. Limpiar partners anteriores ────────────────────────────────────────────
DELETE FROM public.fpe_partner_disciplines;
DELETE FROM public.fpe_partners;

-- ── 1. Insertar partners ──────────────────────────────────────────────────────

INSERT INTO public.fpe_partners (
  nombre, razon_social, nif_cif,
  contacto_nombre, email_contacto, email_notificaciones,
  telefono, ciudad, notas, activo
) VALUES

  -- Albañilería + Demolición y gestión de residuos
  (
    'Reformas Alcántara',
    'Reformas y Demoliciones Alcántara SL', 'B11200001',
    'Roberto Alcántara Ruiz', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Empresa integral de derribo y albañilería. Demolición selectiva, vaciados, tabiquería LHD y pladur, trasdosados y ayudas a instalaciones. Maquinaria propia. 18 años en obra de interiorismo de lujo.',
    true
  ),
  (
    'Construcciones Gil',
    'Construcciones Gil e Hijos SL', 'B11200002',
    'Tomás Gil Rodríguez', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Albañilería de reforma integral: tabiquería, trasdosados, falsos techos, soleras y refuerzos estructurales. Empresa familiar, 20 años de experiencia en obra premium.',
    true
  ),

  -- Fontanería + Gas
  (
    'Fontanería y Gas Serna',
    'Fontanería, Saneamiento y Gas Serna SL', 'B11200003',
    'Pedro Serna Vega', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Fontanería, saneamiento, gas natural y ACS. Especialistas en vivienda de alta gama: distribuciones en PEX, llaves de corte por estancia, instalaciones de gas con certificación RITE.',
    true
  ),

  -- Climatización + Ventilación
  (
    'ClimaTec Madrid',
    'ClimaTec Soluciones HVAC SL', 'B11200004',
    'Luis Herrero García', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Climatización VRV/VRF (Mitsubishi Electric, Daikin), suelo radiante hidrónico y VMC doble flujo. Empresa certificada F-Gas categoría I. Especialistas en integración silenciosa en proyectos de interiorismo.',
    true
  ),

  -- Electricidad (generalista + iluminación técnica)
  (
    'Electricidad Castellano',
    'Instalaciones Eléctricas Castellano SL', 'B11200005',
    'Andrés Castellano Díaz', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Electricidad BT, cuadros de mando, iluminación técnica (Erco, iGuzzini) y telecomunicaciones. EIA categoría especialista. Referencias en viviendas y hoteles boutique.',
    true
  ),
  (
    'TecnoElec',
    'TecnoElec Instalaciones SL', 'B11200006',
    'Sergio Núñez Blanco', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Electricidad residencial y telecomunicaciones (datos Cat.6A, TV/SAT, RTR). Integración de cableado coordinada con domótica y audio.',
    true
  ),

  -- Equipamiento domótica + Equipamiento de sonido
  (
    'Nórdico Smart Home',
    'Nórdico Smart Home & Audio SL', 'B11200007',
    'Erik Svensson García', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Integración domótica KNX y Control4: iluminación, climatización y seguridad. Audio multiroom Sonos / Bang & Olufsen. Programación y mantenimiento incluido.',
    true
  ),

  -- Carpintería de madera (fabricación propia)
  (
    'Carpintería Herrera',
    'Carpintería a Medida Herrera SL', 'B11200008',
    'Antonio Herrera Ríos', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Getafe',
    'Armarios encastrados, vestidores, puertas pivotantes y panelados a medida. Fábrica propia en Getafe. Lacados en polvo, chapados y RAL. Plazo medio de fabricación: 4 semanas.',
    true
  ),
  (
    'Ebanistería López',
    'Ebanistería Contemporánea López SL', 'B11200009',
    'Diego López Serrano', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Mobiliario de alta gama a medida: lacados en polvo, chapa natural, pintura especial. Especialidad en muebles de baño, cocinas y puertas de paso correderas empotradas.',
    true
  ),

  -- Carpintería exterior + Equipamiento de ventanas
  (
    'Ventanas y Fachadas Gil',
    'Ventanas y Fachadas Gil SL', 'B11200010',
    'Marcos Gil Soto', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Carpintería exterior aluminio RPT y PVC (Schüco, Cortizo). Persianas motorizadas, screens y estores exteriores. Servicio integral: medición, fabricación e instalación.',
    true
  ),

  -- Cerrajería (mamparas, espejos, barandillas)
  (
    'Cristalería Torres',
    'Cristalería y Mamparas Torres SL', 'B11200011',
    'Francisco Torres López', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Mamparas de ducha a medida, tabiques de vidrio estructural, espejos y barandillas de vidrio laminado. Proveedor AGC y Saint-Gobain. Fabricación y montaje en taller propio.',
    true
  ),

  -- Mármolista + Proveedor de piedra natural
  (
    'Mármoles Fernández',
    'Mármoles y Piedra Natural Fernández SL', 'B11200012',
    'Javier Fernández Cruz', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Encimeras de cocina y baño, aplacados y solados en piedra natural, mármol travertino y cuarzo compacto (Silestone, Dekton). Corte digital CNC. Suministro de material y colocación.',
    true
  ),

  -- Pintura + Instalador de cornisas
  (
    'Pinturas Blanco',
    'Pinturas y Acabados Blanco SL', 'B11200013',
    'Tomás Blanco Prieto', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Pintura plástica, esmalte al agua y acabados especiales: estuco veneciano, cal aérea y pintura mineral. Colocación de cornisas y molduras decorativas de escayola y poliuretano.',
    true
  ),

  -- Proveedor de acabados + Instalador de tarima
  (
    'Revestimientos Prieto',
    'Revestimientos y Tarima Prieto SL', 'B11200014',
    'Alberto Prieto García', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Suministro y colocación de porcelánico gran formato, gres y revestimientos continuos. Instalación de tarima de madera maciza e ingeniería flotante y encolada. Distribuidor Porcelanosa y Tarkett.',
    true
  ),

  -- Proveedor de griferías y accesorios
  (
    'Luxury Bath Concept',
    'Luxury Bath Concept SL', 'B11200015',
    'Elena Soto Molina', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Suministro e instalación de sanitarios suspendidos, griferías termostáticas y accesorios de baño de alta gama (Geberit, Hansgrohe, Grohe, Duravit). Asesoramiento y proyecto de baño incluido.',
    true
  ),

  -- Proveedor de mecanismos eléctricos
  (
    'Mecanismos García',
    'Mecanismos y Automatismos García SL', 'B11200016',
    'Raúl García Moreno', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Suministro de mecanismos eléctricos de diseño (Berker, Simon, Legrand Céliane, Jung). Interruptores, enchufes, reguladores y pulsadores. Asesoramiento y gestión de pedidos al arquitecto.',
    true
  ),

  -- Equipamiento de cocina
  (
    'Cocinas de Autor',
    'Cocinas de Autor Madrid SL', 'B11200017',
    'Carlos Vega Lorente', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Cocinas a medida de alta gama (Bulthaup, Siematic, Leicht). Coordinación con fontanero y electricista. Electrodomésticos Miele, Gaggenau y Liebherr. Servicio postventa propio.',
    true
  ),

  -- Equipamiento exterior (pérgolas + barandillas)
  (
    'Terrazas Solana',
    'Terrazas y Espacios Exteriores Solana SL', 'B11200018',
    'Miguel Solana Castro', 'jlorag@hotmail.com', 'jlorag@hotmail.com',
    '+34 697880068', 'Madrid',
    'Pérgolas bioclimáticas de aluminio motorizadas (Renson, Warema), toldos cofre y barandillas de terraza en aluminio, acero y vidrio. Proyecto y montaje incluidos.',
    true
  )

ON CONFLICT DO NOTHING;


-- ── 2. Asignar disciplinas ────────────────────────────────────────────────────

-- Reformas Alcántara → Albañilería + Demolición
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Reformas Alcántara'
  AND d.nombre IN ('Albañilería', 'Demolición y gestión de residuos')
ON CONFLICT DO NOTHING;

-- Construcciones Gil → Albañilería
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Construcciones Gil' AND d.nombre = 'Albañilería'
ON CONFLICT DO NOTHING;

-- Fontanería y Gas Serna → Fontanería + Gas
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Fontanería y Gas Serna'
  AND d.nombre IN ('Fontanería', 'Gas')
ON CONFLICT DO NOTHING;

-- ClimaTec → Climatización + Ventilación
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'ClimaTec Madrid'
  AND d.nombre IN ('Climatización', 'Ventilación')
ON CONFLICT DO NOTHING;

-- Electricidad Castellano → Electricidad
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Electricidad Castellano' AND d.nombre = 'Electricidad'
ON CONFLICT DO NOTHING;

-- TecnoElec → Electricidad
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'TecnoElec' AND d.nombre = 'Electricidad'
ON CONFLICT DO NOTHING;

-- Nórdico Smart Home → Equipamiento domótica + Equipamiento de sonido
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Nórdico Smart Home'
  AND d.nombre IN ('Equipamiento domótica', 'Equipamiento de sonido')
ON CONFLICT DO NOTHING;

-- Carpintería Herrera → Carpintería de madera
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Carpintería Herrera' AND d.nombre = 'Carpintería de madera'
ON CONFLICT DO NOTHING;

-- Ebanistería López → Carpintería de madera
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Ebanistería López' AND d.nombre = 'Carpintería de madera'
ON CONFLICT DO NOTHING;

-- Ventanas y Fachadas Gil → Carpintería exterior + Equipamiento de ventanas
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Ventanas y Fachadas Gil'
  AND d.nombre IN ('Carpintería exterior', 'Equipamiento de ventanas')
ON CONFLICT DO NOTHING;

-- Cristalería Torres → Cerrajería
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Cristalería Torres' AND d.nombre = 'Cerrajería'
ON CONFLICT DO NOTHING;

-- Mármoles Fernández → Mármolista + Proveedor de piedra natural
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Mármoles Fernández'
  AND d.nombre IN ('Mármolista', 'Proveedor de piedra natural')
ON CONFLICT DO NOTHING;

-- Pinturas Blanco → Pintura + Instalador de cornisas
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Pinturas Blanco'
  AND d.nombre IN ('Pintura', 'Instalador de cornisas')
ON CONFLICT DO NOTHING;

-- Revestimientos Prieto → Proveedor de acabados + Instalador de tarima
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Revestimientos Prieto'
  AND d.nombre IN ('Proveedor de acabados', 'Instalador de tarima')
ON CONFLICT DO NOTHING;

-- Luxury Bath Concept → Proveedor de griferías y accesorios
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Luxury Bath Concept' AND d.nombre = 'Proveedor de griferías y accesorios'
ON CONFLICT DO NOTHING;

-- Mecanismos García → Proveedor de mecanismos eléctricos
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Mecanismos García' AND d.nombre = 'Proveedor de mecanismos eléctricos'
ON CONFLICT DO NOTHING;

-- Cocinas de Autor → Equipamiento de cocina
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Cocinas de Autor' AND d.nombre = 'Equipamiento de cocina'
ON CONFLICT DO NOTHING;

-- Terrazas Solana → Equipamiento exterior (pérgolas) + Equipamiento exterior (barandillas)
INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id FROM public.fpe_partners p CROSS JOIN public.fpe_disciplines d
WHERE p.nombre = 'Terrazas Solana'
  AND d.nombre IN ('Equipamiento exterior (pérgolas)', 'Equipamiento exterior (barandillas)')
ON CONFLICT DO NOTHING;

COMMIT;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT
  p.nombre AS partner,
  string_agg(d.nombre, ' · ' ORDER BY d.orden) AS disciplinas
FROM public.fpe_partners p
LEFT JOIN public.fpe_partner_disciplines pd ON pd.partner_id = p.id
LEFT JOIN public.fpe_disciplines d ON d.id = pd.discipline_id
WHERE p.email_contacto = 'jlorag@hotmail.com'
GROUP BY p.nombre ORDER BY p.nombre;
