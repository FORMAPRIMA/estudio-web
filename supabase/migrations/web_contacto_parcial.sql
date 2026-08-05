-- Captura progresiva del formulario de contacto de la web pública.
--
-- Una fila por sesión de formulario (el id lo genera el navegador y vive en
-- sessionStorage). Se escribe al salir de cada campo, así que si alguien empieza
-- a rellenar y se va, el equipo comercial conserva lo que hubiera puesto.
--
-- Criterios (decididos con Jose, jul 2026):
--   · Solo se persiste desde que hay un dato de contacto útil (email o teléfono).
--     Guardar "reforma integral" sin identidad no es un lead, es ruido.
--   · Un parcial NO dispara nada hacia fuera: ni Espacio de cliente, ni correo de
--     bienvenida. Solo entra al CRM interno y avisa a biz dev.
--   · RGPD: base jurídica de medidas precontractuales, limitada a contestar esa
--     solicitud. Se avisa en el propio formulario y se BORRA a los 30 días
--     (cron /api/cron/leads-incompletos). Nunca se usa para comunicaciones
--     comerciales sin el consentimiento explícito del envío completo.
--
-- Sin políticas RLS a propósito: solo se toca con service_role desde el servidor.

create table if not exists public.web_contacto_parcial (
  id              uuid primary key,

  -- Datos de contacto (lo que convierte el parcial en accionable).
  nombre          text,
  email           text,
  telefono        text,
  empresa         text,
  mensaje         text,

  -- Cualificación (toda opcional: se pide DESPUÉS de enviar, para no friccionar).
  servicio        text,
  ubicacion       text,
  superficie      text,
  plazo           text,
  presupuesto     text,

  idioma          text    not null default 'es',
  paso_alcanzado  int     not null default 1,
  completado      boolean not null default false,
  lead_id         uuid references public.leads(id) on delete set null,

  -- Ya se avisó a biz dev de que este parcial quedó a medias (no repetir).
  avisado         boolean not null default false,

  user_agent      text,
  ip_hash         text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.web_contacto_parcial enable row level security;

-- Los dos accesos reales: listar los que quedaron a medias y purgar antiguos.
create index if not exists idx_wcp_pendientes on public.web_contacto_parcial (completado, updated_at desc);
create index if not exists idx_wcp_created    on public.web_contacto_parcial (created_at);

notify pgrst, 'reload schema';
