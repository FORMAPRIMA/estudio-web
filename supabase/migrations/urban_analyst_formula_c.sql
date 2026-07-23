-- Urban Analyst — Coeficiente C de la fórmula volumétrica E = S × Z × C (NZ 1)
--
-- En NZ 1 (Protección Patrimonio Histórico) la edificabilidad se calcula como
-- E = S × Z × C, donde S = parcela edificable, Z = nº de plantas según el
-- plano de Condiciones de la Edificación (COEF_Z, que la app ya descarga por
-- banda) y C = coeficiente fijo por grado (art. 8.1.3 NNUU PGOUM 97).
--
-- Hasta ahora C vivía como texto libre en regimen_usos.texto y el motor no lo
-- aplicaba. Esta migración lo estructura en su propia columna y mueve la
-- fórmula del régimen de usos (que no es su sitio) a `condiciones`.
-- Idempotente; las limpiezas de texto solo tocan filas con el texto seed
-- exacto (nunca pisan ediciones manuales).

alter table public.urban_normas_zonales
  add column if not exists formula_c numeric;  -- C de E = S × Z × C (NZ 1: 0,875 / 0,66 / 0,90 / 0,75 / 0,66)

comment on column public.urban_normas_zonales.formula_c is
  'Coeficiente C de la fórmula volumétrica E = S × Z × C (art. 8.1.3 NNUU PGOUM 97). Solo NZ con edificabilidad por fórmula (NZ 1). Z sale del plano de Condiciones de la Edificación (COEF_Z).';

update public.urban_normas_zonales set formula_c = 0.875 where codigo = '1.1' and formula_c is null;
update public.urban_normas_zonales set formula_c = 0.66  where codigo = '1.2' and formula_c is null;
update public.urban_normas_zonales set formula_c = 0.90  where codigo = '1.3' and formula_c is null;
update public.urban_normas_zonales set formula_c = 0.75  where codigo = '1.4' and formula_c is null;
update public.urban_normas_zonales set formula_c = 0.66  where codigo = '1.6' and formula_c is null;
-- 1.5 (edificios singulares): edificabilidad = la existente, sin fórmula.

-- ── Limpieza: la fórmula sale de "régimen de usos" y pasa a "condiciones" ────

update public.urban_normas_zonales set
  regimen_usos = '{"texto": "Niveles de usos a/b/c/d según arts. 8.1.29-8.1.32."}'::jsonb,
  condiciones = coalesce(condiciones, 'E = S × Z × C; S = superficie entre alineación y fondo máximo del plano CE; Z fijado en dicho plano. Alineación oficial obligatoria; alturas caso a caso por CIPHAN; PB ≥ 3,60 m.')
where codigo = '1.1'
  and regimen_usos->>'texto' = 'Niveles de usos a/b/c/d según arts. 8.1.29-8.1.32. Edificabilidad E = S × Z × C con C = 0,875; S = superficie entre alineación y fondo máximo del Plano de Condiciones de la Edificación; Z fijado en dicho plano. Alineación oficial obligatoria; alturas caso a caso por CIPHAN; PB ≥ 3,60 m.';

update public.urban_normas_zonales set
  regimen_usos = null,
  condiciones = coalesce(condiciones, 'E = S × Z × C; S = parcela edificable (art. 6.2.9); Z según plano CE. Alineación oficial obligatoria; alturas por CIPHAN.')
where codigo = '1.2'
  and regimen_usos->>'texto' = 'E = S × Z × C con C = 0,66; S = parcela edificable (art. 6.2.9); Z según plano CE. Alineación oficial obligatoria; alturas por CIPHAN.';

update public.urban_normas_zonales set
  regimen_usos = null,
  condiciones = coalesce(condiciones, 'E = S × Z × C; S = parcela entre alineación y fondo máximo del plano; alturas por CIPHAN.')
where codigo = '1.3'
  and regimen_usos->>'texto' = 'E = S × Z × C con C = 0,90; S = parcela entre alineación y fondo máximo del plano; alturas por CIPHAN.';

update public.urban_normas_zonales set
  regimen_usos = null,
  condiciones = coalesce(condiciones, 'E = S × Z × C; sin fondo máximo pero con espacio libre obligatorio al fondo (art. 8.1.12); alturas por CIPHAN.')
where codigo = '1.4'
  and regimen_usos->>'texto' = 'E = S × Z × C con C = 0,75; sin fondo máximo pero con espacio libre obligatorio al fondo (art. 8.1.12); alturas por CIPHAN.';

update public.urban_normas_zonales set
  regimen_usos = null,
  condiciones = coalesce(condiciones, 'E = S × Z × C; Z (nº plantas) según ancho de calle: <7 m → 3; 7-<12 → 4; 12-<18 → 5; 18-<24 → 6; ≥24 → 7. Fondo máximo 25 m; áticos/torreones computables sobre cornisa (art. 8.1.15.3).')
where codigo = '1.6'
  and regimen_usos->>'texto' = 'E = S × Z × C con C = 0,66 y Z (nº plantas) según ancho de calle: <7 m → 3; 7-<12 → 4; 12-<18 → 5; 18-<24 → 6; ≥24 → 7. Fondo máximo 25 m; áticos/torreones computables sobre cornisa (art. 8.1.15.3).';

notify pgrst, 'reload schema';
