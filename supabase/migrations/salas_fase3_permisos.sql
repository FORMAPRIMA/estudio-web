-- Salas de dossier · fase 3: qué salas ve cada comercial.
--   · confidencial: una sala confidencial no se puede asignar a ningún comercial
--     (las propuestas de honorarios). Toda sala nueva nace confidencial: abrirla
--     al equipo es siempre un gesto explícito de un propietario.
--   · creado_por: quien crea una sala la ve siempre, sea confidencial o no.
-- Un comercial ve: (salas asignadas y no confidenciales) + (las que ha creado).

alter table public.sala_salas add column if not exists confidencial boolean not null default true;
alter table public.sala_salas add column if not exists creado_por uuid references public.sala_miembros(id) on delete set null;

-- Las salas que ya existen son todas propuestas de honorarios: confidenciales
-- (el default ya las deja así). Si alguna estuviera asignada a un comercial, se
-- queda abierta para no cortarle el acceso.
update public.sala_salas s set confidencial = false
where exists (
  select 1 from public.sala_miembro_salas a join public.sala_miembros m on m.id = a.miembro_id
  where a.sala_id = s.id and m.rol = 'comercial'
);

notify pgrst, 'reload schema';
