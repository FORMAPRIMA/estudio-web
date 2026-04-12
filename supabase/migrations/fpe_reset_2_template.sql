-- ══════════════════════════════════════════════════════════════════════════════
-- FPE Reset 2 — Plantilla completa
-- 18 capítulos · 59 unidades de ejecución · ~115 partidas
-- Disciplinas asignadas a cada partida y disciplina principal por UE.
--
-- ⚠ AVISO: Este script borra el scope de todos los proyectos existentes
--   (fpe_project_line_items y fpe_project_units) para poder resetear la
--   plantilla base. Los proyectos en sí NO se borran.
--
-- INSTRUCCIONES: Ejecutar DESPUÉS de fpe_reset_1_disciplines
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 0. Limpiar datos dependientes de la plantilla ─────────────────────────────
-- Orden obligatorio por restricciones FK (ON DELETE RESTRICT en template_units
-- y template_line_items referenciados desde project_units y project_line_items)

DELETE FROM public.fpe_project_line_items;
DELETE FROM public.fpe_project_units;
DELETE FROM public.fpe_partner_capabilities;  -- referencias a template_units antiguas
DELETE FROM public.fpe_template_chapters;     -- CASCADE a units → phases → line_items

-- ── 1. Seed principal ─────────────────────────────────────────────────────────

DO $$
DECLARE
  -- ── Disciplinas (lookup por nombre) ────────────────────────────────────────
  d_alba    uuid; d_demo uuid; d_font uuid; d_elec uuid; d_gas  uuid;
  d_clima   uuid; d_vent uuid; d_cmadera uuid; d_cext uuid; d_cerr uuid;
  d_marm    uuid; d_pint uuid; d_tarima uuid; d_cornisas uuid;
  d_eqvent  uuid; d_eqdomo uuid; d_eqsonido uuid; d_eqcocina uuid;
  d_eqperg  uuid; d_eqbar uuid;
  d_provacab uuid; d_provpied uuid; d_provgrif uuid; d_provmec uuid;

  -- ── Capítulos ────────────────────────────────────────────────────────────
  ch_demo  uuid; ch_ref  uuid; ch_alba uuid; ch_cmet  uuid; ch_cmadera uuid;
  ch_font  uuid; ch_gas  uuid; ch_clima uuid; ch_vent  uuid;
  ch_elec  uuid; ch_tele uuid; ch_domo uuid; ch_sonido uuid;
  ch_pint  uuid; ch_equip uuid; ch_coc  uuid; ch_terr uuid; ch_varios uuid;

  -- ── Unidades de Ejecución ─────────────────────────────────────────────────
  -- Cap 1 — Demoliciones (15 UEs)
  u_d_tabi uuid; u_d_vent uuid; u_d_puer uuid; u_d_font uuid; u_d_ventil uuid;
  u_d_cale uuid; u_d_ac   uuid; u_d_elec uuid; u_d_gas  uuid; u_d_pavim  uuid;
  u_d_arm  uuid; u_d_mobi uuid; u_d_sani uuid; u_d_tech uuid; u_d_mold   uuid;
  -- Cap 2
  u_ref uuid;
  -- Cap 3 (7 UEs)
  u_tras uuid; u_tabi uuid; u_trasd uuid; u_techo uuid; u_mold uuid;
  u_sole uuid; u_ayud uuid;
  -- Cap 4 (5 UEs)
  u_cmet uuid; u_pers uuid; u_esto uuid; u_mamp uuid; u_espe uuid;
  -- Cap 5 (6 UEs)
  u_pac uuid; u_ppas uuid; u_arm uuid; u_mbano uuid; u_panel uuid; u_roda uuid;
  -- Cap 6 (2 UEs)
  u_fontsane uuid; u_acs uuid;
  -- Cap 7
  u_gas uuid;
  -- Cap 8 (2 UEs)
  u_cale uuid; u_ac uuid;
  -- Cap 9
  u_venti uuid;
  -- Cap 10 (2 UEs)
  u_elec uuid; u_ilum uuid;
  -- Cap 11
  u_tele uuid;
  -- Cap 12
  u_domo uuid;
  -- Cap 13
  u_sonido uuid;
  -- Cap 14 (5 UEs)
  u_pint uuid; u_solado uuid; u_tarima uuid; u_rodapie uuid; u_cornisa uuid;
  -- Cap 15 (3 UEs)
  u_sanit uuid; u_grif uuid; u_mec uuid;
  -- Cap 16 (3 UEs)
  u_mobcoc uuid; u_enci uuid; u_electro uuid;
  -- Cap 17 (2 UEs)
  u_perg uuid; u_baran uuid;
  -- Cap 18
  u_varios uuid;

