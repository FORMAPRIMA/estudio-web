-- ── FP Execution: Disciplines System ────────────────────────────────────────
-- Introduces fpe_disciplines as an intermediate layer between partners and
-- execution units. Partners declare discipline capabilities; line items are
-- tagged with a discipline; invitations are discipline-based.

-- ── Disciplines master list ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fpe_disciplines (
  id          uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre      text        NOT NULL,
  descripcion text,
  color       text        NOT NULL DEFAULT '#378ADD',
  orden       integer     NOT NULL DEFAULT 0,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── Partner → discipline capabilities (replaces fpe_partner_capabilities) ────

CREATE TABLE IF NOT EXISTS public.fpe_partner_disciplines (
  id            uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  partner_id    uuid        NOT NULL REFERENCES public.fpe_partners(id)     ON DELETE CASCADE,
  discipline_id uuid        NOT NULL REFERENCES public.fpe_disciplines(id)  ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (partner_id, discipline_id)
);

-- ── Line items get a discipline ───────────────────────────────────────────────

ALTER TABLE public.fpe_template_line_items
  ADD COLUMN IF NOT EXISTS discipline_id uuid
    REFERENCES public.fpe_disciplines(id) ON DELETE SET NULL;

-- ── Units get a "principal discipline" (who proposes phase durations) ─────────

ALTER TABLE public.fpe_template_units
  ADD COLUMN IF NOT EXISTS principal_discipline_id uuid
    REFERENCES public.fpe_disciplines(id) ON DELETE SET NULL;

-- ── Invitations become discipline-based ───────────────────────────────────────

ALTER TABLE public.fpe_tender_invitations
  ADD COLUMN IF NOT EXISTS discipline_ids uuid[] DEFAULT '{}';

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.fpe_disciplines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpe_partner_disciplines  ENABLE ROW LEVEL SECURITY;

-- Disciplines: authenticated users can read; only managers can write
CREATE POLICY "Authenticated can read disciplines"
  ON public.fpe_disciplines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage disciplines"
  ON public.fpe_disciplines FOR ALL TO authenticated USING (true)
  WITH CHECK (true);

-- Service role bypass for admin client
CREATE POLICY "Service role bypass fpe_disciplines"
  ON public.fpe_disciplines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Partner disciplines: authenticated can read; service role writes
CREATE POLICY "Authenticated can read partner disciplines"
  ON public.fpe_partner_disciplines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage partner disciplines"
  ON public.fpe_partner_disciplines FOR ALL TO authenticated USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass fpe_partner_disciplines"
  ON public.fpe_partner_disciplines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS fpe_partner_disciplines_partner_idx
  ON public.fpe_partner_disciplines (partner_id);

CREATE INDEX IF NOT EXISTS fpe_partner_disciplines_discipline_idx
  ON public.fpe_partner_disciplines (discipline_id);

CREATE INDEX IF NOT EXISTS fpe_template_line_items_discipline_idx
  ON public.fpe_template_line_items (discipline_id);

CREATE INDEX IF NOT EXISTS fpe_template_units_principal_discipline_idx
  ON public.fpe_template_units (principal_discipline_id);

-- ── Seed: initial discipline list for Madrid integral reforms ─────────────────
-- Run only once; safe to re-run (uses INSERT ... ON CONFLICT DO NOTHING).

INSERT INTO public.fpe_disciplines (nombre, descripcion, color, orden) VALUES
  ('Demolición y gestión de residuos', 'Demolición, gestión de residuos y acondicionamiento inicial', '#6B7280', 10),
  ('Estructura y obra gruesa',         'Refuerzos estructurales, tabiquería de ladrillo/bloque',     '#92400E', 20),
  ('Instalaciones eléctricas',         'Electricidad, telecomunicaciones y domótica',                '#D97706', 30),
  ('Fontanería y saneamiento',         'Fontanería, saneamiento y climatización (HVAC)',             '#0369A1', 40),
  ('Revestimientos y alicatados',      'Alicatados, pavimentos y revestimientos continuos',          '#059669', 50),
  ('Carpintería de madera',            'Puertas, armarios y carpintería a medida',                   '#B45309', 60),
  ('Carpintería metálica y vidrio',    'Ventanas, barandillas y elementos de aluminio/acero/vidrio', '#374151', 70),
  ('Pintura y remates',                'Pintura, papeles pintados y remates finales',                '#7C3AED', 80),
  ('Equipamiento y mobiliario',        'Cocinas, baños, iluminación y mobiliario',                   '#DB2777', 90)
ON CONFLICT DO NOTHING;
