-- Web pública — equipo del estudio (página Estudio).
-- Grid de integrantes con foto principal + CV corto (hover) y página propia con
-- CV extenso + segunda foto. Bilingüe. Fotos en el bucket público `web-publica`.

create table if not exists public.web_equipo (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  slug              text not null unique,
  rol_es            text,
  rol_en            text,
  -- Foto del grid (principal) y foto de la página de detalle (segunda).
  foto_url          text,
  foto_detalle_url  text,
  -- CV corto: se muestra al hacer hover en el grid.
  cv_corto_es       text,
  cv_corto_en       text,
  -- CV extenso: página propia del integrante.
  cv_largo_es       text,
  cv_largo_en       text,
  orden             int not null default 0,
  activo            boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists web_equipo_orden_idx on public.web_equipo (orden asc, created_at asc);

-- Solo service_role (Server Actions). RLS sin políticas.
alter table public.web_equipo enable row level security;

notify pgrst, 'reload schema';
