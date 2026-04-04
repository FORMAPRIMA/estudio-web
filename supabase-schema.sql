-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  nombre text not null,
  email text not null,
  rol text not null check (rol in ('cliente', 'empleado')),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Clientes table
create table public.clientes (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  email text not null unique,
  empresa text,
  telefono text,
  created_at timestamptz default now()
);

alter table public.clientes enable row level security;

-- Proyectos table
create table public.proyectos (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  ubicacion text not null,
  año integer not null,
  tipologia text not null,
  descripcion text,
  slug text not null unique,
  estado text not null default 'activo' check (estado in ('activo', 'en_construccion', 'finalizado')),
  cliente_id uuid references public.clientes(id),
  imagen_principal text,
  created_at timestamptz default now()
);

alter table public.proyectos enable row level security;

-- Tareas table
create table public.tareas (
  id uuid default uuid_generate_v4() primary key,
  titulo text not null,
  descripcion text,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  asignado_a uuid references auth.users(id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_progreso', 'completada')),
  fecha_limite date,
  created_at timestamptz default now()
);

alter table public.tareas enable row level security;

-- Documentos table
create table public.documentos (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  url text not null,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  subido_por uuid references auth.users(id),
  fecha timestamptz default now()
);

alter table public.documentos enable row level security;

-- Eventos table
create table public.eventos (
  id uuid default uuid_generate_v4() primary key,
  titulo text not null,
  fecha timestamptz not null,
  descripcion text,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.eventos enable row level security;

-- Propiedades table
create table public.propiedades (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  ubicacion text not null,
  precio numeric(12,2) not null,
  descripcion text,
  slug text not null unique,
  imagenes text[] default '{}',
  disponible boolean default true,
  created_at timestamptz default now()
);

alter table public.propiedades enable row level security;

-- Leads table
create table public.leads (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  email text not null,
  telefono text,
  propiedad_id uuid references public.propiedades(id),
  mensaje text,
  fecha timestamptz default now()
);

alter table public.leads enable row level security;

-- Helper function to get current user role without triggering RLS recursion
create or replace function public.get_my_rol()
returns text as $$
  select rol from public.profiles where id = auth.uid()
$$ language sql security definer stable;

-- RLS Policies

-- Profiles: users can read their own profile, employees can read all
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Employees can view all profiles" on public.profiles
  for select using (public.get_my_rol() = 'empleado');

-- Proyectos: clients see only their projects, employees see all
create policy "Employees can manage all proyectos" on public.proyectos
  for all using (public.get_my_rol() = 'empleado');

create policy "Clients can view own proyectos" on public.proyectos
  for select using (
    exists (
      select 1 from public.clientes c
      join public.profiles p on p.email = c.email
      where c.id = proyectos.cliente_id and p.id = auth.uid()
    )
  );

-- Tareas: only employees
create policy "Employees can manage tareas" on public.tareas
  for all using (public.get_my_rol() = 'empleado');

-- Documentos: employees can manage, clients can view their project docs
create policy "Employees can manage documentos" on public.documentos
  for all using (public.get_my_rol() = 'empleado');

create policy "Clients can view own project documentos" on public.documentos
  for select using (
    exists (
      select 1 from public.proyectos pr
      join public.clientes c on c.id = pr.cliente_id
      join public.profiles p on p.email = c.email
      where pr.id = documentos.proyecto_id and p.id = auth.uid()
    )
  );

-- Eventos: employees can manage
create policy "Employees can manage eventos" on public.eventos
  for all using (public.get_my_rol() = 'empleado');

-- Propiedades: public read
create policy "Anyone can view propiedades" on public.propiedades
  for select using (true);

create policy "Employees can manage propiedades" on public.propiedades
  for all using (public.get_my_rol() = 'empleado');

-- Leads: public insert, employees can view
create policy "Anyone can create leads" on public.leads
  for insert with check (true);

create policy "Employees can view leads" on public.leads
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and rol = 'empleado'
    )
  );

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'rol', 'cliente')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── MIGRATION: Role system update + Time Tracker tables ──────────────────
-- Run this after the initial schema if already deployed,
-- or it is included automatically on a fresh run.

-- Update profiles rol constraint to use new roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('cliente', 'fp_team', 'fp_manager', 'fp_partner'));

-- Update existing RLS policies that referenced 'empleado'
DROP POLICY IF EXISTS "Employees can view all profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Employees can manage all proyectos" ON public.proyectos;
DROP POLICY IF EXISTS "Employees can manage tareas"        ON public.tareas;
DROP POLICY IF EXISTS "Employees can manage documentos"    ON public.documentos;
DROP POLICY IF EXISTS "Employees can manage eventos"       ON public.eventos;
DROP POLICY IF EXISTS "Employees can manage propiedades"   ON public.propiedades;
DROP POLICY IF EXISTS "Employees can view leads"           ON public.leads;

