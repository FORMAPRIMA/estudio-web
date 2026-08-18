-- Web pública — foto y uso de cada obra del mapa.
--
-- Hasta ahora el sitio solo sabía enseñar los proyectos con dossier preparado.
-- Con estos dos campos, las obras que existen pero no tienen material dejan de ser
-- invisibles: el mapa pasa de índice de puntos a archivo de obra del estudio.
--
-- `uso` guarda un CÓDIGO de la lista cerrada de lib/web-mapa.ts (residencial,
-- comercial, hosteleria, oficinas, equipamiento, industrial, otros). Cerrada y no
-- libre para que una leyenda o un filtro puedan agrupar; la etiqueta se pinta en
-- español o inglés al vuelo.
--
-- Los dos son respaldo: cuando el punto enlaza a un proyecto publicado, la tarjeta
-- prefiere la portada y la tipología de la ficha, que ya están escritas.

alter table public.web_mapa_puntos
  add column if not exists imagen_url text,
  add column if not exists uso        text;

notify pgrst, 'reload schema';
