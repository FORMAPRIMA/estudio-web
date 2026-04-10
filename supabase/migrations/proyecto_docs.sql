-- Documentación tab: renders gallery + planos PDF
-- Run this in Supabase SQL Editor

-- 1. Add columns to proyectos
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS renders       jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS planos_pdf_url text;

-- 2. RPC to append a render object to the array
CREATE OR REPLACE FUNCTION append_proyecto_render(
  p_proyecto_id uuid,
  p_url         text,
  p_nombre      text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE proyectos
  SET renders = renders || jsonb_build_object('url', p_url, 'nombre', p_nombre)
  WHERE id = p_proyecto_id;
$$;

-- 3. RPC to remove a render by URL
CREATE OR REPLACE FUNCTION remove_proyecto_render(
  p_proyecto_id uuid,
  p_url         text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  filtered jsonb;
BEGIN
  SELECT jsonb_agg(elem)
  INTO filtered
  FROM jsonb_array_elements(
    (SELECT renders FROM proyectos WHERE id = p_proyecto_id)
  ) elem
  WHERE elem->>'url' != p_url;

  UPDATE proyectos
  SET renders = COALESCE(filtered, '[]'::jsonb)
  WHERE id = p_proyecto_id;
END;
$$;

-- 4. Create storage buckets (run these in Supabase Dashboard › Storage, or via API)
-- Bucket: proyecto-renders  (public: true)
-- Bucket: proyecto-planos   (public: true)
