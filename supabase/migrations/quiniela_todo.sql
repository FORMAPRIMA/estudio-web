-- ── La Porra del Mundial 2026 — esquema ──────────────────────────────────────
-- Ejecutar antes que quiniela_seed.sql (fixture de equipos y partidos).

create table if not exists quiniela_equipos (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,          -- 'MEX', 'ESP'…
  nombre     text not null,
  bandera    text not null,                 -- emoji
  grupo      text not null                  -- 'A'..'L'
);

create table if not exists quiniela_partidos (
  id                  uuid primary key default gen_random_uuid(),
  numero              int  not null unique,  -- 1..104
  fase                text not null check (fase in
    ('grupos','dieciseisavos','octavos','cuartos','semifinal','tercer_puesto','final')),
  grupo               text,                  -- solo fase de grupos
  etiqueta_local      text,                  -- '1A', 'W74'… (cruces sin resolver)
  etiqueta_visitante  text,
  equipo_local_id     uuid references quiniela_equipos(id),
  equipo_visitante_id uuid references quiniela_equipos(id),
  fecha_hora          timestamptz not null,  -- kickoff (bloquea predicciones)
  ciudad              text,
  goles_local         int,
  goles_visitante     int,
  equipo_que_pasa_id  uuid references quiniela_equipos(id),  -- eliminatorias con penaltis
  estado              text not null default 'programado'
                        check (estado in ('programado','finalizado'))
);

create table if not exists quiniela_participantes (
  user_id    uuid primary key references profiles(id) on delete cascade,
  nombre     text not null,
  pagado     boolean not null default false,
  pichichi   text,                           -- pick de máximo goleador (bonus)
  created_at timestamptz not null default now()
);

create table if not exists quiniela_predicciones (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  partido_id         uuid not null references quiniela_partidos(id) on delete cascade,
  goles_local        int not null check (goles_local >= 0),
  goles_visitante    int not null check (goles_visitante >= 0),
  equipo_que_pasa_id uuid references quiniela_equipos(id),  -- requerido si empate en eliminatoria
  puntos             int,                                   -- calculado al cerrar el partido
  updated_at         timestamptz not null default now(),
  unique (user_id, partido_id)
);

create table if not exists quiniela_picks_campeon (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  ventana    text not null check (ventana in
    ('apertura','grupos','dieciseisavos','octavos','cuartos')),
  equipo_id  uuid not null references quiniela_equipos(id),
  created_at timestamptz not null default now(),
  unique (user_id, ventana)
);

create table if not exists quiniela_config (
  key   text primary key,
  value text
);

insert into quiniela_config (key, value) values
  ('monto_entrada',    '20'),
  ('reparto',          '70/20/10'),
  ('ventana_activa',   'apertura'),
  ('pichichi_ganador', null),
  ('campeon_id',       null)
on conflict (key) do nothing;

create index if not exists idx_quiniela_predicciones_partido on quiniela_predicciones(partido_id);
create index if not exists idx_quiniela_predicciones_user    on quiniela_predicciones(user_id);
create index if not exists idx_quiniela_partidos_fecha       on quiniela_partidos(fecha_hora);

notify pgrst, 'reload schema';
-- ── La Porra del Mundial 2026 — fixture oficial ──────────────────────────────
-- Ejecutar DESPUÉS de quiniela.sql. Fechas en UTC (kickoff real).

