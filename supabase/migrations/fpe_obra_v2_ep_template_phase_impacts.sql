-- ══════════════════════════════════════════════════════════════════════════════
-- FP Execution — Obra v2: reflect_to_partner + template promotion + phase impacts
--
-- Añade:
--   1. fpe_obra_change_log: reflect_to_partner, effective_partner_id, add_to_template
--   2. fpe_obra_payment_schedule: kind, source_change_log_id, status ampliado
--   3. fpe_obra_acta_phase_impacts (nueva tabla)
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. fpe_obra_change_log ──────────────────────────────────────────────────
ALTER TABLE public.fpe_obra_change_log
  ADD COLUMN IF NOT EXISTS reflect_to_partner   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS effective_partner_id uuid    REFERENCES public.fpe_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS add_to_template      boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS fpe_obra_change_log_effective_partner_idx
  ON public.fpe_obra_change_log(effective_partner_id)
  WHERE effective_partner_id IS NOT NULL;

-- ── 2. fpe_obra_payment_schedule ────────────────────────────────────────────
ALTER TABLE public.fpe_obra_payment_schedule
  ADD COLUMN IF NOT EXISTS kind                  text NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS source_change_log_id  uuid REFERENCES public.fpe_obra_change_log(id) ON DELETE SET NULL;

-- Drop old kind check (si llegaste a meterla a mano) y reaplicar
ALTER TABLE public.fpe_obra_payment_schedule
  DROP CONSTRAINT IF EXISTS fpe_obra_payment_schedule_kind_check;
ALTER TABLE public.fpe_obra_payment_schedule
  ADD CONSTRAINT fpe_obra_payment_schedule_kind_check
  CHECK (kind IN ('original','modification'));

-- Ampliar CHECK del status para incluir pending_aprobacion y cancelado_cliente.
-- El constraint original se llama fpe_obra_payment_schedule_status_check.
ALTER TABLE public.fpe_obra_payment_schedule
  DROP CONSTRAINT IF EXISTS fpe_obra_payment_schedule_status_check;
ALTER TABLE public.fpe_obra_payment_schedule
  ADD CONSTRAINT fpe_obra_payment_schedule_status_check
  CHECK (status IN ('pendiente','facturado','cobrado','pending_aprobacion','cancelado_cliente'));

CREATE INDEX IF NOT EXISTS fpe_obra_payment_schedule_source_log_idx
  ON public.fpe_obra_payment_schedule(source_change_log_id)
  WHERE source_change_log_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fpe_obra_payment_schedule_partner_kind_idx
  ON public.fpe_obra_payment_schedule(partner_id, kind);

-- ── 3. fpe_obra_acta_phase_impacts ──────────────────────────────────────────
-- Modificación al plazo planificado de una fase, vinculada a una acta.
-- Si acta cliente → se aplica al firmar. Si acta interna → al cerrar la sesión.
-- extra_dias puede ser negativo (adelanta plazos).
CREATE TABLE IF NOT EXISTS public.fpe_obra_acta_phase_impacts (
  id              uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  acta_id         uuid        NOT NULL REFERENCES public.fpe_obra_actas(id)  ON DELETE CASCADE,
  obra_phase_id   uuid        NOT NULL REFERENCES public.fpe_obra_phases(id) ON DELETE CASCADE,
  extra_dias      integer     NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (acta_id, obra_phase_id)
);

CREATE INDEX IF NOT EXISTS fpe_obra_acta_phase_impacts_acta_idx
  ON public.fpe_obra_acta_phase_impacts(acta_id);
CREATE INDEX IF NOT EXISTS fpe_obra_acta_phase_impacts_phase_idx
  ON public.fpe_obra_acta_phase_impacts(obra_phase_id);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.fpe_obra_acta_phase_impacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fpe_obra_acta_phase_impacts: manager+ all"   ON public.fpe_obra_acta_phase_impacts;
DROP POLICY IF EXISTS "fpe_obra_acta_phase_impacts: service role bypass" ON public.fpe_obra_acta_phase_impacts;

CREATE POLICY "fpe_obra_acta_phase_impacts: manager+ all"
  ON public.fpe_obra_acta_phase_impacts
  FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_obra_acta_phase_impacts: service role bypass"
  ON public.fpe_obra_acta_phase_impacts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación ─────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fpe_obra_change_log'
  AND column_name IN ('reflect_to_partner','effective_partner_id','add_to_template')
ORDER BY column_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fpe_obra_payment_schedule'
  AND column_name IN ('kind','source_change_log_id')
ORDER BY column_name;

SELECT 'fpe_obra_acta_phase_impacts' AS new_table,
       count(*)::int AS rows
FROM public.fpe_obra_acta_phase_impacts;
