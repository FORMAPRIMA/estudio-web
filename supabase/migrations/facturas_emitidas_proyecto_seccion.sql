-- Asignación de proyecto + sección a facturas emitidas, con impacto en contabilidad.
--
-- Contexto: la contabilidad (P&L por proyecto y dashboard general) lee SOLO de la
-- tabla `facturas` (monto por proyecto_id + seccion). Las `facturas_emitidas` son
-- el documento real. Para que asignar proyecto/sección a una factura emitida cuente
-- en contabilidad, la action crea/sincroniza una fila en `facturas`.
--
-- `creada_desde_emitida` marca esas filas para poder deshacer/borrar sin tocar
-- jamás las facturas que vienen de contratos.

-- Sección mostrada en el visor de facturas emitidas (denormalizada, como proyecto_nombre)
ALTER TABLE public.facturas_emitidas
  ADD COLUMN IF NOT EXISTS seccion text;

-- Marca las filas de `facturas` originadas desde una factura emitida (no desde un contrato)
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS creada_desde_emitida boolean NOT NULL DEFAULT false;

-- Recargar el schema cache de PostgREST
NOTIFY pgrst, 'reload schema';
