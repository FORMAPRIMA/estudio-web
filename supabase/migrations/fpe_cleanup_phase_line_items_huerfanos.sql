-- ═══════════════════════════════════════════════════════════════════════════
-- FPE — Cleanup: phase_line_items cross-chapter huérfanos
-- ───────────────────────────────────────────────────────────────────────────
-- Motivo:
--   2 registros en fpe_template_phase_line_items vinculan una partida a una
--   fase de otro capítulo. Se originaron cuando se reorganizaron fases entre
--   capítulos (la fase cambió de chapter_id pero los links no se limpiaron).
--   El modal de edición no las muestra (filtra por capítulo) pero el contador
--   las cuenta y el bug del state fantasma las perpetúa al guardar.
--
-- A futuro este caso está blindado por:
--   - moveLineItem: detecta cambio de capítulo y limpia phase_links
--   - moveUnit:     detecta cambio de capítulo y limpia phase_links de todas
--                   las partidas de la unidad
--   - Modal de edición: filtra fantasmas defensivamente al cargar
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DELETE FROM public.fpe_template_phase_line_items
WHERE (line_item_id, phase_id) IN (
  -- "Apertura de hueco en muro de carga" (cap. Refuerzos) vinculada a
  -- "Demolición y vaciado" (cap. Demoliciones)
  ('cb7a31cd-15a4-494a-b8fa-c5445e7d44db', '85a10adf-2e7e-4dd4-9bfd-c6801da70909'),
  -- "Refuerzo de hierro para puerta corredera" (cap. Albañilería) vinculada a
  -- "Ejecución" (cap. Refuerzos)
  ('d086e178-3689-4d9c-a0d8-5ec5e372d844', '85a10adf-2e7e-4dd4-9bfd-c6801da70909')
);

-- Verificación: 0 cruces restantes (partida.capitulo != fase.capitulo)
WITH cross_chapter AS (
  SELECT pli.line_item_id, pli.phase_id
  FROM public.fpe_template_phase_line_items pli
  JOIN public.fpe_template_line_items li ON li.id = pli.line_item_id
  JOIN public.fpe_template_units u       ON u.id  = li.unit_id
  JOIN public.fpe_template_phases ph     ON ph.id = pli.phase_id
  WHERE u.chapter_id IS DISTINCT FROM ph.chapter_id
)
SELECT COUNT(*) AS cruces_restantes FROM cross_chapter;

COMMIT;
