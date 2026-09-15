-- Destinatario explícito en facturas emitidas: cliente o proveedor.
--
-- Contexto: hasta ahora la única defensa de "esta factura no va al cliente" era la
-- SECCIÓN (SECCIONES_PRIVADAS = 'Margen prorrateado de obra'). Al empezar a emitir
-- rappels/descuentos a proveedores de mobiliario dentro de "Compra de mobiliario"
-- —una sección que SÍ se factura al cliente (los suplidos)— esa defensa deja de
-- servir. El destinatario pasa a ser un dato de primera clase de la factura.
--
-- Además: `facturas_emitidas.cliente_id` tiene FK a clientes(id). El código de
-- emisión desde contrato metía ahí el id del PROVEEDOR, lo que provocaba una
-- violación de FK (23503) y, peor, `asignarProyectoSeccion` copiaba ese id a
-- `facturas.clientes_ids`, que es el array con el que el portal decide qué ve
-- cada cliente. Con receptor_tipo/proveedor_id, cliente_id queda siempre limpio.

ALTER TABLE public.facturas_emitidas
  ADD COLUMN IF NOT EXISTS receptor_tipo text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS proveedor_id  uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facturas_emitidas_receptor_tipo_check'
  ) THEN
    ALTER TABLE public.facturas_emitidas
      ADD CONSTRAINT facturas_emitidas_receptor_tipo_check
      CHECK (receptor_tipo IN ('cliente', 'proveedor'));
  END IF;
END $$;

-- ── Backfill (antes de la invariante, que si no rechaza las filas existentes) ──

-- Emitidas cuya factura de origen apunta a un proveedor.
UPDATE public.facturas_emitidas fe
SET    receptor_tipo = 'proveedor',
       proveedor_id  = f.proveedor_id,
       cliente_id    = NULL
FROM   public.facturas f
WHERE  fe.factura_origen_id = f.id
  AND  f.proveedor_id IS NOT NULL
  AND  fe.receptor_tipo <> 'proveedor';

-- Emitidas de sección privada sin proveedor en el origen → constructora del proyecto.
UPDATE public.facturas_emitidas fe
SET    receptor_tipo = 'proveedor',
       proveedor_id  = COALESCE(fe.proveedor_id, p.constructor_id),
       cliente_id    = NULL
FROM   public.proyectos p
WHERE  fe.proyecto_id = p.id
  AND  fe.seccion = 'Margen prorrateado de obra'
  AND  fe.receptor_tipo <> 'proveedor';

-- Emitidas privadas sin proyecto asignado (creadas a mano): marcar el tipo aunque
-- no podamos resolver el proveedor concreto. Deja cliente_id limpio igualmente.
UPDATE public.facturas_emitidas
SET    receptor_tipo = 'proveedor',
       cliente_id    = NULL
WHERE  seccion = 'Margen prorrateado de obra'
  AND  receptor_tipo <> 'proveedor';

-- Filas de `facturas` a proveedor: nunca deben arrastrar clientes_ids, porque el
-- portal del cliente filtra por ese array.
UPDATE public.facturas
SET    clientes_ids = '{}'
WHERE  proveedor_id IS NOT NULL
  AND  clientes_ids <> '{}';

-- ── Invariante ───────────────────────────────────────────────────────────────
-- Una factura a proveedor jamás puede llevar cliente_id: es la última línea de
-- defensa, en la propia base de datos, contra que un margen interno acabe
-- vinculado (y por tanto visible o enviable) a un cliente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facturas_emitidas_receptor_coherente_check'
  ) THEN
    ALTER TABLE public.facturas_emitidas
      ADD CONSTRAINT facturas_emitidas_receptor_coherente_check
      CHECK (receptor_tipo = 'cliente' OR cliente_id IS NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS facturas_emitidas_proveedor_id_idx
  ON public.facturas_emitidas (proveedor_id) WHERE proveedor_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
