-- Añade el estado 'received' al enum fpe_contract_status.
-- "Recibido" = el contrato fue firmado en DocuSign Y el PDF firmado se descargó
-- y guardó exitosamente en nuestro bucket de storage.
-- "Firmado" pasa a ser un estado transitorio: DocuSign reportó "completed"
-- pero la descarga/subida del PDF aún no se confirmó.
ALTER TYPE fpe_contract_status ADD VALUE IF NOT EXISTS 'received';

NOTIFY pgrst, 'reload schema';
