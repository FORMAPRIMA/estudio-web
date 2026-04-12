-- ══════════════════════════════════════════════════════════════════════════════
-- FP EXECUTION — Milestones + Parametric Schedule
-- Adds:
--   • fpe_template_milestones       — global ordered list of construction milestones
--   • fpe_template_phase_milestone_links — phase ↔ milestone (achieves / requires)
--   • duracion_pct on template_units + template_phases
--   • fecha_inicio_obra + duracion_obra_semanas on fpe_projects
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Milestones ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fpe_template_milestones (
  id          uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre      text        NOT NULL,
  descripcion text,
  orden       integer     NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.fpe_template_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fp_team can read milestones"
  ON public.fpe_template_milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND rol IN ('fp_team', 'fp_manager', 'fp_partner')
    )
  );

CREATE POLICY "fp_manager+ can write milestones"
  ON public.fpe_template_milestones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND rol IN ('fp_manager', 'fp_partner')
    )
  );

-- ── Phase ↔ Milestone links ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fpe_template_phase_milestone_links (
  id           uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  phase_id     uuid        NOT NULL REFERENCES public.fpe_template_phases(id)    ON DELETE CASCADE,
  milestone_id uuid        NOT NULL REFERENCES public.fpe_template_milestones(id) ON DELETE CASCADE,
  link_type    text        NOT NULL CHECK (link_type IN ('achieves', 'requires')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (phase_id, milestone_id, link_type)
);

ALTER TABLE public.fpe_template_phase_milestone_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fp_team can read phase milestone links"
  ON public.fpe_template_phase_milestone_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND rol IN ('fp_team', 'fp_manager', 'fp_partner')
    )
  );

CREATE POLICY "fp_manager+ can write phase milestone links"
  ON public.fpe_template_phase_milestone_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND rol IN ('fp_manager', 'fp_partner')
    )
  );

-- ── duracion_pct on template_units + template_phases ─────────────────────────
-- Represents what % of total project time (for units) or unit time (for phases)
-- this element typically occupies. Used for parametric schedule calculation.

ALTER TABLE public.fpe_template_units
  ADD COLUMN IF NOT EXISTS duracion_pct numeric NOT NULL DEFAULT 0
    CHECK (duracion_pct >= 0 AND duracion_pct <= 100);

ALTER TABLE public.fpe_template_phases
  ADD COLUMN IF NOT EXISTS duracion_pct numeric NOT NULL DEFAULT 0
    CHECK (duracion_pct >= 0 AND duracion_pct <= 100);

-- ── Parametric schedule inputs on fpe_projects ───────────────────────────────

ALTER TABLE public.fpe_projects
  ADD COLUMN IF NOT EXISTS fecha_inicio_obra      date;

ALTER TABLE public.fpe_projects
  ADD COLUMN IF NOT EXISTS duracion_obra_semanas  numeric DEFAULT 0
    CHECK (duracion_obra_semanas >= 0);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fpe_milestones_orden
  ON public.fpe_template_milestones (orden);

CREATE INDEX IF NOT EXISTS idx_fpe_phase_milestone_links_phase
  ON public.fpe_template_phase_milestone_links (phase_id);

CREATE INDEX IF NOT EXISTS idx_fpe_phase_milestone_links_milestone
  ON public.fpe_template_phase_milestone_links (milestone_id);
