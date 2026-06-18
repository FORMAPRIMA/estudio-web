-- El webhook de DocuSign y el Espacio del cliente (getEspacioContrato) usan
-- contratos.pdf_firmado_url, pero la columna nunca se creó. Sin ella, la query
-- del Espacio falla y el cliente ve "Estamos preparando tu contrato" aunque el
-- contrato ya esté enviado.
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS pdf_firmado_url text;

NOTIFY pgrst, 'reload schema';
