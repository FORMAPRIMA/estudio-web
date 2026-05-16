-- ══════════════════════════════════════════════════════════════════════════════
-- FP Execution — Presupuesto vivo de obra
--
-- Habilita modificaciones del presupuesto durante la ejecución de la obra
-- mediante "sesiones de cambios". Cada sesión agrupa N modificaciones que se
-- aplican atómicamente al cerrarse, generando 0, 1 o 2 actas (cliente y/o
-- interna) que documentan los cambios.
--
-- Cambios v1: editar (cantidad/precio), añadir partida, añadir UE, eliminar
-- partida, eliminar UE.
-- Diferido: añadir capítulo nuevo (los capítulos siguen viviendo en el
-- catálogo template global).
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Entidades custom en obra ──────────────────────────────────────────────
-- Permitir UEs y partidas creadas directamente en obra (sin origen template).

ALTER TABLE public.fpe_obra_units
  ALTER COLUMN template_unit_id DROP NOT NULL;

ALTER TABLE public.fpe_obra_units
  ADD COLUMN IF NOT EXISTS custom_nombre         text,
  ADD COLUMN IF NOT EXISTS custom_descripcion    text,
  ADD COLUMN IF NOT EXISTS chapter_id            uuid REFERENCES public.fpe_template_chapters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_in_session_id uuid;

-- Para UEs custom necesitamos saber su chapter_id directamente (no viene del template).
-- Backfill: para UEs preexistentes, derivar chapter_id desde el template_unit
UPDATE public.fpe_obra_units ou
SET chapter_id = tu.chapter_id
FROM public.fpe_template_units tu
WHERE ou.template_unit_id = tu.id
  AND ou.chapter_id IS NULL;

ALTER TABLE public.fpe_obra_units
  DROP CONSTRAINT IF EXISTS obra_units_template_or_custom_required;
ALTER TABLE public.fpe_obra_units
  ADD CONSTRAINT obra_units_template_or_custom_required CHECK (
    template_unit_id IS NOT NULL OR custom_nombre IS NOT NULL
  );

ALTER TABLE public.fpe_obra_line_items
  ALTER COLUMN template_line_item_id DROP NOT NULL;

ALTER TABLE public.fpe_obra_line_items
  ADD COLUMN IF NOT EXISTS custom_nombre         text,
  ADD COLUMN IF NOT EXISTS custom_unidad_medida  text,
  ADD COLUMN IF NOT EXISTS custom_descripcion    text,
  ADD COLUMN IF NOT EXISTS created_in_session_id uuid;

ALTER TABLE public.fpe_obra_line_items
  DROP CONSTRAINT IF EXISTS obra_line_items_template_or_custom_required;
ALTER TABLE public.fpe_obra_line_items
  ADD CONSTRAINT obra_line_items_template_or_custom_required CHECK (
    template_line_item_id IS NOT NULL OR custom_nombre IS NOT NULL
  );

-- ── 2. Sesiones de cambio ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fpe_obra_change_sessions (
  id          uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id  uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'closed', 'cancelled')),
  opened_at   timestamptz NOT NULL DEFAULT now(),
  opened_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at   timestamptz,
  closed_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fpe_obra_change_sessions_project_idx
  ON public.fpe_obra_change_sessions(project_id, status);

-- Sólo una sesión abierta por proyecto a la vez
CREATE UNIQUE INDEX IF NOT EXISTS fpe_obra_one_open_session_per_project
  ON public.fpe_obra_change_sessions(project_id)
  WHERE status = 'open';

-- FK desde obra_units / obra_line_items
ALTER TABLE public.fpe_obra_units
  ADD CONSTRAINT fpe_obra_units_session_fk FOREIGN KEY (created_in_session_id)
    REFERENCES public.fpe_obra_change_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.fpe_obra_line_items
  ADD CONSTRAINT fpe_obra_line_items_session_fk FOREIGN KEY (created_in_session_id)
    REFERENCES public.fpe_obra_change_sessions(id) ON DELETE SET NULL;

