-- ════════════════════════════════════════════════════════════════════════════
-- Calendario del equipo
--   · calendario_festivos  → festivos (editables por fp_partner)
--   · calendario_eventos   → vacaciones / teletrabajo / hitos del equipo
-- Acceso siempre vía service_role (createAdminClient), no se exponen al browser.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Festivos ────────────────────────────────────────────────────────────────
create table if not exists public.calendario_festivos (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null,
  nombre     text not null,
  ambito     text not null default 'local'
             check (ambito in ('nacional','autonomico','local')),
  created_at timestamptz not null default now()
);
create unique index if not exists calendario_festivos_fecha_uniq
  on public.calendario_festivos (fecha);

-- ── Eventos (vacaciones, teletrabajo, hitos) ─────────────────────────────────
create table if not exists public.calendario_eventos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete cascade,
  tipo            text not null
                  check (tipo in ('vacaciones','teletrabajo','hito')),
  alcance         text not null default 'personal'
                  check (alcance in ('personal','equipo')),
  titulo          text,
  fecha_inicio    date not null,
  fecha_fin       date not null,
  nota            text,
  visto_bueno     boolean not null default false,
  visto_bueno_por uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);
create index if not exists calendario_eventos_rango_idx
  on public.calendario_eventos (fecha_inicio, fecha_fin);
create index if not exists calendario_eventos_user_idx
  on public.calendario_eventos (user_id);

-- ── Seed: festivos Madrid capital 2026 (idempotente) ─────────────────────────
insert into public.calendario_festivos (fecha, nombre, ambito) values
  ('2026-01-01', 'Año Nuevo',                          'nacional'),
  ('2026-01-06', 'Reyes',                              'nacional'),
  ('2026-04-02', 'Jueves Santo',                       'nacional'),
  ('2026-04-03', 'Viernes Santo',                      'nacional'),
  ('2026-05-01', 'Día del Trabajo',                    'nacional'),
  ('2026-05-02', 'Día de la Comunidad de Madrid',      'autonomico'),
  ('2026-05-15', 'San Isidro',                         'local'),
  ('2026-08-15', 'Asunción de la Virgen',              'nacional'),
  ('2026-10-12', 'Fiesta Nacional de España',          'nacional'),
  ('2026-11-02', 'Todos los Santos (traslado)',        'nacional'),
  ('2026-11-09', 'Nuestra Señora de la Almudena',      'local'),
  ('2026-12-07', 'Día de la Constitución (traslado)',  'nacional'),
  ('2026-12-08', 'Inmaculada Concepción',              'nacional'),
  ('2026-12-25', 'Navidad',                            'nacional')
on conflict (fecha) do nothing;

notify pgrst, 'reload schema';
