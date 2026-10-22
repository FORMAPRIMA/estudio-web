-- Salas · fase 6: correo de presentación adaptado con IA, por lead.
-- Quien envía da contexto del lead; la IA adapta el correo base y el resultado
-- (editable) queda guardado en el lead para copiarlo cuando se quiera.

alter table public.sala_leads add column if not exists correo_contexto text;
alter table public.sala_leads add column if not exists correo_asunto text;
alter table public.sala_leads add column if not exists correo_cuerpo text;
alter table public.sala_leads add column if not exists correo_ia_en timestamptz;

notify pgrst, 'reload schema';
