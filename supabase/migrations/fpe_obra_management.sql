-- ══════════════════════════════════════════════════════════════════════════════
-- FP Execution — Gestión de Obra (plataforma post-adjudicación)
--
-- CONTEXTO
--   Una vez cerrado el Dream Team de un proyecto FPE, comienza la fase de
--   ejecución de obra. Esta fase tiene su propio set de datos vivos que evolu-
--   cionan día a día (avance de fases, hitos logrados, pagos facturados, etc.)
--   y debe quedar AISLADA de la fase de licitación para no corromper el
--   histórico.
--
-- MODELO
--   - fpe_projects gana columnas de activación + un baseline snapshot inmutable.
--   - Conjunto de tablas espejo con prefijo `fpe_obra_*` que se materializan
--     en el momento de activar gestión de obra (action `startObraManagement`).
--   - Las tablas espejo guardan referencias a su `source_*` original para
--     trazabilidad pero son fuente de verdad propia desde la activación.
--
-- FLUJO DE INFORMACIÓN
--   licitación → obra :  permitido vía action `pushUnitToObra` (UE adjudicada tarde)
--   obra → licitación :  bloqueado (no existe ninguna escritura inversa)
--
-- TABLAS NUEVAS DEL CRONOGRAMA VIVO (no son espejo, son nativas de obra)
--   - fpe_obra_phases     : estado vivo por fase (planificada vs real, % avance)
--   - fpe_obra_milestones : estado vivo por hito (planificado vs logrado)
--
-- INSTRUCCIONES: Supabase Dashboard → SQL Editor → Ejecutar de una vez.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Flag de activación + baseline snapshot en fpe_projects ─────────────────
ALTER TABLE public.fpe_projects
  ADD COLUMN IF NOT EXISTS obra_management_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS obra_management_started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS obra_baseline_snapshot     jsonb,
  -- Versión "obra" de los parámetros del cronograma; null hasta activación.
  -- Al activar, se clonan los valores actuales y a partir de ahí evolucionan
  -- de forma independiente.
  ADD COLUMN IF NOT EXISTS obra_m2                    numeric,
  ADD COLUMN IF NOT EXISTS obra_duracion_factor       numeric,
  ADD COLUMN IF NOT EXISTS obra_fecha_inicio          date;

COMMENT ON COLUMN public.fpe_projects.obra_management_started_at IS
  'Timestamp en el que se activó la plataforma de gestión de obra. NULL = aún en fase de licitación.';
COMMENT ON COLUMN public.fpe_projects.obra_baseline_snapshot IS
  'Snapshot inmutable del cronograma calculado en el momento de activar gestión de obra. Usado como "shadow" en el Gantt vivo para comparar contra el plan original.';

-- ── 2. fpe_obra_units (espejo de fpe_project_units) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.fpe_obra_units (
  id                      uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id              uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  source_project_unit_id  uuid        REFERENCES public.fpe_project_units(id) ON DELETE SET NULL,
  template_unit_id        uuid        NOT NULL REFERENCES public.fpe_template_units(id) ON DELETE RESTRICT,
  notas                   text,
  orden                   integer     NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, template_unit_id)
);

CREATE INDEX IF NOT EXISTS fpe_obra_units_project_idx ON public.fpe_obra_units (project_id);

-- ── 3. fpe_obra_line_items (espejo de fpe_project_line_items) ─────────────────
CREATE TABLE IF NOT EXISTS public.fpe_obra_line_items (
  id                              uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  obra_unit_id                    uuid        NOT NULL REFERENCES public.fpe_obra_units(id) ON DELETE CASCADE,
  source_project_line_item_id     uuid        REFERENCES public.fpe_project_line_items(id) ON DELETE SET NULL,
  template_line_item_id           uuid        NOT NULL REFERENCES public.fpe_template_line_items(id) ON DELETE RESTRICT,
  cantidad_inicial                numeric     NOT NULL DEFAULT 0 CHECK (cantidad_inicial >= 0),
  cantidad                        numeric     NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  precio_unitario_adjudicado      numeric(12,2),
  notas                           text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_unit_id, template_line_item_id)
);

