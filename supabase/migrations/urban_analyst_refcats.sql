-- Urban Analyst — soporte de activos con varias referencias catastrales
-- (edificios que ocupan más de una parcela: esquinas, manzanas completas...).
-- refcat sigue siendo la referencia principal; refcats guarda las adicionales.

alter table public.urban_assets
  add column if not exists refcats text[] not null default '{}';

notify pgrst, 'reload schema';
