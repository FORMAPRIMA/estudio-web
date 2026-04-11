-- ══════════════════════════════════════════════════════════════════════════════
-- FPE Template Seed — Datos de plantilla de ejemplo
--
-- Estructura completa de una reforma integral de alta gama:
--   5 Capítulos → 11 Unidades de Ejecución
--   Por cada UE: partidas con unidades de medida + fases con lead times
--
-- INSTRUCCIONES: Supabase Dashboard → SQL Editor → Ejecutar
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- Capítulos
  ch1 uuid; ch2 uuid; ch3 uuid; ch4 uuid; ch5 uuid;

  -- Unidades de Ejecución
  u_demol   uuid;  -- 1.1 Demolición y Vaciado
  u_pladur  uuid;  -- 1.2 Tabiquería y Trasdosados
  u_elect   uuid;  -- 2.1 Instalación Eléctrica y Domótica
  u_font    uuid;  -- 2.2 Fontanería y Saneamiento
  u_clima   uuid;  -- 2.3 Climatización y Ventilación
  u_pavim   uuid;  -- 3.1 Pavimentos
  u_revis   uuid;  -- 3.2 Revestimientos
  u_carp    uuid;  -- 4.1 Carpintería de Obra a Medida
  u_puertas uuid;  -- 4.2 Puertas Interiores
  u_pintura uuid;  -- 5.1 Pintura y Acabados
  u_banio   uuid;  -- 5.2 Sanitarios y Equipamiento de Baño

BEGIN

-- ═══════════════════════════════════════════════════════════════════════════
-- CAPÍTULOS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_chapters (nombre, descripcion, orden, activo)
  VALUES ('Demolición y Obra Seca',
          'Derribo de elementos existentes, levantado de solados y tabiquería, y construcción de nueva partición interior.',
          1, true)
  RETURNING id INTO ch1;

INSERT INTO public.fpe_template_chapters (nombre, descripcion, orden, activo)
  VALUES ('Instalaciones',
          'Electricidad, fontanería, saneamiento, climatización y ventilación mecánica.',
          2, true)
  RETURNING id INTO ch2;

INSERT INTO public.fpe_template_chapters (nombre, descripcion, orden, activo)
  VALUES ('Pavimentos y Revestimientos',
          'Colocación de solados en suelo y revestimientos en paredes y techos.',
          3, true)
  RETURNING id INTO ch3;

INSERT INTO public.fpe_template_chapters (nombre, descripcion, orden, activo)
  VALUES ('Carpintería',
          'Carpintería de obra a medida (armarios, panelados, vestidores) y puertas interiores.',
          4, true)
  RETURNING id INTO ch4;

INSERT INTO public.fpe_template_chapters (nombre, descripcion, orden, activo)
  VALUES ('Acabados Finales',
          'Pintura, acabados decorativos y equipamiento de baños y aseos.',
          5, true)
  RETURNING id INTO ch5;


-- ═══════════════════════════════════════════════════════════════════════════
-- CAPÍTULO 1 — Demolición y Obra Seca
-- ═══════════════════════════════════════════════════════════════════════════

-- ── UE 1.1: Demolición y Vaciado ──────────────────────────────────────────

INSERT INTO public.fpe_template_units (chapter_id, nombre, descripcion, orden, activo)
  VALUES (ch1,
          'Demolición y Vaciado',
          'Derribo de tabiques, levantado de solados y revestimientos existentes, y retirada de escombros a vertedero autorizado.',
          1, true)
  RETURNING id INTO u_demol;

-- Partidas
INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo) VALUES
  (u_demol, 'Derribo de tabique de ladrillo o bloque',
   'Derribo manual o mecánico de tabique de fábrica de ladrillo hueco o bloque de hormigón, incluido apilado y carga de escombros.',
   'm²', 1, true),
  (u_demol, 'Levantado de pavimento y solera',
   'Levantado y retirada del pavimento existente (cerámica, mármol, parquet, etc.) incluyendo capa de mortero. Hasta 5 cm de grosor.',
   'm²', 2, true),
  (u_demol, 'Demolición de revestimiento en paredes',
   'Picado y retirada de alicatado o revestimiento cerámico en paredes, incluyendo capa de adhesivo.',
   'm²', 3, true),
  (u_demol, 'Levantado de puerta, marco y precerco',
   'Levantado completo de hoja de puerta, marco y precerco de madera o metálico, con reparación parcial del hueco.',
   'ud', 4, true),
  (u_demol, 'Arranque de instalación eléctrica aparente o empotrada',
   'Desmontaje de puntos de luz, enchufes, canaletas, cajas y cableado existente para liberación de paramentos.',
   'ud', 5, true),
  (u_demol, 'Retirada de escombros a vertedero autorizado',
   'Carga, transporte y vertido de escombros en planta de gestión de residuos autorizada. Incluye canon de vertido.',
   'm³', 6, true),
  (u_demol, 'Protección de elementos a conservar',
   'Protección y precintado de suelos, carpinterías, instalaciones y mobiliario existentes que no sean objeto de obra.',
   'm²', 7, true);

