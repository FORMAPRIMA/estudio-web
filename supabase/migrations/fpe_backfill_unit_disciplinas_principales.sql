-- ═══════════════════════════════════════════════════════════════════════════
-- FPE — Backfill principal_discipline_id en fpe_template_units
-- ───────────────────────────────────────────────────────────────────────────
-- Motivo:
--   44 unidades quedaron con principal_discipline_id = NULL al cargarse en
--   lote el 2026-05-03. En la tab "Documentos" del proyecto FPE el filtro
--   de partners cruza esta columna con fpe_partner_disciplines y, al estar
--   null, ningún partner aparece como capaz de cubrir la unidad.
--
-- Criterio de asignación (revisado uno a uno como director de obra):
--   - Acabados cerámicos     → Solador y alicatador
--   - Pavimento de madera    → Instalador de tarima
--   - Pavimentos continuos   → Albañilería
--   - Enlucidos y revoques   → Albañilería
--   - Fontanería + sistemas hidrónicos (calefacción individual, central
--     y suelo radiante)      → Fontanería (lo lleva el fontanero-calefactor)
--   - A/C (líneas frigoríficas) → Climatización
--   - Ventilación            → Ventilación
--   - Electricidad + Telecom → Electricidad
--   - Iluminación            → Proveedor de iluminación
--   - Domótica               → Equipamiento domótica
--   - Sonido                 → Equipamiento de sonido
--
-- Seguridad:
--   Cada UPDATE incluye `AND principal_discipline_id IS NULL` para que sea
--   idempotente y nunca sobrescriba una asignación ya existente.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Albañilería (2 unidades) ──────────────────────────────────────────────
UPDATE public.fpe_template_units
SET principal_discipline_id = '188ca17e-eab3-47a6-983d-3961a39d810b',
    updated_at = now()
WHERE id IN (
  '2f3ef4e9-340c-404b-8aea-5700345ccd60', -- ALBAÑILERÍA → Enlucidos y revoques
  '8191df40-3ea7-4855-8ad1-0c60aa9718b3'  -- ACABADOS    → Pavimentos continuos
) AND principal_discipline_id IS NULL;

-- ── Fontanería (15 unidades: saneamiento + sistemas hidrónicos) ───────────
UPDATE public.fpe_template_units
SET principal_discipline_id = '4601e87d-312b-4e03-9773-c2f71044b3a0',
    updated_at = now()
WHERE id IN (
  -- INSTALACIONES - FONTANERÍA Y SANEAMIENTO
  'ff7f64eb-11bf-44d1-9674-f5cd6b54d940', -- Equipos
  '402031ec-7217-49cb-9613-b04a17af29aa', -- Red de fontanería
  'c81e506b-79e2-4a3f-bbd0-5f08aa4cbbd2', -- Red de saneamiento
  'f0fa2104-9184-405f-ba15-ea1012b97bba', -- Mano de obra e instalación
  -- CALEFACCIÓN INDIVIDUAL
  'c8807e61-3a6c-4519-96ec-0d1a0543a8d0', -- Equipo de generación
  '047a8626-6a40-46da-a49b-631c3afda937', -- Equipo emisor
  'aa4e19f8-d044-48cf-b3e0-5f70e1a2ba1c', -- Material y distribución
  '44a63bb5-b650-4107-84c8-f141183be3bc', -- Mano de obra e instalación
  -- CALEFACCIÓN CENTRAL
  '3b1a5dbe-5a94-4310-afb6-f4d41268938c', -- Equipo emisor
  '37f656c0-6567-4879-9f66-ec198770bc2a', -- Material y distribución
  '03b0579a-5d93-40ea-b8d4-5edab4d94c7d', -- Mano de obra e instalación
  -- SUELO RADIANTE
  '1a1432c6-f629-4262-8b82-0a93658c7af9', -- Equipo de generación
  '4a64b339-ebfa-4f44-9c9f-c283ff4fddd9', -- Sistema emisor
  '0d44c289-5879-44bb-b993-5204bd38eca0', -- Material y distribución
  'bde9bd83-cc2d-4317-bee1-e5bc2162d614'  -- Mano de obra e instalación
) AND principal_discipline_id IS NULL;

-- ── Climatización (4 unidades: solo A/C) ──────────────────────────────────
UPDATE public.fpe_template_units
SET principal_discipline_id = '95f348f3-4194-4c14-afa6-c9104c497baf',
    updated_at = now()
WHERE id IN (
  'c68d86a5-8f34-4f2c-8b66-b85f98c554de', -- A/C → Equipo exterior
  'fad7532a-6fdf-49ad-85b1-bc6057feac7e', -- A/C → Equipo interior
  '83a1b6d1-a72e-4eb2-b8ec-20c6b49cbe4b', -- A/C → Material y distribución
  '6998b6b6-d2ca-4771-8fc2-f37e7daccc34'  -- A/C → Mano de obra e instalación
) AND principal_discipline_id IS NULL;

