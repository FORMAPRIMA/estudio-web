-- ══════════════════════════════════════════════════════════════════════════════
-- FP Execution — Per-unit award model
--
-- Replaces the legacy "award the whole bid" flow with per-UE adjudication.
-- The team adjudicates UE by UE in the BidComparison, then a Final Overview
-- aggregates per-partner awards into one contract per partner.
--
-- The legacy fpe_awards table is kept for backwards compatibility but no
-- longer the primary record. New flow uses fpe_project_unit_awards.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fpe_project_unit_awards (
  id              uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id      uuid        NOT NULL REFERENCES public.fpe_projects(id)      ON DELETE CASCADE,
  project_unit_id uuid        NOT NULL REFERENCES public.fpe_project_units(id) ON DELETE CASCADE,
  bid_id          uuid        NOT NULL REFERENCES public.fpe_bids(id)          ON DELETE RESTRICT,
  partner_id      uuid        NOT NULL REFERENCES public.fpe_partners(id)      ON DELETE RESTRICT,
  awarded_at      timestamptz NOT NULL DEFAULT now(),
  awarded_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, project_unit_id)
);

CREATE INDEX IF NOT EXISTS fpe_project_unit_awards_project_idx
  ON public.fpe_project_unit_awards (project_id);

CREATE INDEX IF NOT EXISTS fpe_project_unit_awards_partner_idx
  ON public.fpe_project_unit_awards (partner_id);

CREATE INDEX IF NOT EXISTS fpe_project_unit_awards_bid_idx
  ON public.fpe_project_unit_awards (bid_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.fpe_project_unit_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpe_project_unit_awards: manager+ all"
  ON public.fpe_project_unit_awards FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_project_unit_awards: service role bypass"
  ON public.fpe_project_unit_awards FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Reload PostgREST schema cache so the new table is queryable immediately
NOTIFY pgrst, 'reload schema';