BEGIN

-- ── Resolver UUIDs de disciplinas ────────────────────────────────────────────
SELECT id INTO d_alba    FROM public.fpe_disciplines WHERE nombre = 'Albañilería';
SELECT id INTO d_demo    FROM public.fpe_disciplines WHERE nombre = 'Demolición y gestión de residuos';
SELECT id INTO d_font    FROM public.fpe_disciplines WHERE nombre = 'Fontanería';
SELECT id INTO d_elec    FROM public.fpe_disciplines WHERE nombre = 'Electricidad';
SELECT id INTO d_gas     FROM public.fpe_disciplines WHERE nombre = 'Gas';
SELECT id INTO d_clima   FROM public.fpe_disciplines WHERE nombre = 'Climatización';
SELECT id INTO d_vent    FROM public.fpe_disciplines WHERE nombre = 'Ventilación';
SELECT id INTO d_cmadera FROM public.fpe_disciplines WHERE nombre = 'Carpintería de madera';
SELECT id INTO d_cext    FROM public.fpe_disciplines WHERE nombre = 'Carpintería exterior';
SELECT id INTO d_cerr    FROM public.fpe_disciplines WHERE nombre = 'Cerrajería';
SELECT id INTO d_marm    FROM public.fpe_disciplines WHERE nombre = 'Mármolista';
SELECT id INTO d_pint    FROM public.fpe_disciplines WHERE nombre = 'Pintura';
SELECT id INTO d_tarima  FROM public.fpe_disciplines WHERE nombre = 'Instalador de tarima';
SELECT id INTO d_cornisas FROM public.fpe_disciplines WHERE nombre = 'Instalador de cornisas';
SELECT id INTO d_eqvent  FROM public.fpe_disciplines WHERE nombre = 'Equipamiento de ventanas';
SELECT id INTO d_eqdomo  FROM public.fpe_disciplines WHERE nombre = 'Equipamiento domótica';
SELECT id INTO d_eqsonido FROM public.fpe_disciplines WHERE nombre = 'Equipamiento de sonido';
SELECT id INTO d_eqcocina FROM public.fpe_disciplines WHERE nombre = 'Equipamiento de cocina';
SELECT id INTO d_eqperg  FROM public.fpe_disciplines WHERE nombre = 'Equipamiento exterior (pérgolas)';
SELECT id INTO d_eqbar   FROM public.fpe_disciplines WHERE nombre = 'Equipamiento exterior (barandillas)';
SELECT id INTO d_provacab FROM public.fpe_disciplines WHERE nombre = 'Proveedor de acabados';
SELECT id INTO d_provpied FROM public.fpe_disciplines WHERE nombre = 'Proveedor de piedra natural';
SELECT id INTO d_provgrif FROM public.fpe_disciplines WHERE nombre = 'Proveedor de griferías y accesorios';
SELECT id INTO d_provmec  FROM public.fpe_disciplines WHERE nombre = 'Proveedor de mecanismos eléctricos';


