-- Add tour virtual URL field to FP Execution projects
ALTER TABLE fpe_projects
  ADD COLUMN IF NOT EXISTS tour_virtual_url text;