insert into quiniela_equipos (codigo, nombre, bandera, grupo) values
  ('MEX', 'México', '🇲🇽', 'A'),
  ('RSA', 'Sudáfrica', '🇿🇦', 'A'),
  ('KOR', 'Corea del Sur', '🇰🇷', 'A'),
  ('CZE', 'Chequia', '🇨🇿', 'A'),
  ('CAN', 'Canadá', '🇨🇦', 'B'),
  ('BIH', 'Bosnia y Herzegovina', '🇧🇦', 'B'),
  ('QAT', 'Catar', '🇶🇦', 'B'),
  ('SUI', 'Suiza', '🇨🇭', 'B'),
  ('BRA', 'Brasil', '🇧🇷', 'C'),
  ('MAR', 'Marruecos', '🇲🇦', 'C'),
  ('SCO', 'Escocia', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'C'),
  ('HAI', 'Haití', '🇭🇹', 'C'),
  ('USA', 'Estados Unidos', '🇺🇸', 'D'),
  ('PAR', 'Paraguay', '🇵🇾', 'D'),
  ('AUS', 'Australia', '🇦🇺', 'D'),
  ('TUR', 'Turquía', '🇹🇷', 'D'),
  ('GER', 'Alemania', '🇩🇪', 'E'),
  ('ECU', 'Ecuador', '🇪🇨', 'E'),
  ('CIV', 'Costa de Marfil', '🇨🇮', 'E'),
  ('CUW', 'Curazao', '🇨🇼', 'E'),
  ('NED', 'Países Bajos', '🇳🇱', 'F'),
  ('JPN', 'Japón', '🇯🇵', 'F'),
  ('TUN', 'Túnez', '🇹🇳', 'F'),
  ('SWE', 'Suecia', '🇸🇪', 'F'),
  ('BEL', 'Bélgica', '🇧🇪', 'G'),
  ('EGY', 'Egipto', '🇪🇬', 'G'),
  ('IRN', 'Irán', '🇮🇷', 'G'),
  ('NZL', 'Nueva Zelanda', '🇳🇿', 'G'),
  ('ESP', 'España', '🇪🇸', 'H'),
  ('URU', 'Uruguay', '🇺🇾', 'H'),
  ('KSA', 'Arabia Saudita', '🇸🇦', 'H'),
  ('CPV', 'Cabo Verde', '🇨🇻', 'H'),
  ('FRA', 'Francia', '🇫🇷', 'I'),
  ('SEN', 'Senegal', '🇸🇳', 'I'),
  ('NOR', 'Noruega', '🇳🇴', 'I'),
  ('IRQ', 'Irak', '🇮🇶', 'I'),
  ('ARG', 'Argentina', '🇦🇷', 'J'),
  ('ALG', 'Argelia', '🇩🇿', 'J'),
  ('AUT', 'Austria', '🇦🇹', 'J'),
  ('JOR', 'Jordania', '🇯🇴', 'J'),
  ('POR', 'Portugal', '🇵🇹', 'K'),
  ('COL', 'Colombia', '🇨🇴', 'K'),
  ('UZB', 'Uzbekistán', '🇺🇿', 'K'),
  ('COD', 'RD Congo', '🇨🇩', 'K'),
  ('ENG', 'Inglaterra', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'L'),
  ('CRO', 'Croacia', '🇭🇷', 'L'),
  ('PAN', 'Panamá', '🇵🇦', 'L'),
  ('GHA', 'Ghana', '🇬🇭', 'L')
on conflict (codigo) do nothing;

