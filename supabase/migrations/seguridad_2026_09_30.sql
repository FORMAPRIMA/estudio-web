-- ═══════════════════════════════════════════════════════════════════════════
-- Seguridad · auditoría del 30 sep 2026
-- Ejecutar en Supabase → SQL Editor (proyecto de estudio-web). Idempotente.
-- Además de esto: Authentication → Sign In / Providers → Email →
-- desactivar "Allow new users to sign up" (el equipo se da de alta desde
-- /team/equipo con admin.createUser, que no depende de ese interruptor).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) El rol de un usuario nuevo NUNCA sale de los datos que envía él.
--    Antes: coalesce(raw_user_meta_data->>'rol', 'cliente'). Con el registro
--    abierto, cualquiera podía darse de alta como fp_partner y entrar a /team.
--    El alta del equipo (app/actions/equipo.ts) fija el rol después con un
--    upsert en profiles, así que no se ve afectada.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    new.email,
    'cliente'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 2) Funciones RPC que modifican datos: fuera del rol anónimo.
--    remove_proyecto_render se podía ejecutar sin sesión con la clave pública.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('remove_proyecto_render', 'append_proyecto_render')
  loop
    execute format('revoke execute on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated, service_role', f.firma);
  end loop;
end $$;

-- 3) Nóminas: el bucket pasa a privado. La app solo las sirve con URL firmada
--    (getNominaSignedUrl, con comprobación de dueño) y sube con el cliente de
--    servicio, así que nada depende de que sea público.
update storage.buckets set public = false where id = 'nominas';

-- 4) Nadie sin sesión puede LISTAR buckets con documentos. Hoy, con la clave
--    pública, se podía enumerar y descargar todo expense-scans (gastos y
--    facturas) y portal (documentos de clientes). Las políticas SELECT que
--    abren estos buckets a public/anon pasan a ser solo de usuarios con sesión.
--    (Las URL públicas ya repartidas siguen funcionando: los buckets públicos
--    sirven /object/public/... sin pasar por estas políticas. Siguiente paso
--    recomendado: pasar expense-scans y portal a privados con URL firmadas.)
do $$
declare pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('SELECT', 'ALL')
      and (roles @> array['public']::name[] or roles @> array['anon']::name[])
      and coalesce(qual, '') ~ '(expense-scans|portal|nominas|mejoras|urban-analyst|avatares|dd-visits|proyecto-planos|proyecto-renders|proyecto-imagenes)'
  loop
    execute format('alter policy %I on storage.objects to authenticated', pol.policyname);
    raise notice 'Política % → solo authenticated', pol.policyname;
  end loop;
end $$;

-- Comprobación: debería devolver 0 filas.
select policyname, roles, qual
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (roles @> array['public']::name[] or roles @> array['anon']::name[])
  and coalesce(qual, '') ~ '(expense-scans|portal|nominas)';
