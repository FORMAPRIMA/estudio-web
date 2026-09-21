-- Web pública — FP Tools: subpágina por capacidad.
--
-- Hasta ahora /fp-tools era una sola página con un bloque por tool. Cada tool
-- pasa a tener además su propia página, que abre con su vídeo explicativo a
-- pantalla completa y sigue con los bloques que se le añadan aquí abajo.
--
-- Dos cosas nuevas en la tabla que ya existía:
--   · `slug`, para que la subpágina tenga una URL estable y legible.
--   · el vídeo y su póster. Van en la propia fila y no en `web_content` porque
--     pertenecen a la tool, no a la página: si se borra la tool se van con ella.
-- Vídeo y póster viven en el bucket público `web-publica`, como el resto.

alter table public.web_fp_tools add column if not exists slug              text;
alter table public.web_fp_tools add column if not exists video_url         text;
alter table public.web_fp_tools add column if not exists video_poster_url  text;

-- Relleno de los slugs que falten a partir del nombre. Sin acentos, sin signos y
-- sin colisiones: si dos tools se llamaran igual, la segunda lleva sufijo.
-- `regexp_replace` con 'g' y `unaccent` no está garantizado en todas las
-- instalaciones, así que se traduce a mano lo que de verdad aparece en castellano.
update public.web_fp_tools t
set slug = sub.candidato
from (
  select
    id,
    coalesce(
      nullif(
        trim(both '-' from
          regexp_replace(
            lower(translate(nombre, 'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
                                    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
            '[^a-z0-9]+', '-', 'g'
          )
        ),
        ''
      ),
      'tool'
    ) || case when row_number() over (partition by lower(nombre) order by orden, created_at) > 1
              then '-' || (row_number() over (partition by lower(nombre) order by orden, created_at))::text
              else '' end as candidato
  from public.web_fp_tools
) sub
where t.id = sub.id and (t.slug is null or t.slug = '');

create unique index if not exists web_fp_tools_slug_idx on public.web_fp_tools (slug);

-- ── Bloques de la subpágina ────────────────────────────────────────────────
-- Un constructor mínimo, no un CMS de propósito general: cuatro formas que el
-- sitio ya sabe maquetar. Más tipos serían más formas de que dos tools no se
-- parezcan entre sí, que es justo lo que no queremos.
--
--   texto  — un párrafo ancho con su antetítulo. La voz de la página.
--   dueto  — imagen y texto en dos columnas, alternables.
--   imagen — una lámina sola, con pie opcional.
--   cita   — una frase destacada, sin imagen.
create table if not exists public.web_fp_tool_bloques (
  id          uuid primary key default gen_random_uuid(),
  tool_id     uuid not null references public.web_fp_tools(id) on delete cascade,
  tipo        text not null default 'texto' check (tipo in ('texto', 'dueto', 'imagen', 'cita')),
  titulo_es   text,
  titulo_en   text,
  cuerpo_es   text,
  cuerpo_en   text,
  imagen_url  text,
  pie_es      text,
  pie_en      text,
  -- Solo para 'dueto': la imagen a la derecha en vez de a la izquierda.
  invertido   boolean not null default false,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists web_fp_tool_bloques_tool_idx
  on public.web_fp_tool_bloques (tool_id, orden asc, created_at asc);

alter table public.web_fp_tool_bloques enable row level security;

notify pgrst, 'reload schema';
