-- ── La Porra del Mundial 2026 — carga de 16avos (Round of 32) ────────────────
-- Rellena los equipos de los partidos 73-88 una vez resuelta la fase de grupos
-- y abre la ventana de pick de campeón post-grupos (40 pts).
-- Cruces confirmados con Wikipedia + Sky Sports + ronda de prensa (CBS/Yahoo/SI).
-- Aplicado vía script el 2026-06-28; se deja aquí para trazabilidad. Idempotente.

update quiniela_partidos p set
  equipo_local_id     = (select id from quiniela_equipos where codigo = c.local),
  equipo_visitante_id = (select id from quiniela_equipos where codigo = c.visit)
from (values
  (73, 'RSA', 'CAN'),
  (74, 'GER', 'PAR'),
  (75, 'NED', 'MAR'),
  (76, 'BRA', 'JPN'),
  (77, 'FRA', 'SWE'),
  (78, 'CIV', 'NOR'),
  (79, 'MEX', 'ECU'),
  (80, 'ENG', 'COD'),
  (81, 'USA', 'BIH'),
  (82, 'BEL', 'SEN'),
  (83, 'POR', 'CRO'),
  (84, 'ESP', 'AUT'),
  (85, 'SUI', 'ALG'),
  (86, 'ARG', 'CPV'),
  (87, 'COL', 'GHA'),
  (88, 'AUS', 'EGY')
) as c(numero, local, visit)
where p.numero = c.numero;

-- Abrir ventana de campeón post-grupos (elegibles = los 32 supervivientes)
insert into quiniela_config (key, value) values ('ventana_activa', 'grupos')
on conflict (key) do update set value = excluded.value;
