-- Web pública — Real Estate. Propiedades en venta (modelo de referral: FP asesora,
-- comisión del vendedor). Bilingüe. Imágenes en el bucket público `web-publica`.

create table if not exists public.web_propiedades (
  id             uuid primary key default gen_random_uuid(),
  slug           text,
  nombre         text not null,
  ubicacion      text,
  precio         text,               -- texto libre: "1.850.000 €", "Consultar"…
  descripcion_es text,
  descripcion_en text,
  hero_url       text,
  galeria        text[] not null default '{}',
  disponible     boolean not null default true,
  orden          int not null default 0,
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists web_propiedades_orden_idx on public.web_propiedades (orden asc, created_at asc);
create unique index if not exists web_propiedades_slug_key on public.web_propiedades (slug) where slug is not null;
alter table public.web_propiedades enable row level security;

notify pgrst, 'reload schema';
