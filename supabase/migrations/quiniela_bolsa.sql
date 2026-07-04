-- ── La Porra del Mundial 2026 — "La Bolsa" (mini-apuestas) ───────────────────
-- Una apuesta opcional por partido de eliminatorias, personalizada a los equipos.
-- Importe fijo en puntos (config bolsa_stake); multiplicador fijo por opción.
-- Aciertas → ganas fichas × multiplicador; fallas → pierdes lo apostado.
-- Acceso solo vía service_role (Server Actions); no requiere grants anon/authenticated.
-- Idempotente.

create table if not exists quiniela_mercados (
  id              uuid primary key default gen_random_uuid(),
  partido_id      uuid not null references quiniela_partidos(id) on delete cascade,
  pregunta        text not null,
  subtitulo       text,                       -- p. ej. "Lionel Messi · Argentina"
  opciones        jsonb not null,             -- [{"key","label","mult"}, ...]
  estado          text not null default 'abierto'
                    check (estado in ('abierto','cerrado','liquidado')),
  opcion_ganadora text,                        -- key ganadora (al liquidar)
  auto            boolean not null default false, -- liquidación automática al cerrar el partido
  regla           text,                        -- regla de auto-liquidación ('penaltis')
  created_at      timestamptz not null default now(),
  unique (partido_id)                          -- una apuesta por partido
);

create table if not exists quiniela_apuestas (
  id          uuid primary key default gen_random_uuid(),
  jugador_id  uuid not null references quiniela_jugadores(id) on delete cascade,
  mercado_id  uuid not null references quiniela_mercados(id) on delete cascade,
  opcion      text not null,                   -- key elegida
  fichas      int  not null,                   -- puntos apostados
  payout      int,                             -- null hasta liquidar; bruto devuelto (0 si falla)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (jugador_id, mercado_id)
);

create index if not exists idx_quiniela_apuestas_mercado on quiniela_apuestas(mercado_id);
create index if not exists idx_quiniela_apuestas_jugador on quiniela_apuestas(jugador_id);

insert into quiniela_config (key, value) values ('bolsa_stake', '5')
on conflict (key) do nothing;

-- ── Seed de las 16 apuestas de dieciseisavos (partidos 73-88) ────────────────
insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Davies marca o asiste?', 'Alphonso Davies · Canadá',
  '[{"key":"si","label":"Sí","mult":2.0},{"key":"no","label":"No","mult":1.4}]'::jsonb, false, null
from quiniela_partidos where numero = 73 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Habrá tarjeta roja?', 'Paraguay, muro defensivo',
  '[{"key":"si","label":"Sí","mult":3.0},{"key":"no","label":"No","mult":1.2}]'::jsonb, false, null
from quiniela_partidos where numero = 74 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Hakimi marca o asiste?', 'Achraf Hakimi · Marruecos',
  '[{"key":"si","label":"Sí","mult":2.4},{"key":"no","label":"No","mult":1.3}]'::jsonb, false, null
from quiniela_partidos where numero = 75 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, 'Goles totales del partido', 'Brasil ataca, Japón aprieta',
  '[{"key":"a","label":"0–2 goles","mult":2.0},{"key":"b","label":"3–4 goles","mult":1.9},{"key":"c","label":"5+ goles","mult":2.8}]'::jsonb, false, null
from quiniela_partidos where numero = 76 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Cuántos goles marca Mbappé?', 'Kylian Mbappé · Francia',
  '[{"key":"a","label":"No marca","mult":2.1},{"key":"b","label":"1 gol","mult":1.8},{"key":"c","label":"2 o más","mult":2.9}]'::jsonb, false, null
from quiniela_partidos where numero = 77 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Haaland marca 2 o más?', 'Erling Haaland · Noruega',
  '[{"key":"si","label":"Sí","mult":3.0},{"key":"no","label":"No","mult":1.2}]'::jsonb, false, null
from quiniela_partidos where numero = 78 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, 'Tarjetas amarillas totales', 'Derbi caliente en el Azteca',
  '[{"key":"a","label":"0–3","mult":2.0},{"key":"b","label":"4–6","mult":1.7},{"key":"c","label":"7+","mult":2.6}]'::jsonb, false, null
from quiniela_partidos where numero = 79 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Marca Harry Kane?', 'Harry Kane · Inglaterra',
  '[{"key":"si","label":"Sí","mult":1.7},{"key":"no","label":"No","mult":1.8}]'::jsonb, false, null
from quiniela_partidos where numero = 80 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Pulisic marca o asiste?', 'Christian Pulisic · EE. UU.',
  '[{"key":"si","label":"Sí","mult":1.8},{"key":"no","label":"No","mult":1.6}]'::jsonb, false, null
from quiniela_partidos where numero = 81 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Habrá un penalti revisado por el VAR?', 'Bélgica vs Senegal',
  '[{"key":"si","label":"Sí","mult":2.1},{"key":"no","label":"No","mult":1.4}]'::jsonb, false, null
from quiniela_partidos where numero = 82 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Habrá prórroga?', 'Duelo parejo de veteranos',
  '[{"key":"si","label":"Sí","mult":2.5},{"key":"no","label":"No","mult":1.3}]'::jsonb, false, null
from quiniela_partidos where numero = 83 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Yamal marca o asiste?', 'Lamine Yamal · España',
  '[{"key":"si","label":"Sí","mult":2.0},{"key":"no","label":"No","mult":1.5}]'::jsonb, false, null
from quiniela_partidos where numero = 84 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Se decide en la tanda de penaltis?', 'Suiza vs Argelia',
  '[{"key":"si","label":"Sí","mult":3.0},{"key":"no","label":"No","mult":1.15}]'::jsonb, true, 'penaltis'
from quiniela_partidos where numero = 85 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Cuántos goles marca Messi?', 'Lionel Messi · Argentina',
  '[{"key":"a","label":"No marca","mult":2.0},{"key":"b","label":"1 gol","mult":1.8},{"key":"c","label":"2 o más","mult":2.9}]'::jsonb, false, null
from quiniela_partidos where numero = 86 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Habrá tarjeta roja?', 'Colombia vs Ghana, puro roce',
  '[{"key":"si","label":"Sí","mult":3.0},{"key":"no","label":"No","mult":1.2}]'::jsonb, false, null
from quiniela_partidos where numero = 87 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Cuántos goles marca Salah?', 'Mohamed Salah · Egipto',
  '[{"key":"a","label":"No marca","mult":1.7},{"key":"b","label":"1 gol","mult":1.9},{"key":"c","label":"2 o más","mult":3.0}]'::jsonb, false, null
from quiniela_partidos where numero = 88 on conflict (partido_id) do nothing;

notify pgrst, 'reload schema';