-- Fases
INSERT INTO public.fpe_template_phases (unit_id, nombre, descripcion, orden, lead_time_days) VALUES
  (u_demol, 'Protecciones y preparación del espacio',
   'Instalación de lonas de protección, apuntalamientos puntuales y señalización de zona de obra.',
   1, 1),
  (u_demol, 'Demolición de elementos',
   'Derribo de tabiques, levantado de solados y revestimientos según alcance del proyecto.',
   2, 3),
  (u_demol, 'Retirada de escombros y limpieza',
   'Carga y transporte de escombros al exterior, limpieza general y entrega de espacio limpio.',
   3, 1);


-- ── UE 1.2: Tabiquería y Trasdosados ──────────────────────────────────────

INSERT INTO public.fpe_template_units (chapter_id, nombre, descripcion, orden, activo)
  VALUES (ch1,
          'Tabiquería y Trasdosados',
          'Construcción de tabiques, trasdosados sobre muro y falsos techos con sistema de placa de yeso laminado (pladur / drywall).',
          2, true)
  RETURNING id INTO u_pladur;

-- Partidas
INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo) VALUES
  (u_pladur, 'Tabique de pladur simple — 75/48 (una placa por lado)',
   'Tabique 75mm con estructura de montantes M-48 y doble placa de yeso laminado estándar 13mm por cara. Sin aislamiento.',
   'm²', 1, true),
  (u_pladur, 'Tabique de pladur doble con aislamiento acústico — 100/48',
   'Tabique 100mm con montantes M-48, doble placa 13mm por cara y lana mineral 40mm de relleno. Rw ≥ 48 dB.',
   'm²', 2, true),
  (u_pladur, 'Trasdosado autoportante sobre muro existente',
   'Trasdosado con estructura metálica separada 5 cm del muro, placa estándar 13mm y lana mineral 40mm.',
   'm²', 3, true),
  (u_pladur, 'Falso techo continuo de pladur',
   'Falso techo desmontable con estructura de perfilería vista o continua con placa de yeso 13mm.',
   'm²', 4, true),
  (u_pladur, 'Techo de lamas metálicas registrable',
   'Techo modular de lamas de aluminio lacado, con estructura portante vista. Permite acceso a instalaciones.',
   'm²', 5, true),
  (u_pladur, 'Perfil de remate en aristas y encuentros',
   'Perfil angular metálico en encuentros tabique-techo y en aristas vivas, con pasta de juntas para acabado liso.',
   'ml', 6, true),
  (u_pladur, 'Bandeja de instalaciones en falso techo',
   'Perfilería de chapa galvanizada para tendido y sujeción de instalaciones sobre falso techo.',
   'ml', 7, true);

-- Fases
INSERT INTO public.fpe_template_phases (unit_id, nombre, descripcion, orden, lead_time_days) VALUES
  (u_pladur, 'Replanteo y montaje de estructura metálica',
   'Trazado de ejes, fijación de canales y montaje de montantes verticales.',
   1, 2),
  (u_pladur, 'Aislamiento y primera capa de placas',
   'Colocación de lana mineral y fijación de primera capa de placa de yeso.',
   2, 3),
  (u_pladur, 'Segunda capa, juntas y acabado fino',
   'Fijación de segunda placa, masillado, cintado de juntas y acabado listo para pintar.',
   3, 2);


-- ═══════════════════════════════════════════════════════════════════════════
-- CAPÍTULO 2 — Instalaciones
-- ═══════════════════════════════════════════════════════════════════════════

-- ── UE 2.1: Instalación Eléctrica y Domótica ──────────────────────────────

