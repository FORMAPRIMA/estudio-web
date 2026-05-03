-- fpe_template_phase_line_items
-- Many-to-many: which execution phases does each line item (partida) participate in.
-- Drives filtering of phase duration inputs in the partner bidding portal.

CREATE TABLE IF NOT EXISTS public.fpe_template_phase_line_items (
  phase_id     uuid NOT NULL REFERENCES public.fpe_template_phases(id)     ON DELETE CASCADE,
  line_item_id uuid NOT NULL REFERENCES public.fpe_template_line_items(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (phase_id, line_item_id)
);

NOTIFY pgrst, 'reload schema';
