-- Web pública — variantes optimizadas de cada imagen.
--
-- Auditoría de ago 2026: el bucket servía 775 MB de originales de cámara y render
-- (16–28 MP) sin pasar por ningún optimizador. La página de L16 pesaba 142 MB.
--
-- Esta tabla es la capa de indirección que arregla eso SIN migrar ni una columna
-- existente. Está indexada por la URL original que ya guardan web_proyectos,
-- web_equipo, web_content y compañía: al leer, los server actions preguntan aquí
-- y devuelven el srcset; si la URL no tiene fila, se sirve el original como
-- siempre. Consecuencias buscadas:
--   · el CMS no cambia — sigue guardando la URL del fichero que sube;
--   · las fotos antiguas nunca se rompen;
--   · borrar esta tabla devuelve el sitio exactamente al estado anterior.
--
-- `variantes` guarda el juego compacto que define lib/web-publica/imagenes.ts:
--   { stem, avif: [anchos], webp: [anchos], w, h }
-- Con el stem se reconstruyen todas las URL, así que no se almacena ninguna:
-- los ficheros viven en web-publica/v2/<stem>-<ancho>.<formato>.

create table if not exists public.web_assets (
  -- URL pública del original. Clave primaria: es como lo referencian las demás
  -- tablas, y garantiza que un asset no se registre dos veces.
  origen_url  text primary key,

  -- md5 truncado a 12 hex del fichero original. No es único: si la misma foto se
  -- subió con dos rutas distintas —pasa 17 veces en el catálogo actual— ambas
  -- filas comparten stem y por tanto los mismos ficheros derivados.
  stem        text not null,

  ancho       integer not null,
  alto        integer not null,
  variantes   jsonb   not null,

  -- Peso del original y suma de los derivados, para poder medir el ahorro sin
  -- volver a recorrer el bucket.
  bytes_origen    bigint,
  bytes_variantes bigint,

  -- 'lotes' = proceso adaptativo con búsqueda de SSIM; 'subida' = camino rápido
  -- con calidad calibrada desde el CMS. Sirve para saber qué convendría rehacer
  -- si algún día se afina la calibración.
  metodo      text not null default 'subida',

  creado_en   timestamptz not null default now()
);

-- Buscar por stem al deduplicar y al limpiar derivados huérfanos.
create index if not exists web_assets_stem_idx on public.web_assets (stem);

alter table public.web_assets enable row level security;

-- Lectura pública: son variantes de imágenes que ya se sirven desde un bucket
-- público, no hay nada que proteger y el sitio las necesita para pintar.
drop policy if exists "web_assets lectura publica" on public.web_assets;
create policy "web_assets lectura publica"
  on public.web_assets for select
  using (true);

-- Escritura solo con service_role (los server actions). Sin policy de insert /
-- update / delete, ningún cliente con anon key puede tocarla.

notify pgrst, 'reload schema';


-- ── Registro del catálogo ya procesado (ago 2026) ─────────────────────────────
-- 81 assets: 62 imágenes únicas resueltas a 79
-- referencias (los duplicados byte a byte comparten stem, y por tanto derivados)
-- más 2 vídeos con su variante AV1.
-- Los ficheros ya están subidos en web-publica/v2/: este insert solo los declara.

