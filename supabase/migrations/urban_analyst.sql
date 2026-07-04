-- Urban Analyst — Análisis urbanístico preliminar de activos en Madrid
-- App interna: /team/apps/urban-analyst (solo fp_partner)
--
-- Todas las tablas se leen/escriben solo vía service_role (Server Actions / API routes):
-- RLS habilitado sin políticas. El bucket 'urban-analyst' recibe subidas desde el
-- navegador (authenticated), por eso sí necesita políticas en storage.objects.

-- ── Activos ──────────────────────────────────────────────────────────────────
create table if not exists public.urban_assets (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  direccion         text,
  refcat            text,                     -- referencia catastral de parcela (14 chars)
  lat               double precision,
  lng               double precision,
  parcel_geometry   jsonb,                    -- GeoJSON Polygon/MultiPolygon (WGS84)
  parcel_area       numeric,                  -- m² suelo (Catastro, oficial)
  built_area        numeric,                  -- m² construidos (Catastro, inferido)
  cadastral_use     text,                     -- uso principal según Catastro
  year_built        int,
  num_inmuebles     int,
  num_viviendas     int,
  -- Datos de la operación (intake)
  tipo_operacion    text,                     -- compra / reforma / cambio de uso / remonte...
  uso_actual        text,
  uso_objetivo      text,
  superficie_comercial numeric,               -- m² según dossier comercial (para detectar discrepancias)
  precio_compra     numeric,
  capex_estimado    numeric,
  notas             text,
  -- Resultado del cruce urbanístico
  norma_zonal       text,                     -- ej. '1.3'
  norma_zonal_denominacion text,              -- ej. 'ZONA 1 GRADO 3º'
  -- Estado del pipeline de análisis
  status            text not null default 'pendiente'
                    check (status in ('pendiente','analizando','completado','error')),
  pipeline          jsonb not null default '[]'::jsonb,  -- pasos [{key,label,status,detail}]
  error_msg         text,
  analyzed_at       timestamptz,
  created_by        uuid,
  created_at        timestamptz not null default now()
);

-- ── Capas urbanísticas intersectadas (evidencia bruta) ───────────────────────
create table if not exists public.urban_layer_hits (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references public.urban_assets(id) on delete cascade,
  categoria   text not null,                  -- norma_zonal | proteccion | ambito | planeamiento | uso_suelo | bic | arqueologia | analisis_edificacion | condiciones | otros
  service     text not null,                  -- ej. DESARROLLO_URBANO_ACTUALIZADO/NORMAS_ZONALES
  layer_id    int,
  layer_name  text,
  attributes  jsonb not null default '{}'::jsonb,
  source_url  text,
  legal_value boolean not null default false, -- los visores carecen de valor jurídico
  fetched_at  timestamptz not null default now()
);
create index if not exists urban_layer_hits_asset_idx on public.urban_layer_hits (asset_id);

-- ── Red flags detectadas (motor de reglas determinista) ──────────────────────
create table if not exists public.urban_red_flags (
  id            uuid primary key default gen_random_uuid(),
  asset_id      uuid not null references public.urban_assets(id) on delete cascade,
  categoria     text not null,                -- patrimonio | ambito | uso | edificabilidad | datos | administrativo
  severidad     text not null check (severidad in ('baja','media','alta','critica')),
  titulo        text not null,
  descripcion   text,
  recomendacion text,
  fuente        text,
  created_at    timestamptz not null default now()
);
create index if not exists urban_red_flags_asset_idx on public.urban_red_flags (asset_id);

-- ── Resultados de análisis (ficha IA, edificabilidad, memo) ──────────────────
create table if not exists public.urban_analysis (
  id        uuid primary key default gen_random_uuid(),
  asset_id  uuid not null references public.urban_assets(id) on delete cascade,
  kind      text not null,                    -- edificabilidad | memo
  content   jsonb not null,
  model     text,
  created_at timestamptz not null default now()
);
create index if not exists urban_analysis_asset_idx on public.urban_analysis (asset_id);

-- ── Escenarios de inversión ───────────────────────────────────────────────────
create table if not exists public.urban_scenarios (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references public.urban_assets(id) on delete cascade,
  nombre      text not null,
  tipo        text not null,                  -- reforma | cambio_uso | segregacion | remonte | ampliacion | obra_nueva | hotel | coliving | turistico | terciario
  descripcion text,
  resultado   jsonb,                          -- {viabilidad, riesgos, procedimiento, documentacion, red_flags, proximos_pasos...}
  status      text not null default 'pendiente'
              check (status in ('pendiente','generando','completado','error')),
  model       text,
  created_at  timestamptz not null default now()
);
create index if not exists urban_scenarios_asset_idx on public.urban_scenarios (asset_id);

