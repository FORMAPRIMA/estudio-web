-- Cobros por proyecto (tabla facturas) en dólares.
--
-- `monto` sigue en EUROS: lo suman el P&L, el kanban y los totales del proyecto.
-- En una fila USD el importe pactado vive en `monto_moneda` y `monto` es su
-- contravalor: estimado al cambio BCE del día mientras no se emite, y el real
-- (base imponible en euros de la factura emitida) en cuanto se emite.

alter table facturas
  add column if not exists moneda       text not null default 'EUR',
  add column if not exists monto_moneda numeric(14,2);

alter table facturas drop constraint if exists facturas_moneda_check;
alter table facturas add constraint facturas_moneda_check check (
  moneda in ('EUR', 'USD') and (moneda = 'EUR' or monto_moneda is not null)
);
