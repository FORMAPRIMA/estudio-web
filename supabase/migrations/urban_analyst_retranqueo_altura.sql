-- Urban Analyst — retranqueos que crecen con la altura (volumen escalonado).
-- Factor por tipo de lindero: retranqueo(h) ≥ max(retranqueo_base, factor · h).
-- NULL = el retranqueo no varía con la altura (comportamiento clásico). Los
-- valores por defecto por norma zonal pueden rellenarse (verificados) más
-- adelante; el flujo del 3D permite además fijar la regla por arista a mano.

alter table public.urban_normas_zonales
  add column if not exists retranqueo_frente_factor_h numeric,
  add column if not exists retranqueo_lateral_factor_h numeric,
  add column if not exists retranqueo_testero_factor_h numeric;

notify pgrst, 'reload schema';