INSERT INTO public.fpe_template_units (chapter_id, nombre, descripcion, orden, activo)
  VALUES (ch2,
          'Instalación Eléctrica y Domótica',
          'Instalación eléctrica completa en baja tensión, cuadro de distribución, iluminación técnica y sistemas de domótica o automatización.',
          1, true)
  RETURNING id INTO u_elect;

-- Partidas
INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo) VALUES
  (u_elect, 'Punto de luz empotrado (downlight / plafón)',
   'Punto de luz completo: tubo corrugado, cableado, caja de empotrar y conexionado. Sin luminaria.',
   'ud', 1, true),
  (u_elect, 'Toma de corriente schuko empotrada 16A',
   'Enchufe schuko 2P+T empotrado con caja, tubo y cableado. Sin mecanismo de acabado.',
   'ud', 2, true),
  (u_elect, 'Punto de TV / fibra óptica / datos RJ45',
   'Canalización y cableado de punto de datos o TV. Incluye roseta empotrada y tubo corrugado.',
   'ud', 3, true),
  (u_elect, 'Cuadro eléctrico principal con ICP + diferenciales',
   'Cuadro de distribución empotrado o en superficie, con ICP, diferencial 40A 30mA y magnetotérmicos según circuitos.',
   'ud', 4, true),
  (u_elect, 'Circuito de iluminación independiente (hasta 10 puntos)',
   'Circuito completo de iluminación con cable 1,5mm², tubo corrugado, automatismos y conexionado al cuadro.',
   'ud', 5, true),
  (u_elect, 'Regulador de intensidad (dimmer) empotrado',
   'Regulador de fase o leading-edge empotrado para cargas LED regulables, con neutro.',
   'ud', 6, true),
  (u_elect, 'Detector de presencia / movimiento empotrado',
   'Detector de techo 360° o de pared, empotrado, para encendido automático de zonas de paso.',
   'ud', 7, true),
  (u_elect, 'Módulo de domótica KNX por zona',
   'Módulo actuador KNX para control de iluminación, persianas o climatización por zona lógica.',
   'ud', 8, true);

-- Fases
INSERT INTO public.fpe_template_phases (unit_id, nombre, descripcion, orden, lead_time_days) VALUES
  (u_elect, 'Replanteo y apertura de rozas',
   'Marcado de recorridos, apertura de rozas en pared y techo, y fijación de cajas empotradas.',
   1, 2),
  (u_elect, 'Canalización y cableado',
   'Tendido de tubo corrugado, paso de cables por circuitos y etiquetado de líneas.',
   2, 3),
  (u_elect, 'Montaje de cuadro eléctrico',
   'Instalación del cuadro, conexionado de protecciones y verificación de circuitos.',
   3, 1),
  (u_elect, 'Mecanismos, luminarias y puesta en marcha',
   'Instalación de mecanismos de acabado, luminarias, domótica y prueba funcional completa.',
   4, 2);


-- ── UE 2.2: Fontanería y Saneamiento ──────────────────────────────────────

INSERT INTO public.fpe_template_units (chapter_id, nombre, descripcion, orden, activo)
  VALUES (ch2,
          'Fontanería y Saneamiento',
          'Red de distribución de agua fría y caliente, red de saneamiento y conexión a colector general.',
          2, true)
  RETURNING id INTO u_font;

-- Partidas
INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo) VALUES
  (u_font, 'Punto de suministro de agua fría empotrado',
   'Punto de agua fría en tubería de PE-X ø16mm con llave de corte empotrada y racor de conexión.',
   'ud', 1, true),
  (u_font, 'Punto de suministro de agua caliente empotrado',
   'Punto de agua caliente en tubería de PE-X ø16mm con aislamiento térmico y llave de corte empotrada.',
   'ud', 2, true),
  (u_font, 'Bote sifónico de 5 entradas en suelo',
   'Bote sifónico de PVC ø110mm con tapa de registro para recogida de sifones de lavabos, bañera y bidé.',
   'ud', 3, true),
  (u_font, 'Tubería de distribución PE-X ø20mm',
   'Tubería multicapa PE-X/Al/PE-X ø20mm para distribución principal, con aislamiento en zonas ocultas.',
   'ml', 4, true),
  (u_font, 'Bajante de saneamiento PVC ø110mm',
   'Tubería de PVC reforzado ø110mm para saneamiento horizontal, con pendiente mínima 2%, abrazaderas y uniones.',
   'ml', 5, true),
  (u_font, 'Válvula de corte de esfera empotrada',
   'Válvula de corte de paso total ø20mm empotrada en nicho, con tapa de registro de acero inox.',
   'ud', 6, true),
  (u_font, 'Contador individual de agua volumétrico',
   'Contador de agua calibre ø20mm para medición individual de consumo. Incluye válvulas de corte y filtro.',
   'ud', 7, true);

