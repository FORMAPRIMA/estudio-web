-- Web pública — amplía web_proyectos para las páginas de proyecto del sitio real.
-- Solo AÑADE columnas (nullable / con default): el teaser /wip, la Home y el
-- carrusel del Espacio siguen funcionando igual con las columnas existentes.

alter table public.web_proyectos
  add column if not exists slug           text,
  add column if not exists descripcion_es text,
  add column if not exists descripcion_en text,
  add column if not exists tipologia_es   text,
  add column if not exists tipologia_en   text,
  add column if not exists superficie     text,
  add column if not exists glb_url        text,   -- maqueta 3D (fase 4b)
  -- Galería rica de la página de proyecto: [{ url, tipo:'foto'|'render'|'plano', caption_es?, caption_en? }]
  add column if not exists media          jsonb not null default '[]'::jsonb;

-- Slug único (solo cuando está definido).
create unique index if not exists web_proyectos_slug_key on public.web_proyectos (slug) where slug is not null;

notify pgrst, 'reload schema';
