-- Modelo Café Goya — app interna /team/apps/modelo-cafe (SOLO fp_partner).
-- Modelo financiero interactivo del quiosco → café de especialidad (Calle Goya 63, Madrid)
-- con escenarios guardados. Tabla solo vía service_role: RLS activado sin políticas.

create table if not exists public.modelo_cafe_escenarios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  notas      text,
  es_base    boolean not null default false,   -- escenario base: no se puede eliminar
  inputs     jsonb not null,                   -- supuestos del modelo (ver lib/modelo-cafe/domain.ts)
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.modelo_cafe_escenarios enable row level security;

-- Escenario base con los supuestos de partida (solo si no existe ya)
insert into public.modelo_cafe_escenarios (nombre, notas, es_base, inputs)
select
  'Escenario base',
  'Supuestos de partida: referencias de mercado de Madrid a principios de 2026. Traspaso con entrada + aplazamiento al vendedor y préstamo bancario del 65 % del desembolso inicial.',
  true,
  '{
    "dias": 26,
    "cafe_p": 2.0, "cafe_ud": 150, "cafe_c": 0.5,
    "beb_ud": 30, "beb_p": 2.5, "beb_c": 0.35,
    "bol_ud": 60, "bol_p": 2.0, "bol_c": 0.5,
    "prensa_v": 2500, "prensa_m": 0.25,
    "pub": 600,
    "tar_pct": 0.7, "tar_com": 0.012,
    "personal": 4300, "autonomo": 350, "canon": 300, "luz": 350, "gest": 150,
    "seg": 80, "mant": 150, "soft": 100, "mkt": 150, "otros": 150,
    "traspaso": 70000, "reforma": 20000, "equipo": 12000, "licencias": 4000,
    "mobiliario": 6000, "stock": 3000, "fondo": 15000,
    "entrada": 35000, "plazo": 24, "interes": 0,
    "banco_pct": 0.65, "banco_tin": 0.065, "banco_plazo": 60, "banco_comision": 0.01,
    "amort_t": 10, "amort_a": 7, "tax": 0.2, "obj": 3000
  }'::jsonb
where not exists (select 1 from public.modelo_cafe_escenarios where es_base);

notify pgrst, 'reload schema';
