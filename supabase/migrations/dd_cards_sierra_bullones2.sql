-- DD Visits — Cards específicas Sierra Bullones 2
-- Due Diligence Técnica No Invasiva
-- Sustituye las 12 cards placeholder por 24 cards con contenido técnico específico del activo.
-- Idempotente: DELETE condicional (solo sin datos de usuario) + ON CONFLICT DO NOTHING en inserts.

BEGIN;

-- ─── Actualizar datos del activo ──────────────────────────────────────────────

UPDATE public.dd_assets
SET
  cliente       = 'Grupo Hive / ARGIS TETUAN SL',
  superficie_m2 = 531,
  uso_previsto  = 'Hold / renta residencial',
  alcance_dd    = 'Due Diligence Técnica No Invasiva — alcance ejecutivo, visual, no destructivo. Activo con antecedentes documentales sensibles: expedientes DR 2021, requerimientos municipales por plantas, acta de recepción con reservas y posible actuación 2024/2026 sobre planta primera (lavadero, tendedero, instalaciones).',
  updated_at    = now()
WHERE id = 'dd000000-0000-0000-0001-000000000002';

-- ─── Actualizar zonas previstas de la visita ──────────────────────────────────

UPDATE public.dd_visits
SET
  zonas_previstas = ARRAY[
    'Fachada exterior y patios',
    'Acceso, portal y escalera',
    'Zonas comunes',
    'Cubierta',
    'Planta primera — lavaderos y tendederos',
    'Vivienda 2ºD',
    'Vivienda 2ºI',
    'Vivienda 3ºD',
    'Vivienda 3ºI',
    'Cuarto de contadores',
    'Cuartos técnicos y cuadros eléctricos'
  ],
  updated_at = now()
WHERE id = 'dd000000-0000-0000-0002-000000000002';

-- ─── Eliminar cards placeholder sin datos de usuario ─────────────────────────
-- Condición: estado = pendiente, sin comentario técnico y sin media adjunta.
-- Si una card placeholder tiene datos capturados, se preserva.

DELETE FROM public.dd_cards
WHERE
  id IN (
    'dd000000-0000-0000-0004-000000000001',
    'dd000000-0000-0000-0004-000000000002',
    'dd000000-0000-0000-0004-000000000003',
    'dd000000-0000-0000-0004-000000000004',
    'dd000000-0000-0000-0004-000000000005',
    'dd000000-0000-0000-0004-000000000006',
    'dd000000-0000-0000-0004-000000000007',
    'dd000000-0000-0000-0004-000000000008',
    'dd000000-0000-0000-0004-000000000009',
    'dd000000-0000-0000-0004-000000000010',
    'dd000000-0000-0000-0004-000000000011',
    'dd000000-0000-0000-0004-000000000012'
  )
  AND estado = 'pendiente'
  AND comentario_tecnico IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.dd_card_media WHERE card_id = dd_cards.id
  );

-- ─── Cards específicas Sierra Bullones 2 ─────────────────────────────────────
-- Rango de IDs: dd000000-0000-0000-0005-000000000001 a ...0024
-- orden: múltiplos de 10 para facilitar reordenación posterior

INSERT INTO public.dd_cards (
  id, asset_id, visit_id, rol_id,
  titulo, especialidad, zona_edificio, prioridad,
  objetivo_revision, que_revisar, senales_alerta,
  fotos_recomendadas, preguntas_confirmar, documentacion_relacionada,
  orden, estado, riesgo,
  requiere_seguimiento, incluir_revision_interna, activo
) VALUES

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 1 · Arquitecto / Director técnico
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0005-000000000001',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000001',
  'Alcance real de visita y zonas accesibles',
  'Dirección técnica DD',
  'Todo el activo',
  'alta',
  'Confirmar el alcance real de inspección y dejar trazabilidad clara de zonas inspeccionadas, zonas no accesibles y limitaciones.',
  '- Confirmar qué unidades se visitan
- Confirmar acceso al menos al 50% de las unidades
- Confirmar acceso a cubierta, patios, cuartos técnicos, cuarto de contadores, cuadros eléctricos, equipos de climatización/ACS, elementos PCI visibles y ascensor
- Registrar zonas no accesibles y motivo',
  '- Zonas críticas sin acceso
- Cubierta o cuartos técnicos inaccesibles
- Unidades no visitadas sin justificación
- Falta de llaves o ausencia de responsable técnico',
  '- Acceso general al edificio
