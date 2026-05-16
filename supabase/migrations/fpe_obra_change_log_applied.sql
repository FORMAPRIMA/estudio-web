-- ══════════════════════════════════════════════════════════════════════════════
-- FP Execution — change_log: applied_at + cancelled_at
--
-- Cambios "a petición de cliente" (destino_acta='cliente') no se aplican al
-- cerrar la sesión: quedan pendientes de aprobación hasta que el cliente firma
-- el acta vía DocuSign. Este flag permite distinguir cambios ya aplicados de
-- pendientes en el overlay de la tabla.
--
-- Cambios internos (destino_acta='interna') siempre se aplican inmediatamente
-- al cerrar sesión.
--
-- cancelled_at: si la propiedad rechaza el acta (DocuSign voided/declined),
-- los cambios pendientes pasan a cancelled. No se aplican nunca y desaparecen
-- del overlay.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.fpe_obra_change_log
  ADD COLUMN IF NOT EXISTS applied_at   timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Backfill: cambios de sesiones ya cerradas se consideran aplicados al closed_at
-- de la sesión (lógica pre-migration: todos se aplicaban en bloque al cerrar).
UPDATE public.fpe_obra_change_log cl
SET applied_at = s.closed_at
FROM public.fpe_obra_change_sessions s
WHERE cl.session_id = s.id
  AND s.status = 'closed'
  AND cl.applied_at IS NULL;

CREATE INDEX IF NOT EXISTS fpe_obra_change_log_applied_idx
  ON public.fpe_obra_change_log(applied_at);
CREATE INDEX IF NOT EXISTS fpe_obra_change_log_destino_pending_idx
  ON public.fpe_obra_change_log(destino_acta, applied_at)
  WHERE applied_at IS NULL AND cancelled_at IS NULL;

NOTIFY pgrst, 'reload schema';
