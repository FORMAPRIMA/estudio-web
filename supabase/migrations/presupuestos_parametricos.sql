-- Presupuestos paramétricos — base de obras de referencia
-- App interna /team/apps/presupuestos-parametricos (fp_partner, fp_manager).
-- Tablas solo vía service_role (Server Actions): RLS activado sin políticas.
--
-- Idea: cada presupuesto REAL de constructor entra como una «obra de referencia»
-- con sus partidas (coste puro, sin márgenes ni referral fees) y con las
-- mediciones que piden las fichas de cálculo de cada capítulo. De ahí salen los
-- ratios por capítulo y nivel de calidad. El nivel (Functional/Select/
-- Masterpiece) se fija POR CAPÍTULO, no por obra.
--
-- Taxonomía: reutiliza presupuesto_capitulos / presupuesto_subcapitulos
-- (memorias_calidad_v2.sql), la misma que Warehouse y Memorias de calidades.
-- La base arranca vacía.


-- ── 1. Obras de referencia ───────────────────────────────────────────────────

create table if not exists public.pp_obras (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,                 -- «Lagasca 68»
  direccion             text,
  proyecto_id           uuid references public.proyectos(id) on delete set null,
  constructor           text,
  fecha_presupuesto     date not null,                 -- fecha del presupuesto firmado: manda el ajuste INE
  tipo_reforma          text not null default 'integral'
                          check (tipo_reforma in ('integral', 'parcial')),
  estado                text not null default 'borrador'
                          check (estado in ('borrador', 'en_revision', 'publicada', 'archivada')),
  -- Importes del documento del constructor (sin IVA). Los márgenes y fees que
  -- vengan prorrateados se quitan aquí para que la base solo guarde coste.
  importe_documento     numeric,                       -- total tal cual viene en el PDF
  descuento_margen_pct  numeric not null default 0,    -- % de margen/fee incluido en el documento (0,10 = 10 %)
  pdf_path              text,                          -- bucket pp-presupuestos
  notas                 text,
  created_by            uuid references auth.users(id) on delete set null,
  publicada_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists pp_obras_estado_idx on public.pp_obras (estado, fecha_presupuesto desc);


-- ── 2. Mediciones de la obra (las variables de las fichas) ───────────────────
-- Una fila por variable. El catálogo de variables vive en código
-- (lib/presupuestos-parametricos/variables.ts), versionado con las fichas.

create table if not exists public.pp_obra_mediciones (
  obra_id      uuid not null references public.pp_obras(id) on delete cascade,
  variable     text not null,                          -- código de variable, p. ej. 'sup_construida'
  valor_num    numeric,
  valor_texto  text,
  fuente       text not null default 'manual'
                 check (fuente in ('manual', 'ia', 'derivada')),
  nota         text,
  updated_at   timestamptz not null default now(),
  primary key (obra_id, variable)
);


-- ── 3. Capítulos de la obra: nivel de calidad y validez ──────────────────────

create table if not exists public.pp_obra_capitulos (
  obra_id             uuid not null references public.pp_obras(id) on delete cascade,
  capitulo_id         uuid not null references public.presupuesto_capitulos(id),
  nivel_calidad       text check (nivel_calidad in ('functional', 'select', 'master_piece')),
  nivel_propuesto_ia  text check (nivel_propuesto_ia in ('functional', 'select', 'master_piece')),
  justificacion_ia    text,
  incluido            boolean not null default true,   -- false = no alimenta ratios (incompleto, atípico…)
  motivo_exclusion    text,
  primary key (obra_id, capitulo_id)
);


-- ── 4. Partidas del presupuesto del constructor ──────────────────────────────

create table if not exists public.pp_obra_partidas (
  id                uuid primary key default gen_random_uuid(),
  obra_id           uuid not null references public.pp_obras(id) on delete cascade,
  capitulo_id       uuid references public.presupuesto_capitulos(id),
  subcapitulo_id    uuid references public.presupuesto_subcapitulos(id),
  codigo_origen     text,                              -- código de la partida en el PDF
  capitulo_origen   text,                              -- capítulo tal cual lo llama el constructor
  descripcion       text not null,
  unidad            text,
  medicion          numeric,
  precio_unitario   numeric,
  importe           numeric not null default 0,        -- tal cual el documento, sin IVA
  clasificacion     text not null default 'manual'
                      check (clasificacion in ('manual', 'ia', 'ia_revisada')),
  confianza_ia      numeric,                           -- 0..1
  orden             int not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists pp_obra_partidas_obra_idx on public.pp_obra_partidas (obra_id, orden);
create index if not exists pp_obra_partidas_sub_idx  on public.pp_obra_partidas (subcapitulo_id);


-- ── 5. Índice de costes de construcción (INE) ────────────────────────────────
-- Serie mensual para llevar a euros de hoy los presupuestos con más de 12 meses.
-- factor = índice(mes más reciente) / índice(mes de fecha_presupuesto).

create table if not exists public.pp_indices (
  serie       text not null default 'ine_icce_edificacion',
  periodo     date not null,                           -- día 1 del mes
  valor       numeric not null,
  provisional boolean not null default false,
  fuente_url  text,
  created_at  timestamptz not null default now(),
  primary key (serie, periodo)
);


-- ── 6. RLS y bucket ──────────────────────────────────────────────────────────

alter table public.pp_obras            enable row level security;
alter table public.pp_obra_mediciones  enable row level security;
alter table public.pp_obra_capitulos   enable row level security;
alter table public.pp_obra_partidas    enable row level security;
alter table public.pp_indices          enable row level security;

-- PDFs de constructores: privado, se sirven con URL firmada.
insert into storage.buckets (id, name, public)
values ('pp-presupuestos', 'pp-presupuestos', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
