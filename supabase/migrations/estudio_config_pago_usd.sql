-- Datos para cobrar en dólares (cuenta USD de Wise Business). Salen en las
-- facturas en USD en lugar del IBAN. Editables en Facturación → Información empresa.

alter table estudio_config
  add column if not exists usd_titular     text,
  add column if not exists usd_banco       text,
  add column if not exists usd_routing     text,
  add column if not exists usd_cuenta      text,
  add column if not exists usd_tipo_cuenta text,
  add column if not exists usd_swift       text,
  add column if not exists usd_direccion   text;

update estudio_config set
  usd_titular     = coalesce(usd_titular,     'GEINEX GROUP SL.'),
  usd_banco       = coalesce(usd_banco,       'Lead Bank (Wise US Inc.)'),
  usd_routing     = coalesce(usd_routing,     '101019628'),
  usd_cuenta      = coalesce(usd_cuenta,      '213698780437'),
  usd_tipo_cuenta = coalesce(usd_tipo_cuenta, 'Checking'),
  usd_swift       = coalesce(usd_swift,       'TRWIUS35XXX'),
  usd_direccion   = coalesce(usd_direccion,   'Wise US Inc, 108 W 13th St, Wilmington, DE, 19801, United States')
where id = 1;
