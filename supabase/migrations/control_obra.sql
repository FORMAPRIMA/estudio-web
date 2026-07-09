-- Control económico de obra — Claudio Coello 38
-- App interna /team/apps/control-obra (SOLO fp_partner).
-- Tablas solo vía service_role (Server Actions): RLS activado sin políticas.
-- Baseline congelado 14/01/2026: 11 capítulos, 259 partidas.


create table if not exists public.obra_control_obras (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  nombre         text not null,
  direccion      text,
  baseline_fecha date,
  margin_default numeric not null default 1.16,
  created_at     timestamptz not null default now()
);

create table if not exists public.obra_control_proveedores (
  id                  uuid primary key default gen_random_uuid(),
  obra_id             uuid not null references public.obra_control_obras(id) on delete cascade,
  nombre              text not null,
  notas               text,
  presupuesto_manual  numeric,            -- override; si null, se calcula de las partidas
  proveedor_global_id uuid,               -- gancho al módulo global de proveedores (futuro)
  orden               int not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists obra_control_proveedores_obra_idx on public.obra_control_proveedores (obra_id);

create table if not exists public.obra_control_partidas (
  id                 uuid primary key default gen_random_uuid(),
  obra_id            uuid not null references public.obra_control_obras(id) on delete cascade,
  capitulo_num       int not null,
  capitulo_nombre    text not null,
  subcapitulo_codigo text not null,
  subcapitulo_nombre text not null,
  codigo             text not null,
  descripcion        text not null,
  detalle            text,
  unidad             text,
  -- baseline congelado (no se toca nunca)
  base_qty           numeric,
  base_puc           numeric,
  base_pucl          numeric,
  -- estado actual
  qty                numeric,
  puc                numeric,
  margin             numeric not null default 1.16,
  pucl               numeric,
  pucl_auto          boolean not null default true,
  estado             text not null default 'igual',  -- igual|modificada|nueva|eliminada
  proveedor_id       uuid references public.obra_control_proveedores(id) on delete set null,
  motivo_interno     text,
  nota_cliente       text,
  orden              int not null default 0,
  modified_at        timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists obra_control_partidas_obra_idx on public.obra_control_partidas (obra_id);

create table if not exists public.obra_control_pagos (
  id           uuid primary key default gen_random_uuid(),
  obra_id      uuid not null references public.obra_control_obras(id) on delete cascade,
  proveedor_id uuid not null references public.obra_control_proveedores(id) on delete cascade,
  monto        numeric not null,          -- sin IVA
  fecha        date,
  fecha_texto  text,                      -- p.ej. "Pendiente"
  nota         text,
  orden        int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists obra_control_pagos_prov_idx on public.obra_control_pagos (proveedor_id);

create table if not exists public.obra_control_depositos (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obra_control_obras(id) on delete cascade,
  label       text,
  monto       numeric not null default 0, -- sin IVA
  iva         numeric not null default 0,
  total       numeric not null default 0, -- con IVA (entrada de caja real)
  fecha       date,
  fecha_texto text,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists obra_control_depositos_obra_idx on public.obra_control_depositos (obra_id);

create table if not exists public.obra_control_log (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null references public.obra_control_obras(id) on delete cascade,
  partida_codigo text,
  partida_desc  text,
  tipo          text not null,            -- modificada|nueva|eliminada|restaurada|pago|deposito
  resumen       text not null,
  motivo        text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists obra_control_log_obra_idx on public.obra_control_log (obra_id, created_at desc);

alter table public.obra_control_obras       enable row level security;
alter table public.obra_control_proveedores enable row level security;
alter table public.obra_control_partidas    enable row level security;
alter table public.obra_control_pagos        enable row level security;
alter table public.obra_control_depositos    enable row level security;
alter table public.obra_control_log          enable row level security;
-- Sin políticas: solo service_role (que bypassa RLS).

-- ─────────────── SEED · Claudio Coello 38 ───────────────
delete from public.obra_control_obras where id = 'a1c38000-0000-4000-8000-000000000038';
insert into public.obra_control_obras (id, slug, nombre, direccion, baseline_fecha, margin_default) values ('a1c38000-0000-4000-8000-000000000038', 'claudio-coello-38', 'Casa Claudio Coello 38', 'Calle Claudio Coello 38, Madrid', '2026-01-14', 1.16);

insert into public.obra_control_proveedores (id, obra_id, nombre, presupuesto_manual, orden) values
  ('f63755cf-3209-5142-9117-ac1c1cc4f5e5', 'a1c38000-0000-4000-8000-000000000038', 'Reformas Armico', 307265.5, 0),
  ('4fad0ee5-ef6b-5691-910e-f4953709d5cc', 'a1c38000-0000-4000-8000-000000000038', 'Vencomad', 29105.34, 1),
  ('ec2fc062-c584-515c-b17b-20f1bf77b2e2', 'a1c38000-0000-4000-8000-000000000038', 'Estores', 9289.94, 2),
  ('c3cb4e2f-a58d-5e71-a8b6-8e3c6af38922', 'a1c38000-0000-4000-8000-000000000038', 'Mamparas', 19070.06, 3),
  ('8c34f1e8-fb29-55fc-96d2-7695fb846faf', 'a1c38000-0000-4000-8000-000000000038', 'Muebles DEIMAR', 73288.0, 4),
  ('287fbd27-5c10-5435-b6fb-fcfae964557d', 'a1c38000-0000-4000-8000-000000000038', 'Elec3domo', 55525.4, 5),
  ('01c9f60b-6977-5f66-870f-8d8f07758de1', 'a1c38000-0000-4000-8000-000000000038', 'Luz Optima', 19404.33, 6),
  ('1b552706-ded8-5eda-b4ed-975a28951301', 'a1c38000-0000-4000-8000-000000000038', 'Allwood', 23287.986, 7),
  ('1a85639f-e3d7-5e13-af64-d058083512a9', 'a1c38000-0000-4000-8000-000000000038', 'Duravit', 5737.0, 8),
  ('a23df394-9d7e-57e6-be16-d93a3ce65be7', 'a1c38000-0000-4000-8000-000000000038', 'Griferias y accesorios', 12489.0, 9),
  ('7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 'a1c38000-0000-4000-8000-000000000038', 'Bolero Studio', 168279.0454, 10),
  ('e6f78c8a-952d-54a6-b115-a6803b649f2b', 'a1c38000-0000-4000-8000-000000000038', 'Orac', 6660.0, 11),
  ('004deff1-d228-566c-b479-5d489aa6bad6', 'a1c38000-0000-4000-8000-000000000038', 'Matter', 17085.66, 12),
  ('4f3b34e8-7235-58b1-8354-18bb9bd74db8', 'a1c38000-0000-4000-8000-000000000038', 'Huguet', 22029.62, 13),
  ('59023776-2a04-5059-960d-2391706e3954', 'a1c38000-0000-4000-8000-000000000038', 'Bang & Olufsen', 23460.993, 14),
  ('efc20f1d-cb8a-55ba-9daf-dbabe2926969', 'a1c38000-0000-4000-8000-000000000038', 'Forma prima', null, 15),
  ('bd926912-d669-59a6-ac52-90b55f531d1d', 'a1c38000-0000-4000-8000-000000000038', 'Quatro lucce', null, 16),
  ('a5ce04c1-2e83-59b4-99a7-ca9be2d1aabd', 'a1c38000-0000-4000-8000-000000000038', 'Antonio Luppi', null, 17);

insert into public.obra_control_partidas (obra_id, capitulo_num, capitulo_nombre, subcapitulo_codigo, subcapitulo_nombre, codigo, descripcion, detalle, unidad, base_qty, base_puc, base_pucl, qty, puc, margin, pucl, pucl_auto, estado, proveedor_id, orden) values
  ('a1c38000-0000-4000-8000-000000000038', 1, 'DEMOLICIONES Y TRABAJOS PREVIOS', '1_DYT_01', 'Protecciones y actuaciones previas', '1_DYT_01.1', 'Demolición de tableros antiguos de madera', 'Quitar el suelo de madera y llevarlo al vertedero', 'LOTE', 1.0, 3500.0, 4060.0, 1.0, 3500.0, 1.16, 4060.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 1),
  ('a1c38000-0000-4000-8000-000000000038', 1, 'DEMOLICIONES Y TRABAJOS PREVIOS', '1_DYT_01', 'Protecciones y actuaciones previas', '1_DYT_01.2', 'Subida de materiales por escalera', 'Partida alzada en concepto de subida de materiales por escalera y/o maquinilla por imposibilidad de utilización de ascensor.', 'LOTE', 1.0, 9700.0, 11252.0, 1.0, 9700.0, 1.16, 11252.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 2),
  ('a1c38000-0000-4000-8000-000000000038', 1, 'DEMOLICIONES Y TRABAJOS PREVIOS', '1_DYT_02', 'Ventanas', '1_DYT_02.1', 'Demolición ventanas', 'Quitar las ventanas actuales de madera y llevarlas al vertedero', '', 15.0, 590.0, 684.4, 15.0, 590.0, 1.16, 684.4, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 3),
  ('a1c38000-0000-4000-8000-000000000038', 1, 'DEMOLICIONES Y TRABAJOS PREVIOS', '1_DYT_03', 'Cargas y transportes', '1_DYT_03.1', 'Alquiler contenedor 6m3', 'Servicio de entrega y recogida de contenedor de 6 m3 de capacidad, colocado a pie de calle, sin incluir las licencias y permisos necesarios por cumplir con la normativa urbanística del Ayuntamiento de Madrid', '', 7.0, 225.0, 261.0, 7.0, 225.0, 1.16, 261.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 4),
  ('a1c38000-0000-4000-8000-000000000038', 1, 'DEMOLICIONES Y TRABAJOS PREVIOS', '1_DYT_03', 'Cargas y transportes', '1_DYT_03.2', 'Carga/evacuación escombros en sacos', 'Carga de escombros en sacos y evacuación a una distancia máxima de 20 m, por medios manuales, sobre camión pequeño, contenedor o tubo de evacuación, sin medidos de protección colectivas.', '', 100.0, 24.8, 28.77, 100.0, 24.8, 1.16, 28.77, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 5),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_01', 'Demoliciones - Fase de refuerzos', '2_RE_01.1', 'Apeo estruct. c/puntales metálicos y arreglo de desperfectos vecino inferior', 'M2. Apeo de estructura mediante sopandas y durmientes de madera y puntales metálicos, hasta una altura máxima de 3 m., i/replanteo y p.p. de costes indirectos.', 'UD.', 1.0, 1100.0, 1276.0, 1.0, 1100.0, 1.16, 1276.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 6),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_01', 'Demoliciones - Fase de refuerzos', '2_RE_01.2', 'Demolición pie derecho de madera', 'Ml. Demolición de pie derecho de madera, de 20x20 c, de sección, por medios manuales, i/retirada de escombros a pie de carga, medios auxiliares de obra y p.p. de costes indirectos, según NTE/ADD-7 y 8.', 'ML', 6.0, 290.0, 336.4, 6.0, 290.0, 1.16, 336.4, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 7),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_01', 'Demoliciones - Fase de refuerzos', '2_RE_01.3', 'Saco contenedor 1 m3.', 'Ud. Cambio de saco-contenedor de 1 m3. de capacidad, colocado en obra a pie de carga, incluso servicio de entrega, alquiler, tasas por ocupación de vía pública y parte proporcional de costes indirectos, incluidos los medios auxiliares de señalización.', 'UD.', 2.0, 85.0, 98.6, 2.0, 85.0, 1.16, 98.6, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 8),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_02', 'Estructura', '2_RE_02.1', 'Encofrado viguetas', 'Ml. Encofrado y desencofrado de viguetas de madera, mediante placas de cartón-yeso de 13 mm., de 25 cm. de altura, dispuesto en los laterales de las viguetas de madera mediante acodalado o fijación mecánica, considerando una postura.', 'ML', 300.0, 18.7, 21.7, 300.0, 18.7, 1.16, 21.7, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 9),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_02', 'Estructura', '2_RE_02.2', 'Mortero epoxídico', 'M3. Recrecido y nivelación de vigueta de madera mediante el vertido de mortero de reparación de dos componentes a base de resina epoxi, tixotrópico, con una resistencia a compresión a 28 días mayor o igual a 30 N/mm² y un módulo de elasticidad mayor o igual a 20000 N/mm², clase R3 según UNE-EN 1504-3, Euroclase F de reacción al fuego, según UNE-EN 13501-1.', 'M3', 0.96, 5300.0, 6148.0, 0.96, 5300.0, 1.16, 6148.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 10),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_02', 'Estructura', '2_RE_02.3', 'Listones de madera', 'Ml. Colocacicón de listones de madera de pino, de 80 x 20 mm., con aditivo hidrófugo, M-10, para nivelación y soporte de la capa de compresión, fijados mediante clavos de acero a las viguetas prexistentes.', 'ML', 1280.0, 16.5, 19.14, 1280.0, 16.5, 1.16, 19.14, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 11),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_02', 'Estructura', '2_RE_02.4', 'Conectores', 'Ud. Colocación de conectores formados por tornillos de acero galvanizado (calidad 6.8 según UNE-EN ISO 898-1), de 10 mm de diámetro y 100 mm de longitud, con cabeza hexagonal, rosca métrica total, tuercas y arandelas, fijados a las viguetas de madera; 5 conectores por m2. i/p.p. de replantes y medios auxiliares.', 'UD.', 1063.0, 3.6, 4.18, 1063.0, 3.6, 1.16, 4.18, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 12),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_02', 'Estructura', '2_RE_02.5', 'Capa compresión hor. lig. arlita', 'M2. Refuerzo de forjado de viguetas de madera, mediante apoyo sobre las viguetas de encofrado de chapa de acero laminado en frío "NERVOMETAL" de 0,5 mm de espesor; acero UNE-EN 10080 B 500 S, cuantía 1,1 kg/m², capa de compresión de 5 cm de espesor de de hormigon ligero HL175 densidad aprox. 1550, confeccionado con ARLITA F-5 fratasado, fabricado en obra.', 'M2', 262.0, 132.0, 153.12, 262.0, 132.0, 1.16, 153.12, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 13),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_02', 'Estructura', '2_RE_02.6', 'Placa apoyo S275 20x20x1,2 cm.', 'Ud. Placa de apoyo en acero S275 para elementos estructurales sencillos, colocados sobre fábricas, constituida por pieza de chapa laminada de 12 mm. de espesor y 20x20 cm. de superficie, sentada sobre mortero de cemento M5, i/replanteo y nivelado, según CTE/ DB-SE-A.', 'UD.', 2.0, 180.0, 208.8, 2.0, 180.0, 1.16, 208.8, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 14),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_02', 'Estructura', '2_RE_02.7', 'Acero S275 en estructuras', 'Kg. Acero laminado S275 en perfiles para vigas, pilares y correas, con una tensión de rotura de 410 N/mm2, unidas entre sí mediante soldadura con electrodo básico i/p.p. despuntes y dos manos de imprimación con pintura de minio de plomo totalmente montado, según CTE/ DB-SE-A. Los trabajos serán realizados por soldador cualificado según norma UNE-EN 287-1:1992.', 'KG', 544.0, 12.0, 13.92, 544.0, 12.0, 1.16, 13.92, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 15),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_02', 'Estructura', '2_RE_02.8', 'Redondos para refuerzos de negativos encima de vigueta', '', 'LOTE', 1.0, 1960.0, 2273.6, 1.0, 1960.0, 1.16, 2273.6, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 16),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_02', 'Estructura', '2_RE_02.9', 'Limpieza techo escayola', '', 'UD.', 1.0, 1280.0, 1484.8, 1.0, 1280.0, 1.16, 1484.8, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 17),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_02', 'Estructura', '2_RE_02.10', 'Colocación escayola con esparto para reforzar el techo', '', 'UD.', 1.0, 980.0, 1136.8, 1.0, 980.0, 1.16, 1136.8, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 18),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_02', 'Estructura', '2_RE_02.11', 'Colocación ganchos a las paredes y vigas de madera para reforzar antes de hormigonear', '', 'UD.', 1.0, 1800.0, 2088.0, 1.0, 1800.0, 1.16, 2088.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 19),
  ('a1c38000-0000-4000-8000-000000000038', 2, 'REFUERZOS ESTRUCTURALES', '2_RE_03', 'Muros de carga', '2_RE_03.1', 'Cargadero y pies derechos', '', 'UD.', 3.0, 1260.0, 1461.6, 3.0, 1260.0, 1.16, 1461.6, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 20),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_01', 'Trasdosados de pladur', '3_ALB_01.1', 'Trasdosado 13+13+46+ lana de roca', 'Trasdosado autoportante formado por una estructura de perfiles . Unión entre paneles mediante el empleo de pegamento paro juntas. Emplastecido dejuntas, con pasta dejuntas, i/p.P. De replanteo, tratamiento de huecos, paso de instalaciones, limpieza y medios auxiliares. Totalmente terminado y listo paro imprimar y pintor o decorar. Según nte-ptp, une 102041 y medicion sin tomar en cuenta huecos menores a 2m2', 'M2', 375.0, 51.0, 59.16, 375.0, 51.0, 1.16, 59.16, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 21),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_02', 'Tabiqueria de pladur', '3_ALB_02.1', 'Tabique multiple (13+13+46+13+13) e=98mm/600 aislam. t/acust', 'Tabique múltiple outoportonte formado por montantes separados 600 mm y cono/es de perfiles de acero galvanizado de 46 mm, atornillado por cado coro dos placas de 13 mm de espesor con un ancho total de 98 mm, sin aislamiento. !/ p.p. de suministro y colocacioón de aislamiento de lana de roca y lámina aislamiento acústico, de tratamiento de huecos, paso de instalaciones, tornillería, pastas de agarre y juntos, cintos poro juntos, anclajes paro suelo y techo, limpieza y medios auxiliares. Totalmente terminado y listo para imprimar y pintar o decorar. Según nte-ptp, une 102040 in y atedy. Medido deduciendo los huecos de superficie mayor de 2 m2.', 'M2', 199.0, 75.0, 87.0, 199.0, 75.0, 1.16, 87.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 22),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_02', 'Tabiqueria de pladur', '3_ALB_02.2', 'Recibido cercos en tabiques atornillado', 'Recibido y aplomado de cercos o precercos de cualquier material en tabiques, atornillado a montantes de tabiquería de yeso laminado, totalmente colocado y aplomado. Incluso material auxiliar, limpieza y medios auxiliares . Medida lo superficie realmente ejecutada.', 'UD.', 6.0, 90.0, 104.4, 6.0, 90.0, 1.16, 104.4, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 23),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_02', 'Tabiqueria de pladur', '3_ALB_02.3', 'Refuerzos de tableros de madera en pladurs', 'Ejecución de refuerzos de madera en tabiquería o placas de yeso laminado, paro cuelgue de elementos pesados, atornillado a montantes de estructura de acero galvanizado de tabiquería.', 'UD.', 1.0, 980.0, 1136.8, 1.0, 980.0, 1.16, 1136.8, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 24),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_03', 'Falsos techos', '3_ALB_03.1', 'Falso techo yeso laminado uso N/W -15', 'Falso techo formado por una placa de yeso laminado N/W de 15 mm de espesor, colocada sobre uno estructuro oculta de acero galvanizado, formada por perfiles tic de 47 mm coda 40 cm y perfilería u de 34x31x34 mm, i/replanteo auxiliar, accesorios defijación, nivelación y reposo de juntas con cinto y posta, montaje y desmontaje de andamios, terminado s/nte-rtc, medido deduciendo huecos sup. a  2 m2.', 'M2', 258.0, 41.5, 48.14, 258.0, 41.5, 1.16, 48.14, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 25),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_04', 'Foseados y tabicas', '3_ALB_04.1', 'Foseado - Cortineros reforzados', '', 'ML', 19.0, 59.0, 68.44, 19.0, 59.0, 1.16, 68.44, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 26),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_04', 'Foseados y tabicas', '3_ALB_04.2', 'Foseados candilejas', '', 'ML', 65.0, 43.0, 49.88, 65.0, 43.0, 1.16, 49.88, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 27),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_04', 'Foseados y tabicas', '3_ALB_04.3', 'Franja perimetral', '', 'M2', 31.8, 42.0, 48.72, 31.8, 42.0, 1.16, 48.72, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 28),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_05', 'Soleras y rellenos', '3_ALB_05.1', 'Recrecido suelo radiante', 'Recrecido de 16 mm de terminado de suelo radiante', '', 262.0, 25.0, 29.0, 262.0, 25.0, 1.16, 29.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 29),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_05', 'Soleras y rellenos', '3_ALB_05.2', 'Recrecido zona tarima', 'Recrecido de 15 mm para igualar cotas de pavimento', '', 144.0, 31.0, 35.96, 144.0, 31.0, 1.16, 35.96, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 30),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_06', 'Ayudas albañileria', '3_ALB_06.1', 'Suministro y colocación de guías para puertas correderas', '', '', 6.0, 360.0, 417.6, 6.0, 360.0, 1.16, 417.6, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 31),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_06', 'Ayudas albañileria', '3_ALB_06.2', 'Recibido de cercos en tabiques atornillados', 'Recibido y aplomado de cercos o precercos de cualquier material en tabiques, atornillado a montantes de tabiquería de yeso laminado, totalmente colocado y aplomado. Incluso material auxiliar, limpieza y medios auxiliares . Medida lo superficie realmente ejecutada.', '', 6.0, 90.0, 104.4, 6.0, 90.0, 1.16, 104.4, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 32),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_06', 'Ayudas albañileria', '3_ALB_06.3', 'Hornacinas', 'Creación de hornacinas de pladur en duchas y nichos decorativos', '', 6.0, 310.0, 359.6, 6.0, 310.0, 1.16, 359.6, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 33),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_06', 'Ayudas albañileria', '3_ALB_06.4', 'Ayudas de albañilería', 'Ayuda de albañilería a instalaciones de electricidad, fontanería y calefacción, ventilación y telecomunicaciones por vivienda incluyendo mano de obra en carga y descarga, materiales, apertura y tapado de rozas y recibidos, i/p.P. De material auxiliar, limpieza y medios auxiliares.', '', 1.0, 9500.0, 11020.0, 1.0, 9500.0, 1.16, 11020.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 34),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_06', 'Ayudas albañileria', '3_ALB_06.5', 'Guarnecido, maestreado y enlucido', 'Guarnecido maestreado con yeso negro y enlucido con yeso blanco en paramentos verticales y horizontales de 15 mm. De espesor, con maestras cada 1,50 m., Incluso formación de rincones, guarniciones de huecos, remates con pavimento, p.P. De guardavivos de plástico y metal y colocación de andamios, s/nte-rpg, medido a cinta corrida.', '', 1.0, 2000.0, 2320.0, 1.0, 2000.0, 1.16, 2320.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 35),
  ('a1c38000-0000-4000-8000-000000000038', 3, 'ALBAÑILERIA', '3_ALB_06', 'Ayudas albañileria', '3_ALB_06.6', 'Remates de ventanas interior / exterior', 'Remates interiores de ventanas, y exteriores en su caso, tras el recibido de las nuevas, cegando la parte superior en capialzados de persianas, remates laterales perimetrales de las mismas, y en muros exteriores en casa de apertura de huecos enfachada.', '', 1.0, 3000.0, 3480.0, 1.0, 3000.0, 1.16, 3480.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 36),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_01', 'Ventanas de madera', '4_CYV_01.1', 'V01 – Madera', 'Marco: Marco_90 (Rekolux_68)