- Zonas no accesibles
- Puertas cerradas o cuartos sin acceso',
  '- ¿Qué zonas no se podrán visitar y por qué?
- ¿Hay unidades ocupadas o con acceso restringido?
- ¿Quién confirma las zonas inspeccionadas?',
  '- Alcance de Due Diligence Técnica No Invasiva
- Correos de coordinación de visita',
  10, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000002',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000001',
  'Estado de expedientes DR y requerimientos municipales',
  'Revisión documental técnica',
  'General / documental',
  'alta',
  'Confirmar si los expedientes vinculados a declaraciones responsables y requerimientos municipales de 2021 quedaron cerrados favorablemente.',
  '- Preguntar por resoluciones favorables o cierre de expedientes
- Verificar si existe documentación final de subsanación
- Identificar si hay trámites pendientes
- Revisar si lo visitado coincide con lo declarado en las DR',
  '- Solo existe contestación presentada pero no cierre favorable documentado
- La propiedad no puede confirmar el estado final de los expedientes
- Existen actuaciones pendientes o en trámite',
  '- No aplica salvo documentación física disponible en visita',
  '- ¿Los expedientes de 2021 quedaron cerrados favorablemente?
- ¿Existe algún expediente pendiente en la actualidad?
- ¿Hay resolución favorable, cierre o conformidad final del Ayuntamiento?',
  '- Requerimientos municipales 2021 por plantas
- Solicitud de resolución de 2022
- Hoja de encargo Sierra Bullones 2026',
  20, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000003',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000001',
  'Coherencia entre estado actual, planos y uso residencial',
  'Arquitectura y uso',
  'Viviendas y zonas comunes',
  'alta',
  'Verificar visualmente si el estado construido y el uso real son coherentes con la documentación disponible y el uso previsto de hold/renta residencial.',
  '- Número real de unidades y habitaciones
- Distribuciones actuales vs documentación
- Cocinas, baños, habitaciones y zonas húmedas
- Si hay agrupaciones o redistribuciones relevantes no documentadas
- Si hay piezas con ventilación o iluminación dudosa',
  '- Distribuciones notablemente distintas a la documentación
- Espacios usados como habitaciones sin condiciones aparentes adecuadas
- Cocinas interiores o piezas dependientes sin ventilación
- Cambios no reflejados en planos ni en DR',
  '- Distribución general por unidad visitada
- Cocinas (especialmente si son interiores)
- Habitaciones
- Baños
- Piezas con ventilación o iluminación dudosa',
  '- ¿Existen planos finales o As Built de la reforma?
- ¿Hubo cambios de distribución posteriores a las DR?
- ¿La explotación es por vivienda completa, por habitaciones o fórmula mixta?',
  '- Requerimientos municipales 2021
- Documentación técnica de DR
- Checklist DIU Sierra Bullones',
  30, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000004',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000001',
  'Tendederos, lavaderos e integración con vivienda',
  'Arquitectura, habitabilidad y ventilación',
  'Tendederos / lavaderos / planta primera',
  'alta',
  'Revisar visualmente los tendederos/lavaderos y su posible integración a la vivienda, por ser uno de los puntos sensibles detectados en el análisis documental previo.',
  '- Si el tendedero/lavadero está físicamente separado o incorporado a una pieza de vivienda
- Si existe puerta, separación o cambio de uso aparente
- Condiciones de ventilación natural o forzada
- Existencia y operatividad de extracción mecánica
- Signos de humedad, condensación, moho u olores',
  '- Tendedero completamente incorporado a pieza habitable sin separación aparente
- Falta total de ventilación natural o mecánica
- Extracción inexistente o visiblemente no operativa
- Condensación, moho u olores en el espacio',
  '- Tendedero/lavadero: vista general
- Rejillas, extractores o conductos visibles
- Puertas, separaciones o cambios de acabado
- Señales de humedad o condensación',
  '- ¿Qué actuación se realizó o está prevista sobre lavaderos/tendederos?
- ¿Existe documentación de ventilación conforme a HS-3?
- ¿Hay expediente abierto o cerrado relativo a planta primera?',
  '- Requerimientos municipales 2021 (referencia a planta primera, lavadero, tendedero)
- Hoja de encargo Sierra Bullones 2026',
  40, 'pendiente', NULL, true, true, true
),

