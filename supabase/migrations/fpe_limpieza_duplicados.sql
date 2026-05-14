-- ============================================================================
-- fpe_limpieza_duplicados.sql
--
-- Limpieza tras la ejecución múltiple del script de carga.
--
-- 1. Borra todas las partidas existentes (y sus links de fase por cascade)
-- 2. Deduplica unidades por (chapter_id, nombre) — deja la más antigua
-- 3. Deduplica disciplinas por nombre — deja la más antigua
-- 4. Re-inserta las 111 partidas del presupuesto Armico
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Borrar todas las partidas (cascade limpia phase_line_items)
-- ---------------------------------------------------------------------------

DELETE FROM public.fpe_template_line_items;

-- ---------------------------------------------------------------------------
-- 2. Deduplicar unidades — deja la más antigua de cada (chapter_id, nombre)
-- ---------------------------------------------------------------------------

DELETE FROM public.fpe_template_units u
WHERE u.id NOT IN (
  SELECT DISTINCT ON (chapter_id, nombre) id
  FROM public.fpe_template_units
  ORDER BY chapter_id, nombre, created_at, id
);

-- ---------------------------------------------------------------------------
-- 3. Deduplicar disciplinas — deja la más antigua de cada nombre
-- ---------------------------------------------------------------------------

DELETE FROM public.fpe_disciplines d
WHERE d.id NOT IN (
  SELECT DISTINCT ON (nombre) id
  FROM public.fpe_disciplines
  ORDER BY nombre, created_at, id
);

-- ---------------------------------------------------------------------------
-- 4. Re-insertar las 111 partidas con sus fases (mismo CTE chain de la migración)
-- ---------------------------------------------------------------------------

