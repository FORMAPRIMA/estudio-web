-- Estado de los depósitos del cliente (pagado / programado).
-- NULL = se infiere por fecha (futura → programado). Al marcar manualmente queda fijado.
alter table public.obra_control_depositos
  add column if not exists estado text check (estado in ('pagado', 'programado'));

-- Los dos pagos aún no efectuados de Claudio Coello 38 quedan fijados como programados
-- (sin esto, el de julio pasaría a "pagado" solo cuando llegue su fecha).
update public.obra_control_depositos
  set estado = 'programado'
  where estado is null and fecha in ('2026-07-15', '2026-07-31');
