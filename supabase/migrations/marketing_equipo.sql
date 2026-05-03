-- Discriminador de equipo en proyectos_internos
-- Permite separar la estructura de time-tracking de marketing del resto del estudio.
-- Cada proyecto_interno pertenece a un equipo; secciones y fases lo heredan vía relación.

ALTER TABLE proyectos_internos
  ADD COLUMN IF NOT EXISTS equipo text NOT NULL DEFAULT 'arquitectura';

ALTER TABLE proyectos_internos
  DROP CONSTRAINT IF EXISTS proyectos_internos_equipo_check;

ALTER TABLE proyectos_internos
  ADD CONSTRAINT proyectos_internos_equipo_check
  CHECK (equipo IN ('arquitectura', 'marketing'));

CREATE INDEX IF NOT EXISTS idx_proyectos_internos_equipo
  ON proyectos_internos(equipo);

NOTIFY pgrst, 'reload schema';
