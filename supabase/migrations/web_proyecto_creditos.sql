-- Web pública — créditos de un proyecto (equipo, partners y proveedores).
--
-- Una sola columna jsonb y no una tabla aparte: es exactamente la misma forma que
-- `media`, se edita en el mismo formulario y se guarda en el mismo update. Una
-- tabla obligaría a una segunda action, una segunda consulta y a reordenar entre
-- dos almacenes, a cambio de una integridad referencial que aquí no aporta: los
-- créditos del equipo guardan el `equipo_id` y resuelven nombre, rol y enlace
-- contra web_equipo al pintar, así que un miembro que cambia de puesto se edita
-- en un sitio igualmente.
--
-- Forma de cada elemento:
--   { grupo: 'equipo'|'partner'|'proveedor',
--     equipo_id?: uuid,   -- solo grupo 'equipo'
--     nombre?: text,      -- solo partners y proveedores
--     rol_es?: text, rol_en?: text, url?: text }

alter table public.web_proyectos
  add column if not exists creditos jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