-- Fases
INSERT INTO public.fpe_template_phases (unit_id, nombre, descripcion, orden, lead_time_days) VALUES
  (u_font, 'Replanteo y apertura de rozas',
   'Trazado de la red, apertura de rozas verticales y horizontales en paredes y solera.',
   1, 1),
  (u_font, 'Instalación de tuberías y saneamiento',
   'Tendido de tuberías de distribución y red de saneamiento con pendientes correctas.',
   2, 3),
  (u_font, 'Prueba de estanqueidad a presión',
   'Prueba hidrostática a 1,5 veces la presión de trabajo durante 24 horas.',
   3, 1),
  (u_font, 'Tapado de rozas y conexiones finales',
   'Cierre de rozas con mortero, conexionado a sanitarios y verificación de caudales.',
   4, 1);


-- ── UE 2.3: Climatización y Ventilación ───────────────────────────────────

INSERT INTO public.fpe_template_units (chapter_id, nombre, descripcion, orden, activo)
  VALUES (ch2,
          'Climatización y Ventilación',
          'Sistema de aire acondicionado multisplit o VRV, conductos de ventilación mecánica controlada y recuperación de calor.',
          3, true)
  RETURNING id INTO u_clima;

-- Partidas
INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo) VALUES
  (u_clima, 'Unidad exterior multisplit inverter (hasta 5 unidades)',
   'Unidad exterior de condensación para sistema multisplit de alta eficiencia A++, incluye soporte y conexionado eléctrico.',
   'ud', 1, true),
  (u_clima, 'Unidad interior de cassette de techo 4 vías',
   'Split cassette empotrable en falso techo, con distribución 4 vías y control de lamas automático.',
   'ud', 2, true),
  (u_clima, 'Unidad interior de conductos ocultos (horizontal)',
   'Fancoil de conductos de baja silueta para instalación en falso techo, con filtros y válvula de expansión.',
   'ud', 3, true),
  (u_clima, 'Conducto de chapa helicoidal ø150mm',
   'Conducto circular de chapa galvanizada ø150mm para distribución de aire, con aislamiento térmico exterior.',
   'ml', 4, true),
  (u_clima, 'Rejilla de impulsión / retorno con regulación',
   'Rejilla de aluminio anodizado con aletas fijas o regulables y compuerta de regulación de caudal.',
   'ud', 5, true),
  (u_clima, 'Termostato WiFi con control por app',
   'Termostato digital programable con conectividad WiFi para control remoto vía smartphone.',
   'ud', 6, true),
  (u_clima, 'Recuperador de calor estático VMC (ventilación mecánica)',
   'Unidad de ventilación con recuperación de calor eficiencia ≥ 75%, doble flujo. Incluye conductos de toma exterior.',
   'ud', 7, true);

-- Fases
INSERT INTO public.fpe_template_phases (unit_id, nombre, descripcion, orden, lead_time_days) VALUES
  (u_clima, 'Obra civil y canalización eléctrica',
   'Apertura de rozas para tuberías frigoríficas y cableado eléctrico, y preparación de anclajes de unidades.',
   1, 2),
  (u_clima, 'Instalación de unidades y tuberías',
   'Montaje de unidades interiores y exterior, tendido de líneas frigoríficas y cableado de control.',
   2, 3),
  (u_clima, 'Conductos de ventilación y rejillas',
   'Montaje de conductos de distribución de aire, cajas de mezcla y rejillas de impulsión y retorno.',
   3, 2),
  (u_clima, 'Carga de gas, puesta en marcha y regulación',
   'Carga de refrigerante, pruebas de estanqueidad, puesta en marcha y ajuste de caudales.',
   4, 1);


-- ═══════════════════════════════════════════════════════════════════════════
-- CAPÍTULO 3 — Pavimentos y Revestimientos
-- ═══════════════════════════════════════════════════════════════════════════