-- ════════════════════════════════════════════════════════════════════════════
-- CAPÍTULOS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('DEMOLICIONES Y TRABAJOS PREVIOS', 10, true, 8, d_demo) RETURNING id INTO ch_demo;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('REFUERZOS ESTRUCTURALES', 20, true, 4, d_alba) RETURNING id INTO ch_ref;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('ALBAÑILERÍA', 30, true, 15, d_alba) RETURNING id INTO ch_alba;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('CARPINTERÍA METÁLICA Y VIDRIERÍA', 40, true, 5, d_cext) RETURNING id INTO ch_cmet;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('CARPINTERÍA DE MADERA', 50, true, 12, d_cmadera) RETURNING id INTO ch_cmadera;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('INSTALACIONES - FONTANERÍA Y SANEAMIENTO', 60, true, 6, d_font) RETURNING id INTO ch_font;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('INSTALACIONES - GAS', 70, true, 2, d_gas) RETURNING id INTO ch_gas;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('INSTALACIONES - CLIMATIZACIÓN', 80, true, 5, d_clima) RETURNING id INTO ch_clima;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('INSTALACIONES - VENTILACIÓN', 90, true, 3, d_vent) RETURNING id INTO ch_vent;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('INSTALACIONES - ELECTRICIDAD', 100, true, 6, d_elec) RETURNING id INTO ch_elec;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('INSTALACIONES - TELECOMUNICACIONES', 110, true, 2, d_elec) RETURNING id INTO ch_tele;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('INSTALACIONES - DOMÓTICA', 120, true, 3, d_eqdomo) RETURNING id INTO ch_domo;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('INSTALACIONES - SONIDO', 130, true, 2, d_eqsonido) RETURNING id INTO ch_sonido;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('PINTURAS Y REVESTIMIENTOS', 140, true, 12, d_pint) RETURNING id INTO ch_pint;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('EQUIPAMIENTO', 150, true, 4, d_provgrif) RETURNING id INTO ch_equip;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('COCINA', 160, true, 6, d_eqcocina) RETURNING id INTO ch_coc;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('TERRAZA', 170, true, 3, d_eqperg) RETURNING id INTO ch_terr;
INSERT INTO public.fpe_template_chapters (nombre, orden, activo, duracion_pct, principal_discipline_id) VALUES ('VARIOS', 180, true, 2, d_alba) RETURNING id INTO ch_varios;


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 1 — DEMOLICIONES Y TRABAJOS PREVIOS
-- principal_discipline: Demolición y gestión de residuos (todas las UEs)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Tabiquería', 10, true, d_demo) RETURNING id INTO u_d_tabi;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_tabi, 'Derribo de tabique (carga y transporte a vertedero incluidos)', 'm²', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Ventanas', 20, true, d_demo) RETURNING id INTO u_d_vent;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_vent, 'Desmontaje y retirada de ventana con marco (transporte incluido)', 'ud', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Puertas', 30, true, d_demo) RETURNING id INTO u_d_puer;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_puer, 'Desmontaje y retirada de puerta con marco y precerco', 'ud', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Fontanería y saneamiento', 40, true, d_demo) RETURNING id INTO u_d_font;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_font, 'Desmontaje de instalación de fontanería y saneamiento', 'pa', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Ventilación', 50, true, d_demo) RETURNING id INTO u_d_ventil;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_ventil, 'Desmontaje de instalación de ventilación existente', 'pa', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Calefacción', 60, true, d_demo) RETURNING id INTO u_d_cale;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_cale, 'Desmontaje de instalación de calefacción', 'pa', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'A/C', 70, true, d_demo) RETURNING id INTO u_d_ac;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_ac, 'Desmontaje de equipos de aire acondicionado', 'pa', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Electricidad, iluminación y telecomunicaciones', 80, true, d_demo) RETURNING id INTO u_d_elec;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_elec, 'Desmontaje de instalación eléctrica, iluminación y telecomunicaciones', 'pa', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Gas', 90, true, d_demo) RETURNING id INTO u_d_gas;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_gas, 'Desmontaje de instalación de gas (empresa habilitada)', 'pa', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Pavimentos y revestimientos', 100, true, d_demo) RETURNING id INTO u_d_pavim;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_pavim, 'Levantado de pavimento existente (carga y transporte incluidos)', 'm²', 10, true, d_demo),
  (u_d_pavim, 'Levantado de alicatado o revestimiento de pared', 'm²', 20, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Armarios empotrados y cocina', 110, true, d_demo) RETURNING id INTO u_d_arm;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_arm, 'Desmontaje y retirada de armarios empotrados y muebles de cocina', 'pa', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Retirada de mobiliario', 120, true, d_demo) RETURNING id INTO u_d_mobi;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_mobi, 'Retirada de mobiliario y enseres según inventario', 'pa', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Sanitarios y cocina', 130, true, d_demo) RETURNING id INTO u_d_sani;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_sani, 'Desmontaje de aparato sanitario (lavabo, inodoro, bañera, ducha)', 'ud', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Falsos techos', 140, true, d_demo) RETURNING id INTO u_d_tech;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_tech, 'Demolición de falso techo (pladur, escayola o continuo)', 'm²', 10, true, d_demo);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_demo, 'Molduras y foseados', 150, true, d_demo) RETURNING id INTO u_d_mold;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_d_mold, 'Demolición de moldura, cornisa o foseado existente', 'ml', 10, true, d_demo);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 2 — REFUERZOS ESTRUCTURALES
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_ref, 'Refuerzos estructurales', 10, true, d_alba) RETURNING id INTO u_ref;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_ref, 'Estudio, proyecto técnico y dirección de obra de refuerzo', 'pa', 10, true, d_alba),
  (u_ref, 'Viga metálica HEB/IPE incluso placa de anclaje y pintura anticorrosión', 'ml', 20, true, d_alba),
  (u_ref, 'Zuncho perimetral de refuerzo en forjado existente', 'm²', 30, true, d_alba);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 3 — ALBAÑILERÍA
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_alba, 'Trasdosados', 10, true, d_alba) RETURNING id INTO u_tras;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_tras, 'Trasdosado autoportante con placa de yeso laminado sobre perfilería (e=75mm, N+A)', 'm²', 10, true, d_alba);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_alba, 'Tabiquería', 20, true, d_alba) RETURNING id INTO u_tabi;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_tabi, 'Tabique LHD enfoscado o tabique de pladur doble cara (e=100mm, N+A)', 'm²', 10, true, d_alba);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_alba, 'Trasdosados directos', 30, true, d_alba) RETURNING id INTO u_trasd;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_trasd, 'Trasdosado directo encolado con placa de yeso laminado', 'm²', 10, true, d_alba);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_alba, 'Techos', 40, true, d_alba) RETURNING id INTO u_techo;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_techo, 'Techo continuo de pladur sobre estructura metálica', 'm²', 10, true, d_alba);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_alba, 'Molduras y foseados', 50, true, d_alba) RETURNING id INTO u_mold;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_mold, 'Foseado perimetral para iluminación indirecta', 'ml', 10, true, d_alba);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_alba, 'Soleras y rellenos', 60, true, d_alba) RETURNING id INTO u_sole;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_sole, 'Solera de hormigón o relleno de yeso según espesor de proyecto', 'm²', 10, true, d_alba);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_alba, 'Ayudas de albañilería', 70, true, d_alba) RETURNING id INTO u_ayud;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_ayud, 'Ayudas de albañilería a todos los gremios: rozas, taladros, tapado y remates', 'pa', 10, true, d_alba);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 4 — CARPINTERÍA METÁLICA Y VIDRIERÍA
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_cmet, 'Carpinterías metálicas y PVC', 10, true, d_cext) RETURNING id INTO u_cmet;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_cmet, 'Ventana o balconera de aluminio RPT / PVC incluso acristalamiento doble', 'ud', 10, true, d_cext);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_cmet, 'Persianas', 20, true, d_eqvent) RETURNING id INTO u_pers;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_pers, 'Persiana motorizada de aluminio incluso cajón, guías y automatización', 'ud', 10, true, d_eqvent);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_cmet, 'Estores', 30, true, d_eqvent) RETURNING id INTO u_esto;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_esto, 'Estor enrollable o plisado incluso motorización si aplica', 'ud', 10, true, d_eqvent);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_cmet, 'Mamparas', 40, true, d_cerr) RETURNING id INTO u_mamp;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_mamp, 'Mampara de vidrio templado o laminado incluso perfilería y herrajes', 'm²', 10, true, d_cerr);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_cmet, 'Espejos', 50, true, d_cerr) RETURNING id INTO u_espe;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_espe, 'Espejo sobre soporte incluso fijación y acabado perimetral', 'm²', 10, true, d_cerr);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 5 — CARPINTERÍA DE MADERA
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_cmadera, 'Puertas de acceso a vivienda', 10, true, d_cmadera) RETURNING id INTO u_pac;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_pac, 'Puerta blindada o acorazada incluso premarco, marco y herraje de seguridad', 'ud', 10, true, d_cmadera);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_cmadera, 'Puertas de paso', 20, true, d_cmadera) RETURNING id INTO u_ppas;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_ppas, 'Puerta de paso (abatible, corredera o plegable) incluso premarco, marco y herraje', 'ud', 10, true, d_cmadera);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_cmadera, 'Armarios a medida', 30, true, d_cmadera) RETURNING id INTO u_arm;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_arm, 'Armario empotrado a medida incluso puertas, interiores y herrajes', 'm²', 10, true, d_cmadera);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_cmadera, 'Mueble de baño', 40, true, d_cmadera) RETURNING id INTO u_mbano;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_mbano, 'Mueble de baño a medida incluso estructura y acabado lacado o chapado', 'ud', 10, true, d_cmadera),
  (u_mbano, 'Encimera de baño en piedra natural o compacto incluso corte y fijación', 'ud', 20, true, d_marm);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_cmadera, 'Panelados', 50, true, d_cmadera) RETURNING id INTO u_panel;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_panel, 'Panelado de pared a medida incluso estructura y acabado lacado o chapado', 'm²', 10, true, d_cmadera);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_cmadera, 'Rodapiés y guardapolvos', 60, true, d_cmadera) RETURNING id INTO u_roda;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_roda, 'Rodapié o guardapolvo a medida incluso fijación y sellado', 'ml', 10, true, d_cmadera);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 6 — INSTALACIONES - FONTANERÍA Y SANEAMIENTO
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_font, 'Fontanería y saneamiento', 10, true, d_font) RETURNING id INTO u_fontsane;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_fontsane, 'Red de distribución de agua (PEX/CPVC) incluso llaves de corte por estancia', 'pa', 10, true, d_font),
  (u_fontsane, 'Punto de suministro de agua (conexión a aparato)', 'ud', 20, true, d_font),
  (u_fontsane, 'Colector de saneamiento suspendido incluso botes sifónicos y manguetones', 'ml', 30, true, d_font);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_font, 'ACS', 20, true, d_font) RETURNING id INTO u_acs;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_acs, 'Interacumulador o termo eléctrico incluso conexiones y vaciado', 'ud', 10, true, d_font),
  (u_acs, 'Circuito de retorno de ACS (viviendas grandes)', 'pa', 20, true, d_font);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 7 — INSTALACIONES - GAS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_gas, 'Gas', 10, true, d_gas) RETURNING id INTO u_gas;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_gas, 'Instalación interior de gas natural o propano desde llave de edificio a aparatos', 'pa', 10, true, d_gas),
  (u_gas, 'Llave de corte individual por aparato', 'ud', 20, true, d_gas);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 8 — INSTALACIONES - CLIMATIZACIÓN
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_clima, 'Calefacción', 10, true, d_clima) RETURNING id INTO u_cale;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_cale, 'Suelo radiante hidrónico incluso plancha aislante, tubo y colector', 'm²', 10, true, d_clima),
  (u_cale, 'Radiador o fancoil incluso conexiones y válvulas termostáticas', 'ud', 20, true, d_clima);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_clima, 'A/C', 20, true, d_clima) RETURNING id INTO u_ac;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_ac, 'Unidad interior (cassette, conducto o split) incluso instalación frigorífica', 'ud', 10, true, d_clima),
  (u_ac, 'Unidad exterior (compresor) incluso instalación eléctrica de alimentación', 'ud', 20, true, d_clima);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 9 — INSTALACIONES - VENTILACIÓN
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_vent, 'Ventilación', 10, true, d_vent) RETURNING id INTO u_venti;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_venti, 'VMC doble flujo incluso instalación eléctrica y conexión a conductos', 'ud', 10, true, d_vent),
  (u_venti, 'Boca de extracción o impulsión incluso conducto flexible y rejilla', 'ud', 20, true, d_vent);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 10 — INSTALACIONES - ELECTRICIDAD
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_elec, 'Electricidad', 10, true, d_elec) RETURNING id INTO u_elec;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_elec, 'Cuadro general de distribución incluso diferenciales y magnetotérmicos', 'pa', 10, true, d_elec),
  (u_elec, 'Circuito eléctrico independiente (por línea)', 'ud', 20, true, d_elec),
  (u_elec, 'Punto de enchufe base 16A incluso caja y cable (mecanismo aparte)', 'ud', 30, true, d_elec),
  (u_elec, 'Punto de interruptor o conmutador incluso caja y cable', 'ud', 40, true, d_elec);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_elec, 'Iluminación', 20, true, d_elec) RETURNING id INTO u_ilum;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_ilum, 'Punto de luz (empotrado, superficie o carril) incluso cable y caja', 'ud', 10, true, d_elec),
  (u_ilum, 'Bandeja o canaleta para iluminación indirecta', 'ml', 20, true, d_elec);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 11 — INSTALACIONES - TELECOMUNICACIONES
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_tele, 'Telecomunicaciones', 10, true, d_elec) RETURNING id INTO u_tele;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_tele, 'RTR incluso cableado de datos y TV a todas las estancias', 'pa', 10, true, d_elec),
  (u_tele, 'Punto de datos RJ45 Cat.6A incluso cable y caja', 'ud', 20, true, d_elec),
  (u_tele, 'Punto de TV/SAT incluso cable y caja', 'ud', 30, true, d_elec);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 12 — INSTALACIONES - DOMÓTICA
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_domo, 'Domótica', 10, true, d_eqdomo) RETURNING id INTO u_domo;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_domo, 'Sistema domótico incluso central, cableado y programación inicial', 'pa', 10, true, d_eqdomo),
  (u_domo, 'Actuador o módulo de control por estancia', 'ud', 20, true, d_eqdomo),
  (u_domo, 'Cableado eléctrico para sistema domótico', 'pa', 30, true, d_elec);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 13 — INSTALACIONES - SONIDO
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_sonido, 'Sonido', 10, true, d_eqsonido) RETURNING id INTO u_sonido;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_sonido, 'Sistema de audio multiroom incluso amplificador y cableado', 'pa', 10, true, d_eqsonido),
  (u_sonido, 'Altavoz empotrado incluso caja de instalación', 'ud', 20, true, d_eqsonido),
  (u_sonido, 'Cableado eléctrico para sistema de sonido', 'pa', 30, true, d_elec);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 14 — PINTURAS Y REVESTIMIENTOS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_pint, 'Pintura', 10, true, d_pint) RETURNING id INTO u_pint;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_pint, 'Pintura plástica dos manos sobre paramento vertical u horizontal', 'm²', 10, true, d_pint),
  (u_pint, 'Acabado especial (estuco, cal o pintura mineral) sobre paramento', 'm²', 20, true, d_pint);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_pint, 'Solados y alicatados', 20, true, d_provacab) RETURNING id INTO u_solado;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_solado, 'Solado con baldosa cerámica o porcelánica incluso adhesivo y junta', 'm²', 10, true, d_provacab),
  (u_solado, 'Alicatado con baldosa cerámica o porcelánica incluso adhesivo y junta', 'm²', 20, true, d_provacab),
  (u_solado, 'Solado con piedra natural incluso adhesivo y sellado', 'm²', 30, true, d_provpied);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_pint, 'Tarima de madera', 30, true, d_tarima) RETURNING id INTO u_tarima;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_tarima, 'Tarima de madera maciza o ingeniería incluso colocación flotante o encolada', 'm²', 10, true, d_tarima);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_pint, 'Rodapié', 40, true, d_tarima) RETURNING id INTO u_rodapie;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_rodapie, 'Rodapié incluso fijación y sellado perimetral', 'ml', 10, true, d_tarima);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_pint, 'Cornisas', 50, true, d_cornisas) RETURNING id INTO u_cornisa;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_cornisa, 'Cornisa o moldura decorativa incluso fijación y terminación', 'ml', 10, true, d_cornisas);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 15 — EQUIPAMIENTO
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_equip, 'Sanitarios', 10, true, d_provgrif) RETURNING id INTO u_sanit;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_sanit, 'Inodoro suspendido incluso soporte y conexión', 'ud', 10, true, d_provgrif),
  (u_sanit, 'Lavabo incluso conexión (mueble a cargo de carpintería)', 'ud', 20, true, d_provgrif),
  (u_sanit, 'Bañera o plato de ducha incluso impermeabilización y conexión', 'ud', 30, true, d_provgrif);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_equip, 'Griferías y accesorios', 20, true, d_provgrif) RETURNING id INTO u_grif;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_grif, 'Grifería monomando o termostática por punto de suministro', 'ud', 10, true, d_provgrif),
  (u_grif, 'Set de accesorios de baño (portarrollos, toallero, jabonera)', 'pa', 20, true, d_provgrif);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_equip, 'Mecanismos eléctricos', 30, true, d_provmec) RETURNING id INTO u_mec;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_mec, 'Mecanismo eléctrico (interruptor, enchufe, regulador) incluso embellecedor', 'ud', 10, true, d_provmec);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 16 — COCINA
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_coc, 'Mobiliario de cocina', 10, true, d_eqcocina) RETURNING id INTO u_mobcoc;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_mobcoc, 'Conjunto de muebles de cocina (bajos, altos y columnas) incluso montaje', 'pa', 10, true, d_eqcocina);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_coc, 'Encimera, aplacado y fregadero', 20, true, d_eqcocina) RETURNING id INTO u_enci;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_enci, 'Encimera (silestone, granito o compacto) incluso corte y fijación', 'ml', 10, true, d_marm),
  (u_enci, 'Aplacado de cocina entre muebles incluso adhesivo y junta', 'm²', 20, true, d_provacab),
  (u_enci, 'Fregadero incluso conexión a fontanería', 'ud', 30, true, d_eqcocina);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_coc, 'Electrodomésticos', 30, true, d_eqcocina) RETURNING id INTO u_electro;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_electro, 'Suministro e instalación de electrodomésticos según listado de proyecto', 'pa', 10, true, d_eqcocina);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 17 — TERRAZA
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_terr, 'Pérgola', 10, true, d_eqperg) RETURNING id INTO u_perg;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_perg, 'Pérgola bioclimática o de aluminio incluso estructura, anclajes y motorización', 'pa', 10, true, d_eqperg);

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_terr, 'Barandilla', 20, true, d_eqbar) RETURNING id INTO u_baran;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_baran, 'Barandilla de aluminio, acero o vidrio incluso anclajes y acabado', 'ml', 10, true, d_eqbar);