Hoja: Hoja_68 (Rekolux_68)
Madera: 01_pino laminado
Acabado: Lacado catalizador
Color: RAL 9016, blanco
Apertura:
DK DX
Vidrio:
3+3 Silence / 16 / 4 bajo emisivo', 'UD.', 2.0, 2558.0, 2967.28, 2.0, 2558.0, 1.16, 2967.28, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 37),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_01', 'Ventanas de madera', '4_CYV_01.2', 'V02 – Madera', 'Marco: Marco_90 (Rekolux_68)
Hoja: Hoja_68 (Rekolux_68)
Madera: 01_pino laminado
Acabado: Lacado catalizador
Color: RAL 9016, blanco
Apertura:
DK DX
Vidrio:
3+3 Silence / 16 / 4 bajo emisivo', 'UD.', 2.0, 2558.0, 2967.28, 2.0, 2558.0, 1.16, 2967.28, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 38),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_01', 'Ventanas de madera', '4_CYV_01.3', 'V03 – Madera', 'Marco: Marco_90 (Rekolux_68)
Hoja: Hoja_68 (Rekolux_68)
Madera: 01_pino laminado
Acabado: Lacado catalizador
Color: RAL 9016, blanco
Apertura:
DK DX
Vidrio:
3+3 Silence / 16 / 4 bajo emisivo', 'UD.', 1.0, 1653.08, 1917.58, 1.0, 1653.08, 1.16, 1917.58, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 39),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_01', 'Ventanas de madera', '4_CYV_01.4', 'V04 – Madera', 'Marco: Marco_90 (Rekolux_68)
Hoja: Hoja_68 (Rekolux_68)
Madera: 01_pino laminado
Acabado: Lacado catalizador
Color: RAL 9016, blanco
Apertura:
DK DX
Vidrio:
3+3 Silence / 16 / 4 bajo emisivo', 'UD.', 1.0, 1844.99, 2140.19, 1.0, 1844.99, 1.16, 2140.19, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 40),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_01', 'Ventanas de madera', '4_CYV_01.5', 'V07 – Madera', 'Marco: Marco_90 (Rekolux_68)
Hoja: Hoja_68 (Rekolux_68)
Madera: 01_pino laminado
Acabado: Lacado catalizador
Color: RAL 9016, blanco
Apertura:
DK DX
Vidrio:
3+3 Silence / 16 / 4 bajo emisivo', 'UD.', 1.0, 2184.92, 2534.51, 1.0, 2184.92, 1.16, 2534.51, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 41),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_01', 'Ventanas de madera', '4_CYV_01.6', 'V12 – Madera', 'Marco: Marco_90 (Rekolux_68)
Hoja: Hoja_68 (Rekolux_68)
Madera: 01_pino laminado
Acabado: Lacado catalizador
Color: RAL 9016, blanco
Apertura:
DK DX
Vidrio:
3+3 Silence / 16 / 4 bajo emisivo', 'UD.', 1.0, 2181.94, 2531.06, 1.0, 2181.94, 1.16, 2531.06, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 42),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_01', 'Ventanas de madera', '4_CYV_01.7', 'V13 – Madera', 'Marco: Marco_90 (Rekolux_68)
Hoja: Hoja_68 (Rekolux_68)
Madera: 01_pino laminado
Acabado: Lacado catalizador
Color: RAL 9016, blanco
Apertura:
DK DX
Vidrio:
3+3 Silence / 16 / 4 bajo emisivo', 'UD.', 1.0, 2238.41, 2596.56, 1.0, 2238.41, 1.16, 2596.56, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 43),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_01', 'Ventanas de madera', '4_CYV_01.8', 'Suministro y montaje x 9 UDS de madera', '', 'UD.', 1.0, 2700.0, 3132.0, 1.0, 2700.0, 1.16, 3132.0, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 44),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_02', 'Ventanas de PVC', '4_CYV_02.1', 'V05 - PVC', 'Material: PVC blanco
Sistema: Perfiles multicámara de 70–76 mm aprox.V
idrio: 4 / 16 / 4 bajo emisivo
Persianas: Cajón exterior 200 × 186 mm aprox., lama 45 mm PVC blanco
Recogedor: Empotrado 16 mm
Microventilación: Sí', 'UD.', 1.0, 675.0, 783.0, 1.0, 675.0, 1.16, 783.0, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 45),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_02', 'Ventanas de PVC', '4_CYV_02.2', 'V06 - PVC', 'Material: PVC blanco
Sistema: Perfiles multicámara de 70–76 mm aprox.V
idrio: 4 / 16 / 4 bajo emisivo
Persianas: Cajón exterior 200 × 186 mm aprox., lama 45 mm PVC blanco
Recogedor: Empotrado 16 mm
Microventilación: Sí', 'UD.', 1.0, 595.0, 690.2, 1.0, 595.0, 1.16, 690.2, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 46),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_02', 'Ventanas de PVC', '4_CYV_02.3', 'V08 - PVC', 'Material: PVC blanco
Sistema: Perfiles multicámara de 70–76 mm aprox.V
idrio: 4 / 16 / 4 bajo emisivo
Persianas: Cajón exterior 200 × 186 mm aprox., lama 45 mm PVC blanco
Recogedor: Empotrado 16 mm
Microventilación: Sí', 'UD.', 1.0, 1230.0, 1426.8, 1.0, 1230.0, 1.16, 1426.8, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 47),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_02', 'Ventanas de PVC', '4_CYV_02.4', 'V09 - PVC', 'Material: PVC blanco
Sistema: Perfiles multicámara de 70–76 mm aprox.V
idrio: 4 / 16 / 4 bajo emisivo
Persianas: Cajón exterior 200 × 186 mm aprox., lama 45 mm PVC blanco
Recogedor: Empotrado 16 mm
Microventilación: Sí', 'UD.', 1.0, 610.0, 707.6, 1.0, 610.0, 1.16, 707.6, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 48),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_02', 'Ventanas de PVC', '4_CYV_02.5', 'V10 - PVC', 'Material: PVC blanco
Sistema: Perfiles multicámara de 70–76 mm aprox.V
idrio: 4 / 16 / 4 bajo emisivo
Persianas: Cajón exterior 200 × 186 mm aprox., lama 45 mm PVC blanco
Recogedor: Empotrado 16 mm
Microventilación: Sí', 'UD.', 1.0, 580.0, 672.8, 1.0, 580.0, 1.16, 672.8, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 49),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_02', 'Ventanas de PVC', '4_CYV_02.6', 'V11 - PVC', 'Material: PVC blanco
Sistema: Perfiles multicámara de 70–76 mm aprox.V
idrio: 4 / 16 / 4 bajo emisivo
Persianas: Cajón exterior 200 × 186 mm aprox., lama 45 mm PVC blanco
Recogedor: Empotrado 16 mm
Microventilación: Sí', 'UD.', 1.0, 580.0, 672.8, 1.0, 580.0, 1.16, 672.8, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 50),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_02', 'Ventanas de PVC', '4_CYV_02.7', 'Premarcos de pino para 6 unidades de PVC', '', 'UD.', 1.0, 0.0, 0.0, 1.0, 0.0, 1.16, 0.0, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 51),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_02', 'Ventanas de PVC', '4_CYV_02.8', 'Suministro y montaje de 6 unidades de PVC', '', 'UD.', 1.0, 1800.0, 2088.0, 1.0, 1800.0, 1.16, 2088.0, true, 'igual', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 52),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_03', 'Persianas y estores', '4_CYV_03.1', 'Ventana V-02', 'Suministro e instalación de estores enrollables interiores Bandalux, fabricados a medida, con tejido tipo Blackout T3 (color y acabado por definir), montados en cajón técnico Zi Box 100, incluyendo motorización Somfy con cableado.', 'UD.', 2.0, 1114.93, 1293.32, 2.0, 1114.93, 1.16, 1293.32, true, 'igual', 'ec2fc062-c584-515c-b17b-20f1bf77b2e2', 53),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_03', 'Persianas y estores', '4_CYV_03.2', 'Ventana V-03', 'Suministro e instalación de estores enrollables interiores Bandalux, fabricados a medida, con tejido tipo Blackout T3 (color y acabado por definir), montados en cajón técnico Zi Box 100, incluyendo motorización Somfy con cableado.', 'UD.', 1.0, 1013.68, 1175.87, 1.0, 1013.68, 1.16, 1175.87, true, 'igual', 'ec2fc062-c584-515c-b17b-20f1bf77b2e2', 54),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_03', 'Persianas y estores', '4_CYV_03.3', 'Ventana V-10', 'Suministro e instalación de estores enrollables interiores Bandalux, fabricados a medida, con tejido tipo Blackout T3 (color y acabado por definir), montados en cajón técnico Zi Box 100, incluyendo motorización Somfy con cableado.', 'UD.', 1.0, 915.43, 1061.9, 1.0, 915.43, 1.16, 1061.9, true, 'igual', 'ec2fc062-c584-515c-b17b-20f1bf77b2e2', 55),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_03', 'Persianas y estores', '4_CYV_03.4', 'Ventana V-11', 'Suministro e instalación de estores enrollables interiores Bandalux, fabricados a medida, con tejido tipo Blackout T3 (color y acabado por definir), montados en cajón técnico Zi Box 100, incluyendo motorización Somfy con cableado.', 'UD.', 1.0, 868.93, 1007.96, 1.0, 868.93, 1.16, 1007.96, true, 'igual', 'ec2fc062-c584-515c-b17b-20f1bf77b2e2', 56),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_03', 'Persianas y estores', '4_CYV_03.5', 'Ventana V-12', 'Suministro e instalación de estores enrollables interiores Bandalux, fabricados a medida, con tejido tipo Blackout T3 (color y acabado por definir), montados en cajón técnico Zi Box 100, incluyendo motorización Somfy con cableado.', 'UD.', 1.0, 1069.93, 1241.12, 1.0, 1069.93, 1.16, 1241.12, true, 'igual', 'ec2fc062-c584-515c-b17b-20f1bf77b2e2', 57),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_03', 'Persianas y estores', '4_CYV_03.6', 'Ventana V-02', 'Suministro e instalación de estores tipo paqueto plegables, fabricados a medida, con confección plegable sobre riel Toxa, incluyendo riel motorizado con cable y tejido Calata FR.
La partida comprende la confección a medida del estor, suministro del tejido ignífugo Calata FR, sistema de riel Toxa, motor eléctrico con cableado, herrajes y accesorios necesarios, montaje, nivelación, ajuste y puesta en funcionamiento, quedando el conjunto completamente instalado y operativo.', 'UD.', 2.0, 603.65, 700.24, 2.0, 603.65, 1.16, 700.24, true, 'igual', 'ec2fc062-c584-515c-b17b-20f1bf77b2e2', 58),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_03', 'Persianas y estores', '4_CYV_03.7', 'Ventana V-03', 'Suministro e instalación de estores tipo paqueto plegables, fabricados a medida, con confección plegable sobre riel Toxa, incluyendo riel motorizado con cable y tejido Calata FR.
La partida comprende la confección a medida del estor, suministro del tejido ignífugo Calata FR, sistema de riel Toxa, motor eléctrico con cableado, herrajes y accesorios necesarios, montaje, nivelación, ajuste y puesta en funcionamiento, quedando el conjunto completamente instalado y operativo.', 'UD.', 1.0, 518.14, 601.05, 1.0, 518.14, 1.16, 601.05, true, 'igual', 'ec2fc062-c584-515c-b17b-20f1bf77b2e2', 59),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_03', 'Persianas y estores', '4_CYV_03.8', 'Ventana V-10', 'Suministro e instalación de estores tipo paqueto plegables, fabricados a medida, con confección plegable sobre riel Toxa, incluyendo riel motorizado con cable y tejido Calata FR.
La partida comprende la confección a medida del estor, suministro del tejido ignífugo Calata FR, sistema de riel Toxa, motor eléctrico con cableado, herrajes y accesorios necesarios, montaje, nivelación, ajuste y puesta en funcionamiento, quedando el conjunto completamente instalado y operativo.', 'UD.', 1.0, 474.64, 550.59, 1.0, 474.64, 1.16, 550.59, true, 'igual', 'ec2fc062-c584-515c-b17b-20f1bf77b2e2', 60),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_03', 'Persianas y estores', '4_CYV_03.9', 'Ventana V-11', 'Suministro e instalación de estores tipo paqueto plegables, fabricados a medida, con confección plegable sobre riel Toxa, incluyendo riel motorizado con cable y tejido Calata FR.
La partida comprende la confección a medida del estor, suministro del tejido ignífugo Calata FR, sistema de riel Toxa, motor eléctrico con cableado, herrajes y accesorios necesarios, montaje, nivelación, ajuste y puesta en funcionamiento, quedando el conjunto completamente instalado y operativo.', 'UD.', 1.0, 474.64, 550.59, 1.0, 474.64, 1.16, 550.59, true, 'igual', 'ec2fc062-c584-515c-b17b-20f1bf77b2e2', 61),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_03', 'Persianas y estores', '4_CYV_03.10', 'Ventana V-12', 'Suministro e instalación de estores tipo paqueto plegables, fabricados a medida, con confección plegable sobre riel Toxa, incluyendo riel motorizado con cable y tejido Calata FR.
La partida comprende la confección a medida del estor, suministro del tejido ignífugo Calata FR, sistema de riel Toxa, motor eléctrico con cableado, herrajes y accesorios necesarios, montaje, nivelación, ajuste y puesta en funcionamiento, quedando el conjunto completamente instalado y operativo.', 'UD.', 1.0, 517.39, 600.18, 1.0, 517.39, 1.16, 600.18, true, 'igual', 'ec2fc062-c584-515c-b17b-20f1bf77b2e2', 62),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_04', 'Mamparas', '4_CYV_04.1', 'Mamparas baño master', 'Perfileria de aluminio, vidrio texturizado', 'UD.', 2.0, 2855.0, 3311.8, 2.0, 2855.0, 1.16, 3311.8, true, 'igual', 'c3cb4e2f-a58d-5e71-a8b6-8e3c6af38922', 63),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_04', 'Mamparas', '4_CYV_04.2', 'Mamparas baño Dormitorio 1', 'Perfileria de aluminio, vidrio texturizado', 'UD.', 1.0, 2712.5, 3146.5, 1.0, 2712.5, 1.16, 3146.5, true, 'igual', 'c3cb4e2f-a58d-5e71-a8b6-8e3c6af38922', 64),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_04', 'Mamparas', '4_CYV_04.3', 'Mamparas baño Dormitorio 2', 'Perfileria de aluminio, vidrio texturizado', 'UD.', 2.0, 3503.78, 4064.39, 2.0, 3503.78, 1.16, 4064.39, true, 'igual', 'c3cb4e2f-a58d-5e71-a8b6-8e3c6af38922', 65),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_04', 'Mamparas', '4_CYV_04.4', 'Puerta corredera cocina', 'Perfileria de aluminio, vidrio texturizado', 'UD.', 1.0, 3640.0, 4222.4, 1.0, 3640.0, 1.16, 4222.4, true, 'igual', 'c3cb4e2f-a58d-5e71-a8b6-8e3c6af38922', 66),
  ('a1c38000-0000-4000-8000-000000000038', 4, 'CARPINTERIA EXTERIOR Y VIDRIERIA', '4_CYV_05', 'Espejos', '4_CYV_05.1', 'Espejos retroiluminados a medida', '', 'UD.', 5.0, 520.0, 603.2, 5.0, 520.0, 1.16, 603.2, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 67),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_01', 'Puertas de acceso a vivienda', '5_CM_01.1', 'Panelado puerta de entrada y embocadura', 'Suministro e instalación de panelado de puertas de entrada según diseño, más arco de entrada, fabricado en tablero de chapa natural, barnizado natural. Herrajes no incluidos, cerradura y pernio, etc.', 'UD.', 1.0, 925.0, 1073.0, 1.0, 925.0, 1.16, 1073.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 68),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_01', 'Puertas de acceso a vivienda', '5_CM_01.2', 'Panel puerta servicio P15', 'Suministro e instalación de panelado de puertas de entrada según diseño, más arco de entrada, fabricado en tablero de chapa natural, barnizado natural (herrajes no incluidos, cerradura y pernio, etc.).', 'UD.', 1.0, 420.0, 487.2, 1.0, 420.0, 1.16, 487.2, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 69),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_02', 'Puertas de paso abatibles', '5_CM_02.1', 'Puertas de paso P2, P3, P4 + remate embocadura', 'Suministro e instalacion puerta de paso segun diseño con pernios ocultos, resvalon ainmantado o, sin tapetas con remates tipo embocadura, fabricado en tablero roble chapa natural.', 'UD.', 3.0, 1400.0, 1624.0, 3.0, 1400.0, 1.16, 1624.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 70),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_02', 'Puertas de paso abatibles', '5_CM_02.2', 'Puerta de paso P5+ remate embocadura', 'Suministro e instalacion puerta de paso segun diseño con pernios ocultos, resvalon ainmantado, sin tapetas con remates tipo embocadura en tablero roble chapa natural.', 'UD.', 1.0, 1200.0, 1392.0, 1.0, 1200.0, 1.16, 1392.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 71),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_02', 'Puertas de paso abatibles', '5_CM_02.3', 'Puerta lisa servicio P11', 'Suministro e instalacion puerta de paso segun diseño con pernios ocultos, resvalon ainmantado, sin tapetas con remates tipo embocadura en tablero roble chapa natural.', 'UD.', 1.0, 850.0, 986.0, 1.0, 850.0, 1.16, 986.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 72),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_02', 'Puertas de paso abatibles', '5_CM_02.4', 'Puerta de paso P13 + embocadura', 'Suministro e instalacion puerta de paso segun diseño con pernios ocultos, resvalon ainmantado, sin tapetas con remates tipo embocadura, fabricado en tablero roble chapa natural.', 'UD.', 1.0, 1800.0, 2088.0, 1.0, 1800.0, 1.16, 2088.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 73),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_03', 'Puertas de paso correderas', '5_CM_03.1', 'Puerta corredera 1 vidrio P6', 'Suministro e instalacion puerta de paso segun diseño con pernios ocultos, resvalon aimantado, sin tapetas con remates tipo embocadura, fabricado en tablero roble chapa natural.', 'UD.', 1.0, 1800.0, 2088.0, 1.0, 1800.0, 1.16, 2088.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 74),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_03', 'Puertas de paso correderas', '5_CM_03.2', 'Puerta corredera lisa P12', 'Suministro e instalacion puerta de paso segun diseño con pernios ocultos, resvalon aimantado, sin tapetas con remates tipo embocadura, fabricado en tablero roble chapa natural.', 'UD.', 1.0, 610.0, 707.6, 1.0, 610.0, 1.16, 707.6, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 75),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_04', 'Armarios a medida', '5_CM_04.1', 'Armario M01DE 268x158 cm', 'Suministro e instalacion de armario interior melamina de diseño a elegir, distribucion segun plano, frente con puertas abatibles fabricado en tablero roble chapa natural, barnizado con barniz natural, herrajes ocultos, pomo color negro.', '', 1.0, 2200.0, 2552.0, 1.0, 2200.0, 1.16, 2552.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 76),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_04', 'Armarios a medida', '5_CM_04.2', 'Armario M02 268x110 cm', 'Suministro e instalacion de armario interior melamina de diseño a elegir, distribucion segun plano, frente con puertas abatibles fabricado en tablero roble chapa natural, barnizado con barniz natural, herrajes ocultos, pomo color negro.', '', 1.0, 1530.0, 1774.8, 1.0, 1530.0, 1.16, 1774.8, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 77),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_04', 'Armarios a medida', '5_CM_04.3', 'Armario M03 268x270 cm', 'Suministro e instalacion de armario interior melamina de diseño a elegir, distribucion segun plano, frente con puertas abatibles fabricado en tablero roble chapa natural, barnizado con barniz natural, herrajes ocultos, pomo color negro.', '', 1.0, 3850.0, 4466.0, 1.0, 3850.0, 1.16, 4466.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 78),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_04', 'Armarios a medida', '5_CM_04.4', 'Armario M04 268x119 cm', 'Suministro e instalacion de armario interior melamina de diseño a elegir, distribucion segun plano, frente con puertas abatibles fabricado en tablero roble chapa natural, barnizado con barniz natural, herrajes ocultos, pomo color negro.', '', 1.0, 1700.0, 1972.0, 1.0, 1700.0, 1.16, 1972.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 79),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_04', 'Armarios a medida', '5_CM_04.5', 'Armario M05 268x80 cm', 'Suministro e instalacion de armario interior melamina de diseño a elegir, distribucion segun plano, frente con puertas abatibles fabricado en tablero roble chapa natural, barnizado con barniz natural, herrajes ocultos, pomo color negro.', '', 1.0, 1000.0, 1160.0, 1.0, 1000.0, 1.16, 1160.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 80),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_04', 'Armarios a medida', '5_CM_04.6', 'Armario M09 de 268x137 cm', 'Suministro e instalacion de armario interior melamina de diseño a elegir, distribucion segun plano, frente con puertas abatibles fabricado en tablero roble chapa natural, barnizado con barniz natural, herrajes ocultos, pomo color negro.', '', 1.0, 1850.0, 2146.0, 1.0, 1850.0, 1.16, 2146.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 81),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_04', 'Armarios a medida', '5_CM_04.7', 'Armario M010 de 268x445 cm', 'Suministro e instalacion de armario interior melamina de diseño a elegir, distribucion segun plano, frente con puertas abatibles fabricado en tablero roble chapa natural, barnizado con barniz natural, herrajes ocultos, pomo color negro.', '', 1.0, 5800.0, 6728.0, 1.0, 5800.0, 1.16, 6728.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 82),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_04', 'Armarios a medida', '5_CM_04.8', 'Armario M011 de 268x110 cm', 'Suministro e instalacion de armario interior melamina de diseño a elegir, distribucion segun plano, frente con puertas abatibles fabricado en tablero roble chapa natural, barnizado con barniz natural, herrajes ocultos, pomo color negro.', '', 1.0, 1200.0, 1392.0, 1.0, 1200.0, 1.16, 1392.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 83),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.1', 'Embocadura ventanas V1,V2', 'Suministro e instalación de embocadura de ventana según plano, fabricado en tablero chapado en roble natural.', 'UD.', 4.0, 380.0, 440.8, 4.0, 380.0, 1.16, 440.8, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 84),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.2', 'Embocadura ventana V3', 'Suministro e instalación de embocadura de ventana según plano, fabricado en tablero chapado en roble natural.', 'UD.', 1.0, 350.0, 406.0, 1.0, 350.0, 1.16, 406.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 85),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.3', 'Embocadura ventana V4', 'Suministro e instalación de embocadura de ventana según plano, fabricado en tablero chapado en roble natural.', 'UD.', 1.0, 350.0, 406.0, 1.0, 350.0, 1.16, 406.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 86),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.4', 'Embocadura ventana V7', 'Suministro e instalación de embocadura de ventana según plano, fabricado en tablero chapado en roble natural.', 'UD.', 1.0, 280.0, 324.8, 1.0, 280.0, 1.16, 324.8, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 87),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.5', 'Embocadura V9, V10 y V11', 'Suministro e instalación de embocadura de ventana según plano, fabricado en tablero chapado en roble natural.', 'UD.', 3.0, 230.0, 266.8, 3.0, 230.0, 1.16, 266.8, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 88),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.6', 'Embocadura V12 y V13', 'Suministro e instalación de embocadura de ventana según plano, fabricado en tablero chapado en roble natural.', 'UD.', 2.0, 350.0, 406.0, 2.0, 350.0, 1.16, 406.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 89),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.7', 'Mueble MD2 master', 'Suministro e instalacion de mueble segun planos y diseño fabricado en tablero chapa roble natural, barnizado natur (led no incluido)', 'UD.', 1.0, 3400.0, 3944.0, 1.0, 3400.0, 1.16, 3944.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 90),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.8', 'Mueble MD3 family room', 'Suministro e instalacion de mueble segun planos y diseño fabricado en tablero chapa roble natural, barnizado natur (led no incluido)', 'UD.', 1.0, 6300.0, 7308.0, 1.0, 6300.0, 1.16, 7308.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 91),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.9', 'Mueble MD4 dorm. 2', 'Suministro e instalacion de mueble en tablero chapa roble natural, barnizado con barniz natural (led no incluido).', 'UD.', 1.0, 4200.0, 4872.0, 1.0, 4200.0, 1.16, 4872.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 92),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.10', 'Cabecero cama dorm. C02', 'Suministro e instalacion de cabecero segun planos y diseño fabricado en tablero chapa roble natural, barnizado natur (tapizado no incluido)', 'UD.', 1.0, 1500.0, 1740.0, 1.0, 1500.0, 1.16, 1740.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 93),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.11', 'Cabecero cama master C01', 'Suministro e instalacion de cabecero cama master segun diseño fabricado en tablero chapa roble natural, barnizado natural (tapizado no incluido).', 'UD.', 0.0, 1800.0, 2088.0, 0.0, 1800.0, 1.16, 2088.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 94),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.12', 'Armario y escritorio MDS servicio', 'Suministro e instalacion de armario interior melamina de diseño a elegir, distribucion segun plano, frente con puertas abatibles fabricado en tablero roble chapa natural, barnizado con barniz natural, herrajes ocultos, pomo color negro.', 'UD.', 1.0, 968.0, 1122.88, 1.0, 968.0, 1.16, 1122.88, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 95),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.13', 'Embocadura salón de 233x36x36 cm', 'Embocadura en tablero roble chapa natural, barnizado con barniz natura.', 'UD.', 2.0, 450.0, 522.0, 2.0, 450.0, 1.16, 522.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 96),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_05', 'Muebles a medida', '5_CM_05.14', 'Embocadura puertas correderas cocina', 'Embocadura en tablero roble chapa natural, barnizado con barniz natura.', 'UD.', 1.0, 765.0, 887.4, 1.0, 765.0, 1.16, 887.4, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 97),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_06', 'Walking closet master', '5_CM_06.1', 'Vestidor Principal (Walking Closet Master)', 'Suministro e instalación de vestidor compuesto por 7 módulos Novamobili modelos Perry y Aristotele, con puertas batientes de cristal fumé, estantes interiores, barras de colgar y cajoneras, fabricados en laminado texturizado Oxford y frentes en acabados brunido, ecomadera quercia y lacado óxido peltre, altura 242 cm. Inclusión de perfiles LED verticales en costados interiores, módulo frontal con 5 cajones y estantes posteriores, laterales a medida en acero inox mate Barazza 0,4 mm, y conjunto adicional de 3 módulos inferiores con 4 cajones superiores. La partida contempla suministro, transporte y montaje completo según especificaciones del fabricante.', 'UD.', 1.0, 22908.0, 26573.28, 1.0, 22908.0, 1.16, 26573.28, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 98),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_07', 'Muebles de baño', '5_CM_07.1', 'Mueble de baño aseo de cortesía', 'Suministro e instalación de mueble bajo de baño fabricado en melamina de 2 caras (esp. 18 mm) con canto ABS, compuesto por 1 módulo suspendido a pared mediante 2 herrajes metálicos para integrar estructura de lavabo. Acabado según diseño, incluyendo mecanizados, fijación y nivelación en obra.', 'UD.', 1.0, 855.2901, 992.14, 1.0, 855.2901, 1.16, 992.14, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 99),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_07', 'Muebles de baño', '5_CM_07.2', 'Mueble de baño dormitorio máster', 'Suministro e instalación de mueble de baño principal formado por dos módulos inferiores con 1 cajón + cacerolero, fabricados en tablero laminado en acabado Umbra Grey antideslizante, diseños de cortes superiores/inferiores para adaptación a instalaciones y elementos existentes. Incluye mueble suspendido con 2 herrajes, tirillas de caucho antideslizante, y ranura intermedia para paso de instalaciones, montado y ajustado según diseño.', 'UD.', 1.0, 2776.5824, 3220.84, 1.0, 2776.5824, 1.16, 3220.84, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 100),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_07', 'Muebles de baño', '5_CM_07.3', 'Mueble de baño dormitorio 01', 'Suministro e instalación de mueble bajo compuesto por 2 módulos caceroleros, fabricados en acabado Umbra Grey, incluye cortes de fondo para integración con bajantes/pasamuros, módulo suspendido con 2 herrajes, alfombrillas antideslizantes, ranura intermedia y elemento terminal adosado compatible con modelo Maxima. Montaje completo en obra, nivelación y fijaciones.', 'UD.', 1.0, 2103.3279, 2439.87, 1.0, 2103.3279, 1.16, 2439.87, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 101),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_07', 'Muebles de baño', '5_CM_07.4', 'Mueble de baño dormitorio 02', 'Suministro e instalación de mueble de baño compuesto por 2 módulos caceroleros, fabricados en acabado Umbra Grey, incluye cortes de fondo para integración con bajantes/pasamuros, módulo suspendido con 2 herrajes, almohadillas antideslizantes, ranura intermedia y elemento terminal asolado compatible con modelo Maxima, montaje completo en obra, nivelación y fijaciones.', 'UD.', 1.0, 3482.386, 4039.57, 1.0, 3482.386, 1.16, 4039.57, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 102),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_07', 'Muebles de baño', '5_CM_07.5', 'Encimera aseo de cortesía', 'Fabricación e instalación de encimera de baño a medida, un seno integrado, realizada en cuarcita natural Verde Roma, con embocaduras según diseño, mecanizados de seno, desagüe y alojamientos técnicos.', 'UD.', 1.0, 3676.9, 4265.21, 1.0, 3676.9, 1.16, 4265.21, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 103),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_07', 'Muebles de baño', '5_CM_07.6', 'Encimera baño dormitorio máster', 'Fabricación e instalación de encimera de baño a medida, un seno integrado, realizada en cuarcita natural Verde Roma, con embocaduras según diseño, mecanizados de senos, desagüe y alojamientos técnicos.', 'UD.', 1.0, 4399.0, 5102.84, 1.0, 4399.0, 1.16, 5102.84, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 104),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_07', 'Muebles de baño', '5_CM_07.7', 'Encimera baño dormitorio 01', 'Encimera de baño con un seno integrado fabricada en cuarcita natural Taj Majal, con mecanizado perimetral y embocaduras según diseño. Incluye suministro, transporte y colocación.', 'UD.', 1.0, 2307.4, 2676.59, 1.0, 2307.4, 1.16, 2676.59, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 105),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_07', 'Muebles de baño', '5_CM_07.8', 'Encimera baño dormitorio 02', 'Encimera de baño de un seno fabricada en cuarcita natural Taj Majal, con todos los cortes y mecanizados necesarios para instalación de grifería y válvula, montada y sellada en obra.', 'UD.', 1.0, 3046.1, 3533.48, 1.0, 3046.1, 1.16, 3533.48, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 106),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_07', 'Muebles de baño', '5_CM_07.9', 'Mueble de baño (lavabo) cuarto de servicio', 'Suministro e instalación de mueble de baño sencillo para cuarto de servicio, compuesto por módulo base con lavabo integrado, acabado melamínico estándar y herrajes básicos.', 'UD.', 1.0, 700.0, 812.0, 1.0, 700.0, 1.16, 812.0, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 107),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_08', 'Panelados y frisos', '5_CM_08.1', 'Panelado baño cortesía', 'Suministro e instalacion de panelado según plano y diseño, fabricado en tablero roble chapado natural, barniz natura', 'UD.', 1.0, 1200.0, 1392.0, 1.0, 1200.0, 1.16, 1392.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 108),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_08', 'Panelados y frisos', '5_CM_08.2', 'Rodapié zona servicio de 9x1.6cm', 'Suministro e instalacion de rodapié con moldura de 9 x1.6cm lacado blanco, tablero hidrofugo.', 'ML', 15.0, 14.0, 16.24, 15.0, 14.0, 1.16, 16.24, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 109),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_08', 'Panelados y frisos', '5_CM_08.3', 'Rodapié zócalo de 70cm', 'Yo creo que se queda corto los 35 ml', 'ML', 55.0, 100.0, 116.0, 55.0, 100.0, 1.16, 116.0, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 110),
  ('a1c38000-0000-4000-8000-000000000038', 5, 'CARPINTERIA MADERA', '5_CM_08', 'Panelados y frisos', '5_CM_08.4', 'Panelado salón tablero roble', 'Suministro e instalacion de panelado según plano y diseño, fabricado en tablero roble chapado natural, barniz natura', 'M2', 52.0, 260.0, 301.6, 52.0, 260.0, 1.16, 301.6, true, 'igual', '8c34f1e8-fb29-55fc-96d2-7695fb846faf', 111),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_01', 'Fontanería y saneamiento', '6_INST_01.1', 'Conexiones a red de saneamiento', '', '', 4.0, 2025.0, 2349.0, 4.0, 2025.0, 1.16, 2349.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 112),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_01', 'Fontanería y saneamiento', '6_INST_01.2', 'Fontanería baños', 'Instalación completa de fontanería en baño compuesto por un lavabo, una ducha, inodoro y llaves de corte. Suministro y montaje de tubería de multicapa de 20 mm, con coquilla de 9 mm de espesor, así como soportes, anclajes, etc. Incluidas todas las piezas necesarias para la instalación: tes, codos, entronques, etc.', '', 5.0, 1650.0, 1914.0, 5.0, 1650.0, 1.16, 1914.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 113),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_01', 'Fontanería y saneamiento', '6_INST_01.3', 'Fontanería cocina', 'Instalación completa de fontanería en cocina, compuesta por lavavajillas, pila y llaves de corte.', '', 1.0, 1470.0, 1705.2, 1.0, 1470.0, 1.16, 1705.2, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 114),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_01', 'Fontanería y saneamiento', '6_INST_01.4', 'Fontanería lavandería', 'Instalación completa de fontanería en lavandería, compuesta por pila, lavadora y llaves de corte.', '', 1.0, 1470.0, 1705.2, 1.0, 1470.0, 1.16, 1705.2, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 115),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_01', 'Fontanería y saneamiento', '6_INST_01.5', 'Instalación general', 'Instalación general de agua caliente y agua fría, desde la llave general existente en patinillo exterior hasta el cuarto de lavandería, con tubería multicapa de 25 mm y coquilla de 9 mm, en colores rojo y azul. Incluidas llaves de 3/4" para contador, racores y contadores. Red general de agua fría y caliente con tubería de 25 mm, alimentando cada baño en 20 mm. Alimentación total para 5 baños, cocina y lavandería.', '', 1.0, 5130.0, 5950.8, 1.0, 5130.0, 1.16, 5950.8, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 116),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_02', 'Ventilación', '6_INST_02.1', 'Sistema de ventilación con recuperación de calor Siber', 'Equipo simple flujo SIBER', '', 1.0, 1426.5, 1654.74, 1.0, 1426.5, 1.16, 1654.74, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 117),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_03', 'Calefacción y ACS', '6_INST_03.1', 'Suministro de suelo radiante hidráulico (Uponor)', 'Suministro de sistema de suelo radiante Uponor (Klett Twinboard / Minitec) para aprox. 250 m², incluyendo paneles, tubo autofijación, zócalo perimetral, cintas, adaptadores, curvas, válvulas, colectores Vario M (9/10/11 salidas) con caudalímetro, cajas y puertas de colector, y sistema de control Smatrix (bus, cabezales, termostatos, módulos y acceso app).', 'M2', 236.0, 52.8, 61.25, 236.0, 52.8, 1.16, 61.25, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 118),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_03', 'Calefacción y ACS', '6_INST_03.2', 'Instalación de suelo radiante hidráulico', 'Montaje completo en obra del sistema de suelo radiante para aprox. 250 m², incluyendo colocación/extendido de panel, tendido de tubería, conexionado a colectores y ajustes necesarios para puesta en servicio.', 'M2', 236.0, 11.4, 13.23, 236.0, 11.4, 1.16, 13.23, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 119),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_03', 'Calefacción y ACS', '6_INST_03.3', 'Acometidas y distribución a colectores de suelo radiante', 'Suministro y montaje de acometidas para suelo radiante con tubería multicapa Ø40 y coquilla 40x30, alimentación desde 3 colectores, incluyendo reducciones de Ø40 a Ø32 y Ø25, aprox. 142 ml de tubería y coquilla, con soportes y piezas necesarias para correcta instalación.', 'ML', 142.0, 28.16, 32.67, 142.0, 28.16, 1.16, 32.67, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 120),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_03', 'Calefacción y ACS', '6_INST_03.4', 'Suministro e instalación de aerotermia (bomba de calor)', 'Suministro y montaje de bomba de calor Vaillant aroTHERM Split UniTOWER 16 kW, incluyendo: conexión hidráulica entre unidad exterior/interior con tubería Ø40 y coquilla, cableado entre unidades, depósito de inercia 100 l con conexiones en multicapa Ø40 encoquillado, y bomba Wilo 25/80/180 con racores.', 'UD.', 1.0, 15475.98, 17952.14, 1.0, 15475.98, 1.16, 17952.14, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 121),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_04', 'Aire acondicionado', '6_INST_04.1', 'Maquinaria Daikin', 'Capacidad: 6,8 kW frío 7,5 kW calor', 'UD.', 1.0, 7905.6, 9170.5, 1.0, 7905.6, 1.16, 9170.5, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 122),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_04', 'Aire acondicionado', '6_INST_04.2', 'Conducto de fibra', 'Fabricación de conducto realizado con fibra Isover, de doble capa de aislamiento.', 'UD.', 1.0, 4662.0, 5407.92, 1.0, 4662.0, 1.16, 5407.92, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 123),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_04', 'Aire acondicionado', '6_INST_04.3', 'Línea frigorífica +8 kW.', 'Realizada con tubo de cobre 5/8 y 3/8, de 9 mm de espesor y aislante de PVC. Interconexión eléctrica y desagüe.', 'UD.', 1.0, 1170.0, 1357.2, 1.0, 1170.0, 1.16, 1357.2, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 124),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_04', 'Aire acondicionado', '6_INST_04.4', 'Trabajos verticales para llevar a azotea', '', 'UD.', 0.0, 675.0, 783.0, 0.0, 675.0, 1.16, 783.0, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 125),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_04', 'Aire acondicionado', '6_INST_04.5', 'Rejillas lineales sin marco recibidas en pladur', '', 'UD.', 20.0, 54.0, 62.64, 20.0, 54.0, 1.16, 62.64, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 126),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_04', 'Aire acondicionado', '6_INST_04.6', 'Rejillas de retorno', '', 'UD.', 0.0, 0.0, 0.0, 0.0, 0.0, 1.16, 0.0, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 127),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_04', 'Aire acondicionado', '6_INST_04.7', 'Central Airzone Flexa 4.0', 'El sistema Flexa 4.0 utiliza la inercia térmica del suelo radiante para asegurar el confort y optimizar el consumo energético.
