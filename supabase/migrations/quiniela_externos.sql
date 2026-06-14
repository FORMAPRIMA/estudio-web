-- ── Porra del Mundial: abrir a jugadores externos (nombre + PIN) ─────────────
-- Reestructura quiniela_participantes → quiniela_jugadores y migra los datos.
-- Ejecutar DESPUÉS de quiniela_todo.sql. Idempotente.

create table if not exists quiniela_jugadores (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  pin_hash   text,                                   -- null = staff FP (entra con su sesión)
  user_id    uuid unique references profiles(id) on delete set null,
  pagado     boolean not null default false,
  pichichi   text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_quiniela_jugadores_nombre
  on quiniela_jugadores (lower(nombre));

-- Migrar participantes existentes (staff que ya se apuntó)
insert into quiniela_jugadores (nombre, user_id, pagado, pichichi, created_at)
select p.nombre, p.user_id, p.pagado, p.pichichi, p.created_at
from quiniela_participantes p
where not exists (select 1 from quiniela_jugadores j where j.user_id = p.user_id)
on conflict do nothing;

-- Predicciones: user_id → jugador_id
alter table quiniela_predicciones
  add column if not exists jugador_id uuid references quiniela_jugadores(id) on delete cascade;

update quiniela_predicciones p
set jugador_id = j.id
from quiniela_jugadores j
where j.user_id = p.user_id and p.jugador_id is null;

delete from quiniela_predicciones where jugador_id is null;
alter table quiniela_predicciones alter column jugador_id set not null;
alter table quiniela_predicciones
  drop constraint if exists quiniela_predicciones_user_id_partido_id_key;
alter table quiniela_predicciones drop column if exists user_id;
do $$ begin
  alter table quiniela_predicciones
    add constraint quiniela_predicciones_jugador_partido_key unique (jugador_id, partido_id);
exception when duplicate_table or duplicate_object then null;
end $$;

-- Picks de campeón: user_id → jugador_id
alter table quiniela_picks_campeon
  add column if not exists jugador_id uuid references quiniela_jugadores(id) on delete cascade;

update quiniela_picks_campeon p
set jugador_id = j.id
from quiniela_jugadores j
where j.user_id = p.user_id and p.jugador_id is null;

delete from quiniela_picks_campeon where jugador_id is null;
alter table quiniela_picks_campeon alter column jugador_id set not null;
alter table quiniela_picks_campeon
  drop constraint if exists quiniela_picks_campeon_user_id_ventana_key;
alter table quiniela_picks_campeon drop column if exists user_id;
do $$ begin
  alter table quiniela_picks_campeon
    add constraint quiniela_picks_campeon_jugador_ventana_key unique (jugador_id, ventana);
exception when duplicate_table or duplicate_object then null;
end $$;

drop table if exists quiniela_participantes;

-- Corrección verificada del fixture: Brasil–Haití (partido 29) es a las 01:00Z, no 00:30Z
update quiniela_partidos set fecha_hora = '2026-06-20T01:00:00Z' where numero = 29;

notify pgrst, 'reload schema';
