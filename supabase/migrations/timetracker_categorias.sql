-- ─────────────────────────────────────────────────────────────────────────────
-- TIME TRACKER — categorías internas gestionables desde la UI
--
-- Antes vivían hardcodeadas en components/team/TimeTracker.tsx (9 constantes).
-- Ahora son una tabla editable desde /team/proyectos/plantilla → "Categorías
-- internas", con un campo clave: `tipo`.
--
--   trabajo_interno → horas trabajadas que no cuelgan de un proyecto
--   ausencia        → horas marcadas pero NO trabajadas (vacaciones, baja…)
--
-- Eso es lo que permite separar "horas marcadas" de "horas trabajadas" en los
-- análisis personal y de equipo.
--
-- `time_entries.categoria_interna` sigue guardando el CÓDIGO en texto plano, así
-- que el histórico no se toca: cambiar la etiqueta es gratis, cambiar el código
-- dejaría huérfanos los registros ya guardados (de ahí que el código no se edite
-- desde la UI). Por el mismo motivo, borrar una categoría en uso está prohibido:
-- se archiva (`activo = false`) y desaparece del desplegable sin perder el pasado.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tt_categorias_internas (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lo que se guarda en time_entries.categoria_interna. Inmutable en la práctica.
  codigo  text NOT NULL UNIQUE,
  label   text NOT NULL,

  tipo    text NOT NULL DEFAULT 'trabajo_interno'
          CHECK (tipo IN ('trabajo_interno', 'ausencia')),

  -- Archivada = fuera del desplegable, pero los registros históricos siguen
  -- mostrando su etiqueta.
  activo  boolean NOT NULL DEFAULT true,
  orden   integer NOT NULL DEFAULT 0,

  -- Restringir la categoría a ciertas personas (mismo patrón que ofertas_fp).
  -- NULL o vacío = visible para todo el equipo.
  visible_para text[],

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tt_categorias_internas_orden_idx
  ON public.tt_categorias_internas (orden ASC, label ASC);

-- Semilla: las 9 categorías que ya estaban en uso, con su tipo.
-- ON CONFLICT DO NOTHING para poder reejecutar la migración sin pisar ediciones.
INSERT INTO public.tt_categorias_internas (codigo, label, tipo, orden) VALUES
  ('GESTION_FORMA_PRIMA',       'Gestión FP',       'trabajo_interno', 0),
  ('LEADS_OFERTAS',             'Leads / Ofertas',  'trabajo_interno', 1),
  ('REUNION_CLIENTE_POTENCIAL', 'Reunión Cliente',  'trabajo_interno', 2),
  ('VISITA_PROVEEDOR',          'Visita Proveedor', 'trabajo_interno', 3),
  ('SOPHIQ_GENERAL',            'Sophiq General',   'trabajo_interno', 4),
  ('FORMACION',                 'Formación',        'trabajo_interno', 5),
  ('VACACIONES',                'Vacaciones',       'ausencia',        6),
  ('BAJA_MEDICA',               'Baja Médica',      'ausencia',        7),
  ('AUSENTE',                   'Ausente',          'ausencia',        8)
ON CONFLICT (codigo) DO NOTHING;

-- El Time Tracker es un componente de cliente y lee esta tabla con el cliente de
-- navegador, así que necesita política de lectura (a diferencia de las tablas
-- que solo toca el service_role). Las escrituras van por Server Actions.
ALTER TABLE public.tt_categorias_internas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FP puede leer categorias internas" ON public.tt_categorias_internas;
CREATE POLICY "FP puede leer categorias internas"
  ON public.tt_categorias_internas
  FOR SELECT TO authenticated
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner', 'fp_biz_dev'));

GRANT SELECT ON public.tt_categorias_internas TO authenticated;

NOTIFY pgrst, 'reload schema';
