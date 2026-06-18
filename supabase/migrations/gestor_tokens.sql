-- Portal del gestor: tokens de acceso de solo lectura para la gestoría.
-- Solo se accede vía service_role (server), no necesita grants para anon/authenticated.

CREATE TABLE IF NOT EXISTS public.gestor_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text UNIQUE NOT NULL,
  label       text,                          -- ej: "Gestoría Martínez"
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  last_access timestamptz
);

ALTER TABLE public.gestor_tokens ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
