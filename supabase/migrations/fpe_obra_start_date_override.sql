-- FP Execution — Dream Team obra start date override.
--
-- Context:
--   fpe_projects.fecha_inicio_obra is the project-wide start date used by the
--   parametric Gantt of the Cronograma tab during pre-licitación.
--
--   Once adjudicación happens, the Dream Team tab may need a *different* start
--   date because, between licitación and adjudicación, the actual on-site start
--   may have shifted. This column captures that override.
--
-- Effective date used by the Dream Team Gantt and by the contract PDF:
--   COALESCE(obra_start_date_override, fecha_inicio_obra)
--
-- The Cronograma (parametric) tab keeps reading fecha_inicio_obra; only the
-- Dream Team and downstream contract data use the override.

ALTER TABLE public.fpe_projects
  ADD COLUMN IF NOT EXISTS obra_start_date_override DATE;

COMMENT ON COLUMN public.fpe_projects.obra_start_date_override IS
  'Optional override of fecha_inicio_obra applied at the Dream Team level. When NULL the project falls back to fecha_inicio_obra. Read by the Dream Team Gantt and by the Orden de Ejecución PDF for schedule date computation.';

NOTIFY pgrst, 'reload schema';