-- Fase de grupos (72 partidos)
with fixture(numero, grupo, local, visitante, fecha, ciudad) as (
  values
    (1,  'A', 'MEX', 'RSA', '2026-06-11T19:00:00Z'::timestamptz, 'Ciudad de México'),
    (2,  'A', 'KOR', 'CZE', '2026-06-12T02:00:00Z'::timestamptz, 'Guadalajara'),
    (3,  'B', 'CAN', 'BIH', '2026-06-12T19:00:00Z'::timestamptz, 'Toronto'),
    (4,  'D', 'USA', 'PAR', '2026-06-13T01:00:00Z'::timestamptz, 'Los Ángeles'),
    (5,  'C', 'HAI', 'SCO', '2026-06-14T01:00:00Z'::timestamptz, 'Boston'),
    (6,  'D', 'AUS', 'TUR', '2026-06-14T04:00:00Z'::timestamptz, 'Vancouver'),
    (7,  'C', 'BRA', 'MAR', '2026-06-13T22:00:00Z'::timestamptz, 'Nueva York/Nueva Jersey'),
    (8,  'B', 'QAT', 'SUI', '2026-06-13T19:00:00Z'::timestamptz, 'San Francisco'),
    (9,  'E', 'CIV', 'ECU', '2026-06-14T23:00:00Z'::timestamptz, 'Filadelfia'),
    (10, 'E', 'GER', 'CUW', '2026-06-14T17:00:00Z'::timestamptz, 'Houston'),
    (11, 'F', 'NED', 'JPN', '2026-06-14T20:00:00Z'::timestamptz, 'Dallas'),
    (12, 'F', 'SWE', 'TUN', '2026-06-15T02:00:00Z'::timestamptz, 'Monterrey'),
    (13, 'H', 'KSA', 'URU', '2026-06-15T22:00:00Z'::timestamptz, 'Miami'),
    (14, 'H', 'ESP', 'CPV', '2026-06-15T16:00:00Z'::timestamptz, 'Atlanta'),
    (15, 'G', 'BEL', 'EGY', '2026-06-15T19:00:00Z'::timestamptz, 'Seattle'),
    (16, 'G', 'IRN', 'NZL', '2026-06-16T01:00:00Z'::timestamptz, 'Los Ángeles'),
    (17, 'I', 'FRA', 'SEN', '2026-06-16T19:00:00Z'::timestamptz, 'Nueva York/Nueva Jersey'),
    (18, 'I', 'IRQ', 'NOR', '2026-06-16T22:00:00Z'::timestamptz, 'Boston'),
    (19, 'J', 'ARG', 'ALG', '2026-06-17T01:00:00Z'::timestamptz, 'Kansas City'),
    (20, 'J', 'AUT', 'JOR', '2026-06-17T04:00:00Z'::timestamptz, 'San Francisco'),
    (21, 'L', 'GHA', 'PAN', '2026-06-17T23:00:00Z'::timestamptz, 'Toronto'),
    (22, 'L', 'ENG', 'CRO', '2026-06-17T20:00:00Z'::timestamptz, 'Dallas'),
    (23, 'K', 'POR', 'COD', '2026-06-17T17:00:00Z'::timestamptz, 'Houston'),
    (24, 'K', 'UZB', 'COL', '2026-06-18T02:00:00Z'::timestamptz, 'Ciudad de México'),
    (25, 'A', 'CZE', 'RSA', '2026-06-18T16:00:00Z'::timestamptz, 'Atlanta'),
    (26, 'B', 'SUI', 'BIH', '2026-06-18T19:00:00Z'::timestamptz, 'Los Ángeles'),
    (27, 'B', 'CAN', 'QAT', '2026-06-18T22:00:00Z'::timestamptz, 'Vancouver'),
    (28, 'A', 'MEX', 'KOR', '2026-06-19T01:00:00Z'::timestamptz, 'Guadalajara'),
    (29, 'C', 'BRA', 'HAI', '2026-06-20T01:00:00Z'::timestamptz, 'Filadelfia'),
    (30, 'C', 'SCO', 'MAR', '2026-06-19T22:00:00Z'::timestamptz, 'Boston'),
    (31, 'D', 'TUR', 'PAR', '2026-06-20T03:00:00Z'::timestamptz, 'San Francisco'),
    (32, 'D', 'USA', 'AUS', '2026-06-19T19:00:00Z'::timestamptz, 'Seattle'),
    (33, 'E', 'GER', 'CIV', '2026-06-20T20:00:00Z'::timestamptz, 'Toronto'),
    (34, 'E', 'ECU', 'CUW', '2026-06-21T00:00:00Z'::timestamptz, 'Kansas City'),
    (35, 'F', 'NED', 'SWE', '2026-06-20T17:00:00Z'::timestamptz, 'Houston'),
    (36, 'F', 'TUN', 'JPN', '2026-06-21T04:00:00Z'::timestamptz, 'Monterrey'),
    (37, 'H', 'URU', 'CPV', '2026-06-21T22:00:00Z'::timestamptz, 'Miami'),
    (38, 'H', 'ESP', 'KSA', '2026-06-21T16:00:00Z'::timestamptz, 'Atlanta'),
    (39, 'G', 'BEL', 'IRN', '2026-06-21T19:00:00Z'::timestamptz, 'Los Ángeles'),
    (40, 'G', 'NZL', 'EGY', '2026-06-22T01:00:00Z'::timestamptz, 'Vancouver'),
    (41, 'I', 'NOR', 'SEN', '2026-06-23T00:00:00Z'::timestamptz, 'Nueva York/Nueva Jersey'),
    (42, 'I', 'FRA', 'IRQ', '2026-06-22T21:00:00Z'::timestamptz, 'Filadelfia'),
    (43, 'J', 'ARG', 'AUT', '2026-06-22T17:00:00Z'::timestamptz, 'Dallas'),
    (44, 'J', 'JOR', 'ALG', '2026-06-23T03:00:00Z'::timestamptz, 'San Francisco'),
    (45, 'L', 'ENG', 'GHA', '2026-06-23T20:00:00Z'::timestamptz, 'Boston'),
    (46, 'L', 'PAN', 'CRO', '2026-06-23T23:00:00Z'::timestamptz, 'Toronto'),
    (47, 'K', 'POR', 'UZB', '2026-06-23T17:00:00Z'::timestamptz, 'Houston'),
    (48, 'K', 'COL', 'COD', '2026-06-24T02:00:00Z'::timestamptz, 'Guadalajara'),
    (49, 'C', 'SCO', 'BRA', '2026-06-24T22:00:00Z'::timestamptz, 'Miami'),
    (50, 'C', 'MAR', 'HAI', '2026-06-24T22:00:00Z'::timestamptz, 'Atlanta'),
    (51, 'B', 'SUI', 'CAN', '2026-06-24T19:00:00Z'::timestamptz, 'Vancouver'),
    (52, 'B', 'BIH', 'QAT', '2026-06-24T19:00:00Z'::timestamptz, 'Seattle'),
    (53, 'A', 'CZE', 'MEX', '2026-06-25T01:00:00Z'::timestamptz, 'Ciudad de México'),
    (54, 'A', 'RSA', 'KOR', '2026-06-25T01:00:00Z'::timestamptz, 'Monterrey'),
    (55, 'E', 'CUW', 'CIV', '2026-06-25T20:00:00Z'::timestamptz, 'Filadelfia'),
    (56, 'E', 'ECU', 'GER', '2026-06-25T20:00:00Z'::timestamptz, 'Nueva York/Nueva Jersey'),
    (57, 'F', 'JPN', 'SWE', '2026-06-25T23:00:00Z'::timestamptz, 'Dallas'),
    (58, 'F', 'TUN', 'NED', '2026-06-25T23:00:00Z'::timestamptz, 'Kansas City'),
    (59, 'D', 'TUR', 'USA', '2026-06-26T02:00:00Z'::timestamptz, 'Los Ángeles'),
    (60, 'D', 'PAR', 'AUS', '2026-06-26T02:00:00Z'::timestamptz, 'San Francisco'),
    (61, 'I', 'NOR', 'FRA', '2026-06-26T19:00:00Z'::timestamptz, 'Boston'),
    (62, 'I', 'SEN', 'IRQ', '2026-06-26T19:00:00Z'::timestamptz, 'Toronto'),
    (63, 'G', 'EGY', 'IRN', '2026-06-27T03:00:00Z'::timestamptz, 'Seattle'),
    (64, 'G', 'NZL', 'BEL', '2026-06-27T03:00:00Z'::timestamptz, 'Vancouver'),
    (65, 'H', 'CPV', 'KSA', '2026-06-27T00:00:00Z'::timestamptz, 'Houston'),
    (66, 'H', 'URU', 'ESP', '2026-06-27T00:00:00Z'::timestamptz, 'Guadalajara'),
    (67, 'L', 'PAN', 'ENG', '2026-06-27T21:00:00Z'::timestamptz, 'Nueva York/Nueva Jersey'),
    (68, 'L', 'CRO', 'GHA', '2026-06-27T21:00:00Z'::timestamptz, 'Filadelfia'),
    (69, 'J', 'ALG', 'AUT', '2026-06-28T02:00:00Z'::timestamptz, 'Kansas City'),
    (70, 'J', 'JOR', 'ARG', '2026-06-28T02:00:00Z'::timestamptz, 'Dallas'),
    (71, 'K', 'COL', 'POR', '2026-06-27T23:30:00Z'::timestamptz, 'Miami'),
    (72, 'K', 'COD', 'UZB', '2026-06-27T23:30:00Z'::timestamptz, 'Atlanta')
)
insert into quiniela_partidos (numero, fase, grupo, equipo_local_id, equipo_visitante_id, fecha_hora, ciudad)
select f.numero, 'grupos', f.grupo, el.id, ev.id, f.fecha, f.ciudad
from fixture f
join quiniela_equipos el on el.codigo = f.local
join quiniela_equipos ev on ev.codigo = f.visitante
on conflict (numero) do nothing;