WITH partidas_data (chapter_orden, unit_nombre, partida_orden, partida_nombre, descripcion, unidad_medida, disciplina, fases) AS (
VALUES

-- ── CAP 10: DEMOLICIONES Y TRABAJOS PREVIOS ─────────────────────────────────
(10, 'Tabiquería', 5,  'Catas en patinillos', 'Catas exploratorias en patinillos para identificar instalaciones existentes. Retirada a contenedor.', 'ud', 'Demolición y gestión de residuos', ARRAY['Preparación y protecciones']),
(10, 'Tabiquería', 10, 'Apertura de hueco en muro de carga', 'Apertura de hueco. Retirada a contenedor. Medida 190cm de hueco libre.', 'ud', 'Demolición y gestión de residuos', ARRAY['Demolición y vaciado']),
(10, 'Pavimentos y revestimientos', 5,  'Levantado de moqueta', 'Retirada a contenedor.', 'ud', 'Demolición y gestión de residuos', ARRAY['Demolición y vaciado']),
(10, 'Pavimentos y revestimientos', 10, 'Levantado de solado de azulejo', 'De baños y cocina, retirada a contenedor.', 'm2', 'Demolición y gestión de residuos', ARRAY['Demolición y vaciado']),
(10, 'Pavimentos y revestimientos', 15, 'Levantado de solado de tarima de madera', 'Retirada a contenedor.', 'm2', 'Demolición y gestión de residuos', ARRAY['Demolición y vaciado']),
(10, 'Pavimentos y revestimientos', 20, 'Levantado de base de mortero', 'Cemento y/o arena hasta forjado existente. Retirada a contenedor.', 'm2', 'Demolición y gestión de residuos', ARRAY['Demolición y vaciado']),
(10, 'Ventanas', 25, 'Desmontaje de ventanales y persianas', 'Ventanas, persianas y cajones de persianas. Retirada a contenedor.', 'ud', 'Demolición y gestión de residuos', ARRAY['Demolición y vaciado']),

-- ── CAP 20: REFUERZOS ESTRUCTURALES ─────────────────────────────────────────
(20, 'Refuerzos estructurales', 5,  'Estudio técnico de estructurista', 'Para realización de apertura de muro de carga.', 'ud', 'Albañilería', ARRAY['Proyecto técnico y permisos']),
(20, 'Refuerzos estructurales', 20, 'Refuerzo de hierro para puerta corredera', 'Anclada a forjado, rail de techo y doblado de tabiquería para puertas correderas P03 en cocina.', 'ud', 'Albañilería', ARRAY['Ejecución']),

-- ── CAP 30: ALBAÑILERÍA ─────────────────────────────────────────────────────
(30, 'Soleras y rellenos', 5,    'Solera de mortero hasta 10cm', 'Como base de pavimento en todo el interior de la vivienda.', 'm2', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Soleras y rellenos', 10,   'Suplemento lámina de plástico bajo solera', 'Para evitar filtraciones al piso inferior.', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Tabiquería', 5,            'Adaptación de huecos de fachada', 'Para nuevas dimensiones de ventanas en Dormitorio Master.', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Tabiquería', 10,           'Tabique de pladur', 'Placa doble (hidrófuga en zonas húmedas) y aislamiento de lana de roca. H=3,05m.', 'm2', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas', 'Segunda cara de pladur / Cierre de rozas']),
(30, 'Tabiquería', 15,           'Mocheta de pladur para cuadro de luz', 'Para alojar el cuadro de luz.', 'ud', 'Albañilería', ARRAY['Segunda cara de pladur / Cierre de rozas']),
(30, 'Tabiquería', 20,           'Doblado de tabique para sanitrit', 'En aseo, incluye registro detrás de cisterna.', 'ud', 'Albañilería', ARRAY['Segunda cara de pladur / Cierre de rozas']),
(30, 'Trasdosados', 5,           'Trasdosado de pladur', 'En muros perimetrales que lindan con vecinos. Para alojar instalaciones y aislamiento acústico. H=3,05m.', 'm2', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas', 'Segunda cara de pladur / Cierre de rozas']),
(30, 'Trasdosados', 10,          'Aislamiento acústico Copropen', 'En trasdosados de pladur de paredes que lindan con vecinos.', 'm2', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Techos', 5,                'Falso techo de pladur en zonas secas', 'Para alojar instalaciones e iluminación.', 'm2', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas', 'Cierre de falsos techos']),
(30, 'Techos', 10,               'Falso techo de pladur WA en cuartos húmedos', 'Hidrófugo, para alojar instalaciones e iluminación.', 'm2', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas', 'Cierre de falsos techos']),
(30, 'Techos', 15,               'Registro en falsos techos', 'Para acceso a instalaciones.', 'ud', 'Albañilería', ARRAY['Cierre de falsos techos']),
(30, 'Techos', 20,               'Tabicas de falso techo', 'Por cambio de altura. H=0,20m.', 'ml', 'Albañilería', ARRAY['Cierre de falsos techos']),
(30, 'Molduras y foseados', 5,   'Cortinero en falsos techos', 'Ancho 15cm en salón-comedor para alojar retornos de aire acondicionado.', 'ml', 'Albañilería', ARRAY['Cierre de falsos techos']),
(30, 'Molduras y foseados', 10,  'Foseados en falsos techos', 'Ancho 10cm en baños y aseo para alojar tiras LED ocultas.', 'ml', 'Albañilería', ARRAY['Cierre de falsos techos']),
(30, 'Molduras y foseados', 15,  'Molduras de 4cm en falsos techos', 'En salón-comedor.', 'ml', 'Albañilería', ARRAY['Cierre de falsos techos']),
(30, 'Molduras y foseados', 20,  'Recuperación e instalación de molduras de salón', 'Recuperación de molduras existentes y reinstalación.', 'ud', 'Albañilería', ARRAY['Cierre de falsos techos', 'Lijado, remates y ajustes']),
(30, 'Ayudas de albañilería', 5,    'Remates perimetrales de ventanas', 'Ventanas y ventanales por el exterior.', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Ayudas de albañilería', 10,   'Vierteaguas cerámicos', 'Como alfeizar de ventanas iguales al resto de la comunidad.', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Ayudas de albañilería', 15,   'Mochetas para bajantes', 'Más aislamiento.', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Ayudas de albañilería', 20,   'Suministro y recibido de precerco P02', 'Para puerta abatible de paso de una hoja de 270cm de altura y 88cm de ancho.', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Ayudas de albañilería', 25,   'Suministro y recibido de precercos P04', 'Para 5 puertas abatibles de paso de una hoja estándar 203cm x 72cm.', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Ayudas de albañilería', 30,   'Refuerzo en paredes para muebles de baño volados', 'Por tabiquería de pladur.', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Ayudas de albañilería', 35,   'Ayuda de albañilería a fontanería', '', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Ayudas de albañilería', 40,   'Ayuda de albañilería a electricidad', '', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Ayudas de albañilería', 45,   'Ayuda de albañilería a calefacción', '', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Ayudas de albañilería', 50,   'Ayudas para trabajos en patios o azotea', 'Descuelgue de operario, trabajos en cubiertas inclinadas para instalación de máquinas.', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Ayudas de albañilería', 55,   'Rozas y calos en muros o fachada para AA', 'Para instalación de aire acondicionado.', 'ud', 'Albañilería', ARRAY['Perfileria y primera placa de pladur / Fabricas de ceramica + rozas']),
(30, 'Enlucidos y revoques', 5,  'Aplicación de enlucido de yeso', 'Sobre muros perimetrales, muros de carga y paredes trasdosadas no alicatadas. Incluye vendas y guardavivos. H=3,05m.', 'm2', 'Albañilería', ARRAY['Tratamiento de juntas (Emplaste y encintado)']),

-- ── CAP 40: CARPINTERÍA METÁLICA Y VIDRIERÍA ────────────────────────────────
(40, 'Carpinterías metálicas y PVC', 5,  'V.01 Ventana oscilo-batiente 2 hojas PVC imitación madera', 'Cocina. 1330x1890. Vidrio Guardian Select 4/24/Climaguard Premium de 4, acabado bicolor.', 'ud', 'Carpintería exterior', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje']),
(40, 'Carpinterías metálicas y PVC', 10, 'V.02-V.03 Ventana oscilo-batiente 2 hojas PVC imitación madera', 'Salón-Comedor. 1130x1950. Vidrio Guardian Select 4/24/Climaguard Premium.', 'ud', 'Carpintería exterior', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje']),
(40, 'Carpinterías metálicas y PVC', 15, 'V.04 Ventana oscilo-batiente 1 hoja Thermofibra Elegant Infinity', 'Dormitorio 1. 820x1520. Acabado lacado blanco.', 'ud', 'Carpintería exterior', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje']),
(40, 'Carpinterías metálicas y PVC', 20, 'V.05 Ventana oscilo-batiente 1 hoja Thermofibra Elegant Infinity', 'Baño 1. 810x1450. Acabado lacado blanco.', 'ud', 'Carpintería exterior', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje']),
(40, 'Carpinterías metálicas y PVC', 25, 'V.06 Ventana oscilo-batiente 1 hoja Thermofibra Elegant Infinity', 'Baño Master. 880x1520. Acabado lacado blanco.', 'ud', 'Carpintería exterior', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje']),
(40, 'Carpinterías metálicas y PVC', 30, 'V.07 Ventana oscilo-batiente 1 hoja Thermofibra Elegant Infinity', 'Baño Master. 560x1050. Acabado lacado blanco.', 'ud', 'Carpintería exterior', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje']),
(40, 'Carpinterías metálicas y PVC', 35, 'V.08 Ventanal oscilo-batiente 2 hojas Thermofibra Elegant Infinity', 'Dormitorio Master. 890x2500. Zona superior y fijo en zona inferior. Lacado blanco.', 'ud', 'Carpintería exterior', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje']),
(40, 'Carpinterías metálicas y PVC', 40, 'V.09 Ventana oscilo-batiente 2 hojas Thermofibra Elegant Infinity', 'Dormitorio Master. 840x1550. Lacado blanco.', 'ud', 'Carpintería exterior', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje']),
(40, 'Carpinterías metálicas y PVC', 45, 'Instalación de ventanas, ventanales y cajones de persianas', 'Mano de obra de instalación.', 'ud', 'Carpintería exterior', ARRAY['Montaje']),
(40, 'Carpinterías metálicas y PVC', 50, 'Vidrio polarizado en vidrios de fachada', 'Tratamiento por petición de propiedad.', 'ud', 'Carpintería exterior', ARRAY['Fabricación', 'Montaje']),
(40, 'Persianas', 5,  'Suplemento motorización persianas por pulsador', 'Motorización con pulsador.', 'ud', 'Equipamiento de ventanas', ARRAY['Fabricación', 'Montaje']),
(40, 'Mamparas', 5,   'MP.01 Mampara baño 1', 'Para plato de ducha. Fijo + puerta corredera. Vidrio transparente. Herrajes acero inox. 185x205.', 'ud', 'Cerrajería', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje']),
(40, 'Mamparas', 10,  'MP.02 Mampara baño Master', 'Para plato de ducha. Fijo + puerta corredera. Vidrio transparente. Herrajes acero inox. 163x205.', 'ud', 'Cerrajería', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje']),
(40, 'Espejos', 5,    'Espejo retroiluminado', 'En baños.', 'ud', 'Cerrajería', ARRAY['Medidas y proyecto', 'Montaje']),

-- ── CAP 50: CARPINTERÍA DE MADERA ───────────────────────────────────────────
(50, 'Puertas de acceso a vivienda', 5, 'P.01 Plafón de puerta principal', '0.7cm de grosor, madera lacada. Cambio de mirilla, tuerca interior y manivela.', 'ud', 'Carpintería de madera', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje e instalación']),
(50, 'Puertas de paso', 5,  'P.04 Puerta de paso una hoja abatible', 'Estándar 203cm de altura, madera lacada lisa, ciega, molduras, herrajes y manivela.', 'ud', 'Carpintería de madera', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje e instalación']),
(50, 'Puertas de paso', 10, 'P.03-V2 Puerta de paso 2 hojas correderas', 'Hasta 290cm de altura, suelo a techo, con junquillo y acristalamiento.', 'ud', 'Carpintería de madera', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje e instalación']),
(50, 'Armarios a medida', 5,   'M-01 Mueble en Hall', '2 hojas abatibles, AGLOM19 hidrofugado. Interior aglomerado, balda intermedia melamina. 112x35x90.', 'ud', 'Carpintería de madera', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje e instalación']),
(50, 'Armarios a medida', 10,  'M-02 Armario Gabanero', '2 hojas abatibles, AGLOM19 hidrofugado. Maletero, zapatero, barras y baldas. 131x66x270.', 'ud', 'Carpintería de madera', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje e instalación']),
(50, 'Armarios a medida', 15,  'M-03 Armario Dormitorio 1', '6 hojas abatibles, AGLOM19 hidrofugado. Maletero, zapatero, barras y baldas. 287x60x290.', 'ud', 'Carpintería de madera', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje e instalación']),
(50, 'Armarios a medida', 20,  'M-04 Armario Closet Master', '4 hojas abatibles + panelado fijo, AGLOM19 hidrofugado. Maletero, zapatero, barras y baldas. 250x60x270.', 'ud', 'Carpintería de madera', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje e instalación']),
(50, 'Armarios a medida', 25,  'M-05 Armario para caldera Baño Master', '2 hojas abatibles, AGLOM19 hidrofugado. 89x55x160.', 'ud', 'Carpintería de madera', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje e instalación']),
(50, 'Armarios a medida', 30,  'M-06 Armario Dormitorio Master', '6 hojas abatibles (4+2), AGLOM19 hidrofugado. Maletero, zapatero, barras y baldas. 449x60x290.', 'ud', 'Carpintería de madera', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje e instalación']),
(50, 'Mueble de baño', 5,    'MB.01-MB.02 Mueble de baño con lavabo Baño 1 y Aseo', 'Conjunto integrado con lavabo de un seno. 80cm. Marca Sklum o similar.', 'ud', 'Carpintería de madera', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje e instalación']),
(50, 'Mueble de baño', 10,   'MB.03 Mueble de baño con lavabo Baño Master', 'Conjunto integrado con lavabo. 150cm. Marca Sklum o similar.', 'ud', 'Carpintería de madera', ARRAY['Medidas y proyecto', 'Fabricación', 'Montaje e instalación']),
(50, 'Panelados', 5,    'Embocadura y remates en hueco de entrada a cocina', 'Sustituye a P.02.', 'ud', 'Carpintería de madera', ARRAY['Fabricación', 'Montaje e instalación']),
(50, 'Panelados', 10,   'Moldura en pared', '', 'ml', 'Carpintería de madera', ARRAY['Fabricación', 'Montaje e instalación']),
(50, 'Rodapiés y guardapolvos', 5, 'Rodapié liso de DM hidrofugado', 'Color lacado igual a paredes. H=0,20m. Con moldura.', 'ml', 'Carpintería de madera', ARRAY['Fabricación', 'Montaje e instalación']),

-- ── CAP 60: INSTALACIONES - FONTANERÍA Y SANEAMIENTO ────────────────────────
(60, 'Equipos', 5,  'Suministro e instalación de contadores de agua', '', 'ud', 'Fontanería', ARRAY['Preinstalación de fontanería y saneamiento']),
(60, 'Equipos', 10, 'Suministro e instalación de Sanitrit', 'En aseo y cocina.', 'ud', 'Fontanería', ARRAY['Preinstalación de fontanería y saneamiento', 'Montaje de sanitarios y griferías']),
(60, 'Red de saneamiento', 5, 'Suministro e instalación de bajantes de PVC', '', 'ud', 'Fontanería', ARRAY['Preinstalación de fontanería y saneamiento']),
(60, 'Mano de obra e instalación', 5,  'Instalación de fontanería y saneamiento completa', 'Para 2 baños (2 duchas, 3 lavabos, 2 inodoros), 1 aseo (1 lavabo, 1 inodoro) y 1 cocina (fregadero, lavavajillas, lavadora-secadora). Desagües de máquina de AA. Llaves de corte por estancia.', 'ud', 'Fontanería', ARRAY['Preinstalación de fontanería y saneamiento', 'Revisión antes de cierre', 'Platos de ducha, bañeras e impermeabilización asociada', 'Montaje de sanitarios y griferías']),
(60, 'Mano de obra e instalación', 10, 'Instalación de aparatos sanitarios', 'Lavabos e inodoros (suministro va en EQUIPAMIENTO).', 'ud', 'Fontanería', ARRAY['Montaje de sanitarios y griferías']),

-- ── CAP 70: INSTALACIONES - GAS ─────────────────────────────────────────────
(70, 'Gas', 5, 'Instalación de gas desde acometida a caldera', 'Individual, dictamen oficial por técnico autorizado.', 'ud', 'Gas', ARRAY['Instalación de red', 'Legalización y puesta en marcha']),

-- ── CAP 80: INSTALACIONES - CLIMATIZACIÓN A/C ───────────────────────────────
(80, 'Material y distribución', 5, 'Recibido de rejillas de impulsión y retorno', '', 'ud', 'Climatización', ARRAY['Instalación de rejillas, difusores y termostatos - Puesta en marcha y regulación']),
(80, 'Mano de obra e instalación', 5, 'Instalación de A/A por conductos y fan coil', 'Según planimetría.', 'ud', 'Climatización', ARRAY['Replanteo de climatización', 'Preinstalación de líneas frigoríficas, condensados y control', 'Instalación de unidades interiores, conductos y retornos', 'Instalación de unidad exterior', 'Instalación de rejillas, difusores y termostatos - Puesta en marcha y regulación']),

-- ── CAP 81: CALEFACCIÓN INDIVIDUAL ──────────────────────────────────────────
(81, 'Equipo de generación', 5, 'Caldera estanca de gas', 'Para uso de agua caliente sanitaria y calefacción.', 'ud', 'Climatización', ARRAY['Instalación de emisores y equipo generador: radiadores, toalleros o suelo radiante', 'Llenado, purgado y puesta en marcha']),
(81, 'Equipo emisor', 5,  'Radiador reversible 70cm Baxi', '60 entre ejes. Hall=7, Cocina=15, Comedor=10, Salón=10, Dorm.1=12, Dorm.Master=12, Closet Master=7.', 'ud', 'Climatización', ARRAY['Instalación de emisores y equipo generador: radiadores, toalleros o suelo radiante']),
(81, 'Equipo emisor', 10, 'Radiador toallero eléctrico', 'Color blanco.', 'ud', 'Climatización', ARRAY['Instalación de emisores y equipo generador: radiadores, toalleros o suelo radiante']),
(81, 'Material y distribución', 5,  'Nueva instalación de tramos de tubería', 'Desde caldera o columnas comunitarias a radiadores.', 'ud', 'Climatización', ARRAY['Preinstalación de tuberías de calefacción - Instalación de colectores, llaves de corte y elementos de regulación']),
(81, 'Material y distribución', 10, 'Soportes, tomas, llaves y detentores', '', 'ud', 'Climatización', ARRAY['Preinstalación de tuberías de calefacción - Instalación de colectores, llaves de corte y elementos de regulación']),

-- ── CAP 90: VENTILACIÓN ─────────────────────────────────────────────────────
(90, 'Equipos', 5, 'Sistema de extracción en cuartos húmedos', 'En aseo y baños sin ventanas. Mediante extractor, conductos y bocas de extracción.', 'ud', 'Ventilación', ARRAY['Instalación de equipos, extractores, recuperador y accesorios técnicos', 'Puesta en marcha, equilibrado de caudales y remates']),

-- ── CAP 100: ELECTRICIDAD ───────────────────────────────────────────────────
(100, 'Iluminación', 5, 'Iluminación según plano de iluminación', 'Partida alzada de iluminación.', 'ud', 'Electricidad', ARRAY['Replanteo eléctrico y definición de puntos', 'Preinstalación de canalizaciones, cableado base y cuadro', 'Instalación de mecanismos finales, luminarias y equipos']),
(100, 'Mano de obra e instalación', 5, 'Electricidad según plano de electricidad', 'Partida alzada de electricidad.', 'ud', 'Electricidad', ARRAY['Instalación de cuadro de obra + iluminación de obra', 'Replanteo eléctrico y definición de puntos', 'Preinstalación de canalizaciones, cableado base y cuadro', 'Montaje de cuadro, mecanismos base y conexiones principales', 'Instalación de mecanismos finales, luminarias y equipos', 'Puesta en marcha - Pruebas, legalización y remates']),

-- ── CAP 140: PINTURAS Y REVESTIMIENTOS SUPERFICIALES ────────────────────────
(140, 'Pintura', 5,  'Picado de paredes perimetrales y muros de carga', 'Para posterior aplicación de enlucido de yeso. H=3,05m.', 'm2', 'Pintura', ARRAY['Preparación de superficies (lijados, bandas, protección)']),
(140, 'Pintura', 10, 'Aplicación de capa de emplaste sobre enlucido', 'Para preparar paredes para pintado. H=3,05m.', 'm2', 'Pintura', ARRAY['Preparación de superficies (lijados, bandas, protección)', 'Ejecución de bases: Primera mano de pintura post enfoscados, nivelaciones e imprimaciones']),
(140, 'Pintura', 15, 'Pintura plástica de primera calidad', 'Sobre paredes (317,66 m²) y techos (86,22 m²) de toda la vivienda. Hidrófuga en zonas húmedas. Color blanco.', 'm2', 'Pintura', ARRAY['Pintura y capas principales']),
(140, 'Pintura', 20, 'Restauración, lijado y pintado de barandillas metálicas', 'De balconeras. En color, con pintura al esmalte.', 'ud', 'Pintura', ARRAY['Pintura y capas principales', 'Acabados finos, instalacion de papeles tapiz, remates y protección final']),
(140, 'Pintura', 25, 'Lijado, emplastecido y pintado de puerta de entrada', 'Por el exterior. Color igual a existente en comunidad.', 'ud', 'Pintura', ARRAY['Pintura y capas principales', 'Acabados finos, instalacion de papeles tapiz, remates y protección final']),

-- ── CAP 145: ACABADOS ───────────────────────────────────────────────────────
(145, 'Pavimentos cerámicos y porcelánicos', 5,  'Instalación de solado porcelánico 60x120', 'Material no incluido. Suelos de baños y aseo.', 'm2', 'Solador y alicatador', ARRAY['Colocación de pavimentos, solados y alicatados: madera, cerámicos, piedra']),
(145, 'Pavimentos cerámicos y porcelánicos', 10, 'Material de solado porcelánico baños y aseo', 'Formato 60x120. 15% desperdicio.', 'm2', 'Proveedor de acabados', ARRAY['Colocación de pavimentos, solados y alicatados: madera, cerámicos, piedra']),
(145, 'Revestimientos cerámicos y porcelánicos', 5,  'Instalación de revestimiento porcelánico 60x120', 'Material no incluido. Paredes de baños. H=2,70m.', 'm2', 'Solador y alicatador', ARRAY['Colocación de pavimentos, solados y alicatados: madera, cerámicos, piedra']),
(145, 'Revestimientos cerámicos y porcelánicos', 10, 'Material de revestimiento porcelánico paredes', 'Formato 60x120. 15% desperdicio.', 'm2', 'Proveedor de acabados', ARRAY['Colocación de pavimentos, solados y alicatados: madera, cerámicos, piedra']),
(145, 'Pavimentos de madera y laminados', 5,  'Suministro de tarima laminada AC-4', 'Marca, color y modelo a definir. 15% desperdicio.', 'm2', 'Carpintería de madera', ARRAY['Colocación de pavimentos, solados y alicatados: madera, cerámicos, piedra']),
(145, 'Pavimentos de madera y laminados', 10, 'Instalación de tarima laminada AC-4', '', 'm2', 'Carpintería de madera', ARRAY['Colocación de pavimentos, solados y alicatados: madera, cerámicos, piedra']),
(145, 'Pavimentos de madera y laminados', 15, 'Mortero autonivelante', 'Donde se instala solado de madera. Preparación del soporte.', 'm2', 'Albañilería', ARRAY['Preparación de soporte y nivelaciones']),
(145, 'Pavimentos de madera y laminados', 20, 'Manta de base bajo solado de madera', 'Acústica e hidrófuga.', 'ud', 'Carpintería de madera', ARRAY['Preparación de soporte y nivelaciones']),
(145, 'Pavimentos de madera y laminados', 25, 'Juntas de cambio de solado', 'Según indicaciones.', 'ml', 'Carpintería de madera', ARRAY['Remates, juntas y protección final']),

-- ── CAP 150: EQUIPAMIENTO ───────────────────────────────────────────────────
(150, 'Sanitarios', 5,  'Inodoros Roca modelo Gap Square blanco', 'Anclado a suelo, cisterna vista, Rimless con asiento amortiguado.', 'ud', 'Proveedor de griferías y accesorios', ARRAY['Definición, medición y pedido de equipamiento', 'Recepción, control y acopio en obra', 'Instalación de sanitarios, griferías y accesorios']),
(150, 'Sanitarios', 10, 'Plato de ducha de resina Baño Master', '1,00x1,60. Marca a determinar.', 'ud', 'Proveedor de griferías y accesorios', ARRAY['Definición, medición y pedido de equipamiento', 'Recepción, control y acopio en obra', 'Preinstalación de elementos empotrados', 'Instalación de sanitarios, griferías y accesorios']),
(150, 'Sanitarios', 15, 'Plato de ducha de resina Baño 1', '0,95x1,85. Marca a determinar.', 'ud', 'Proveedor de griferías y accesorios', ARRAY['Definición, medición y pedido de equipamiento', 'Recepción, control y acopio en obra', 'Preinstalación de elementos empotrados', 'Instalación de sanitarios, griferías y accesorios']),
(150, 'Griferías y accesorios', 5,  'Griferías para lavabos', 'Marca Sklum o similar.', 'ud', 'Proveedor de griferías y accesorios', ARRAY['Definición, medición y pedido de equipamiento', 'Recepción, control y acopio en obra', 'Instalación de sanitarios, griferías y accesorios']),
(150, 'Griferías y accesorios', 10, 'Válvulas para lavabos', 'Marca Sklum o similar.', 'ud', 'Proveedor de griferías y accesorios', ARRAY['Recepción, control y acopio en obra', 'Instalación de sanitarios, griferías y accesorios']),
(150, 'Griferías y accesorios', 15, 'Griferías para duchas mano termostática con rociador', 'Marca Sklum o similar.', 'ud', 'Proveedor de griferías y accesorios', ARRAY['Definición, medición y pedido de equipamiento', 'Recepción, control y acopio en obra', 'Instalación de sanitarios, griferías y accesorios']),
(150, 'Griferías y accesorios', 20, 'Colocación de accesorios de baños y aseos', 'Toalleros, portarrollos (no incluidos).', 'ud', 'Proveedor de griferías y accesorios', ARRAY['Instalación de sanitarios, griferías y accesorios', 'Pruebas, ajustes y remates finales']),

-- ── CAP 160: COCINA ─────────────────────────────────────────────────────────
(160, 'Mobiliario de cocina', 5, 'Suministro de muebles de cocina', 'Sistema cajón antigolpeo. Encimera y frente. Según diseño planteado.', 'ud', 'Equipamiento de cocina', ARRAY['Definición técnica, medición y pedido de cocina', 'Fabriación']),
(160, 'Encimera, aplacado y fregadero', 5, 'Montaje de muebles, electrodomésticos, encimera y accesorios', 'Suministro e instalación de encimera, extras y accesorios.', 'ud', 'Equipamiento de cocina', ARRAY['Montaje de mobiliario, encimeras y electrodomésticos', 'Conexiones, ajustes y remates finales']),
(160, 'Electrodomésticos', 5, 'Suministro de electrodomésticos BALAY', 'Frigorífico combi NO FROST 3KID834F, Horno 3HB5131N3, Microondas 3CG5172N2, Lavavajillas 3VF5012NP, Placa inducción con extractor 3EBC983ER, Kit instalación extractor con filtros, Lavadora 3TS384BT, Secadora bomba calor 3SB581B, Kit unión columna.', 'ud', 'Equipamiento de cocina', ARRAY['Definición técnica, medición y pedido de cocina']),

-- ── CAP 180: VARIOS ─────────────────────────────────────────────────────────
(180, 'Varios', 5,  'Protecciones y limpiezas de tajos', 'Protecciones de ascensor, suelos y escalera de comunidad. Limpieza durante obra y final de obra.', 'ud', 'Albañilería', ARRAY['Ejecución']),
(180, 'Varios', 10, 'Contenedores de escombro', 'En vía pública a pie de obra.', 'ud', 'Demolición y gestión de residuos', ARRAY['Ejecución']),
(180, 'Varios', 15, 'Gestión de licencia de obra', '', 'ud', 'Albañilería', ARRAY['Ejecución']),
(180, 'Varios', 20, 'Tasas e impuestos de licencia de obras', '', 'ud', 'Albañilería', ARRAY['Ejecución']),
(180, 'Varios', 25, 'Imprevistos en la ejecución de las obras', '', 'ud', 'Albañilería', ARRAY['Ejecución']),
(180, 'Varios', 30, 'Seguridad y Salud', '', 'ud', 'Albañilería', ARRAY['Ejecución'])
),

inserted_line_items AS (
  INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, discipline_id)
  SELECT
    u.id,
    pd.partida_nombre,
    NULLIF(pd.descripcion, ''),
    pd.unidad_medida,
    pd.partida_orden,
    d.id
  FROM partidas_data pd
  JOIN public.fpe_template_chapters c ON c.orden = pd.chapter_orden
  JOIN public.fpe_template_units u ON u.chapter_id = c.id AND u.nombre = pd.unit_nombre
  LEFT JOIN public.fpe_disciplines d ON d.nombre = pd.disciplina
  RETURNING id, unit_id, nombre
),

mapped_partidas AS (
  SELECT ili.id AS line_item_id, c.id AS chapter_id, pd.fases
  FROM inserted_line_items ili
  JOIN public.fpe_template_units u ON u.id = ili.unit_id
  JOIN public.fpe_template_chapters c ON c.id = u.chapter_id
  JOIN partidas_data pd
    ON pd.partida_nombre = ili.nombre
   AND pd.chapter_orden  = c.orden
   AND pd.unit_nombre    = u.nombre
),

unique_phases AS (
  SELECT DISTINCT ON (chapter_id, nombre) id, chapter_id, nombre
  FROM public.fpe_template_phases
  ORDER BY chapter_id, nombre, id
)

INSERT INTO public.fpe_template_phase_line_items (phase_id, line_item_id)
SELECT DISTINCT up.id, mp.line_item_id
FROM mapped_partidas mp
CROSS JOIN LATERAL unnest(mp.fases) AS fase_nombre
JOIN unique_phases up ON up.chapter_id = mp.chapter_id AND up.nombre = fase_nombre;

NOTIFY pgrst, 'reload schema';

COMMIT;
