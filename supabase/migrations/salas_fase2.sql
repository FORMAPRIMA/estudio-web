-- Salas de dossier · fase 2: panel en salas.formaprima.es.
-- Personas del panel con código personal (8 cifras), salas asignadas y
-- registro de quién hace qué. Solo vía service_role (RLS sin políticas).
-- Nada de esto toca profiles ni ninguna tabla del área interna.

create table if not exists public.sala_miembros (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  email          text,
  empresa        text,                                  -- p. ej. el fondo/inversor
  rol            text not null default 'comercial' check (rol in ('propietario', 'comercial')),
  codigo_hmac    text not null unique,                  -- HMAC del código; el código no se guarda
  activo         boolean not null default true,
  creado_por     uuid references public.sala_miembros(id) on delete set null,
  ultimo_acceso  timestamptz,
  created_at     timestamptz not null default now()
);

-- Salas a las que tiene acceso cada comercial (los propietarios ven todas).
create table if not exists public.sala_miembro_salas (
  miembro_id  uuid not null references public.sala_miembros(id) on delete cascade,
  sala_id     uuid not null references public.sala_salas(id) on delete cascade,
  primary key (miembro_id, sala_id)
);

create table if not exists public.sala_auditoria (
  id          bigint generated always as identity primary key,
  miembro_id  uuid references public.sala_miembros(id) on delete set null,
  sala_id     uuid references public.sala_salas(id) on delete set null,
  accion      text not null,
  detalle     text,
  at          timestamptz not null default now()
);
create index if not exists sala_auditoria_at_idx on public.sala_auditoria (at desc);

do $$ begin
  alter table public.sala_leads
    add constraint sala_leads_creado_por_fkey foreign key (creado_por) references public.sala_miembros(id) on delete set null;
exception when duplicate_object then null; end $$;

alter table public.sala_miembros      enable row level security;
alter table public.sala_miembro_salas enable row level security;
alter table public.sala_auditoria     enable row level security;

notify pgrst, 'reload schema';
