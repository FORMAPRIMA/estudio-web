-- Retribución variable de business development (/team/marketing/retribucion).
-- Solo vía service_role (RLS activado sin políticas), como el resto del área interna.
-- El acceso a la página lo da tener un plan: fp_partner ve todos; un fp_biz_dev
-- solo entra si existe una fila suya en retribucion_planes.
-- Las reglas (tramos, coeficientes, tope) viven en lib/retribucion.ts.

create table if not exists public.retribucion_planes (
  beneficiario_id uuid primary key references public.profiles(id) on delete cascade,
  salario_base    numeric not null default 0,      -- bruto anual
  ss_pct          numeric not null default 31.5,   -- SS a cargo de la empresa
  activo          boolean not null default true,
  updated_by      uuid,
  updated_at      timestamptz not null default now()
);

create table if not exists public.retribucion_proyectos (
  id                uuid primary key default gen_random_uuid(),
  beneficiario_id   uuid not null references public.retribucion_planes(beneficiario_id) on delete cascade,
  nombre            text not null,
  origen            text not null check (origen in ('orig','react','repeat','funnel','house')),
  firma             text not null,                 -- 'AAAA-MM'
  honorarios        numeric not null default 0,    -- € sin IVA
  obra              numeric not null default 0,    -- presupuesto de obra previsto, € sin IVA
  margen_pct        numeric not null default 5,
  descuento         boolean not null default false,
  cobros_honorarios jsonb not null default '[]'::jsonb,  -- [{mes:'AAAA-MM', pct}]
  cobros_obra       jsonb not null default '[]'::jsonb,
  notas             text,
  created_by        uuid,
  updated_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists retribucion_proyectos_benef_idx
  on public.retribucion_proyectos (beneficiario_id, firma);

alter table public.retribucion_planes    enable row level security;
alter table public.retribucion_proyectos enable row level security;

-- Plan de Ana Cristina Alban (fp_biz_dev): 21.000 € brutos/año, SS 31,5 %
insert into public.retribucion_planes (beneficiario_id, salario_base, ss_pct)
values ('1e79a3b1-804c-4350-85f1-cd943f4fc88e', 21000, 31.5)
on conflict (beneficiario_id) do nothing;

notify pgrst, 'reload schema';
