-- Showroom 3D — maquetas (modelos GLB) del estudio.
-- App interna /team/apps/showroom-3d (todos los roles FP).
-- Primera prueba; futura base del "showroom virtual" del sitio público.
--
-- La tabla se lee/escribe solo vía service_role (Server Actions): RLS sin políticas.
-- Los archivos .glb se suben desde el navegador (authenticated) al bucket público
-- 'modelos-3d', por eso ese bucket sí necesita políticas en storage.objects.

create table if not exists public.modelos_3d (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  proyecto    text,
  descripcion text,
  glb_url     text not null,
  poster_url  text,
  file_size   bigint,
  created_at  timestamptz not null default now()
);

create index if not exists modelos_3d_created_at_idx on public.modelos_3d (created_at desc);

alter table public.modelos_3d enable row level security;
-- Sin políticas: solo service_role (que bypassa RLS) puede leer/escribir.

-- ── Storage: bucket público para los .glb ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('modelos-3d', 'modelos-3d', true)
on conflict (id) do update set public = true;

-- Subida desde el navegador (usuarios autenticados FP)
drop policy if exists "modelos_3d_insert" on storage.objects;
create policy "modelos_3d_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'modelos-3d');

-- Lectura pública (bucket público) y borrado por usuarios autenticados
drop policy if exists "modelos_3d_select" on storage.objects;
create policy "modelos_3d_select" on storage.objects
  for select to public
  using (bucket_id = 'modelos-3d');

drop policy if exists "modelos_3d_delete" on storage.objects;
create policy "modelos_3d_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'modelos-3d');

notify pgrst, 'reload schema';
