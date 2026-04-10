-- DocuSign integration columns for contratos table
-- Run this once in Supabase SQL Editor

ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS docusign_envelope_id  TEXT,
  ADD COLUMN IF NOT EXISTS docusign_status        TEXT,        -- sent | completed | declined | voided
  ADD COLUMN IF NOT EXISTS docusign_sent_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS docusign_completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_firmado_url        TEXT;

-- Optional: index for webhook lookup by envelope ID
CREATE INDEX IF NOT EXISTS contratos_docusign_envelope_id_idx
  ON contratos (docusign_envelope_id)
  WHERE docusign_envelope_id IS NOT NULL;
