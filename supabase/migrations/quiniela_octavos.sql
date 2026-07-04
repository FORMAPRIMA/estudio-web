-- ── La Porra del Mundial 2026 — carga de octavos (Round of 16) ───────────────
-- Rellena los equipos de los partidos 89-96 una vez resueltos los dieciseisavos,
-- siembra las 8 apuestas de La Bolsa y abre la ventana de pick de campeón/pichichi
-- post-dieciseisavos (28 pts campeón · 7 pts pichichi; elegibles = los 16 de octavos).
-- Ganadores de dieciseisavos: CAN, PAR, MAR, BRA, FRA, NOR, MEX, ENG, USA, BEL,
-- POR, ESP, SUI, ARG, COL, EGY (equipo_que_pasa_id de los partidos 73-88).
-- Aplicado vía script el 2026-07-04; se deja aquí para trazabilidad. Idempotente.

update quiniela_partidos p set
  equipo_local_id     = (select id from quiniela_equipos where codigo = c.local),
  equipo_visitante_id = (select id from quiniela_equipos where codigo = c.visit)
from (values
  (89, 'PAR', 'FRA'),
  (90, 'CAN', 'MAR'),
  (91, 'BRA', 'NOR'),
  (92, 'MEX', 'ENG'),
  (93, 'POR', 'ESP'),
  (94, 'USA', 'BEL'),
  (95, 'ARG', 'EGY'),
  (96, 'SUI', 'COL')
) as c(numero, local, visit)
where p.numero = c.numero;

-- ── Las 8 apuestas de octavos (partidos 89-96) ───────────────────────────────
insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Cuántos goles marca Mbappé?', 'Kylian Mbappé · Francia',
  '[{"key":"a","label":"No marca","mult":2.2},{"key":"b","label":"1 gol","mult":1.7},{"key":"c","label":"2 o más","mult":3.0}]'::jsonb, false, null
from quiniela_partidos where numero = 89 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Habrá prórroga?', 'Canadá y Marruecos, a cara de perro',
  '[{"key":"si","label":"Sí","mult":2.6},{"key":"no","label":"No","mult":1.3}]'::jsonb, false, null
from quiniela_partidos where numero = 90 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Vinícius marca o asiste?', 'Vinícius Jr · Brasil',
  '[{"key":"si","label":"Sí","mult":1.6},{"key":"no","label":"No","mult":2.0}]'::jsonb, false, null
from quiniela_partidos where numero = 91 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, 'Tarjetas amarillas totales', 'Ambiente hostil en el Azteca',
  '[{"key":"a","label":"0–3","mult":2.0},{"key":"b","label":"4–6","mult":1.7},{"key":"c","label":"7+","mult":2.6}]'::jsonb, false, null
from quiniela_partidos where numero = 92 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Marca Cristiano Ronaldo?', 'Cristiano Ronaldo · Portugal',
  '[{"key":"si","label":"Sí","mult":2.1},{"key":"no","label":"No","mult":1.6}]'::jsonb, false, null
from quiniela_partidos where numero = 93 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿De Bruyne marca o asiste?', 'Kevin De Bruyne · Bélgica',
  '[{"key":"si","label":"Sí","mult":1.8},{"key":"no","label":"No","mult":1.7}]'::jsonb, false, null
from quiniela_partidos where numero = 94 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Cuántos goles marca Messi?', 'Lionel Messi · Argentina',
  '[{"key":"a","label":"No marca","mult":2.0},{"key":"b","label":"1 gol","mult":1.8},{"key":"c","label":"2 o más","mult":2.9}]'::jsonb, false, null
from quiniela_partidos where numero = 95 on conflict (partido_id) do nothing;

insert into quiniela_mercados (partido_id, pregunta, subtitulo, opciones, auto, regla)
select id, '¿Se decide en la tanda de penaltis?', 'Suiza vs Colombia',
  '[{"key":"si","label":"Sí","mult":3.0},{"key":"no","label":"No","mult":1.15}]'::jsonb, true, 'penaltis'
from quiniela_partidos where numero = 96 on conflict (partido_id) do nothing;

-- Abrir ventana de campeón/pichichi post-dieciseisavos (elegibles = los 16 de octavos)
insert into quiniela_config (key, value) values ('ventana_activa', 'dieciseisavos')
on conflict (key) do update set value = excluded.value;

notify pgrst, 'reload schema';
