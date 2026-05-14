ALTER TABLE public.fpe_template_milestones
  ADD COLUMN IF NOT EXISTS es_hito_pago boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.fpe_discipline_payment_milestones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_id   uuid NOT NULL REFERENCES public.fpe_disciplines(id) ON DELETE CASCADE,
  milestone_id    uuid REFERENCES public.fpe_template_milestones(id) ON DELETE SET NULL,
  trigger_type    text NOT NULL DEFAULT 'milestone_achieved'
                  CHECK (trigger_type IN ('contract_signed', 'milestone_achieved', 'delivery')),
  nombre          text NOT NULL,
  pct             numeric(5,2) NOT NULL CHECK (pct > 0 AND pct <= 100),
  orden           int NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.fpe_tender_invitations
  ADD COLUMN IF NOT EXISTS governing_discipline_id uuid REFERENCES public.fpe_disciplines(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.fpe_contract_payment_schedule (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id                     uuid NOT NULL REFERENCES public.fpe_contracts(id) ON DELETE CASCADE,
  discipline_payment_milestone_id uuid REFERENCES public.fpe_discipline_payment_milestones(id) ON DELETE SET NULL,
  nombre                          text NOT NULL,
  pct                             numeric(5,2) NOT NULL,
  monto                           numeric(12,2) NOT NULL DEFAULT 0,
  milestone_id                    uuid REFERENCES public.fpe_template_milestones(id) ON DELETE SET NULL,
  status                          text NOT NULL DEFAULT 'pendiente'
                                  CHECK (status IN ('pendiente', 'facturado', 'cobrado')),
  fecha_estimada                  date,
  fecha_pago                      date,
  orden                           int NOT NULL DEFAULT 0,
  created_at                      timestamptz DEFAULT now(),
  updated_at                      timestamptz DEFAULT now()
);

NOTIFY pgrst, 'reload schema';
