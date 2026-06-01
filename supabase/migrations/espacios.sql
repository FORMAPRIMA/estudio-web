-- ─────────────────────────────────────────────────────────────────────────────
-- ESPACIOS — superficie única y permanente del lead/cliente ("el Espacio")
--
-- Un link por persona para toda la relación. La página muta de "etapa" según el
-- momento de la relación (bienvenida → propuesta → formalizacion → contrato →
-- proyecto), mostrando/ocultando lo que toca en cada punto.
--
-- La etapa se sincroniza con el funnel existente (leads → propuestas → contratos
-- → proyectos), pero se guarda explícita para poder forzarla/controlarla a mano.
--
-- Sustituye, a futuro, al flujo one-shot de `bienvenida_tokens` y al portal por
-- proyecto `/portal/[id]`. Por ahora convive en paralelo sin tocar nada.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS espacios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,

  -- Identidad: lo conocemos al crear, y se va completando con el funnel.
  nombre text NOT NULL,                 -- nombre con el que iniciamos el proceso
  email  text,                          -- email inicial (primer touchpoint)
  lead_id    uuid REFERENCES leads(id)    ON DELETE SET NULL,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,

  -- Etapa de la relación. Una sola superficie, distintas caras.
  --   bienvenida | propuesta | formalizacion | contrato | proyecto
  etapa text NOT NULL DEFAULT 'bienvenida',

  -- Acceso: PIN que fija el propio cliente (hasheado). Null hasta que lo crea.
  pin_hash   text,
  pin_set_at timestamptz,

  -- Tracking de accesos (mismo patrón que bienvenida_tokens.accesos).
  primer_acceso timestamptz,
  num_accesos   integer NOT NULL DEFAULT 0,
  accesos       jsonb   NOT NULL DEFAULT '[]'::jsonb,   -- [{ ts, ip, dispositivo }]

  -- Log de eventos de negocio del Espacio (lectura de propuesta, aceptación…).
  eventos jsonb NOT NULL DEFAULT '[]'::jsonb,           -- [{ tipo, ts, meta }]

  -- Sello temporal de cuándo entró en cada etapa (para métricas/timeline).
  etapa_propuesta_at     timestamptz,
  etapa_formalizacion_at timestamptz,
  etapa_contrato_at      timestamptz,
  etapa_proyecto_at      timestamptz,

  -- Meta interna.
  nota_interna text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_espacios_lead    ON espacios(lead_id);
CREATE INDEX IF NOT EXISTS idx_espacios_cliente ON espacios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_espacios_etapa   ON espacios(etapa);

-- Acceso exclusivamente vía Server Actions / API routes con el service_role
-- (createAdminClient), que bypasea RLS. No exponemos a anon/authenticated.
ALTER TABLE espacios ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
