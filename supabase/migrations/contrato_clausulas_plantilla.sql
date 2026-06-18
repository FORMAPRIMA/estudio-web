-- Plantilla de origen de las cláusulas boilerplate del contrato de servicios.
-- Editable desde /team/captacion/plantilla-contratos (solo fp_partner).
-- Los contratos nuevos snapshotean estas cláusulas en contrato.contenido.clausulas.
--
-- Acceso solo vía service_role (Server Actions). Se habilita RLS sin políticas para
-- que ni anon ni authenticated puedan tocarla desde la Data API.

create table if not exists public.contrato_clausulas_plantilla (
  key         text primary key,
  orden       integer     not null default 0,
  nivel       text        not null default 'clausula',  -- 'clausula' | 'subclausula'
  titulo_es   text        not null default '',
  titulo_en   text        not null default '',
  bloques_es  jsonb       not null default '[]'::jsonb,
  bloques_en  jsonb       not null default '[]'::jsonb,
  es_nucleo   boolean     not null default false,
  condicion   text,
  updated_at  timestamptz not null default now()
);

alter table public.contrato_clausulas_plantilla enable row level security;
-- Sin políticas: solo service_role (que bypassa RLS) puede leer/escribir.

notify pgrst, 'reload schema';
