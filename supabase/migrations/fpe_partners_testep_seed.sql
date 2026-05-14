-- ══════════════════════════════════════════════════════════════════════════════
-- FP Execution — Seed de Execution Partners de PRUEBA (TestEP)
-- ──────────────────────────────────────────────────────────────────────────────
-- Crea UN partner placeholder por cada disciplina activa de fpe_disciplines.
--
-- Constantes (compartidas por todos los TestEP):
--   email_contacto / email_notificaciones / email_facturacion → pruebaprovedoresjitbrick@gmail.com
--   telefono                                                  → +34697880068
--   pais                                                      → España
--
-- Variables identificables (derivadas del nombre de la disciplina):
--   nombre           → "TestEP <Disciplina>"
--   razon_social     → "TestEP <Disciplina> S.L."
--   contacto_nombre  → "Test Contacto <Disciplina>"
--   direccion        → "Calle <Disciplina> 1"
--   ciudad           → "Ciudad <Disciplina>"
--   codigo_postal    → "T" + 4 dígitos derivados del nombre (siempre el mismo por disciplina)
--   nif_cif          → "B" + 8 dígitos derivados del nombre
--   iban             → "ES99 TEST <ascii del nombre> 0000 0000 0001"  (truncado a 24 chars sin espacios)
--   notas            → "Partner de prueba — disciplina: <Disciplina>"
--
-- También crea la relación 1:1 en fpe_partner_disciplines para que cada
-- TestEP esté tagueado con su disciplina y aparezca como candidato en tenders.
--
-- IDEMPOTENTE: si ya existe un partner con ese nombre, se actualiza en vez de
-- duplicar. Re-ejecutable sin riesgo.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Paso A: upsert de partners (uno por disciplina activa) ───────────────────

WITH disc AS (
  SELECT
    id,
    nombre,
    -- Hash determinista del nombre para generar NIF / CP estables
    abs(hashtext(nombre)) AS h
  FROM public.fpe_disciplines
  WHERE activo = true
),
prepared AS (
  SELECT
    id                                                          AS discipline_id,
    nombre                                                      AS disc_nombre,
    'TestEP ' || nombre                                         AS partner_nombre,
    'TestEP ' || nombre || ' S.L.'                              AS partner_razon_social,
    'Test Contacto ' || nombre                                  AS partner_contacto_nombre,
    'Calle ' || nombre || ' 1'                                  AS partner_direccion,
    'Ciudad ' || nombre                                         AS partner_ciudad,
    'T' || lpad((h % 10000)::text, 4, '0')                      AS partner_cp,
    'B' || lpad((h % 100000000)::text, 8, '0')                  AS partner_nif,
    -- IBAN ficticio identificable: ES99 + "TEST" + dígitos hash del nombre
    'ES99 TEST ' || lpad((h % 100000000)::text, 8, '0') || ' '
                 || lpad((h % 100000000)::text, 8, '0')         AS partner_iban,
    'Partner de prueba — disciplina: ' || nombre                AS partner_notas
  FROM disc
)
INSERT INTO public.fpe_partners (
  nombre, razon_social, nif_cif, contacto_nombre,
  email_contacto, email_notificaciones, email_facturacion,
  telefono, direccion, ciudad, codigo_postal, pais,
  iban, notas, activo
)
SELECT
  partner_nombre,
  partner_razon_social,
  partner_nif,
  partner_contacto_nombre,
  'pruebaprovedoresjitbrick@gmail.com',
  'pruebaprovedoresjitbrick@gmail.com',
  'pruebaprovedoresjitbrick@gmail.com',
  '+34697880068',
  partner_direccion,
  partner_ciudad,
  partner_cp,
  'España',
  partner_iban,
  partner_notas,
  true
FROM prepared
WHERE NOT EXISTS (
  SELECT 1 FROM public.fpe_partners p WHERE p.nombre = prepared.partner_nombre
);

-- ── Paso B: asegurar update si el partner ya existía (idempotencia real) ──────
-- (ON CONFLICT no actúa sin UNIQUE en `nombre`; este UPDATE refresca campos
--  para los TestEP existentes por si se reejecuta tras editarlos.)

UPDATE public.fpe_partners p
SET
  razon_social         = 'TestEP ' || d.nombre || ' S.L.',
  nif_cif              = 'B' || lpad((abs(hashtext(d.nombre)) % 100000000)::text, 8, '0'),
  contacto_nombre      = 'Test Contacto ' || d.nombre,
  email_contacto       = 'pruebaprovedoresjitbrick@gmail.com',
  email_notificaciones = 'pruebaprovedoresjitbrick@gmail.com',
  email_facturacion    = 'pruebaprovedoresjitbrick@gmail.com',
  telefono             = '+34697880068',
  direccion            = 'Calle ' || d.nombre || ' 1',
  ciudad               = 'Ciudad ' || d.nombre,
  codigo_postal        = 'T' || lpad((abs(hashtext(d.nombre)) % 10000)::text, 4, '0'),
  pais                 = 'España',
  iban                 = 'ES99 TEST '
                         || lpad((abs(hashtext(d.nombre)) % 100000000)::text, 8, '0')
                         || ' '
                         || lpad((abs(hashtext(d.nombre)) % 100000000)::text, 8, '0'),
  notas                = 'Partner de prueba — disciplina: ' || d.nombre,
  activo               = true,
  updated_at           = now()
FROM public.fpe_disciplines d
WHERE p.nombre = 'TestEP ' || d.nombre
  AND d.activo = true;

-- ── Paso C: vincular cada TestEP con su disciplina ───────────────────────────

INSERT INTO public.fpe_partner_disciplines (partner_id, discipline_id)
SELECT p.id, d.id
FROM public.fpe_disciplines d
JOIN public.fpe_partners    p ON p.nombre = 'TestEP ' || d.nombre
WHERE d.activo = true
ON CONFLICT (partner_id, discipline_id) DO NOTHING;

-- ── Verificación (opcional, comentar en producción) ──────────────────────────

-- SELECT
--   p.nombre, p.nif_cif, p.email_contacto, p.iban, p.codigo_postal,
--   d.nombre AS disciplina
-- FROM public.fpe_partners p
-- JOIN public.fpe_partner_disciplines pd ON pd.partner_id = p.id
-- JOIN public.fpe_disciplines d ON d.id = pd.discipline_id
-- WHERE p.nombre LIKE 'TestEP %'
-- ORDER BY d.orden;
