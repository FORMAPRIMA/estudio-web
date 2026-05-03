-- Agregar campos de enlace contextual a avisos
ALTER TABLE avisos ADD COLUMN IF NOT EXISTS linkeable_type text;
ALTER TABLE avisos ADD COLUMN IF NOT EXISTS linkeable_id uuid;
ALTER TABLE avisos ADD COLUMN IF NOT EXISTS link_label text;

-- Índice para consultas por tipo/id de entidad enlazada
CREATE INDEX IF NOT EXISTS idx_avisos_linkeable ON avisos(linkeable_type, linkeable_id);

-- Validación de tipos soportados
ALTER TABLE avisos ADD CONSTRAINT check_linkeable_type CHECK (
  linkeable_type IS NULL OR linkeable_type IN (
    'factura', 'marketing_post', 'contrato', 'propuesta', 'due_diligencia'
  )
);