COMMENT ON COLUMN public.fpe_obra_line_items.cantidad_inicial IS
  'Cantidad fijada al activar gestión de obra. Inmutable, sirve de baseline.';
COMMENT ON COLUMN public.fpe_obra_line_items.cantidad IS
  'Cantidad viva. Puede evolucionar con modificados de obra.';
COMMENT ON COLUMN public.fpe_obra_line_items.precio_unitario_adjudicado IS
  'Precio unitario del bid ganador, copiado al activar gestión de obra.';

-- ── 4. fpe_obra_unit_partners (partner adjudicado por UE) ─────────────────────
-- Source: fpe_project_unit_awards (NO fpe_project_unit_partners, que son los
-- candidatos pre-licitación).
CREATE TABLE IF NOT EXISTS public.fpe_obra_unit_partners (
  id                       uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  obra_unit_id             uuid        NOT NULL REFERENCES public.fpe_obra_units(id) ON DELETE CASCADE,
  partner_id               uuid        NOT NULL REFERENCES public.fpe_partners(id) ON DELETE RESTRICT,
  source_award_id          uuid        REFERENCES public.fpe_project_unit_awards(id) ON DELETE SET NULL,
  source_bid_id            uuid        REFERENCES public.fpe_bids(id) ON DELETE SET NULL,
  source_contract_id       uuid        REFERENCES public.fpe_contracts(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_unit_id, partner_id)
);

CREATE INDEX IF NOT EXISTS fpe_obra_unit_partners_partner_idx ON public.fpe_obra_unit_partners (partner_id);

-- ── 5. fpe_obra_chapter_settings (espejo de fpe_project_chapter_settings) ─────
CREATE TABLE IF NOT EXISTS public.fpe_obra_chapter_settings (
  id                      uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id              uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  chapter_id              uuid        NOT NULL REFERENCES public.fpe_template_chapters(id) ON DELETE CASCADE,
  principal_discipline_id uuid        REFERENCES public.fpe_disciplines(id) ON DELETE SET NULL,
  duracion_dias_override  numeric,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, chapter_id)
);

-- ── 6. fpe_obra_phases (NUEVA: estado vivo del cronograma) ────────────────────
-- Una fila por fase del cronograma. Materializada al activar gestión de obra
-- con las fechas calculadas en ese momento. A partir de ahí evoluciona libre.
CREATE TABLE IF NOT EXISTS public.fpe_obra_phases (
  id                       uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id               uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  -- Origen template (snapshot al activar). Nullable porque el usuario puede
  -- crear fases custom solo en la obra.
  template_phase_id        uuid        REFERENCES public.fpe_template_phases(id) ON DELETE SET NULL,
  chapter_id               uuid        REFERENCES public.fpe_template_chapters(id) ON DELETE SET NULL,
  -- Snapshot de la fase (independiente del template a partir de ahora)
  nombre                   text        NOT NULL,
  orden                    integer     NOT NULL DEFAULT 0,
  duracion_pct             numeric(5,2),
  achieves                 uuid[]      NOT NULL DEFAULT '{}',
  requires                 uuid[]      NOT NULL DEFAULT '{}',
  partner_ids              uuid[]      NOT NULL DEFAULT '{}',
  -- Plan original (frozen al activar — sirve también de fallback al shadow)
  planned_start_date       date,
  planned_end_date         date,
  planned_duration_dias    numeric,
  -- Estado vivo
  actual_start_date        date,
  actual_end_date          date,
  actual_duration_dias     numeric,
  pct_avance               numeric(5,2) NOT NULL DEFAULT 0 CHECK (pct_avance >= 0 AND pct_avance <= 100),
  status                   text         NOT NULL DEFAULT 'pendiente'
                                         CHECK (status IN ('pendiente','en_curso','completada','bloqueada')),
  notas                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fpe_obra_phases_project_idx ON public.fpe_obra_phases (project_id);
CREATE INDEX IF NOT EXISTS fpe_obra_phases_chapter_idx ON public.fpe_obra_phases (chapter_id);
CREATE INDEX IF NOT EXISTS fpe_obra_phases_status_idx  ON public.fpe_obra_phases (status);

COMMENT ON COLUMN public.fpe_obra_phases.planned_start_date IS
  'Fecha de inicio planificada (snapshot al activar gestión de obra). NO se actualiza al editar el cronograma vivo.';
COMMENT ON COLUMN public.fpe_obra_phases.actual_start_date IS
  'Fecha de inicio real. Se rellena cuando el equipo marca la fase como iniciada.';

-- ── 7. fpe_obra_milestones (NUEVA: estado vivo de hitos de obra) ──────────────
CREATE TABLE IF NOT EXISTS public.fpe_obra_milestones (
  id                       uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id               uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  template_milestone_id    uuid        REFERENCES public.fpe_template_milestones(id) ON DELETE SET NULL,
  nombre                   text        NOT NULL,
  orden                    integer     NOT NULL DEFAULT 0,
  es_hito_pago             boolean     NOT NULL DEFAULT false,
  planned_date             date,
  actual_date              date,
  achieved_at              timestamptz,
  achieved_by              uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  notas                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, template_milestone_id)
);