-- Eliminatorias (32 partidos, cruces por etiqueta hasta que se resuelva el bracket)
insert into quiniela_partidos (numero, fase, etiqueta_local, etiqueta_visitante, fecha_hora, ciudad) values
  (73,  'dieciseisavos', '2A',          '2B',          '2026-06-28T19:00:00Z', 'Los Ángeles'),
  (74,  'dieciseisavos', '1E',          '3A/B/C/D/F',  '2026-06-29T20:30:00Z', 'Boston'),
  (75,  'dieciseisavos', '1F',          '2C',          '2026-06-30T01:00:00Z', 'Monterrey'),
  (76,  'dieciseisavos', '1C',          '2F',          '2026-06-29T17:00:00Z', 'Houston'),
  (77,  'dieciseisavos', '1I',          '3C/D/F/G/H',  '2026-06-30T21:00:00Z', 'Nueva York/Nueva Jersey'),
  (78,  'dieciseisavos', '2E',          '2I',          '2026-06-30T17:00:00Z', 'Dallas'),
  (79,  'dieciseisavos', '1A',          '3C/E/F/H/I',  '2026-07-01T01:00:00Z', 'Ciudad de México'),
  (80,  'dieciseisavos', '1L',          '3E/H/I/J/K',  '2026-07-01T16:00:00Z', 'Atlanta'),
  (81,  'dieciseisavos', '1D',          '3B/E/F/I/J',  '2026-07-02T00:00:00Z', 'San Francisco'),
  (82,  'dieciseisavos', '1G',          '3A/E/H/I/J',  '2026-07-01T20:00:00Z', 'Seattle'),
  (83,  'dieciseisavos', '2K',          '2L',          '2026-07-02T23:00:00Z', 'Toronto'),
  (84,  'dieciseisavos', '1H',          '2J',          '2026-07-02T19:00:00Z', 'Los Ángeles'),
  (85,  'dieciseisavos', '1B',          '3E/F/G/I/J',  '2026-07-03T03:00:00Z', 'Vancouver'),
  (86,  'dieciseisavos', '1J',          '2H',          '2026-07-03T22:00:00Z', 'Miami'),
  (87,  'dieciseisavos', '1K',          '3D/E/I/J/L',  '2026-07-04T01:30:00Z', 'Kansas City'),
  (88,  'dieciseisavos', '2D',          '2G',          '2026-07-03T18:00:00Z', 'Dallas'),
  (89,  'octavos',       'W74',         'W77',         '2026-07-04T21:00:00Z', 'Filadelfia'),
  (90,  'octavos',       'W73',         'W75',         '2026-07-04T17:00:00Z', 'Houston'),
  (91,  'octavos',       'W76',         'W78',         '2026-07-05T20:00:00Z', 'Nueva York/Nueva Jersey'),
  (92,  'octavos',       'W79',         'W80',         '2026-07-06T00:00:00Z', 'Ciudad de México'),
  (93,  'octavos',       'W83',         'W84',         '2026-07-06T19:00:00Z', 'Dallas'),
  (94,  'octavos',       'W81',         'W82',         '2026-07-07T00:00:00Z', 'Seattle'),
  (95,  'octavos',       'W86',         'W88',         '2026-07-07T16:00:00Z', 'Atlanta'),
  (96,  'octavos',       'W85',         'W87',         '2026-07-07T20:00:00Z', 'Vancouver'),
  (97,  'cuartos',       'W89',         'W90',         '2026-07-09T20:00:00Z', 'Boston'),
  (98,  'cuartos',       'W93',         'W94',         '2026-07-10T19:00:00Z', 'Los Ángeles'),
  (99,  'cuartos',       'W91',         'W92',         '2026-07-11T21:00:00Z', 'Miami'),
  (100, 'cuartos',       'W95',         'W96',         '2026-07-12T01:00:00Z', 'Kansas City'),
  (101, 'semifinal',     'W97',         'W98',         '2026-07-14T19:00:00Z', 'Dallas'),
  (102, 'semifinal',     'W99',         'W100',        '2026-07-15T19:00:00Z', 'Atlanta'),
  (103, 'tercer_puesto', 'L101',        'L102',        '2026-07-18T21:00:00Z', 'Miami'),
  (104, 'final',         'W101',        'W102',        '2026-07-19T19:00:00Z', 'Nueva York/Nueva Jersey')
on conflict (numero) do nothing;
