-- Web pública — FP Tools (escaparate comercial de capacidades del estudio:
-- Visual Lab, presupuestos paramétricos, portal de cliente, Urban Analyst…).
-- Bilingüe. Imágenes en el bucket público `web-publica`.

create table if not exists public.web_fp_tools (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  tagline_es     text,
  tagline_en     text,
  descripcion_es text,
  descripcion_en text,
  imagen_url     text,
  cta_label_es   text,
  cta_label_en   text,
  cta_url        text,
  orden          int not null default 0,
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists web_fp_tools_orden_idx on public.web_fp_tools (orden asc, created_at asc);
alter table public.web_fp_tools enable row level security;

notify pgrst, 'reload schema';
