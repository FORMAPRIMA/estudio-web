-- Urban Analyst — Matriz completa de parámetros por norma zonal / grado / nivel
-- (feedback urbanista 15/07/2026: el cuadro urbanístico formato licencia necesita
-- edificabilidad, ocupación, plantas, alturas, retranqueos por lindero, alturas
-- de piso/libre y régimen de usos, con la figura más restrictiva resuelta).
--
-- La PK sigue siendo `codigo`, que ahora admite grado y nivel: '8', '8.1', '8.1.a'.
-- El motor busca de más específico a más genérico ('8.1.a' → '8.1' → '8').
-- Los valores nuevos entran como NULL / verificado=false: el equipo los contrasta
-- con las NNUU y marca `verificado` (el motor etiqueta hipótesis mientras tanto).

alter table public.urban_normas_zonales
  add column if not exists ocupacion_pct        numeric,   -- % máx. de parcela ocupable
  add column if not exists plantas_bajo_rasante int,
  add column if not exists altura_cornisa_m     numeric,
  add column if not exists altura_max_m         numeric,   -- altura máxima total (cumbrera/elementos)
  add column if not exists retranqueo_frente_m  numeric,   -- a frente / alineación oficial
  add column if not exists retranqueo_lateral_m numeric,   -- a linderos laterales
  add column if not exists retranqueo_testero_m numeric,   -- a lindero testero
  add column if not exists altura_piso_m        numeric,
  add column if not exists altura_libre_min_m   numeric,
  add column if not exists parcela_minima_m2    numeric,
  add column if not exists frente_minimo_m      numeric,
  add column if not exists regimen_usos         jsonb,     -- {cualificado, compatibles, autorizables, prohibidos, texto}
  add column if not exists fuente_articulo      text;      -- ej. 'arts. 8.8.5-8.8.9 NNUU PGOUM 97'