Además, incorpora funciones de protección para alargar la vida útil de la instalación y reducir las acciones de mantenimiento.Ventajas
de Flexa 4.0 para suelo radiante en comparación con un sistema no zonificado:
Estabilidad de temperatura gracias al control de inercia térmica.
Distintas temperaturas de consigna en cada habitación.
Uso del sistema Flexa 4.0 durante todo el año gracias al control
del suelo en modo frío o calor.
Ahorro en costes de explotación e instalación en términos de eficiencia.
Control eficiente y gestión de la producción.', 'UD.', 0.0, 279.0, 323.64, 0.0, 279.0, 1.16, 323.64, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 128),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_04', 'Aire acondicionado', '6_INST_04.8', 'Compuertas motorizadas Airzone', '', 'UD.', 9.0, 166.5, 193.14, 9.0, 166.5, 1.16, 193.14, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 129),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_04', 'Aire acondicionado', '6_INST_04.9', 'Instalación de equipos', '', 'UD.', 3.0, 675.0, 783.0, 3.0, 675.0, 1.16, 783.0, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 130),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_05', 'Electricidad', '6_INST_05.1', 'Cuadro general Hager FW624 144E 6 filas 63A', 'Cuadro general apto para albergar todos los componentes de
Domotica. 144 Elementos.
Componentes Básicos Instalados:
1 Automatico General 2x40A
max 6 Diferenciales 2x40,30.
1 Protector sobre tensiones transitorias.
max 3 Automaticos 2x25A (vitro-horno y aire acondicionado.)
max 6 Automaticos 2x10A (alumbrado spots, alumbrado led,
persianas eléctricas.)
max 116 Automaticos 2x16A (usos varios casa, usos varios
dormitorios, usos varios cocina, usos varios baños, lavadora,
secadora, lavaplatos, domotica y mando)', 'UD.', 1.0, 2155.5, 2500.38, 1.0, 2155.5, 1.16, 2500.38, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 131),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_05', 'Electricidad', '6_INST_05.2', 'Punto de luz para enchufe', 'Realizado con conductores unipolares de 2,5mm de sección y 750V
de aislamiento. Protegidos bajo tubo de forro PVC. Incluido caja
universal de mecanismo. (no incluye mecanismo)', 'UD.', 90.0, 36.0, 41.76, 90.0, 36.0, 1.16, 41.76, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 132),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_05', 'Electricidad', '6_INST_05.3', 'Enchufe Jung LS990 latón antic', '', 'UD.', 30.0, 22.5, 26.1, 30.0, 22.5, 1.16, 26.1, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 133),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_05', 'Electricidad', '6_INST_05.4', 'Punto de luz regulado DALI/KNX', '', 'UD.', 110.0, 40.5, 46.98, 110.0, 40.5, 1.16, 46.98, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 134),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_05', 'Electricidad', '6_INST_05.6', 'Punto de luz persiana eléctrica', 'Realizado con conductores unipolares de 1,5mm de sección y 750V
de aislamiento. Protegidos bajo tubo forro PVC 20. Incluido caja
de mecanismo universal. (no incluye mecanismo)', 'UD.', 20.0, 36.0, 41.76, 20.0, 36.0, 1.16, 41.76, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 135),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_05', 'Electricidad', '6_INST_05.7', 'Punto de luz horno y vitro', 'Realizado con conductores unipolares de 6mm de sección y 750V
de aislamiento. Protegidos bajo tubo forro PVC 25.', 'UD.', 2.0, 108.0, 125.28, 2.0, 108.0, 1.16, 125.28, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 136),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_05', 'Electricidad', '6_INST_05.8', 'Punto de luz para timbre', 'Realizado con conductores unipolares de 1,5mm de sección y 750V
de aislamiento. Protegidos bajo tubo forro 20. Incluido caja de
mecanismo universal, pulsador y dindon.', 'UD.', 1.0, 72.0, 83.52, 1.0, 72.0, 1.16, 83.52, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 137),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_05', 'Electricidad', '6_INST_05.9', 'Líneas eléctricas de reparto y distribución', 'Circuito eléctrico de reparto , que comprende desde cuadro
general de protección hasta las cajas de distribución.', 'UD.', 16.0, 72.0, 83.52, 16.0, 72.0, 1.16, 83.52, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 138),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_05', 'Electricidad', '6_INST_05.10', 'Enchufes PRADO Empotrables', 'PRADO', 'UD.', 1.0, 1653.35, 1917.89, 1.0, 1653.35, 1.16, 1917.89, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 139),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.1', 'Aseo de cortesia', 'Iluminación PRADO', 'UD.', 1.0, 276.5, 320.74, 1.0, 276.5, 1.16, 320.74, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 140),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.2', 'Hall', 'Iluminación PRADO', 'UD.', 1.0, 553.0, 641.48, 1.0, 553.0, 1.16, 641.48, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 141),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.3', 'Salon Comedor', 'Iluminación PRADO', 'UD.', 1.0, 3314.5, 3844.82, 1.0, 3314.5, 1.16, 3844.82, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 142),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.4', 'Family Room', 'Iluminación PRADO', 'UD.', 1.0, 1383.9, 1605.33, 1.0, 1383.9, 1.16, 1605.33, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 143),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.5', 'Cocina', 'Iluminación PRADO', 'UD.', 1.0, 1659.0, 1924.44, 1.0, 1659.0, 1.16, 1924.44, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 144),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.6', 'Dormitorio master', 'Iluminación PRADO', 'UD.', 1.0, 2369.5, 2748.62, 1.0, 2369.5, 1.16, 2748.62, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 145),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.7', 'Baño master', 'Iluminación PRADO', 'UD.', 1.0, 1382.5, 1603.7, 1.0, 1382.5, 1.16, 1603.7, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 146),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.8', 'Hall Dormitorio 2', 'Iluminación PRADO', 'UD.', 1.0, 472.5, 548.1, 1.0, 472.5, 1.16, 548.1, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 147),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.9', 'Dormitorio 2', 'Iluminación PRADO', 'UD.', 1.0, 1025.5, 1189.58, 1.0, 1025.5, 1.16, 1189.58, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 148),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.10', 'Baño dormitorio 2', 'Iluminación PRADO', 'UD.', 1.0, 829.5, 962.22, 1.0, 829.5, 1.16, 962.22, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 149),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.11', 'Dormitorio 3', 'Iluminación PRADO', 'UD.', 1.0, 1774.5, 2058.42, 1.0, 1774.5, 1.16, 2058.42, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 150),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.12', 'Baño dormitorio 3', 'Iluminación PRADO', 'UD.', 1.0, 829.5, 962.22, 1.0, 829.5, 1.16, 962.22, true, 'igual', null, 151),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.13', 'Cabeceros', 'Iluminación PRADO', 'UD.', 1.0, 1029.0, 1193.64, 1.0, 1029.0, 1.16, 1193.64, true, 'igual', null, 152),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.14', 'Baliza Kreon in line 25 blanco', '', 'UD.', 0.0, 0.0, 0.0, 0.0, 0.0, 1.16, 0.0, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 153),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.15', 'Tira de LED 24 V CCT 19,2 W/m', 'Tira de led de alta eficiencia 50000 horas, 2700K-6000K. Incluido perfil de aluminio, difusor y fuentes de alimentación correspondientes. Completamente instalada.', 'UD.', 90.0, 81.0, 93.96, 90.0, 81.0, 1.16, 93.96, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 154),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_06', 'Iluminación', '6_INST_06.16', 'Montaje de iluminación', '', 'UD.', 110.0, 16.2, 18.8, 110.0, 16.2, 1.16, 18.8, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 155),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_07', 'Telecomunicaciones', '6_INST_07.1', 'Toma de datos RJ45 cat6', 'Realizada con cable UTP Cat6, protegido bajo tubo forro PVC 20.
Incluido caja de mecanismo y conector AMP Cat6.', 'UD.', 6.0, 72.0, 83.52, 6.0, 72.0, 1.16, 83.52, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 156),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_07', 'Telecomunicaciones', '6_INST_07.2', 'Toma de TV', 'Realizada con cable coaxial cobre y malla de cobre , protegido bajo
tubo forro PVC 20. Incluido caja de macenimo universal. (no incluye
mecanismo)', 'UD.', 5.0, 45.0, 52.2, 5.0, 45.0, 1.16, 52.2, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 157),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_07', 'Telecomunicaciones', '6_INST_07.3', 'Repetidor antena WiFi TP-Link', '', 'UD.', 2.0, 162.0, 187.92, 2.0, 162.0, 1.16, 187.92, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 158),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_07', 'Telecomunicaciones', '6_INST_07.5', 'Rack para audio y datos', '', 'UD.', 1.0, 175.0, 203.0, 1.0, 175.0, 1.16, 203.0, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 159),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_07', 'Telecomunicaciones', '6_INST_07.6', 'Monitor video portero', '', 'UD.', 1.0, 171.0, 198.36, 1.0, 171.0, 1.16, 198.36, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 160),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_08', 'Domótica', '6_INST_08.1', 'Fuente de alimentación KNX', '', 'UD.', 1.0, 216.0, 250.56, 1.0, 216.0, 1.16, 250.56, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 161),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_08', 'Domótica', '6_INST_08.2', 'Interface KNX IP', '', 'UD.', 1.0, 196.2, 227.6, 1.0, 196.2, 1.16, 227.6, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 162),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_08', 'Domótica', '6_INST_08.3', 'Pantalla táctil Zennio Z50', 'Con licencia para control remoto', 'UD.', 7.0, 423.0, 490.68, 7.0, 423.0, 1.16, 490.68, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 163),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_08', 'Domótica', '6_INST_08.4', 'Pantalla táctil Zennio Z35v2', '', 'UD.', 1.0, 276.3, 320.51, 1.0, 276.3, 1.16, 320.51, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 164),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_08', 'Domótica', '6_INST_08.5', 'Zoning box 6 Zennio', '', 'UD.', 1.0, 226.8, 263.09, 1.0, 226.8, 1.16, 263.09, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 165),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_08', 'Domótica', '6_INST_08.6', 'Dali box 64x2 Zennio', '', 'UD.', 2.0, 461.7, 535.58, 2.0, 461.7, 1.16, 535.58, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 166),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_08', 'Domótica', '6_INST_08.7', 'Shutter box drive 8CH', '', 'UD.', 1.0, 373.0, 432.68, 1.0, 373.0, 1.16, 432.68, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 167),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_08', 'Domótica', '6_INST_08.8', 'Shutter box drive 6CH', '', 'UD.', 1.0, 313.2, 363.32, 1.0, 313.2, 1.16, 363.32, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 168),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_08', 'Domótica', '6_INST_08.9', 'KLIC-DI V2 DAIKIN', '', 'UD.', 3.0, 181.8, 210.89, 3.0, 181.8, 1.16, 210.89, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 169),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_08', 'Domótica', '6_INST_08.10', 'BIN T 2X', '', 'UD.', 16.0, 49.5, 57.42, 16.0, 49.5, 1.16, 57.42, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 170),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_08', 'Domótica', '6_INST_08.11', 'Programación KNX', '', 'HRS', 1.0, 5850.0, 6786.0, 1.0, 5850.0, 1.16, 6786.0, true, 'igual', '287fbd27-5c10-5435-b6fb-fcfae964557d', 171),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.1', 'Instalacion', 'Presupuesto 3 zonas multirrom con manejo individual y volumen
independiente"', '', 1.0, 0.0, 0.0, 1.0, 0.0, 1.16, 0.0, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 172),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.2', 'Cocina', 'Celestial- BOC62 6.5" - in-ceiling speakers', '', 2.0, 333.0, 386.28, 2.0, 333.0, 1.16, 386.28, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 173),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.3', 'Salon / comedor', 'Celestial- BOC86 8" - in-ceiling speakers', '', 4.0, 855.0, 991.8, 4.0, 855.0, 1.16, 991.8, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 174),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.4', 'Dormitorio master', 'Celestial- BOC86 8" - in-ceiling speakers', '', 2.0, 855.0, 991.8, 2.0, 855.0, 1.16, 991.8, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 175),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.5', 'Vestidor / Baño master', 'Celestial- BOC82 8" - in-ceiling speakers', '', 2.0, 479.403, 556.11, 2.0, 479.403, 1.16, 556.11, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 176),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.6', 'Family room', 'Beosound Theatre 55 Soundbar acabado Madera', '', 1.0, 8330.58, 9663.48, 1.0, 8330.58, 1.16, 9663.48, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 177),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.7', 'Family room', 'Celestial- BOC86 8', '', 2.0, 855.0, 991.8, 2.0, 855.0, 1.16, 991.8, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 178),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.8', 'Family room', 'Armario Rack Mural 19 600x450x500', '', 1.0, 405.0, 469.8, 1.0, 405.0, 1.16, 469.8, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 179),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.9', 'General', 'Amplificador', '', 1.0, 1732.5, 2009.7, 1.0, 1732.5, 1.16, 2009.7, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 180),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.10', 'General', 'Beoconnect Core', '', 3.0, 855.369, 992.23, 3.0, 855.369, 1.16, 992.23, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 181),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.11', 'General', 'Cable Audio libre oxigeno', '', 1.0, 306.0, 354.96, 1.0, 306.0, 1.16, 354.96, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 182),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.12', 'General', 'Cable conexiones y pequeño material', '', 1.0, 252.0, 292.32, 1.0, 252.0, 1.16, 292.32, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 183),
  ('a1c38000-0000-4000-8000-000000000038', 6, 'INSTALACIONES', '6_INST_09', 'Sonido', '6_INST_09.13', 'General', 'Envío, instalación y configuración por técnicos', '', 12.0, 117.0, 135.72, 12.0, 117.0, 1.16, 135.72, true, 'igual', '59023776-2a04-5059-960d-2391706e3954', 184),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_01', 'Pintura', '7_PYV_01.1', 'Aplicación de pintura - Muros', 'Preparación de superficies, reparación de pequeñas imperfecciones, aplicación de imprimación si procede y acabado con pintura plástica de alta calidad en muros interiores, incluyendo mano de obra, materiales y medios auxiliares necesarios.', '', 285.0, 13.0, 15.08, 285.0, 13.0, 1.16, 15.08, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 185),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_01', 'Pintura', '7_PYV_01.2', 'Aplicación de pintura - Techos', 'Preparación de paramentos horizontales, saneado de fisuras puntuales, aplicación de sellador y acabado con pintura plástica blanca mate en techos interiores, incluyendo mano de obra, materiales y medios auxiliares.', '', 258.0, 13.0, 15.08, 258.0, 13.0, 1.16, 15.08, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 186),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_02', 'Solados y alicatados', '7_PYV_02.1', 'Solados de piedra natural', 'Colocación de solado de piedra, en baldosas con formato