-- ── Chat contextualizado al activo ────────────────────────────────────────────
create table if not exists public.urban_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references public.urban_assets(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists urban_chat_asset_idx on public.urban_chat_messages (asset_id, created_at);

-- ── Documentos del activo (nota simple, dossier, planos...) ───────────────────
create table if not exists public.urban_documents (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references public.urban_assets(id) on delete cascade,
  nombre      text not null,
  tipo        text,                           -- nota_simple | ficha_catastral | dossier | plano | tasacion | otro
  file_url    text not null,
  parsed_text text,                           -- texto extraído (para el chat)
  created_at  timestamptz not null default now()
);
create index if not exists urban_documents_asset_idx on public.urban_documents (asset_id);

-- ── Normas zonales PGOUM 1997 (tabla curada y editable) ──────────────────────
-- Los NOMBRES están verificados contra el Compendio de NNUU del PGOUM 97.
-- Los parámetros numéricos (coeficientes, alturas) se dejan NULL hasta que el
-- equipo los verifique norma a norma / grado a grado: el motor de cálculo marca
-- "requiere verificación" cuando faltan. verificado=true solo tras revisión manual.
create table if not exists public.urban_normas_zonales (
  codigo              text primary key,       -- '1', '3', '4.1'... admite grados
  nombre              text not null,
  tipologia           text,
  uso_cualificado     text,
  coef_edificabilidad numeric,                -- m²c/m²s — NULL = no verificado
  altura_max_plantas  int,
  condiciones         text,                   -- resumen de condiciones de edificación
  notas               text,
  verificado          boolean not null default false,
  fuente              text default 'Compendio NNUU PGOUM 1997 (carácter informativo)',
  updated_at          timestamptz not null default now()
);

insert into public.urban_normas_zonales (codigo, nombre, tipologia, notas) values
  ('1',  'Protección del Patrimonio Histórico',  'Edificación entre medianeras en casco histórico', 'Condiciones muy restrictivas: obras según nivel de catálogo, fondos y patios específicos. La edificabilidad NO se calcula por coeficiente: depende de la edificación existente y del grado.'),
  ('2',  'Protección de Colonias Históricas',    'Colonias de vivienda unifamiliar o bloques protegidos', 'Volumetría y parcelación originales protegidas. Ampliaciones muy limitadas.'),
  ('3',  'Volumetría específica',                'Edificación con volumetría definida por el planeamiento que la originó', 'La edificabilidad es la del volumen existente/definido: no aplica coeficiente genérico. Revisar planeamiento de origen.'),
  ('4',  'Edificación en manzana cerrada',       'Manzana cerrada con patio', 'Edificabilidad regulada por fondo máximo edificable y altura según ancho de calle (grados 1º a 3º).'),
  ('5',  'Edificación en bloques abiertos',      'Bloque abierto', 'Edificabilidad por coeficiente sobre parcela según grado. Verificar grado en plano de ordenación.'),
  ('6',  'Edificación en cascos anexionados',    'Casco tradicional de los municipios anexionados', 'Alturas y fondos reducidos, parcelación menuda.'),
  ('7',  'Edificación en baja densidad',         'Edificación aislada o adosada de baja densidad', 'Coeficiente de edificabilidad y ocupación según grado.'),
  ('8',  'Edificación en vivienda unifamiliar',  'Vivienda unifamiliar aislada/pareada/adosada', 'Coeficiente, ocupación y retranqueos según grado. Posibilidad de división según parcela mínima.'),
  ('9',  'Actividades económicas',               'Industrial / terciario', 'Uso cualificado actividades económicas; compatibilidad residencial muy limitada.'),
  ('10', 'Ejes terciarios',                      'Edificación en ejes de uso terciario', 'Uso cualificado terciario; condiciones específicas por eje.'),
  ('11', 'Remodelación',                         'Áreas de remodelación con ordenación propia', 'Ordenación remitida a su planeamiento de remodelación.')
on conflict (codigo) do nothing;

-- ── RLS: solo service_role ────────────────────────────────────────────────────
alter table public.urban_assets          enable row level security;
alter table public.urban_layer_hits     enable row level security;
alter table public.urban_red_flags      enable row level security;
alter table public.urban_analysis       enable row level security;
alter table public.urban_scenarios      enable row level security;
alter table public.urban_chat_messages  enable row level security;
alter table public.urban_documents      enable row level security;
alter table public.urban_normas_zonales enable row level security;

-- ── Storage: bucket para documentos del activo ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('urban-analyst', 'urban-analyst', true)
on conflict (id) do update set public = true;

drop policy if exists "urban_analyst_insert" on storage.objects;
create policy "urban_analyst_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'urban-analyst');

drop policy if exists "urban_analyst_select" on storage.objects;
create policy "urban_analyst_select" on storage.objects
  for select to public
  using (bucket_id = 'urban-analyst');

drop policy if exists "urban_analyst_delete" on storage.objects;
create policy "urban_analyst_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'urban-analyst');

notify pgrst, 'reload schema';