-- ── UE 3.1: Pavimentos ────────────────────────────────────────────────────

INSERT INTO public.fpe_template_units (chapter_id, nombre, descripcion, orden, activo)
  VALUES (ch3,
          'Pavimentos',
          'Colocación de solado en suelos: porcelánico, piedra natural, parquet, microcemento u otras superficies técnicas.',
          1, true)
  RETURNING id INTO u_pavim;

-- Partidas
INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo) VALUES
  (u_pavim, 'Regularización de base con mortero autonivelante',
   'Capa de mortero autonivelante E-225 de 3 a 10 mm de espesor para regularizar la base antes del solado.',
   'm²', 1, true),
  (u_pavim, 'Pavimento porcelánico rectificado 60×60 cm',
   'Colocación de porcelánico 60×60 cm en capa fina con adhesivo C2 y junta mínima de 1,5 mm. Incluye material.',
   'm²', 2, true),
  (u_pavim, 'Pavimento porcelánico gran formato 120×60 cm o superior',
   'Colocación de gran formato con doble encolado (suelo y pieza), crucetas de 2 mm y perfil nivelador. Incluye material.',
   'm²', 3, true),
  (u_pavim, 'Parquet multicapa flotante con clip (AC5)',
   'Suelo laminado o parquet multicapa de roble natural AC5, colocación flotante con lámina de espuma PE de 3 mm.',
   'm²', 4, true),
  (u_pavim, 'Microcemento bidosé de 2 mm (suelo)',
   'Aplicación de microcemento en dos capas sobre base preparada, acabado mate o satinado y sellado con barniz.',
   'm²', 5, true),
  (u_pavim, 'Rodapié de porcelánico 8×60 cm (a juego con pavimento)',
   'Colocación de rodapié cerámico a juego con el pavimento, incluye adhesivo y lechada.',
   'ml', 6, true),
  (u_pavim, 'Perfil de transición entre materiales',
   'Perfil de aluminio anodizado o acero inox para encuentro entre dos pavimentos distintos o en umbral de puerta.',
   'ml', 7, true);

-- Fases
INSERT INTO public.fpe_template_phases (unit_id, nombre, descripcion, orden, lead_time_days) VALUES
  (u_pavim, 'Preparación y nivelación de base',
   'Limpieza de la base, aplicación de imprimación y extendido de mortero autonivelante.',
   1, 2),
  (u_pavim, 'Colocación de pavimento',
   'Tendido y colocación del pavimento según tipo, con control de planeidad y pendientes.',
   2, 5),
  (u_pavim, 'Rejuntado, perfiles y acabado final',
   'Rejuntado de juntas, instalación de rodapiés y perfiles de transición, limpieza de residuos de adhesivo.',
   3, 2);


-- ── UE 3.2: Revestimientos ────────────────────────────────────────────────

INSERT INTO public.fpe_template_units (chapter_id, nombre, descripcion, orden, activo)
  VALUES (ch3,
          'Revestimientos',
          'Colocación de revestimientos en paredes y techos: cerámica, piedra, madera, microcemento y paneles decorativos.',
          2, true)
  RETURNING id INTO u_revis;

-- Partidas
INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo) VALUES
  (u_revis, 'Alicatado cerámico en baño 30×60 cm',
   'Colocación de azulejo cerámico en baños con adhesivo C2 y lechada epoxídica. Incluye cortes y remates.',
   'm²', 1, true),
  (u_revis, 'Revestimiento porcelánico gran formato 120×60 cm (pared)',
   'Colocación de porcelánico de gran formato en paramento vertical con doble encolado y niveladores.',
   'm²', 2, true),
  (u_revis, 'Panel decorativo de madera natural o chapa',
   'Panel de madera natural barnizada o lacada, fijado con sistema oculto de clips sobre entramado.',
   'm²', 3, true),
  (u_revis, 'Microcemento de pared 2 mm bidosé',
   'Microcemento en paramentos verticales en dos capas, acabado liso o texturizado, con sellado final.',
   'm²', 4, true),
  (u_revis, 'Papel pintado de vinilo (paredes)',
   'Colocación de papel pintado de vinilo lavable con cola específica, previo encolado del soporte.',
   'm²', 5, true),
  (u_revis, 'Tapajuntas de aluminio anodizado',
   'Tapajuntas de aluminio natural o lacado en encuentros pared-suelo o en cambios de material.',
   'ml', 6, true),
  (u_revis, 'Sellado perimetral con silicona sanitaria',
   'Sellado con silicona neutra de color en encuentros pared-suelo, pared-encimera y juntas de movimiento.',
   'ml', 7, true);