comprendido entre 20x20cm y 120x120cm.', '', 23.0, 68.0, 78.88, 23.0, 68.0, 1.16, 78.88, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 187),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_02', 'Solados y alicatados', '7_PYV_02.2', 'Alicatados de piedra natural', 'Colocación de alicatado de piedra, en baldosas con formato
comprendido entre 20x20cm y 120x120cm.', '', 82.0, 68.0, 78.88, 82.0, 68.0, 1.16, 78.88, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 188),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_02', 'Solados y alicatados', '7_PYV_02.3', 'Solados de terrazo', 'Colocación de solado de terrazo, en baldosas con formato
comprendido entre 20x20cm y 120x120cm.', '', 35.0, 68.0, 78.88, 35.0, 68.0, 1.16, 78.88, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 189),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_02', 'Solados y alicatados', '7_PYV_02.4', 'Alicatados de terrazo', 'Colocación de alicatado de terrazo, en baldosas con formato
comprendido entre 20x20cm y 120x120cm.', '', 26.4, 68.0, 78.88, 26.4, 68.0, 1.16, 78.88, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 190),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_02', 'Solados y alicatados', '7_PYV_02.5', 'Solados de porcelanico', 'Colocación de solado de porcelanico, en baldosas con formato
comprendido entre 20x20cm y 120x120cm.', '', 19.0, 68.0, 78.88, 19.0, 68.0, 1.16, 78.88, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 191),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_02', 'Solados y alicatados', '7_PYV_02.6', 'Alicatados de porcelanico', 'Colocación de alicatado de porcelanico, en baldosas con formato
comprendido entre 20x20cm y 120x120cm.', '', 28.0, 68.0, 78.88, 28.0, 68.0, 1.16, 78.88, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 192),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_02', 'Solados y alicatados', '7_PYV_02.7', 'Suministro de material - Piedra natural LimeIvory', '', '', 105.0, 77.0, 89.32, 105.0, 77.0, 1.16, 89.32, true, 'igual', '004deff1-d228-566c-b479-5d489aa6bad6', 193),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_02', 'Solados y alicatados', '7_PYV_02.8', 'Suministro de material - Porcelanico', '', '', 47.0, 35.0, 40.6, 47.0, 35.0, 1.16, 40.6, true, 'igual', '004deff1-d228-566c-b479-5d489aa6bad6', 194),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_02', 'Solados y alicatados', '7_PYV_02.9', 'Fabricación de platos de ducha', '', '', 4.0, 1100.0, 1276.0, 4.0, 1100.0, 1.16, 1276.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 195),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_03', 'Tarima de madera', '7_PYV_03.1', 'Tarima de roble chevron – punta Hungría (calidad select)', 'Suministro de tarima de roble multicapa, formato Chevron 45º/60º, calidad Select, color natural.

