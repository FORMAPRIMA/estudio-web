-- ══════════════════════════════════════════════════════════════════════════════
-- FPE Chapter Phases Migration
-- Moves execution phases from unit level to chapter level.
--
-- INSTRUCCIONES: Supabase Dashboard → SQL Editor → Ejecutar ANTES de los resets
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Chapters: add duracion_pct and principal_discipline_id ─────────────────
ALTER TABLE public.fpe_template_chapters
  ADD COLUMN IF NOT EXISTS duracion_pct              numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS principal_discipline_id   uuid
    REFERENCES public.fpe_disciplines(id) ON DELETE SET NULL;

-- ── 2. Phases: add chapter_id; make unit_id nullable (phases are now chapter-level) ──
ALTER TABLE public.fpe_template_phases
  ADD COLUMN IF NOT EXISTS chapter_id uuid
    REFERENCES public.fpe_template_chapters(id) ON DELETE CASCADE;

ALTER TABLE public.fpe_template_phases
  ALTER COLUMN unit_id DROP NOT NULL;

-- ── 3. Backfill chapter_id from unit's chapter_id ────────────────────────────
UPDATE public.fpe_template_phases
SET chapter_id = u.chapter_id
FROM public.fpe_template_units u
WHERE fpe_template_phases.unit_id = u.id
  AND fpe_template_phases.chapter_id IS NULL;

-- ── 4. fpe_project_chapter_settings ──────────────────────────────────────────
-- Stores per-project overrides for a chapter's principal discipline.
CREATE TABLE IF NOT EXISTS public.fpe_project_chapter_settings (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id              uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  chapter_id              uuid        NOT NULL REFERENCES public.fpe_template_chapters(id) ON DELETE CASCADE,
  principal_discipline_id uuid        REFERENCES public.fpe_disciplines(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, chapter_id)
);

-- ── 5. fpe_bid_phase_durations: add invitation_id, relax project_unit_id ──────
ALTER TABLE public.fpe_bid_phase_durations
  ADD COLUMN IF NOT EXISTS invitation_id uuid
    REFERENCES public.fpe_tender_invitations(id) ON DELETE CASCADE;

-- Backfill invitation_id from the parent bid
UPDATE public.fpe_bid_phase_durations bpd
SET invitation_id = b.invitation_id
FROM public.fpe_bids b
WHERE bpd.bid_id = b.id
  AND bpd.invitation_id IS NULL;

-- Make project_unit_id nullable (legacy; no longer required)
ALTER TABLE public.fpe_bid_phase_durations
  ALTER COLUMN project_unit_id DROP NOT NULL;

COMMIT;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   IN ('fpe_template_chapters','fpe_template_phases','fpe_bid_phase_durations')
ORDER BY table_name, ordinal_position;