-- Fases
INSERT INTO public.fpe_template_phases (unit_id, nombre, descripcion, orden, lead_time_days) VALUES
  (u_revis, 'Preparación del soporte y regularización',
   'Limpieza, picado de irregularidades y aplicación de capa de regularización o imprimación.',
   1, 1),
  (u_revis, 'Colocación de revestimiento',
   'Replanteo y colocación del revestimiento con control de plomo y nivel.',
   2, 4),
  (u_revis, 'Rejuntado, sellado y acabado',
   'Rejuntado con lechada epoxídica, sellado perimetral, limpieza y protección de superficies.',
   3, 2);


-- ═══════════════════════════════════════════════════════════════════════════
-- CAPÍTULO 4 — Carpintería
-- ═══════════════════════════════════════════════════════════════════════════

-- ── UE 4.1: Carpintería de Obra a Medida ──────────────────────────────────

INSERT INTO public.fpe_template_units (chapter_id, nombre, descripcion, orden, activo)
  VALUES (ch4,
          'Carpintería de Obra a Medida',
          'Fabricación e instalación de armarios encastrados, vestidores, panelados y mobiliario de obra a medida, lacado o chapado.',
          1, true)
  RETURNING id INTO u_carp;

-- Partidas
INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo) VALUES
  (u_carp, 'Armario encastrado lacado — frentes de suelo a techo',
   'Armario de obra con tablero de DM, interior de melanina blanca y frentes lacados en poliuretano. Incluye interior organizado.',
   'm²', 1, true),
  (u_carp, 'Vestidor a medida con iluminación integrada',
   'Estructura de vestidor con módulos de colgar, cajones con guías Blum y barra de iluminación LED integrada.',
   'm²', 2, true),
  (u_carp, 'Panelado de pared lacado (boiserie o liso)',
   'Panelado de DM sobre rastreles de madera, lacado en poliuretano a color RAL según proyecto.',
   'm²', 3, true),
  (u_carp, 'Puerta corredera oculta (invisible en pared)',
   'Puerta de paso corredera con sistema de guía invisible en falso techo y suelo, hoja lacada sin manilla exterior.',
   'ud', 4, true),
  (u_carp, 'Rodapié lacado de 10 cm de alto',
   'Rodapié de MDF lacado a color, fijado con adhesivo y sellador, pintado in situ para color exacto.',
   'ml', 5, true),
  (u_carp, 'Cajonera de 4 cajones con guías de extracción total',
   'Módulo cajonero de DM lacado, con 4 cajones de extracción total Blum Tandembox y cierre suave.',
   'ud', 6, true),
  (u_carp, 'Estantería fija de obra con iluminación LED',
   'Estantería de DM o madera maciza lacada, con balda de vidrio o madera y perfil LED integrado en canto.',
   'ud', 7, true);

-- Fases
INSERT INTO public.fpe_template_phases (unit_id, nombre, descripcion, orden, lead_time_days) VALUES
  (u_carp, 'Medición y proyecto de detalle',
   'Visita de medición a obra, desarrollo de planos de taller y aprobación de acabados con dirección de obra.',
   1, 5),
  (u_carp, 'Fabricación en taller',
   'Mecanizado, ensamblado, lijado y aplicación de lacado o chapa en taller.',
   2, 15),
  (u_carp, 'Montaje en obra',
   'Transporte, instalación de módulos, nivelación y aplomado en su posición definitiva.',
   3, 4),
  (u_carp, 'Herrajes, ajuste fino y acabados',
   'Instalación de bisagras, tiradores y herrajes, ajuste de puertas y cajones, remates de silicona.',
   4, 2);


-- ── UE 4.2: Puertas Interiores ────────────────────────────────────────────

INSERT INTO public.fpe_template_units (chapter_id, nombre, descripcion, orden, activo)
  VALUES (ch4,
          'Puertas Interiores',
          'Suministro e instalación de puertas de paso interiores: abatibles, pivotantes y correderas, con precerco y herrajes.',
          2, true)
  RETURNING id INTO u_puertas;

