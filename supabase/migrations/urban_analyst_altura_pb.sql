-- Urban Analyst — Altura de piso de planta baja (NZ 1: PB ≥ 3,60 m)
--
-- En NZ 1 (art. 8.1.16 NNUU PGOUM 97) la planta baja tiene altura de piso
-- mínima de 3,60 m, distinta de la altura de piso general (3,00 m). Hasta
-- ahora solo existía como texto; esta migración la estructura para que el
-- cuadro urbanístico (tab + PDF + contexto IA) la muestre como parámetro.
-- Idempotente. Ejecutar en cualquier momento (independiente de formula_c).

alter table public.urban_normas_zonales
  add column if not exists altura_piso_pb_m numeric;  -- altura mínima de piso en planta baja (m)

comment on column public.urban_normas_zonales.altura_piso_pb_m is
  'Altura mínima de piso de la planta baja (m). NZ 1: 3,60 m (art. 8.1.16 NNUU PGOUM 97).';

update public.urban_normas_zonales set altura_piso_pb_m = 3.60
where codigo in ('1.1', '1.2', '1.3', '1.4', '1.6') and altura_piso_pb_m is null;

notify pgrst, 'reload schema';
