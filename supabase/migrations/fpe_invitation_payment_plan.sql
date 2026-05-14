-- Plan de pago materializado por invitación de licitación.
-- Cada partner invitado tiene su propio plan editable (solo % y trigger,
-- sin montos — los importes aparecen cuando el partner mete precios en su bid).
-- Cuando se adjudica, este plan se copia a fpe_contract_payment_schedule.

CREATE TABLE IF NOT EXISTS public.fpe_invitation_payment_plan (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id   uuid NOT NULL REFERENCES public.fpe_tender_invitations(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  pct             numeric(5,2) NOT NULL CHECK (pct > 0 AND pct <= 100),
  trigger_type    text NOT NULL DEFAULT 'milestone_achieved'
                  CHECK (trigger_type IN ('contract_signed', 'milestone_achieved', 'delivery')),
  milestone_id    uuid REFERENCES public.fpe_template_milestones(id) ON DELETE SET NULL,
  source_discipline_id uuid REFERENCES public.fpe_disciplines(id) ON DELETE SET NULL,
  orden           int NOT NULL DEFAULT 0,
  notas           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fpe_invitation_payment_plan_invitation_idx
  ON public.fpe_invitation_payment_plan (invitation_id, orden);

NOTIFY pgrst, 'reload schema';