-- ── Seed de la matriz por grado/nivel ─────────────────────────────────────────
-- Valores leídos del texto íntegro del Compendio de las NNUU del PGOUM-97,
-- edición oficial del Ayto. de Madrid de 05/06/2023 (Título 8). El compendio es
-- informativo (la versión legal es la del BOCM), por eso TODO entra con
-- verificado=false: el equipo lo contrasta y marca verificado en la app.
--
-- ⚠ NZ 8 grado 1º: el art. 8.8.9.1.a fija 0,3 m²/m² ("tres metros cuadrados por
-- cada diez"); el 0,5 corresponde al grado 2º (art. 8.8.9.1.b). Contrastar antes
-- de verificar. Los niveles a/b/c de NZ 8 solo modulan el régimen de USOS
-- (art. 8.8.16), no los parámetros de edificación.
--
-- ON CONFLICT: si la fila ya existía, solo rellena columnas vacías (coalesce) y
-- NUNCA pisa datos introducidos a mano ni el flag verificado.

insert into public.urban_normas_zonales (
  codigo, nombre, uso_cualificado,
  coef_edificabilidad, ocupacion_pct, altura_max_plantas, plantas_bajo_rasante,
  altura_cornisa_m, altura_max_m,
  retranqueo_frente_m, retranqueo_lateral_m, retranqueo_testero_m,
  altura_piso_m, altura_libre_min_m, parcela_minima_m2, frente_minimo_m,
  regimen_usos, fuente_articulo, notas, verificado, fuente
) values

-- ── NZ 1 · Protección del Patrimonio Histórico (volumétrica: E = S × Z × C) ──
('1.1', 'Protección Patrimonio Histórico — grado 1º (casco con patio de manzana)', 'Residencial (entre medianerías, manzana cerrada)',
 null, 100, null, null, null, null, 0, null, null, 3.0, 2.5, 250, 12,
 '{"texto": "Niveles de usos a/b/c/d según arts. 8.1.29-8.1.32. Edificabilidad E = S × Z × C con C = 0,875; S = superficie entre alineación y fondo máximo del Plano de Condiciones de la Edificación; Z fijado en dicho plano. Alineación oficial obligatoria; alturas caso a caso por CIPHAN; PB ≥ 3,60 m."}'::jsonb,
 'arts. 8.1.1-8.1.3, 8.1.10-8.1.16 NNUU PGOUM 97', 'Z y fondo máximo son por parcela (plano CE), no tabulables.', false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('1.2', 'Protección Patrimonio Histórico — grado 2º (casco sin patio de manzana)', 'Residencial',
 null, 75, null, null, null, null, 0, null, null, 3.0, 2.5, 250, 12,
 '{"texto": "E = S × Z × C con C = 0,66; S = parcela edificable (art. 6.2.9); Z según plano CE. Alineación oficial obligatoria; alturas por CIPHAN."}'::jsonb,
 'arts. 8.1.3, 8.1.10-8.1.16 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('1.3', 'Protección Patrimonio Histórico — grado 3º (manzanas típicas de ensanche)', 'Residencial',
 null, 100, null, null, null, null, null, null, null, 3.0, 2.5, 375, 15,
 '{"texto": "E = S × Z × C con C = 0,90; S = parcela entre alineación y fondo máximo del plano; alturas por CIPHAN."}'::jsonb,
 'arts. 8.1.3, 8.1.10-8.1.16 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('1.4', 'Protección Patrimonio Histórico — grado 4º (manzanas atípicas de ensanche)', 'Residencial',
 null, 75, null, null, null, null, null, null, null, 3.0, 2.5, 375, 15,
 '{"texto": "E = S × Z × C con C = 0,75; sin fondo máximo pero con espacio libre obligatorio al fondo (art. 8.1.12); alturas por CIPHAN."}'::jsonb,
 'arts. 8.1.3, 8.1.10-8.1.16 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('1.5', 'Protección Patrimonio Histórico — grado 5º (edificios singulares)', 'Residencial (dotacional según Título 7)',
 null, null, null, null, null, null, null, null, null, 3.0, 2.5, 375, 15,
 '{"texto": "Edificabilidad y ocupación = las existentes (cómputo arts. 6.5.3-6.5.4); en sustitución sin reconstrucción obligada: Estudio de Detalle, ocupación máx. 2/3 de parcela; posición = la inicialmente existente."}'::jsonb,
 'arts. 8.1.10.e, 8.1.11.3, 8.1.13.4 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('1.6', 'Protección Patrimonio Histórico — grado 6º (zonas exteriores del centro)', 'Residencial',
 null, 75, null, null, null, null, null, null, null, 3.0, 2.5, 375, 15,
 '{"texto": "E = S × Z × C con C = 0,66 y Z (nº plantas) según ancho de calle: <7 m → 3; 7-<12 → 4; 12-<18 → 5; 18-<24 → 6; ≥24 → 7. Fondo máximo 25 m; áticos/torreones computables sobre cornisa (art. 8.1.15.3)."}'::jsonb,
 'arts. 8.1.3, 8.1.10.f, 8.1.13-8.1.15 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),

-- ── NZ 3 · Volumetría específica ──────────────────────────────────────────────
('3.1', 'Volumetría específica — grado 1º', 'El derivado de las ordenaciones antecedentes (PG 1985) o el implantado con licencia',
 null, null, null, null, null, null, null, null, null, null, 2.5, null, null,
 '{"texto": "Proceso urbanístico concluido: se consolida edificabilidad y volumetría existentes (no cabe trasladar sobre rasante superficies bajo rasante — Acuerdo CSPG nº 272). Capítulo redactado por MPG 00/335 (BOCM 19/05/2016)."}'::jsonb,
 'arts. 8.3.1-8.3.5 NNUU PGOUM 97 (red. MPG 00/335)', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('3.2', 'Volumetría específica — grado 2º', 'El de las ordenaciones específicas del PG 1985 asumidas por el PG 1997',
 null, null, null, null, null, null, null, null, null, null, 2.5, null, null,
 '{"texto": "Regido por las ordenaciones antecedentes asumidas; obra nueva conforme a dichas ordenaciones; parcelación según planeamiento antecedente."}'::jsonb,
 'arts. 8.3.2-8.3.4, 8.3.10-8.3.14 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),

-- ── NZ 5 · Bloques abiertos (por coeficiente) ─────────────────────────────────
('5.1', 'Bloques abiertos — grado 1º', 'Residencial (edificación aislada)',
 2.0, 50, 14, null, null, 51, null, 5, 5, 2.85, 2.5, 1000, 10,
 '{"texto": "Posición: separación H/2 (coronación) al eje de calle o espacio libre público; a linderos H/2 con mínimo absoluto 5 m; entre edificios de la misma parcela ≥ mayor H, mín. 6 m. Ocupación 50% sobre rasante, 100% bajo. Parcela mínima solo para nuevas parcelaciones. Compatibles: industrial en inferior+baja; oficinas y hospedaje en cualquier situación; mediano comercio hasta 1ª; dotacional hasta 1ª. Alternativo: oficinas en edificio exclusivo fuera de M-30; hospedaje y dotacional en edificio exclusivo. Autorizable: industrial; oficinas en edificio exclusivo dentro de M-30; comercio/recreativo/otros en edificio exclusivo."}'::jsonb,
 'arts. 8.5.4-8.5.11, 8.5.15-8.5.16 NNUU PGOUM 97', 'PB ≥ 3,10 m. 14 plantas / 51 m coronación (+ático computable).', false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('5.2', 'Bloques abiertos — grado 2º', 'Residencial',
 1.6, 50, 8, null, null, 30, null, 5, 5, 2.85, 2.5, 500, 10,
 '{"texto": "Idéntico régimen que 5.1 (posición H/2). 8 plantas / 30 m coronación (+ático computable). Nueva parcelación: 500 m², frente 10 m."}'::jsonb,
 'arts. 8.5.5-8.5.11, 8.5.15-8.5.16 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('5.3', 'Bloques abiertos — grado 3º', 'Residencial',
 1.4, 50, 4, null, null, 15, null, 5, 5, 2.85, 2.5, 500, 10,
 '{"texto": "Idéntico régimen que 5.1. 4 plantas / 15 m coronación (+ático computable)."}'::jsonb,
 'arts. 8.5.5-8.5.11, 8.5.15-8.5.16 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),

-- ── NZ 7 · Baja densidad (por coeficiente) ────────────────────────────────────
('7.1', 'Baja densidad — grado 1º (Ciudad Lineal / Arturo Soria)', 'Residencial (edificación aislada)',
 0.8, 35, 4, null, 14.5, null, 4, 4, 4, 2.85, 2.5, 400, 20,
 '{"texto": "Retranqueo 4 m (5 m a c/ Arturo Soria); a todos los linderos 4 m (adosable a un lindero, art. 6.3.13). Ocupación 35% sobre rasante; bajo rasante 60% (100% enteramente subterránea hasta 1.600 m²). +0,4 m²/m² en franja de 20 m en PB para terciario/industrial en General Aranaz, Mesena, Asura y Agastia. Nivel a: oficinas/pequeño comercio/recreativo en inferior+baja; alternativo hospedaje y dotacional en edificio exclusivo. Nivel b: además terciario alternativo en edificio exclusivo con edif. máx. 1,2 m²/m²."}'::jsonb,
 'arts. 8.7.4-8.7.12, 8.7.17-8.7.19 NNUU PGOUM 97', 'Niveles a/b solo modulan usos.', false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('7.2', 'Baja densidad — grado 2º', 'Residencial (nivel e especial: terciario oficinas/hospedaje)',
 0.5, 30, 3, null, 10.5, 12.5, 10, 7, 7, 2.85, 2.5, 2500, 10,
 '{"texto": "Retranqueo >10 m; linderos ≥7 m. Ocupación 30% (conjunto sobre+bajo rasante). 3 plantas / 10,50 m + planta del 10% con coronación ≤12,50 m. Nº máx. viviendas = 6 × (parcela/2.500). Complementario terciario+dotacional en PB ≤15%; alternativo hospedaje (manzana completa, retranqueos ≥15 m) y dotacional en edificio exclusivo. Nivel e (art. 8.7.20): terciario oficinas/hospedaje cualificado, edif. máx. 1 m²/m², residencial prohibido."}'::jsonb,
 'arts. 8.7.4-8.7.12, 8.7.18-8.7.20 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('7.3', 'Baja densidad — grado 3º', 'Residencial',
 0.7, 40, 3, null, 10.5, 12.5, 10, 7, 7, 2.85, 2.5, 2500, 10,
 '{"texto": "Como grado 2º pero ocupación 40% y nº máx. viviendas = 12 × (parcela/2.500). Sin niveles de uso."}'::jsonb,
 'arts. 8.7.4-8.7.12, 8.7.17-8.7.19 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),

-- ── NZ 8 · Vivienda unifamiliar (por coeficiente; 6 grados, niveles = usos) ──
('8.1', 'Vivienda unifamiliar — grado 1º', 'Residencial, vivienda unifamiliar',
 0.3, 20, 3, 1, 10.5, 12.5, 10, 7, 4, 2.8, 2.5, 2500, 10,
 '{"texto": "Retranqueo a alineación >10 m (no ocupable sobre rasante); laterales ≥7 m; testero 2H/3 mín. 4 m. Ocupación 20% (conjunto sobre+bajo rasante); 1 planta bajo rasante para el uso cualificado. 3 plantas / cornisa 10,50 m + planta del 10% con coronación ≤12,50 m. Círculo inscrito Ø30 m."}'::jsonb,
 'arts. 8.8.1, 8.8.4-8.8.11 NNUU PGOUM 97',
 '⚠ CONTRASTAR: el art. 8.8.9.1.a fija 0,3 m²/m² para el grado 1º; el criterio de equipo apuntaba 0,5 (que el texto asigna al grado 2º). Verificar contra NNUU antes de marcar verificado.',
 false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.1.a', 'Vivienda unifamiliar — grado 1º nivel a', 'Residencial, vivienda unifamiliar',
 0.3, 20, 3, 1, 10.5, 12.5, 10, 7, 4, 2.8, 2.5, 2500, 10,
 '{"texto": "Edificación como 8.1 (los niveles solo modulan usos, art. 8.8.16). Usos: asociado (cap. 7.2); alternativo hospedaje en edificio exclusivo (manzana completa con retranqueos ≥15 m, o parcela ≥5.000 m² a sistema general viario) y dotacional en edificio exclusivo; autorizable hospedaje y otros servicios terciarios en edificio exclusivo."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.16-8.8.18 NNUU PGOUM 97',
 '⚠ CONTRASTAR coeficiente 0,3 vs 0,5 (ver nota en 8.1).', false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.1.b', 'Vivienda unifamiliar — grado 1º nivel b', 'Residencial, vivienda unifamiliar',
 0.3, 20, 3, 1, 10.5, 12.5, 10, 7, 4, 2.8, 2.5, 2500, 10,
 '{"texto": "Edificación y usos idénticos al nivel a (los arts. 8.8.17.1 y 8.8.18.1 regulan conjuntamente los niveles a y b del grado 1º)."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.16-8.8.18 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.1.c', 'Vivienda unifamiliar — grado 1º nivel c', 'Residencial, vivienda unifamiliar',
 0.3, 20, 3, 1, 10.5, 12.5, 10, 7, 4, 2.8, 2.5, 2500, 10,
 '{"texto": "Edificación como 8.1. Usos nivel c: alternativo con condiciones propias — edif. máx. 1 m²/m², ocupación sobre rasante ≤40% y bajo ≤70% para oficinas/hospedaje en edificio exclusivo, y dotacional en edificio exclusivo (art. 8.8.17.2)."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.17.2 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.2', 'Vivienda unifamiliar — grado 2º', 'Residencial, vivienda unifamiliar',
 0.5, 30, 3, 1, 10.5, 12.5, 7, 5, 4, 2.8, 2.5, 1000, 10,
 '{"texto": "Coef. 0,5 m²/m²; ocupación 30% (sobre+bajo rasante, Acuerdo CSPG nº 247); retranqueo >7 m; laterales ≥5 m; testero 2H/3 mín. 4 m; 3 plantas / 10,50 m (+10% ≤12,50). Círculo Ø20 m. En nivel a no cabe adosamiento ni pareada salvo parcelas anteriores al PG (Acuerdo CSPG nº 328); parcelas registrales anteriores al PG: posición del grado 3º."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.17.3, 8.8.18.2 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.2.a', 'Vivienda unifamiliar — grado 2º nivel a', 'Residencial, vivienda unifamiliar',
 0.5, 30, 3, 1, 10.5, 12.5, 7, 5, 4, 2.8, 2.5, 1000, 10,
 '{"texto": "Edificación como 8.2. Usos niveles a-b: asociado; alternativo hospedaje (manzana completa, retranqueos ≥10 m) y dotacional en edificio exclusivo; autorizable hospedaje, recreativo cat. ii y otros servicios terciarios en edificio exclusivo."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.17.3, 8.8.18.2 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.2.b', 'Vivienda unifamiliar — grado 2º nivel b', 'Residencial, vivienda unifamiliar',
 0.5, 30, 3, 1, 10.5, 12.5, 7, 5, 4, 2.8, 2.5, 1000, 10,
 '{"texto": "Como 8.2.a, más art. 8.8.14: en proyecto unitario y ejecución simultánea sobre parcela ≥1.000 m² se admite unifamiliar PAREADA sobre parcelas resultantes ≥500 m²."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.14 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.2.c', 'Vivienda unifamiliar — grado 2º nivel c', 'Residencial, vivienda unifamiliar',
 0.5, 30, 3, 1, 10.5, 12.5, 7, 5, 4, 2.8, 2.5, 1000, 10,
 '{"texto": "Edificación como 8.2. Usos nivel c: complementario industrial en PB e inferiores ≤30%; alternativo hospedaje y dotacional en edificio exclusivo; autorizable oficinas, hospedaje, comercial (salvo grandes superficies), recreativo cat. ii y otros terciarios en edificio exclusivo."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.17.4, 8.8.18.3 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.3', 'Vivienda unifamiliar — grado 3º', 'Residencial, vivienda unifamiliar (adosable a un lindero; hilera con frente mín. 5 m)',
 0.7, 40, 3, 1, 10.5, 12.5, 4, 3, 4, 2.8, 2.5, 250, 8,
 '{"texto": "Coef. 0,7 m²/m²; ocupación 40% (sobre+bajo); retranqueo >4 m (ocupable con cuerpo de 1 planta ≤3,50 m si parcela <500 m², art. 8.8.7.3); laterales ≥3 m; testero 2H/3 mín. 4 m. Círculo Ø10 m; hilera fondo/frente ≤5:1; fachada continua ≤48 m (ED hasta 64 m). Vivienda colectiva alternativa art. 8.8.15 (nº viviendas ≤ parcela/250)."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.15 NNUU PGOUM 97', 'Grado 3º solo tiene niveles a y c (no existe 8.3.b).', false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.3.a', 'Vivienda unifamiliar — grado 3º nivel a', 'Residencial, vivienda unifamiliar',
 0.7, 40, 3, 1, 10.5, 12.5, 4, 3, 4, 2.8, 2.5, 250, 8,
 '{"texto": "Edificación como 8.3. Usos: asociado; alternativo dotacional en edificio exclusivo; autorizable hospedaje, recreativo y otros servicios terciarios en edificio exclusivo aislado."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.17.5, 8.8.18.4 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.3.c', 'Vivienda unifamiliar — grado 3º nivel c', 'Residencial, vivienda unifamiliar',
 0.7, 40, 3, 1, 10.5, 12.5, 4, 3, 4, 2.8, 2.5, 250, 8,
 '{"texto": "Edificación como 8.3. Usos nivel c: alternativo oficinas y hospedaje en edificio exclusivo y dotacional en edificio exclusivo; autorizable hospedaje, recreativo y otros servicios terciarios en edificio exclusivo aislado."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.17.6, 8.8.18.4 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.4', 'Vivienda unifamiliar — grado 4º', 'Residencial, vivienda unifamiliar (adosable; hilera frente mín. 5 m)',
 1.0, 50, 3, 1, 10.5, 12.5, 4, 3, 4, 2.8, 2.5, 250, 8,
 '{"texto": "Coef. 1 m²/m²; ocupación 50% (sobre+bajo); retranqueo >4 m; laterales ≥3 m; testero 2H/3 mín. 4 m. Círculo Ø8 m. Vivienda colectiva alternativa art. 8.8.15.2. Complementario pequeño comercio en PB e inferior; alternativo dotacional; autorizable hospedaje, comercio pequeño/mediano aislado, oficinas, recreativo cat. ii y otros terciarios en edificio exclusivo (exclusiones territoriales art. 8.8.18.5)."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.15, 8.8.17.7, 8.8.18.5 NNUU PGOUM 97', 'Sin niveles.', false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.5', 'Vivienda unifamiliar — grado 5º', 'Residencial, vivienda unifamiliar (adosable; hilera admitida)',
 0.8, 50, 2, 1, 7.0, null, 5, 3, 4, 2.8, 2.5, 150, 5,
 '{"texto": "Coef. 0,8 m²/m²; ocupación 50% (sobre+bajo); retranqueo >5 m; laterales ≥3 m; testero 2H/3 mín. 4 m; 2 plantas / 7 m cornisa (sin planta adicional del 10%). Círculo Ø5 m. Complementario industrial y terciario pequeño comercio/otros en inferior+baja; alternativo dotacional; autorizable industrial, hospedaje aislado y otros terciarios en edificio exclusivo."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.17.8, 8.8.18.6 NNUU PGOUM 97', 'Sin niveles.', false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('8.6', 'Vivienda unifamiliar — grado 6º', 'Residencial, vivienda unifamiliar',
 0.7, 30, 3, 1, 10.5, 12.5, 4, 3, 4, 2.8, 2.5, 750, 10,
 '{"texto": "Coef.: 0,7 m²/m² hasta 500 m² de parcela; en parcelas >500 m²: 0,7 sobre los primeros 500 + 0,5 sobre el exceso (art. 8.8.9.f). Ocupación 30% (sobre+bajo); retranqueo >4 m; laterales ≥H/2 mín. 3 m; testero 2H/3 mín. 4 m; adosable a un lindero. Círculo Ø20 m. Alternativo dotacional; autorizable hospedaje, otros terciarios y comerciales en edificio exclusivo (salvo grandes superficies)."}'::jsonb,
 'arts. 8.8.4-8.8.11, 8.8.17.9, 8.8.18.7 NNUU PGOUM 97', 'Sin niveles. Coeficiente decreciente por tramos: el motor usa 0,7 (tramo inicial) — ajustar a mano en parcelas >500 m².', false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),

-- ── NZ 9 · Actividades económicas ─────────────────────────────────────────────
('9.1', 'Actividades económicas — grado 1º', 'Industrial (manzana cerrada / entre medianeras)',
 2.4, null, null, null, null, null, 0, 0, 3, 3.0, 2.5, 500, 10,
 '{"texto": "Alturas por ancho de calle (art. 8.9.10.1): <12 m → 3 plantas/11,50 m; 12-<18 → 4/15,00; ≥18 → 5/18,50. Entre medianeras obligatorio en los 12 primeros m de fondo; testero H/3 mín. 3 m; fachada en alineación oficial. Asociado: 1 vivienda ≤150 m²; oficinas ≤50%, pequeño comercio ≤20%. Alternativo (PE 00/311): residencial/dotacional/oficinas/hospedaje en edificio exclusivo con condiciones NZ 4; recreativo/otros/comercial ≤1,6 m²/m². Autorizable: recreativo y otros terciarios ≤1,6 m²/m²."}'::jsonb,
 'arts. 8.9.1, 8.9.4-8.9.12, 8.9.17-8.9.18 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('9.2', 'Actividades económicas — grado 2º', 'Industrial',
 2.4, null, null, null, null, null, 0, 0, 3, 3.0, 2.5, 500, 10,
 '{"texto": "Como 9.1 (misma tabla de alturas y posición). Alternativo (PE 00/311): residencial, dotacional y terciario en todas sus clases (salvo gran superficie) en edificio exclusivo con condiciones NZ 4 y edif. máx. 1,6 m²/m²."}'::jsonb,
 'arts. 8.9.4-8.9.12, 8.9.17-8.9.18 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('9.3', 'Actividades económicas — grado 3º', 'Industrial en coexistencia con oficinas (proporción libre)',
 1.6, null, 7, null, 28, null, null, 3, 3, 3.0, 2.5, 500, 10,
 '{"texto": "Coef. 1,6 m²/m²; 7 plantas / 28 m cornisa (superable por necesidades industriales); linderos ≥3 m (adosable); posición libre respecto a alineación. Alternativo: terciario (salvo gran superficie) y dotacional en edificio exclusivo."}'::jsonb,
 'arts. 8.9.1.3, 8.9.5-8.9.12, 8.9.17.2, 8.9.18.2 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('9.4', 'Actividades económicas — grado 4º', 'Industrial',
 2.4, null, 5, null, 20, null, null, 3, 3, 3.0, 2.5, 500, 10,
 '{"texto": "Coef. 2,4 m²/m². Niveles a/b solo afectan a la POSICIÓN: nivel a → 5 plantas/20 m, linderos ≥3 m, posición libre; nivel b → 7 plantas/28 m, linderos ≥6 m, alineación ≥8 m, parcela 1.000 m²/frente 20 m. Alternativo dotacional y terciario ≤1,6 m²/m² en edificio exclusivo; autorizable gran superficie fuera de Calle 30 ≤1,6 m²/m²."}'::jsonb,
 'arts. 8.9.3, 8.9.5-8.9.12, 8.9.17.3, 8.9.18.3 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('9.4.a', 'Actividades económicas — grado 4º nivel a', 'Industrial',
 2.4, null, 5, null, 20, null, null, 3, 3, 3.0, 2.5, 500, 10,
 '{"texto": "Coef. 2,4 m²/m²; 5 plantas / 20 m (superable por necesidades industriales); linderos ≥3 m (adosable a un lateral); posición libre. Sin residencial asociado en lofts (Acuerdo CSPG nº 249)."}'::jsonb,
 'arts. 8.9.3, 8.9.5-8.9.12, 8.9.17.3, 8.9.18.3 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('9.4.b', 'Actividades económicas — grado 4º nivel b', 'Industrial',
 2.4, null, 7, null, 28, null, 8, 6, 6, 3.0, 2.5, 1000, 20,
 '{"texto": "Coef. 2,4 m²/m²; 7 plantas / 28 m cornisa; linderos ≥6 m; alineación oficial ≥8 m; PB ≥4 m. Parcelación nueva 1.000 m²/20 m. Usos como 9.4.a."}'::jsonb,
 'arts. 8.9.5-8.9.12, 8.9.17.3, 8.9.18.3 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)'),
('9.5', 'Actividades económicas — grado 5º', 'Industrial',
 2.0, null, 5, null, 20, null, 6, 4, 4, 3.0, 2.5, 1000, 20,
 '{"texto": "Coef. 2 m²/m²; 5 plantas / 20 m (superable por necesidades industriales); linderos ≥4 m (adosable a un lateral); alineación ≥6 m; PB ≥4 m. Usos como grado 4º."}'::jsonb,
 'arts. 8.9.5-8.9.12, 8.9.17.3, 8.9.18.3 NNUU PGOUM 97', null, false, 'Compendio NNUU PGOUM 97 ed. 05/06/2023 (madrid.es)')

on conflict (codigo) do update set
  nombre               = public.urban_normas_zonales.nombre,
  uso_cualificado      = coalesce(public.urban_normas_zonales.uso_cualificado,      excluded.uso_cualificado),
  coef_edificabilidad  = coalesce(public.urban_normas_zonales.coef_edificabilidad,  excluded.coef_edificabilidad),
  ocupacion_pct        = coalesce(public.urban_normas_zonales.ocupacion_pct,        excluded.ocupacion_pct),
  altura_max_plantas   = coalesce(public.urban_normas_zonales.altura_max_plantas,   excluded.altura_max_plantas),
  plantas_bajo_rasante = coalesce(public.urban_normas_zonales.plantas_bajo_rasante, excluded.plantas_bajo_rasante),
  altura_cornisa_m     = coalesce(public.urban_normas_zonales.altura_cornisa_m,     excluded.altura_cornisa_m),
  altura_max_m         = coalesce(public.urban_normas_zonales.altura_max_m,         excluded.altura_max_m),
  retranqueo_frente_m  = coalesce(public.urban_normas_zonales.retranqueo_frente_m,  excluded.retranqueo_frente_m),
  retranqueo_lateral_m = coalesce(public.urban_normas_zonales.retranqueo_lateral_m, excluded.retranqueo_lateral_m),
  retranqueo_testero_m = coalesce(public.urban_normas_zonales.retranqueo_testero_m, excluded.retranqueo_testero_m),
  altura_piso_m        = coalesce(public.urban_normas_zonales.altura_piso_m,        excluded.altura_piso_m),
  altura_libre_min_m   = coalesce(public.urban_normas_zonales.altura_libre_min_m,   excluded.altura_libre_min_m),
  parcela_minima_m2    = coalesce(public.urban_normas_zonales.parcela_minima_m2,    excluded.parcela_minima_m2),
  frente_minimo_m      = coalesce(public.urban_normas_zonales.frente_minimo_m,      excluded.frente_minimo_m),
  regimen_usos         = coalesce(public.urban_normas_zonales.regimen_usos,         excluded.regimen_usos),
  fuente_articulo      = coalesce(public.urban_normas_zonales.fuente_articulo,      excluded.fuente_articulo),
  notas                = coalesce(public.urban_normas_zonales.notas,                excluded.notas),
  updated_at           = now();

-- Parámetros transversales sobre las filas base ya existentes (solo si están vacías)
update public.urban_normas_zonales set
  retranqueo_frente_m  = coalesce(retranqueo_frente_m, 0),
  retranqueo_testero_m = coalesce(retranqueo_testero_m, 3),
  altura_piso_m        = coalesce(altura_piso_m, 2.85),
  altura_libre_min_m   = coalesce(altura_libre_min_m, 2.5),
  parcela_minima_m2    = coalesce(parcela_minima_m2, 90),
  frente_minimo_m      = coalesce(frente_minimo_m, 4.5),
  regimen_usos         = coalesce(regimen_usos, '{"texto": "TABLA DE ALTURAS POR ANCHO DE CALLE (art. 8.4.10): <12 m → 3 plantas/11,50 m cornisa; 12-<18 → 4/15,00; 18-<24 → 5/18,50; ≥24 → 6/21,50. Edificabilidad = nº plantas × polígono entre alineación, linderos y paralela a 12 m (fondo máx. 12 m, art. 8.4.7). Fachada en alineación oficial; testero ≥H/3 mín. 3 m; bajo rasante 100%. PB ≥3,10 m. Ático retranqueado ≥3 m. Compatibles: industrial PB/inferior; oficinas/mediano comercio/recreativo hasta 1ª; hospedaje en cualquier situación. Alternativo: hospedaje y dotacional en edificio exclusivo."}'::jsonb),
  fuente_articulo      = coalesce(fuente_articulo, 'arts. 8.4.3-8.4.11, 8.4.15-8.4.16 NNUU PGOUM 97'),
  updated_at           = now()
where codigo = '4';

update public.urban_normas_zonales set
  altura_piso_m      = coalesce(altura_piso_m, 2.8),
  altura_libre_min_m = coalesce(altura_libre_min_m, 2.5),
  regimen_usos       = coalesce(regimen_usos, '{"texto": "Norma remitida: cada APE de Colonia fija edificabilidad (por tipo/modelo del Catálogo), ocupación, retranqueos y alturas (planos del APE, sin áticos). Altura de pisos ≥2,80 m salvo excepción del APE. Unifamiliar exenta de dotación de aparcamiento."}'::jsonb),
  fuente_articulo    = coalesce(fuente_articulo, 'arts. 8.2.12-8.2.19 NNUU PGOUM 97'),
  updated_at         = now()
where codigo = '2';

update public.urban_normas_zonales set
  retranqueo_frente_m  = coalesce(retranqueo_frente_m, 0),
  retranqueo_lateral_m = coalesce(retranqueo_lateral_m, 0),
  retranqueo_testero_m = coalesce(retranqueo_testero_m, 3),
  altura_piso_m        = coalesce(altura_piso_m, 2.85),
  altura_libre_min_m   = coalesce(altura_libre_min_m, 2.5),
  parcela_minima_m2    = coalesce(parcela_minima_m2, 60),
  frente_minimo_m      = coalesce(frente_minimo_m, 4.5),
  regimen_usos         = coalesce(regimen_usos, '{"texto": "NO se regula por coeficiente: edificabilidad = nº plantas del plano del APE × polígono entre alineación, linderos y fondo máximo grafiado (art. 8.6.11). Adosamiento obligatorio a laterales; testero ≥H/3 mín. 3 m; fachada en alineación. Niveles a/b solo de usos (art. 8.6.17). Licencias con informe CIPHAN."}'::jsonb),
  fuente_articulo      = coalesce(fuente_articulo, 'arts. 8.6.1-8.6.17 NNUU PGOUM 97'),
  updated_at           = now()
where codigo = '6';

update public.urban_normas_zonales set
  regimen_usos    = coalesce(regimen_usos, '{"texto": "No fija parámetros de edificación propios: es una capa de régimen de usos superpuesta a la norma zonal de base en los ejes listados (art. 8.10.1). Prevaleciendo sobre la NZ de base: alternativo servicios terciarios en edificio exclusivo; complementario comercial pequeño/mediano hasta 1ª (MPG 00/320)."}'::jsonb),
  fuente_articulo = coalesce(fuente_articulo, 'arts. 8.10.1-8.10.2 NNUU PGOUM 97'),
  updated_at      = now()
where codigo = '10';

update public.urban_normas_zonales set
  regimen_usos    = coalesce(regimen_usos, '{"texto": "Grado 1º (remodelación total, vía PERI): edificabilidad bruta ≤ existente +20% justificado para mantener población. Grado 2º (sustitución puntual, vía ED, promoción pública): superficie ≤ existente +20% (+10% no computable para usos no residenciales)."}'::jsonb),
  fuente_articulo = coalesce(fuente_articulo, 'arts. 8.11.1-8.11.8 NNUU PGOUM 97'),
  updated_at      = now()
where codigo = '11';

notify pgrst, 'reload schema';