-- Partidas
INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo) VALUES
  (u_puertas, 'Puerta abatible lacada 82×210 (hueco estándar)',
   'Puerta de paso abatible de DM hidrófugo con alma alveolar, lacada en poliuretano, bisagras invisibles y manilla.',
   'ud', 1, true),
  (u_puertas, 'Puerta pivotante lacada de suelo a techo',
   'Puerta de gran formato (hasta 260 cm de alto) sobre pivote de suelo y cierre magnético superior. Lacada.',
   'ud', 2, true),
  (u_puertas, 'Puerta corredera colgante con sistema Barn Door',
   'Puerta corredera exterior sobre carril visto tipo Barn Door, con guía inferior y tope de fin de carrera.',
   'ud', 3, true),
  (u_puertas, 'Precerco metálico galvanizado',
   'Precerco de chapa galvanizada 60×40mm ajustable al espesor del muro. Incluye tornillería y taco de expansión.',
   'ml', 4, true),
  (u_puertas, 'Manilla de diseño con roseta (juego completo)',
   'Manilla de acero inox satinado o lacada, con roseta escuadra o redonda. Juego completo ambas caras.',
   'ud', 5, true),
  (u_puertas, 'Cierre electromagnético invisible (para puertas pivotantes)',
   'Sistema de cierre por electroimán oculto en suelo y umbral, con apertura por pulsador o tarjeta.',
   'ud', 6, true);

-- Fases
INSERT INTO public.fpe_template_phases (unit_id, nombre, descripcion, orden, lead_time_days) VALUES
  (u_puertas, 'Fabricación de puertas y precercos',
   'Mecanizado, lacado de hojas en taller y preparación de precercos.',
   1, 10),
  (u_puertas, 'Instalación de precercos y verificación de huecos',
   'Colocación de precercos a plomo y nivel, revisión de huecos con el estado del tabique.',
   2, 2),
  (u_puertas, 'Colgado de hojas, herrajes y regulación',
   'Instalación de bisagras o pivotes, colgado de hoja, ajuste de holguras y montaje de manillas.',
   3, 2);


-- ═══════════════════════════════════════════════════════════════════════════
-- CAPÍTULO 5 — Acabados Finales
-- ═══════════════════════════════════════════════════════════════════════════

-- ── UE 5.1: Pintura y Acabados ────────────────────────────────────────────

INSERT INTO public.fpe_template_units (chapter_id, nombre, descripcion, orden, activo)
  VALUES (ch5,
          'Pintura y Acabados Decorativos',
          'Pintura de paredes, techos y carpintería. Acabados decorativos especiales: estuco, microcemento, papel pintado.',
          1, true)
  RETURNING id INTO u_pintura;

-- Partidas
INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo) VALUES
  (u_pintura, 'Pintura plástica mate lisa en paredes y techos (2 manos)',
   'Imprimación selladora + 2 manos de pintura plástica mate de alta cubrición. Previo lijado y masillado puntual.',
   'm²', 1, true),
  (u_pintura, 'Esmalte al agua satinado en carpintería y tabiques',
   'Imprimación + 2 manos de esmalte al agua satinado para puertas, rodapiés y marcos de madera.',
   'm²', 2, true),
  (u_pintura, 'Microcemento de paredes 3 mm bidosé (acabado fino)',
   'Microcemento en dos capas de 1,5 mm sobre malla de fibra de vidrio, acabado fino y sellado con barniz.',
   'm²', 3, true),
  (u_pintura, 'Estuco veneciano liso (imitación mármol)',
   'Aplicación de estuco de cal veneciano en 3 capas, pulido a espátula y encerado final.',
   'm²', 4, true),
  (u_pintura, 'Papel pintado de vinilo de alta calidad (colección)',
   'Colocación de papel pintado de vinilo no tejido, con cola específica y preparación del soporte.',
   'm²', 5, true),
  (u_pintura, 'Guardavivos de aluminio en aristas vivas',
   'Perfil guardavivos de aluminio anodizado o lacado, embebido en la capa de pintura o estuco.',
   'ml', 6, true);

