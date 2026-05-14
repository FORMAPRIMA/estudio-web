-- ─────────────────────────────────────────────────────────────────────────────
-- FP Execution: documentos de planning narrativo
--
-- Versionado de los planning corporativos generados por proyecto. Cada vez que
-- se genera un planning desde el botón "Exportar planning":
--   1) Se computa la siguiente version (correlativa por proyecto)
--   2) Se llama a Claude Sonnet para redactar las narrativas
--   3) Se renderiza el PDF y se sube al bucket "fpe-planning"
--   4) Se inserta una fila en fpe_planning_documents con el snapshot del input
--      determinista (scope_snapshot) y el output narrativo (narrative_snapshot)
--
-- El bucket "fpe-planning" es privado: solo se accede a través de URLs firmadas
-- emitidas por el backend tras verificar el rol del usuario.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fpe_planning_documents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fpe_project_id      uuid        NOT NULL REFERENCES fpe_projects(id) ON DELETE CASCADE,
  version             integer     NOT NULL,
  emitted_at          timestamptz NOT NULL DEFAULT now(),
  emitted_by          uuid                 REFERENCES profiles(id) ON DELETE SET NULL,
  scope_snapshot      jsonb       NOT NULL,
  narrative_snapshot  jsonb       NOT NULL,
  pdf_storage_path    text,
  used_ai             boolean     NOT NULL DEFAULT true,
  ai_model            text,
  UNIQUE (fpe_project_id, version)
);

CREATE INDEX IF NOT EXISTS fpe_planning_documents_project_idx
  ON fpe_planning_documents (fpe_project_id, version DESC);

-- Bucket privado para los PDFs de planning
INSERT INTO storage.buckets (id, name, public)
VALUES ('fpe-planning', 'fpe-planning', false)
ON CONFLICT (id) DO UPDATE SET public = false;

NOTIFY pgrst, 'reload schema';