Detalles técnicos:

Dimensiones: 15/4 × 140 × 500 mm

Capa noble: 4 mm

Soporte: contrachapado de abedul

Selección: Select (sin nudos)', '', 99.41, 92.0, 106.72, 99.41, 92.0, 1.16, 106.72, true, 'igual', '1b552706-ded8-5eda-b4ed-975a28951301', 196),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_03', 'Tarima de madera', '7_PYV_03.2', 'Tarima de roble multicapa 150 mm (plank select)', 'Suministro de tarima de roble multicapa, color natural, calidad Select, largos variables.

Detalles técnicos:

Dimensiones: 15/4 × 150 × 600–2500 mm

Capa noble: 4 mm

Soporte: tablero fenólico

Uso: zonas longitudinales', '', 54.86, 80.6, 93.5, 54.86, 80.6, 1.16, 93.5, true, 'igual', '1b552706-ded8-5eda-b4ed-975a28951301', 197),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_03', 'Tarima de madera', '7_PYV_03.3', 'Tarima de roble multicapa 190 mm (plank select)', 'Tarima multicapa de roble, anchos 190 mm, largos variables.

Detalles técnicos:

Dimensiones: 15/4 × 190 mm

Capa noble: 4 mm

Calidad Select

Soporte fenólico', '', 17.0, 86.7, 100.58, 17.0, 86.7, 1.16, 100.58, true, 'igual', '1b552706-ded8-5eda-b4ed-975a28951301', 198),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_03', 'Tarima de madera', '7_PYV_03.4', 'Junquillo de latón', 'Junquillo metálico de latón para remate perimetral.

