-- ═══════════════════════════════════════════════════════════════════════════
-- Open House · Claudio Coello 38 (8 oct 2026). Idempotente.
-- Invitaciones por grupos ("paquetes"): quien reserva primero elige horario y
-- asistentes para su grupo. Solo service_role (las rutas de Next validan).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.oh_grupos (
  id                 text primary key,
  evento             text not null default 'cc38',
  nombre             text not null default '',
  exclusiva          boolean not null default false,
  reserva_slot       text,
  reserva_asistentes text[] not null default '{}',
  reserva_por        text,
  reserva_at         timestamptz,
  declinados         text[] not null default '{}',
  creado_por         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.oh_grupos add column if not exists recordatorio_at timestamptz;
create index if not exists oh_grupos_evento_slot on public.oh_grupos (evento, reserva_slot);

create table if not exists public.oh_invitados (
  id          text primary key,
  grupo_id    text not null references public.oh_grupos(id) on delete cascade,
  nombre      text not null,
  saludo      text not null default 'Estimado',
  contacto    text not null default '',
  token       text not null unique,
  abierto_at  timestamptz,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists oh_invitados_grupo on public.oh_invitados (grupo_id);

alter table public.oh_grupos enable row level security;
alter table public.oh_invitados enable row level security;
revoke all on public.oh_grupos, public.oh_invitados from anon, authenticated;
grant all on public.oh_grupos, public.oh_invitados to service_role;

-- Acciones del invitado, atómicas: un cerrojo por evento serializa las
-- reservas, así dos grupos no pueden quedarse a la vez las últimas plazas.
-- p_accion: reservar | unirse | cancelar | declinar
create or replace function public.oh_accion(
  p_token text, p_accion text, p_slot text, p_att text[],
  p_cap int, p_slots text[], p_cierre timestamptz
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_inv public.oh_invitados;
  v_g   public.oh_grupos;
  v_miembros text[];
  v_ocup int;
  v_excl int;
  v_att text[];
begin
  select * into v_inv from public.oh_invitados where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'error', 'invitacion'); end if;
  select * into v_g from public.oh_grupos where id = v_inv.grupo_id;
  perform pg_advisory_xact_lock(hashtext('oh:' || v_g.evento));
  select * into v_g from public.oh_grupos where id = v_inv.grupo_id for update;
  if now() > p_cierre then return jsonb_build_object('ok', false, 'error', 'cerrado'); end if;
  select coalesce(array_agg(id), '{}') into v_miembros from public.oh_invitados where grupo_id = v_g.id;

  if p_accion = 'reservar' then
    v_att := coalesce(p_att, '{}');
    if not (p_slot = any(p_slots)) then return jsonb_build_object('ok', false, 'error', 'horario'); end if;
    if cardinality(v_att) = 0 or not (v_inv.id = any(v_att)) or not (v_att <@ v_miembros) then
      return jsonb_build_object('ok', false, 'error', 'asistentes');
    end if;
    select coalesce(sum(case when exclusiva then p_cap else cardinality(reserva_asistentes) end), 0),
           count(*) filter (where exclusiva)
      into v_ocup, v_excl
      from public.oh_grupos where evento = v_g.evento and reserva_slot = p_slot and id <> v_g.id;
    if v_g.exclusiva then
      if v_ocup > 0 then return jsonb_build_object('ok', false, 'error', 'ocupado'); end if;
    elsif v_excl > 0 or v_ocup + cardinality(v_att) > p_cap then
      return jsonb_build_object('ok', false, 'error', 'ocupado');
    end if;
    update public.oh_grupos set
      reserva_slot = p_slot, reserva_asistentes = v_att, reserva_por = v_inv.id, reserva_at = now(),
      declinados = array(select x from unnest(declinados) x where not (x = any(v_att))),
      updated_at = now()
    where id = v_g.id;

  elsif p_accion = 'unirse' then
    if v_g.reserva_slot is null then return jsonb_build_object('ok', false, 'error', 'sin_reserva'); end if;
    if v_inv.id = any(v_g.reserva_asistentes) then return jsonb_build_object('ok', true); end if;
    select coalesce(sum(case when exclusiva then p_cap else cardinality(reserva_asistentes) end), 0)
      into v_ocup
      from public.oh_grupos where evento = v_g.evento and reserva_slot = v_g.reserva_slot and id <> v_g.id;
    if (case when v_g.exclusiva then 0 else v_ocup end) + cardinality(v_g.reserva_asistentes) + 1 > p_cap then
      return jsonb_build_object('ok', false, 'error', 'ocupado');
    end if;
    update public.oh_grupos set
      reserva_asistentes = reserva_asistentes || v_inv.id,
      declinados = array_remove(declinados, v_inv.id), updated_at = now()
    where id = v_g.id;

  elsif p_accion = 'cancelar' then
    if not (v_inv.id = any(v_g.reserva_asistentes)) then return jsonb_build_object('ok', false, 'error', 'no_incluido'); end if;
    update public.oh_grupos set reserva_slot = null, reserva_asistentes = '{}', reserva_por = null, reserva_at = null, updated_at = now()
    where id = v_g.id;

  elsif p_accion = 'declinar' then
    v_att := array_remove(v_g.reserva_asistentes, v_inv.id);
    update public.oh_grupos set
      declinados = case when v_inv.id = any(declinados) then declinados else declinados || v_inv.id end,
      reserva_asistentes = v_att,
      reserva_slot = case when cardinality(v_att) = 0 then null else reserva_slot end,
      reserva_por  = case when cardinality(v_att) = 0 then null else reserva_por end,
      reserva_at   = case when cardinality(v_att) = 0 then null else reserva_at end,
      updated_at = now()
    where id = v_g.id;

  else
    return jsonb_build_object('ok', false, 'error', 'accion');
  end if;

  return jsonb_build_object('ok', true, 'grupo', v_g.id, 'invitado', v_inv.id);
end;
$$;
revoke all on function public.oh_accion(text, text, text, text[], int, text[], timestamptz) from public, anon, authenticated;
grant execute on function public.oh_accion(text, text, text, text[], int, text[], timestamptz) to service_role;

notify pgrst, 'reload schema';
