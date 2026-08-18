-- Web pública — Modo Diseño: estilo por bloque.
--
-- El CMS (web_content) guarda QUÉ dice cada bloque; estas dos columnas guardan
-- CÓMO se ve, ajustado con la mano desde el Studio (/team/marketing/web-publica/studio).
--
-- Nada de píxeles absolutos: `estilo` guarda PASOS sobre los tokens del sistema
-- (escala tipográfica, tracking, peso, alineación), así cualquier ajuste sigue
-- siendo responsive y no puede romper la estética del sitio. Forma:
--   { "desktop": { "escala": 2, "tracking": "wide", "peso": 300, "align": "center" },
--     "mobile":  { "escala": -1 } }
-- Móvil ESPEJA desktop y solo sobrescribe lo que trae (mismo criterio que
-- mobile_override en el contenido).
--
-- `encaje` queda reservado para la siguiente fase (recorte no destructivo de
-- imágenes: punto focal + zoom por viewport). Se añade ahora para no tener que
-- ejecutar otra migración: { "desktop": { "focal": {"x":0.5,"y":0.4}, "zoom":1.2 } }

alter table public.web_content
  add column if not exists estilo jsonb not null default '{}'::jsonb,
  add column if not exists encaje jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