-- ════════════════════════════════════════════════════════════════════════════
-- CAP 18 — VARIOS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.fpe_template_units (chapter_id, nombre, orden, activo, principal_discipline_id) VALUES
  (ch_varios, 'Varios', 10, true, d_alba) RETURNING id INTO u_varios;
INSERT INTO public.fpe_template_line_items (unit_id, nombre, unidad_medida, orden, activo, discipline_id) VALUES
  (u_varios, 'Partida alzada para imprevistos y trabajos no previstos', 'pa', 10, true, d_alba);


-- ════════════════════════════════════════════════════════════════════════════
-- FASES POR CAPÍTULO
-- ════════════════════════════════════════════════════════════════════════════

-- Cap 1 — DEMOLICIONES (8%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_demo, 'Preparación y protecciones', 10, 20, 0),
  (ch_demo, 'Demolición y vaciado',       20, 80, 0);

-- Cap 2 — REFUERZOS ESTRUCTURALES (4%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_ref, 'Proyecto técnico y permisos', 10, 30, 14),
  (ch_ref, 'Ejecución',                   20, 70, 0);

-- Cap 3 — ALBAÑILERÍA (15%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_alba, 'Tabiquería y trasdosados', 10, 50, 0),
  (ch_alba, 'Techos y foseados',        20, 30, 0),
  (ch_alba, 'Soleras y remates',        30, 20, 0);

