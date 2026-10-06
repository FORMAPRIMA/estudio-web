-- Salas de dossier · fase 1: PIN por lead y medición por diapositiva.
-- Una sala = un dossier de /propuesta/<slug> con leads identificados por PIN.
-- El contenido del dossier sigue en lib/propuestas/registro.ts; aquí solo los
-- accesos y la analítica. Solo vía service_role (RLS sin políticas).
-- Nada de esto lo lee el área interna (/team): es la "burbuja" de Salas.

create table if not exists public.sala_salas (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,            -- slug del dossier en registro.ts
  nombre         text not null,
  acceso_anonimo boolean not null default true,   -- false = el enlace genérico también pide PIN
  activa         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.sala_leads (
  id                 uuid primary key default gen_random_uuid(),
  sala_id            uuid not null references public.sala_salas(id) on delete cascade,
  pin                text not null check (pin ~ '^[0-9]{6}$'),
  nombre             text not null,
  empresa            text,
  email              text,
  telefono           text,
  canal              text,                        -- agencia, red, evento…
  notas              text,
  estado             text not null default 'activo' check (estado in ('activo', 'revocado')),
  caduca_en          timestamptz,
  creado_por         uuid,                        -- sala_miembros (fase 2)
  lead_captacion_id  uuid,                        -- leads.id si deja sus datos al final
  created_at         timestamptz not null default now(),
  unique (sala_id, pin)
);

create table if not exists public.sala_sesiones (
  id             uuid primary key default gen_random_uuid(),
  sala_id        uuid not null references public.sala_salas(id) on delete cascade,
  lead_id        uuid references public.sala_leads(id) on delete set null,  -- null = anónima
  inicio         timestamptz not null default now(),
  ultima         timestamptz not null default now(),
  activo_ms      integer not null default 0,      -- tiempo con la pestaña visible y en uso
  dispositivo    text,
  ciudad         text,
  region         text,
  pais           text,
  lat            numeric(5,1),                    -- de la ciudad, redondeado (~10 km)
  lon            numeric(5,1),
  ip_trunc       text,                            -- IPv4 /24 · IPv6 /48
  max_slide      integer not null default 0,
  total_slides   integer not null default 0,
  final          boolean not null default false
);
create index if not exists sala_sesiones_sala_idx on public.sala_sesiones (sala_id, inicio desc);
create index if not exists sala_sesiones_lead_idx on public.sala_sesiones (lead_id, inicio desc);

-- Tiempo por diapositiva y sesión (mapa de calor).
create table if not exists public.sala_vistas (
  sesion_id  uuid not null references public.sala_sesiones(id) on delete cascade,
  slide      integer not null,
  etiqueta   text,
  ms         integer not null default 0,
  entradas   integer not null default 0,
  primera    timestamptz not null default now(),
  primary key (sesion_id, slide)
);

-- Interacciones: vídeo, idioma, me interesa, final…
create table if not exists public.sala_eventos (
  id         bigint generated always as identity primary key,
  sesion_id  uuid not null references public.sala_sesiones(id) on delete cascade,
  tipo       text not null,
  slide      integer,
  detalle    text,
  at         timestamptz not null default now()
);
create index if not exists sala_eventos_sesion_idx on public.sala_eventos (sesion_id, at);

alter table public.sala_salas    enable row level security;
alter table public.sala_leads    enable row level security;
alter table public.sala_sesiones enable row level security;
alter table public.sala_vistas   enable row level security;
alter table public.sala_eventos  enable row level security;

-- Suma atómica de un lote de la baliza: [{s, l, ms, e}] (s = diapositiva,
-- l = etiqueta, ms = tiempo activo, e = entradas). Varias pestañas o balizas
-- solapadas no se pisan.
create or replace function public.sala_sumar_vistas(p_sesion uuid, p_vistas jsonb, p_activo_ms integer)
returns void language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  for v in select * from jsonb_array_elements(coalesce(p_vistas, '[]'::jsonb)) loop
    insert into sala_vistas (sesion_id, slide, etiqueta, ms, entradas)
    values (p_sesion, (v->>'s')::int, left(v->>'l', 80),
            least(greatest(coalesce((v->>'ms')::int, 0), 0), 600000),
            least(greatest(coalesce((v->>'e')::int, 0), 0), 50))
    on conflict (sesion_id, slide) do update
      set ms = sala_vistas.ms + excluded.ms,
          entradas = sala_vistas.entradas + excluded.entradas,
          etiqueta = coalesce(excluded.etiqueta, sala_vistas.etiqueta);
  end loop;
  update sala_sesiones
     set activo_ms = activo_ms + least(greatest(coalesce(p_activo_ms, 0), 0), 600000),
         ultima = now()
   where id = p_sesion;
end $$;
revoke all on function public.sala_sumar_vistas(uuid, jsonb, integer) from public, anon, authenticated;

-- Piloto: Casa Zurbano (sigue siendo público; los PINs identifican a los leads).
insert into public.sala_salas (slug, nombre, acceso_anonimo)
values ('casa-zurbano-xzw9e', 'Casa Zurbano', true)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