(
  'dd000000-0000-0000-0005-000000000005',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000001',
  'Cubierta, patios, fachada y accesos de mantenimiento',
  'Envolvente y mantenimiento',
  'Cubierta / patios / fachadas',
  'alta',
  'Revisar el estado visual de cubierta, patios, fachadas y accesos de mantenimiento.',
  '- Acceso real a cubierta y condiciones de seguridad
- Estado de impermeabilización visible
- Sumideros, pendientes y encuentros con paramentos
- Petos, barandillas y seguridad perimetral
- Fachadas a calle y a patios interiores
- Equipos exteriores instalados (climatización, ACS, antenas)',
  '- Cubierta sin acceso seguro o sin acceso posible
- Sumideros obstruidos o mal resueltos
- Parches o reparaciones visibles en impermeabilización
- Humedades visibles bajo cubierta en la planta superior
- Equipos apoyados sin soporte adecuado o sin mantenimiento aparente',
  '- Cubierta completa (general y detalles)
- Sumideros y pendientes
- Petos y barandillas
- Equipos exteriores y soportes
- Fachada a calle
- Fachada a patios interiores',
  '- ¿Quién tiene acceso habitual a la cubierta?
- ¿Hay incidencias históricas de filtraciones desde cubierta?
- ¿Se han realizado reparaciones en cubierta en los últimos años?',
  '- Contestaciones a requerimientos municipales
- Documentación de obra / DR',
  50, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000006',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000001',
  'Operación, ocupación y desgaste por renta',
  'Operación y mantenimiento',
  'Todo el activo',
  'media',
  'Entender cómo se está operando el activo y si el uso real puede generar un nivel de desgaste o CAPEX mayor al esperado en un activo residencial estándar.',
  '- Ocupación actual y rotación estimada de usuarios
- Estado general de limpieza
- Desgaste visible en zonas de alto tránsito
- Quejas o incidencias recurrentes conocidas
- Existencia real de mantenimiento preventivo',
  '- Alto desgaste para la antigüedad de la reforma
- Falta de responsable de mantenimiento identificado
- Incidencias recurrentes no documentadas
- Uso intensivo sin plan de mantenimiento preventivo establecido',
  '- Zonas de alto uso (portal, escalera, pasillos)
- Elementos de zonas comunes deteriorados
- Zonas de habitaciones con alta rotación',
  '- ¿Cuál es el modelo de explotación actual (vivienda, habitaciones, coliving)?
- ¿Existe histórico de incidencias documentado?
- ¿Quién gestiona el mantenimiento del activo?',
  '- Facturas de limpieza
- Facturas de suministros
- Facturas de mantenimiento (Detex, ascensor)',
  60, 'pendiente', NULL, false, false, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 2 · Construcción y acabados
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0005-000000000007',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000002',
  'Remates pendientes vinculados a recepción con reservas',
  'Acabados y control de ejecución',
  'Viviendas y zonas comunes',
  'alta',
  'Verificar si siguen existiendo remates o defectos similares a los señalados en el acta de recepción provisional con reservas de 2021.',
  '- Rodapiés: remates y encuentros
- Mecanismos mal ajustados o sueltos
- Remates de pintura en esquinas y encuentros
- Remates en baños: encuentros de azulejo con carpintería
- Carpinterías y mobiliario fijo: ajuste y funcionamiento
- Alicatados: lechadas abiertas o piezas sueltas',
  '- Mismos defectos del acta visibles en varias unidades
- Remates pendientes claramente no resueltos
- Deterioro prematuro incompatible con antigüedad de la reforma
- Incidencias antiguas del acta todavía visibles',
  '- Rodapiés en habitaciones y pasillos
- Remates de pintura en encuentros
- Mecanismos en malas condiciones
- Baños: encuentros problemáticos
- Carpintería interior',
  '- ¿Existe acta formal de levantamiento de reservas?
- ¿Quién ejecutó la subsanación de los defectos del acta?
- ¿Hay garantías vigentes del constructor o instaladores?',
  '- Acta de recepción provisional con reservas 2021
- Anexo de defectos y deficiencias',
  70, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000008',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000002',
  'Tabiquería, pladur y encuentros',
  'Pladur y tabiquería',
  'Viviendas, baños y zonas húmedas',
  'alta',
  'Revisar el estado visual de tabiques, trasdosados, encuentros y posibles fisuras o humedades asociadas.',
  '- Fisuras en encuentros entre tabiques y forjados
- Juntas de pladur: apertura, deformación
- Encuentros de pladur con carpinterías
- Paramentos adyacentes a baños y lavaderos
- Esquinas, jambas y dinteles',
  '- Fisuras activas o repetidas en varios puntos
- Manchas de humedad en tabiques o trasdosados
- Zonas blandas o visiblemente deformadas
- Encuentros mal resueltos entre pladur y baños',
  '- Fisuras visibles
- Manchas de humedad
- Encuentros con zonas húmedas (baños, lavaderos)
- Juntas de pladur',
  '- ¿Hay incidencias recurrentes de fisuras en tabiques?
- ¿Se han reparado humedades en paramentos interiores?
- ¿Hubo redistribuciones posteriores a la obra principal?',
  '- Documentación técnica de DR
- Acta de recepción con reservas 2021',
  80, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000009',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000002',
  'Falsos techos, registros y humedades visibles',
  'Falsos techos',
  'Baños, pasillos, cocinas, lavaderos',
  'alta',
  'Revisar el estado de los falsos techos y la accesibilidad a instalaciones ocultas dentro del alcance visual no invasivo.',
  '- Registros existentes y accesibilidad
- Manchas de humedad en placas
- Fisuras o deformaciones visibles
- Zonas sin registro con instalaciones ocultas
- Rejillas y pasos de instalaciones',
  '- Humedad activa en falso techo
- Ausencia total de registros en zonas con instalaciones
- Deformaciones visibles en placas
- Instalaciones completamente inaccesibles para mantenimiento',
  '- Falsos techos en baños (general y detalle)
- Registros
- Manchas o deformaciones
- Rejillas y pasos de instalaciones',
  '- ¿Ha habido filtraciones recurrentes desde falsos techos?
- ¿Se han abierto falsos techos por averías de instalaciones?
- ¿Qué instalaciones discurren por cada zona?',
  '- Acta de recepción con reservas 2021
- Requerimientos y documentación técnica',
  90, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000010',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000002',
  'Baños, duchas, alicatados y sellados',
  'Acabados en zonas húmedas',
  'Baños',
  'alta',
  'Revisar visualmente el estado de baños y los puntos más sensibles de filtración o mal remate.',
  '- Alicatados: estado, lechadas, piezas sueltas
- Siliconas en platos de ducha, lavabos y bañeras
- Platos de ducha: nivelación y sumidero
- Sumideros: colocación y sellado
- Encuentros de azulejo con grifería
- Rodapiés y encuentros de azulejo con pladur',
  '- Lechada abierta en juntas (riesgo de filtración)
- Silicona deteriorada, abierta o inexistente
- Sumideros mal colocados o con sellado deficiente
- Humedad visible en muebles o paramentos
- Remates deficientes repetidos en varias unidades',
  '- Vista general de duchas
- Detalle de sumideros
- Juntas y lechadas
- Bajo lavabos (mueble y tomas)
- Alicatados con incidencias',
  '- ¿Ha habido filtraciones entre plantas relacionadas con baños?
- ¿Hay quejas recurrentes por duchas o desagües?
- ¿Se subsanaron específicamente los remates de baños del acta de 2021?',
  '- Acta de recepción provisional con reservas 2021
- Facturas de mantenimiento / operación del activo',
  100, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000011',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000002',
  'Carpintería interior, rodapiés y mobiliario fijo',
  'Carpintería y acabados',
  'Habitaciones y zonas comunes',
  'media',
  'Evaluar el desgaste y funcionamiento aparente de carpintería interior y mobiliario fijo del activo.',
  '- Puertas: ajuste, cierre y herrajes
- Armarios: funcionamiento, bisagras, guías
- Escritorios y canapés si existen
- Rodapiés: remates, golpes, piezas sueltas
- Puertas correderas: ajuste y guías',
  '- Holguras o desajustes generalizados
- Golpes y deterioro por uso intensivo
- Piezas sueltas o desprendidas
- Deterioro incompatible con la antigüedad de la reforma',
  '- Rodapiés en pasillos y habitaciones
- Puertas: estado y ajuste
- Armarios: detalle de bisagras o guías
- Escritorios o mobiliario fijo con deterioro',
  '- ¿Qué mobiliario fijo forma parte del activo a transmitir?
- ¿Hay garantías vigentes de carpintería o mobiliario?
- ¿Hay incidencias recurrentes de carpintería?',
  '- Acta de recepción con reservas 2021',
  110, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0005-000000000012',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000002',
  'Pintura, desgaste y estado general de acabados',
  'Acabados interiores',
  'Todo el activo',
  'media',
  'Evaluar el desgaste aparente por uso y la necesidad de CAPEX ligero en acabados para puesta a punto del activo.',
  '- Pintura: golpes, marcas, manchas y zonas reparadas
- Esquinas y pasillos de alto tránsito
- Deterioro general por rotación de usuarios
- Reparaciones puntuales visibles
- Manchas que puedan indicar humedad subyacente',
  '- Desgaste mayor al esperado para la antigüedad de la reforma
- Reparaciones puntuales visibles en muchos puntos
- Deterioro generalizado que requiera repaso completo
- Manchas que sugieran humedad activa o resuelta',
  '- Pasillos de alto tránsito
- Habitaciones: estado general
- Zonas comunes
- Esquinas con golpes',
  '- ¿Cuándo se hizo el último repaso general de pintura?
- ¿Hay plan de mantenimiento preventivo de acabados?
- ¿Qué zonas tienen mayor rotación de usuarios?',
  '- Facturas de limpieza
- Acta de recepción con reservas 2021',
  120, 'pendiente', NULL, false, false, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 3 · Electricidad y climatización
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0005-000000000013',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'Suministro eléctrico BJ SG y cargas alimentadas',
  'Electricidad',
  'Bajo / servicios generales / cuadros',
  'alta',
  'Identificar qué alimenta el suministro eléctrico identificado como BJ SG y si el consumo/potencia contratada tienen explicación técnica coherente.',
  '- Localizar el cuadro asociado al suministro BJ SG
- Identificar las cargas conectadas: servicios generales, climatización, ACS, ventilación, telecomunicaciones, lavandería común u otros
- Verificar etiquetado de circuitos en el cuadro
- Comprobar si la potencia contratada es coherente con las cargas detectadas',
  '- Cargas conectadas no identificables
- Cuadro sin etiquetado o con etiquetado ilegible
- Consumo elevado sin explicación técnica aparente
- Potencia tensionada o diferenciales que saltan con frecuencia
- Derivaciones o conexiones improvisadas visibles',
  '- Contador y cabecera del suministro BJ SG
- Cuadro general asociado: frontal y abierto
- Etiquetado de circuitos
- Protecciones
- Cargas principales conectadas',
  '- ¿Qué alimenta exactamente el suministro BJ SG?
- ¿Hay registros de saltos de diferencial o incidencias eléctricas?
- ¿Existe esquema unifilar de la instalación?',
  '- Factura Gesternova suministro BJ SG
- Certificados o boletines eléctricos si existen',
  130, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000014',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'Cuadros eléctricos, protecciones y etiquetado',
  'Electricidad',
  'Viviendas, zonas comunes y cuartos técnicos',
  'alta',
  'Revisar el estado visual de los cuadros eléctricos individuales y generales, verificando presencia y estado de protecciones.',
  '- Cuadros eléctricos por unidad: diferenciales, magnetotérmicos, estado
- Cuadros generales: tipo, etiquetado, orden, accesibilidad
- Protección contra sobretensiones si existe
- Cableado visible en zonas de cuadros
- Accesibilidad de registros',
  '- Circuitos sin identificar en cuadros
- Cuadros saturados o con espacio insuficiente
- Protecciones ausentes, dudosas o disparadas de forma permanente
- Cableado improvisado o sin canalización visible
- Registros inaccesibles o precintados',
  '- Cada cuadro abierto con detalle de protecciones
- Etiquetas de circuitos
- Cableado visible en zonas accesibles',
  '- ¿Existen boletines eléctricos por vivienda?
- ¿Cuándo se revisó por última vez la instalación eléctrica?
- ¿Hay averías eléctricas recurrentes?',
  '- Checklist DIU Sierra Bullones
- Facturas de electricidad por suministro
- Documentación de instalaciones pendiente de recibir',
  140, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000015',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'Mecanismos, iluminación y puntos terminales',
  'Electricidad',
  'Viviendas y zonas comunes',
  'media',
  'Revisar el estado visible y funcionamiento básico de mecanismos, luminarias y puntos terminales en viviendas y zonas comunes.',
  '- Interruptores y enchufes: estado, ajuste
- Luminarias: funcionamiento, tipo, completitud
- Iluminación de emergencia en zonas comunes y escalera
- Portal y escalera: iluminación general
- Mecanismos en zonas de alto uso',
  '- Mecanismos flojos o con roturas visibles
- Luminarias fundidas o incompletas en zonas comunes
- Ausencia de iluminación de emergencia reglamentaria
- Puntos deteriorados por uso intensivo repetido',
  '- Mecanismos con defectos visibles
- Luminarias en zonas comunes
- Luminarias de emergencia en escalera y pasillos',
  '- ¿Hay partes de averías eléctricas documentados?
- ¿Quién atiende el mantenimiento eléctrico del activo?
- ¿Hay contrato de mantenimiento eléctrico?',
  '- Acta de recepción con reservas 2021 (referencia a mecanismos)',
  150, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0005-000000000016',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'Climatización, calefacción y equipos exteriores',
  'Climatización',
  'Cubierta, fachada, patios, lavaderos y viviendas',
  'alta',
  'Revisar la ubicación, estado visible y accesibilidad de los equipos de climatización y calefacción, especialmente en relación con requerimientos municipales detectados documentalmente.',
  '- Unidades exteriores: ubicación, soportes y anclajes
- Canalizaciones y líneas de refrigerante visibles
- Desagüe de condensados
- Accesibilidad para mantenimiento
- Ruido o vibración aparente
- Integración en fachada o patio (aspecto visual y normativo)',
  '- Equipos cuya ubicación no coincide con la documentación técnica
- Equipos instalados en fachada o patio con mala integración o sin autorización aparente
- Condensados mal resueltos o con daños en paramentos
- Soportes corroídos, inestables o improvisados
- Equipos en posición que dificulta el mantenimiento',
  '- Equipos exteriores: vista general y detalle de soportes
- Canalizaciones
- Desagüe de condensados
- Ubicación relativa a cubierta/patio/fachada',
  '- ¿Están legalizados los equipos de climatización instalados?
- ¿Existen fichas técnicas o certificados de los equipos?
- ¿Hay contrato de mantenimiento de climatización?',
  '- Requerimientos municipales (referencia a climatización/calefacción)
- Facturas de suministros eléctricos',
  160, 'pendiente', NULL, true, true, true
),