-- Cap 4 — CARPINTERÍA METÁLICA (5%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_cmet, 'Medidas y fabricación', 10, 60, 21),
  (ch_cmet, 'Montaje',               20, 40, 0);

-- Cap 5 — CARPINTERÍA DE MADERA (12%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_cmadera, 'Medidas y proyecto',    10, 10, 0),
  (ch_cmadera, 'Fabricación',           20, 60, 30),
  (ch_cmadera, 'Montaje e instalación', 30, 30, 0);

-- Cap 6 — FONTANERÍA Y SANEAMIENTO (6%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_font, 'Distribución y saneamiento', 10, 70, 0),
  (ch_font, 'Conexión a aparatos',        20, 30, 0);

-- Cap 7 — GAS (2%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_gas, 'Instalación de red',              10, 70, 0),
  (ch_gas, 'Legalización y puesta en marcha', 20, 30, 7);

-- Cap 8 — CLIMATIZACIÓN (5%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_clima, 'Instalación de equipos',     10, 80, 14),
  (ch_clima, 'Puesta en marcha y pruebas', 20, 20, 0);

-- Cap 9 — VENTILACIÓN (3%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_vent, 'Conductos y bocas', 10, 80, 0),
  (ch_vent, 'Puesta en marcha',  20, 20, 0);