Detalles técnicos:

Ancho: 5 mm

Acabado: latón pulido

Uso: transiciones y perímetros', '', 37.25, 16.2, 18.8, 37.25, 16.2, 1.16, 18.8, true, 'igual', '1b552706-ded8-5eda-b4ed-975a28951301', 199),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_03', 'Tarima de madera', '7_PYV_03.5', 'Transporte', 'Transporte desde fábrica a pie de obra.', '', 1.0, 310.0, 359.6, 1.0, 310.0, 1.16, 359.6, true, 'igual', '1b552706-ded8-5eda-b4ed-975a28951301', 200),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_03', 'Tarima de madera', '7_PYV_03.6', 'Instalación de Tarima Chevron – Punta Hungría', 'Instalación de tarima multicapa en formato Chevron, pegada con adhesivo monocomponente de silano.

Detalles técnicos:

Adhesivo: DEVAKOL DK-MS 23 (apto suelo radiante)

Solera nivelada, limpia y rígida

Diseño: Chevron 45º/60º

Faja cada 500 mm aprox.', '', 144.0, 45.0, 52.2, 144.0, 45.0, 1.16, 52.2, true, 'igual', '1b552706-ded8-5eda-b4ed-975a28951301', 201),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_03', 'Tarima de madera', '7_PYV_03.7', 'Instalación tarima plank hasta 300 mm', 'Instalación de tarima multicapa longitudinal, anchos hasta 300 mm.