(
  'dd000000-0000-0000-0005-000000000017',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'Ventilación de lavaderos, tendederos y piezas interiores',
  'Ventilación',
  'Lavaderos, tendederos, cocinas y baños',
  'alta',
  'Revisar visualmente si las zonas sensibles identificadas en documentación cuentan con ventilación aparente suficiente y si existen sistemas de extracción mecánica operativos.',
  '- Rejillas de ventilación: ubicación y estado
- Extractores: existencia y estado aparente de funcionamiento
- Conductos visibles de extracción
- Admisión de aire en espacios interiores
- Olores en espacios concretos
- Condensación en paredes o techos
- Baños sin ventilación natural directa',
  '- Falta total de extracción mecánica en espacios sin ventilación natural
- Rejillas tapadas, selladas o visiblemente obstruidas
- Olores a humedad o a saneamiento
- Condensación visible en paredes o techos
- Equipos de extracción claramente desconectados o desmontados',
  '- Rejillas de ventilación (general y detalle)
- Extractores visibles
- Conductos de extracción
- Zonas con condensación visible',
  '- ¿Existe memoria de ventilación o plano de instalación de extracción?
- ¿La extracción mecánica funciona en todos los espacios previstos?
- ¿Hay quejas de usuarios por olores o humedad ambiental?',
  '- Hoja de encargo Sierra Bullones 2026
- Requerimientos municipales (referencia a ventilación)',
  170, 'pendiente', NULL, true, true, true
),

