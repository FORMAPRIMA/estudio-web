-- ── Porra del Mundial: chat con reacciones y replies ─────────────────────────
-- Ejecutar después de quiniela_externos.sql. Idempotente.

create table if not exists quiniela_comentarios (
  id         uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references quiniela_jugadores(id) on delete cascade,
  parent_id  uuid references quiniela_comentarios(id) on delete cascade,
  texto      text not null check (char_length(texto) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists quiniela_reacciones (
  id            uuid primary key default gen_random_uuid(),
  comentario_id uuid not null references quiniela_comentarios(id) on delete cascade,
  jugador_id    uuid not null references quiniela_jugadores(id) on delete cascade,
  emoji         text not null,
  created_at    timestamptz not null default now(),
  unique (comentario_id, jugador_id, emoji)
);

create index if not exists idx_quiniela_comentarios_created on quiniela_comentarios(created_at desc);
create index if not exists idx_quiniela_comentarios_parent  on quiniela_comentarios(parent_id);
create index if not exists idx_quiniela_reacciones_com      on quiniela_reacciones(comentario_id);

-- live_scores: marcadores en vivo que escribe el cron (sin DDL adicional)
insert into quiniela_config (key, value) values ('live_scores', null)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
