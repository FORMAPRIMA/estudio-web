-- ─────────────────────────────────────────────────────────────────────────────
-- ESPACIOS — email secundario (CC) para el correo de bienvenida
--
-- Al iniciar un proceso de cliente desde Leads se puede indicar un segundo correo
-- (p. ej. pareja, socio, gestor del cliente). El correo de bienvenida del Espacio
-- se envía al email primario con este en copia (CC). Se guarda para que los
-- reenvíos posteriores conserven la copia.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE espacios ADD COLUMN IF NOT EXISTS email_cc text;

NOTIFY pgrst, 'reload schema';