CREATE INDEX IF NOT EXISTS fpe_obra_milestones_project_idx ON public.fpe_obra_milestones (project_id);

-- ── 8. fpe_obra_payment_schedule (espejo VIVO de fpe_contract_payment_schedule) ─
-- El original queda congelado como prueba de lo firmado. Este espejo es el que
-- evoluciona con el estado real de cada pago (facturado, cobrado, etc.).
CREATE TABLE IF NOT EXISTS public.fpe_obra_payment_schedule (
  id                              uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id                      uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  -- Contrato original sigue siendo referencia válida (no clonado).
  contract_id                     uuid        NOT NULL REFERENCES public.fpe_contracts(id) ON DELETE RESTRICT,
  source_payment_schedule_id      uuid        REFERENCES public.fpe_contract_payment_schedule(id) ON DELETE SET NULL,
  -- Hito vivo asociado (en lugar del milestone template). Nullable si el pago
  -- está atado a 'contract_signed' u otro trigger no-milestone.
  obra_milestone_id               uuid        REFERENCES public.fpe_obra_milestones(id) ON DELETE SET NULL,
  partner_id                      uuid        NOT NULL REFERENCES public.fpe_partners(id) ON DELETE RESTRICT,
  nombre                          text        NOT NULL,
  pct                             numeric(5,2) NOT NULL,
  monto                           numeric(12,2) NOT NULL DEFAULT 0,
  status                          text        NOT NULL DEFAULT 'pendiente'
                                              CHECK (status IN ('pendiente','facturado','cobrado')),
  fecha_estimada                  date,
  fecha_facturado                 date,
  fecha_pago                      date,
  orden                           integer     NOT NULL DEFAULT 0,
  notas                           text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fpe_obra_payment_schedule_project_idx ON public.fpe_obra_payment_schedule (project_id);
CREATE INDEX IF NOT EXISTS fpe_obra_payment_schedule_contract_idx ON public.fpe_obra_payment_schedule (contract_id);
CREATE INDEX IF NOT EXISTS fpe_obra_payment_schedule_status_idx ON public.fpe_obra_payment_schedule (status);

-- ── 9. fpe_obra_documents (espejo de fpe_documents) ───────────────────────────
-- Se clonan solo los docs de UEs adjudicadas. Además, en obra se admite un
-- doc_kind para distinguir docs originales (planos) de docs de obra (as built,
-- fotos, informes de visita, etc.).
CREATE TABLE IF NOT EXISTS public.fpe_obra_documents (
  id                       uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id               uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  obra_unit_id             uuid        REFERENCES public.fpe_obra_units(id) ON DELETE CASCADE,
  chapter_id               uuid        REFERENCES public.fpe_template_chapters(id) ON DELETE SET NULL,
  source_document_id       uuid        REFERENCES public.fpe_documents(id) ON DELETE SET NULL,
  nombre                   text        NOT NULL,
  storage_path             text        NOT NULL,
  mime_type                text,
  size_bytes               bigint,
  discipline_tags          text[]      NOT NULL DEFAULT '{}',
  doc_kind                 text        NOT NULL DEFAULT 'original'
                                       CHECK (doc_kind IN ('original','as_built','foto_obra','informe','acta','otro')),
  uploaded_by              uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fpe_obra_documents_project_idx ON public.fpe_obra_documents (project_id);
CREATE INDEX IF NOT EXISTS fpe_obra_documents_unit_idx    ON public.fpe_obra_documents (obra_unit_id);

-- ── 10. Triggers de updated_at ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fpe_obra_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fpe_obra_units_touch          ON public.fpe_obra_units;
DROP TRIGGER IF EXISTS fpe_obra_line_items_touch     ON public.fpe_obra_line_items;
DROP TRIGGER IF EXISTS fpe_obra_chapter_settings_touch ON public.fpe_obra_chapter_settings;
DROP TRIGGER IF EXISTS fpe_obra_phases_touch         ON public.fpe_obra_phases;
DROP TRIGGER IF EXISTS fpe_obra_milestones_touch     ON public.fpe_obra_milestones;
DROP TRIGGER IF EXISTS fpe_obra_payment_schedule_touch ON public.fpe_obra_payment_schedule;

CREATE TRIGGER fpe_obra_units_touch          BEFORE UPDATE ON public.fpe_obra_units          FOR EACH ROW EXECUTE FUNCTION public.fpe_obra_touch_updated_at();
CREATE TRIGGER fpe_obra_line_items_touch     BEFORE UPDATE ON public.fpe_obra_line_items     FOR EACH ROW EXECUTE FUNCTION public.fpe_obra_touch_updated_at();
CREATE TRIGGER fpe_obra_chapter_settings_touch BEFORE UPDATE ON public.fpe_obra_chapter_settings FOR EACH ROW EXECUTE FUNCTION public.fpe_obra_touch_updated_at();
CREATE TRIGGER fpe_obra_phases_touch         BEFORE UPDATE ON public.fpe_obra_phases         FOR EACH ROW EXECUTE FUNCTION public.fpe_obra_touch_updated_at();
CREATE TRIGGER fpe_obra_milestones_touch     BEFORE UPDATE ON public.fpe_obra_milestones     FOR EACH ROW EXECUTE FUNCTION public.fpe_obra_touch_updated_at();
CREATE TRIGGER fpe_obra_payment_schedule_touch BEFORE UPDATE ON public.fpe_obra_payment_schedule FOR EACH ROW EXECUTE FUNCTION public.fpe_obra_touch_updated_at();

-- ── 11. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.fpe_obra_units             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_obra_line_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_obra_unit_partners     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_obra_chapter_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_obra_phases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_obra_milestones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_obra_payment_schedule  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_obra_documents         ENABLE ROW LEVEL SECURITY;

-- Política unificada: lectura/escritura para fp_manager+, bypass service_role.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'fpe_obra_units',
      'fpe_obra_line_items',
      'fpe_obra_unit_partners',
      'fpe_obra_chapter_settings',
      'fpe_obra_phases',
      'fpe_obra_milestones',
      'fpe_obra_payment_schedule',
      'fpe_obra_documents'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%I: manager+ all" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%I: service role bypass" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%I: manager+ all" ON public.%I FOR ALL '
      'USING (public.is_fp_manager_or_above()) '
      'WITH CHECK (public.is_fp_manager_or_above())', t, t);
    EXECUTE format(
      'CREATE POLICY "%I: service role bypass" ON public.%I FOR ALL TO service_role '
      'USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

COMMIT;

-- ── Recarga schema cache de PostgREST ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'fpe_obra_%'
ORDER BY table_name;
