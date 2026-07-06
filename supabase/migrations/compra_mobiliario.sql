-- Reorganización del mobiliario: pass-through con margen
-- "Margen de mobiliario" (sección privada, facturada al proveedor) pasa a ser
-- "Compra de mobiliario": un depósito por proyecto donde entran los suplidos
-- cobrados al cliente y salen las compras de mobiliario. El margen se calcula.

-- % de margen estimado por factura de suplido (INTERNO — nunca se envía al
-- cliente, nunca aparece en facturas_emitidas ni en el portal).
ALTER TABLE facturas   ADD COLUMN IF NOT EXISTS margen_estimado_pct numeric;

-- Estado de liquidación del mobiliario (uno por proyecto). Mientras es false, la
-- previsión usa el margen estimado; al liquidar, se congela el margen real
-- (suplidos - compras).
ALTER TABLE proyectos  ADD COLUMN IF NOT EXISTS mobiliario_liquidado boolean NOT NULL DEFAULT false;

-- Renombrar la sección existente (hoy 1 fila: CC38).
UPDATE facturas SET seccion = 'Compra de mobiliario' WHERE seccion = 'Margen de mobiliario';

NOTIFY pgrst, 'reload schema';
