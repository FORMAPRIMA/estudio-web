-- Modelo Café Goya — CAPEX de equipamiento compartido (una sola fila).
-- Lista de equipamiento editable desde la tab CAPEX de /team/apps/modelo-cafe.
-- Solo vía service_role (RLS activado sin políticas), igual que modelo_cafe_escenarios.
-- El contenido inicial lo aporta la app (lib/modelo-cafe/capex.ts CAPEX_DEFAULT):
-- mientras no exista fila, la tab muestra esa lista por defecto; al primer
-- guardado se persiste aquí y queda compartida entre todos los partners.

create table if not exists public.modelo_cafe_capex (
  id         uuid primary key default gen_random_uuid(),
  clave      text not null unique default 'default',   -- singleton: una fila
  items      jsonb not null default '[]'::jsonb,        -- CapexItem[] (ver lib/modelo-cafe/capex.ts)
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.modelo_cafe_capex enable row level security;

notify pgrst, 'reload schema';