-- Cap 10 — ELECTRICIDAD (6%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_elec, 'Canalizaciones y cableado', 10, 50, 0),
  (ch_elec, 'Conexionado y cuadro',      20, 40, 0),
  (ch_elec, 'Pruebas',                   30, 10, 0);

-- Cap 11 — TELECOMUNICACIONES (2%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_tele, 'Cableado y cajas',        10, 70, 0),
  (ch_tele, 'Configuración y pruebas', 20, 30, 0);

-- Cap 12 — DOMÓTICA (3%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_domo, 'Cableado',             10, 30, 0),
  (ch_domo, 'Central y actuadores', 20, 40, 7),
  (ch_domo, 'Programación',         30, 30, 0);

-- Cap 13 — SONIDO (2%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_sonido, 'Cableado y altavoces', 10, 50, 0),
  (ch_sonido, 'Amplificador',         20, 20, 7),
  (ch_sonido, 'Configuración',        30, 30, 0);

-- Cap 14 — PINTURAS Y REVESTIMIENTOS (12%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_pint, 'Preparación de superficies', 10, 20, 0),
  (ch_pint, 'Aplicación de acabados',     20, 80, 0);

-- Cap 15 — EQUIPAMIENTO (4%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_equip, 'Acopio',                    10, 20, 21),
  (ch_equip, 'Instalación y conexionado', 20, 80, 0);