Detalles técnicos:

Adhesivo MS monocomponente

Pegado integral

Requiere solera nivelada', '', 15.0, 39.0, 45.24, 15.0, 39.0, 1.16, 45.24, true, 'igual', '1b552706-ded8-5eda-b4ed-975a28951301', 202),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_03', 'Tarima de madera', '7_PYV_03.8', 'Instalación de junquillos de latón', 'Colocación de junquillos metálicos.', '', 37.25, 7.2, 8.36, 37.25, 7.2, 1.16, 8.36, true, 'igual', '1b552706-ded8-5eda-b4ed-975a28951301', 203),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_04', 'Rodapie metalico', '7_PYV_04.1', 'Rodapie perfil L 30mm x 30 mm', 'Suministro e instalación de perfil metalico en L en acero galvanizado', '', 1.0, 4200.0, 4872.0, 1.0, 4200.0, 1.16, 4872.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 204),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_05', 'Cornisas', '7_PYV_05.1', 'Suministro e instalación de cornisa decorativa Orac C307', 'Suministro de cornisa decorativa de poliuretano Orac Decor modelo C307.', 'ML', 111.0, 45.0, 52.2, 111.0, 45.0, 1.16, 52.2, true, 'igual', 'e6f78c8a-952d-54a6-b115-a6803b649f2b', 205),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_05', 'Cornisas', '7_PYV_05.2', 'Instalación de cornisa decorativa Orac C307', 'Colocada perimetralmente según planos y criterios de proyecto, incluyendo corte, ingletes, ajuste en encuentros, encolado con adhesivo específico del fabricante, sellado de juntas, repasos y limpieza final.
La partida incluye 111 metros lineales, medios auxiliares, mano de obra especializada y todos los materiales necesarios para su correcta ejecución, quedando lista para posterior proceso de pintura.
No incluye pintura final.', 'ML', 111.0, 15.0, 17.4, 111.0, 15.0, 1.16, 17.4, true, 'igual', 'e6f78c8a-952d-54a6-b115-a6803b649f2b', 206),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_06', 'Terrazo', '7_PYV_06.1', 'Cocina – terrazo Huguet', 'Suministro de piezas de terrazzo TIPO A y TIPO B en distintos formatos para aplacados, encimeras, zócalos, dinteles y forros verticales en cocina.

Partidas incluidas:

Baldosas TIPO A 112×15, 80×15 cm

Baldosas TIPO B 112×37, 80×37, 112×52, 80×52

Cenefas TIPO A (varios formatos)

Dinteles puerta (tres piezas)

Aplacado mueble de cocina

Encimera de isla con faldones

Forros verticales (70×30, 70×15, 70×112)', '', 1.0, 8328.97, 9661.61, 1.0, 8328.97, 1.16, 9661.61, true, 'igual', '4f3b34e8-7235-58b1-8354-18bb9bd74db8', 207),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_06', 'Terrazo', '7_PYV_06.2', 'Hall – terrazo Huguet', 'Suministro de piezas de terrazzo TIPO A y B para solados del hall y dinteles de puertas interiores.

Partidas incluidas:

Baldosas TIPO A: 136×15 cm

Baldosas TIPO B: 136×30, 136×35 cm

Baldosas TIPO A: 155×15 cm

Dinteles: 130×60 cm, 120×20 cm, 70×20 cm', '', 1.0, 1489.18, 1727.45, 1.0, 1489.18, 1.16, 1727.45, true, 'igual', '4f3b34e8-7235-58b1-8354-18bb9bd74db8', 208),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_06', 'Terrazo', '7_PYV_06.3', 'Comedor – Terrazo Huguet', 'Aplacado de terrazzo TIPO A en paramentos verticales del comedor en distintos formatos.

Partidas incluidas:

Aplacado 15×65×2,5 cm

Aplacado 35×65×2,5 cm

Aplacado 94×65×2,5 cm', '', 1.0, 9118.46, 10577.42, 1.0, 9118.46, 1.16, 10577.42, true, 'igual', '4f3b34e8-7235-58b1-8354-18bb9bd74db8', 209),
  ('a1c38000-0000-4000-8000-000000000038', 7, 'PINTURAS Y REVESTIMIENTOS', '7_PYV_06', 'Terrazo', '7_PYV_06.4', 'Dormitorio principal – Terrazo Huguet', 'Aplacado de terrazzo TIPO A en muros perimetrales del dormitorio principal, varias piezas y formatos.

Partidas incluidas:

Aplacado 84×66×2,5 cm

Aplacado 93×66×2,5 cm

Aplacado 206×66×2,5 cm (varias piezas)', '', 1.0, 3093.01, 3587.9, 1.0, 3093.01, 1.16, 3587.9, true, 'igual', '4f3b34e8-7235-58b1-8354-18bb9bd74db8', 210),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_01', 'Sanitarios', '8_EQ_01.1', 'Inodoro completo Duravit Me by Starck (suspendido)', 'Suministro e instalación de inodoro suspendido Duravit Me by Starck, incluyendo asiento con cierre amortiguado y todos los elementos de bastidor y empotramiento necesarios para su correcto montaje en paredes ligeras.', 'UD.', 5.0, 897.4, 1040.99, 5.0, 897.4, 1.16, 1040.99, true, 'igual', '1a85639f-e3d7-5e13-af64-d058083512a9', 211),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_01', 'Sanitarios', '8_EQ_01.2', 'Instalacion y refuerzos', '', '', 5.0, 250.0, 290.0, 5.0, 250.0, 1.16, 290.0, true, 'igual', '1a85639f-e3d7-5e13-af64-d058083512a9', 212),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_02', 'Griferias y accesorios', '8_EQ_02.1', 'Aseo de cortesía', 'A.01 – Grifería de lavabo (Dornbracht META)

Descripción:
Suministro e instalación de grifería Dornbracht META, batería americana para lavabo, con válvula automática, acabado platino cepillado.

Modelo / SKU: 20 713 661-06
Marca: Dornbracht', 'UD.', 1.0, 1289.78, 1496.15, 1.0, 1289.78, 1.16, 1496.15, true, 'igual', '004deff1-d228-566c-b479-5d489aa6bad6', 213),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_02', 'Griferias y accesorios', '8_EQ_02.2', 'Baño master', 'B.01 – Grifería doble de lavabos (Dornbracht META)

Descripción:
Suministro e instalación de 2 unidades de grifería Dornbracht META, batería americana con válvula automática, acabado platino cepillado.

Modelo / SKU: 20 713 661-06
Marca: Dornbracht', 'UD.', 2.0, 1289.78, 1496.15, 2.0, 1289.78, 1.16, 1496.15, true, 'igual', '004deff1-d228-566c-b479-5d489aa6bad6', 214),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_02', 'Griferias y accesorios', '8_EQ_02.3', 'Baño master', 'B.02 – Sistema de ducha (Antoniolupi GHOST CombiLED)

Descripción:
Suministro e instalación de sistema de ducha GHOST CombiLED (Antoniolupi), incluyendo módulo empotrado, rociador integrado y componentes de control.

Marca / Modelo: Antoniolupi – Ghost CombiLED', 'UD.', 1.0, 4406.0, 5110.96, 1.0, 4406.0, 1.16, 5110.96, true, 'igual', 'a23df394-9d7e-57e6-be16-d93a3ce65be7', 215),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_02', 'Griferias y accesorios', '8_EQ_02.4', 'Baño dormitorio 1', 'C.01 – Grifería mural empotrada (Dornbracht META)

Descripción:
Suministro e instalación de grifería META monomando mural empotrada, sin válvula, acabado platino cepillado.

Modelo / SKU: 36 860 660-06
Marca: Dornbracht', 'UD.', 2.0, 871.58, 1011.04, 2.0, 871.58, 1.16, 1011.04, true, 'igual', '004deff1-d228-566c-b479-5d489aa6bad6', 216),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_02', 'Griferias y accesorios', '8_EQ_02.5', 'Baño dormitorio 1', 'C.02 – Sistema de ducha GHOST (Antoniolupi)

Descripción:
Suministro e instalación de sistema de ducha GHOST (Antoniolupi), rociador empotrado minimalista.', 'UD.', 1.0, 3677.0, 4265.32, 1.0, 3677.0, 1.16, 4265.32, true, 'igual', 'a23df394-9d7e-57e6-be16-d93a3ce65be7', 217),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_02', 'Griferias y accesorios', '8_EQ_02.6', 'Baño dormitorio 2', 'D.01 – Grifería mural empotrada doble (Dornbracht META)

Descripción:
Suministro e instalación de 2 unidades de grifería mural Dornbracht META, monomando empotrado, sin válvula, acabado platino cepillado.

Modelo / SKU: 36 860 660-06
Marca: Dornbracht', 'UD.', 2.0, 871.58, 1011.04, 2.0, 871.58, 1.16, 1011.04, true, 'igual', '004deff1-d228-566c-b479-5d489aa6bad6', 218),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_02', 'Griferias y accesorios', '8_EQ_02.7', 'Baño dormitorio 2', 'D.02 – Sistema de ducha Ghost CombiLED sin segundo rociador (Antoniolupi)

Descripción:
Suministro e instalación de sistema de ducha Ghost CombiLED (Antoniolupi) sin segundo rociador, con módulo empotrado y rociador principal.', 'UD.', 1.0, 4406.0, 5110.96, 1.0, 4406.0, 1.16, 5110.96, true, 'igual', 'a23df394-9d7e-57e6-be16-d93a3ce65be7', 219),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_02', 'Griferias y accesorios', '8_EQ_02.8', 'Baño dormitorio de servicio', 'E.01 – Grifería sencilla IMEX (Lavabo)

Descripción:
Suministro e instalación de grifería de lavabo tipo IMEX, acabado cromado, monomando estándar.', 'UD.', 1.0, 115.0, 133.4, 1.0, 115.0, 1.16, 133.4, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 220),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_02', 'Griferias y accesorios', '8_EQ_02.9', 'Baño dormitorio de servicio', 'E.02 – Grifería de ducha no empotrada (IMEX / estándar)

Descripción:
Suministro e instalación de grifería de ducha no empotrada, tipo bar, acabado cromado, para zona de servicio.', 'UD.', 1.0, 200.0, 232.0, 1.0, 200.0, 1.16, 232.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 221),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_03', 'Mecanismos (Apagadores)', '8_EQ_03.1', 'Marco simple Facet para 2 botones redondos brushed nickel', 'Atelier Luxus', 'UD.', 4.0, 76.56, 88.81, 4.0, 76.56, 1.16, 88.81, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 222),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_03', 'Mecanismos (Apagadores)', '8_EQ_03.2', 'Doble pulsador Edges', 'Atelier Luxus', 'UD.', 4.0, 20.07, 23.29, 4.0, 20.07, 1.16, 23.29, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 223),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_03', 'Mecanismos (Apagadores)', '8_EQ_03.3', 'Marco simple Facet para 4 botones redondos brushed nickel', 'Atelier Luxus', 'UD.', 1.0, 92.68, 107.51, 1.0, 92.68, 1.16, 107.51, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 224),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_03', 'Mecanismos (Apagadores)', '8_EQ_03.4', 'Mecanismo de 4 botones pulsadores Edges', 'Atelier Luxus', 'UD.', 1.0, 32.62, 37.84, 1.0, 32.62, 1.16, 37.84, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 225),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_03', 'Mecanismos (Apagadores)', '8_EQ_03.5', 'Marco simple Facet para 1 botón redondo brushed nickel', 'Atelier Luxus', 'UD.', 2.0, 60.45, 70.13, 2.0, 60.45, 1.16, 70.13, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 226),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_03', 'Mecanismos (Apagadores)', '8_EQ_03.6', 'Pulsador simple Edges', 'Atelier Luxus', 'UD.', 2.0, 13.65, 15.84, 2.0, 13.65, 1.16, 15.84, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 227),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_03', 'Mecanismos (Apagadores)', '8_EQ_03.7', 'DoT para 1 pulsador DoT inox', 'Atelier Luxus', 'UD.', 1.0, 105.5, 122.38, 1.0, 105.5, 1.16, 122.38, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 228),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_03', 'Mecanismos (Apagadores)', '8_EQ_03.8', 'DoT para 2 pulsadores DoT inox', 'Atelier Luxus', 'UD.', 8.0, 110.4, 128.07, 8.0, 110.4, 1.16, 128.07, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 229),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_03', 'Mecanismos (Apagadores)', '8_EQ_03.9', 'DoT para 4 pulsadores DoT inox', 'Atelier Luxus', 'UD.', 8.0, 120.17, 139.4, 8.0, 120.17, 1.16, 139.4, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 230),
  ('a1c38000-0000-4000-8000-000000000038', 8, 'EQUIPAMIENTO', '8_EQ_03', 'Mecanismos (Apagadores)', '8_EQ_03.10', 'Portes', 'Atelier Luxus', 'UD.', 1.0, 100.0, 116.0, 1.0, 100.0, 1.16, 116.0, true, 'igual', '01c9f60b-6977-5f66-870f-8d8f07758de1', 231),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_01', 'Mobiliario de cocina', '9_COC_01.1', 'Módulos altos, bajos y columnas', 'Suministro y montaje de módulos CESAR Maxima 2.2 en acabados chapado castaño sbiancato y grigio fumo, incluyendo columnas, módulos bajos y altos.

