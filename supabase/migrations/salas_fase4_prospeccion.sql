-- Salas · fase 4: prospección (dossier personalizado por lead en formaprima.es/para/<token>).
--   · Una sala de tipo 'prospeccion' no sirve una propuesta: sirve el dossier del
--     estudio para un perfil (developer o constructora).
--   · Cada lead lleva su enlace personal (token, sin PIN), su logo, su idioma y
--     el seguimiento comercial (enviado, descartado).

alter table public.sala_salas add column if not exists tipo text not null default 'propuesta';
alter table public.sala_salas add column if not exists perfil text;
do $$ begin
  alter table public.sala_salas add constraint sala_salas_tipo_chk check (tipo in ('propuesta', 'prospeccion'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sala_salas add constraint sala_salas_perfil_chk check (perfil is null or perfil in ('developer', 'constructora'));
exception when duplicate_object then null; end $$;

alter table public.sala_leads add column if not exists token         text;
alter table public.sala_leads add column if not exists cargo         text;
alter table public.sala_leads add column if not exists pais          text;
alter table public.sala_leads add column if not exists idioma        text not null default 'es';
alter table public.sala_leads add column if not exists tratamiento   text not null default 'tu';
alter table public.sala_leads add column if not exists mensaje       text;          -- línea personal de quien lo envía
alter table public.sala_leads add column if not exists logo_path     text;          -- carpeta en el bucket salas-logos
alter table public.sala_leads add column if not exists logo_modo     text not null default 'blanco';
alter table public.sala_leads add column if not exists enviado_en    timestamptz;
alter table public.sala_leads add column if not exists descartado_en timestamptz;
create unique index if not exists sala_leads_token_key on public.sala_leads (token) where token is not null;
do $$ begin
  alter table public.sala_leads add constraint sala_leads_idioma_chk check (idioma in ('es', 'en'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sala_leads add constraint sala_leads_tratamiento_chk check (tratamiento in ('tu', 'usted'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sala_leads add constraint sala_leads_logo_modo_chk check (logo_modo in ('blanco', 'original'));
exception when duplicate_object then null; end $$;

-- Las dos salas de prospección. Abiertas al equipo (no confidenciales): son las
-- que se asignan a business development.
insert into public.sala_salas (slug, nombre, acceso_anonimo, activa, confidencial, tipo, perfil) values
  ('estudio-developers',    'Estudio · Developers',    false, true, false, 'prospeccion', 'developer'),
  ('estudio-constructoras', 'Estudio · Constructoras', false, true, false, 'prospeccion', 'constructora')
on conflict (slug) do nothing;

-- Logos de los leads: privados (solo los sirve el servidor a quien tiene el enlace).
insert into storage.buckets (id, name, public) values ('salas-logos', 'salas-logos', false)
on conflict (id) do update set public = false;

notify pgrst, 'reload schema';
