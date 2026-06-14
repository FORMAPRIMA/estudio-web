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