(
  'dd000000-0000-0000-0005-000000000018',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'PCI visible, detectores y señalización',
  'PCI visible',
  'Zonas comunes, habitaciones y cuartos técnicos',
  'media',
  'Revisar los elementos de protección contra incendios visibles dentro del alcance no invasivo, contrastando con el mantenimiento facturado.',
  '- Detectores de humo: presencia, estado y posición
- Extintores: presencia, señalización y caducidad visible
- Señalización de evacuación y emergencia
- Elementos PCI tapados, dañados o deteriorados
- Coherencia entre lo visible y el mantenimiento facturado a Detex',
  '- Detectores dañados, tapados o ausentes en zonas donde deberían existir
- Extintores con fecha de caducidad vencida o sin precintar
- Señalización de evacuación ausente o deteriorada
- Factura de mantenimiento PCI sin parte técnico asociado
- Elementos PCI visiblemente sin mantenimiento',
  '- Detectores en habitaciones y zonas comunes
- Extintores y señalización
- Zonas comunes: estado general de PCI visible',
  '- ¿Existe parte de revisión técnico de la última revisión de PCI?
- ¿Hay defectos o deficiencias pendientes de subsanar?
- ¿Qué sistema PCI tiene el activo (detección, extinción, señalización)?',
  '- Factura Detex mantenimiento SPCI
- Acta de recepción con reservas 2021 (referencia a PCI)',
  180, 'pendiente', NULL, false, true, true
),

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROL 4 · Fontanería, saneamiento y calefacción
-- ═══════════════════════════════════════════════════════════════════════════════

