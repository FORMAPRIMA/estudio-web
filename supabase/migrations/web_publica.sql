-- Web pública — recursos gráficos del teaser "Work in Progress" de formaprima.es
-- Página: /wip  ·  Zona de control: /team/marketing/web-publica (fp_partner, fp_biz_dev).
--
-- La tabla se lee/escribe solo vía service_role (Server Actions): RLS sin políticas.
-- La lectura pública del teaser también va por service_role (Server Component), así que
-- no se necesitan grants a anon/authenticated sobre la tabla.
-- Las imágenes se suben desde el navegador (authenticated) al bucket público
-- 'web-publica', por eso ese bucket sí necesita políticas en storage.objects.

create table if not exists public.web_proyectos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  ubicacion  text,
  anio       text,
  nota       text,
  hero_url   text,
  galeria    text[] not null default '{}',
  orden      int not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists web_proyectos_orden_idx on public.web_proyectos (orden asc, created_at asc);

alter table public.web_proyectos enable row level security;
-- Sin políticas: solo service_role (que bypassa RLS) puede leer/escribir.

-- ── Seed inicial: los 5 proyectos del diseño (sin imágenes; se suben desde la zona) ──
insert into public.web_proyectos (nombre, ubicacion, anio, nota, orden)
select * from (values
  ('C6',              'Madrid, España', '2025', 'Vivienda unifamiliar',    0),
  ('L16',             'Madrid, España', '2024', 'Reforma integral',        1),
  ('CC38',            'Madrid, España', '2024', 'Interiorismo residencial',2),
  ('Lienzo Infinito', 'Casa Decor',     '2025', 'Instalación',             3),
  ('JOMO',            'Madrid, España', '2025', 'Espacio comercial',       4)
) as v(nombre, ubicacion, anio, nota, orden)
where not exists (select 1 from public.web_proyectos);

-- ── Storage: bucket público para las imágenes del teaser ────────────────────────
insert into storage.buckets (id, name, public)
values ('web-publica', 'web-publica', true)
on conflict (id) do update set public = true;

-- Subida desde el navegador (usuarios autenticados FP)
drop policy if exists "web_publica_insert" on storage.objects;
create policy "web_publica_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'web-publica');

-- Lectura pública (bucket público)
drop policy if exists "web_publica_select" on storage.objects;
create policy "web_publica_select" on storage.objects
  for select to public
  using (bucket_id = 'web-publica');

-- Borrado por usuarios autenticados
drop policy if exists "web_publica_delete" on storage.objects;
create policy "web_publica_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'web-publica');

notify pgrst, 'reload schema';