Incluye:
Estructuras, frentes, interiores, herrajes, panelados, patas, regletas y mecanizados.', '', 1.0, 32350.9498, 37527.11, 1.0, 32350.9498, 1.16, 37527.11, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 232),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_01', 'Mobiliario de cocina', '9_COC_01.2', 'Cajoneras, caceroleros y hardware BLUM', 'Cajones BLUM Legrabox, caceroleros, kits interiores, organizadores, sistemas Servo Drive y accesorios de apertura.

Incluye:
Cajones a medida, carriles, costillas, divisores, mecanismos push y accesorios.', '', 1.0, 7464.3579, 8658.66, 1.0, 7464.3579, 1.16, 8658.66, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 233),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_01', 'Mobiliario de cocina', '9_COC_01.3', 'Panelados, laterales y remates', 'Panelados verticales, tapas, costados, zócalos, regletas y remates específicos CESAR, incluidos mecanizados.

Incluye:
Cortes a medida, material especial, barnices, ajustes y montaje.', '', 1.0, 5689.1636, 6599.43, 1.0, 5689.1636, 1.16, 6599.43, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 234),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_01', 'Mobiliario de cocina', '9_COC_01.4', 'Grifería y accesorios de fregadero PLADOS (Extras)', 'Suministro e instalación de grifería de cocina y accesorios premium de la marca PLADOS, incluyendo caño extraíble en acabado Gun Metal, kit de válvula y rebosadero en acabado Black PVD y sifón salvaespacio en acabado gris metal.

Incluye:

Grifería extraíble TANARO D BRADANO Gun Metal – Ref. 62510

Kit válvula premium Black PVD (globo + válvula + rebosadero) – Ref. 36225

Sifón salvaespacio Luxe GR Gris Metal – Ref. 9.1290.02', '', 1.0, 603.1675, 699.68, 1.0, 603.1675, 1.16, 699.68, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 235),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_01', 'Mobiliario de cocina', '9_COC_01.5', 'Transporte, montaje y puesta a punto', '', '', 1.0, 10672.2011, 12379.76, 1.0, 10672.2011, 1.16, 12379.76, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 236),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_02', 'Encimera, aplacado y fregadero', '9_COC_02.1', 'Encimera principal acero FOSTER 10/10', 'Incluye corte, mecanizado, bordes, soldaduras, cantos y soporte.', '', 1.0, 9550.0335, 11078.04, 1.0, 9550.0335, 1.16, 11078.04, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 237),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_02', 'Encimera, aplacado y fregadero', '9_COC_02.2', 'Encimera isla FOSTER 10/10', 'Placa de trabajo completa para isla con estructura reforzada.', '', 1.0, 6469.1895, 7504.26, 1.0, 6469.1895, 1.16, 7504.26, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 238),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_03', 'Electrodomesticos', '9_COC_03.1', 'Frigorífico integrado Miele K 7737 D', 'Frigorífico de integración con tecnología DynaCool e iluminación LED.

Detalle:
Equipo Miele de integración total, con sistema de distribución homogénea de temperatura DynaCool, estantes de vidrio y LED interior. Ideal para instalación en columna CESAR.', '', 1.0, 1221.5931, 1417.05, 1.0, 1221.5931, 1.16, 1417.05, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 239),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_03', 'Electrodomesticos', '9_COC_03.2', 'Lavavajillas integrado Miele G 5150 SCVi Active', 'Lavavajillas de integración total de 60 cm.

Detalle:
Modelo totalmente panelable, con bandejas flexibles, ciclo ECO y nivel sonoro reducido. Compatible con mobiliario CESAR para integración completa.', '', 1.0, 862.083, 1000.02, 1.0, 862.083, 1.16, 1000.02, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 240),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_03', 'Electrodomesticos', '9_COC_03.3', 'Horno multifunción Miele H 7264 B Obsidian Black', 'Horno multifunción en acabado Obsidian Black.

Detalle:
Horno Miele con múltiples modos de cocción, puerta SoftClose, interior esmaltado y estética oscura premium. Preparado para encastre en columna.', '', 1.0, 1113.7392, 1291.94, 1.0, 1113.7392, 1.16, 1291.94, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 241),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_03', 'Electrodomesticos', '9_COC_03.4', 'Microondas empotrable Miele M 7244 TC Obsidian Black', 'Microondas empotrable de 46 L y plato giratorio de 40 cm.

Detalle:
Modelo en acabado Obsidian Black, con interior amplio, plato giratorio grande, múltiples funciones y perfecta integración en módulo alto.', '', 1.0, 1077.7908, 1250.24, 1.0, 1077.7908, 1.16, 1250.24, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 242),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_03', 'Electrodomesticos', '9_COC_03.5', 'Placa de inducción Miele KM 7373 FL (80 cm)', 'Placa de inducción de 80 cm con zona Flex para recipientes grandes.

Detalle:
Placa de inducción totalmente enrasable, con zonas flexibles que permiten unir áreas de cocción, detección inteligente de recipientes y control táctil.', '', 1.0, 862.0917, 1000.03, 1.0, 862.0917, 1.16, 1000.03, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 243),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_03', 'Electrodomesticos', '9_COC_03.6', 'Campana downdraft FIM NEwTON Panelable 90 INOX', 'Campana extractora downdraft de 90 cm, panelable, motor interior.

Detalle:
Sistema de extracción telescópica ocultable, apta para panelar en el mobiliario CESAR; incluye motor interior de alto rendimiento y controles integrados.', '', 1.0, 2530.83, 2935.77, 1.0, 2530.83, 1.16, 2935.77, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 244),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_04', 'Bar', '9_COC_04.1', 'Mobiliario de Bar CESAR Maxima 2.2', 'Frentes, caceroleros, módulos altos y bajos, panelado completo.', '', 1.0, 5725.8876, 6642.03, 1.0, 5725.8876, 1.16, 6642.03, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 245),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_04', 'Bar', '9_COC_04.2', 'Puertas escamoteables', 'Puertas escamoteables de bar con herraje calidad premium', '', 1.0, 9548.2674, 11076.0, 1.0, 9548.2674, 1.16, 11076.0, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 246),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_04', 'Bar', '9_COC_04.3', 'Encimera Foster inox para bar', 'Acero 10/10 con mecanizados y remates.', '', 1.0, 5162.1624, 5988.11, 1.0, 5162.1624, 1.16, 5988.11, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 247),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_04', 'Bar', '9_COC_04.4', 'Electrodomésticos bar', 'Congelador Miele FNUS 7040 D

Vinoteca Miele KWT 6422 i', '', 1.0, 3413.8539, 3960.08, 1.0, 3413.8539, 1.16, 3960.08, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 248),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_04', 'Bar', '9_COC_04.5', 'Espejo', 'Aplacado mueble bar', '', 1.0, 652.5, 756.9, 1.0, 652.5, 1.16, 756.9, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 249),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_04', 'Bar', '9_COC_04.6', 'Encimera de marmol', 'Marmol Granith', '', 1.0, 4950.0, 5742.0, 1.0, 4950.0, 1.16, 5742.0, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 250),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_05', 'Lavanderia', '9_COC_05.1', 'Mobiliario Lavandería CESAR', 'Columnas, módulos bajos, frentes, panelados y ranuras.', '', 1.0, 8896.8723, 10320.38, 1.0, 8896.8723, 1.16, 10320.38, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 251),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_05', 'Lavanderia', '9_COC_05.2', 'Cestas abatibles / accesorios CucineOggi', '', '', 1.0, 189.66, 220.01, 1.0, 189.66, 1.16, 220.01, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 252),
  ('a1c38000-0000-4000-8000-000000000038', 9, 'COCINA', '9_COC_05', 'Lavanderia', '9_COC_05.3', 'Electrodomésticos lavandería', 'Congelador Miele FNS 7710 E

Lavadora W1 WWB360

Secadora T1 EcoSpeed TCC560WP', '', 1.0, 3017.6646, 3500.5, 1.0, 3017.6646, 1.16, 3500.5, true, 'igual', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 253),
  ('a1c38000-0000-4000-8000-000000000038', 10, 'VARIOS', '10_VAR_01', 'Varios', '10_VAR_01.1', '', '', '', 0.0, 0.0, 0.0, 0.0, 0.0, 1.16, 0.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 254),
  ('a1c38000-0000-4000-8000-000000000038', 11, 'GASTOS GENERALES', '11_GG_01', 'Documentación y tramites (DR)', '11_GG_01.1', 'Tramitación y presentación de declaración responsable', '', '', 1.0, 2000.0, 2320.0, 1.0, 2000.0, 1.16, 2320.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 255),
  ('a1c38000-0000-4000-8000-000000000038', 11, 'GASTOS GENERALES', '11_GG_02', 'Gestión de residuos', '11_GG_02.1', 'Gestion de Residuos', '', '', 1.0, 400.0, 464.0, 1.0, 400.0, 1.16, 464.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 256),
  ('a1c38000-0000-4000-8000-000000000038', 11, 'GASTOS GENERALES', '11_GG_03', 'Seguridad y salud', '11_GG_03.1', 'Seguridad y salud', '', '', 1.0, 3500.0, 4060.0, 1.0, 3500.0, 1.16, 4060.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 257),
  ('a1c38000-0000-4000-8000-000000000038', 11, 'GASTOS GENERALES', '11_GG_04', 'Limpieza de obra', '11_GG_04.1', 'Limpieza general semanal de obra y ZZCC', 'Limpieza general semanal de la obra y zonas comunes del edificio.', '', 1.0, 7600.0, 8816.0, 1.0, 7600.0, 1.16, 8816.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 258),
  ('a1c38000-0000-4000-8000-000000000038', 11, 'GASTOS GENERALES', '11_GG_04', 'Limpieza de obra', '11_GG_04.2', 'Limpieza final de obra', 'Servicio de limpieza final de obra par empresa especializada en limpiezas de obra.', '', 1.0, 4000.0, 4640.0, 1.0, 4000.0, 1.16, 4640.0, true, 'igual', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 259);

insert into public.obra_control_pagos (obra_id, proveedor_id, monto, fecha, fecha_texto, orden) values
  ('a1c38000-0000-4000-8000-000000000038', 'f63755cf-3209-5142-9117-ac1c1cc4f5e5', 40000.0, '2025-11-21', null, 0),
  ('a1c38000-0000-4000-8000-000000000038', '4fad0ee5-ef6b-5691-910e-f4953709d5cc', 14552.78, '2026-03-30', null, 0),
  ('a1c38000-0000-4000-8000-000000000038', '287fbd27-5c10-5435-b6fb-fcfae964557d', 16000.0, '2026-01-22', null, 0),
  ('a1c38000-0000-4000-8000-000000000038', '287fbd27-5c10-5435-b6fb-fcfae964557d', 10000.0, '2026-02-18', null, 1),
  ('a1c38000-0000-4000-8000-000000000038', '287fbd27-5c10-5435-b6fb-fcfae964557d', 8000.0, '2026-03-23', null, 2),
  ('a1c38000-0000-4000-8000-000000000038', '01c9f60b-6977-5f66-870f-8d8f07758de1', 11458.09, '2026-02-06', null, 0),
  ('a1c38000-0000-4000-8000-000000000038', '01c9f60b-6977-5f66-870f-8d8f07758de1', 11458.09, '2026-03-03', null, 1),
  ('a1c38000-0000-4000-8000-000000000038', '1b552706-ded8-5eda-b4ed-975a28951301', 7770.51, '2026-02-24', null, 0),
  ('a1c38000-0000-4000-8000-000000000038', '1b552706-ded8-5eda-b4ed-975a28951301', 544.3, '2026-03-30', null, 1),
  ('a1c38000-0000-4000-8000-000000000038', '7528df2b-7a99-5f1a-bfaa-a4ab6875c0eb', 82253.45, '2025-12-31', null, 0),
  ('a1c38000-0000-4000-8000-000000000038', '004deff1-d228-566c-b479-5d489aa6bad6', 3712.38, '2026-01-28', null, 0),
  ('a1c38000-0000-4000-8000-000000000038', '004deff1-d228-566c-b479-5d489aa6bad6', 9130.92, '2026-02-13', null, 1),
  ('a1c38000-0000-4000-8000-000000000038', '004deff1-d228-566c-b479-5d489aa6bad6', 3712.38, '2026-02-27', null, 2),
  ('a1c38000-0000-4000-8000-000000000038', '4f3b34e8-7235-58b1-8354-18bb9bd74db8', 12338.22, '2026-02-23', null, 0),
  ('a1c38000-0000-4000-8000-000000000038', '59023776-2a04-5059-960d-2391706e3954', 11730.5, null, 'Pendiente', 0),
  ('a1c38000-0000-4000-8000-000000000038', 'efc20f1d-cb8a-55ba-9daf-dbabe2926969', 15000.0, '2026-01-26', null, 0),
  ('a1c38000-0000-4000-8000-000000000038', 'bd926912-d669-59a6-ac52-90b55f531d1d', 5436.38, '2026-02-13', null, 0),
  ('a1c38000-0000-4000-8000-000000000038', 'a5ce04c1-2e83-59b4-99a7-ca9be2d1aabd', 5260.6, '2026-01-29', null, 0),
  ('a1c38000-0000-4000-8000-000000000038', 'a5ce04c1-2e83-59b4-99a7-ca9be2d1aabd', 5260.6, '2026-02-23', null, 1);

insert into public.obra_control_depositos (obra_id, label, monto, iva, total, fecha, orden) values
  ('a1c38000-0000-4000-8000-000000000038', 'Pago 1', 40000.0, 8400.0, 48400.0, '2025-11-21', 0),
  ('a1c38000-0000-4000-8000-000000000038', 'Pago 2', 227090.91, 47689.0911, 274780.0011, '2026-01-22', 1),
  ('a1c38000-0000-4000-8000-000000000038', 'Pago 3', 136255.0, 28613.55, 164868.55, '2026-02-17', 2);

notify pgrst, 'reload schema';