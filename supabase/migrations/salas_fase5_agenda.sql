-- Salas · fase 5: agenda viva del dossier de prospección.
-- El cierre de /para/<token> ofrece franjas fijas de quien envió el enlace, en los
-- días laborables 6 a 10 contados desde el día en que se ve el dossier.

-- Franjas de cada persona del panel: {"zona":"Europe/Madrid","franjas":["10:00","12:00"],"minutos":30}
alter table public.sala_miembros add column if not exists agenda jsonb;

create table if not exists public.sala_reuniones (
  id          uuid primary key default gen_random_uuid(),
  sala_id     uuid not null references public.sala_salas(id) on delete cascade,
  lead_id     uuid not null references public.sala_leads(id) on delete cascade,
  miembro_id  uuid references public.sala_miembros(id) on delete set null,   -- con quién es la llamada
  inicio      timestamptz,                                                    -- null = «ninguna me va bien»
  minutos     int not null default 30,
  email       text,                                                           -- dónde mandar la invitación
  nota        text,
  zona_lead   text,                                                           -- zona horaria de quien reserva
  estado      text not null default 'pedida' check (estado in ('pedida', 'propuesta', 'confirmada', 'cancelada')),
  created_at  timestamptz not null default now()
);
create index if not exists sala_reuniones_miembro_inicio_idx on public.sala_reuniones (miembro_id, inicio);
create index if not exists sala_reuniones_lead_idx on public.sala_reuniones (lead_id);
alter table public.sala_reuniones enable row level security;

notify pgrst, 'reload schema';
