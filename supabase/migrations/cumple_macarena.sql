-- Tablas para cumpleaños de Macarena
-- Temporal: mini RSVP app dentro del mismo proyecto

CREATE TABLE IF NOT EXISTS cumple_invitados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  token text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cumple_rsvp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invitado_id uuid UNIQUE REFERENCES cumple_invitados(id) ON DELETE CASCADE,
  asiste boolean NOT NULL,
  menu_opcion text,
  comentario text,
  updated_at timestamptz DEFAULT now()
);

-- Invitadas iniciales
INSERT INTO cumple_invitados (nombre, token)
VALUES
  ('Filipa',  encode(gen_random_bytes(6), 'hex')),
  ('Vera',    encode(gen_random_bytes(6), 'hex'))
ON CONFLICT (token) DO NOTHING;
