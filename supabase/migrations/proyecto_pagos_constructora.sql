-- ══════════════════════════════════════════════════════════════════════════════
-- Pagos constructora: programa preliminar de pagos a la constructora
-- Vinculado a proyectos (tabla clientes, no FP Execution)
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.proyecto_pagos_constructora (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id       uuid        NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  concepto          text        NOT NULL,
  importe_estimado  numeric(12,2),
  fecha_estimada    date        NOT NULL,
  status            text        NOT NULL DEFAULT 'pendiente'
                    CHECK (status IN ('proximo', 'pendiente', 'pagado')),
  orden             int         NOT NULL DEFAULT 0,
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_constructora_proyecto
  ON public.proyecto_pagos_constructora(proyecto_id);

ALTER TABLE public.proyecto_pagos_constructora ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_select" ON public.proyecto_pagos_constructora
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('fp_partner', 'fp_manager', 'fp_team')
    )
  );

CREATE POLICY "privileged_insert" ON public.proyecto_pagos_constructora
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('fp_partner', 'fp_manager')
    )
  );

CREATE POLICY "privileged_update" ON public.proyecto_pagos_constructora
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('fp_partner', 'fp_manager')
    )
  );

CREATE POLICY "privileged_delete" ON public.proyecto_pagos_constructora
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rol IN ('fp_partner', 'fp_manager')
    )
  );

COMMIT;
