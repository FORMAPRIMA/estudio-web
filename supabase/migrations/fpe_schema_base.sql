-- ══════════════════════════════════════════════════════════════════════════════
-- FP EXECUTION — Base Schema Migration (Phase 0)
-- Table prefix: fpe_*
-- Roles: fp_partner (admin) > fp_manager (PM) > fp_team (read-only)
-- External portal: uses service_role client in Route Handlers (bypasses RLS)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.fpe_project_status AS ENUM (
    'borrador',
    'scope_ready',
    'tender_launched',
    'awarded',
    'contracted',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fpe_tender_status AS ENUM (
    'draft',
    'readiness_check',
    'launched',
    'closed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fpe_invitation_status AS ENUM (
    'pending',
    'sent',
    'viewed',
    'bid_submitted',
    'expired',
    'revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fpe_bid_status AS ENUM (
    'draft',
    'submitted',
    'accepted',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fpe_contract_status AS ENUM (
    'draft',
    'sent_to_sign',
    'signed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- TEMPLATE LAYER
-- Master data managed by fp_partner / fp_manager. Read-only for fp_team.
-- Source of truth: Capítulos → Unidades de Ejecución → Partidas + Fases.
-- Dependencies between phases live here; projects only override quantities/dates.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fpe_template_chapters (
  id          uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre      text        NOT NULL,
  descripcion text,
  orden       integer     NOT NULL DEFAULT 0,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Unidades de Ejecución: the licitatable work packages
CREATE TABLE IF NOT EXISTS public.fpe_template_units (
  id          uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  chapter_id  uuid        NOT NULL REFERENCES public.fpe_template_chapters(id) ON DELETE CASCADE,
  nombre      text        NOT NULL,
  descripcion text,
  orden       integer     NOT NULL DEFAULT 0,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Partidas: measurable line items within each unit
CREATE TABLE IF NOT EXISTS public.fpe_template_line_items (
  id            uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  unit_id       uuid        NOT NULL REFERENCES public.fpe_template_units(id) ON DELETE CASCADE,
  nombre        text        NOT NULL,
  descripcion   text,
  unidad_medida text        NOT NULL DEFAULT 'ud', -- m2, ml, ud, pa, kg, h, etc.
  orden         integer     NOT NULL DEFAULT 0,
  activo        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Fases de Ejecución: operational phases per unit (sequence + lead times)
CREATE TABLE IF NOT EXISTS public.fpe_template_phases (
  id             uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  unit_id        uuid        NOT NULL REFERENCES public.fpe_template_units(id) ON DELETE CASCADE,
  nombre         text        NOT NULL,
  descripcion    text,
  orden          integer     NOT NULL DEFAULT 0,
  lead_time_days integer     NOT NULL DEFAULT 7,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Dependency edges between phases (DAG — enables parametric scheduling)
CREATE TABLE IF NOT EXISTS public.fpe_template_dependencies (
  id                   uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  predecessor_phase_id uuid        NOT NULL REFERENCES public.fpe_template_phases(id) ON DELETE CASCADE,
  successor_phase_id   uuid        NOT NULL REFERENCES public.fpe_template_phases(id) ON DELETE CASCADE,
  lag_days             integer     NOT NULL DEFAULT 0,
  created_at           timestamptz DEFAULT now(),
  UNIQUE (predecessor_phase_id, successor_phase_id),
  CHECK  (predecessor_phase_id <> successor_phase_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- PARTNERS
-- Execution Partners: external subcontractor companies.
-- Capabilities define which template units each partner can execute.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fpe_partners (
  id                   uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre               text        NOT NULL,
  razon_social         text,
  nif_cif              text,
  contacto_nombre      text,
  email_contacto       text,
  email_notificaciones text,
  email_facturacion    text,
  telefono             text,
  direccion            text,
  ciudad               text,
  codigo_postal        text,
  pais                 text        NOT NULL DEFAULT 'España',
  iban                 text,
  notas                text,
  activo               boolean     NOT NULL DEFAULT true,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- N:N matrix: which units can each partner execute
CREATE TABLE IF NOT EXISTS public.fpe_partner_capabilities (
  id         uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  partner_id uuid        NOT NULL REFERENCES public.fpe_partners(id) ON DELETE CASCADE,
  unit_id    uuid        NOT NULL REFERENCES public.fpe_template_units(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (partner_id, unit_id)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- PROJECT LAYER (instances)
-- Each fpe_project selects a subset of template units and sets quantities.
-- Prices are NOT set here — they come from partner bids.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fpe_projects (
  id                 uuid                      DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre             text                      NOT NULL,
  descripcion        text,
  direccion          text,
  ciudad             text,
  -- Optional link to the existing internal project
  linked_proyecto_id uuid                      REFERENCES public.proyectos(id) ON DELETE SET NULL,
  status             public.fpe_project_status NOT NULL DEFAULT 'borrador',
  -- Computed by readiness check action (0-100)
  readiness_score    integer                   NOT NULL DEFAULT 0
                                               CHECK (readiness_score BETWEEN 0 AND 100),
  created_by         uuid                      REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz               DEFAULT now(),
  updated_at         timestamptz               DEFAULT now()
);

-- Selected units for this project (subset of fpe_template_units)
CREATE TABLE IF NOT EXISTS public.fpe_project_units (
  id               uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id       uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  template_unit_id uuid        NOT NULL REFERENCES public.fpe_template_units(id) ON DELETE RESTRICT,
  notas            text,
  orden            integer     NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (project_id, template_unit_id)
);

-- Line items with quantities; unit price comes from bids
CREATE TABLE IF NOT EXISTS public.fpe_project_line_items (
  id                    uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_unit_id       uuid        NOT NULL REFERENCES public.fpe_project_units(id) ON DELETE CASCADE,
  template_line_item_id uuid        NOT NULL REFERENCES public.fpe_template_line_items(id) ON DELETE RESTRICT,
  cantidad              numeric     NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  notas                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE (project_unit_id, template_line_item_id)
);

-- Documents: linked to the whole project (general) or to a specific unit
CREATE TABLE IF NOT EXISTS public.fpe_documents (
  id              uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id      uuid        NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  project_unit_id uuid        REFERENCES public.fpe_project_units(id) ON DELETE CASCADE,
  -- NULL project_unit_id = general project document
  nombre          text        NOT NULL,
  storage_path    text        NOT NULL, -- path inside 'fpe-documents' bucket
  mime_type       text,
  size_bytes      bigint,
  discipline_tags text[]      NOT NULL DEFAULT '{}',
  uploaded_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- TENDER LAYER
-- A Tender is a bidding event for a project.
-- Invitations are sent to specific partners for specific units (scope_unit_ids).
-- External portal uses admin client — bid/invitation data via Route Handlers.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fpe_tenders (
  id           uuid                     DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id   uuid                     NOT NULL REFERENCES public.fpe_projects(id) ON DELETE CASCADE,
  descripcion  text,
  fecha_limite timestamptz              NOT NULL,
  status       public.fpe_tender_status NOT NULL DEFAULT 'draft',
  launched_at  timestamptz,
  closed_at    timestamptz,
  created_by   uuid                     REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz              DEFAULT now(),
  updated_at   timestamptz              DEFAULT now()
);

-- One invitation per partner per tender; token gives portal access
CREATE TABLE IF NOT EXISTS public.fpe_tender_invitations (
  id               uuid                         DEFAULT uuid_generate_v4() PRIMARY KEY,
  tender_id        uuid                         NOT NULL REFERENCES public.fpe_tenders(id) ON DELETE CASCADE,
  partner_id       uuid                         NOT NULL REFERENCES public.fpe_partners(id) ON DELETE CASCADE,
  -- HMAC-signed token for portal access (generated app-side, stored for lookup)
  token            uuid                         NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  token_expires_at timestamptz                  NOT NULL,
  -- Which project_unit ids this partner is invited for (controls doc visibility)
  scope_unit_ids   uuid[]                       NOT NULL DEFAULT '{}',
  status           public.fpe_invitation_status NOT NULL DEFAULT 'pending',
  sent_at          timestamptz,
  viewed_at        timestamptz,
  bid_submitted_at timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz                  DEFAULT now(),
  UNIQUE (tender_id, partner_id)
);

-- One bid per invitation
CREATE TABLE IF NOT EXISTS public.fpe_bids (
  id            uuid                   DEFAULT uuid_generate_v4() PRIMARY KEY,
  invitation_id uuid                   NOT NULL REFERENCES public.fpe_tender_invitations(id) ON DELETE CASCADE UNIQUE,
  notas         text,
  status        public.fpe_bid_status  NOT NULL DEFAULT 'draft',
  submitted_at  timestamptz,
  created_at    timestamptz            DEFAULT now(),
  updated_at    timestamptz            DEFAULT now()
);

-- Unit price per line item within the bid
CREATE TABLE IF NOT EXISTS public.fpe_bid_line_items (
  id                   uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  bid_id               uuid        NOT NULL REFERENCES public.fpe_bids(id) ON DELETE CASCADE,
  project_line_item_id uuid        NOT NULL REFERENCES public.fpe_project_line_items(id) ON DELETE CASCADE,
  precio_unitario      numeric     NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0),
  notas                text,
  created_at           timestamptz DEFAULT now(),
  UNIQUE (bid_id, project_line_item_id)
);

-- Duration estimate per phase within the bid
CREATE TABLE IF NOT EXISTS public.fpe_bid_phase_durations (
  id                uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  bid_id            uuid        NOT NULL REFERENCES public.fpe_bids(id) ON DELETE CASCADE,
  project_unit_id   uuid        NOT NULL REFERENCES public.fpe_project_units(id) ON DELETE CASCADE,
  template_phase_id uuid        NOT NULL REFERENCES public.fpe_template_phases(id) ON DELETE CASCADE,
  duracion_dias     integer     NOT NULL CHECK (duracion_dias > 0),
  notas             text,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (bid_id, project_unit_id, template_phase_id)
);

-- Q&A: partners ask, internal team answers (optionally broadcast to all invitees)
CREATE TABLE IF NOT EXISTS public.fpe_qa_questions (
  id              uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  invitation_id   uuid        NOT NULL REFERENCES public.fpe_tender_invitations(id) ON DELETE CASCADE,
  project_unit_id uuid        REFERENCES public.fpe_project_units(id) ON DELETE SET NULL,
  texto           text        NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fpe_qa_answers (
  id               uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  question_id      uuid        NOT NULL REFERENCES public.fpe_qa_questions(id) ON DELETE CASCADE UNIQUE,
  texto            text        NOT NULL,
  publicar_a_todos boolean     NOT NULL DEFAULT false,
  answered_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- AWARD & CONTRACT
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fpe_awards (
  id         uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  tender_id  uuid        NOT NULL REFERENCES public.fpe_tenders(id) ON DELETE CASCADE,
  partner_id uuid        NOT NULL REFERENCES public.fpe_partners(id) ON DELETE RESTRICT,
  bid_id     uuid        NOT NULL REFERENCES public.fpe_bids(id) ON DELETE RESTRICT UNIQUE,
  notas      text,
  awarded_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  awarded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (tender_id, partner_id)
);

CREATE TABLE IF NOT EXISTS public.fpe_contracts (
  id                   uuid                       DEFAULT uuid_generate_v4() PRIMARY KEY,
  award_id             uuid                       NOT NULL REFERENCES public.fpe_awards(id) ON DELETE CASCADE UNIQUE,
  contenido_json       jsonb                      NOT NULL DEFAULT '{}',
  docusign_envelope_id text,
  status               public.fpe_contract_status NOT NULL DEFAULT 'draft',
  sent_at              timestamptz,
  signed_at            timestamptz,
  created_at           timestamptz                DEFAULT now(),
  updated_at           timestamptz                DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_fpe_template_units_chapter       ON public.fpe_template_units(chapter_id);
CREATE INDEX IF NOT EXISTS idx_fpe_template_line_items_unit      ON public.fpe_template_line_items(unit_id);
CREATE INDEX IF NOT EXISTS idx_fpe_template_phases_unit          ON public.fpe_template_phases(unit_id);
CREATE INDEX IF NOT EXISTS idx_fpe_partner_cap_partner           ON public.fpe_partner_capabilities(partner_id);
CREATE INDEX IF NOT EXISTS idx_fpe_partner_cap_unit              ON public.fpe_partner_capabilities(unit_id);
CREATE INDEX IF NOT EXISTS idx_fpe_projects_status               ON public.fpe_projects(status);
CREATE INDEX IF NOT EXISTS idx_fpe_projects_linked               ON public.fpe_projects(linked_proyecto_id) WHERE linked_proyecto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fpe_project_units_project         ON public.fpe_project_units(project_id);
CREATE INDEX IF NOT EXISTS idx_fpe_project_units_template        ON public.fpe_project_units(template_unit_id);
CREATE INDEX IF NOT EXISTS idx_fpe_project_line_items_unit       ON public.fpe_project_line_items(project_unit_id);
CREATE INDEX IF NOT EXISTS idx_fpe_documents_project             ON public.fpe_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_fpe_documents_unit                ON public.fpe_documents(project_unit_id) WHERE project_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fpe_tenders_project               ON public.fpe_tenders(project_id);
CREATE INDEX IF NOT EXISTS idx_fpe_tenders_status                ON public.fpe_tenders(status);
CREATE INDEX IF NOT EXISTS idx_fpe_invitations_tender            ON public.fpe_tender_invitations(tender_id);
CREATE INDEX IF NOT EXISTS idx_fpe_invitations_token             ON public.fpe_tender_invitations(token);
CREATE INDEX IF NOT EXISTS idx_fpe_invitations_partner           ON public.fpe_tender_invitations(partner_id);
CREATE INDEX IF NOT EXISTS idx_fpe_invitations_status            ON public.fpe_tender_invitations(status);
CREATE INDEX IF NOT EXISTS idx_fpe_bids_invitation               ON public.fpe_bids(invitation_id);
CREATE INDEX IF NOT EXISTS idx_fpe_bid_line_items_bid            ON public.fpe_bid_line_items(bid_id);
CREATE INDEX IF NOT EXISTS idx_fpe_bid_phase_durations_bid       ON public.fpe_bid_phase_durations(bid_id);
CREATE INDEX IF NOT EXISTS idx_fpe_qa_questions_invitation       ON public.fpe_qa_questions(invitation_id);
CREATE INDEX IF NOT EXISTS idx_fpe_awards_tender                 ON public.fpe_awards(tender_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Patterns:
--   fp_team     → SELECT only (read all)
--   fp_manager  → full CRUD
--   fp_partner  → full CRUD (via is_fp_manager_or_above helper)
-- External portal → service_role client in Route Handlers (bypasses RLS)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.fpe_template_chapters     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_template_units        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_template_line_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_template_phases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_template_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_partners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_partner_capabilities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_project_units         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_project_line_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_tenders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_tender_invitations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_bids                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_bid_line_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_bid_phase_durations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_qa_questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_qa_answers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_awards                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_contracts             ENABLE ROW LEVEL SECURITY;

-- ── Template policies ─────────────────────────────────────────────────────────

CREATE POLICY "fpe_tmpl_chapters: staff read"
  ON public.fpe_template_chapters FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_tmpl_chapters: manager+ write"
  ON public.fpe_template_chapters FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_tmpl_units: staff read"
  ON public.fpe_template_units FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_tmpl_units: manager+ write"
  ON public.fpe_template_units FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_tmpl_line_items: staff read"
  ON public.fpe_template_line_items FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_tmpl_line_items: manager+ write"
  ON public.fpe_template_line_items FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_tmpl_phases: staff read"
  ON public.fpe_template_phases FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_tmpl_phases: manager+ write"
  ON public.fpe_template_phases FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_tmpl_deps: staff read"
  ON public.fpe_template_dependencies FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_tmpl_deps: manager+ write"
  ON public.fpe_template_dependencies FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

-- ── Partner policies ──────────────────────────────────────────────────────────

CREATE POLICY "fpe_partners: staff read"
  ON public.fpe_partners FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_partners: manager+ write"
  ON public.fpe_partners FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_partner_cap: staff read"
  ON public.fpe_partner_capabilities FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_partner_cap: manager+ write"
  ON public.fpe_partner_capabilities FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

-- ── Project policies ──────────────────────────────────────────────────────────

CREATE POLICY "fpe_projects: staff read"
  ON public.fpe_projects FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_projects: manager+ write"
  ON public.fpe_projects FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_project_units: staff read"
  ON public.fpe_project_units FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_project_units: manager+ write"
  ON public.fpe_project_units FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_project_line_items: staff read"
  ON public.fpe_project_line_items FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_project_line_items: manager+ write"
  ON public.fpe_project_line_items FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_documents: staff read"
  ON public.fpe_documents FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_documents: manager+ write"
  ON public.fpe_documents FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

-- ── Tender policies ───────────────────────────────────────────────────────────

CREATE POLICY "fpe_tenders: staff read"
  ON public.fpe_tenders FOR SELECT
  USING (public.get_my_rol() IN ('fp_team', 'fp_manager', 'fp_partner'));

CREATE POLICY "fpe_tenders: manager+ write"
  ON public.fpe_tenders FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

-- Invitations, bids, Q&A and awards: fp_manager+ only internally.
-- External access via service_role in Route Handlers.

CREATE POLICY "fpe_invitations: manager+ all"
  ON public.fpe_tender_invitations FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_bids: manager+ all"
  ON public.fpe_bids FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_bid_line_items: manager+ all"
  ON public.fpe_bid_line_items FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_bid_phase_durations: manager+ all"
  ON public.fpe_bid_phase_durations FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_qa_questions: manager+ all"
  ON public.fpe_qa_questions FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_qa_answers: manager+ all"
  ON public.fpe_qa_answers FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_awards: manager+ all"
  ON public.fpe_awards FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

CREATE POLICY "fpe_contracts: manager+ all"
  ON public.fpe_contracts FOR ALL
  USING (public.is_fp_manager_or_above())
  WITH CHECK (public.is_fp_manager_or_above());

-- ══════════════════════════════════════════════════════════════════════════════
-- STORAGE
-- Bucket: fpe-documents (private)
-- Path convention: fpe/{project_id}/general/{filename}
--                  fpe/{project_id}/units/{unit_id}/{filename}
-- Create via Supabase dashboard or Storage API (not creatable via SQL directly).
-- ══════════════════════════════════════════════════════════════════════════════

-- Run in Supabase Dashboard > Storage > New bucket:
--   Name: fpe-documents
--   Public: false
