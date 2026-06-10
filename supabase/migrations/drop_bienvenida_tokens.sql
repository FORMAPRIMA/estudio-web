-- Retirada del flujo legacy /bienvenida.
--
-- El portal único del cliente (tabla `espacios`, ruta /espacio/[token]) sustituye
-- por completo a `bienvenida_tokens` + /bienvenida/[token]. El código ya se ha
-- eliminado del repositorio.
--
-- ⚠️ EJECUTAR SOLO tras confirmar que no quedan procesos de cliente activos
-- apoyados en un token antiguo. Esta operación es irreversible y elimina el
-- histórico de accesos de esos tokens.
--
-- Para revisar antes de borrar:
--   SELECT count(*)                                  AS total,
--          count(*) FILTER (WHERE used)              AS rellenados,
--          count(*) FILTER (WHERE primer_acceso IS NOT NULL AND NOT used) AS abiertos_sin_rellenar
--   FROM public.bienvenida_tokens;

DROP TABLE IF EXISTS public.bienvenida_tokens;
