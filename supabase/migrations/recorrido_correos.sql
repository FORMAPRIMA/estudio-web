-- Correo "tu visita guiada empieza en 30 minutos" (Open House CC38).
-- Una fila por invitado y tipo de correo: el cron inserta ANTES de enviar, así
-- dos ejecuciones solapadas nunca mandan el correo dos veces.

create table if not exists public.rc_correos (
  token       text not null,
  tipo        text not null,
  enviado_at  timestamptz not null default now(),
  error       text,
  primary key (token, tipo)
);

alter table public.rc_correos enable row level security;

notify pgrst, 'reload schema';