-- Fases
INSERT INTO public.fpe_template_phases (unit_id, nombre, descripcion, orden, lead_time_days) VALUES
  (u_pintura, 'Preparación y masillado de paramentos',
   'Lijado, relleno de imperfecciones con masilla fina y aplicación de imprimación selladora.',
   1, 2),
  (u_pintura, 'Primera mano de acabado',
   'Aplicación de primera capa de pintura, estuco o microcemento según tipo de acabado.',
   2, 3),
  (u_pintura, 'Segunda mano, remates y protección final',
   'Segunda capa de acabado, remates en esquinas y zócalos, sellado o encerado si procede.',
   3, 2);


-- ── UE 5.2: Sanitarios y Equipamiento de Baño ────────────────────────────

INSERT INTO public.fpe_template_units (chapter_id, nombre, descripcion, orden, activo)
  VALUES (ch5,
          'Sanitarios y Equipamiento de Baño',
          'Suministro e instalación de sanitarios (lavabos, inodoros, duchas), grifería, mamparas y complementos de baño.',
          2, true)
  RETURNING id INTO u_banio;

-- Partidas
INSERT INTO public.fpe_template_line_items (unit_id, nombre, descripcion, unidad_medida, orden, activo) VALUES
  (u_banio, 'Lavabo sobre encimera / vessel (diseño)',
   'Lavabo de porcelana, piedra o resina sobre encimera de madera o piedra. Incluye sifón y válvula click-clack.',
   'ud', 1, true),
  (u_banio, 'Lavabo empotrado o bajo encimera con mueble',
   'Lavabo empotrado en encimera de madera lacada con cajones Blum, sifón cromado y anclaje a pared.',
   'ud', 2, true),
  (u_banio, 'Inodoro suspendido con cisterna empotrada y suelo técnico',
   'Inodoro de porcelana suspendida con estructura portante Geberit empotrada, pulsador dual y soft-close.',
   'ud', 3, true),
  (u_banio, 'Plato de ducha rasante al suelo con desagüe lineal',
   'Plato de ducha de resina con acabado antideslizante, tapa de acero inox y desagüe lineal empotrado.',
   'ud', 4, true),
  (u_banio, 'Mampara de ducha fija + hoja abatible (perfilería mínima)',
   'Mampara de vidrio templado 8mm con perfil mínimo de acero inox. Incluye sellado perimetral y cierre magnético.',
   'ud', 5, true),
  (u_banio, 'Grifo monomando de lavabo empotrado (tipo cascada)',
   'Grifo empotrado de latón cromado o negro mate con cartucho cerámico y caño cascada.',
   'ud', 6, true),
  (u_banio, 'Espejo retroiluminado LED con antivaho',
   'Espejo de baño con luz LED perimetral, sensor táctil y resistencia antivaho integrada.',
   'ud', 7, true),
  (u_banio, 'Toallero eléctrico tipo radiador (cromo o negro mate)',
   'Radiador toallero eléctrico de diseño con programador digital, potencia 300-600 W según modelo.',
   'ud', 8, true);

-- Fases
INSERT INTO public.fpe_template_phases (unit_id, nombre, descripcion, orden, lead_time_days) VALUES
  (u_banio, 'Instalación de sanitarios y cisterna',
   'Montaje de estructura de cisterna, fijación de platos de ducha rasante y anclajes de sanitarios.',
   1, 2),
  (u_banio, 'Grifería, mamparas y encimeras',
   'Instalación de griferías, mamparas de ducha y encimeras de baño.',
   2, 1),
  (u_banio, 'Complementos, silicona y limpieza final',
   'Instalación de espejos, toalleros, complementos, sellado con silicona sanitaria y limpieza.',
   3, 1);


END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — ejecutar tras el DO block para confirmar los datos
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  ch.orden                            AS cap,
  ch.nombre                           AS capitulo,
  u.orden                             AS ue_ord,
  u.nombre                            AS unidad,
  COUNT(DISTINCT li.id)               AS partidas,
  COUNT(DISTINCT ph.id)               AS fases,
  COALESCE(SUM(DISTINCT ph.lead_time_days), 0) AS dias_totales_ref
FROM public.fpe_template_chapters ch
JOIN public.fpe_template_units u ON u.chapter_id = ch.id
LEFT JOIN public.fpe_template_line_items li ON li.unit_id = u.id
LEFT JOIN public.fpe_template_phases ph ON ph.unit_id = u.id
WHERE ch.activo = true AND u.activo = true
GROUP BY ch.orden, ch.nombre, u.orden, u.nombre
ORDER BY ch.orden, u.orden;
