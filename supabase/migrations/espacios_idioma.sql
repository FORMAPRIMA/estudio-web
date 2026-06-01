-- Idioma del Espacio (la landing de Bienvenida y, a futuro, el resto de etapas).
-- 'es' | 'en'. Por defecto español.
ALTER TABLE espacios ADD COLUMN IF NOT EXISTS idioma text NOT NULL DEFAULT 'es';

NOTIFY pgrst, 'reload schema';
