-- Web pública — foto principal vertical para móvil.
-- Override de hero_url cuando el teaser se ve desde un dispositivo móvil.

alter table public.web_proyectos
  add column if not exists hero_mobile_url text;

notify pgrst, 'reload schema';