(
  'dd000000-0000-0000-0005-000000000019',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000004',
  'Contadores de agua y correspondencia con unidades',
  'Fontanería',
  'Cuarto / armario de contadores',
  'alta',
  'Verificar la correspondencia entre los contadores de agua individuales y las unidades del activo, contrastando con los consumos documentados en las facturas del Canal de Isabel II.',
  '- Ubicación y accesibilidad del armario de contadores
- Etiquetado de cada contador y correspondencia con unidad
- Estado de llaves de corte individuales
- Estado general de la batería de contadores
- Correspondencia con unidades: 2ºD, 2ºI, 3ºD, 3ºI u otras
- Contadores con consumo aparentemente cero o anómalamente bajo',
  '- Contadores sin identificar o con etiquetado ilegible
- Llaves de corte inaccesibles o sin identificar
- Consumos aparentemente anómalos sin justificación
- Derivaciones no claras o sin identificar
- Fugas, corrosión o humedad en el armario de contadores',
  '- Batería completa de contadores
- Detalle de etiquetas
- Llaves de corte
- Contadores individuales',
  '- ¿Qué contador corresponde a cada unidad?
- ¿Hay unidades vacías con contador sin consumo?
- ¿Hay cortes activos o consumos en estimación?',
  '- Facturas Canal de Isabel II por unidades',
  190, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000020',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000004',
  'Baños, tomas, sifones y sumideros',
  'Fontanería en baños',
  'Baños',
  'alta',
  'Revisar los puntos más sensibles de fontanería y evacuación en baños de las unidades visitadas.',
  '- Tomas de agua bajo lavabos: estado y sellado
- Sifones: estado, olor y accesibilidad
- Desagüe general de baños
- Sumideros de duchas: colocación, sellado y evacuación
- Presión de agua si es posible verificar
- Olores en desagüe',
  '- Fugas activas o rastros de fugas previas
- Sumideros mal colocados, desnivelados o con sellado deficiente
- Olores de saneamiento en espacios de baño
- Humedad visible bajo muebles de baño
- Evacuación lenta o atascada
- Sellados deteriorados entre tomas y paramentos',
  '- Zona bajo lavabos
- Sumideros de duchas (general y detalle)
- Platos de ducha: nivelación
- Sifones accesibles
- Humedades visibles',
  '- ¿Ha habido filtraciones entre plantas relacionadas con baños?
- ¿Hay atascos recurrentes en desagüe de baños?
- ¿Se corrigieron específicamente los remates de fontanería del acta de 2021?',
  '- Acta de recepción provisional con reservas 2021',
  200, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000021',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000004',
  'Cocinas, lavaderos y tomas de equipos',
  'Fontanería y zonas húmedas',
  'Cocinas, lavaderos, tendederos',
  'alta',
  'Revisar visualmente las tomas, desagües y riesgos de humedad en cocinas y zonas de lavado.',
  '- Tomas de agua y desagüe de lavadora o lavavajillas
- Desagüe de fregadero: sifón y evacuación
- Humedad en muebles bajo fregadero o en paramentos
- Olores en desagüe
- Ventilación del espacio',
  '- Tomas sin rematar correctamente
- Fugas activas o rastros de fugas
- Condensación en paramentos o muebles
- Olores de saneamiento en cocina o lavadero
- Desagüe improvisado o sin sifón visible',
  '- Zona bajo fregadero
- Toma y desagüe de lavadora
- Humedad en paramentos o muebles
- Zonas húmedas del lavadero',
  '- ¿Hay incidencias recurrentes en lavaderos o cocinas?
- ¿Existen equipos (lavadora, lavavajillas) incluidos en el activo?
- ¿Hay mantenimiento preventivo de estas zonas?',
  '- Hoja de encargo Sierra Bullones 2026
- Requerimientos municipales',
  210, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000022',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000004',
  'ACS, calefacción y equipos asociados',
  'ACS y calefacción',
  'Viviendas, lavaderos, cubierta o cuartos técnicos',
  'alta',
  'Identificar los equipos de ACS y calefacción de cada unidad, revisar su estado visible, ubicación y accesibilidad para mantenimiento.',
  '- Termos, calderas individuales o equipos de ACS por unidad
- Llaves de corte y válvulas de seguridad
- Desagüe de seguridad de equipos
- Ventilación del espacio donde está instalado el equipo
- Accesibilidad para mantenimiento periódico
- Señales de fugas, corrosión o deterioro',
  '- Equipos sin placa de identificación visible
- Equipos instalados en espacios sin ventilación suficiente
- Fugas activas o rastros de fugas en equipos
- Acceso prácticamente imposible para mantenimiento
- Ausencia total de mantenimiento documentado',
  '- Equipos ACS/calefacción: vista general y placa de características
- Válvulas y llaves
- Ubicación y accesibilidad general',
  '- ¿Qué sistema de ACS tiene cada unidad (termo eléctrico, caldera, otro)?
- ¿Hay legalización o certificado de los equipos instalados?
- ¿Hay contrato de mantenimiento de ACS?',
  '- Requerimientos municipales (referencia a calefacción/climatización y ACS)
- Facturas de suministros',
  220, 'pendiente', NULL, false, true, true
),

