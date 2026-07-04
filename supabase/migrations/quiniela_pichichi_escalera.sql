-- ── La Porra del Mundial 2026 — Pichichi en escalera ────────────────────────
-- El pichichi pasa de pick único a escalera por ventana (en paralelo al campeón):
-- un pick independiente y acumulable por fase, con puntos decrecientes
-- (apertura 15 · grupos 10 · dieciseisavos 7 · octavos 4 · cuartos 2).
-- Se migra el pichichi único actual a la ventana 'apertura'. Idempotente.

create table if not exists quiniela_picks_pichichi (
  id         uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references quiniela_jugadores(id) on delete cascade,
  ventana    text not null check (ventana in
    ('apertura','grupos','dieciseisavos','octavos','cuartos')),
  nombre     text not null,
  created_at timestamptz not null default now(),
  unique (jugador_id, ventana)
);

-- Migrar el pichichi único existente a la ventana de apertura
insert into quiniela_picks_pichichi (jugador_id, ventana, nombre)
select id, 'apertura', pichichi
from quiniela_jugadores
where pichichi is not null and trim(pichichi) <> ''
on conflict (jugador_id, ventana) do nothing;

notify pgrst, 'reload schema';
