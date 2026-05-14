-- Add requiere_duracion to fpe_template_phases
-- When false, the phase is not shown in the bid form's duration inputs.
-- Defaults to true to preserve existing behavior.

ALTER TABLE public.fpe_template_phases
  ADD COLUMN IF NOT EXISTS requiere_duracion boolean NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
