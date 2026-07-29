-- Repasos de obra — incidencias geolocalizadas sobre el plano de un proyecto.
-- App interna /team/apps/repasos (todos los roles FP).
--
-- Un proyecto tiene N planos (plantas). Cada repaso pertenece a un plano y guarda
-- su posición como coordenadas NORMALIZADAS (x, y entre 0 y 1) sobre la imagen del
-- plano: así el pin sobrevive a zoom, cambio de dispositivo y sustitución del plano
-- por otro de distinta resolución.
--
-- Visibilidad jerárquica: interno ⊂ constructora ⊂ cliente.
--   interno      → solo el equipo FP
--   constructora → FP + constructora
--   cliente      → FP + constructora + cliente
-- El filtrado por audiencia se hace en servidor: el cliente nunca recibe en el
-- payload los repasos internos.
--
-- Las tablas se leen/escriben solo vía service_role (Server Actions): RLS sin
-- políticas. Las fotos y los planos se suben desde el navegador (authenticated)
-- al bucket público 'repasos', por eso ese bucket sí necesita políticas.

-- ── Proyectos ─────────────────────────────────────────────────────────────────

create table if not exists public.repaso_proyectos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  direccion    text,
  cliente      text,
  constructora text,
  referencia   text,                                    -- código interno del proyecto
  notas        text,
  status       text not null default 'activo',           -- activo | cerrado
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists repaso_proyectos_created_at_idx
  on public.repaso_proyectos (created_at desc);

-- ── Planos (plantas) ──────────────────────────────────────────────────────────

create table if not exists public.repaso_planos (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.repaso_proyectos(id) on delete cascade,
  nombre      text not null default 'Planta general',
  orden       int  not null default 0,
  img_url     text not null,                             -- raster que se pinta en el visor
  pdf_url     text,                                      -- original, si se subió un PDF
  width       int,                                        -- px de la imagen (aspect ratio)
  height      int,
  created_at  timestamptz not null default now()
);

create index if not exists repaso_planos_proyecto_idx
  on public.repaso_planos (proyecto_id, orden);

-- ── Repasos ───────────────────────────────────────────────────────────────────

create table if not exists public.repasos (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references public.repaso_proyectos(id) on delete cascade,
  plano_id      uuid not null references public.repaso_planos(id) on delete cascade,
  codigo        text not null,                            -- R-001, R-002… por proyecto
  x             numeric not null,                         -- 0..1 sobre el ancho del plano
  y             numeric not null,                         -- 0..1 sobre el alto del plano
  oficio        text not null default 'otros',
  descripcion   text,
  estado        text not null default 'detectado',        -- detectado | programado | resuelto
  visibilidad   text not null default 'interno',          -- interno | constructora | cliente
  prioridad     text not null default 'media',            -- alta | media | baja
  fecha_objetivo date,
  responsable   text,
  autor_id      uuid references public.profiles(id),
  autor_nombre  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resuelto_at   timestamptz,
  resuelto_por  text
);

create unique index if not exists repasos_proyecto_codigo_uniq
  on public.repasos (proyecto_id, codigo);
create index if not exists repasos_proyecto_idx  on public.repasos (proyecto_id, created_at);
create index if not exists repasos_plano_idx     on public.repasos (plano_id);

-- ── Fotos ─────────────────────────────────────────────────────────────────────

create table if not exists public.repaso_fotos (
  id         uuid primary key default gen_random_uuid(),
  repaso_id  uuid not null references public.repasos(id) on delete cascade,
  url        text not null,
  tipo       text not null default 'antes',               -- antes | despues
  orden      int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists repaso_fotos_repaso_idx
  on public.repaso_fotos (repaso_id, tipo, orden);

-- ── Eventos (trazabilidad) ────────────────────────────────────────────────────
-- Log append-only de todo lo que le pasa a un repaso. Nunca se edita ni se borra
-- (salvo en cascada al borrar el repaso).

create table if not exists public.repaso_eventos (
  id           uuid primary key default gen_random_uuid(),
  repaso_id    uuid not null references public.repasos(id) on delete cascade,
  tipo         text not null,                             -- creado | estado | visibilidad | foto | movido | editado | comentario
  detalle      text,
  autor_id     uuid references public.profiles(id),
  autor_nombre text,
  created_at   timestamptz not null default now()
);

create index if not exists repaso_eventos_repaso_idx
  on public.repaso_eventos (repaso_id, created_at);

-- ── Tokens de acceso externo ──────────────────────────────────────────────────
-- Un link por audiencia y proyecto. Solo lectura, revocable, con trazas de acceso.

create table if not exists public.repaso_tokens (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references public.repaso_proyectos(id) on delete cascade,
  audiencia    text not null,                             -- constructora | cliente
  token        text unique not null,
  label        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  last_access  timestamptz,
  access_count int not null default 0
);

create index if not exists repaso_tokens_proyecto_idx
  on public.repaso_tokens (proyecto_id, created_at desc);

-- ── RLS: sin políticas (solo service_role) ────────────────────────────────────

alter table public.repaso_proyectos enable row level security;
alter table public.repaso_planos    enable row level security;
alter table public.repasos          enable row level security;
alter table public.repaso_fotos     enable row level security;
alter table public.repaso_eventos   enable row level security;
alter table public.repaso_tokens    enable row level security;

-- ── Storage: bucket público para planos y fotos ───────────────────────────────

insert into storage.buckets (id, name, public)
values ('repasos', 'repasos', true)
on conflict (id) do update set public = true;

drop policy if exists "repasos_insert" on storage.objects;
create policy "repasos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'repasos');

drop policy if exists "repasos_select" on storage.objects;
create policy "repasos_select" on storage.objects
  for select to public
  using (bucket_id = 'repasos');

drop policy if exists "repasos_delete" on storage.objects;
create policy "repasos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'repasos');

notify pgrst, 'reload schema';