-- ── Ventilación (4 unidades) ──────────────────────────────────────────────
UPDATE public.fpe_template_units
SET principal_discipline_id = '118b6f77-ab47-4ff7-af95-f9614ac3536e',
    updated_at = now()
WHERE id IN (
  '23860abb-0f1f-44df-99e5-d63559bde79b', -- Equipos
  '6eb9e0e6-181a-43ad-96f7-647484eba90e', -- Conductos y red
  '3458e8a1-5793-413e-935a-8bd2db4736ee', -- Elementos terminales
  '17734759-4f18-46d0-8f48-71ee5f7a8220'  -- Mano de obra e instalación
) AND principal_discipline_id IS NULL;

-- ── Electricidad (7 unidades: electricidad + telecomunicaciones) ──────────
UPDATE public.fpe_template_units
SET principal_discipline_id = 'de271918-a8f3-452f-a7cb-209b300ee592',
    updated_at = now()
WHERE id IN (
  -- ELECTRICIDAD (sin Iluminación)
  'de8f304b-4958-4614-9399-2f0a086df999', -- Cuadro y protecciones
  '4168a084-56b7-4e34-afc1-b1f78fe0c185', -- Distribución y cableado
  '0929c600-b28f-4675-8649-3642fea820f0', -- Mano de obra e instalación
  -- TELECOMUNICACIONES
  'c98f6e40-1d1f-439a-bbff-c26d7996343b', -- Equipos
  'be55ed4e-e4ee-4597-9d52-5fa38208e71a', -- Red y cableado
  'de360598-7dbd-44b5-ac4b-186813a64613', -- Tomas y dispositivos terminales
  '272ae200-ef79-4388-b43b-44cbbe50ba40'  -- Mano de obra e instalación
) AND principal_discipline_id IS NULL;

-- ── Proveedor de iluminacion (1 unidad) ───────────────────────────────────
UPDATE public.fpe_template_units
SET principal_discipline_id = '41910306-02d5-4f31-b11a-59dad02f511d',
    updated_at = now()
WHERE id IN (
  'a336a51f-7032-49b9-8aa8-af23934576c1'  -- ELECTRICIDAD → Iluminación
) AND principal_discipline_id IS NULL;

-- ── Equipamiento domótica (4 unidades) ────────────────────────────────────
UPDATE public.fpe_template_units
SET principal_discipline_id = '77f9b34c-01b5-4cfd-b534-bf97ba76a41d',
    updated_at = now()
WHERE id IN (
  '28119d76-f0cf-4ba2-9dc5-5278197a22c4', -- Equipos centrales
  'a83dd31a-6902-4f72-a927-a7d7a2045045', -- Material y cableado
  'a5fdea92-17fd-4abf-8f09-b6fb97161aeb', -- Sensores e interfaces de usuario
  'fdd850e0-a848-4474-aba9-1ce7446c9fc7'  -- Mano de obra e instalación
) AND principal_discipline_id IS NULL;

-- ── Equipamiento de sonido (4 unidades) ───────────────────────────────────
UPDATE public.fpe_template_units
SET principal_discipline_id = '5ccb83e6-58ee-48e2-8f49-31838ce65d0e',
    updated_at = now()
WHERE id IN (
  '15c07b37-c779-4860-b280-c884ef0cab26', -- Equipos
  '7e5edcc6-2d7a-40ac-8daa-8a94a4106d5f', -- Material y cableado
  '234349c8-35dc-4113-b555-9ec4afd607b2', -- Altavoces y elementos visibles
  'adb4f74e-595a-4cb5-b052-1a0f21f8067e'  -- Mano de obra e instalación
) AND principal_discipline_id IS NULL;

-- ── Solador y alicatador (2 unidades) ─────────────────────────────────────
UPDATE public.fpe_template_units
SET principal_discipline_id = 'ddce83e9-5397-459b-827d-eec4949c9b7e',
    updated_at = now()
WHERE id IN (
  '48925d6a-a8b6-476b-be01-32c0c15f84db', -- ACABADOS → Pavimentos cerámicos y porcelánicos
  'ec432c2c-9967-4506-8df0-f94fe403440d'  -- ACABADOS → Revestimientos cerámicos y porcelánicos
) AND principal_discipline_id IS NULL;

-- ── Instalador de tarima (1 unidad) ───────────────────────────────────────
UPDATE public.fpe_template_units
SET principal_discipline_id = '359a4410-6540-4e89-b999-ca5080a70734',
    updated_at = now()
WHERE id IN (
  '12777e44-eb82-4017-9843-71018d715bc7'  -- ACABADOS → Pavimentos de madera y laminados
) AND principal_discipline_id IS NULL;

-- ── Verificación: cuántas unidades quedan sin disciplina ──────────────────
-- Debería devolver 0 si el backfill cubrió todo.
SELECT COUNT(*) AS unidades_sin_disciplina_restantes
FROM public.fpe_template_units
WHERE principal_discipline_id IS NULL
  AND activo = true;

COMMIT;