-- Re-create policies using fp_* roles
create policy "FP staff can view all profiles" on public.profiles
  for select using (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

create policy "FP staff can manage all proyectos" on public.proyectos
  for all using (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

create policy "FP staff can manage tareas" on public.tareas
  for all using (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

create policy "FP staff can manage documentos" on public.documentos
  for all using (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

create policy "FP staff can manage eventos" on public.eventos
  for all using (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

create policy "FP staff can manage propiedades" on public.propiedades
  for all using (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

create policy "FP staff can view leads" on public.leads
  for select using (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

-- ── Helper functions ──────────────────────────────────────────────────────

create or replace function public.is_fp_manager_or_above()
returns boolean as $$
  select public.get_my_rol() in ('fp_manager', 'fp_partner')
$$ language sql security definer stable;

-- ── proyectos: add m2 column ──────────────────────────────────────────────

ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS m2 integer default 0;

-- ── fases table ───────────────────────────────────────────────────────────

create table if not exists public.fases (
  id           uuid default uuid_generate_v4() primary key,
  proyecto_id  uuid references public.proyectos(id) on delete cascade not null,
  label        text not null,
  section      text not null,
  ratio        numeric not null default 0,
  active       boolean not null default true,
  created_at   timestamptz default now()
);

alter table public.fases enable row level security;

-- fases RLS
-- All fp_* staff can read
create policy "FP staff can read fases" on public.fases
  for select using (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

-- fp_manager and fp_partner can write
create policy "FP manager+ can insert fases" on public.fases
  for insert with check (public.is_fp_manager_or_above());

create policy "FP manager+ can update fases" on public.fases
  for update using (public.is_fp_manager_or_above());

create policy "FP manager+ can delete fases" on public.fases
  for delete using (public.is_fp_manager_or_above());

-- ── time_entries table ────────────────────────────────────────────────────

create table if not exists public.time_entries (
  id                 uuid default uuid_generate_v4() primary key,
  user_id            uuid references auth.users(id) on delete cascade not null,
  fecha              date not null,
  hora_inicio        integer not null check (hora_inicio >= 6 and hora_inicio <= 22),
  horas              numeric not null default 1,
  proyecto_id        uuid references public.proyectos(id) on delete set null,
  fase_id            uuid references public.fases(id) on delete set null,
  categoria_interna  text,
  es_extra           boolean not null default false,
  notas              text,
  created_at         timestamptz default now(),
  -- Each user can have at most one entry per hour per day
  unique (user_id, fecha, hora_inicio)
);

alter table public.time_entries enable row level security;

-- time_entries RLS

-- fp_team: read/write only own entries
create policy "fp_team read own entries" on public.time_entries
  for select using (
    auth.uid() = user_id
    and public.get_my_rol() = 'fp_team'
  );

create policy "fp_team write own entries" on public.time_entries
  for insert with check (
    auth.uid() = user_id
    and public.get_my_rol() = 'fp_team'
  );

create policy "fp_team update own entries" on public.time_entries
  for update using (
    auth.uid() = user_id
    and public.get_my_rol() = 'fp_team'
  );

create policy "fp_team delete own entries" on public.time_entries
  for delete using (
    auth.uid() = user_id
    and public.get_my_rol() = 'fp_team'
  );

-- fp_manager: read ALL, write only own
create policy "fp_manager read all entries" on public.time_entries
  for select using (public.get_my_rol() = 'fp_manager');

create policy "fp_manager write own entries" on public.time_entries
  for insert with check (
    auth.uid() = user_id
    and public.get_my_rol() = 'fp_manager'
  );

create policy "fp_manager update own entries" on public.time_entries
  for update using (
    auth.uid() = user_id
    and public.get_my_rol() = 'fp_manager'
  );

create policy "fp_manager delete own entries" on public.time_entries
  for delete using (
    auth.uid() = user_id
    and public.get_my_rol() = 'fp_manager'
  );

-- fp_partner: read/write ALL
create policy "fp_partner full access entries" on public.time_entries
  for all using (public.get_my_rol() = 'fp_partner');


-- ── MIGRATION: Proyectos Module ────────────────────────────────────────────
-- Run this block in Supabase SQL editor after the initial schema.

-- Step 1: Drop old per-project fases (time_entries.fase_id referenced it)
ALTER TABLE public.time_entries
  DROP CONSTRAINT IF EXISTS time_entries_fase_id_fkey;
ALTER TABLE public.time_entries
  DROP COLUMN IF EXISTS fase_id;

DROP TABLE IF EXISTS public.fases CASCADE;

-- Step 2: Global phase catalog (14 canonical phases)
CREATE TABLE IF NOT EXISTS public.catalogo_fases (
  id     uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero integer NOT NULL UNIQUE,
  label  text    NOT NULL,
  orden  integer NOT NULL
);

ALTER TABLE public.catalogo_fases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read catalogo_fases" ON public.catalogo_fases
  FOR SELECT USING (true);

CREATE POLICY "FP manager+ manage catalogo_fases" ON public.catalogo_fases
  FOR ALL USING (public.is_fp_manager_or_above());

INSERT INTO public.catalogo_fases (numero, label, orden) VALUES
  (0,  'Fase de levantamiento',             1),
  (1,  'Plano de tasación',                 2),
  (4,  'Estado actual y distribución',      3),
  (5,  'Planos de propuesta',               4),
  (6,  'Diseño 3D (Renders)',               5),
  (7,  'Documentación escrita',             6),
  (8,  'Proyecto ejecutivo',                7),
  (9,  'Diseño 3D Ejecutivo (Renders)',     8),
  (10, 'Documentación económica',           9),
  (11, 'Dirección de obra',                10),
  (12, 'Interiorismo',                     11),
  (13, 'Diseño 3D Interiorismo (Renders)', 12),
  (14, 'Control de entrega',               13),
  (15, 'Post venta',                       14)
ON CONFLICT (numero) DO UPDATE SET label = EXCLUDED.label, orden = EXCLUDED.orden;

-- Step 3: Add new columns to proyectos (keep existing columns for public website)
ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS direccion           text,
  ADD COLUMN IF NOT EXISTS imagen_url          text,
  ADD COLUMN IF NOT EXISTS superficie_diseno   numeric,
  ADD COLUMN IF NOT EXISTS superficie_catastral numeric,
  ADD COLUMN IF NOT EXISTS superficie_util     numeric,
  ADD COLUMN IF NOT EXISTS status              text DEFAULT 'activo'
    CHECK (status IN ('activo', 'on_hold', 'terminado', 'archivado')),
  ADD COLUMN IF NOT EXISTS created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update proyectos RLS: fp_team only sees projects where they are responsable
DROP POLICY IF EXISTS "FP staff can manage all proyectos" ON public.proyectos;

CREATE POLICY "FP manager+ full access proyectos" ON public.proyectos
  FOR ALL USING (public.is_fp_manager_or_above());

-- Step 4: proyecto_fases — contracted phases per project
CREATE TABLE IF NOT EXISTS public.proyecto_fases (
  id           uuid   DEFAULT uuid_generate_v4() PRIMARY KEY,
  proyecto_id  uuid   REFERENCES public.proyectos(id) ON DELETE CASCADE NOT NULL,
  fase_id      uuid   REFERENCES public.catalogo_fases(id) NOT NULL,
  responsables uuid[] NOT NULL DEFAULT '{}',
  status       text   NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'en_progreso', 'completada', 'bloqueada')),
  UNIQUE (proyecto_id, fase_id)
);

ALTER TABLE public.proyecto_fases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fp_team read own proyecto_fases" ON public.proyecto_fases
  FOR SELECT USING (
    public.get_my_rol() = 'fp_team' AND auth.uid() = ANY(responsables)
  );

CREATE POLICY "FP manager+ full access proyecto_fases" ON public.proyecto_fases
  FOR ALL USING (public.is_fp_manager_or_above());

-- fp_team sees only projects they're responsable on (needs proyecto_fases to exist)
CREATE POLICY "fp_team read participating proyectos" ON public.proyectos
  FOR SELECT USING (
    public.get_my_rol() = 'fp_team' AND
    EXISTS (
      SELECT 1 FROM public.proyecto_fases pf
      WHERE pf.proyecto_id = proyectos.id AND auth.uid() = ANY(pf.responsables)
    )
  );

-- Step 5: plantilla_tasks — global template tasks per phase
CREATE TABLE IF NOT EXISTS public.plantilla_tasks (
  id          uuid  DEFAULT uuid_generate_v4() PRIMARY KEY,
  fase_id     uuid  REFERENCES public.catalogo_fases(id) ON DELETE CASCADE NOT NULL,
  titulo      text  NOT NULL,
  descripcion text,
  orden       integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.plantilla_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All fp_* read plantilla_tasks" ON public.plantilla_tasks
  FOR SELECT USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "FP manager+ manage plantilla_tasks" ON public.plantilla_tasks
  FOR ALL USING (public.is_fp_manager_or_above());

-- Step 6: tasks — real tasks per project
CREATE TABLE IF NOT EXISTS public.tasks (
  id             uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  codigo         text    NOT NULL UNIQUE,
  titulo         text    NOT NULL,
  descripcion    text,
  proyecto_id    uuid    REFERENCES public.proyectos(id) ON DELETE CASCADE NOT NULL,
  fase_id        uuid    REFERENCES public.catalogo_fases(id) NOT NULL,
  responsable_id uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  status         text    NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'en_progreso', 'completado', 'bloqueado')),
  orden_urgencia integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fp_team read own tasks" ON public.tasks
  FOR SELECT USING (
    public.get_my_rol() = 'fp_team' AND auth.uid() = responsable_id
  );

CREATE POLICY "fp_team update own tasks" ON public.tasks
  FOR UPDATE USING (
    public.get_my_rol() = 'fp_team' AND auth.uid() = responsable_id
  );

CREATE POLICY "FP manager+ full access tasks" ON public.tasks
  FOR ALL USING (public.is_fp_manager_or_above());

-- Step 7: Re-add fase_id to time_entries → now references proyecto_fases
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS fase_id uuid REFERENCES public.proyecto_fases(id) ON DELETE SET NULL;

-- Step 8: Storage bucket for project images
-- Run manually in Supabase dashboard → Storage → New bucket:
--   Name: proyecto-imagenes  |  Public: true


-- ── MIGRATION: Fix catalogo_fases + RLS ───────────────────────────────────
-- Run this block AFTER the Proyectos Module migration above.

-- 1. Add seccion column to catalogo_fases
ALTER TABLE public.catalogo_fases
  ADD COLUMN IF NOT EXISTS seccion text NOT NULL DEFAULT 'Sin sección';

-- 2. Clear old (wrong-numbered) rows and all dependent data
--    Safe to do at this stage — no real project data yet.
DELETE FROM public.tasks;
DELETE FROM public.proyecto_fases;
DELETE FROM public.catalogo_fases;

-- 3. Re-seed with correct numbering (0-13, sequential) + section
INSERT INTO public.catalogo_fases (numero, label, seccion, orden) VALUES
  (0,  'Fase de levantamiento',             'Anteproyecto',          1),
  (1,  'Plano de tasación',                 'Anteproyecto',          2),
  (2,  'Estado actual y distribución',      'Anteproyecto',          3),
  (3,  'Planos de propuesta',               'Anteproyecto',          4),
  (4,  'Diseño 3D (Renders)',               'Anteproyecto',          5),
  (5,  'Documentación escrita',             'Anteproyecto',          6),
  (6,  'Proyecto ejecutivo',                'Proyecto de ejecución', 7),
  (7,  'Diseño 3D Ejecutivo (Renders)',     'Proyecto de ejecución', 8),
  (8,  'Documentación económica',           'Proyecto de ejecución', 9),
  (9,  'Dirección de obra',                 'Obra',                  10),
  (10, 'Interiorismo',                      'Interiorismo',          11),
  (11, 'Diseño 3D Interiorismo (Renders)',  'Interiorismo',          12),
  (12, 'Control de entrega',                'Obra',                  13),
  (13, 'Post venta',                        'Post venta',            14)
ON CONFLICT (numero) DO UPDATE
  SET label = EXCLUDED.label, seccion = EXCLUDED.seccion, orden = EXCLUDED.orden;

-- 4. Fix RLS on proyectos — explicit USING + WITH CHECK on all policies
--    Drop ALL existing proyectos write policies to start clean.
DROP POLICY IF EXISTS "FP manager+ full access proyectos"      ON public.proyectos;
DROP POLICY IF EXISTS "FP staff can manage all proyectos"      ON public.proyectos;
DROP POLICY IF EXISTS "Employees can manage all proyectos"     ON public.proyectos;
DROP POLICY IF EXISTS "fp_team read participating proyectos"   ON public.proyectos;
DROP POLICY IF EXISTS "FP manager+ write proyectos"            ON public.proyectos;
DROP POLICY IF EXISTS "FP staff read all proyectos"            ON public.proyectos;
DROP POLICY IF EXISTS "Clients can view own proyectos"         ON public.proyectos;
DROP POLICY IF EXISTS "Clients read own proyectos"             ON public.proyectos;

-- fp_manager and fp_partner: full read + write
CREATE POLICY "fp_manager+ all proyectos" ON public.proyectos
  FOR ALL
  USING     (public.get_my_rol() IN ('fp_manager', 'fp_partner'))
  WITH CHECK (public.get_my_rol() IN ('fp_manager', 'fp_partner'));

-- fp_team: read only projects where they appear as a responsable
CREATE POLICY "fp_team select own proyectos" ON public.proyectos
  FOR SELECT
  USING (
    public.get_my_rol() = 'fp_team' AND
    EXISTS (
      SELECT 1 FROM public.proyecto_fases pf
      WHERE pf.proyecto_id = proyectos.id AND auth.uid() = ANY(pf.responsables)
    )
  );

-- Clients: read only their own project
CREATE POLICY "cliente select own proyectos" ON public.proyectos
  FOR SELECT
  USING (
    public.get_my_rol() = 'cliente' AND
    EXISTS (
      SELECT 1 FROM public.clientes c
      JOIN public.profiles p ON p.email = c.email
      WHERE c.id = proyectos.cliente_id AND p.id = auth.uid()
    )
  );

-- 5. Fix RLS on proyecto_fases (same pattern)
DROP POLICY IF EXISTS "fp_team read own proyecto_fases"            ON public.proyecto_fases;
DROP POLICY IF EXISTS "FP manager+ full access proyecto_fases"     ON public.proyecto_fases;

CREATE POLICY "fp_manager+ all proyecto_fases" ON public.proyecto_fases
  FOR ALL
  USING     (public.get_my_rol() IN ('fp_manager', 'fp_partner'))
  WITH CHECK (public.get_my_rol() IN ('fp_manager', 'fp_partner'));

CREATE POLICY "fp_team select own proyecto_fases" ON public.proyecto_fases
  FOR SELECT
  USING (
    public.get_my_rol() = 'fp_team' AND auth.uid() = ANY(responsables)
  );

-- 6. Fix RLS on tasks
DROP POLICY IF EXISTS "fp_team read own tasks"      ON public.tasks;
DROP POLICY IF EXISTS "fp_team update own tasks"    ON public.tasks;
DROP POLICY IF EXISTS "FP manager+ full access tasks" ON public.tasks;

CREATE POLICY "fp_manager+ all tasks" ON public.tasks
  FOR ALL
  USING     (public.get_my_rol() IN ('fp_manager', 'fp_partner'))
  WITH CHECK (public.get_my_rol() IN ('fp_manager', 'fp_partner'));

CREATE POLICY "fp_team select own tasks" ON public.tasks
  FOR SELECT
  USING (public.get_my_rol() = 'fp_team' AND auth.uid() = responsable_id);

CREATE POLICY "fp_team update own tasks" ON public.tasks
  FOR UPDATE
  USING     (public.get_my_rol() = 'fp_team' AND auth.uid() = responsable_id)
  WITH CHECK (public.get_my_rol() = 'fp_team' AND auth.uid() = responsable_id);

-- 7. Fix RLS on plantilla_tasks
DROP POLICY IF EXISTS "All fp_* read plantilla_tasks"      ON public.plantilla_tasks;
DROP POLICY IF EXISTS "FP manager+ manage plantilla_tasks" ON public.plantilla_tasks;

CREATE POLICY "fp_staff read plantilla_tasks" ON public.plantilla_tasks
  FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fp_manager+ all plantilla_tasks" ON public.plantilla_tasks
  FOR ALL
  USING     (public.get_my_rol() IN ('fp_manager', 'fp_partner'))
  WITH CHECK (public.get_my_rol() IN ('fp_manager', 'fp_partner'));


-- ── MIGRATION: Origen label (previo/post plataforma) ──────────────────────────
-- Tracks whether each record was created before or after the platform launch.
-- "previo_a_plataforma" → back-filled on all rows that existed at migration time.
-- "post_plataforma"     → default for every new row going forward.
-- The column is NOT surfaced in the UI; it exists for auditing/analytics only.

ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'post_plataforma';

ALTER TABLE public.proyecto_fases
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'post_plataforma';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'post_plataforma';

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'post_plataforma';

-- Back-fill: all rows created before this migration are "previo_a_plataforma"
UPDATE public.proyectos    SET origen = 'previo_a_plataforma' WHERE origen = 'post_plataforma';
UPDATE public.proyecto_fases SET origen = 'previo_a_plataforma' WHERE origen = 'post_plataforma';
UPDATE public.tasks        SET origen = 'previo_a_plataforma' WHERE origen = 'post_plataforma';
UPDATE public.time_entries SET origen = 'previo_a_plataforma' WHERE origen = 'post_plataforma';

