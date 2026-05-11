-- Nueva tabla para el RSVP de formulario libre (sin invitados pre-creados)
-- Los papás rellenan el formulario con el nombre del niño

CREATE TABLE IF NOT EXISTS cumple_form_rsvp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_nino text NOT NULL,
  asiste boolean NOT NULL,
  menu_opcion text,  -- 'pizza' | 'perrito' | null (si no asiste)
  created_at timestamptz DEFAULT now()
);
