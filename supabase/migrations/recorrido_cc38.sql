-- Recorrido del Open House de Claudio Coello 38 (8 oct 2026).
-- Detalles geolocalizados sobre el plano, el recorrido del guía y el directo
-- que siguen los invitados en su móvil. Solo service_role (RLS sin políticas):
-- lo público pasa por el servidor, que nunca entrega las notas del guía.

create table if not exists public.rc_config (
  evento      text primary key,
  plano_url   text,
  plano_w     int,
  plano_h     int,
  updated_at  timestamptz not null default now()
);

create table if not exists public.rc_detalles (
  id            uuid primary key default gen_random_uuid(),
  evento        text not null default 'cc38',
  x             double precision not null check (x >= 0 and x <= 1),
  y             double precision not null check (y >= 0 and y <= 1),
  titulo        text not null default '',
  estancia      text,
  categoria     text,
  texto         text,                 -- público (guía e invitados)
  notas_guia    text,                 -- solo el guía
  destacado     boolean not null default false,
  orden         int not null default 0,
  autor_id      uuid references public.profiles(id),
  autor_nombre  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists rc_detalles_evento_idx on public.rc_detalles (evento, destacado, orden);

create table if not exists public.rc_fotos (
  id          uuid primary key default gen_random_uuid(),
  detalle_id  uuid not null references public.rc_detalles(id) on delete cascade,
  url         text not null,
  w           int,
  h           int,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists rc_fotos_detalle_idx on public.rc_fotos (detalle_id, orden);

-- Una fila por visita en curso (un guía con un turno). Es el "directo".
create table if not exists public.rc_visitas (
  id           uuid primary key default gen_random_uuid(),
  evento       text not null default 'cc38',
  slot         text,                  -- '1730'; null = visita libre
  guia_id      uuid references public.profiles(id),
  guia_nombre  text,
  modo         text not null default 'inicio',  -- inicio | recorrido | pregunta | fin
  paso         int not null default 0,          -- índice en el recorrido
  detalle_id   uuid,                            -- detalle abierto (recorrido o pregunta)
  started_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  ended_at     timestamptz
);
create index if not exists rc_visitas_evento_idx on public.rc_visitas (evento, ended_at, slot);

-- Quién ha abierto su QR y cuándo lo vimos por última vez.
create table if not exists public.rc_presencia (
  token       text primary key,
  primera     timestamptz not null default now(),
  ultima      timestamptz not null default now(),
  visita_id   uuid
);

-- Qué detalles ha mirado cada invitado (pista comercial para después).
create table if not exists public.rc_vistas (
  id          bigint generated always as identity primary key,
  token       text not null,
  detalle_id  uuid not null,
  at          timestamptz not null default now()
);
create index if not exists rc_vistas_token_idx on public.rc_vistas (token, at);

alter table public.rc_config    enable row level security;
alter table public.rc_detalles  enable row level security;
alter table public.rc_fotos     enable row level security;
alter table public.rc_visitas   enable row level security;
alter table public.rc_presencia enable row level security;
alter table public.rc_vistas    enable row level security;

-- Storage: bucket público para las fotos y el plano.
insert into storage.buckets (id, name, public)
values ('recorrido', 'recorrido', true)
on conflict (id) do update set public = true;

drop policy if exists "recorrido_insert" on storage.objects;
create policy "recorrido_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recorrido');

drop policy if exists "recorrido_select" on storage.objects;
create policy "recorrido_select" on storage.objects
  for select to public
  using (bucket_id = 'recorrido');

notify pgrst, 'reload schema';
