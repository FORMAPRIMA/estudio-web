-- Facturas emitidas en moneda extranjera (clientes de EE. UU., en USD).
--
-- Las líneas (items) van en `moneda`. base_imponible / cuota_iva / cuota_irpf /
-- total siguen en EUROS: los leen la contabilidad, el portal del gestor y los
-- modelos de IVA. El cambio es el de referencia del BCE de la fecha de emisión
-- (unidades de moneda por 1 €) y lo pone el servidor al emitir.

alter table facturas_emitidas
  add column if not exists moneda                text          not null default 'EUR',
  add column if not exists tipo_cambio           numeric(12,6),
  add column if not exists tipo_cambio_fecha     date,
  add column if not exists base_imponible_moneda numeric(14,2),
  add column if not exists total_moneda          numeric(14,2);

alter table facturas_emitidas drop constraint if exists facturas_emitidas_moneda_check;
alter table facturas_emitidas add constraint facturas_emitidas_moneda_check check (
  moneda in ('EUR', 'USD')
  and (moneda = 'EUR' or (tipo_cambio > 0 and tipo_cambio_fecha is not null and total_moneda is not null))
);
