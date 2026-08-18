-- Web pública — mapa de Madrid.
--
-- El mapa que había era una IMAGEN PNG con 27 chinchetas colocadas por porcentaje
-- de X e Y, calibradas a mano. No existía ni una coordenada en el proyecto.
--
-- Tabla propia y NO columnas en web_proyectos a propósito: el mapa es un mapa de
-- TRAYECTORIA (todas las obras del estudio en Madrid) y el portafolio es una
-- selección curada de las que tienen ficha. Son dos conceptos; meterlos en la
-- misma tabla obligaría a inventar proyectos fantasma solo para pintar un punto.
-- Los puntos que sí corresponden a un proyecto publicado lo enlazan por
-- `proyecto_id`, que es nullable.

create table if not exists public.web_mapa_puntos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  direccion   text,
  -- Coordenadas en WGS84. Nullable porque un punto puede darse de alta antes de
  -- geocodificarlo; el mapa solo pinta los que tienen las dos.
  lat         double precision,
  lng         double precision,
  anio        text,
  proyecto_id uuid references public.web_proyectos(id) on delete set null,
  orden       integer not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists web_mapa_puntos_orden_idx on public.web_mapa_puntos (orden, created_at);

alter table public.web_mapa_puntos enable row level security;
-- Sin políticas: solo se accede con service_role desde Server Actions, igual que
-- el resto de tablas web_*.

-- Semilla: las 27 obras que ya estaban en el mapa del teaser, en el mismo orden.
-- Sin coordenadas todavía — las rellena `scripts/geocodificar-mapa.mjs`, y después
-- se revisan UNA A UNA contra el mapa real. Geocodificar direcciones de calle en
-- Madrid acierta ~95%, y una chincheta en la calle equivocada es peor que no
-- tener mapa.
insert into public.web_mapa_puntos (nombre, direccion, orden)
select * from (values
  ('General Oraá 54',      'Calle del General Oraá 54, Madrid, España',      1),
  ('Narváez 7',            'Calle de Narváez 7, Madrid, España',             2),
  ('Larra 16',             'Calle de Larra 16, Madrid, España',              3),
  ('Almagro 44',           'Calle de Almagro 44, Madrid, España',            4),
  ('Huertas 25',           'Calle de las Huertas 25, Madrid, España',        5),
  ('Columela 6',           'Calle de Columela 6, Madrid, España',            6),
  ('Castelló 98',          'Calle de Castelló 98, Madrid, España',           7),
  ('Columela 3',           'Calle de Columela 3, Madrid, España',            8),
  ('General Pardiñas 31',  'Calle del General Pardiñas 31, Madrid, España',  9),
  ('O''Donnell 35',        'Calle de O''Donnell 35, Madrid, España',         10),
  ('Lagasca 127',          'Calle de Lagasca 127, Madrid, España',           11),
  ('Lope de Rueda 46',     'Calle de Lope de Rueda 46, Madrid, España',      12),
  ('Lope de Rueda 4',      'Calle de Lope de Rueda 4, Madrid, España',       13),
  ('Villanueva 4',         'Calle de Villanueva 4, Madrid, España',          14),
  ('Doctor Castelo 15',    'Calle del Doctor Castelo 15, Madrid, España',    15),
  ('Claudio Coello 116',   'Calle de Claudio Coello 116, Madrid, España',    16),
  ('Lagasca 94',           'Calle de Lagasca 94, Madrid, España',            17),
  ('Montalbán 10',         'Calle de Montalbán 10, Madrid, España',          18),
  ('Claudio Coello 38',    'Calle de Claudio Coello 38, Madrid, España',     19),
  ('Francisco Vitoria 4',  'Calle de Francisco de Vitoria 4, Madrid, España',20),
  ('Conde de Peñalver 31', 'Calle del Conde de Peñalver 31, Madrid, España', 21),
  ('Ríos Rosas 52',        'Calle de Ríos Rosas 52, Madrid, España',         22),
  ('García Paredes 78',    'Calle de García de Paredes 78, Madrid, España',  23),
  ('Ferraz 36',            'Calle de Ferraz 36, Madrid, España',             24),
  ('Fuente del Berro 12',  'Calle de la Fuente del Berro 12, Madrid, España',25),
  ('Serrano 84',           'Calle de Serrano 84, Madrid, España',            26),
  ('Lope de Hoyos 7',      'Calle de Lope de Hoyos 7, Madrid, España',       27)
) as v(nombre, direccion, orden)
where not exists (select 1 from public.web_mapa_puntos);

notify pgrst, 'reload schema';