-- ── 3. Log de cambios dentro de una sesión ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fpe_obra_change_log (
  id              uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id      uuid        NOT NULL REFERENCES public.fpe_obra_change_sessions(id) ON DELETE CASCADE,
  project_id      uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  change_type     text        NOT NULL
                              CHECK (change_type IN (
                                'edit_partida',
                                'new_partida',
                                'new_unit',
                                'delete_partida',
                                'delete_unit'
                              )),
  target_kind     text        NOT NULL
                              CHECK (target_kind IN ('partida', 'unit')),
  -- Para edit_* / delete_*: id de la entidad existente.
  -- Para new_*: NULL hasta que la sesión se cierre y se materialice.
  target_id       uuid,
  -- Padre: para partida → obra_unit_id; para unit → chapter_id
  parent_id       uuid,
  -- Snapshots inmutables del cambio
  old_value       jsonb,
  new_value       jsonb,
  -- Categorización
  categoria       text        NOT NULL
                              CHECK (categoria IN ('a_peticion_cliente', 'imprevisto', 'ajuste')),
  sub_categoria   text
                              CHECK (sub_categoria IN ('trasladable_cliente', 'costo_empresa')),
  destino_acta    text        NOT NULL
                              CHECK (destino_acta IN ('cliente', 'interna')),
  razon           text        NOT NULL,
  delta_monto     numeric(12,2) NOT NULL DEFAULT 0,
  -- Audit
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Validación de longitud mínima de razón (40 chars)
  CONSTRAINT obra_change_log_razon_min_length CHECK (char_length(razon) >= 40),
  -- "a petición de cliente" nunca lleva sub_categoria
  CONSTRAINT obra_change_log_cliente_no_sub CHECK (
    NOT (categoria = 'a_peticion_cliente' AND sub_categoria IS NOT NULL)
  ),
  -- imprevisto/ajuste obligan sub_categoria
  CONSTRAINT obra_change_log_imprevisto_requires_sub CHECK (
    categoria = 'a_peticion_cliente' OR sub_categoria IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS fpe_obra_change_log_session_idx ON public.fpe_obra_change_log(session_id);
CREATE INDEX IF NOT EXISTS fpe_obra_change_log_destino_idx ON public.fpe_obra_change_log(destino_acta);
CREATE INDEX IF NOT EXISTS fpe_obra_change_log_project_idx ON public.fpe_obra_change_log(project_id);

-- ── 4. Actas generadas ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fpe_obra_actas (
  id                    uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id            uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  session_id            uuid        NOT NULL REFERENCES public.fpe_obra_change_sessions(id) ON DELETE RESTRICT,
  kind                  text        NOT NULL CHECK (kind IN ('cliente', 'interna')),
  year                  integer     NOT NULL,
  numero                integer     NOT NULL,
  -- Código compuesto (AC-2026-001 o AI-2026-001)
  codigo                text        NOT NULL,
  -- Detalle inmutable del acta (cambios, totales, partners, etc.)
  snapshot              jsonb       NOT NULL,
  total_delta_monto     numeric(12,2) NOT NULL DEFAULT 0,
  pdf_path              text,
  -- Status: generada (default) → sent_to_sign → signed → received (sólo cliente)
  -- O bien anulada (cualquier momento)
  status                text        NOT NULL DEFAULT 'generada'
                                    CHECK (status IN ('generada', 'sent_to_sign', 'signed', 'received', 'anulada')),
  -- DocuSign (sólo cliente)
  docusign_envelope_id  text,
  sent_at               timestamptz,
  signed_at             timestamptz,
  pdf_signed_path       text,
  -- Anulación
  anulada_at            timestamptz,
  anulada_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  anulada_razon         text,
  -- Audit
  generated_at          timestamptz NOT NULL DEFAULT now(),
  generated_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (project_id, kind, year, numero)
);

CREATE INDEX IF NOT EXISTS fpe_obra_actas_project_idx ON public.fpe_obra_actas(project_id);
CREATE INDEX IF NOT EXISTS fpe_obra_actas_session_idx ON public.fpe_obra_actas(session_id);

-- ── 5. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.fpe_obra_change_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_obra_change_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_obra_actas           ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'fpe_obra_change_sessions',
      'fpe_obra_change_log',
      'fpe_obra_actas'
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

NOTIFY pgrst, 'reload schema';

-- ── Verificación ─────────────────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'fpe_obra_change_sessions',
    'fpe_obra_change_log',
    'fpe_obra_actas'
  )
ORDER BY table_name;