insert into public.web_assets (origen_url, stem, ancho, alto, variantes, bytes_origen, bytes_variantes, metodo) values
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785948887860-7z89zeu72hl.jpeg', 'f5cba1a3740f', 4096, 4096, '{"stem":"f5cba1a3740f","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4096,"h":4096}'::jsonb, 9291839, 3671206, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785948913276-pn294ldg3z.jpeg', '7e270ae87695', 4800, 3584, '{"stem":"7e270ae87695","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4800,"h":3584}'::jsonb, 8804279, 2716700, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785948915451-wdfzw6pdpxk.jpeg', '54d1b0a3114e', 4096, 4096, '{"stem":"54d1b0a3114e","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4096,"h":4096}'::jsonb, 9476002, 4077859, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785948917432-z6kvzsruojn.jpeg', '3ce193b8099f', 3584, 4800, '{"stem":"3ce193b8099f","avif":[480,768,1080,1440,1920,2560,3584],"webp":[480,1080,1920],"w":3584,"h":4800}'::jsonb, 9949793, 6208695, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785948943267-8g6w3p3ay7t.jpeg', 'f5cba1a3740f', 4096, 4096, '{"stem":"f5cba1a3740f","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4096,"h":4096}'::jsonb, 9291839, 3671206, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785949489680-9rnew7j7n.jpg', '73d81d0aae5c', 6498, 4332, '{"stem":"73d81d0aae5c","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":6498,"h":4332}'::jsonb, 19032440, 2002329, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785949504749-7pq9gmvx35c.jpg', '0a3a2aa2201e', 4288, 5718, '{"stem":"0a3a2aa2201e","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4288,"h":5718}'::jsonb, 16608873, 4453693, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785949648285-bvcvxws5khm.jpg', '1e20d21350b4', 4466, 5955, '{"stem":"1e20d21350b4","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4466,"h":5955}'::jsonb, 19405826, 6534055, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785949652520-loftdsa86td.jpg', '904c82e09a76', 6372, 4248, '{"stem":"904c82e09a76","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":6372,"h":4248}'::jsonb, 18571395, 1676998, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785949656237-p88ce5008cm.jpg', '4baa743daf34', 4393, 5858, '{"stem":"4baa743daf34","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4393,"h":5858}'::jsonb, 18372499, 4949044, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785949853348-65p9g5iizyp.jpg', '4e1a55531c16', 5000, 3333, '{"stem":"4e1a55531c16","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":5000,"h":3333}'::jsonb, 3393147, 2410963, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785949890356-f1kiyknkgho.jpg', '94b2eb661626', 3333, 5000, '{"stem":"94b2eb661626","avif":[480,768,1080,1440,1920,2560,3333],"webp":[480,1080,1920],"w":3333,"h":5000}'::jsonb, 2817911, 3375856, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785949948678-3atfx9avqxt.jpg', '90d400232178', 5000, 3333, '{"stem":"90d400232178","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":5000,"h":3333}'::jsonb, 3003119, 1710612, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785949951111-c1kwxwllx08.jpg', 'aa1eff69861c', 3333, 5000, '{"stem":"aa1eff69861c","avif":[480,768,1080,1440,1920,2560,3333],"webp":[480,1080,1920],"w":3333,"h":5000}'::jsonb, 3707764, 3787202, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785949952371-whogzxobp09.jpg', '73a4138e3769', 5000, 3333, '{"stem":"73a4138e3769","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":5000,"h":3333}'::jsonb, 3355101, 2186138, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785950394065-rgyj5drhxei.jpeg', 'f5cba1a3740f', 4096, 4096, '{"stem":"f5cba1a3740f","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4096,"h":4096}'::jsonb, 9291839, 3671206, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785950514384-56vbdug1g6.jpeg', '7e270ae87695', 4800, 3584, '{"stem":"7e270ae87695","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4800,"h":3584}'::jsonb, 8804279, 2716700, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785950545344-bywuriuvtia.jpeg', '54d1b0a3114e', 4096, 4096, '{"stem":"54d1b0a3114e","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4096,"h":4096}'::jsonb, 9476002, 4077859, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785950580810-lcjs18m31v.jpeg', '3ce193b8099f', 3584, 4800, '{"stem":"3ce193b8099f","avif":[480,768,1080,1440,1920,2560,3584],"webp":[480,1080,1920],"w":3584,"h":4800}'::jsonb, 9949793, 6208695, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785951043608-y53t7jkuaz.jpg', '4baa743daf34', 4393, 5858, '{"stem":"4baa743daf34","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4393,"h":5858}'::jsonb, 18372499, 4949044, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785951048267-h4vupln20z7.jpg', 'ce86e1dda617', 4352, 5803, '{"stem":"ce86e1dda617","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4352,"h":5803}'::jsonb, 17230903, 5030911, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785951052732-kod8kxtt2kt.jpg', '904c82e09a76', 6372, 4248, '{"stem":"904c82e09a76","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":6372,"h":4248}'::jsonb, 18571395, 1676998, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785951055822-2tatiajfuq2.jpg', '1e20d21350b4', 4466, 5955, '{"stem":"1e20d21350b4","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4466,"h":5955}'::jsonb, 19405826, 6534055, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785951059778-3lvm7770pxy.jpg', '0a3a2aa2201e', 4288, 5718, '{"stem":"0a3a2aa2201e","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4288,"h":5718}'::jsonb, 16608873, 4453693, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785951065877-xk4br1e7kb9.jpg', 'f58a8d95b731', 3966, 5288, '{"stem":"f58a8d95b731","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":3966,"h":5288}'::jsonb, 14156624, 5359352, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785951616679-wq7jadpno4.jpg', 'f38753de15d9', 4424, 5898, '{"stem":"f38753de15d9","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4424,"h":5898}'::jsonb, 19623426, 6286055, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785951752681-4if94kaqb8r.png', 'fa9eff902ec1', 5504, 3072, '{"stem":"fa9eff902ec1","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":5504,"h":3072}'::jsonb, 24990868, 3424159, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785951757904-4ubmq9so0ki.png', 'a9a20a6abb00', 4096, 4096, '{"stem":"a9a20a6abb00","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4096,"h":4096}'::jsonb, 22926947, 3663436, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785951761520-gafnz4l6ayw.png', '0282d34ebf3f', 4800, 3584, '{"stem":"0282d34ebf3f","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4800,"h":3584}'::jsonb, 19379426, 542826, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785951765251-uxrja4246xg.jpeg', 'cf43c9be585a', 3584, 4800, '{"stem":"cf43c9be585a","avif":[480,768,1080,1440,1920,2560,3584],"webp":[480,1080,1920],"w":3584,"h":4800}'::jsonb, 10326693, 4707331, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785952187234-mv7ju9fw6f.jpg', '4aa7f20979b1', 2048, 1366, '{"stem":"4aa7f20979b1","avif":[480,768,1080,1440,1920,2048],"webp":[480,1080,1920],"w":2048,"h":1366}'::jsonb, 1642326, 1360182, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785952189461-z6fj1pu082o.jpg', 'cc481e9b6ce8', 1366, 2048, '{"stem":"cc481e9b6ce8","avif":[480,768,1080,1366],"webp":[480,1080],"w":1366,"h":2048}'::jsonb, 1301446, 758988, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785952190201-qyc2g87xbog.jpg', '7e6061ea3d53', 1366, 2048, '{"stem":"7e6061ea3d53","avif":[480,768,1080,1366],"webp":[480,1080],"w":1366,"h":2048}'::jsonb, 1301073, 536318, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1785952190930-xeunl7b583.jpg', '0318148b1287', 1366, 2048, '{"stem":"0318148b1287","avif":[480,768,1080,1366],"webp":[480,1080],"w":1366,"h":2048}'::jsonb, 2013380, 1037832, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786032593488-sqn060je7vj.jpg', 'aa1eff69861c', 3333, 5000, '{"stem":"aa1eff69861c","avif":[480,768,1080,1440,1920,2560,3333],"webp":[480,1080,1920],"w":3333,"h":5000}'::jsonb, 3707764, 3787202, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786032595942-22kdjna21x9.jpg', '90d400232178', 5000, 3333, '{"stem":"90d400232178","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":5000,"h":3333}'::jsonb, 3003119, 1710612, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786032596855-8f673ftfzzb.jpg', '73a4138e3769', 5000, 3333, '{"stem":"73a4138e3769","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":5000,"h":3333}'::jsonb, 3355101, 2186138, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786032658087-xfs8tujk5o.jpg', 'd1303736f00e', 5000, 3333, '{"stem":"d1303736f00e","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":5000,"h":3333}'::jsonb, 2812359, 1502377, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786032660676-wtfu7dlumf.jpg', 'd9805d1af894', 3333, 5000, '{"stem":"d9805d1af894","avif":[480,768,1080,1440,1920,2560,3333],"webp":[480,1080,1920],"w":3333,"h":5000}'::jsonb, 2394023, 1510981, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786036744480-mnv6q7oj4fq.jpg', '387d3e42e445', 4281, 5708, '{"stem":"387d3e42e445","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4281,"h":5708}'::jsonb, 22811074, 7436589, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786036750103-6dcdx7bplep.jpg', '07066f8e4c43', 4343, 5791, '{"stem":"07066f8e4c43","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4343,"h":5791}'::jsonb, 16349621, 3883169, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786036753171-frymn2vretp.jpg', '50c2dcf0ca82', 4356, 5808, '{"stem":"50c2dcf0ca82","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4356,"h":5808}'::jsonb, 15583452, 2675860, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786036755926-pugt7ykwbeo.jpg', '961af0d0b048', 4480, 5973, '{"stem":"961af0d0b048","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4480,"h":5973}'::jsonb, 16254459, 2020861, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786036758906-lraypri23sj.jpg', '3b90a1dfa0a0', 4396, 5862, '{"stem":"3b90a1dfa0a0","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4396,"h":5862}'::jsonb, 19425842, 4627269, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786036763415-62d2ejgnp08.jpg', '2ab8ac1996e3', 4263, 5684, '{"stem":"2ab8ac1996e3","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4263,"h":5684}'::jsonb, 14169976, 2124389, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/1786036766381-ryuijxuydkb.jpg', '93ecb8972a48', 4444, 5926, '{"stem":"93ecb8972a48","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4444,"h":5926}'::jsonb, 17929839, 3974544, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/content/1784733315946-88tpzuo6uvm.jpeg', '754debf907f2', 6000, 4000, '{"stem":"754debf907f2","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":6000,"h":4000}'::jsonb, 11957487, 3494350, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/content/1784800072293-ol7p1uk9sqc.jpg', '1281fc5d87cb', 1706, 2560, '{"stem":"1281fc5d87cb","avif":[480,768,1080,1440,1706],"webp":[480,1080],"w":1706,"h":2560}'::jsonb, 890420, 1545836, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/content/1784800078287-qanrwvczuw8.jpg', '6e8f100f3e9f', 1706, 2560, '{"stem":"6e8f100f3e9f","avif":[480,768,1080,1440,1706],"webp":[480,1080],"w":1706,"h":2560}'::jsonb, 917937, 1659981, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784736253973-3hdp4lbs853.jpeg', '1389c6d310a3', 4000, 6000, '{"stem":"1389c6d310a3","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4000,"h":6000}'::jsonb, 9025471, 2235133, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784736259666-8686pv6jiph.jpeg', '0895c5bc5c4a', 4000, 6000, '{"stem":"0895c5bc5c4a","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4000,"h":6000}'::jsonb, 7556159, 1056930, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784798261540-vkqg47fw6fq.jpg', 'de36a1f0bd31', 1706, 2560, '{"stem":"de36a1f0bd31","avif":[480,768,1080,1440,1706],"webp":[480,1080],"w":1706,"h":2560}'::jsonb, 595804, 266057, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784798906864-euph4id7cv6.jpg', '296cc1b1fe5a', 1706, 2560, '{"stem":"296cc1b1fe5a","avif":[480,768,1080,1440,1706],"webp":[480,1080],"w":1706,"h":2560}'::jsonb, 533584, 312527, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784798913028-4slmodusq0b.jpg', '296cc1b1fe5a', 1706, 2560, '{"stem":"296cc1b1fe5a","avif":[480,768,1080,1440,1706],"webp":[480,1080],"w":1706,"h":2560}'::jsonb, 533584, 312527, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784798967509-2wzxbgo4o9q.jpg', '9b5dc23e2d69', 1706, 2560, '{"stem":"9b5dc23e2d69","avif":[480,768,1080,1440,1706],"webp":[480,1080],"w":1706,"h":2560}'::jsonb, 632523, 446695, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784798970046-veuoxpd1dwg.jpg', '9b5dc23e2d69', 1706, 2560, '{"stem":"9b5dc23e2d69","avif":[480,768,1080,1440,1706],"webp":[480,1080],"w":1706,"h":2560}'::jsonb, 632523, 446695, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784799060112-lc6ulpa69sg.jpg', '1cf879f1e8a0', 1706, 2560, '{"stem":"1cf879f1e8a0","avif":[480,768,1080,1440,1706],"webp":[480,1080],"w":1706,"h":2560}'::jsonb, 465579, 217802, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784799062686-jcoylruo4kh.jpg', '1cf879f1e8a0', 1706, 2560, '{"stem":"1cf879f1e8a0","avif":[480,768,1080,1440,1706],"webp":[480,1080],"w":1706,"h":2560}'::jsonb, 465579, 217802, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784799146585-alzudfqs5u6.png', '98f0f2b575ce', 1704, 2560, '{"stem":"98f0f2b575ce","avif":[480,768,1080,1440,1704],"webp":[480,1080],"w":1704,"h":2560}'::jsonb, 3727582, 192012, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784799150252-oef3lsuymui.png', '98f0f2b575ce', 1704, 2560, '{"stem":"98f0f2b575ce","avif":[480,768,1080,1440,1704],"webp":[480,1080],"w":1704,"h":2560}'::jsonb, 3727582, 192012, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784799241227-dygs43nkl2k.png', '10ab32380332', 1915, 2560, '{"stem":"10ab32380332","avif":[480,768,1080,1440,1915],"webp":[480,1080],"w":1915,"h":2560}'::jsonb, 4346798, 276512, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1784799243733-rqd6g2lx3i.png', '10ab32380332', 1915, 2560, '{"stem":"10ab32380332","avif":[480,768,1080,1440,1915],"webp":[480,1080],"w":1915,"h":2560}'::jsonb, 4346798, 276512, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/equipo/1785948533954-1r2p3tkzled.jpg', '0c82bec53a41', 4000, 6000, '{"stem":"0c82bec53a41","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":4000,"h":6000}'::jsonb, 9591298, 2862730, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/fp-tools/1784801374624-ymvfwfof33.jpg', '69634d9a34e1', 3879, 5818, '{"stem":"69634d9a34e1","avif":[480,768,1080,1440,1920,2560,3840],"webp":[480,1080,1920],"w":3879,"h":5818}'::jsonb, 9089399, 4276872, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140147370-agiezl5g44d.webp', 'ff700091e8d3', 2560, 1429, '{"stem":"ff700091e8d3","avif":[480,768,1080,1440,1920,2560],"webp":[480,1080,1920],"w":2560,"h":1429}'::jsonb, 792650, 2237522, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140155427-rmdh6svy6jm.webp', '581824049b4f', 2000, 1493, '{"stem":"581824049b4f","avif":[480,768,1080,1440,1920],"webp":[480,1080,1920],"w":2000,"h":1493}'::jsonb, 75606, 260345, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140181760-i2l0z0vuow.webp', 'bd62537214cb', 1493, 2000, '{"stem":"bd62537214cb","avif":[480,768,1080,1440],"webp":[480,1080],"w":1493,"h":2000}'::jsonb, 415640, 986227, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140196692-7xi38qmn504.webp', 'df98ce8c7a8a', 2000, 2000, '{"stem":"df98ce8c7a8a","avif":[480,768,1080,1440,1920],"webp":[480,1080,1920],"w":2000,"h":2000}'::jsonb, 185784, 626255, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140235702-pqxdh79gm2j.webp', 'fb044ec98cbb', 2048, 1366, '{"stem":"fb044ec98cbb","avif":[480,768,1080,1440,1920,2048],"webp":[480,1080,1920],"w":2048,"h":1366}'::jsonb, 227714, 986484, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140256452-3ityps70u8m.webp', '092eb9a7f043', 1334, 2000, '{"stem":"092eb9a7f043","avif":[480,768,1080,1334],"webp":[480,1080],"w":1334,"h":2000}'::jsonb, 116304, 375358, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140257181-ck64e6xu0te.webp', '458dc3236706', 1334, 2000, '{"stem":"458dc3236706","avif":[480,768,1080,1334],"webp":[480,1080],"w":1334,"h":2000}'::jsonb, 115508, 373035, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140257793-p0qshavism.webp', '3c27a8b57d6d', 1334, 2000, '{"stem":"3c27a8b57d6d","avif":[480,768,1080,1334],"webp":[480,1080],"w":1334,"h":2000}'::jsonb, 68342, 299081, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140724414-e3qeyrsgevu.webp', 'cbc9fadd3429', 1920, 2560, '{"stem":"cbc9fadd3429","avif":[480,768,1080,1440,1920],"webp":[480,1080,1920],"w":1920,"h":2560}'::jsonb, 234072, 846951, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140746633-wuv41da50vm.webp', '3780d48bf040', 1500, 2000, '{"stem":"3780d48bf040","avif":[480,768,1080,1440],"webp":[480,1080],"w":1500,"h":2000}'::jsonb, 112988, 266242, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140748733-670bb3kao37.webp', 'b0d05fd46fea', 1500, 2000, '{"stem":"b0d05fd46fea","avif":[480,768,1080,1440],"webp":[480,1080],"w":1500,"h":2000}'::jsonb, 86776, 217955, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782140750677-uvy63z4au7.webp', 'dbbe6d896d59', 1500, 2000, '{"stem":"dbbe6d896d59","avif":[480,768,1080,1440],"webp":[480,1080],"w":1500,"h":2000}'::jsonb, 102804, 282103, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782141561532-ioeuh0mef3.webp', 'f32d2ebcedad', 893, 1600, '{"stem":"f32d2ebcedad","avif":[480,768,893],"webp":[480],"w":893,"h":1600}'::jsonb, 273138, 631732, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782141583010-86srzi2ums.webp', '25a72156f8de', 1067, 1600, '{"stem":"25a72156f8de","avif":[480,768,1067],"webp":[480],"w":1067,"h":1600}'::jsonb, 83366, 185463, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/opt/1782141799439-3i2hafq38jp.webp', '30bae6f88b70', 1200, 1600, '{"stem":"30bae6f88b70","avif":[480,768,1080],"webp":[480,1080],"w":1200,"h":1600}'::jsonb, 93052, 222054, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/content/1784799430543-oj3snfuhje.mp4', '1c12fd86fe9d', 0, 0, '{"stem":"1c12fd86fe9d","avif":[],"webp":[],"w":0,"h":0,"webm":true}'::jsonb, 6048733, 1900048, 'lotes'),
  ('https://xzzxxpwshgnqpnpahgoh.supabase.co/storage/v1/object/public/web-publica/content/1785000000000-intro-mobile-1080.mp4', '93b180c35dce', 0, 0, '{"stem":"93b180c35dce","avif":[],"webp":[],"w":0,"h":0,"webm":true}'::jsonb, 6458099, 3988970, 'lotes')
on conflict (origen_url) do update set
  stem = excluded.stem, ancho = excluded.ancho, alto = excluded.alto,
  variantes = excluded.variantes, bytes_origen = excluded.bytes_origen,
  bytes_variantes = excluded.bytes_variantes, metodo = excluded.metodo;

notify pgrst, 'reload schema';