(
  'dd000000-0000-0000-0005-000000000023',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000004',
  'Saneamiento, bajantes, olores y registros',
  'Saneamiento',
  'Baños, cocinas, patios, cuarto técnico si existe',
  'media',
  'Revisar visualmente el estado aparente del sistema de saneamiento e identificar síntomas de problemas recurrentes.',
  '- Bajantes visibles en patios o zonas técnicas
- Registros accesibles: estado y olor
- Olores en patios interiores o zonas comunes
- Humedad cerca de bajantes en paramentos
- Evacuación básica',
  '- Olor persistente a aguas residuales en zonas comunes o patios
- Bajantes con fisuras, roturas o fugas visibles
- Registros sellados, tapados o inaccesibles
- Humedades visibles en paramentos cercanos a bajantes
- Relato de atascos recurrentes',
  '- Bajantes visibles en patios
- Registros accesibles
- Humedades en paramentos cercanos a bajantes
- Patios: estado general',
  '- ¿Hay atascos recurrentes en el saneamiento?
- ¿Se han realizado trabajos de desatasco o reparación de saneamiento?
- ¿Existen partes o registros de mantenimiento de saneamiento?',
  '- Histórico de incidencias (pendiente de recibir)
- Facturas de mantenimiento / suministros',
  230, 'pendiente', NULL, false, false, true
),

