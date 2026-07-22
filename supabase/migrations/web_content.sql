-- Web pública — motor de contenido editable (CMS genérico).
-- Guarda cada bloque de texto/media del sitio real de formaprima.es identificado
-- por (pagina, seccion, clave). Bilingüe (ES/EN) y con override opcional de móvil
-- por bloque: mobile_override=false → móvil espeja el contenido desktop.
-- Las colecciones que crecen (proyectos, equipo, propiedades, FP tools) viven en
-- sus propias tablas relacionales; esta tabla es para el copy/media "fijo" de cada
-- página. La imagen/vídeo se guardan como URL pública del bucket `web-publica`.

create table if not exists public.web_content (
  id               uuid primary key default gen_random_uuid(),
  pagina           text not null,            -- home | estudio | proyectos | fp_tools | real_estate | contacto | global
  seccion          text not null,            -- bloque lógico dentro de la página
  clave            text not null,            -- campo concreto dentro del bloque
  tipo             text not null default 'texto',  -- texto | rich | imagen | video
  valor_es         text,
  valor_en         text,
  -- Override de móvil: si mobile_override=false, móvil usa el valor desktop.
  mobile_override  boolean not null default false,
  valor_mobile_es  text,
  valor_mobile_en  text,
  updated_at       timestamptz not null default now(),
  unique (pagina, seccion, clave)
);

create index if not exists web_content_pagina_idx on public.web_content (pagina);

-- Solo service_role (Server Actions con createAdminClient) lee/escribe.
-- Lectura pública del sitio y edición del equipo pasan por Server Actions.
alter table public.web_content enable row level security;

notify pgrst, 'reload schema';
