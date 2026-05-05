-- Due Diligence Visits — schema base
-- Módulo para visitas técnicas de DD de activos residenciales

-- ─── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.dd_asset_status AS ENUM (
    'preparacion_documental',
    'visita_programada',
    'en_visita',
    'revision_interna',
    'informe_redaccion',
    'cerrado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dd_visit_status AS ENUM (
    'programada',
    'en_curso',
    'finalizada',
    'en_revision_interna',
    'cerrada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dd_card_estado AS ENUM (
    'pendiente',
    'revisado_ok',
    'incidencia',
    'no_accesible',
    'no_aplica',
    'requiere_aclaracion'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dd_card_riesgo AS ENUM (
    'sin_riesgo',
    'bajo',
    'medio',
    'alto'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dd_card_prioridad AS ENUM (
    'alta',
    'media',
    'baja'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Activos ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dd_assets (
  id                     uuid             DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre                 text             NOT NULL,
  direccion              text,
  cliente                text,
  superficie_m2          numeric,
  uso_previsto           text,
  alcance_dd             text,
  status                 dd_asset_status  NOT NULL DEFAULT 'preparacion_documental',
  limitaciones_generales text,
  disclaimer_texto       text             DEFAULT 'La presente revisión tiene carácter visual, no invasivo y no destructivo. No incluye catas, ensayos, pruebas de carga, pruebas de estanqueidad, mediciones instrumentales exhaustivas, auditoría urbanística/legal completa, certificación de cumplimiento normativo ni validación completa de instalaciones ocultas. Las conclusiones se limitan a los elementos accesibles y observables en la fecha de visita.',
  created_at             timestamptz      DEFAULT now(),
  updated_at             timestamptz      DEFAULT now()
);

-- ─── Roles técnicos ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dd_roles (
  id          uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre      text    NOT NULL,
  descripcion text,
  color       text    DEFAULT '#888888',
  orden       integer NOT NULL DEFAULT 0,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ─── Visitas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dd_visits (
  id                      uuid            DEFAULT uuid_generate_v4() PRIMARY KEY,
  asset_id                uuid            NOT NULL REFERENCES public.dd_assets(id) ON DELETE CASCADE,
  fecha                   date,
  hora_inicio             time,
  hora_fin                time,
  status                  dd_visit_status NOT NULL DEFAULT 'programada',
  zonas_previstas         text[],
  zonas_inspeccionadas    text[],
  zonas_no_accesibles     text[],
  observaciones_generales text,
  resumen_ejecutivo       text,
  capex_orientativo_total text,
  created_at              timestamptz     DEFAULT now(),
  updated_at              timestamptz     DEFAULT now()
);

-- ─── Equipo por visita ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dd_visit_team (
  id             uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  visit_id       uuid    NOT NULL REFERENCES public.dd_visits(id) ON DELETE CASCADE,
  rol_id         uuid    NOT NULL REFERENCES public.dd_roles(id),
  user_id        uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre_display text    NOT NULL,
  created_at     timestamptz DEFAULT now()
);

-- ─── Cards de revisión ────────────────────────────────────────────────────────
-- visit_id = NULL indica card plantilla (no asociada a una visita concreta)

CREATE TABLE IF NOT EXISTS public.dd_cards (
  id              uuid              DEFAULT uuid_generate_v4() PRIMARY KEY,
  asset_id        uuid              NOT NULL REFERENCES public.dd_assets(id) ON DELETE CASCADE,
  visit_id        uuid              REFERENCES public.dd_visits(id) ON DELETE SET NULL,
  rol_id          uuid              NOT NULL REFERENCES public.dd_roles(id),

  -- Guía de revisión (prellenada, solo lectura en campo)
  titulo                    text             NOT NULL,
  especialidad              text,
  zona_edificio             text,
  prioridad                 dd_card_prioridad NOT NULL DEFAULT 'media',
  objetivo_revision         text,
  que_revisar               text,
  senales_alerta            text,
  fotos_recomendadas        text,
  preguntas_confirmar       text,
  documentacion_relacionada text,
  orden                     integer          NOT NULL DEFAULT 0,
  activo                    boolean          NOT NULL DEFAULT true,

  -- Captura de campo (rellenado por técnico durante visita)
  estado                    dd_card_estado   NOT NULL DEFAULT 'pendiente',
  riesgo                    dd_card_riesgo,
  planta                    text,
  zona                      text,
  estancia                  text,
  comentario_tecnico        text,
  requiere_seguimiento      boolean          NOT NULL DEFAULT false,
  incluir_revision_interna  boolean          NOT NULL DEFAULT false,

  -- Revisión interna / backoffice (post-visita, solo admin)
  diagnostico_interno           text,
  impacto_potencial             text,
  recomendacion_preliminar      text,
  capex_orientativo             text,
  texto_propuesto_informe       text,   -- borrador generado por IA
  texto_aprobado_informe        text,   -- texto final aprobado por admin
  texto_aprobado                boolean NOT NULL DEFAULT false,
  nivel_criticidad_final        dd_card_riesgo,
  requiere_aclaracion_propiedad boolean NOT NULL DEFAULT false,
  incluir_reporte_final         boolean NOT NULL DEFAULT false,

  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ─── Media por card ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dd_card_media (
  id           uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  card_id      uuid    NOT NULL REFERENCES public.dd_cards(id) ON DELETE CASCADE,
  asset_id     uuid    NOT NULL REFERENCES public.dd_assets(id) ON DELETE CASCADE,
  visit_id     uuid    REFERENCES public.dd_visits(id) ON DELETE SET NULL,
  tipo         text    NOT NULL CHECK (tipo IN ('foto', 'video')),
  url          text    NOT NULL,
  storage_path text,
  caption      text,
  user_id      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

-- ─── Documentación por activo ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dd_asset_docs (
  id        uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  asset_id  uuid    NOT NULL REFERENCES public.dd_assets(id) ON DELETE CASCADE,
  nombre    text    NOT NULL,
  tipo      text    NOT NULL DEFAULT 'recibida',  -- recibida | pendiente
  url       text,
  notas     text,
  orden     integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ─── Storage bucket ───────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('dd-visits', 'dd-visits', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "dd_visits_upload" ON storage.objects;
CREATE POLICY "dd_visits_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dd-visits');

DROP POLICY IF EXISTS "dd_visits_select" ON storage.objects;
CREATE POLICY "dd_visits_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'dd-visits');

DROP POLICY IF EXISTS "dd_visits_delete" ON storage.objects;
CREATE POLICY "dd_visits_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'dd-visits');

NOTIFY pgrst, 'reload schema';
