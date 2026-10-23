-- Presupuestos paramétricos · varios documentos por obra
--
-- Una obra puede venir de varios presupuestos (obra + demolición aparte…), cada uno
-- con su fecha, su constructor y su ajuste INE. La lista vive en
-- pp_obras.extraccion->'documentos'; cada partida apunta a su posición en esa lista.

alter table public.pp_obra_partidas
  add column if not exists documento int not null default 0;

notify pgrst, 'reload schema';