(
  'dd000000-0000-0000-0005-000000000024',
  'dd000000-0000-0000-0001-000000000002',
  'dd000000-0000-0000-0002-000000000002',
  'dd000000-0000-0000-0000-000000000004',
  'Humedades, filtraciones y condensaciones',
  'Fontanería y patología visible',
  'Todo el activo — baños, lavaderos, cubierta',
  'alta',
  'Identificar y documentar todos los signos visibles de humedad, filtración o condensación presentes en el activo durante la visita.',
  '- Manchas en techos y paramentos
- Moho visible
- Pintura levantada o burbujeada
- Olores a humedad
- Humedad en zonas próximas a baños, lavaderos, cubierta o patios
- Reparaciones recientes de humedad como indicio de problemas resueltos',
  '- Humedades activas (mancha húmeda al tacto)
- Manchas repetidas entre plantas distintas
- Moho visible en paramentos o techos
- Olor persistente a humedad
- Reparaciones recientes visibles que pudieran ocultar patología activa',
  '- Manchas: vista general con contexto y detalle
- Ubicación general (planta y zona)
- Zona superior e inferior si es posible (para identificar origen)',
  '- ¿Hay filtraciones recurrentes documentadas?
- ¿Hay partes de seguro por humedades?
- ¿Se han realizado reparaciones de humedades recientemente?',
  '- Acta de recepción con reservas 2021
- Histórico de incidencias (pendiente de recibir)',
  240, 'pendiente', NULL, true, true, true
)

ON CONFLICT (id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