-- Cap 16 — COCINA (6%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_coc, 'Medidas y pedido',      10, 10, 0),
  (ch_coc, 'Fabricación',           20, 60, 45),
  (ch_coc, 'Montaje e instalación', 30, 30, 0);

-- Cap 17 — TERRAZA (3%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_terr, 'Fabricación',           10, 60, 30),
  (ch_terr, 'Instalación y acabado', 20, 40, 0);

-- Cap 18 — VARIOS (2%)
INSERT INTO public.fpe_template_phases (chapter_id, nombre, orden, duracion_pct, lead_time_days) VALUES
  (ch_varios, 'Ejecución', 10, 100, 0);


END $$;

COMMIT;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT
  ch.nombre AS capitulo,
  ch.duracion_pct,
  COUNT(DISTINCT u.id)  AS ues,
  COUNT(DISTINCT li.id) AS partidas,
  COUNT(DISTINCT ph.id) AS fases
FROM public.fpe_template_chapters ch
LEFT JOIN public.fpe_template_units u    ON u.chapter_id  = ch.id
LEFT JOIN public.fpe_template_line_items li ON li.unit_id = u.id
LEFT JOIN public.fpe_template_phases ph  ON ph.chapter_id = ch.id
GROUP BY ch.nombre, ch.orden, ch.duracion_pct
ORDER BY ch.orden;
