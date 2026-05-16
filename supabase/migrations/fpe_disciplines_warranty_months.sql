-- FP Execution — Add warranty period (in months) to disciplines.
--
-- Each discipline carries its own warranty obligation. When generating an
-- Orden de Ejecución contract for an Execution Partner, the warranty applied
-- in clause 11 is the MAX warranty_months across all disciplines awarded to
-- that partner (the most conservative for FORMA PRIMA).
--
-- Default 12 months matches the previous hardcoded default in the PDF.

ALTER TABLE public.fpe_disciplines
  ADD COLUMN IF NOT EXISTS warranty_months int4 NOT NULL DEFAULT 12;

COMMENT ON COLUMN public.fpe_disciplines.warranty_months IS
  'Specific warranty period (in months) granted by an EP for works of this discipline. Default 12. Applied as MAX across all disciplines awarded to the same EP within a single Orden de Ejecución.';

NOTIFY pgrst, 'reload schema';
