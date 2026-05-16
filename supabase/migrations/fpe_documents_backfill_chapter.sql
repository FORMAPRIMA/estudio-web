-- ══════════════════════════════════════════════════════════════════════════════
-- FPE — Backfill chapter_id / project_unit_id en fpe_documents
-- Los documentos históricos quedaron con chapter_id = NULL porque la columna
-- se añadió en fpe_portal_lockdown.sql. El cliente sí enviaba el chapter_id
-- pero PostgREST lo ignoraba al no existir la columna en el momento del insert.
--
-- Inferimos el chapter_id (o project_unit_id) a partir del storage_path,
-- que sigue el patrón generado por app/api/fpe-documents/upload/route.ts:
--   General:  <project_id>/general/<ts>_<name>
--   Chapter:  <project_id>/chapters/<chapter_id>/<ts>_<name>
--   Unit:     <project_id>/units/<unit_id>/<ts>_<name>
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Backfill chapter_id desde el path ─────────────────────────────────────
UPDATE public.fpe_documents
SET chapter_id = (regexp_match(storage_path, '/chapters/([0-9a-f-]{36})/'))[1]::uuid
WHERE chapter_id IS NULL
  AND storage_path ~ '/chapters/[0-9a-f-]{36}/';

-- ── 2. Backfill project_unit_id desde el path ────────────────────────────────
UPDATE public.fpe_documents
SET project_unit_id = (regexp_match(storage_path, '/units/([0-9a-f-]{36})/'))[1]::uuid
WHERE project_unit_id IS NULL
  AND storage_path ~ '/units/[0-9a-f-]{36}/';

-- ── 3. Limpieza: si el chapter_id / project_unit_id apunta a una fila que ya
-- no existe (e.g. capítulo borrado) lo dejamos en NULL para evitar FK errors.
UPDATE public.fpe_documents d
SET chapter_id = NULL
WHERE d.chapter_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.fpe_template_chapters c WHERE c.id = d.chapter_id);

UPDATE public.fpe_documents d
SET project_unit_id = NULL
WHERE d.project_unit_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.fpe_project_units pu WHERE pu.id = d.project_unit_id);

NOTIFY pgrst, 'reload schema';
