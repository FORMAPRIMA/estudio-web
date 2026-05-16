-- ══════════════════════════════════════════════════════════════════════════════
-- FPE — Portal lockdown
-- Refina la visibilidad del portal externo de licitación para que cada partner
-- sólo vea documentos, partidas y preguntas relevantes a su scope.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. fpe_documents.chapter_id ─────────────────────────────────────────────
-- La columna se usa en el upload (app/api/fpe-documents/upload/route.ts) y en
-- el DocumentHub interno pero no estaba declarada en el schema base. Defensivo:
ALTER TABLE public.fpe_documents
  ADD COLUMN IF NOT EXISTS chapter_id uuid
    REFERENCES public.fpe_template_chapters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fpe_documents_chapter
  ON public.fpe_documents(chapter_id)
  WHERE chapter_id IS NOT NULL;

-- ── 2. fpe_tender_questions.project_unit_id ─────────────────────────────────
-- Permite asociar cada pregunta a una unidad concreta del scope del partner.
-- NULL = pregunta general sobre el proyecto (se ve por todos los invitados).
ALTER TABLE public.fpe_tender_questions
  ADD COLUMN IF NOT EXISTS project_unit_id uuid
    REFERENCES public.fpe_project_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fpe_tender_questions_unit
  ON public.fpe_tender_questions(project_unit_id)
  WHERE project_unit_id IS NOT NULL;

-- Schema cache reload (Supabase / PostgREST)
NOTIFY pgrst, 'reload schema';
