-- Check "revisado" por partida en Control de obra.
-- Guarda la fecha en que se marcó; caduca a los 14 días (se calcula en cliente, no hace falta cron).
alter table public.obra_control_partidas
  add column if not exists revisado_at timestamptz;
