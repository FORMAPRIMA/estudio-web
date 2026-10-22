-- Presupuestos paramétricos · fase 2: ingesta de presupuestos reales
--
-- Cada obra de referencia entra con tres cosas: la maqueta de su estado actual, el
-- programa reformado (las mismas preguntas cerradas del cuestionario, guardadas en
-- pp_obra_mediciones) y el presupuesto del constructor desglosado en partidas. Cada
-- partida se reparte entre las partes de las fichas (código de parte, %). Los
-- ratios de la obra (€ por unidad de cada parte) se congelan con la versión de
-- fichas con la que se calcularon, para poder recalcularlos si una fórmula cambia.

-- ── Obra: maqueta, versión de fichas y resultado de la extracción ───────────

alter table public.pp_obras
  add column if not exists maqueta              jsonb,      -- ModeloEstadoActual con visto bueno
  add column if not exists maqueta_imagen_path  text,       -- plano normalizado (bucket pp-presupuestos)
  add column if not exists extraccion           jsonb,      -- cabecera, capítulos del PDF, avisos y control de sumas
  add column if not exists version_fichas       text;

-- ── Partidas: lo que trae el PDF ─────────────────────────────────────────────

alter table public.pp_obra_partidas
  add column if not exists capitulo_codigo_origen text,     -- 'C02', tal cual el constructor
  add column if not exists subcapitulo_origen     text,     -- 'TABIQUERÍA DE PLADUR'
  add column if not exists pagina                 int,
  add column if not exists es_margen              boolean not null default false;  -- margen, fee o descuento: no es coste

-- ── Reparto de cada partida entre las partes de las fichas ───────────────────
-- parte = código de parte ('alb_tabiqueria'), o 'sin_desglosar:<n capítulo>' si el
-- constructor no separa, o 'fuera_ficha' (amianto, refuerzos grandes…).

create table if not exists public.pp_partida_reparto (
  partida_id  uuid not null references public.pp_obra_partidas(id) on delete cascade,
  parte       text not null,
  pct         numeric not null default 100 check (pct > 0 and pct <= 100),
  origen      text not null default 'ia' check (origen in ('ia', 'manual')),
  confianza   numeric,
  motivo      text,
  primary key (partida_id, parte)
);

-- ── Ratios de cada obra, congelados al publicar ──────────────────────────────

create table if not exists public.pp_ratios_obra (
  obra_id         uuid not null references public.pp_obras(id) on delete cascade,
  parte           text not null,
  capitulo        int  not null,
  nivel_calidad   text check (nivel_calidad in ('functional', 'select', 'master_piece')),
  cantidad        numeric not null,             -- según la ficha, con la maqueta y el programa de la obra
  medicion_constructor numeric,                 -- lo que medía el constructor, para comparar
  importe_coste   numeric not null,             -- sin margen
  factor_ine      numeric not null default 1,
  ratio           numeric,                      -- importe_coste × factor_ine / cantidad
  desglosada      boolean not null default true,
  version_fichas  text not null,
  created_at      timestamptz not null default now(),
  primary key (obra_id, parte)
);

-- ── Backtesting: la obra estimada con la base anterior, antes de entrar ──────

create table if not exists public.pp_backtest (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null references public.pp_obras(id) on delete cascade,
  capitulo      int  not null,
  estimado      numeric,
  real          numeric not null,
  n_obras_base  int  not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.pp_partida_reparto enable row level security;
alter table public.pp_ratios_obra     enable row level security;
alter table public.pp_backtest        enable row level security;

notify pgrst, 'reload schema';
